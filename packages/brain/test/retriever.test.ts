import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  RAGService,
  safeRetrieve,
  buildRagContext,
  selectRelevant,
  vectorScoreToCosine,
  cosineSimilarity,
  isVectorSearchUnsupported,
  VECTOR_SEARCH_UNSUPPORTED_TTL_MS,
  MAX_RAG_CONTEXT_CHARS,
  type RetrievedChunk,
  type StoredChunk,
} from "../src/rag/retriever";

const userId = new mongoose.Types.ObjectId().toHexString();
const fakeEmbed = async () => Array.from({ length: 768 }, () => 0.1);

/** Atlas-shaped rows; score is vectorSearchScore = (1 + cos) / 2. */
const row = (cos: number, i: number) => ({
  text: `chunk ${i}`,
  metadata: { sourceFile: `f${i}.pdf`, pageNumber: i, chunkIndex: i },
  _sourceId: new mongoose.Types.ObjectId(),
  score: (1 + cos) / 2,
});

test("vectorSearchScore converts to cosine", () => {
  assert.equal(vectorScoreToCosine(1), 1);
  assert.equal(vectorScoreToCosine(0.5), 0);
  assert.ok(Math.abs(vectorScoreToCosine(0.8) - 0.6) < 1e-12);
});

test("retrieve: threshold, relative window, top-k and userId filter", async () => {
  let pipeline: any[] = [];
  const svc = new RAGService({
    embed: fakeEmbed,
    aggregate: async (p) => {
      pipeline = p;
      // cosines: 0.9, 0.8, 0.76, 0.7 (outside 0.15 window of 0.9), 0.45 (below 0.5)
      return [row(0.8, 1), row(0.9, 0), row(0.76, 2), row(0.7, 3), row(0.45, 4)];
    },
  });
  const out = await svc.retrieve(userId, "what is wuup?");
  assert.deepEqual(out.map((c) => c.text), ["chunk 0", "chunk 1", "chunk 2"]);
  assert.ok(Math.abs(out[0].score - 0.9) < 1e-9);
  const c = out[1];
  assert.equal(c.sourceFile, "f1.pdf");
  assert.equal(c.pageNumber, 1);
  assert.equal(c.chunkIndex, 1);
  assert.equal(typeof c.sourceId, "string");
  assert.deepEqual(c.metadata, { sourceFile: "f1.pdf", pageNumber: 1, chunkIndex: 1, sourceId: c.sourceId });
  assert.equal(String(pipeline[0].$vectorSearch.filter.userId), userId);
  assert.equal(pipeline[0].$vectorSearch.index, "knowledge_vector_index");
});

test("RAG_MIN_COSINE and RAG_TOP_K come from env", async () => {
  process.env.RAG_MIN_COSINE = "0.85";
  process.env.RAG_TOP_K = "1";
  try {
    const svc = new RAGService({ embed: fakeEmbed, aggregate: async () => [row(0.9, 0), row(0.88, 1), row(0.8, 2)] });
    const out = await svc.retrieve(userId, "q");
    assert.deepEqual(out.map((c) => c.text), ["chunk 0"]);
  } finally {
    delete process.env.RAG_MIN_COSINE;
    delete process.env.RAG_TOP_K;
  }
});

test("selectRelevant handles empty and non-finite scores", () => {
  assert.deepEqual(selectRelevant([]), []);
  assert.deepEqual(selectRelevant([{ score: NaN }, { score: 0.2 }]), []);
});

test("the user's own key reaches the embedder", async () => {
  let seenKey: string | undefined;
  const svc = new RAGService({
    embed: async (_q, o) => {
      seenKey = o.apiKey;
      return fakeEmbed();
    },
    aggregate: async () => [],
  });
  await safeRetrieve(userId, "q", { service: svc, apiKey: "user-key" });
  assert.equal(seenKey, "user-key");
});

test("safeRetrieve supports the legacy (service, userId, query) call shape", async () => {
  const svc = new RAGService({ embed: fakeEmbed, aggregate: async () => [row(0.9, 0)] });
  const out = await safeRetrieve(svc, userId, "q");
  assert.equal(out.length, 1);
});

