/**
 * End-to-end tests for the MongoDB bridge tools against a real mongod
 * (mongodb-memory-server). Covers ownership, scope, privacy, read-only
 * enforcement, limits, Extended JSON and the background schema scan.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Connection } from "@wup/models";
import { cryptoService } from "../src/utils/crypto";
import { MONGO_TOOLS, MAX_LIMIT } from "../src/bridges/mongo/tools";
import { scanConnection } from "../src/bridges/mongo/scan";
import { releasePooledClient } from "../src/bridges/mongo/clientPool";
import type { QueryRecord, ToolContext } from "../src/tools/types";

let server: MongoMemoryServer;
let customer: MongoClient;
const owner = new ObjectId().toHexString();
const stranger = new ObjectId().toHexString();
let connId: string;
let scopedConnId: string;

const GENRES = ["Drama", "Comedy", "Action"];

before(async () => {
  delete process.env.GEMINI_API_KEY; // suggestions use templates, no network
  server = await MongoMemoryServer.create();
  const uri = server.getUri();

  // The "customer" data WUUP connects to, with no db name in the URI (the original bug)
  customer = await new MongoClient(uri).connect();
  const mflix = customer.db("mflix");
  await mflix.collection("movies").insertMany(
    Array.from({ length: 150 }, (_, i) => ({
      title: `Movie ${i}`,
      year: 1990 + (i % 30),
      genres: [GENRES[i % 3]],
      imdb: { rating: 5 + (i % 5) },
      released: new Date(Date.UTC(1990 + (i % 30), 0, 1)),
    }))
  );
  await mflix.collection("users").insertMany([
    { _id: new ObjectId("65a000000000000000000001"), name: "Ada", email: "ada@x.io", password: "hash1" },
    { name: "Bob", email: "bob@x.io", password: "hash2" },
  ]);
  await mflix.collection("sessions").insertOne({ user_id: "65a000000000000000000001", jwt: "eyJ..." });
  await customer.db("hr").collection("salaries").insertOne({ name: "Ada", amount: 100 });

  // WUUP's own app database
  await mongoose.connect(uri, { dbName: "wup_app" });
  const conn: any = await Connection.create({
    userId: owner,
    name: "Test Cluster",
    type: "mongodb",
    config: cryptoService.encrypt(uri),
    scope: [{ db: "mflix", collections: ["*"] }],
    redactedFields: { "mflix.users": ["password"], "mflix.sessions": ["jwt"] },
  });
  connId = String(conn._id);

  const scoped: any = await Connection.create({
    userId: owner,
    name: "Movies only",
    type: "mongodb",
    config: cryptoService.encrypt(uri),
    scope: [{ db: "mflix", collections: ["movies"] }],
  });
  scopedConnId = String(scoped._id);
});

after(async () => {
  releasePooledClient(connId);
  releasePooledClient(scopedConnId);
  await mongoose.disconnect();
  await customer?.close();
  await server?.stop();
});

function ctx(overrides: Partial<ToolContext> = {}) {
  const queries: QueryRecord[] = [];
  const rows: any[][] = [];
  const c: ToolContext = {
    userId: owner,
    onQuery: (q, r) => {
      queries.push(q);
      if (r) rows.push(r);
    },
    ...overrides,
  };
  return { c, queries, rows };
}

describe("reading data", () => {
  test("finds data in named databases even when the URI has no db name", async () => {
    const { c } = ctx();
    const res = await MONGO_TOOLS.mongo_list_sources({ connectionId: connId }, c);
    assert.equal(res.success, true);
    assert.deepEqual(
      res.databases.map((d: any) => d.db),
      ["mflix"]
    );
    const movies = res.databases[0].collections.find((x: any) => x.name === "movies");
    assert.equal(movies.count, 150);
  });

  test("mongo_count with and without a filter", async () => {
    const { c, queries } = ctx();
    const all = await MONGO_TOOLS.mongo_count({ connectionId: connId, db: "mflix", collection: "movies" }, c);
    assert.equal(all.count, 150);
    const recent = await MONGO_TOOLS.mongo_count(
      { connectionId: connId, db: "mflix", collection: "movies", filter: '{"year":{"$gte":2010}}' },
      c
    );
    assert.equal(recent.count, 50);
    assert.equal(queries.length, 2);
    assert.equal(queries[1].connectionName, "Test Cluster");
    assert.match(queries[1].query, /"\$gte": 2010/);
  });

  test("mongo_find applies projection, sort and limit", async () => {
    const { c, rows } = ctx();
    const res = await MONGO_TOOLS.mongo_find(
      {
        connectionId: connId,
        db: "mflix",
        collection: "movies",
        filter: '{"genres":"Drama"}',
        projection: '{"title":1,"year":1,"_id":0}',
        sort: '{"year":-1,"title":1}',
        limit: 3,
      },
      c
    );
    assert.equal(res.success, true);
    assert.equal(res.rows.length, 3);
    assert.deepEqual(Object.keys(res.rows[0]).sort(), ["title", "year"]);
    assert.ok(res.rows[0].year >= res.rows[2].year);
    assert.equal(rows[0].length, 3);
  });

  test("limits are clamped to the maximum", async () => {
    const { c } = ctx();
    const res = await MONGO_TOOLS.mongo_find(
      { connectionId: connId, db: "mflix", collection: "movies", limit: 5000 },
      c
    );
    assert.equal(res.rows.length, MAX_LIMIT);
    assert.equal(res.limit, MAX_LIMIT);
  });

  test("mongo_aggregate groups and sorts", async () => {
    const { c, rows } = ctx();
    const res = await MONGO_TOOLS.mongo_aggregate(
      {
        connectionId: connId,
        db: "mflix",
        collection: "movies",
        pipeline: JSON.stringify([
          { $unwind: "$genres" },
          { $group: { _id: "$genres", count: { $sum: 1 }, avgRating: { $avg: "$imdb.rating" } } },
          { $sort: { _id: 1 } },
        ]),
      },
      c
    );
    assert.equal(res.success, true, res.error);
    assert.deepEqual(
      res.rows.map((r: any) => [r._id, r.count]),
      [["Action", 50], ["Comedy", 50], ["Drama", 50]]
    );
    assert.equal(rows[0].length, 3);
  });

  test("mongo_distinct returns values", async () => {
    const { c } = ctx();
    const res = await MONGO_TOOLS.mongo_distinct({ connectionId: connId, db: "mflix", collection: "movies", field: "genres" }, c);
    assert.deepEqual([...res.values].sort(), GENRES.slice().sort());
  });

  test("Extended JSON filters match ObjectIds and dates", async () => {
    const { c } = ctx();
    const byId = await MONGO_TOOLS.mongo_find(
      { connectionId: connId, db: "mflix", collection: "users", filter: '{"_id":{"$oid":"65a000000000000000000001"}}' },
      c
    );
    assert.equal(byId.rows.length, 1);
    assert.equal(byId.rows[0].name, "Ada");
    assert.equal(byId.rows[0]._id, "65a000000000000000000001");

    const byDate = await MONGO_TOOLS.mongo_count(
      { connectionId: connId, db: "mflix", collection: "movies", filter: '{"released":{"$gte":{"$date":"2015-01-01T00:00:00Z"}}}' },
      c
    );
    assert.equal(byDate.count, 25);
  });

  test("mongo_describe returns redacted samples", async () => {
    const { c, queries } = ctx();
    const res = await MONGO_TOOLS.mongo_describe({ connectionId: connId, db: "mflix", collection: "users" }, c);
    assert.equal(res.success, true);
    assert.deepEqual(res.hiddenFields, ["password"]);
    for (const doc of res.sampleDocuments) assert.equal("password" in doc, false);
    assert.equal(queries[0].tool, "mongo_describe");
  });
});

describe("security", () => {
  test("another user cannot use someone else's connectionId", async () => {
    const { c } = ctx({ userId: stranger });
    const res = await MONGO_TOOLS.mongo_count({ connectionId: connId, db: "mflix", collection: "movies" }, c);
    assert.deepEqual(res, { success: false, error: "Connection not found." });
  });

  test("bridges not enabled for the chat are refused", async () => {
    const { c } = ctx({ allowedConnectionIds: [scopedConnId] });
    const res = await MONGO_TOOLS.mongo_count({ connectionId: connId, db: "mflix", collection: "movies" }, c);
    assert.match(res.error, /isn't enabled for this chat/);
  });

  test("invalid connectionIds are rejected cleanly", async () => {
    const { c } = ctx();
    const res = await MONGO_TOOLS.mongo_count({ connectionId: "not-an-id", db: "mflix", collection: "movies" }, c);
    assert.match(res.error, /Unknown connectionId/);
  });

  test("databases and collections outside the scope are refused", async () => {
    const { c } = ctx();
    const hr = await MONGO_TOOLS.mongo_find({ connectionId: connId, db: "hr", collection: "salaries" }, c);
    assert.match(hr.error, /not enabled for this bridge/);
    const users = await MONGO_TOOLS.mongo_find({ connectionId: scopedConnId, db: "mflix", collection: "users" }, c);
    assert.match(users.error, /not enabled for this bridge/);
    const admin = await MONGO_TOOLS.mongo_find({ connectionId: connId, db: "admin", collection: "system.users" }, c);
    assert.equal(admin.success, false);
  });

  test("hidden fields never appear in results", async () => {
    const { c } = ctx();
    const res = await MONGO_TOOLS.mongo_find({ connectionId: connId, db: "mflix", collection: "users" }, c);
    assert.equal(res.rows.length, 2);
    for (const row of res.rows) {
      assert.equal("password" in row, false);
      assert.ok(row.email);
    }
    assert.deepEqual(res.hiddenFields, ["password"]);
  });

  test("hidden fields can't be filtered on, projected, renamed, or pulled in via $lookup", async () => {
    const { c } = ctx();
    const filtered = await MONGO_TOOLS.mongo_count(
      { connectionId: connId, db: "mflix", collection: "users", filter: '{"password":{"$regex":"^hash"}}' },
      c
    );
    assert.match(filtered.error, /hidden/);

    const renamed = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "mflix", collection: "users", pipeline: '[{"$project":{"p":"$password"}}]' },
      c
    );
    assert.match(renamed.error, /hidden/);

    const distinct = await MONGO_TOOLS.mongo_distinct({ connectionId: connId, db: "mflix", collection: "sessions", field: "jwt" }, c);
    assert.match(distinct.error, /hidden/);

    const lookup = await MONGO_TOOLS.mongo_aggregate(
      {
        connectionId: connId,
        db: "mflix",
        collection: "sessions",
        pipeline: JSON.stringify([
          { $lookup: { from: "users", pipeline: [], as: "u" } },
          { $project: { jwt: 0 } },
        ]),
      },
      c
    );
    // Either rejected (jwt referenced) or stripped; the hidden values must never come back
    const text = JSON.stringify(lookup);
    assert.doesNotMatch(text, /hash1|hash2|eyJ/);
  });

  test("write stages are blocked and nothing is written", async () => {
    const { c, queries } = ctx();
    const res = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "mflix", collection: "movies", pipeline: '[{"$match":{}},{"$out":"stolen"}]' },
      c
    );
    assert.match(res.error, /read-only/);
    const names = (await customer.db("mflix").listCollections().toArray()).map((x) => x.name);
    assert.equal(names.includes("stolen"), false);
    assert.equal(queries[0].error, res.error);
  });

  test("malformed JSON arguments come back as tool errors, not crashes", async () => {
    const { c } = ctx();
    const res = await MONGO_TOOLS.mongo_find({ connectionId: connId, db: "mflix", collection: "movies", filter: "{year:" }, c);
    assert.equal(res.success, false);
    assert.match(res.error, /Could not parse JSON/);
  });
});

describe("schema scan", () => {
  test("stores schema, auto-hides new sensitive fields, keeps user edits, and writes suggestions", async () => {
    // Clear the "users" redaction to prove auto-detection, keep sessions as a user edit (empty list)
    await Connection.updateOne({ _id: connId }, { $set: { redactedFields: { "mflix.sessions": [] } } });
    await scanConnection(connId);
    const conn: any = await Connection.findById(connId).lean();

    assert.equal(conn.metadata.status, "active");
    assert.equal(conn.schemaCache.dbs.length, 1);
    const movies = conn.schemaCache.dbs[0].collections.find((c: any) => c.name === "movies");
    assert.equal(movies.count, 150);
    assert.ok(movies.fields.some((f: any) => f.path === "imdb.rating" && f.types.includes("number")));
    assert.ok(movies.indexes.includes("_id"));

    assert.deepEqual(conn.redactedFields["mflix.users"], ["password"]);
    assert.deepEqual(conn.redactedFields["mflix.sessions"], []); // user choice preserved
    const pw = conn.schemaCache.dbs[0].collections.find((c: any) => c.name === "users").fields.find((f: any) => f.path === "password");
    assert.equal(pw.sample, undefined); // never cache hidden values

    assert.ok(conn.suggestions.length > 0);
    assert.equal(conn.suggestions[0], "How many movies are there?");

    // Restore for other tests
    await Connection.updateOne(
      { _id: connId },
      { $set: { redactedFields: { "mflix.users": ["password"], "mflix.sessions": ["jwt"] } } }
    );
  });

  test("a bad URI marks the bridge as errored with a readable message", async () => {
    const bad: any = await Connection.create({
      userId: owner,
      name: "Broken",
      type: "mongodb",
      config: cryptoService.encrypt("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500"),
    });
    await scanConnection(String(bad._id));
    const after: any = await Connection.findById(bad._id).lean();
    assert.equal(after.metadata.status, "error");
    assert.match(after.metadata.lastError, /Couldn't reach the cluster/);
    releasePooledClient(String(bad._id));
  });
});
