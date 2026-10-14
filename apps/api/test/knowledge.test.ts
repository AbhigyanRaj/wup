/**
 * WS-4 knowledge API: upload / list / status / retry / delete / config, with
 * an in-memory MongoDB and a fake embedding client (no network).
 *
 * A minimal app (knowledge router + error handler) is built here so these
 * tests do not depend on the rest of the app.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";
import express, { type Express } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

// Environment first: config/env is parsed when the routes are loaded below.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-0123456789abcdef0123456789";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-encryption-key-0123456789abcdef";
process.env.UPLOAD_RATE_LIMIT_PER_HOUR = "1000";
delete process.env.GEMINI_API_KEY;

let server: MongoMemoryServer;
let app: Express;
let models: typeof import("@wup/models");
let ingestor: typeof import("@wup/ingestor");
let token: string;
let otherToken: string;
let userId: string;

/** Fake embedder: optional failures and an optional gate on the Nth call. */
const fake = {
  calls: 0,
  failures: [] as unknown[],
  gateOnCall: null as number | null,
  release: null as (() => void) | null,
  reached: null as (() => void) | null,
  reset() {
    this.calls = 0;
    this.failures = [];
    this.gateOnCall = null;
    this.release = null;
    this.reached = null;
  },
  async embedTexts(texts: string[]) {
    this.calls++;
    if (this.gateOnCall === this.calls) {
      this.reached?.();
      await new Promise<void>((r) => (this.release = r));
    }
    const f = this.failures.shift();
    if (f) throw f;
    return texts.map(() => Array.from({ length: 768 }, () => 0.02));
  },
};

const badRequestError = () => Object.assign(new Error("[400 Bad Request] boom"), { status: 400 });
const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "knowledge_api_test" });
  models = await import("@wup/models");
  ingestor = await import("@wup/ingestor");
  ingestor.configureEmbedder({ client: fake, backoffMs: [1] });

  const { default: knowledgeRoutes } = await import("../src/routes/knowledge");
  const { errorHandler } = await import("../src/middleware/error");
  const { signToken } = await import("../src/lib/session");

  app = express();
  app.use(express.json());
  app.use("/knowledge", knowledgeRoutes);
  app.use(errorHandler);

  const user: any = await models.User.create({ email: "k@example.com", password: "x", name: "K", role: "Founder" });
  const other: any = await models.User.create({ email: "o@example.com", password: "x", name: "O", role: "Founder" });
  userId = String(user._id);
  token = signToken(user);
  otherToken = signToken(other);
});

after(async () => {
  await ingestor?.waitForIngestIdle();
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await ingestor.waitForIngestIdle();
  fake.reset();
  await models.KnowledgeSource.deleteMany({});
  await models.KnowledgeChunk.deleteMany({});
  await models.KnowledgeSourceText.deleteMany({});
  const { resetRateLimits } = await import("../src/middleware/rateLimits");
  resetRateLimits();
});

function upload(content: string | Buffer, filename: string, contentType = "text/plain", t = token) {
  return request(app)
    .post("/knowledge/upload")
    .set(auth(t))
    .attach("file", Buffer.isBuffer(content) ? content : Buffer.from(content), { filename, contentType });
}

const longText = (chunks: number) => "knowledge base sentence. ".repeat(Math.ceil((chunks * 1600) / 25));

// ─── Upload ───────────────────────────────────────────────────────────────────

test("md, csv and txt uploads are accepted and indexed (202, legacy + new fields)", async () => {
  const cases: Array<[string, string, string]> = [
    ["# Guide\n\nHow to connect MongoDB read-only.", "guide.md", "md"],
    ["name,city\nAda,London\nBob,Paris\n", "people.csv", "csv"],
    ["Plain text notes about wuup.", "notes.txt", "txt"],
  ];
  for (const [content, filename, type] of cases) {
    const res = await upload(content, filename);
    assert.equal(res.status, 202, `${filename}: ${JSON.stringify(res.body)}`);
    assert.equal(typeof res.body.sourceId, "string");
    assert.equal(res.body.name, filename);
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.source.id, res.body.sourceId);
    assert.equal(res.body.source._id, res.body.sourceId);
    assert.equal(res.body.source.type, type);
    assert.equal("fileHash" in res.body.source, false);
  }
  await ingestor.waitForIngestIdle();
  const list = await request(app).get("/knowledge").set(auth());
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body));
  assert.equal(list.body.length, 3);
  for (const s of list.body) {
    assert.equal(s.status, "indexed");
    assert.ok(s.chunkCount >= 1);
    assert.equal(s.progress, null);
    assert.equal(s.canRetry, false);
    assert.equal(s.errorMessage, null);
    assert.deepEqual(s.metadata, { truncated: false });
  }
  const csvChunk: any = await models.KnowledgeChunk.findOne({ "metadata.sourceFile": "people.csv" }).lean();
  assert.ok(csvChunk.text.startsWith("name,city\n"));
});

