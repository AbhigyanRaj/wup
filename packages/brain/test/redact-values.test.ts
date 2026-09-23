import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BSON } from "mongodb";
import { detectSensitiveFields, hiddenLeavesForDb, redactValue } from "../src/bridges/mongo/redact";
import { parseEjsonArg, rowsToTable, toDisplayEjson, toPlain } from "../src/bridges/mongo/values";
import { describeMongoError, isMongoUri, maskUri } from "../src/bridges/mongo/errors";

describe("redaction", () => {
  test("detects sensitive field names and binary blobs", () => {
    const found = detectSensitiveFields([
      { path: "name", types: ["string"] },
      { path: "password", types: ["string"] },
      { path: "auth.jwt", types: ["string"] },
      { path: "apiKey", types: ["string"] },
      { path: "api_key", types: ["string"] },
      { path: "plot_embedding", types: ["binary"] },
      { path: "email", types: ["string"] },
      { path: "year", types: ["number"] },
    ]);
    assert.deepEqual(found, ["password", "auth.jwt", "apiKey", "api_key", "plot_embedding"]);
  });

  test("hidden leaves are scoped to one database", () => {
    const leaves = hiddenLeavesForDb(
      { "shop.users": ["password", "auth.jwt"], "shop.orders": [], "hr.people": ["ssn"] },
      "shop"
    );
    assert.deepEqual([...leaves].sort(), ["jwt", "password"]);
  });

  test("redactValue removes hidden keys at any depth, including inside arrays", () => {
    const out = redactValue(
      { name: "a", password: "x", nested: { password: "y", ok: 1 }, list: [{ password: "z", v: 2 }] },
      new Set(["password"])
    );
    assert.deepEqual(out, { name: "a", nested: { ok: 1 }, list: [{ v: 2 }] });
  });
});

describe("Extended JSON arguments", () => {
  test("parses $oid and $date into BSON types", () => {
    const id = new BSON.ObjectId();
    const f = parseEjsonArg<any>(`{"_id":{"$oid":"${id.toHexString()}"},"at":{"$gte":{"$date":"2024-01-01T00:00:00Z"}}}`, {});
    assert.equal(f._id.toHexString(), id.toHexString());
    assert.ok(f.at.$gte instanceof Date);
    assert.equal(typeof parseEjsonArg<any>('{"n":5}', {}).n, "number");
  });

  test("accepts already-parsed objects and falls back on empty input", () => {
    assert.deepEqual(parseEjsonArg({ a: 1 }, {}), { a: 1 });
    assert.deepEqual(parseEjsonArg("", { x: 1 }), { x: 1 });
    assert.deepEqual(parseEjsonArg(undefined, []), []);
  });

  test("invalid JSON produces a clear error", () => {
    assert.throws(() => parseEjsonArg("{year: 2000", {}), /Could not parse JSON argument/);
  });

  test("display form is readable Extended JSON", () => {
    const text = toDisplayEjson({ find: "movies", filter: { _id: new BSON.ObjectId("65a000000000000000000001") } });
    assert.match(text, /"\$oid": "65a000000000000000000001"/);
  });
});

describe("toPlain", () => {
  test("converts BSON values to JSON-friendly values", () => {
    const out = toPlain({
      _id: new BSON.ObjectId("65a000000000000000000001"),
      at: new Date("2024-05-01T00:00:00Z"),
      price: BSON.Decimal128.fromString("9.99"),
      big: BSON.Long.fromNumber(42),
      blob: new BSON.Binary(Buffer.from("abc")),
    });
    assert.deepEqual(out, {
      _id: "65a000000000000000000001",
      at: "2024-05-01T00:00:00.000Z",
      price: 9.99,
      big: 42,
      blob: "[binary]",
    });
  });

  test("shortens embedding vectors, long arrays and long strings", () => {
    const out = toPlain({
      vec: Array.from({ length: 768 }, () => 0.1),
      tags: Array.from({ length: 60 }, (_, i) => `t${i}`),
      text: "x".repeat(600),
    });
    assert.equal(out.vec, "[vector: 768 dims]");
    assert.equal(out.tags.length, 51);
    assert.equal(out.tags[50], "…10 more");
    assert.equal(out.text.length, 501);
  });
});

describe("rowsToTable", () => {
  test("flattens nested objects one level and joins arrays", () => {
    const t = rowsToTable([{ _id: "1", title: "A", imdb: { rating: 8.1, votes: 10 }, genres: ["Drama", "War"] }]);
    assert.deepEqual(t.columns, ["title", "imdb.rating", "imdb.votes", "genres", "_id"]);
    assert.equal(t.rows[0]["imdb.rating"], 8.1);
    assert.equal(t.rows[0].genres, "Drama, War");
  });

  test("caps columns and rows", () => {
    const wide = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`c${i}`, i]));
    const t = rowsToTable(Array.from({ length: 150 }, () => wide));
    assert.equal(t.columns.length, 12);
    assert.equal(t.rows.length, 100);
  });
});

describe("error messages", () => {
  test("masks passwords in URIs", () => {
    assert.equal(
      maskUri("failed mongodb+srv://bob:s3cret@cluster0.x.mongodb.net/db"),
      "failed mongodb+srv://bob:****@cluster0.x.mongodb.net/db"
    );
  });

  test("maps driver errors to actionable messages", () => {
    assert.match(describeMongoError(new Error("bad auth : authentication failed")), /Authentication failed/);
    assert.match(describeMongoError(new Error("querySrv ENOTFOUND _mongodb._tcp.nope.mongodb.net")), /hostname/);
    assert.match(describeMongoError(new Error("Server selection timed out after 8000 ms")), /Network Access/);
    assert.match(describeMongoError(new Error("operation exceeded time limit")), /10 seconds/);
    assert.equal(isMongoUri("postgres://x"), false);
    assert.equal(isMongoUri(" mongodb+srv://a:b@c/ "), true);
  });
});
