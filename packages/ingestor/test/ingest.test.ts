/**
 * Queue / pipeline integration tests against mongodb-memory-server with a
 * fake embedding client (no network).
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { KnowledgeChunk, KnowledgeSource, KnowledgeSourceText } from "@wup/models";
import { configureEmbedder, EMBEDDING_DIMENSIONS, type EmbeddingClient } from "../src/embedder";
import {
  enqueueIngest,
  retryIngest,
  recoverInterruptedIngests,
  cancelIngest,
  waitForIngestIdle,
  RESTART_MESSAGE,
} from "../src/queue";
import { ingestorService } from "../src/ingestorService";
import { seedTemplateKnowledge, resetTemplateCache } from "../src/templates";

let server: MongoMemoryServer;
let restoreEmbedder: () => void;

/** Fake client; `gate` (when set) blocks the Nth call until released. */
class FakeClient implements EmbeddingClient {
  calls = 0;
  textsSeen = 0;
  blockOnCall: number | null = null;
  private release: (() => void) | null = null;
  private reached: (() => void) | null = null;
  reachedGate = new Promise<void>((r) => (this.reached = r));
  failWith: unknown[] = [];

  async embedTexts(texts: string[]) {
    this.calls++;
    if (this.blockOnCall === this.calls) {
      this.reached?.();
      await new Promise<void>((r) => (this.release = r));
    }
    const f = this.failWith.shift();
    if (f) throw f;
    this.textsSeen += texts.length;
    return texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01));
  }
  open() {
    this.release?.();
  }
}

let client: FakeClient;
const userId = new mongoose.Types.ObjectId().toHexString();

before(async () => {
  process.env.INGEST_CONCURRENCY = "2";
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "ingest_test" });
});

after(async () => {
  restoreEmbedder?.();
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  restoreEmbedder?.();
  client = new FakeClient();
  restoreEmbedder = configureEmbedder({ client, backoffMs: [1, 1] });
  await KnowledgeSource.deleteMany({});
  await KnowledgeChunk.deleteMany({});
  await KnowledgeSourceText.deleteMany({});
});

async function newSource(extra: Record<string, unknown> = {}) {
  const s: any = await KnowledgeSource.create({
    userId,
    name: "doc.txt",
    fileHash: new mongoose.Types.ObjectId().toHexString(),
    type: "txt",
    status: "pending",
    fileSize: 10,
    mimeType: "text/plain",
    ...extra,
  });
  return String(s._id);
}

/** ~N chunks of plain text with the default chunker (1800/200). */
const longText = (chunks: number) => "lorem ipsum dolor sit amet. ".repeat(Math.ceil((chunks * 1600) / 28));

test("indexes a text file: progress, heartbeat and stored text", async () => {
  const sourceId = await newSource();
  client.blockOnCall = 2;
  const done = enqueueIngest({ userId, sourceId, buffer: Buffer.from(longText(70)), fileName: "doc.txt", type: "txt" });

  await client.reachedGate;
  const mid: any = await KnowledgeSource.findById(sourceId).lean();
  assert.equal(mid.status, "indexing");
  assert.ok(mid.chunksTotal > 50);
  assert.equal(mid.chunksDone, 50);
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), 50);
  const heartbeat1 = new Date(mid.updatedAt).getTime();
  assert.ok(heartbeat1 >= new Date(mid.createdAt).getTime());

  client.open();
  assert.equal(await done, "indexed");
  const s: any = await KnowledgeSource.findById(sourceId).lean();
  assert.equal(s.status, "indexed");
  assert.equal(s.chunkCount, s.chunksTotal);
  assert.equal(s.chunksDone, s.chunksTotal);
  assert.equal(s.attempts, 1);
  assert.equal(s.canRetry, false);
  assert.ok(new Date(s.updatedAt).getTime() >= heartbeat1);
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), s.chunkCount);
  const chunk: any = await KnowledgeChunk.findOne({ sourceId, "metadata.chunkIndex": 0 }).lean();
  assert.equal(chunk.metadata.sourceFile, "doc.txt");
  assert.equal(chunk.metadata.totalChunks, s.chunkCount);
  assert.equal(chunk.embedding.length, EMBEDDING_DIMENSIONS);

  const stored: any = await KnowledgeSourceText.findOne({ sourceId }).lean();
  const text = zlib.gunzipSync(Buffer.from(stored.gz.buffer ?? stored.gz)).toString("utf8");
  assert.ok(text.startsWith("lorem ipsum"));
  assert.equal(stored.chars, text.length);
});

