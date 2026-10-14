import "./support/env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { releasePooledClient, setSheetsClientFactory, systemPoolKey, type SheetsApi } from "@wup/brain";
import migration006 from "../src/migrations/006-clean-redactions";
import { bearer, buildApp, clearDb, models, mongoose, request, signup, startDb, stopDb } from "./support/usersHarness";

const { Connection } = models as any;
const app = buildApp();
const silent = { log: { info() {}, warn() {}, error() {} } };

let customerUri: string;
let customer: MongoClient;
let sheetsStatus: number | undefined;

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit";

const fakeSheets: SheetsApi = {
  spreadsheets: {
    async get() {
      if (sheetsStatus) throw Object.assign(new Error("denied"), { response: { status: sheetsStatus } });
      return { data: { properties: { title: "Budget" }, sheets: [{ properties: { title: "2026", gridProperties: { rowCount: 10, columnCount: 3 } } }] } };
    },
    values: {
      async get() {
        return { data: { values: [] } };
      },
      async batchGet() {
        return { data: { valueRanges: [{ values: [["Month", "Spend", "Owner"]] }] } };
      },
    },
  },
};

async function waitForStatus(id: string, token: string) {
  for (let i = 0; i < 50; i++) {
    const res = await request(app).get(`/connections/${id}`).set(bearer(token));
    if (res.body.status !== "scanning") return res;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("scan did not finish");
}

before(async () => {
  await startDb();
  process.env.BRIDGE_ALLOW_PRIVATE_HOSTS = "true"; // the in-memory mongod is on 127.0.0.1
  // Customer data lives in its own database on the same in-memory server
  const host = mongoose.connection.host;
  const port = mongoose.connection.port;
  customerUri = `mongodb://${host}:${port}/`;
  customer = await new MongoClient(customerUri).connect();
  await customer.db("shop").collection("users").insertMany([
    { name: "Ada", password: "hash1", apiKey: "k1" },
    { name: "Bob", password: "hash2", apiKey: "k2" },
  ]);
  await customer.db("shop").createCollection("users_view", { viewOn: "users", pipeline: [] });
  setSheetsClientFactory(() => fakeSheets);
});

after(async () => {
  setSheetsClientFactory(null);
  releasePooledClient(systemPoolKey(customerUri));
  delete process.env.BRIDGE_ALLOW_PRIVATE_HOSTS;
  delete process.env.SAMPLE_MONGODB_URI;
  await customer?.close();
  await stopDb();
});

beforeEach(async () => {
  sheetsStatus = undefined;
  await clearDb();
});

describe("POST /connections/test", () => {
  test("PostgreSQL and Supabase are coming soon", async () => {
    const u = await signup(app);
    for (const type of ["postgresql", "supabase"]) {
      const res = await request(app).post("/connections/test").set(bearer(u.token)).send({ type, config: "postgres://x" });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "PostgreSQL and Supabase are coming soon");
    }
  });

  test("MongoDB: databases (with name and db), views and sensitive fields", async () => {
    const u = await signup(app);
    const res = await request(app).post("/connections/test").set(bearer(u.token)).send({ type: "mongodb", config: customerUri });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.ok, true);
    assert.equal(res.body.type, "mongodb");
    const shop = res.body.databases.find((d: any) => d.name === "shop");
    assert.equal(shop.db, "shop");
    assert.ok(shop.collections.some((c: any) => c.name === "users_view" && c.type === "view" && c.count === null));
    assert.deepEqual(res.body.sensitive["shop.users"].sort(), ["apiKey", "password"]);
  });

  test("Sheets: title and tabs; a 403 is SHEETS_NOT_SHARED", async () => {
    const u = await signup(app);
    const ok = await request(app).post("/connections/test").set(bearer(u.token)).send({ type: "sheets", config: SHEET_URL });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.type, "sheets");
    assert.equal(ok.body.title, "Budget");
    assert.deepEqual(ok.body.tabs, [{ name: "2026", rows: 10, cols: 3, headers: ["Month", "Spend", "Owner"] }]);

    sheetsStatus = 403;
    const denied = await request(app).post("/connections/test").set(bearer(u.token)).send({ type: "sheets", config: SHEET_URL });
    assert.equal(denied.status, 400);
    assert.equal(denied.body.code, "SHEETS_NOT_SHARED");
    assert.match(denied.body.error, /^Share the sheet/);
  });
});