test("safeRetrieve swallows errors and times out", async () => {
  const failing = new RAGService({
    embed: fakeEmbed,
    aggregate: async () => {
      throw new Error("$vectorSearch index not found");
    },
    loadChunks: async () => {
      throw new Error("database down");
    },
  });
  assert.deepEqual(await safeRetrieve(userId, "q", { service: failing }), []);

  let aborted = false;
  const hanging = new RAGService({
    embed: (_q, o) =>
      new Promise((_, reject) => {
        o.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
      }),
    aggregate: async () => [],
  });
  const started = Date.now();
  assert.deepEqual(await safeRetrieve(userId, "q", { service: hanging, timeoutMs: 30 }), []);
  assert.ok(Date.now() - started < 1000);
  assert.equal(aborted, true, "the in-flight embed was aborted");

  const ac = new AbortController();
  const p = safeRetrieve(userId, "q", { service: hanging, signal: ac.signal, timeoutMs: 10_000 });
  ac.abort();
  assert.deepEqual(await p, []);
});

const chunk = (text: string, i: number, score = 0.8): RetrievedChunk => ({
  sourceId: `s${i}`,
  sourceFile: `f${i}.md`,
  pageNumber: 0,
  chunkIndex: i,
  text,
  score,
  metadata: { sourceId: `s${i}`, sourceFile: `f${i}.md`, pageNumber: 0, chunkIndex: i },
});

test("buildRagContext numbers chunks, uses numberFor and respects the budget", () => {
  assert.equal(buildRagContext([]), "");
  const small = buildRagContext([chunk("alpha", 0), chunk("beta", 1)]);
  assert.match(small, /\[1\] Source: "f0\.md" \(relevance: 80%\)\nalpha/);
  assert.match(small, /\[2\] Source: "f1\.md"/);

  const fn = buildRagContext([chunk("alpha", 0), chunk("beta", 1)], (_c, i) => [4, 7][i]);
  assert.match(fn, /\[4\] Source: "f0\.md"/);
  assert.match(fn, /\[7\] Source: "f1\.md"/);
  const arr = buildRagContext([chunk("alpha", 0), chunk("beta", 1)], [3]);
  assert.match(arr, /\[3\] Source/);
  assert.match(arr, /\[2\] Source/, "missing entries fall back to index + 1");

  // Budget: first chunk nearly fills it, the second is truncated, the rest skipped
  const big = "x".repeat(MAX_RAG_CONTEXT_CHARS - 500);
  const ctx = buildRagContext([chunk(big, 0), chunk("y".repeat(2000), 1), chunk("z".repeat(2000), 2)]);
  assert.match(ctx, /\.\.\.\[truncated\]/);
  assert.ok(!ctx.includes("zzz"));
  const bodyLen = ctx.length - "\n\n---\nKNOWLEDGE CONTEXT".length;
  assert.ok(bodyLen <= MAX_RAG_CONTEXT_CHARS + 200);

  // Less than 200 chars left: the next chunk is skipped, never a negative slice
  const exact = "x".repeat(MAX_RAG_CONTEXT_CHARS - 150);
  const skipped = buildRagContext([chunk(exact, 0), chunk("tail chunk", 1)]);
  assert.ok(!skipped.includes("tail chunk"));
  assert.ok(!skipped.includes("[2]"));
});

// ─── JS fallback (non-Atlas MongoDB) ─────────────────────────────────────────

const DIMS = 768;
/** The query is the unit vector e0, so a chunk [cos, sin, 0, ...] has exactly that cosine. */
const unitQuery = async () => {
  const v = new Array(DIMS).fill(0);
  v[0] = 1;
  return v;
};
const vecWithCosine = (cos: number, scale = 1) => {
  const v = new Array(DIMS).fill(0);
  v[0] = cos * scale;
  v[1] = Math.sqrt(Math.max(0, 1 - cos * cos)) * scale;
  return v;
};
const stored = (cos: number, i: number, scale = 1): StoredChunk => ({
  embedding: vecWithCosine(cos, scale),
  text: `stored ${i}`,
  sourceId: new mongoose.Types.ObjectId(),
  metadata: { sourceFile: `doc${i}.pdf`, pageNumber: i, chunkIndex: i },
});
const unsupportedStage = () =>
  Object.assign(new Error("Unrecognized pipeline stage name: '$vectorSearch'"), { code: 40324, codeName: "Location40324" });

async function quietly<T>(fn: (warnings: string[]) => Promise<T>): Promise<T> {
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));
  try {
    return await fn(warnings);
  } finally {
    console.warn = original;
  }
}