test("a text file renamed to .pdf is rejected with 400 UNSUPPORTED_FILE", async () => {
  const res = await upload("I am not a PDF at all", "fake.pdf", "application/pdf");
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "UNSUPPORTED_FILE");
  assert.equal(await models.KnowledgeSource.countDocuments({}), 0);
});

test("a disallowed extension is rejected with 400", async () => {
  const res = await upload("echo hi", "run.sh", "text/plain");
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "UNSUPPORTED_FILE");
});

test("a binary renamed .txt is rejected", async () => {
  const res = await upload(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0d]), "image.txt");
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "UNSUPPORTED_FILE");
});

test("the client mimetype is ignored", async () => {
  // Markdown sent as application/pdf: detected from the bytes as md
  const res = await upload("# Title\n\nbody text", "spoof.md", "application/pdf");
  assert.equal(res.status, 202);
  assert.equal(res.body.source.type, "md");
  // Real PDF bytes sent as text/plain: detected as pdf
  const pdf = await upload(Buffer.from("%PDF-1.4\n%garbage"), "real.pdf", "text/plain");
  assert.equal(pdf.status, 202);
  assert.equal(pdf.body.source.type, "pdf");
  await ingestor.waitForIngestIdle();
  const doc: any = await models.KnowledgeSource.findById(res.body.sourceId).lean();
  assert.equal(doc.mimeType, "text/markdown");
  // The broken PDF fails without a retry option
  const broken: any = await models.KnowledgeSource.findById(pdf.body.sourceId).lean();
  assert.equal(broken.status, "error");
  assert.equal(broken.canRetry, false);
});

test("missing and empty files are 400", async () => {
  const none = await request(app).post("/knowledge/upload").set(auth()).field("x", "y");
  assert.equal(none.status, 400);
  const empty = await upload(Buffer.alloc(0), "empty.txt");
  assert.equal(empty.status, 400);
});

// ─── Duplicates ───────────────────────────────────────────────────────────────

test("an indexed duplicate is 409", async () => {
  const first = await upload("duplicate me please", "dup.txt");
  assert.equal(first.status, 202);
  await ingestor.waitForIngestIdle();
  const again = await upload("duplicate me please", "dup-copy.txt");
  assert.equal(again.status, 409);
  assert.equal(again.body.sourceId, first.body.sourceId);
  assert.equal(again.body.status, "indexed");
  assert.equal(again.body.source.id, first.body.sourceId);
  assert.ok(again.body.error);
});

test("a failed duplicate is reset and re-queued (202, same source)", async () => {
  fake.failures.push(badRequestError());
  const first = await upload("this will fail first", "f.txt");
  await ingestor.waitForIngestIdle();
  let s: any = await models.KnowledgeSource.findById(first.body.sourceId).lean();
  assert.equal(s.status, "error");

  const again = await upload("this will fail first", "f.txt");
  assert.equal(again.status, 202);
  assert.equal(again.body.sourceId, first.body.sourceId);
  assert.equal(again.body.status, "pending");
  await ingestor.waitForIngestIdle();
  s = await models.KnowledgeSource.findById(first.body.sourceId).lean();
  assert.equal(s.status, "indexed");
  assert.equal(s.attempts, 2);
  assert.equal(await models.KnowledgeSource.countDocuments({}), 1);
});

test("duplicates are per user", async () => {
  assert.equal((await upload("shared bytes", "a.txt")).status, 202);
  await ingestor.waitForIngestIdle();
  assert.equal((await upload("shared bytes", "a.txt", "text/plain", otherToken)).status, 202);
});

// ─── Retry ────────────────────────────────────────────────────────────────────

test("retry re-queues a failed source from its stored text", async () => {
  fake.failures.push(badRequestError());
  const up = await upload("retry this document", "r.txt");
  await ingestor.waitForIngestIdle();
  const failed = await request(app).get(`/knowledge/${up.body.sourceId}`).set(auth());
  assert.equal(failed.body.status, "error");
  assert.equal(failed.body.canRetry, true);
  assert.ok(failed.body.errorMessage);

  const other = await request(app).post(`/knowledge/${up.body.sourceId}/retry`).set(auth(otherToken));
  assert.equal(other.status, 404);

  const res = await request(app).post(`/knowledge/${up.body.sourceId}/retry`).set(auth());
  assert.equal(res.status, 202);
  assert.equal(res.body.source.id, up.body.sourceId);
  assert.equal(res.body.source.status, "pending");
  await ingestor.waitForIngestIdle();
  const ok = await request(app).get(`/knowledge/${up.body.sourceId}`).set(auth());
  assert.equal(ok.body.status, "indexed");

  // Indexed: nothing to retry
  assert.equal((await request(app).post(`/knowledge/${up.body.sourceId}/retry`).set(auth())).status, 409);
});

