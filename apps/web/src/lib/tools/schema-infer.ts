/**
 * Infers a MongoDB schema from sample documents, entirely in the browser.
 *
 * Input: documents as Extended JSON values (see relaxed-json.ts), so
 * {"$oid"}, {"$date"} and {"$numberDecimal"} are recognised as BSON types.
 * Output: one row per field path (with array elements as "path[]"), the
 * types seen and how often, plus generators for a $jsonSchema validator, a
 * TypeScript interface and a Mongoose schema.
 */
import { ejsonDate, ejsonDecimal, ejsonOid, type Json } from "./mongo-format";

export type BsonType = "string" | "number" | "bool" | "date" | "objectId" | "decimal" | "null" | "array" | "object" | "regex";

export interface FieldStat {
  /** Dotted path; array elements are "items[]" and their fields "items[].sku". */
  path: string;
  depth: number;
  /** Documents (or array elements, for paths under []) that have the field. */
  present: number;
  /** Denominator for presence: documents, or parent array elements. */
  of: number;
  types: Partial<Record<BsonType, number>>;
  example?: string;
}

export interface InferredSchema {
  docs: number;
  fields: FieldStat[];
}

const isRegex = (v: Json) => !!v && typeof v === "object" && !Array.isArray(v) && "$regex" in v && Object.keys(v).every((k) => k === "$regex" || k === "$options");

export function typeOf(v: Json): BsonType {
  if (v === null) return "null";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  // JSON can't tell int from double (mongosh stores 42 as a double), so use
  // the $jsonSchema "number" alias, which covers int, long, double and decimal.
  if (typeof v === "number") return "number";
  if (Array.isArray(v)) return "array";
  if (ejsonOid(v) !== null) return "objectId";
  if (ejsonDate(v) !== null) return "date";
  if (ejsonDecimal(v) !== null) return "decimal";
  if (isRegex(v)) return "regex";
  return "object";
}

function exampleOf(v: Json): string | undefined {
  const t = typeOf(v);
  if (t === "object" || t === "array") return undefined;
  if (t === "objectId") return `ObjectId("${ejsonOid(v)}")`;
  if (t === "date") return ejsonDate(v)!;
  if (t === "decimal") return ejsonDecimal(v)!;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
}

export function inferSchema(docs: Array<Record<string, Json>>): InferredSchema {
  const stats = new Map<string, FieldStat>();
  const order: string[] = [];

  const stat = (path: string, depth: number): FieldStat => {
    let s = stats.get(path);
    if (!s) {
      s = { path, depth, present: 0, of: 0, types: {} };
      stats.set(path, s);
      order.push(path);
    }
    return s;
  };

  /** Walk one object; `parent` is the prefix; every key under it counts against `count`. */
  const walkObject = (obj: Record<string, Json>, prefix: string, depth: number) => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      record(path, value, depth);
    }
  };

  const record = (path: string, value: Json, depth: number) => {
    const s = stat(path, depth);
    s.present++;
    const t = typeOf(value);
    s.types[t] = (s.types[t] ?? 0) + 1;
    if (s.example === undefined) s.example = exampleOf(value);
    if (t === "object") walkObject(value as Record<string, Json>, path, depth + 1);
    if (t === "array") {
      const elPath = `${path}[]`;
      for (const el of value as Json[]) record(elPath, el, depth + 1);
    }
  };

  for (const doc of docs) walkObject(doc, "", 0);

  // Denominators: top-level fields count documents; nested fields count how
  // often their parent was an object (or array element).
  for (const s of stats.values()) {
    const parent = parentPath(s.path);
    if (parent === null) s.of = docs.length;
    else {
      const p = stats.get(parent);
      s.of = p ? p.types.object ?? 0 : docs.length;
    }
    if (s.path.endsWith("[]")) s.of = s.present; // array elements: presence is not meaningful
  }

  return { docs: docs.length, fields: order.map((p) => stats.get(p)!) };
}

/** "a.b" -> "a", "items[].sku" -> "items[]", "items[]" -> "items", "a" -> null */
export function parentPath(path: string): string | null {
  if (path.endsWith("[]")) return path.slice(0, -2);
  const dot = path.lastIndexOf(".");
  return dot === -1 ? null : path.slice(0, dot);
}