describe("RAG JS fallback", () => {
  test("cosineSimilarity and error classification", () => {
    assert.ok(Math.abs(cosineSimilarity([1, 0], [1, 1]) - Math.SQRT1_2) < 1e-12);
    assert.ok(Number.isNaN(cosineSimilarity([1, 0], [1, 0, 0])));
    assert.ok(Number.isNaN(cosineSimilarity([0, 0], [1, 0])));

    assert.equal(isVectorSearchUnsupported(unsupportedStage()), true);
    assert.equal(isVectorSearchUnsupported({ code: 40324, message: "x" }), true);
    assert.equal(isVectorSearchUnsupported({ code: 31082, message: "x" }), true);
    // What a local mongod 7.x actually raises:
    assert.equal(
      isVectorSearchUnsupported({ code: 6047401, codeName: "Location6047401", message: "$vectorSearch stage is only allowed on MongoDB Atlas" }),
      true
    );
    assert.equal(isVectorSearchUnsupported(new Error("stage is only allowed on MongoDB Atlas")), true);
    assert.equal(isVectorSearchUnsupported(new Error("$vectorSearch is not allowed or the syntax is incorrect")), true);
    assert.equal(isVectorSearchUnsupported(new Error("index not found: knowledge_vector_index")), true);
    assert.equal(isVectorSearchUnsupported(new Error("connection reset by peer")), false);
    assert.equal(isVectorSearchUnsupported({ code: 50, codeName: "MaxTimeMSExpired", message: "operation exceeded time limit" }), false);
    assert.equal(isVectorSearchUnsupported(undefined), false);
  });

  test("an unsupported $vectorSearch falls back to JS cosine with the same threshold, window and top-K", async () => {
    let aggregateCalls = 0;
    const loads: { userId: string; limit: number }[] = [];
    // cosines: 0.6, 0.95, 0.85, 0.82 (outside 0.15 window of 0.95 is < 0.80), 0.79, 0.3 (below 0.5)
    const chunks = [stored(0.6, 0), stored(0.95, 1, 3), stored(0.85, 2, 0.2), stored(0.82, 3), stored(0.79, 4), stored(0.3, 5)];
    const svc = new RAGService({
      embed: unitQuery,
      aggregate: async () => {
        aggregateCalls++;
        throw unsupportedStage();
      },
      loadChunks: async (u, o) => {
        loads.push({ userId: u, limit: o.limit });
        return chunks;
      },
    });

    const out = await quietly(() => svc.retrieve(userId, "what is in my report?"));
    assert.deepEqual(out.map((c) => c.text), ["stored 1", "stored 2", "stored 3"], "ranked by cosine, magnitude ignored");
    assert.ok(Math.abs(out[0].score - 0.95) < 1e-9, "the score is the cosine itself (no 2*score-1 conversion)");
    assert.ok(Math.abs(out[1].score - 0.85) < 1e-9);
    assert.equal(out[0].sourceFile, "doc1.pdf");
    assert.equal(out[0].pageNumber, 1);
    assert.equal(out[0].sourceId, String(chunks[1].sourceId));
    assert.deepEqual(out[0].metadata, { sourceFile: "doc1.pdf", pageNumber: 1, chunkIndex: 1, sourceId: out[0].sourceId });
    assert.ok(!("embedding" in out[0]), "embeddings never leave the retriever");
    assert.deepEqual(loads, [{ userId, limit: 5000 }], "the user's chunks, capped at the default 5000");
    assert.equal(aggregateCalls, 1);

    // RAG_TOP_K applies to the fallback too
    process.env.RAG_TOP_K = "2";
    try {
      const top2 = await svc.retrieve(userId, "q");
      assert.deepEqual(top2.map((c) => c.text), ["stored 1", "stored 2"]);
    } finally {
      delete process.env.RAG_TOP_K;
    }
  });

  test("the unsupported verdict is cached for 10 minutes and warned about once", async () => {
    let now = 1_000_000;
    let aggregateCalls = 0;
    let loads = 0;
    const svc = new RAGService({
      embed: unitQuery,
      now: () => now,
      aggregate: async () => {
        aggregateCalls++;
        throw unsupportedStage();
      },
      loadChunks: async () => {
        loads++;
        return [stored(0.9, 0)];
      },
    });
    const warnings = await quietly(async (w) => {
      assert.equal((await svc.retrieve(userId, "a")).length, 1);
      assert.equal(svc.usingFallback, true);
      assert.equal((await svc.retrieve(userId, "b")).length, 1);
      assert.equal((await svc.retrieve(userId, "c")).length, 1);
      assert.equal(aggregateCalls, 1, "the failing stage is not retried while cached");

      now += VECTOR_SEARCH_UNSUPPORTED_TTL_MS + 1;
      assert.equal(svc.usingFallback, false);
      assert.equal((await svc.retrieve(userId, "d")).length, 1);
      assert.equal(aggregateCalls, 2, "retried after the cache expires");
      return w;
    });
    assert.equal(loads, 4);
    assert.equal(warnings.length, 1, "a single warning");
    assert.match(warnings[0], /Falling back/);
  });

  test("RAG_FALLBACK_MAX_CHUNKS caps the chunks loaded and scored", async () => {
    process.env.RAG_FALLBACK_MAX_CHUNKS = "3";
    try {
      let limitSeen = -1;
      const svc = new RAGService({
        embed: unitQuery,
        aggregate: async () => {
          throw unsupportedStage();
        },
        // A misbehaving loader that ignores the limit: the best match sits past the cap
        loadChunks: async (_u, o) => {
          limitSeen = o.limit;
          return [stored(0.7, 0), stored(0.75, 1), stored(0.72, 2), stored(0.99, 3)];
        },
      });
      const out = await quietly(() => svc.retrieve(userId, "q"));
      assert.equal(limitSeen, 3);
      assert.deepEqual(out.map((c) => c.text), ["stored 1", "stored 2", "stored 0"]);
    } finally {
      delete process.env.RAG_FALLBACK_MAX_CHUNKS;
    }
  });

  test("other aggregate errors do not fall back", async () => {
    let loads = 0;
    const svc = new RAGService({
      embed: unitQuery,
      aggregate: async () => {
        throw new Error("connection reset by peer");
      },
      loadChunks: async () => {
        loads++;
        return [];
      },
    });
    await assert.rejects(svc.retrieve(userId, "q"), /connection reset/);
    assert.equal(loads, 0);
    assert.equal(svc.usingFallback, false);
  });

  test("chunks with a missing or wrong-size embedding are skipped", async () => {
    const bad: any[] = [
      { text: "no embedding" },
      { text: "short", embedding: [1, 0] },
      { text: "zero", embedding: new Array(DIMS).fill(0) },
      stored(0.9, 7),
    ];
    const svc = new RAGService({
      embed: unitQuery,
      aggregate: async () => {
        throw unsupportedStage();
      },
      loadChunks: async () => bad,
    });
    const out = await quietly(() => svc.retrieve(userId, "q"));
    assert.deepEqual(out.map((c) => c.text), ["stored 7"]);
  });
});

