import { BSON } from "mongodb";

/**
 * Helpers for moving values between the LLM (JSON text), MongoDB (BSON), and
 * the UI (plain JSON rows).
 */

/**
 * Parses a filter/pipeline/sort argument from the model. Accepts a JSON string
 * or an already-parsed object, and understands Extended JSON so the model can
 * write {"$oid": "..."} and {"$date": "..."}.
 */
export function parseEjsonArg<T = any>(value: unknown, fallback: T): T {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    if (typeof value === "string") return BSON.EJSON.parse(value) as T;
    return BSON.EJSON.deserialize(value as any) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not parse JSON argument: ${reason}`);
  }
}

/** Pretty Extended JSON for display in the "Query used" block. */
export function toDisplayEjson(value: unknown): string {
  try {
    return BSON.EJSON.stringify(value as any, undefined, 2, { relaxed: true });
  } catch {
    return JSON.stringify(value, null, 2);
  }
}

const MAX_STRING_CHARS = 500;
const MAX_ARRAY_ITEMS = 50;

/**
 * Converts BSON values to plain JSON: ObjectId → hex, Date → ISO string,
 * Decimal128/Long → number, Binary → placeholder. Long strings and huge
 * arrays (e.g. embedding vectors) are shortened so they don't flood the prompt.
 */
export function toPlain(value: any, depth = 0): any {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "string") {
    return value.length > MAX_STRING_CHARS ? value.slice(0, MAX_STRING_CHARS) + "…" : value;
  }
  if (typeof value !== "object") return value;

  const bsonType = (value as any)._bsontype;
  if (bsonType) {
    switch (bsonType) {
      case "ObjectId":
      case "ObjectID":
        return value.toHexString();
      case "Decimal128":
        return Number(value.toString());
      case "Long":
      case "Int32":
      case "Double":
        return Number(value.valueOf());
      case "Binary":
        return "[binary]";
      default:
        return String(value);
    }
  }

  if (depth > 6) return "[nested]";

  if (Array.isArray(value)) {
    const isVector = value.length > 64 && value.every((v) => typeof v === "number");
    if (isVector) return `[vector: ${value.length} dims]`;
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => toPlain(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`…${value.length - MAX_ARRAY_ITEMS} more`);
    return items;
  }

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) out[k] = toPlain(v, depth + 1);
  return out;
}

/** Short type label used in schema summaries. */
export function bsonTypeOf(value: any): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return "date";
  if (Array.isArray(value)) return "array";
  const bsonType = typeof value === "object" ? (value as any)._bsontype : undefined;
  if (bsonType) {
    if (bsonType === "ObjectId" || bsonType === "ObjectID") return "objectId";
    if (bsonType === "Decimal128" || bsonType === "Long" || bsonType === "Int32" || bsonType === "Double") return "number";
    return bsonType.toLowerCase();
  }
  if (typeof value === "object") return "object";
  if (typeof value === "boolean") return "bool";
  return typeof value;
}

/**
 * Flattens result rows into a table: nested objects become dot-keys
 * ("imdb.rating"), arrays become comma-joined text.
 */
export function rowsToTable(
  rows: Array<Record<string, any>>,
  maxRows = 100,
  maxColumns = 12
): { columns: string[]; rows: Array<Record<string, string | number>> } {
  const flatRows = rows.slice(0, maxRows).map((r) => flattenRow(r));
  const columns: string[] = [];
  for (const r of flatRows.slice(0, 50)) {
    for (const k of Object.keys(r)) {
      if (!columns.includes(k) && columns.length < maxColumns) columns.push(k);
    }
  }
  // _id first is noise in most tables; move it to the end
  const idIdx = columns.indexOf("_id");
  if (idIdx !== -1 && columns.length > 1) {
    columns.splice(idIdx, 1);
    columns.push("_id");
  }
  return { columns, rows: flatRows };
}

function flattenRow(row: Record<string, any>, prefix = "", out: Record<string, string | number> = {}, depth = 0) {
  for (const [k, v] of Object.entries(row ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) {
      out[key] = "";
    } else if (Array.isArray(v)) {
      const text = v.map((x) => (typeof x === "object" && x !== null ? JSON.stringify(x) : String(x))).join(", ");
      out[key] = text.length > 120 ? text.slice(0, 120) + "…" : text;
    } else if (typeof v === "object" && depth < 1) {
      flattenRow(v, key, out, depth + 1);
    } else if (typeof v === "object") {
      out[key] = JSON.stringify(v).slice(0, 120);
    } else if (typeof v === "number") {
      out[key] = v;
    } else {
      out[key] = String(v);
    }
  }
  return out;
}
