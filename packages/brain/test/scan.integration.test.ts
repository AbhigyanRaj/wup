/**
 * Schema scan behaviour against a real mongod: lost-update protection for
 * redactions, view sampling, stuck-scan recovery, and the shared sample bridge.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Connection } from "@wup/models";
import { cryptoService } from "../src/utils/crypto";
import { SCAN_INTERRUPTED_MESSAGE, recoverStuckScans, scanConnection } from "../src/bridges/mongo/scan";
import { releasePooledClient, systemPoolKey } from "../src/bridges/mongo/clientPool";
import { MONGO_TOOLS } from "../src/bridges/mongo/tools";
import { SAMPLE_BRIDGE_NAME, createSampleBridge, getSampleSchemaCache, resetSampleSchemaCache } from "../src/bridges/sample";

let server: MongoMemoryServer;
let customer: MongoClient;
let uri: string;
const owner = new ObjectId().toHexString();
const created: string[] = [];

before(async () => {
  delete process.env.GEMINI_API_KEY;
  process.env.BRIDGE_ALLOW_PRIVATE_HOSTS = "true";
  server = await MongoMemoryServer.create();
  uri = server.getUri();
  customer = await new MongoClient(uri).connect();
  const app = customer.db("app");
  await app.collection("users").insertMany([
    { name: "Ada", email: "ada@x.io", password: "hash1", apiKey: "k1", loginCount: 3 },
    { name: "Bob", email: "bob@x.io", password: "hash2", apiKey: "k2", loginCount: 5 },
  ]);
  await app.collection("orders").insertMany([{ total: 10, cardNumber: "4111" }, { total: 20, cardNumber: "4222" }]);
  await app.createCollection("empty");
  await app.createCollection("users_view", { viewOn: "users", pipeline: [{ $project: { name: 1, password: 1 } }] });

  await mongoose.connect(uri, { dbName: "wup_app_scan" });
});

after(async () => {
  for (const id of created) releasePooledClient(id);
  releasePooledClient(systemPoolKey(uri));
  delete process.env.BRIDGE_ALLOW_PRIVATE_HOSTS;
  delete process.env.SAMPLE_MONGODB_URI;
  delete process.env.SAMPLE_MONGODB_SCOPE;
  await mongoose.disconnect();
  await customer?.close();
  await server?.stop();
});

async function makeBridge(name: string, extra: Record<string, unknown> = {}) {
  const conn: any = await Connection.create({
    userId: owner,
    name,
    type: "mongodb",
    config: cryptoService.encrypt(uri),
    scope: [{ db: "app", collections: ["*"] }],
    ...extra,
  });
  created.push(String(conn._id));
  return conn;
}

describe("scan: redaction writes", () => {
  test("a user edit made mid-scan survives (optimistic concurrency, user keys win)", async () => {
    const conn = await makeBridge("Lost update");
    let digestSeen = "";
    await scanConnection(String(conn._id), {
      suggest: async (digest) => {
        digestSeen = digest;
        // The user saves their own choice for app.users while the scan is running
        await Connection.updateOne(
          { _id: conn._id },
          { $set: { redactedFields: { "app.users": ["email"] } }, $inc: { redactionsVersion: 1 } }
        );
        return ["How many orders were placed?", "  ", 42 as any];
      },
    });
    const after: any = await Connection.findById(conn._id).lean();
    assert.equal(after.metadata.status, "active", after.metadata.lastError);
    assert.deepEqual(after.redactedFields["app.users"], ["email"], "user edit kept");
    assert.deepEqual(after.redactedFields["app.orders"], ["cardNumber"], "new collection auto-filled");
    assert.equal(after.redactionsVersion, 2, "user edit + scan each bump the version");
    assert.deepEqual(after.suggestions, ["How many orders were placed?"]);
    // The digest handed to the LLM never names the auto-hidden fields
    assert.doesNotMatch(digestSeen, /password|apiKey|cardNumber/);
    assert.match(digestSeen, /app\.orders/);
  });

  test("only sampled collections get auto redactions (no [] for empty collections)", async () => {
    const conn = await makeBridge("Empty collections");
    await scanConnection(String(conn._id));
    const after: any = await Connection.findById(conn._id).lean();
    assert.equal(Object.prototype.hasOwnProperty.call(after.redactedFields, "app.empty"), false);
    assert.deepEqual(after.redactedFields["app.users"].sort(), ["apiKey", "password"]);
    const users = after.schemaCache.dbs[0].collections.find((c: any) => c.name === "users");
    for (const f of users.fields) {
      if (f.path === "password" || f.path === "apiKey") assert.equal(f.sample, undefined);
    }
    assert.ok(after.suggestions.length > 0, "template suggestions without a callback or Gemini key");
  });

  test("a suggest callback that throws falls back to templates", async () => {
    const conn = await makeBridge("Suggest throws");
    await scanConnection(String(conn._id), { suggest: async () => Promise.reject(new Error("llm down")) });
    const after: any = await Connection.findById(conn._id).lean();
    assert.equal(after.metadata.status, "active");
    assert.ok(after.suggestions.some((s: string) => /^How many /.test(s)));
  });

  test("never throws, even for a missing connection", async () => {
    await assert.doesNotReject(scanConnection(new ObjectId().toHexString()));
    await assert.doesNotReject(scanConnection("not-an-id"));
  });
});

describe("scan: views", () => {
  test("views are sampled, counted and auto-hidden", async () => {
    const conn = await makeBridge("Views");
    await scanConnection(String(conn._id));
    const after: any = await Connection.findById(conn._id).lean();
    const view = after.schemaCache.dbs[0].collections.find((c: any) => c.name === "users_view");
    assert.ok(view, "view listed");
    assert.equal(view.count, 2);
    assert.deepEqual(view.fields.map((f: any) => f.path).sort(), ["_id", "name", "password"]);
    assert.deepEqual(after.redactedFields["app.users_view"], ["password"]);

    const res = await MONGO_TOOLS.mongo_find({ connectionId: String(conn._id), db: "app", collection: "users_view" }, { userId: owner });
    assert.equal(res.success, true, res.error);
    assert.doesNotMatch(JSON.stringify(res), /hash1|hash2/);
  });
});

describe("recoverStuckScans", () => {
  test("marks scans older than 15 minutes as interrupted, leaves recent ones", async () => {
    const old = await makeBridge("Stuck old");
    const recent = await makeBridge("Stuck recent");
    const legacy = await makeBridge("Stuck legacy", { createdAt: new Date(Date.now() - 60 * 60 * 1000) });
    const now = Date.now();
    await Connection.collection.updateOne(
      { _id: old._id },
      { $set: { "metadata.status": "scanning", "metadata.scanStartedAt": new Date(now - 20 * 60 * 1000) } }
    );
    await Connection.collection.updateOne(
      { _id: recent._id },
      { $set: { "metadata.status": "scanning", "metadata.scanStartedAt": new Date(now - 60 * 1000) } }
    );
    await Connection.collection.updateOne({ _id: legacy._id }, { $set: { "metadata.status": "scanning" } });

    const recovered = await recoverStuckScans();
    assert.equal(recovered, 2);
    const [o, r, l]: any[] = await Promise.all([old, recent, legacy].map((c) => Connection.findById(c._id).lean()));
    assert.equal(o.metadata.status, "error");
    assert.equal(o.metadata.lastError, SCAN_INTERRUPTED_MESSAGE);
    assert.equal(r.metadata.status, "scanning");
    assert.equal(l.metadata.status, "error");
  });
});

describe("sample bridge", () => {
  test("returns null when SAMPLE_MONGODB_URI is unset", async () => {
    delete process.env.SAMPLE_MONGODB_URI;
    resetSampleSchemaCache();
    assert.equal(await getSampleSchemaCache(), null);
    assert.equal(await createSampleBridge(owner), null);
  });

  test("scans once, copies the schema into a system bridge, and its queries work", async () => {
    process.env.SAMPLE_MONGODB_URI = uri;
    process.env.SAMPLE_MONGODB_SCOPE = JSON.stringify([{ db: "app", collections: ["users", "orders"] }]);
    resetSampleSchemaCache();

    const first = await getSampleSchemaCache();
    const second = await getSampleSchemaCache();
    assert.ok(first);
    assert.equal(first, second, "cached per process");

    const userA = new ObjectId().toHexString();
    const conn: any = await createSampleBridge(userA);
    assert.ok(conn);
    assert.equal(conn.isSystem, true);
    assert.equal(conn.name, SAMPLE_BRIDGE_NAME);
    assert.equal(conn.metadata.status, "active");
    assert.deepEqual(conn.scope.map((s: any) => s.db), ["app"]);
    assert.deepEqual([...conn.redactedFields["app.users"]].sort(), ["apiKey", "password"]);
    assert.equal(cryptoService.decrypt(conn.config), uri);
    assert.ok(conn.schemaCache.dbs[0].collections.length === 2);

    // Scans are never run per user
    await scanConnection(String(conn._id));
    const afterScan: any = await Connection.findById(conn._id).lean();
    assert.equal(afterScan.redactionsVersion, 0);

    const res = await MONGO_TOOLS.mongo_find({ connectionId: String(conn._id), db: "app", collection: "users" }, { userId: userA });
    assert.equal(res.success, true, res.error);
    assert.equal(res.rows.length, 2);
    assert.doesNotMatch(JSON.stringify(res), /hash1|k1/);
  });
});
