import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BSON } from "mongodb";
import { inferFields } from "../src/bridges/mongo/introspect";
import { MAX_DIGEST_CHARS, buildBridgeDigest } from "../src/bridges/mongo/digest";
import { templateSuggestions } from "../src/bridges/mongo/scan";

describe("inferFields", () => {
  const docs = [
    { _id: new BSON.ObjectId(), title: "A", year: 2001, genres: ["Drama"], imdb: { rating: 8 }, released: new Date(), cast: [{ name: "x" }] },
    { _id: new BSON.ObjectId(), title: "B", year: "1999", genres: [], imdb: { rating: 7 } },
  ];
  const fields = inferFields(docs);
  const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));

  test("records types, including mixed types", () => {
    assert.deepEqual(byPath.year.types, ["number", "string"]);
    assert.deepEqual(byPath._id.types, ["objectId"]);
    assert.deepEqual(byPath.released.types, ["date"]);
    assert.deepEqual(byPath.genres.types, ["array", "array<string>"]);
  });

  test("walks nested objects and arrays of sub-documents with dot paths", () => {
    assert.deepEqual(byPath["imdb.rating"].types, ["number"]);
    assert.deepEqual(byPath["cast.name"].types, ["string"]);
  });

  test("computes presence percentage and short samples", () => {
    assert.equal(byPath.title.pct, 100);
    assert.equal(byPath.released.pct, 50);
    assert.equal(byPath.title.sample, "A");
  });

  test("most-present fields come first", () => {
    assert.ok(fields.findIndex((f) => f.path === "title") < fields.findIndex((f) => f.path === "released"));
  });
});

const conn = (overrides: any = {}) => ({
  _id: "65a000000000000000000001",
  name: "Movies",
  type: "mongodb",
  scope: [],
  redactedFields: { "mflix.users": ["password"] },
  schemaCache: {
    dbs: [
      {
        name: "mflix",
        collections: [
          { name: "movies", count: 21349, fields: [{ path: "_id", types: ["objectId"] }, { path: "title", types: ["string"] }, { path: "year", types: ["number"] }] },
          { name: "users", count: 185, fields: [{ path: "email", types: ["string"] }, { path: "password", types: ["string"] }] },
        ],
      },
    ],
  },
  ...overrides,
});

describe("buildBridgeDigest", () => {
  test("lists collections with counts and field types", () => {
    const d = buildBridgeDigest([conn()]);
    assert.match(d, /connectionId: 65a000000000000000000001/);
    assert.match(d, /mflix\.movies \(21,349 docs\): title:string, year:number/);
  });

  test("never mentions hidden fields or _id", () => {
    const d = buildBridgeDigest([conn()]);
    assert.doesNotMatch(d, /password/);
    assert.doesNotMatch(d, /_id:/);
    assert.match(d, /mflix\.users \(185 docs\): email:string/);
  });

  test("respects the bridge scope", () => {
    const d = buildBridgeDigest([conn({ scope: [{ db: "mflix", collections: ["movies"] }] })]);
    assert.match(d, /mflix\.movies/);
    assert.doesNotMatch(d, /mflix\.users/);
  });

  test("tells the model to explore when the schema isn't scanned yet", () => {
    const d = buildBridgeDigest([conn({ schemaCache: undefined, metadata: { status: "scanning" } })]);
    assert.match(d, /schema scan in progress; call mongo_list_sources/);
  });

  test("falls back to collection names when field lists exceed the budget", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      name: `collection_${i}`,
      count: i,
      fields: Array.from({ length: 15 }, (_, j) => ({ path: `field_number_${j}`, types: ["string"] })),
    }));
    const d = buildBridgeDigest([conn({ schemaCache: { dbs: [{ name: "big", collections: many }] } })]);
    assert.ok(d.length <= MAX_DIGEST_CHARS + 120);
    assert.doesNotMatch(d, /field_number_0/);
    assert.match(d, /mongo_describe|mongo_list_sources/);
  });

  test("template suggestions use the biggest collections", () => {
    const s = templateSuggestions(conn());
    assert.equal(s[0], "How many movies are there?");
    assert.ok(s.length > 0 && s.length <= 5);
  });
});
