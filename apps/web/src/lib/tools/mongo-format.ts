/**
 * Formats a MongoDB query (Extended JSON values) as runnable code for
 * mongosh, the Node.js driver and PyMongo.
 *
 * Extended JSON in, idiomatic literals out:
 *   {"$date": "..."}          -> ISODate("...") / new Date("...") / datetime(...)
 *   {"$oid": "..."}           -> ObjectId("...")
 *   {"$numberDecimal": "..."} -> NumberDecimal("...") / Decimal128.fromString("...") / Decimal128("...")
 *
 * Pure functions, safe on the server and in the browser.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface MongoQuery {
  kind: "find" | "aggregate";
  collection: string;
  filter?: JsonObject;
  projection?: JsonObject;
  sort?: JsonObject;
  skip?: number;
  limit?: number;
  pipeline?: JsonObject[];
}

export type CodeLang = "mongosh" | "node" | "python";

export const CODE_LANGS: Array<{ id: CodeLang; label: string }> = [
  { id: "mongosh", label: "mongosh" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
];

/* ------------------------------------------------------------------ */
/* Extended JSON detection                                             */
/* ------------------------------------------------------------------ */

const isObj = (v: unknown): v is JsonObject => v !== null && typeof v === "object" && !Array.isArray(v);

function single(v: JsonObject, key: string): string | null {
  const keys = Object.keys(v);
  if (keys.length !== 1 || keys[0] !== key) return null;
  const inner = v[key];
  if (typeof inner === "string") return inner;
  // Canonical EJSON: {"$date": {"$numberLong": "..."}}
  if (key === "$date" && isObj(inner) && typeof inner.$numberLong === "string") {
    return new Date(Number(inner.$numberLong)).toISOString();
  }
  return null;
}

export const ejsonDate = (v: Json): string | null => (isObj(v) ? single(v, "$date") : null);
export const ejsonOid = (v: Json): string | null => (isObj(v) ? single(v, "$oid") : null);
export const ejsonDecimal = (v: Json): string | null => (isObj(v) ? single(v, "$numberDecimal") : null);

/* ------------------------------------------------------------------ */
/* Literal printers                                                    */
/* ------------------------------------------------------------------ */

type Dialect = "js-shell" | "js-node" | "python";

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function jsKey(key: string): string {
  return IDENT.test(key) ? key : JSON.stringify(key);
}

function scalar(v: Json, d: Dialect): string | null {
  if (v === null) return d === "python" ? "None" : "null";
  if (typeof v === "boolean") return d === "python" ? (v ? "True" : "False") : String(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "string") return JSON.stringify(v);
  const dt = ejsonDate(v);
  if (dt !== null) {
    if (d === "js-shell") return `ISODate(${JSON.stringify(dt)})`;
    if (d === "js-node") return `new Date(${JSON.stringify(dt)})`;
    return pythonDatetime(dt);
  }
  const id = ejsonOid(v);
  if (id !== null) return d === "js-node" ? `new ObjectId(${JSON.stringify(id)})` : `ObjectId(${JSON.stringify(id)})`;
  const dec = ejsonDecimal(v);
  if (dec !== null) {
    if (d === "js-shell") return `NumberDecimal(${JSON.stringify(dec)})`;
    if (d === "js-node") return `Decimal128.fromString(${JSON.stringify(dec)})`;
    return `Decimal128(${JSON.stringify(dec)})`;
  }
  return null;
}

function pythonDatetime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `datetime.fromisoformat(${JSON.stringify(iso)})`;
  const parts = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  const time = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
  while (time.length && time[time.length - 1] === 0) time.pop();
  return `datetime(${[...parts, ...time].join(", ")}, tzinfo=timezone.utc)`;
}

const MAX_INLINE = 72;

/** Prints a value as a literal, inlining short objects and arrays. */
export function literal(v: Json, d: Dialect, indent = 0): string {
  const s = scalar(v, d);
  if (s !== null) return s;
  const pad = "  ".repeat(indent + 1);
  const end = "  ".repeat(indent);
  const key = (k: string) => (d === "python" ? JSON.stringify(k) : jsKey(k));

  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const inline = `[${v.map((x) => literal(x, d, 0)).join(", ")}]`;
    if (inline.length <= MAX_INLINE && !inline.includes("\n")) return inline;
    return `[\n${v.map((x) => pad + literal(x, d, indent + 1)).join(",\n")}\n${end}]`;
  }
  const entries = Object.entries(v as JsonObject);
  if (entries.length === 0) return "{}";
  const inline = `{ ${entries.map(([k, x]) => `${key(k)}: ${literal(x, d, 0)}`).join(", ")} }`;
  if (inline.length <= MAX_INLINE && !inline.includes("\n")) return inline;
  return `{\n${entries.map(([k, x]) => `${pad}${key(k)}: ${literal(x, d, indent + 1)}`).join(",\n")}\n${end}}`;
}

/* ------------------------------------------------------------------ */
/* Value scanning (for imports)                                        */
/* ------------------------------------------------------------------ */