describe("connection lifecycle", () => {
  test("create MongoDB, scan, details, PATCH bumps redactionsVersion, delete", async () => {
    const u = await signup(app);
    const created = await request(app)
      .post("/connections")
      .set(bearer(u.token))
      .send({ name: "Shop", type: "mongodb", config: customerUri, scope: [{ db: "shop", collections: ["*"] }] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id;
    assert.equal(created.body.connection.id, id);
    assert.equal(String(created.body.connection._id), id);
    assert.equal(created.body.connection.isSystem, false);
    assert.equal(created.body.connection.sheets, null);
    assert.equal(created.body.connection.status, "scanning");

    const details = await waitForStatus(id, u.token);
    assert.equal(details.body.status, "active", details.body.lastError);
    const shop = details.body.schema.find((d: any) => d.db === "shop");
    assert.equal(shop.name, "shop");
    const view = shop.collections.find((c: any) => c.name === "users_view");
    assert.equal(view.count, 2);
    assert.deepEqual(details.body.redactedFields["shop.users_view"].sort(), ["apiKey", "password"]);
    assert.deepEqual(details.body.stats, { databases: 1, collections: 2 });

    const before = (await Connection.findById(id).lean()).redactionsVersion;
    const patched = await request(app)
      .patch(`/connections/${id}`)
      .set(bearer(u.token))
      .send({ redactedFields: { "shop.users": ["password"] } });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.deepEqual(patched.body.redactedFields, { "shop.users": ["password"] });
    assert.equal((await Connection.findById(id).lean()).redactionsVersion, before + 1);

    const list = await request(app).get("/connections").set(bearer(u.token));
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].id, id);
    assert.equal("config" in list.body[0], false);

    const del = await request(app).delete(`/connections/${id}`).set(bearer(u.token));
    assert.equal(del.status, 200);
    releasePooledClient(id);
  });

  test("create Sheets saves sheetsCache and is active; refresh refetches", async () => {
    const u = await signup(app);
    const created = await request(app)
      .post("/connections")
      .set(bearer(u.token))
      .send({ name: "Budget", type: "sheets", config: SHEET_URL });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.connection.status, "active");
    assert.deepEqual(created.body.connection.sheets, {
      title: "Budget",
      tabs: [{ name: "2026", rows: 10, cols: 3, headers: ["Month", "Spend", "Owner"] }],
    });

    // A scope change on a Sheets bridge never starts a scan
    const patched = await request(app)
      .patch(`/connections/${created.body.id}`)
      .set(bearer(u.token))
      .send({ scope: [{ db: "x", collections: ["*"] }] });
    assert.equal(patched.body.status, "active");

    const refreshed = await request(app).post(`/connections/${created.body.id}/refresh`).set(bearer(u.token));
    assert.equal(refreshed.status, 202);
    const after = await waitForStatus(created.body.id, u.token);
    assert.equal(after.body.status, "active");
  });

  test("Sheets that aren't shared are not saved", async () => {
    const u = await signup(app);
    sheetsStatus = 403;
    const res = await request(app).post("/connections").set(bearer(u.token)).send({ name: "Nope", type: "sheets", config: SHEET_URL });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "SHEETS_NOT_SHARED");
    assert.equal(await Connection.countDocuments({}), 0);
  });

  test("invalid ids are 400 and other users' bridges are 404", async () => {
    const a = await signup(app);
    const b = await signup(app);
    const created = await request(app).post("/connections").set(bearer(a.token)).send({ name: "Budget", type: "sheets", config: SHEET_URL });
    assert.equal((await request(app).get("/connections/not-an-id").set(bearer(a.token))).status, 400);
    assert.equal((await request(app).get(`/connections/${created.body.id}`).set(bearer(b.token))).status, 404);
  });
});