test("deleting the source mid-ingest leaves no chunks", async () => {
  const sourceId = await newSource();
  client.blockOnCall = 2;
  const done = enqueueIngest({ userId, sourceId, buffer: Buffer.from(longText(120)), fileName: "doc.txt", type: "txt" });
  await client.reachedGate;
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), 50);

  // What the DELETE handler does, without cancelling the job: the job must notice on its own.
  await KnowledgeSource.deleteOne({ _id: sourceId });
  await KnowledgeChunk.deleteMany({ sourceId });
  await KnowledgeSourceText.deleteMany({ sourceId });
  client.open();

  assert.equal(await done, "deleted");
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), 0);
  assert.equal(await KnowledgeSourceText.countDocuments({ sourceId }), 0);
  assert.equal(client.calls, 2, "stopped after the batch in flight");
});

test("cancelIngest aborts a running job", async () => {
  const sourceId = await newSource();
  client.blockOnCall = 1;
  const done = enqueueIngest({ userId, sourceId, buffer: Buffer.from(longText(10)), fileName: "doc.txt", type: "txt" });
  await client.reachedGate;
  await KnowledgeSource.deleteOne({ _id: sourceId });
  assert.equal(cancelIngest(sourceId), true);
  client.open();
  assert.equal(await done, "deleted");
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), 0);
});

test("a failed ingest rolls back and can be retried from the stored text", async () => {
  const sourceId = await newSource();
  const bad: any = new Error("[400 Bad Request] something broke");
  bad.status = 400;
  client.failWith.push(undefined, bad); // first batch ok, second fails
  const outcome = await enqueueIngest({ userId, sourceId, buffer: Buffer.from(longText(60)), fileName: "doc.txt", type: "txt" });
  assert.equal(outcome, "error");
  let s: any = await KnowledgeSource.findById(sourceId).lean();
  assert.equal(s.status, "error");
  assert.equal(s.canRetry, true);
  assert.equal(s.attempts, 1);
  assert.equal(s.metadata.failedAtChunkIndex, 50);
  assert.ok(s.metadata.errorMessage);
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), 0, "rolled back");

  // Wrong user cannot retry
  const other = await retryIngest(sourceId, new mongoose.Types.ObjectId().toHexString());
  assert.deepEqual(other, { ok: false, reason: "not_found" });

  const r = await retryIngest(sourceId, userId);
  assert.equal(r.ok, true);
  assert.equal((r as any).source.status, "pending");
  await waitForIngestIdle();
  s = await KnowledgeSource.findById(sourceId).lean();
  assert.equal(s.status, "indexed");
  assert.equal(s.attempts, 2);
  assert.ok(s.chunkCount > 50);
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId }), s.chunkCount);

  // Indexed sources are not retryable
  assert.deepEqual(await retryIngest(sourceId, userId), { ok: false, reason: "not_retryable" });
});

test("daily quota ends as error_quota (retryable)", async () => {
  const sourceId = await newSource();
  const quota: any = new Error("[429 Too Many Requests] quota");
  quota.status = 429;
  quota.errorDetails = [{ violations: [{ quotaId: "EmbedContentRequestsPerDayPerProject" }] }];
  client.failWith.push(quota);
  assert.equal(await enqueueIngest({ userId, sourceId, buffer: Buffer.from("hello world, quota"), fileName: "q.txt", type: "txt" }), "error_quota");
  const s: any = await KnowledgeSource.findById(sourceId).lean();
  assert.equal(s.status, "error_quota");
  assert.equal(s.canRetry, true);
  assert.match(s.metadata.errorMessage, /quota/i);
});

test("an empty document fails without retry", async () => {
  const sourceId = await newSource();
  assert.equal(await enqueueIngest({ userId, sourceId, buffer: Buffer.from("   \n\n "), fileName: "e.txt", type: "txt" }), "error");
  const s: any = await KnowledgeSource.findById(sourceId).lean();
  assert.equal(s.canRetry, false);
  assert.deepEqual(await retryIngest(sourceId, userId), { ok: false, reason: "no_text" });
});

test("CSV chunks repeat the header", async () => {
  const sourceId = await newSource({ type: "csv", name: "people.csv" });
  const csv = "id,name,role\n" + Array.from({ length: 300 }, (_, i) => `${i},"Name ${i}",Engineer`).join("\n");
  assert.equal(await enqueueIngest({ userId, sourceId, buffer: Buffer.from(csv), fileName: "people.csv", type: "csv" }), "indexed");
  const chunks: any[] = await KnowledgeChunk.find({ sourceId }).sort({ "metadata.chunkIndex": 1 }).lean();
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.text.startsWith("id,name,role\n"));
});

test("the per-file chunk cap truncates", async () => {
  process.env.MAX_CHUNKS_PER_FILE = "3";
  try {
    const sourceId = await newSource();
    assert.equal(await enqueueIngest({ userId, sourceId, buffer: Buffer.from(longText(10)), fileName: "doc.txt", type: "txt" }), "indexed");
    const s: any = await KnowledgeSource.findById(sourceId).lean();
    assert.equal(s.chunkCount, 3);
    assert.equal(s.metadata.truncated, true);
  } finally {
    delete process.env.MAX_CHUNKS_PER_FILE;
  }
});