function uses(v: Json | undefined, test: (x: Json) => boolean): boolean {
  if (v === undefined) return false;
  if (test(v)) return true;
  if (Array.isArray(v)) return v.some((x) => uses(x, test));
  if (isObj(v)) return Object.values(v).some((x) => uses(x, test));
  return false;
}

function parts(q: MongoQuery): Json[] {
  return [q.filter, q.projection, q.sort, q.pipeline as Json | undefined].filter((x): x is Json => x !== undefined);
}

const usesOid = (q: MongoQuery) => parts(q).some((p) => uses(p, (x) => ejsonOid(x) !== null));
const usesDate = (q: MongoQuery) => parts(q).some((p) => uses(p, (x) => ejsonDate(x) !== null));
const usesDecimal = (q: MongoQuery) => parts(q).some((p) => uses(p, (x) => ejsonDecimal(x) !== null));

/* ------------------------------------------------------------------ */
/* Code generators                                                     */
/* ------------------------------------------------------------------ */

function collectionRef(name: string, d: Dialect): string {
  const ok = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  if (d === "python") return ok ? `db.${name}` : `db[${JSON.stringify(name)}]`;
  if (d === "js-shell") return ok ? `db.${name}` : `db.getCollection(${JSON.stringify(name)})`;
  return `db.collection(${JSON.stringify(name)})`;
}

const hasKeys = (o?: JsonObject) => !!o && Object.keys(o).length > 0;

export function toMongosh(q: MongoQuery): string {
  const coll = collectionRef(q.collection, "js-shell");
  if (q.kind === "aggregate") return `${coll}.aggregate(${literal((q.pipeline ?? []) as Json, "js-shell")})`;
  const args = [literal(q.filter ?? {}, "js-shell")];
  if (hasKeys(q.projection)) args.push(literal(q.projection!, "js-shell"));
  let code = `${coll}.find(${args.join(", ")})`;
  if (hasKeys(q.sort)) code += `\n  .sort(${literal(q.sort!, "js-shell", 1)})`;
  if (q.skip) code += `\n  .skip(${q.skip})`;
  if (q.limit) code += `\n  .limit(${q.limit})`;
  return code;
}

export function toNode(q: MongoQuery): string {
  const imports = ["MongoClient", ...(usesOid(q) ? ["ObjectId"] : []), ...(usesDecimal(q) ? ["Decimal128"] : [])];
  const head = [
    `import { ${imports.join(", ")} } from "mongodb";`,
    "",
    "const client = new MongoClient(process.env.MONGODB_URI);",
    'const db = client.db("shop");',
    "",
  ];
  const coll = collectionRef(q.collection, "js-node");
  let body: string;
  if (q.kind === "aggregate") {
    body = `const docs = await ${coll}\n  .aggregate(${literal((q.pipeline ?? []) as Json, "js-node", 1)})\n  .toArray();`;
  } else {
    const args = [literal(q.filter ?? {}, "js-node", 1)];
    if (hasKeys(q.projection)) args.push(`{ projection: ${literal(q.projection!, "js-node", 1)} }`);
    body = `const docs = await ${coll}\n  .find(${args.join(", ")})`;
    if (hasKeys(q.sort)) body += `\n  .sort(${literal(q.sort!, "js-node", 1)})`;
    if (q.skip) body += `\n  .skip(${q.skip})`;
    if (q.limit) body += `\n  .limit(${q.limit})`;
    body += "\n  .toArray();";
  }
  return [...head, body].join("\n");
}

export function toPython(q: MongoQuery): string {
  const head = [
    ...(usesDate(q) ? ["from datetime import datetime, timezone"] : []),
    ...(usesOid(q) || usesDecimal(q)
      ? [`from bson import ${[usesOid(q) && "ObjectId", usesDecimal(q) && "Decimal128"].filter(Boolean).join(", ")}`]
      : []),
    "from pymongo import MongoClient",
    "",
    'db = MongoClient(os.environ["MONGODB_URI"])["shop"]',
    "",
  ];
  head.unshift("import os");
  const coll = collectionRef(q.collection, "python");
  let body: string;
  if (q.kind === "aggregate") {
    body = `docs = list(${coll}.aggregate(${literal((q.pipeline ?? []) as Json, "python")}))`;
  } else {
    const args = [literal(q.filter ?? {}, "python")];
    if (hasKeys(q.projection)) args.push(literal(q.projection!, "python"));
    body = `cursor = ${coll}.find(${args.join(", ")})`;
    if (hasKeys(q.sort)) {
      const pairs = Object.entries(q.sort!).map(([k, v]) => `(${JSON.stringify(k)}, ${literal(v, "python")})`);
      body += `.sort([${pairs.join(", ")}])`;
    }
    if (q.skip) body += `.skip(${q.skip})`;
    if (q.limit) body += `.limit(${q.limit})`;
    body += "\ndocs = list(cursor)";
  }
  return [...head, body].join("\n");
}

export function formatQuery(q: MongoQuery, lang: CodeLang): string {
  if (lang === "node") return toNode(q);
  if (lang === "python") return toPython(q);
  return toMongosh(q);
}

/** A sample document printed the way mongosh prints it. */
export function formatDocument(doc: Json): string {
  return literal(doc, "js-shell");
}