export const presence = (f: FieldStat) => (f.of === 0 ? 0 : Math.round((f.present / f.of) * 100));

/** Display label for a field's types, most frequent first. */
export function typeLabel(f: FieldStat): string {
  return sortedTypes(f)
    .map((t) => (t === "array" ? `array<${elementTypeLabel(f)}>` : t))
    .join(" | ");
}

function sortedTypes(f: FieldStat): BsonType[] {
  return (Object.entries(f.types) as Array<[BsonType, number]>).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

let currentSchema: InferredSchema | null = null;
function elementTypeLabel(f: FieldStat): string {
  const el = currentSchema?.fields.find((x) => x.path === `${f.path}[]`);
  return el ? sortedTypes(el).join(" | ") : "unknown";
}

/** Helper so typeLabel can see array element stats. */
export function withSchema<T>(schema: InferredSchema, fn: () => T): T {
  const prev = currentSchema;
  currentSchema = schema;
  try {
    return fn();
  } finally {
    currentSchema = prev;
  }
}

/* ------------------------------------------------------------------ */
/* Tree helpers                                                        */
/* ------------------------------------------------------------------ */

function children(schema: InferredSchema, parent: string | null): FieldStat[] {
  return schema.fields.filter((f) => parentPath(f.path) === parent && !(parent !== null && f.path === `${parent}[]`));
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf(".") + 1);

const BSON_TYPE_NAME: Record<BsonType, string> = {
  string: "string",
  number: "number",
  bool: "bool",
  date: "date",
  objectId: "objectId",
  decimal: "decimal",
  null: "null",
  array: "array",
  object: "object",
  regex: "regex",
};

/* ------------------------------------------------------------------ */
/* $jsonSchema validator                                               */
/* ------------------------------------------------------------------ */

type JsonSchemaNode = Record<string, Json>;

function jsonSchemaFor(schema: InferredSchema, f: FieldStat): JsonSchemaNode {
  const types = sortedTypes(f);
  const list = [...new Set(types.map((t) => BSON_TYPE_NAME[t]))];
  const node: JsonSchemaNode = { bsonType: list.length === 1 ? list[0] : list };
  if (f.types.object) Object.assign(node, objectSchema(schema, f.path));
  if (f.types.array) {
    const el = schema.fields.find((x) => x.path === `${f.path}[]`);
    if (el) node.items = jsonSchemaFor(schema, el);
  }
  return node;
}

function objectSchema(schema: InferredSchema, parent: string | null): JsonSchemaNode {
  const kids = children(schema, parent);
  const properties: Record<string, Json> = {};
  const required: string[] = [];
  for (const k of kids) {
    const name = parent?.endsWith("[]") ? k.path.slice(parent.length + 1) : lastSegment(k.path);
    properties[name] = jsonSchemaFor(schema, k);
    if (k.present === k.of && k.of > 0) required.push(name);
  }
  return { ...(required.length ? { required } : {}), properties };
}

/** A collMod-ready $jsonSchema: fields present in every document are required. */
export function toJsonSchema(schema: InferredSchema): JsonSchemaNode {
  return { $jsonSchema: { bsonType: "object", ...objectSchema(schema, null) } };
}

/* ------------------------------------------------------------------ */
/* TypeScript                                                          */
/* ------------------------------------------------------------------ */

const TS_TYPE: Record<BsonType, string> = {
  string: "string",
  number: "number",
  bool: "boolean",
  date: "Date",
  objectId: "ObjectId",
  decimal: "Decimal128",
  null: "null",
  array: "unknown[]",
  object: "Record<string, unknown>",
  regex: "RegExp",
};

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const tsKey = (k: string) => (IDENT.test(k) ? k : JSON.stringify(k));

function tsTypeFor(schema: InferredSchema, f: FieldStat, indent: number): string {
  const parts = new Set<string>();
  for (const t of sortedTypes(f)) {
    if (t === "object") parts.add(tsObject(schema, f.path, indent));
    else if (t === "array") {
      const el = schema.fields.find((x) => x.path === `${f.path}[]`);
      const inner = el ? tsTypeFor(schema, el, indent) : "unknown";
      parts.add(inner.includes(" | ") ? `Array<${inner}>` : `${inner}[]`);
    } else parts.add(TS_TYPE[t]);
  }
  return [...parts].join(" | ") || "unknown";
}

function tsObject(schema: InferredSchema, parent: string | null, indent: number): string {
  const kids = children(schema, parent);
  if (!kids.length) return "Record<string, unknown>";
  const pad = "  ".repeat(indent + 1);
  const lines = kids.map((k) => {
    const name = parent?.endsWith("[]") ? k.path.slice(parent.length + 1) : lastSegment(k.path);
    const optional = k.present < k.of ? "?" : "";
    return `${pad}${tsKey(name)}${optional}: ${tsTypeFor(schema, k, indent + 1)};`;
  });
  return `{\n${lines.join("\n")}\n${"  ".repeat(indent)}}`;
}

export function toTypeScript(schema: InferredSchema, name = "Document"): string {
  const usesOid = schema.fields.some((f) => f.types.objectId);
  const usesDec = schema.fields.some((f) => f.types.decimal);
  const imports = [usesOid && "ObjectId", usesDec && "Decimal128"].filter(Boolean);
  const head = imports.length ? `import type { ${imports.join(", ")} } from "mongodb";\n\n` : "";
  return `${head}export interface ${pascal(name)} ${tsObject(schema, null, 0)}`;
}

/* ------------------------------------------------------------------ */
/* Mongoose                                                            */
/* ------------------------------------------------------------------ */

const MONGOOSE_TYPE: Partial<Record<BsonType, string>> = {
  string: "String",
  number: "Number",
  bool: "Boolean",
  date: "Date",
  objectId: "Schema.Types.ObjectId",
  decimal: "Schema.Types.Decimal128",
};

function mongooseFor(schema: InferredSchema, f: FieldStat, indent: number): string {
  const types = sortedTypes(f).filter((t) => t !== "null");
  const required = f.present === f.of && f.of > 0 && !f.types.null;
  if (types.length === 1 && types[0] === "object") {
    return mongooseObject(schema, f.path, indent);
  }
  if (types.length === 1 && types[0] === "array") {
    const el = schema.fields.find((x) => x.path === `${f.path}[]`);
    if (!el) return "[Schema.Types.Mixed]";
    const elTypes = sortedTypes(el).filter((t) => t !== "null");
    if (elTypes.length === 1 && elTypes[0] === "object") return `[${mongooseObject(schema, el.path, indent)}]`;
    if (elTypes.length === 1 && MONGOOSE_TYPE[elTypes[0]]) return `[${MONGOOSE_TYPE[elTypes[0]]}]`;
    return "[Schema.Types.Mixed]";
  }
  const base = types.length === 1 && MONGOOSE_TYPE[types[0]] ? MONGOOSE_TYPE[types[0]]! : "Schema.Types.Mixed";
  if (f.path === "_id") return base;
  return required ? `{ type: ${base}, required: true }` : base;
}

function mongooseObject(schema: InferredSchema, parent: string | null, indent: number): string {
  const kids = children(schema, parent).filter((k) => !(parent === null && k.path === "_id" && k.types.objectId));
  if (!kids.length) return "{}";
  const pad = "  ".repeat(indent + 1);
  const lines = kids.map((k) => {
    const name = parent?.endsWith("[]") ? k.path.slice(parent.length + 1) : lastSegment(k.path);
    return `${pad}${tsKey(name)}: ${mongooseFor(schema, k, indent + 1)},`;
  });
  return `{\n${lines.join("\n")}\n${"  ".repeat(indent)}}`;
}

export function toMongoose(schema: InferredSchema, name = "Document"): string {
  const model = pascal(name);
  return [
    'import { Schema, model } from "mongoose";',
    "",
    `const ${camel(model)}Schema = new Schema(${mongooseObject(schema, null, 0)});`,
    "",
    `export const ${model} = model("${model}", ${camel(model)}Schema);`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */

function pascal(s: string): string {
  const out = s
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  const singular = out.endsWith("ies") ? `${out.slice(0, -3)}y` : out.endsWith("s") && !out.endsWith("ss") ? out.slice(0, -1) : out;
  return /^[A-Za-z]/.test(singular) ? singular : `Doc${singular}`;
}

const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