test("concurrency is bounded and the same source is not queued twice", async () => {
  process.env.INGEST_CONCURRENCY = "1";
  try {
    client.blockOnCall = 1;
    const a = await newSource();
    const b = await newSource();
    const pa = enqueueIngest({ userId, sourceId: a, buffer: Buffer.from("first document text"), fileName: "a.txt", type: "txt" });
    const pb = enqueueIngest({ userId, sourceId: b, buffer: Buffer.from("second document text"), fileName: "b.txt", type: "txt" });
    assert.equal(await enqueueIngest({ userId, sourceId: b, text: "dup", fileName: "b.txt", type: "txt" }), "skipped");
    await client.reachedGate;
    const sb: any = await KnowledgeSource.findById(b).lean();
    assert.equal(sb.attempts, 0, "second job has not started");
    client.open();
    assert.deepEqual(await Promise.all([pa, pb]), ["indexed", "indexed"]);
  } finally {
    process.env.INGEST_CONCURRENCY = "2";
  }
});

test("ingestorService.ingest() compat enqueues", async () => {
  const sourceId = await newSource();
  assert.equal(await ingestorService.ingest(userId, sourceId, Buffer.from("compat path text"), "text/plain", "c.txt"), "indexed");
});

test("recoverInterruptedIngests marks stuck sources failed", async () => {
  const withText = await newSource({ status: "indexing" });
  const noText = await newSource({ status: "pending" });
  const fine = await newSource({ status: "indexed", chunkCount: 1 });
  await KnowledgeSourceText.create({ sourceId: withText, userId, gz: zlib.gzipSync("stored text here"), chars: 16 });
  await KnowledgeChunk.create({
    userId,
    sourceId: withText,
    text: "partial",
    embedding: [1],
    metadata: { chunkIndex: 0, totalChunks: 2, sourceFile: "doc.txt" },
  });

  assert.equal(await recoverInterruptedIngests(), 2);
  const a: any = await KnowledgeSource.findById(withText).lean();
  assert.equal(a.status, "error");
  assert.equal(a.canRetry, true);
  assert.equal(a.metadata.errorMessage, RESTART_MESSAGE);
  const b: any = await KnowledgeSource.findById(noText).lean();
  assert.equal(b.status, "error");
  assert.equal(b.canRetry, false);
  assert.equal((await KnowledgeSource.findById(fine).lean() as any).status, "indexed");
  assert.equal(await KnowledgeChunk.countDocuments({ sourceId: withText }), 0);

  // and the recovered source retries from its stored text
  assert.equal((await retryIngest(withText, userId)).ok, true);
  await waitForIngestIdle();
  assert.equal(((await KnowledgeSource.findById(withText).lean()) as any).status, "indexed");
  assert.equal(await recoverInterruptedIngests(), 0);
});

test("seedTemplateKnowledge indexes the demo guide once per user and embeds once per process", async () => {
  resetTemplateCache();
  const u1 = new mongoose.Types.ObjectId().toHexString();
  const u2 = new mongoose.Types.ObjectId().toHexString();
  assert.equal(await seedTemplateKnowledge(u1, "demo-guide"), true);
  const callsAfterFirst = client.calls;
  assert.ok(callsAfterFirst >= 1);
  assert.equal(await seedTemplateKnowledge(u2, "demo-guide"), true);
  assert.equal(await seedTemplateKnowledge(u1, "demo-guide"), true, "idempotent");
  assert.equal(client.calls, callsAfterFirst, "embedded once per process");

  const s: any = await KnowledgeSource.findOne({ userId: u1 }).lean();
  assert.equal(s.name, "Getting started with wuup.md");
  assert.equal(s.status, "indexed");
  assert.equal(s.type, "md");
  assert.equal(await KnowledgeSource.countDocuments({ userId: u1 }), 1);
  assert.equal(await KnowledgeChunk.countDocuments({ userId: u1 }), s.chunkCount);
  assert.equal(await KnowledgeChunk.countDocuments({ userId: u2 }), s.chunkCount);
  const c: any = await KnowledgeChunk.findOne({ userId: u1 }).lean();
  assert.equal(c.metadata.sourceFile, "Getting started with wuup.md");
});

test("seedTemplateKnowledge returns false on failure", async () => {
  resetTemplateCache();
  const bad: any = new Error("[400] bad key");
  bad.status = 400;
  client.failWith.push(bad);
  const u = new mongoose.Types.ObjectId().toHexString();
  assert.equal(await seedTemplateKnowledge(u, "demo-guide"), false);
  assert.equal(await KnowledgeSource.countDocuments({ userId: u }), 0);
  resetTemplateCache();
});
