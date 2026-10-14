/**
 * Integration tests for the hotfix hardening of the MongoDB tools and the
 * Sheets tool against a real mongod (mongodb-memory-server).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Connection } from "@wup/models";
import { cryptoService } from "../src/utils/crypto";
import { MONGO_TOOLS, DEFAULT_LIMIT, MAX_LIMIT, clampLimit, parseFilterArg } from "../src/bridges/mongo/tools";
import { releasePooledClient } from "../src/bridges/mongo/clientPool";
import { GuardError } from "../src/bridges/mongo/guard";
import { read_sheets, get_sheets_metadata, safeSheetsErrorMessage } from "../src/tools/sheets";
import type { ToolContext } from "../src/tools/types";

let server: MongoMemoryServer;
let customer: MongoClient;
let uri: string;
const owner = new ObjectId().toHexString();
let connId: string;

before(async () => {
  delete process.env.GEMINI_API_KEY;
  server = await MongoMemoryServer.create();
  uri = server.getUri();
  customer = await new MongoClient(uri).connect();
  const app = customer.db("app");
  await app.collection("users").insertMany([
    { name: "Ada", password: "hash1", tokens: ["tok-a1", "tok-a2"], profile: { city: "London", password: "nested1" } },
    { name: "Bob", password: "hash2", tokens: ["tok-b1"], profile: { city: "Paris", password: "nested2" } },
  ]);
  await app.collection("items").insertMany(Array.from({ length: 30 }, (_, i) => ({ n: i })));

  await mongoose.connect(uri, { dbName: "wup_app_hardening" });
  const conn: any = await Connection.create({
    userId: owner,
    name: "Hardening",
    type: "mongodb",
    config: cryptoService.encrypt(uri),
    scope: [{ db: "app", collections: ["*"] }],
    redactedFields: { "app.users": ["password", "tokens"] },
  });
  connId = String(conn._id);
});

after(async () => {
  releasePooledClient(connId);
  await mongoose.disconnect();
  await customer?.close();
  await server?.stop();
});

const ctx = (): ToolContext => ({ userId: owner });
const SECRETS = /hash1|hash2|nested1|nested2|tok-a1|tok-a2|tok-b1/;

describe("clampLimit / parseFilterArg", () => {
  test("clampLimit always returns 1..MAX_LIMIT", () => {
    assert.equal(clampLimit(undefined), DEFAULT_LIMIT);
    assert.equal(clampLimit("abc"), DEFAULT_LIMIT);
    assert.equal(clampLimit(0), DEFAULT_LIMIT);
    assert.equal(clampLimit(0.5), DEFAULT_LIMIT);
    assert.equal(clampLimit(-5), 1);
    assert.equal(clampLimit(7.9), 7);
    assert.equal(clampLimit(5000), MAX_LIMIT);
    assert.equal(clampLimit(Infinity), MAX_LIMIT);
  });

  test("parseFilterArg accepts objects and rejects everything else", () => {
    assert.deepEqual(parseFilterArg(undefined), {});
    assert.deepEqual(parseFilterArg('{"a":1}'), { a: 1 });
    for (const bad of ["[]", '[{"a":1}]', '"str"', "5", "true", '{"$oid":"65a000000000000000000001"}']) {
      assert.throws(() => parseFilterArg(bad), (e: any) => e instanceof GuardError && /filter must be a JSON object/.test(e.message), bad);
    }
  });
});

describe("mongo tools hardening", () => {
  test("$$ROOT.<hidden> rename is refused end to end", async () => {
    const res = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "app", collection: "users", pipeline: '[{"$project":{"p":"$$ROOT.password"}}]' },
      ctx()
    );
    assert.equal(res.success, false);
    assert.match(res.error, /hidden/);
    assert.doesNotMatch(JSON.stringify(res), SECRETS);
  });

  test("hidden parent reached via an array index is refused", async () => {
    const res = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "app", collection: "users", pipeline: '[{"$project":{"t":"$tokens.0"}}]' },
      ctx()
    );
    assert.match(res.error, /hidden/);
  });

  test("dynamic-key operators are refused when fields are hidden", async () => {
    const res = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "app", collection: "users", pipeline: '[{"$project":{"kv":{"$objectToArray":"$$ROOT"}}}]' },
      ctx()
    );
    assert.match(res.error, /not allowed/);
    assert.doesNotMatch(JSON.stringify(res), SECRETS);
  });

  test("excluding a hidden field in a projection works", async () => {
    const res = await MONGO_TOOLS.mongo_find(
      { connectionId: connId, db: "app", collection: "users", projection: '{"password":0,"tokens":0}' },
      ctx()
    );
    assert.equal(res.success, true, res.error);
    assert.equal(res.rows.length, 2);
    assert.doesNotMatch(JSON.stringify(res), SECRETS);

    const agg = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "app", collection: "users", pipeline: '[{"$project":{"password":0}}]' },
      ctx()
    );
    assert.equal(agg.success, true, agg.error);
    assert.doesNotMatch(JSON.stringify(agg), SECRETS);
  });

  test("non-object filters are clear tool errors", async () => {
    const res = await MONGO_TOOLS.mongo_find({ connectionId: connId, db: "app", collection: "items", filter: "[1,2]" }, ctx());
    assert.equal(res.success, false);
    assert.match(res.error, /filter must be a JSON object/);
    const count = await MONGO_TOOLS.mongo_count({ connectionId: connId, db: "app", collection: "items", filter: "42" }, ctx());
    assert.match(count.error, /filter must be a JSON object/);
  });

  test("negative / fractional limits never reach the driver as 0 or negative", async () => {
    const res = await MONGO_TOOLS.mongo_find({ connectionId: connId, db: "app", collection: "items", limit: -3 }, ctx());
    assert.equal(res.success, true, res.error);
    assert.equal(res.rows.length, 1);
    const agg = await MONGO_TOOLS.mongo_aggregate(
      { connectionId: connId, db: "app", collection: "items", pipeline: "[]", limit: 0.2 },
      ctx()
    );
    assert.equal(agg.success, true, agg.error);
    assert.equal(agg.rows.length, DEFAULT_LIMIT);
  });

  test("mongo_distinct refuses hidden fields, including via a parent path", async () => {
    for (const field of ["password", "tokens", "tokens.0", "profile.password"]) {
      const res = await MONGO_TOOLS.mongo_distinct({ connectionId: connId, db: "app", collection: "users", field }, ctx());
      assert.equal(res.success, false, field);
      assert.match(res.error, /hidden/, field);
    }
  });

  test("mongo_distinct redacts hidden fields inside returned values", async () => {
    const res = await MONGO_TOOLS.mongo_distinct({ connectionId: connId, db: "app", collection: "users", field: "profile" }, ctx());
    assert.equal(res.success, true, res.error);
    assert.equal(res.values.length, 2);
    for (const v of res.values) assert.equal("password" in v, false);
    assert.deepEqual(res.values.map((v: any) => v.city).sort(), ["London", "Paris"]);
    assert.doesNotMatch(JSON.stringify(res), SECRETS);
  });
});

describe("sheets tool hardening", () => {
  test("a MongoDB connectionId is refused and its URI never leaves", async () => {
    const logs: string[] = [];
    const orig = { log: console.log, error: console.error, warn: console.warn };
    const capture = (...a: any[]) => logs.push(a.map(String).join(" "));
    console.log = capture;
    console.error = capture;
    console.warn = capture;
    try {
      const res: any = await read_sheets({ connectionId: connId }, ctx());
      const meta: any = await get_sheets_metadata({ connectionId: connId }, ctx());
      for (const r of [res, meta]) {
        assert.equal(r.success, false);
        assert.equal(r.error, "Connection not found");
      }
      assert.equal(logs.some((l) => l.includes(uri) || l.includes("mongodb://")), false);
    } finally {
      Object.assign(console, orig);
    }
  });

  test("invalid ids are refused", async () => {
    for (const id of ["not-an-id", "aaaaaaaaaaaa", { $gt: "" } as any]) {
      const res: any = await read_sheets({ connectionId: id }, ctx());
      assert.equal(res.success, false);
      assert.equal(res.error, "Connection not found");
    }
  });

  test("error messages have API keys redacted", () => {
    const msg = safeSheetsErrorMessage(
      new Error("Request failed: https://sheets.googleapis.com/v4/spreadsheets/abc?key=AIzaSECRET123&alt=json")
    );
    assert.doesNotMatch(msg, /AIzaSECRET123/);
    assert.match(msg, /key=\[REDACTED\]/);
    assert.equal(safeSheetsErrorMessage({ config: { url: "x?key=1" } }), "Google Sheets request failed");
  });
});