test("retry without stored text is 409; bad ids are 400", async () => {
  const s: any = await models.KnowledgeSource.create({
    userId,
    name: "old.pdf",
    fileHash: "abc",
    type: "pdf",
    status: "error",
    fileSize: 1,
    mimeType: "application/pdf",
    metadata: { errorMessage: "PDF has no extractable text." },
  });
  const res = await request(app).post(`/knowledge/${s._id}/retry`).set(auth());
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "CONFLICT");
  assert.equal((await request(app).post(`/knowledge/not-an-id/retry`).set(auth())).status, 400);
  assert.equal((await request(app).get(`/knowledge/not-an-id/status`).set(auth())).status, 400);
});

// ─── Progress and legacy status ──────────────────────────────────────────────

test("progress fields while indexing, and the legacy status shape", async () => {
  fake.gateOnCall = 2;
  const reached = new Promise<void>((r) => (fake.reached = r));
  const up = await upload(longText(70), "long.txt");
  assert.equal(up.status, 202);
  await reached;

  const status = await request(app).get(`/knowledge/${up.body.sourceId}/status`).set(auth());
  assert.equal(status.status, 200);
  for (const key of ["sourceId", "status", "chunkCount", "name", "errorMessage", "truncated", "progress"]) {
    assert.ok(key in status.body || (key === "errorMessage" && status.body.errorMessage === undefined), key);
  }
  assert.equal(status.body.sourceId, up.body.sourceId);
  assert.equal(status.body.status, "indexing");
  assert.equal(status.body.name, "long.txt");
  assert.equal(status.body.truncated, false);
  assert.equal(status.body.progress.done, 50);
  assert.ok(status.body.progress.total > 50);

  const dto = await request(app).get(`/knowledge/${up.body.sourceId}`).set(auth());
  assert.deepEqual(dto.body.progress, status.body.progress);
  assert.equal(dto.body.chunksDone, 50);

  fake.release?.();
  await ingestor.waitForIngestIdle();
  const done = await request(app).get(`/knowledge/${up.body.sourceId}/status`).set(auth());
  assert.equal(done.body.status, "indexed");
  assert.equal(done.body.progress, null);
  assert.equal(done.body.chunkCount, dto.body.progress.total);
});

test("legacy status on failure carries errorMessage", async () => {
  fake.failures.push(badRequestError());
  const up = await upload("will fail for status", "s.txt");
  await ingestor.waitForIngestIdle();
  const res = await request(app).get(`/knowledge/${up.body.sourceId}/status`).set(auth());
  assert.equal(res.body.status, "error");
  assert.equal(typeof res.body.errorMessage, "string");
  assert.equal(res.body.canRetry, true);
});

test("other users cannot see a source", async () => {
  const up = await upload("private document", "p.txt");
  await ingestor.waitForIngestIdle();
  assert.equal((await request(app).get(`/knowledge/${up.body.sourceId}`).set(auth(otherToken))).status, 404);
  assert.equal((await request(app).get(`/knowledge/${up.body.sourceId}/status`).set(auth(otherToken))).status, 404);
  assert.equal((await request(app).delete(`/knowledge/${up.body.sourceId}`).set(auth(otherToken))).status, 404);
  assert.deepEqual((await request(app).get(`/knowledge`).set(auth(otherToken))).body, []);
});

// ─── Watchdog, delete, config ────────────────────────────────────────────────

test("watchdog: stale indexing and pending sources become errors", async () => {
  const mk = async (status: string, minutesAgo: number) => {
    const s: any = await models.KnowledgeSource.create({
      userId, name: `${status}.txt`, fileHash: `${status}${minutesAgo}`, type: "txt", status, fileSize: 1, mimeType: "text/plain",
    });
    await models.KnowledgeSource.collection.updateOne(
      { _id: s._id },
      { $set: { updatedAt: new Date(Date.now() - minutesAgo * 60_000) } }
    );
    return String(s._id);
  };
  const staleIndexing = await mk("indexing", 6);
  const freshIndexing = await mk("indexing", 2);
  const stalePending = await mk("pending", 16);
  const freshPending = await mk("pending", 10);
  await models.KnowledgeSourceText.create({ sourceId: staleIndexing, userId, gz: zlib.gzipSync("text"), chars: 4 });

  const list = await request(app).get("/knowledge").set(auth());
  const byId = new Map(list.body.map((s: any) => [s.id, s]));
  const a: any = byId.get(staleIndexing);
  assert.equal(a.status, "error");
  assert.match(a.errorMessage, /stalled/i);
  assert.equal(a.canRetry, true);
  assert.equal((byId.get(freshIndexing) as any).status, "indexing");
  const c: any = byId.get(stalePending);
  assert.equal(c.status, "error");
  assert.equal(c.canRetry, false);
  assert.equal((byId.get(freshPending) as any).status, "pending");
});

