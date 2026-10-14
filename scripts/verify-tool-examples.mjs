#!/usr/bin/env node
/**
 * Verifies every worked example on the free tool pages.
 *
 *   node scripts/verify-tool-examples.mjs
 *
 * 1. Starts an in-memory MongoDB (mongodb-memory-server) and seeds the sample
 *    datasets from apps/web/src/content/data/sample-datasets.ts.
 * 2. For each example in tools.ts:
 *    - runs the structured query with the Node.js driver,
 *    - evaluates the published mongosh code (output.code) against the same
 *      database through a tiny mongosh shim and checks it returns the same
 *      documents,
 *    - compares resultPreview rows with the first rows MongoDB returned.
 * 3. Checks page-level rules: at least 10 examples, unique ids, known datasets.
 *
 * Exits non-zero on any failure.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongodb from "mongodb";
const { MongoClient, ObjectId, Decimal128 } = mongodb;
const { EJSON } = mongodb.BSON;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "apps/web/src/content/data");

const { sampleDatasets } = await tsImport(path.join(dataDir, "sample-datasets.ts"), import.meta.url);
const { tools } = await tsImport(path.join(dataDir, "tools.ts"), import.meta.url);
const { useCases } = await tsImport(path.join(dataDir, "use-cases.ts"), import.meta.url);

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

const server = await MongoMemoryServer.create();
const client = new MongoClient(server.getUri());
await client.connect();
const db = client.db("shop");

for (const ds of sampleDatasets) {
  const docs = ds.sample.map((d) => EJSON.deserialize(d, { relaxed: true }));
  await db.collection(ds.collection).insertMany(docs);
}

/** Runs a structured query with the driver. */
async function runStructured(q) {
  const coll = db.collection(q.collection);
  const parse = (v) => (v === undefined ? undefined : EJSON.deserialize(v, { relaxed: true }));
  if (q.kind === "aggregate") return coll.aggregate(parse(q.pipeline)).toArray();
  let cursor = coll.find(parse(q.filter) ?? {}, q.projection ? { projection: parse(q.projection) } : {});
  if (q.sort) cursor = cursor.sort(q.sort);
  if (q.skip) cursor = cursor.skip(q.skip);
  if (q.limit) cursor = cursor.limit(q.limit);
  return cursor.toArray();
}

/** Evaluates mongosh code (db.x.find(...).sort(...)) against the driver. */
async function runMongosh(code) {
  const wrap = (cursor) => ({
    sort: (s) => wrap(cursor.sort(s)),
    skip: (n) => wrap(cursor.skip(n)),
    limit: (n) => wrap(cursor.limit(n)),
    toArray: () => cursor.toArray(),
  });
  const collection = (name) => ({
    find: (filter = {}, projection) => wrap(db.collection(name).find(filter, projection ? { projection } : {})),
    aggregate: (pipeline) => wrap(db.collection(name).aggregate(pipeline)),
  });
  const shellDb = new Proxy({}, { get: (_t, name) => (name === "getCollection" ? collection : collection(String(name))) });
  const ISODate = (s) => new Date(s);
  const ObjectIdFn = (s) => new ObjectId(s);
  const NumberDecimal = (s) => Decimal128.fromString(s);
  const fn = new Function("db", "ISODate", "ObjectId", "NumberDecimal", `return (${code});`);
  const result = fn(shellDb, ISODate, ObjectIdFn, NumberDecimal);
  return result.toArray();
}

function cell(doc, colPath) {
  let v = doc;
  for (const part of colPath.split(".")) v = v == null ? undefined : v[part];
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v instanceof ObjectId) return v.toHexString();
  if (Array.isArray(v)) return v.map((x) => (x instanceof ObjectId ? x.toHexString() : x)).join(", ");
  if (v && typeof v === "object" && v._bsontype === "Decimal128") return Number(v.toString());
  return v === undefined ? null : v;
}

const datasetIds = new Set(sampleDatasets.map((d) => d.id));
let exampleCount = 0;

for (const page of tools) {
  if (page.examples.length < 10) fail(page.path, `only ${page.examples.length} examples (need at least 10)`);
  const ids = new Set();
  for (const e of page.examples) {
    const where = `${page.tool} / ${e.id}`;
    exampleCount++;
    if (ids.has(e.id)) fail(where, "duplicate example id");
    ids.add(e.id);
    if (!datasetIds.has(e.dataset)) fail(where, `unknown dataset ${e.dataset}`);
    if (e.output.kind !== e.query.kind) fail(where, "output.kind does not match query.kind");

    let structured;
    try {
      structured = await runStructured(e.query);
    } catch (err) {
      fail(where, `structured query failed: ${err.message}`);
      continue;
    }
    try {
      const shell = await runMongosh(e.output.code);
      const isSample = JSON.stringify(e.query).includes("$sample");
      if (!isSample && EJSON.stringify(shell) !== EJSON.stringify(structured)) {
        fail(where, "mongosh code returned different results from the structured query");
      }
    } catch (err) {
      fail(where, `mongosh code failed: ${err.message}\n${e.output.code}`);
    }
    if (e.resultPreview) {
      const { columns, rows } = e.resultPreview;
      const actual = structured.slice(0, Math.max(rows.length, rows.length === 0 ? structured.length : 0)).map((d) => columns.map((c) => cell(d, c)));
      if (rows.length === 0 && structured.length !== 0) fail(where, `preview is empty but MongoDB returned ${structured.length} documents`);
      if (JSON.stringify(actual) !== JSON.stringify(rows)) {
        fail(where, `preview mismatch\n    expected ${JSON.stringify(rows)}\n    actual   ${JSON.stringify(actual)}`);
      }
    }
  }
}

// Use-case pages: every MongoDB query shown must run.
let useCaseQueries = 0;
for (const page of useCases) {
  for (const qa of page.qa) {
    if (!qa.query) continue;
    useCaseQueries++;
    try {
      await runStructured(qa.query);
    } catch (err) {
      fail(`${page.path} / ${qa.question}`, `query failed: ${err.message}`);
    }
  }
}

await client.close();
await server.stop();

if (failures.length) {
  console.error(`\n${failures.length} problem(s) in tool examples:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `OK: ${exampleCount} examples across ${tools.length} tools ran against the sample datasets and matched their previews; ${useCaseQueries} use-case queries ran.`
);
