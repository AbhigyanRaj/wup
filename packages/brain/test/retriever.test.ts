import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  RAGService,
  safeRetrieve,
  buildRagContext,
  selectRelevant,
  vectorScoreToCosine,
  MAX_RAG_CONTEXT_CHARS,
  type RetrievedChunk,
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
  const failing = new RAGService({ embed: fakeEmbed, aggregate: async () => { throw new Error("$vectorSearch index not found"); } });
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