test("delete removes the source, its chunks and its stored text", async () => {
  const up = await upload("delete me later", "d.txt");
  await ingestor.waitForIngestIdle();
  const id = up.body.sourceId;
  assert.ok((await models.KnowledgeChunk.countDocuments({ sourceId: id })) > 0);
  assert.equal(await models.KnowledgeSourceText.countDocuments({ sourceId: id }), 1);
  const res = await request(app).delete(`/knowledge/${id}`).set(auth());
  assert.equal(res.status, 200);
  assert.ok(res.body.chunksDeleted >= 1);
  assert.equal(await models.KnowledgeSource.countDocuments({ _id: id }), 0);
  assert.equal(await models.KnowledgeChunk.countDocuments({ sourceId: id }), 0);
  assert.equal(await models.KnowledgeSourceText.countDocuments({ sourceId: id }), 0);
  assert.equal((await request(app).delete(`/knowledge/${id}`).set(auth())).status, 404);
});

test("delete during indexing leaves no chunks behind", async () => {
  fake.gateOnCall = 2;
  const reached = new Promise<void>((r) => (fake.reached = r));
  const up = await upload(longText(120), "big.txt");
  await reached;
  assert.equal((await request(app).delete(`/knowledge/${up.body.sourceId}`).set(auth())).status, 200);
  fake.release?.();
  await ingestor.waitForIngestIdle();
  assert.equal(await models.KnowledgeChunk.countDocuments({ sourceId: up.body.sourceId }), 0);
  assert.equal(await models.KnowledgeSourceText.countDocuments({ sourceId: up.body.sourceId }), 0);
});

test("GET /knowledge/config", async () => {
  const res = await request(app).get("/knowledge/config").set(auth());
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.allowedExtensions, [".pdf", ".txt", ".md", ".csv", ".docx"]);
  assert.equal(typeof res.body.maxFileMb, "number");
  assert.equal(typeof res.body.maxSources, "number");
  assert.equal(typeof res.body.maxChunks, "number");
});

test("unauthenticated requests are 401", async () => {
  assert.equal((await request(app).get("/knowledge")).status, 401);
});

// ─── Migration 005 ───────────────────────────────────────────────────────────

test("migration 005 backfills progress and fails stuck sources, idempotently", async () => {
  const { up } = await import("../src/migrations/005-backfill-knowledge");
  const col = models.KnowledgeSource.collection;
  const base = { userId: new mongoose.Types.ObjectId(userId), type: "pdf", fileSize: 1, mimeType: "application/pdf", metadata: {} };
  const old = new Date(Date.now() - 60 * 60_000);
  const { insertedIds } = await col.insertMany([
    { ...base, name: "a", fileHash: "a", status: "indexed", chunkCount: 7, createdAt: old, updatedAt: old },
    { ...base, name: "b", fileHash: "b", status: "indexing", chunkCount: 0, createdAt: old, updatedAt: old },
    { ...base, name: "c", fileHash: "c", status: "pending", chunkCount: 0, createdAt: new Date(), updatedAt: new Date() },
  ]);
  const quiet = { log: () => undefined };
  await up(quiet);
  const a: any = await col.findOne({ _id: insertedIds[0] });
  assert.equal(a.chunksTotal, 7);
  assert.equal(a.chunksDone, 7);
  assert.equal(a.attempts, 1);
  assert.equal(a.canRetry, false);
  assert.equal(a.updatedAt.getTime(), old.getTime(), "backfill does not touch updatedAt");
  const b: any = await col.findOne({ _id: insertedIds[1] });
  assert.equal(b.status, "error");
  assert.equal(b.canRetry, false);
  assert.ok(b.metadata.errorMessage);
  const c: any = await col.findOne({ _id: insertedIds[2] });
  assert.equal(c.status, "pending", "recent pending is left alone");

  const snapshot = await col.find({}).sort({ _id: 1 }).toArray();
  await up(quiet);
  assert.deepEqual(await col.find({}).sort({ _id: 1 }).toArray(), snapshot);
});
