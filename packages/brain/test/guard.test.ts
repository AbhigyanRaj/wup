import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BSON } from "mongodb";
import {
  GuardError,
  assertFieldPathAllowed,
  assertInScope,
  assertSafeQuery,
  hiddenSegmentOf,
  isInScope,
} from "../src/bridges/mongo/guard";

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

describe("assertSafeQuery: $$variable paths", () => {
  test("$$ROOT.<hidden> can't rename a hidden field", () => {
    assert.throws(() => assertSafeQuery([{ $project: { p: "$$ROOT.password" } }], opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $project: { p: "$$CURRENT.auth.password" } }], opts(["password"])), /hidden/);
    assert.throws(
      () => assertSafeQuery([{ $project: { p: { $map: { input: "$items", in: "$$this.password" } } } }], opts(["password"])),
      /hidden/
    );
    assert.throws(
      () => assertSafeQuery([{ $project: { p: { $let: { vars: { r: "$$ROOT" }, in: "$$r.tokens.0" } } } }], opts(["tokens"])),
      /hidden/
    );
  });

  test("$$ROOT and $$var paths to visible fields are allowed", () => {
    assert.doesNotThrow(() => assertSafeQuery([{ $project: { n: "$$ROOT.name", r: "$$ROOT" } }], opts(["password"])));
    assert.doesNotThrow(() => assertSafeQuery([{ $match: { $expr: { $eq: ["$$NOW", "$$NOW"] } } }], opts(["password"])));
  });
});

describe("assertSafeQuery: every path segment is checked", () => {
  test("hiddenSegmentOf checks parents and leaves, skipping array indexes", () => {
    const hidden = new Set(["tokens", "password"]);
    assert.equal(hiddenSegmentOf("tokens.0", hidden), "tokens");
    assert.equal(hiddenSegmentOf("tokens.0.value", hidden), "tokens");
    assert.equal(hiddenSegmentOf("auth.password", hidden), "password");
    assert.equal(hiddenSegmentOf("items.0.name", hidden), undefined);
    assert.equal(hiddenSegmentOf("name", new Set()), undefined);
  });

  test("a hidden parent can't be reached through a child path", () => {
    assert.throws(() => assertSafeQuery({ "tokens.0": { $exists: true } }, opts(["tokens"])), /hidden/);
    assert.throws(() => assertSafeQuery({ "tokens.0.value": "x" }, opts(["tokens"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $project: { t: "$tokens.0" } }], opts(["tokens"])), /hidden/);
    assert.throws(() => assertSafeQuery({ "auth.password": 1 }, opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $sort: { "auth.password": 1 } }], opts(["password"])), /hidden/);
  });

  test("assertFieldPathAllowed (used for distinct fields)", () => {
    assert.throws(() => assertFieldPathAllowed("password", new Set(["password"])), /hidden/);
    assert.throws(() => assertFieldPathAllowed("auth.password", new Set(["password"])), /hidden/);
    assert.throws(() => assertFieldPathAllowed("tokens.0", new Set(["tokens"])), /hidden/);
    assert.throws(() => assertFieldPathAllowed("$password", new Set(["password"])), /hidden/);
    assert.doesNotThrow(() => assertFieldPathAllowed("genres", new Set(["password"])));
  });
});

describe("assertSafeQuery: dynamic-key operators", () => {
  const dynamic = [
    [{ $project: { p: { $getField: "password" } } }],
    [{ $project: { p: { $getField: { field: { $concat: ["pass", "word"] }, input: "$$ROOT" } } } }],
    [{ $replaceWith: { $setField: { field: "x", input: "$$ROOT", value: 1 } } }],
    [{ $replaceWith: { $unsetField: { field: "x", input: "$$ROOT" } } }],
    [{ $project: { kv: { $objectToArray: "$$ROOT" } } }],
    [{ $replaceWith: { $arrayToObject: [[["k", "v"]]] } }],
  ];
  for (const q of dynamic) {
    test(`rejects ${JSON.stringify(q).slice(0, 60)} when fields are hidden`, () => {
      assert.throws(() => assertSafeQuery(q, opts(["password"])), /not allowed/);
    });
  }

  test("are allowed when nothing is hidden", () => {
    for (const q of dynamic) assert.doesNotThrow(() => assertSafeQuery(q, opts()));
  });
});