describe("service account and sample bridge", () => {
  test("GET /connections/sheets/service-account", async () => {
    const u = await signup(app);
    const res = await request(app).get("/connections/sheets/service-account").set(bearer(u.token));
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ["email", "enabled"]);
  });

  test("POST /connections/sample: 404 unset, 201, 409, read-only, deletable", async () => {
    const u = await signup(app);
    delete process.env.SAMPLE_MONGODB_URI;
    assert.equal((await request(app).post("/connections/sample").set(bearer(u.token))).status, 404);

    process.env.SAMPLE_MONGODB_URI = customerUri;
    process.env.SAMPLE_MONGODB_SCOPE = JSON.stringify([{ db: "shop", collections: ["users"] }]);
    const created = await request(app).post("/connections/sample").set(bearer(u.token));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const conn = created.body.connection;
    assert.equal(conn.isSystem, true);
    assert.equal(conn.status, "active");
    assert.equal(conn.name, "Sample data (read-only)");
    assert.deepEqual(conn.redactedFields["shop.users"].sort(), ["apiKey", "password"]);

    assert.equal((await request(app).post("/connections/sample").set(bearer(u.token))).status, 409);

    const scope = await request(app).patch(`/connections/${conn.id}`).set(bearer(u.token)).send({ scope: [{ db: "shop", collections: ["*"] }] });
    assert.equal(scope.status, 403);
    const redact = await request(app).patch(`/connections/${conn.id}`).set(bearer(u.token)).send({ redactedFields: {} });
    assert.equal(redact.status, 403);
    const rename = await request(app).patch(`/connections/${conn.id}`).set(bearer(u.token)).send({ name: "Movies demo" });
    assert.equal(rename.status, 200);
    assert.equal(rename.body.name, "Movies demo");
    assert.equal((await request(app).post(`/connections/${conn.id}/refresh`).set(bearer(u.token))).status, 403);
    assert.equal((await request(app).delete(`/connections/${conn.id}`).set(bearer(u.token))).status, 200);
    delete process.env.SAMPLE_MONGODB_SCOPE;
  });
});

describe("migration 006-clean-redactions", () => {
  test("drops [] for collections without cached fields, sets redactionsVersion, idempotent", async () => {
    const db = mongoose.connection.db!;
    const userId = new mongoose.Types.ObjectId();
    const schemaCache = {
      dbs: [
        {
          name: "shop",
          collections: [
            { name: "users", count: 2, fields: [{ path: "name", types: ["string"] }] },
            { name: "a_view", count: 0, fields: [] },
          ],
        },
      ],
    };
    const { insertedId: legacy } = await db.collection("connections").insertOne({
      userId,
      name: "legacy",
      type: "mongodb",
      config: "x",
      schemaCache,
      redactedFields: { "shop.users": [], "shop.a_view": [], "shop.unscanned": [], "shop.orders": ["cardNumber"] },
    });
    const { insertedId: versioned } = await db.collection("connections").insertOne({
      userId,
      name: "versioned",
      type: "mongodb",
      config: "x",
      schemaCache,
      redactedFields: { "shop.users": ["password"] },
      redactionsVersion: 4,
    });

    await migration006.up({ db, connection: mongoose.connection, log: silent.log } as any);
    const a: any = await db.collection("connections").findOne({ _id: legacy });
    assert.deepEqual(a.redactedFields, { "shop.users": [], "shop.orders": ["cardNumber"] });
    assert.equal(a.redactionsVersion, 0);
    const b: any = await db.collection("connections").findOne({ _id: versioned });
    assert.equal(b.redactionsVersion, 4, "untouched");

    await migration006.up({ db, connection: mongoose.connection, log: silent.log } as any);
    const again: any = await db.collection("connections").findOne({ _id: legacy });
    assert.deepEqual(again, a);
  });
});
