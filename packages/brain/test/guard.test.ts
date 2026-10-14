import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BSON } from "mongodb";
import {
  ALLOWED_STAGES,
  GuardError,
  MAX_PIPELINE_STAGES,
  assertFieldPathAllowed,
  assertInScope,
  assertSafeFilter,
  assertSafePipeline,
  assertSafeProjection,
  assertSafeQuery,
  assertSafeSort,
  hiddenSegmentOf,
  hitsHidden,
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
  test("$getField naming a hidden field is rejected", () => {
    assert.throws(() => assertSafeQuery([{ $project: { p: { $getField: "password" } } }], opts(["password"])), /hidden/);
    assert.throws(
      () => assertSafeQuery([{ $project: { p: { $getField: { field: "password", input: "$$ROOT" } } } }], opts(["password"])),
      /hidden/
    );
  });

  test("a computed $getField / $setField name is rejected when fields are hidden", () => {
    assert.throws(
      () =>
        assertSafeQuery(
          [{ $project: { p: { $getField: { field: { $concat: ["pass", "word"] }, input: "$$ROOT" } } } }],
          opts(["password"])
        ),
      /literal field name/
    );
    assert.throws(
      () => assertSafeQuery([{ $replaceWith: { $setField: { field: { $literal: "password" }, input: "$$ROOT", value: 1 } } }], opts(["password"])),
      /literal field name/
    );
  });

  test("$setField / $unsetField / $getField on visible literal fields are allowed", () => {
    assert.doesNotThrow(() => assertSafeQuery([{ $replaceWith: { $setField: { field: "x", input: "$$ROOT", value: 1 } } }], opts(["password"])));
    assert.doesNotThrow(() => assertSafeQuery([{ $replaceWith: { $unsetField: { field: "x", input: "$$ROOT" } } }], opts(["password"])));
    assert.doesNotThrow(() => assertSafeQuery([{ $project: { n: { $getField: "name" } } }], opts(["password"])));
  });

  const enumerating = [
    [{ $project: { kv: { $objectToArray: "$$ROOT" } } }],
    [{ $replaceWith: { $arrayToObject: [[["k", "v"]]] } }],
  ];
  for (const q of enumerating) {
    test(`rejects ${JSON.stringify(q).slice(0, 60)} when fields are hidden`, () => {
      assert.throws(() => assertSafeQuery(q, opts(["password"])), /not allowed/);
    });
  }

  test("are allowed when nothing is hidden", () => {
    const all = [
      ...enumerating,
      [{ $project: { p: { $getField: "password" } } }],
      [{ $project: { p: { $getField: { field: { $concat: ["pass", "word"] }, input: "$$ROOT" } } } }],
    ];
    for (const q of all) assert.doesNotThrow(() => assertSafeQuery(q, opts()));
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
  test("constructor / toString / hasOwnProperty keys don't crash or misfire", () => {
    for (const key of ["constructor", "toString", "hasOwnProperty"]) {
      const q = JSON.parse(`[{"$match":{"${key}":1}},{"$project":{"${key}":1}}]`);
      assert.doesNotThrow(() => assertSafeQuery(q, opts(["password"])), key);
      const filter = JSON.parse(`{"${key}":{"from":"salaries"}}`);
      assert.doesNotThrow(() => assertSafeQuery(filter, opts()), key);
    }
  });

  test("__proto__ keys are a GuardError, not a TypeError", () => {
    assert.throws(() => assertSafeQuery(JSON.parse('{"__proto__":{"x":1}}'), opts()), GuardError);
    assert.throws(() => assertSafeQuery(JSON.parse('[{"$match":{"__proto__":1}}]'), opts()), GuardError);
  });

  test("$-prefixed prototype-like keys are not allowed stages", () => {
    const q = JSON.parse('[{"$constructor":{"from":"salaries"}}]');
    assert.throws(() => assertSafeQuery(q, opts()), (e: any) => e instanceof GuardError && /not allowed/.test(e.message));
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

// ─── Allowlist guard: bypass matrix ──────────────────────────────────────────

const H = (hidden: string[] = ["password", "tokens"]) => ({ hidden: new Set(hidden), scope, db: "shop" });
const isGuardError = (re?: RegExp) => (e: any) => e instanceof GuardError && (!re || re.test(e.message));
const rejectsPipeline = (p: unknown, re?: RegExp, o = H()) => assert.throws(() => assertSafePipeline(p, o), isGuardError(re));
const allowsPipeline = (p: unknown, o = H()) => assert.doesNotThrow(() => assertSafePipeline(p, o));

describe("guard bypass matrix: variable paths", () => {
  test("$$ROOT / $$CURRENT paths to hidden fields", () => {
    rejectsPipeline([{ $project: { p: "$$ROOT.password" } }], /hidden/);
    rejectsPipeline([{ $project: { p: "$$CURRENT.auth.password" } }], /hidden/);
    rejectsPipeline([{ $match: { $expr: { $eq: ["$$ROOT.password", "x"] } } }], /hidden/);
  });

  test("$map with $$i.password", () => {
    rejectsPipeline([{ $project: { p: { $map: { input: "$items", as: "i", in: "$$i.password" } } } }], /hidden/);
  });

  test("$regexMatch on $$CURRENT.password", () => {
    rejectsPipeline(
      [{ $match: { $expr: { $regexMatch: { input: "$$CURRENT.password", regex: "^a" } } } }],
      /hidden/
    );
  });

  test("bare $$ROOT / $$CURRENT / $$NOW are allowed", () => {
    allowsPipeline([{ $project: { r: "$$ROOT", c: "$$CURRENT", n: "$$NOW" } }]);
  });

  test("$$USER_ROLES is always rejected", () => {
    rejectsPipeline([{ $project: { r: "$$USER_ROLES" } }], /USER_ROLES/, H([]));
    rejectsPipeline([{ $project: { r: "$$USER_ROLES.role" } }], /USER_ROLES/, H([]));
  });
});

describe("guard bypass matrix: $getField", () => {
  test("string form", () => {
    rejectsPipeline([{ $project: { p: { $getField: "password" } } }], /hidden/);
  });
  test("object form", () => {
    rejectsPipeline([{ $project: { p: { $getField: { field: "password", input: "$$ROOT" } } } }], /hidden/);
    rejectsPipeline([{ $project: { p: { $getField: { field: "tokens", input: "$auth" } } } }], /hidden/);
  });
  test("computed forms", () => {
    rejectsPipeline([{ $project: { p: { $getField: { field: { $concat: ["pass", "word"] }, input: "$$ROOT" } } } }]);
    rejectsPipeline([{ $project: { p: { $getField: { $literal: "password" } } } }]);
    rejectsPipeline([{ $project: { p: { $getField: { $toLower: "PASSWORD" } } } }]);
  });
  test("visible literal names are fine", () => {
    allowsPipeline([{ $project: { p: { $getField: { field: "price.usd", input: "$$ROOT" } } } }]);
  });
});

describe("guard bypass matrix: dynamic-key operators", () => {
  test("$objectToArray / $arrayToObject only when fields are hidden", () => {
    rejectsPipeline([{ $project: { kv: { $objectToArray: "$$ROOT" } } }], /not allowed/);
    rejectsPipeline([{ $replaceWith: { $arrayToObject: [[["k", "v"]]] } }], /not allowed/);
    allowsPipeline([{ $project: { kv: { $objectToArray: "$$ROOT" } } }], H([]));
    allowsPipeline([{ $replaceWith: { $arrayToObject: [[["k", "v"]]] } }], H([]));
  });

  test("$text only when fields are hidden", () => {
    assert.throws(() => assertSafeFilter({ $text: { $search: "abc" } }, H()), isGuardError(/not allowed/));
    assert.doesNotThrow(() => assertSafeFilter({ $text: { $search: "abc" } }, H([])));
  });

  test("$where / $function / $accumulator / $jsonSchema are always blocked", () => {
    for (const o of [H(), H([])]) {
      assert.throws(() => assertSafeFilter({ $where: "1" }, o), isGuardError(/not allowed/));
      assert.throws(() => assertSafeFilter({ $jsonSchema: {} }, o), isGuardError(/not allowed/));
      rejectsPipeline([{ $addFields: { x: { $function: { body: "", args: [], lang: "js" } } } }], /not allowed/, o);
      rejectsPipeline([{ $group: { _id: null, x: { $accumulator: {} } } }], /not allowed/, o);
    }
  });
});

describe("guard bypass matrix: path segments", () => {
  test("tokens.0 and tokens.0.value", () => {
    assert.equal(hitsHidden("tokens.0", new Set(["tokens"])), "tokens");
    assert.equal(hitsHidden("tokens.0.value", new Set(["tokens"])), "tokens");
    assert.throws(() => assertSafeFilter({ "tokens.0": "x" }, H()), isGuardError(/hidden/));
    assert.throws(() => assertSafeFilter({ "tokens.0.value": "x" }, H()), isGuardError(/hidden/));
    rejectsPipeline([{ $project: { t: "$tokens.0.value" } }], /hidden/);
  });

  test("positional segments are skipped", () => {
    assert.equal(hitsHidden("items.$.name", new Set(["password"])), undefined);
    assert.equal(hitsHidden("items.$[].password", new Set(["password"])), "password");
    assert.equal(hitsHidden("items.$[elem].name", new Set(["elem"])), undefined);
  });
});

describe("guard bypass matrix: literal field arguments", () => {
  test("$lookup localField / foreignField", () => {
    rejectsPipeline([{ $lookup: { from: "orders", localField: "password", foreignField: "x", as: "o" } }], /hidden/);
    rejectsPipeline([{ $lookup: { from: "orders", localField: "x", foreignField: "tokens.0", as: "o" } }], /hidden/);
    rejectsPipeline([{ $lookup: { from: "orders", localField: { $concat: ["a"] }, foreignField: "x", as: "o" } }], /literal/);
  });

  test("$graphLookup connectFromField / connectToField", () => {
    rejectsPipeline(
      [{ $graphLookup: { from: "orders", startWith: "$a", connectFromField: "password", connectToField: "a", as: "g" } }],
      /hidden/
    );
    rejectsPipeline(
      [{ $graphLookup: { from: "orders", startWith: "$a", connectFromField: "a", connectToField: "auth.password", as: "g" } }],
      /hidden/
    );
  });

  test("$densify / $fill / $geoNear", () => {
    rejectsPipeline([{ $densify: { field: "password", range: { step: 1, bounds: "full" } } }], /hidden/);
    rejectsPipeline([{ $densify: { field: "ts", partitionByFields: ["tokens"], range: { step: 1, bounds: "full" } } }], /hidden/);
    rejectsPipeline([{ $fill: { partitionByFields: ["password"], output: { x: { method: "locf" } } } }], /hidden/);
    rejectsPipeline([{ $geoNear: { near: [0, 0], distanceField: "d", key: "password" } }], /hidden/);
    allowsPipeline([{ $densify: { field: "ts", partitionByFields: ["region"], range: { step: 1, bounds: "full" } } }]);
  });

  test("$setField / $unsetField", () => {
    rejectsPipeline([{ $replaceWith: { $setField: { field: "password", input: "$$ROOT", value: "x" } } }], /hidden/);
    rejectsPipeline([{ $replaceWith: { $unsetField: { field: { $literal: "password" }, input: "$$ROOT" } } }], /literal/);
  });
});

describe("guard bypass matrix: stage allowlist", () => {
  const excluded = [
    "$out",
    "$merge",
    "$currentOp",
    "$collStats",
    "$indexStats",
    "$planCacheStats",
    "$listSessions",
    "$listLocalSessions",
    "$listSearchIndexes",
    "$listSampledQueries",
    "$search",
    "$searchMeta",
    "$vectorSearch",
    "$changeStream",
    "$changeStreamSplitLargeEvent",
    "$documents",
    "$querySettings",
    "$redact",
    "$shardedDataDistribution",
    "$listClusterCatalog",
  ];
  for (const stage of excluded) {
    test(`rejects ${stage} and lists the allowed stages`, () => {
      rejectsPipeline([{ [stage]: {} }], /not allowed.*\$match, \$project/, H([]));
    });
  }

  test("excluded stages are rejected inside $facet, $lookup and $unionWith pipelines", () => {
    rejectsPipeline([{ $facet: { a: [{ $merge: "x" }] } }], /not allowed/, H([]));
    rejectsPipeline([{ $lookup: { from: "orders", pipeline: [{ $documents: [{ a: 1 }] }], as: "o" } }], /not allowed/, H([]));
    rejectsPipeline([{ $unionWith: { coll: "orders", pipeline: [{ $out: "x" }] } }], /not allowed/, H([]));
  });

  test("$unionWith / $lookup scope is still enforced", () => {
    const hr = { hidden: new Set<string>(), scope, db: "hr" };
    rejectsPipeline([{ $unionWith: { coll: "salaries", pipeline: [] } }], /not enabled/, hr);
    rejectsPipeline([{ $facet: { a: [{ $lookup: { from: "salaries", as: "s" } }] } }], /not enabled/, hr);
  });

  test("__proto__ stage and __proto__ key are GuardErrors", () => {
    rejectsPipeline(JSON.parse('[{"__proto__":{"$match":{}}}]'), /not allowed/);
    rejectsPipeline(JSON.parse('[{"$match":{"__proto__":{"a":1}}}]'), /__proto__/);
    rejectsPipeline(JSON.parse('[{"$facet":{"__proto__":[]}}]'), /__proto__/);
  });

  test("multi-key and empty stages are rejected", () => {
    rejectsPipeline([{ $match: {}, $limit: 5 }], /exactly one key/);
    rejectsPipeline([{}], /exactly one key/);
    rejectsPipeline(["$match"], /JSON object/);
    rejectsPipeline({ $match: {} }, /array/);
  });

  test(`at most ${MAX_PIPELINE_STAGES} stages`, () => {
    allowsPipeline(Array.from({ length: MAX_PIPELINE_STAGES }, () => ({ $match: {} })));
    rejectsPipeline(Array.from({ length: MAX_PIPELINE_STAGES + 1 }, () => ({ $match: {} })), /at most/);
  });

  test("depth and node limits", () => {
    let deep: any = { a: 1 };
    for (let i = 0; i < 40; i++) deep = { $and: [deep] };
    assert.throws(() => assertSafeFilter(deep, H()), isGuardError(/nested too deeply/));
    const wide = { $or: Array.from({ length: 6000 }, (_, i) => ({ n: i })) };
    assert.throws(() => assertSafeFilter(wide, H()), isGuardError(/too large/));
  });

  test("$setWindowFields, $bucket, $facet, $bucketAuto, $sortByCount and friends are allowed", () => {
    allowsPipeline([
      { $match: { year: { $gte: 2000 } } },
      {
        $setWindowFields: {
          partitionBy: "$genre",
          sortBy: { year: 1 },
          output: { running: { $sum: "$sales", window: { documents: ["unbounded", "current"] } } },
        },
      },
      { $bucket: { groupBy: "$year", boundaries: [1990, 2000, 2010], default: "other", output: { n: { $sum: 1 } } } },
    ]);
    allowsPipeline([
      {
        $facet: {
          byGenre: [{ $sortByCount: "$genre" }],
          byYear: [{ $bucketAuto: { groupBy: "$year", buckets: 4 } }],
          total: [{ $count: "n" }],
        },
      },
      { $unset: "password" },
      { $sample: { size: 5 } },
      { $skip: 1 },
      { $limit: 3 },
      { $replaceRoot: { newRoot: "$$ROOT" } },
    ]);
    assert.ok(ALLOWED_STAGES.has("$setWindowFields"));
  });
});

describe("guard entry points", () => {
  test("filters must be plain objects", () => {
    for (const bad of [[], "x", 5, null, true, new Date()]) {
      assert.throws(() => assertSafeFilter(bad, H()), isGuardError(/filter must be a JSON object/), String(bad));
    }
  });

  test("projections: exclusion of hidden fields is allowed, inclusion is not", () => {
    assert.doesNotThrow(() => assertSafeProjection({ password: 0 }, H()));
    assert.doesNotThrow(() => assertSafeProjection({ password: false, tokens: 0, name: 1 }, H()));
    assert.throws(() => assertSafeProjection({ password: 1 }, H()), isGuardError(/hidden/));
    assert.throws(() => assertSafeProjection({ n: "$password" }, H()), isGuardError(/hidden/));
    allowsPipeline([{ $project: { password: 0 } }]);
    rejectsPipeline([{ $project: { password: 1 } }], /hidden/);
  });

  test("sorts accept 1, -1 and textScore only", () => {
    assert.doesNotThrow(() => assertSafeSort({ year: -1, title: 1, score: { $meta: "textScore" } }, H()));
    assert.throws(() => assertSafeSort({ year: "desc" }, H()), isGuardError(/Sort values/));
    assert.throws(() => assertSafeSort({ year: { $meta: "searchScore" } }, H()), isGuardError(/Sort values/));
    assert.throws(() => assertSafeSort({ password: 1 }, H()), isGuardError(/hidden/));
    rejectsPipeline([{ $sort: { year: 2 } }], /Sort values/);
  });
});