describe("RAG fallback against a real non-Atlas mongod", () => {
  let server: MongoMemoryServer;
  let KnowledgeChunk: mongoose.Model<any>;

  before(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: "wup_rag_fallback" });
    ({ KnowledgeChunk } = (await import("@wup/models")) as any);
  });

  after(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });

  test("$vectorSearch fails on a local mongod and the user's own chunks are found via JS, most recent first", async () => {
    const me = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    const sourceId = new mongoose.Types.ObjectId();
    const doc = (owner: mongoose.Types.ObjectId, cos: number, i: number) => ({
      _id: mongoose.Types.ObjectId.createFromTime(Math.floor(Date.now() / 1000) + i),
      userId: owner,
      sourceId,
      text: `${owner.equals(me) ? "mine" : "theirs"} ${i}`,
      embedding: vecWithCosine(cos),
      metadata: { sourceFile: "Handbook.pdf", pageNumber: i, chunkIndex: i, totalChunks: 10 },
    });
    await KnowledgeChunk.insertMany([doc(me, 0.9, 1), doc(me, 0.8, 2), doc(me, 0.1, 3), doc(other, 0.99, 4), doc(me, 0.95, 5)]);

    const svc = new RAGService({ embed: unitQuery });
    const out = await quietly(() => svc.retrieve(me.toHexString(), "what does the handbook say?"));
    assert.equal(svc.usingFallback, true, "the local mongod rejected $vectorSearch");
    assert.deepEqual(out.map((c) => c.text), ["mine 5", "mine 1", "mine 2"]);
    assert.equal(out[0].sourceId, sourceId.toHexString());
    assert.equal(out[0].sourceFile, "Handbook.pdf");
    assert.ok(!("embedding" in out[0]));

    // Over the cap, the most recent chunks win: only "mine 5" and "mine 3" (newest ids) are scored
    process.env.RAG_FALLBACK_MAX_CHUNKS = "2";
    try {
      const capped = await svc.retrieve(me.toHexString(), "q");
      assert.deepEqual(capped.map((c) => c.text), ["mine 5"]);
    } finally {
      delete process.env.RAG_FALLBACK_MAX_CHUNKS;
    }

    // safeRetrieve (what the orchestrator calls) now returns the chunks instead of []
    const viaSafe = await safeRetrieve(me.toHexString(), "q", { service: svc });
    assert.equal(viaSafe.length, 3);
  });
});
