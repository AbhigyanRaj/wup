import type { Db, MongoClient } from "mongodb";
import { SYSTEM_DBS, isInScope, type ScopeEntry } from "./guard";
import { bsonTypeOf, toPlain } from "./values";

/**
 * Discovers what's in a cluster and infers collection schemas by sampling.
 */

export interface SourceCollection {
  name: string;
  count: number | null; // null for views
  type: "collection" | "view";
}

export interface SourceDb {
  name: string;
  collections: SourceCollection[];
}

export interface FieldInfo {
  path: string;
  types: string[];
  pct: number;
  sample?: string;
}

export interface CollectionSchema {
  name: string;
  /** null for views whose count timed out */
  count: number | null;
  fields: FieldInfo[];
  indexes: string[];
  type?: "collection" | "view";
}

const SAMPLE_SIZE = 100;
const MAX_FIELD_DEPTH = 3;
const MAX_FIELDS_PER_COLLECTION = 60;
const MAX_COLLECTIONS_PER_SCAN = 100;
const SCAN_TIMEOUT_MS = 10000;

/**
 * Lists databases and collections with document counts.
 * Falls back to the URL's default db when the user lacks listDatabases rights.
 */
export async function listSources(client: MongoClient): Promise<SourceDb[]> {
  let dbNames: string[];
  try {
    const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
    dbNames = databases.map((d) => d.name).filter((n) => !SYSTEM_DBS.has(n));
  } catch {
    dbNames = [client.db().databaseName];
  }

  const result: SourceDb[] = [];
  for (const name of dbNames.sort()) {
    const db = client.db(name);
    const infos = await db.listCollections({}, { nameOnly: false }).toArray();
    const collections: SourceCollection[] = [];
    for (const info of infos) {
      if (info.name.startsWith("system.")) continue;
      const isView = info.type === "view";
      let count: number | null = null;
      if (!isView) {
        count = await db.collection(info.name).estimatedDocumentCount({ maxTimeMS: 5000 }).catch(() => null);
      }
      collections.push({ name: info.name, count, type: isView ? "view" : "collection" });
    }
    collections.sort((a, b) => a.name.localeCompare(b.name));
    result.push({ name, collections });
  }
  return result;
}

/**
 * Samples a collection (or view) and infers field paths, types and presence.
 * Views are read with a plain find().limit() (no $sample, no indexes) and
 * counted with countDocuments, falling back to null when that times out.
 */
export async function scanCollection(
  db: Db,
  name: string,
  count: number | null,
  opts: { view?: boolean } = {}
): Promise<CollectionSchema> {
  const coll = db.collection(name);
  if (opts.view) {
    const docs = await coll.find({}, { limit: SAMPLE_SIZE, maxTimeMS: SCAN_TIMEOUT_MS }).toArray();
    const viewCount = await coll.countDocuments({}, { maxTimeMS: SCAN_TIMEOUT_MS }).catch(() => null);
    return { name, count: viewCount, fields: inferFields(docs), indexes: [], type: "view" };
  }
  const docs = await coll
    .aggregate([{ $sample: { size: SAMPLE_SIZE } }], { maxTimeMS: SCAN_TIMEOUT_MS })
    .toArray()
    .catch(() => coll.find({}, { limit: SAMPLE_SIZE, maxTimeMS: SCAN_TIMEOUT_MS }).toArray());

  const indexes = await coll
    .listIndexes()
    .toArray()
    .then((ix) => ix.map((i) => Object.keys(i.key).join("+")))
    .catch(() => [] as string[]);

  return { name, count, fields: inferFields(docs), indexes };
}

/** Exported for tests: builds the field summary from sampled documents. */
export function inferFields(docs: Array<Record<string, any>>): FieldInfo[] {
  const stats = new Map<string, { types: Set<string>; seen: number; sample?: string }>();

  const record = (path: string, value: any, seenInDoc: Set<string>) => {
    let s = stats.get(path);
    if (!s) {
      s = { types: new Set(), seen: 0 };
      stats.set(path, s);
    }
    const type = bsonTypeOf(value);
    if (type === "array" && Array.isArray(value) && value.length > 0) {
      const inner = bsonTypeOf(value[0]);
      s.types.add(inner === "object" ? "array<object>" : `array<${inner}>`);
    } else {
      s.types.add(type);
    }
    if (!seenInDoc.has(path)) {
      seenInDoc.add(path);
      s.seen++;
    }
    if (s.sample === undefined && value !== null && typeof value !== "object") {
      s.sample = String(value).slice(0, 40);
    } else if (s.sample === undefined && (type === "date" || type === "objectId")) {
      s.sample = String(toPlain(value)).slice(0, 40);
    }
  };

  const walk = (obj: Record<string, any>, prefix: string, depth: number, seenInDoc: Set<string>) => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      record(path, value, seenInDoc);
      if (depth >= MAX_FIELD_DEPTH) continue;
      if (isPlainObject(value)) {
        walk(value, path, depth + 1, seenInDoc);
      } else if (Array.isArray(value) && value.length > 0 && isPlainObject(value[0])) {
        // Dot-notation reaches into arrays of sub-documents
        walk(value[0], path, depth + 1, seenInDoc);
      }
    }
  };

  for (const doc of docs) walk(doc, "", 1, new Set());

  const total = Math.max(docs.length, 1);
  return [...stats.entries()]
    .map(([path, s]) => ({
      path,
      types: [...s.types].sort(),
      pct: Math.round((s.seen / total) * 100),
      ...(s.sample !== undefined ? { sample: s.sample } : {}),
    }))
    .sort((a, b) => {
      // Top-level, frequently-present fields first
      const depthDiff = a.path.split(".").length - b.path.split(".").length;
      return b.pct - a.pct || depthDiff || a.path.localeCompare(b.path);
    })
    .slice(0, MAX_FIELDS_PER_COLLECTION);
}

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !v._bsontype;
}

/**
 * Scans every in-scope collection and view (up to MAX_COLLECTIONS_PER_SCAN).
 * Collections past the cap, and views that fail to sample, are listed with no fields.
 */
export async function scanScope(
  client: MongoClient,
  scope: ScopeEntry[] | undefined
): Promise<Array<{ name: string; collections: CollectionSchema[] }>> {
  const sources = await listSources(client);
  const out: Array<{ name: string; collections: CollectionSchema[] }> = [];
  let scanned = 0;

  for (const src of sources) {
    if (!isInScope(scope, src.name)) continue;
    const db = client.db(src.name);
    const collections: CollectionSchema[] = [];
    for (const c of src.collections) {
      if (!isInScope(scope, src.name, c.name)) continue;
      const isView = c.type === "view";
      if (scanned >= MAX_COLLECTIONS_PER_SCAN) {
        collections.push({ name: c.name, count: isView ? null : c.count ?? 0, fields: [], indexes: [] });
        continue;
      }
      scanned++;
      if (isView) {
        const view = await scanCollection(db, c.name, null, { view: true }).catch(
          (): CollectionSchema => ({ name: c.name, count: null, fields: [], indexes: [], type: "view" })
        );
        collections.push(view);
      } else {
        collections.push(await scanCollection(db, c.name, c.count ?? 0));
      }
    }
    out.push({ name: src.name, collections });
  }
  return out;
}
