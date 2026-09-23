import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BSON } from "mongodb";
import { GuardError, assertInScope, assertSafeQuery, isInScope } from "../src/bridges/mongo/guard";

const scope = [
  { db: "shop", collections: ["*"] },
  { db: "hr", collections: ["employees"] },
];
const opts = (hidden: string[] = []) => ({ hidden: new Set(hidden), scope, db: "shop" });

describe("isInScope", () => {
  test("empty scope allows every non-system database", () => {
    assert.equal(isInScope([], "anything", "coll"), true);
    assert.equal(isInScope(undefined, "anything"), true);
  });

  test("system databases and system collections are never allowed", () => {
    for (const db of ["admin", "local", "config"]) assert.equal(isInScope([], db, "x"), false);
    assert.equal(isInScope([], "shop", "system.views"), false);
    assert.equal(isInScope([{ db: "admin", collections: ["*"] }], "admin", "users"), false);
  });

  test("wildcard and explicit collection lists", () => {
    assert.equal(isInScope(scope, "shop", "orders"), true);
    assert.equal(isInScope(scope, "hr", "employees"), true);
    assert.equal(isInScope(scope, "hr", "salaries"), false);
    assert.equal(isInScope(scope, "other", "x"), false);
    assert.equal(isInScope(scope, "hr"), true);
  });

  test("assertInScope throws a model-readable GuardError", () => {
    assert.throws(() => assertInScope(scope, "hr", "salaries"), (e: any) => e instanceof GuardError && /not enabled/.test(e.message));
    assert.throws(() => assertInScope(scope, "", "orders"), GuardError);
  });
});

describe("assertSafeQuery: read-only enforcement", () => {
  const blocked = [
    [{ $out: "copy" }],
    [{ $merge: { into: "copy" } }],
    [{ $facet: { a: [{ $merge: "x" }] } }],
    { $where: "this.a > 1" },
    { $expr: { $function: { body: "function(){}", args: [], lang: "js" } } },
    [{ $group: { _id: null, x: { $accumulator: {} } } }],
    [{ $currentOp: {} }],
  ];
  for (const q of blocked) {
    test(`rejects ${JSON.stringify(q).slice(0, 50)}`, () => {
      assert.throws(() => assertSafeQuery(q, opts()), /not allowed/);
    });
  }

  test("allows normal analytical pipelines", () => {
    assert.doesNotThrow(() =>
      assertSafeQuery(
        [
          { $match: { year: { $gte: 2000 } } },
          { $unwind: "$genres" },
          { $group: { _id: "$genres", avg: { $avg: "$imdb.rating" }, n: { $sum: 1 } } },
          { $sort: { avg: -1 } },
          { $lookup: { from: "orders", localField: "_id", foreignField: "genre", as: "o" } },
        ],
        opts()
      )
    );
  });

  test("ignores BSON values (ObjectId, Date) in filters", () => {
    assert.doesNotThrow(() => assertSafeQuery({ _id: new BSON.ObjectId(), at: { $gte: new Date() } }, opts()));
  });
});

describe("assertSafeQuery: privacy and scope", () => {
  test("rejects filters on hidden fields", () => {
    assert.throws(() => assertSafeQuery({ password: { $regex: "^a" } }, opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery({ "auth.password": { $exists: true } }, opts(["password"])), /hidden/);
  });

  test("rejects $-path references that would leak a hidden field under another name", () => {
    assert.throws(() => assertSafeQuery([{ $project: { p: "$password" } }], opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $project: { p: "$auth.password" } }], opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $group: { _id: "$jwt" } }], opts(["jwt"])), /hidden/);
  });

  test("$$variables are not treated as field paths", () => {
    assert.doesNotThrow(() => assertSafeQuery([{ $project: { n: "$$ROOT" } }], opts(["ROOT"])));
  });

  test("$lookup / $unionWith / $graphLookup must stay in scope", () => {
    const hrOpts = { hidden: new Set<string>(), scope, db: "hr" };
    assert.throws(() => assertSafeQuery([{ $lookup: { from: "salaries", as: "s" } }], hrOpts), /not enabled/);
    assert.throws(() => assertSafeQuery([{ $unionWith: "salaries" }], hrOpts), /not enabled/);
    assert.throws(() => assertSafeQuery([{ $unionWith: { coll: "salaries" } }], hrOpts), /not enabled/);
    assert.throws(() => assertSafeQuery([{ $graphLookup: { from: "salaries" } }], hrOpts), /not enabled/);
    assert.doesNotThrow(() => assertSafeQuery([{ $lookup: { from: "employees", as: "e" } }], hrOpts));
  });

  test("cross-database $lookup targets are rejected", () => {
    assert.throws(() => assertSafeQuery([{ $lookup: { from: { db: "hr", coll: "employees" }, as: "x" } }], opts()), /not allowed/);
  });

  test("sub-pipelines inside $lookup are checked too", () => {
    assert.throws(
      () => assertSafeQuery([{ $lookup: { from: "orders", pipeline: [{ $out: "x" }], as: "o" } }], opts()),
      /not allowed/
    );
  });
});