describe("assertSafeQuery: $lookup / $graphLookup field names", () => {
  test("localField / foreignField can't be hidden fields", () => {
    assert.throws(
      () => assertSafeQuery([{ $lookup: { from: "orders", localField: "password", foreignField: "x", as: "o" } }], opts(["password"])),
      /hidden/
    );
    assert.throws(
      () => assertSafeQuery([{ $lookup: { from: "orders", localField: "x", foreignField: "auth.password", as: "o" } }], opts(["password"])),
      /hidden/
    );
  });

  test("connectFromField / connectToField can't be hidden fields", () => {
    assert.throws(
      () =>
        assertSafeQuery(
          [{ $graphLookup: { from: "orders", startWith: "$a", connectFromField: "password", connectToField: "a", as: "g" } }],
          opts(["password"])
        ),
      /hidden/
    );
    assert.throws(
      () =>
        assertSafeQuery(
          [{ $graphLookup: { from: "orders", startWith: "$a", connectFromField: "a", connectToField: "tokens.0", as: "g" } }],
          opts(["tokens"])
        ),
      /hidden/
    );
  });

  test("visible lookup fields are allowed", () => {
    assert.doesNotThrow(() =>
      assertSafeQuery([{ $lookup: { from: "orders", localField: "_id", foreignField: "userId", as: "o" } }], opts(["password"]))
    );
  });
});

describe("assertSafeQuery: prototype keys", () => {
  test("__proto__ / constructor / toString keys don't crash or misfire", () => {
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const q = JSON.parse(`[{"$match":{"${key}":1}},{"$project":{"${key}":1}}]`);
      assert.doesNotThrow(() => assertSafeQuery(q, opts(["password"])), key);
      const filter = JSON.parse(`{"${key}":{"from":"salaries"}}`);
      assert.doesNotThrow(() => assertSafeQuery(filter, opts()), key);
    }
  });

  test("$-prefixed prototype-like keys are not treated as stages", () => {
    const q = JSON.parse('[{"$constructor":{"from":"salaries"}}]');
    assert.doesNotThrow(() => assertSafeQuery(q, opts()));
  });
});

describe("assertSafeQuery: server-inspection and search stages", () => {
  const stages = [
    "$collStats",
    "$indexStats",
    "$planCacheStats",
    "$listSearchIndexes",
    "$search",
    "$searchMeta",
    "$vectorSearch",
    "$changeStream",
    "$querySettings",
    "$listSampledQueries",
    "$documents",
  ];
  for (const stage of stages) {
    test(`rejects ${stage}`, () => {
      assert.throws(() => assertSafeQuery([{ [stage]: {} }], opts()), /not allowed/);
    });
  }

  test("rejects $jsonSchema in a filter", () => {
    assert.throws(() => assertSafeQuery({ $jsonSchema: { required: ["password"] } }, opts()), /not allowed/);
  });
});

describe("assertSafeQuery: exclusion projections", () => {
  test("excluding a hidden field is allowed in find projections", () => {
    const p = { hidden: new Set(["password"]), scope, db: "shop", projection: true };
    assert.doesNotThrow(() => assertSafeQuery({ password: 0 }, p));
    assert.doesNotThrow(() => assertSafeQuery({ password: false, name: 1 }, p));
    assert.doesNotThrow(() => assertSafeQuery({ "auth.password": 0 }, p));
    assert.doesNotThrow(() => assertSafeQuery({ auth: { password: 0 } }, p));
  });

  test("including or computing a hidden field in a projection is still rejected", () => {
    const p = { hidden: new Set(["password"]), scope, db: "shop", projection: true };
    assert.throws(() => assertSafeQuery({ password: 1 }, p), /hidden/);
    assert.throws(() => assertSafeQuery({ password: true }, p), /hidden/);
    assert.throws(() => assertSafeQuery({ password: { $slice: 1 } }, p), /hidden/);
  });

  test("excluding a hidden field is allowed in $project", () => {
    assert.doesNotThrow(() => assertSafeQuery([{ $project: { password: 0 } }], opts(["password"])));
    assert.doesNotThrow(() => assertSafeQuery([{ $project: { password: false, "auth.password": 0 } }], opts(["password"])));
    assert.throws(() => assertSafeQuery([{ $project: { password: 1 } }], opts(["password"])), /hidden/);
  });

  test("{ password: 0 } outside a projection is still a filter on a hidden field", () => {
    assert.throws(() => assertSafeQuery({ password: 0 }, opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $match: { password: 0 } }], opts(["password"])), /hidden/);
    assert.throws(() => assertSafeQuery([{ $addFields: { password: 0 } }], opts(["password"])), /hidden/);
  });
});
