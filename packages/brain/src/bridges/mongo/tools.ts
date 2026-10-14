import mongoose from "mongoose";
import { Connection } from "@wup/models";
import { cryptoService } from "../../utils/crypto";
import type { ToolContext } from "../../tools/types";
import type { MongoClient } from "mongodb";
import { systemPoolKey, withPooledClient } from "./clientPool";
import { describeMongoError } from "./errors";
import {
  GuardError,
  assertFieldPathAllowed,
  assertInScope,
  assertSafeFilter,
  assertSafePipeline,
  assertSafeProjection,
  assertSafeSort,
  hitsHidden,
  isInScope,
  type ScopeEntry,
} from "./guard";
import { recordDataQuery } from "../shared";
import { listSources } from "./introspect";
import { hiddenLeavesForDb, redactValue, redactionKey, type RedactionMap } from "./redact";
import { parseEjsonArg, toDisplayEjson, toPlain } from "./values";

// SSRF guard for bridge URIs. Re-exported here so it is part of the public
// @wup/brain surface (this module is re-exported by ./index).
export {
  UNREACHABLE_HOST_MESSAGE,
  UNRESOLVABLE_HOST_MESSAGE,
  UnsafeHostError,
  assertPublicMongoUri,
  extractMongoHosts,
  isBlockedAddress,
  type HostResolvers,
} from "../net/ssrf";

/**
 * Read-only MongoDB tools exposed to the model.
 *
 * Every call: ownership check → scope check → privacy/read-only guard →
 * run with limits → convert to plain JSON → redact → cap size → record.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const QUERY_TIMEOUT_MS = 10000;
export const MAX_RESULT_BYTES = 50 * 1024;
const MAX_DISTINCT_VALUES = 200;

interface LoadedBridge {
  id: string;
  name: string;
  uri: string;
  isSystem: boolean;
  scope: ScopeEntry[];
  redactions: RedactionMap;
  schemaCache?: any;
}

/** Loads a bridge the current user owns and is allowed to use in this chat. */
export async function loadMongoBridge(ctx: ToolContext, connectionId: string): Promise<LoadedBridge> {
  if (!connectionId || !mongoose.isValidObjectId(connectionId)) {
    throw new GuardError("Unknown connectionId. Use one of the connectionIds listed under ACTIVE DB BRIDGES.");
  }
  if (ctx.allowedConnectionIds?.length && !ctx.allowedConnectionIds.includes(String(connectionId))) {
    throw new GuardError("That bridge isn't enabled for this chat.");
  }
  const conn: any = await Connection.findOne({ _id: connectionId, userId: ctx.userId });
  if (!conn) throw new GuardError("Connection not found.");
  if (conn.type !== "mongodb") throw new GuardError("That connection is not a MongoDB bridge.");

  Connection.updateOne({ _id: conn._id }, { $set: { "metadata.lastUsedAt": new Date() } }).catch(() => {});

  return {
    id: String(conn._id),
    name: conn.name,
    uri: cryptoService.decrypt(conn.config),
    isSystem: conn.isSystem === true,
    scope: (conn.scope ?? []).map((s: any) => ({ db: s.db, collections: s.collections ?? ["*"] })),
    redactions: conn.redactedFields ?? {},
    schemaCache: conn.schemaCache,
  };
}

/** Clamps a row list to the byte budget, returning how many rows fit. */
export function capRows(rows: any[], maxBytes = MAX_RESULT_BYTES): { rows: any[]; truncated: boolean } {
  let size = 2;
  const kept: any[] = [];
  for (const row of rows) {
    const rowSize = JSON.stringify(row).length + 1;
    if (size + rowSize > maxBytes) return { rows: kept, truncated: true };
    size += rowSize;
    kept.push(row);
  }
  return { rows: kept, truncated: false };
}

export const clampLimit = (limit: unknown) => {
  const n = Number(limit);
  return Math.max(1, Math.min(Math.floor(n) || DEFAULT_LIMIT, MAX_LIMIT));
};

/** Runs fn with this bridge's pooled client (system bridges share one client across users). */
export function withBridgeClient<T>(bridge: LoadedBridge, fn: (client: MongoClient) => Promise<T>): Promise<T> {
  const key = bridge.isSystem ? systemPoolKey(bridge.uri) : bridge.id;
  return withPooledClient(key, bridge.uri, fn, { system: bridge.isSystem });
}

/** Parses a filter argument and insists on a plain object (not an array, string, number, ObjectId…). */
export function parseFilterArg(value: unknown): Record<string, any> {
  const filter = parseEjsonArg<unknown>(value, {});
  const proto = filter !== null && typeof filter === "object" ? Object.getPrototypeOf(filter) : undefined;
  if (
    filter === null ||
    typeof filter !== "object" ||
    Array.isArray(filter) ||
    (filter as any)._bsontype ||
    (proto !== Object.prototype && proto !== null)
  ) {
    throw new GuardError('filter must be a JSON object, e.g. {"year":{"$gte":2000}}. Omit it to match all documents.');
  }
  return filter as Record<string, any>;
}

type Runner = (bridge: LoadedBridge, hidden: Set<string>) => Promise<{
  result: Record<string, any>;
  rows?: any[];
  queryForDisplay: unknown;
  rowCount: number;
  truncated: boolean;
}>;

/** Shared wrapper: loads the bridge, enforces scope, times, records and turns errors into tool results. */
async function runQuery(tool: string, args: any, ctx: ToolContext, runner: Runner) {
  const started = Date.now();
  const db = String(args?.db ?? "");
  const collection = String(args?.collection ?? "");
  let bridge: LoadedBridge | undefined;

  try {
    bridge = await loadMongoBridge(ctx, args?.connectionId);
    assertInScope(bridge.scope, db, collection);
    ctx.onStatus?.(`Querying ${db}.${collection}...`);

    const hidden = hiddenLeavesForDb(bridge.redactions, db);
    const out = await runner(bridge, hidden);

    const citation = recordDataQuery(
      ctx,
      {
        tool,
        connectionName: bridge.name,
        db,
        collection,
        query: toDisplayEjson(out.queryForDisplay),
        rowCount: out.rowCount,
        truncated: out.truncated,
        durationMs: Date.now() - started,
      },
      out.rows
    );
    const hiddenHere = bridge.redactions[redactionKey(db, collection)] ?? [];
    return {
      success: true,
      db,
      collection,
      ...out.result,
      // Lets the model say "hidden for privacy" instead of "doesn't exist"
      ...(hiddenHere.length > 0 && { hiddenFields: hiddenHere }),
      ...(citation !== undefined && { citation }),
    };
  } catch (err) {
    const message = err instanceof GuardError ? err.message : describeMongoError(err);
    if (bridge) {
      recordDataQuery(ctx, {
        tool,
        connectionName: bridge.name,
        db,
        collection,
        query: toDisplayEjson(args ?? {}),
        rowCount: 0,
        truncated: false,
        durationMs: Date.now() - started,
        error: message,
      });
    }
    return { success: false, error: message };
  }
}

/** Runs fn against one collection through the bridge's pooled client. */
function withCollection<T>(
  bridge: LoadedBridge,
  db: string,
  collection: string,
  fn: (coll: ReturnType<ReturnType<MongoClient["db"]>["collection"]>) => Promise<T>
): Promise<T> {
  return withBridgeClient(bridge, (client) => fn(client.db(db).collection(collection)));
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export async function mongo_list_sources(args: any, ctx: ToolContext) {
  try {
    const bridge = await loadMongoBridge(ctx, args?.connectionId);
    const cached = bridge.schemaCache?.dbs;
    if (cached?.length) {
      return {
        success: true,
        databases: cached
          .filter((d: any) => isInScope(bridge.scope, d.name))
          .map((d: any) => ({
            db: d.name,
            collections: d.collections
              .filter((c: any) => isInScope(bridge.scope, d.name, c.name))
              .map((c: any) => ({ name: c.name, count: c.count })),
          })),
      };
    }
    const sources = await withBridgeClient(bridge, (client) => listSources(client));
    return {
      success: true,
      databases: sources
        .filter((d) => isInScope(bridge.scope, d.name))
        .map((d) => ({
          db: d.name,
          collections: d.collections
            .filter((c) => isInScope(bridge.scope, d.name, c.name))
            .map((c) => ({ name: c.name, count: c.count })),
        })),
    };
  } catch (err) {
    return { success: false, error: err instanceof GuardError ? err.message : describeMongoError(err) };
  }
}

export async function mongo_describe(args: any, ctx: ToolContext) {
  return runQuery("mongo_describe", args, ctx, async (bridge, hidden) => {
    const { db, collection } = args;
    const cachedDb = bridge.schemaCache?.dbs?.find((d: any) => d.name === db);
    const cached = cachedDb?.collections?.find((c: any) => c.name === collection);
    const hiddenPaths: string[] = bridge.redactions[redactionKey(db, collection)] ?? [];

    // Hidden top-level fields never leave the server, not even to be stripped here
    const exclude: Record<string, 0> = {};
    for (const leaf of hidden) if (leaf && !leaf.includes(".") && !leaf.startsWith("$")) exclude[leaf] = 0;
    const projection = Object.keys(exclude).length > 0 ? exclude : undefined;
    const samples = await withCollection(bridge, db, collection, (coll) =>
      coll.find({}, { limit: 3, maxTimeMS: QUERY_TIMEOUT_MS, ...(projection && { projection }) }).toArray()
    );

    const fields = (cached?.fields ?? [])
      .filter((f: any) => hitsHidden(String(f.path), hidden) === undefined)
      .map((f: any) => ({ path: f.path, types: f.types, presentInPct: f.pct }));

    return {
      result: {
        count: cached?.count,
        fields,
        indexes: cached?.indexes ?? [],
        hiddenFields: hiddenPaths,
        sampleDocuments: redactValue(samples.map((d) => toPlain(d)), hidden),
      },
      queryForDisplay: { describe: `${db}.${collection}` },
      rowCount: samples.length,
      truncated: false,
    };
  });
}

export async function mongo_find(args: any, ctx: ToolContext) {
  return runQuery("mongo_find", args, ctx, async (bridge, hidden) => {
    const filter = parseFilterArg(args.filter);
    const projection = parseEjsonArg<Record<string, any> | undefined>(args.projection, undefined);
    const sort = parseEjsonArg<Record<string, any> | undefined>(args.sort, undefined);
    const limit = clampLimit(args.limit);
    const guardOpts = { hidden, scope: bridge.scope, db: args.db };
    assertSafeFilter(filter, guardOpts);
    if (projection) assertSafeProjection(projection, guardOpts);
    if (sort) assertSafeSort(sort, guardOpts);

    const docs = await withCollection(bridge, args.db, args.collection, (coll) =>
      coll.find(filter, { projection, sort, limit, maxTimeMS: QUERY_TIMEOUT_MS }).toArray()
    );

    const plain = redactValue(docs.map((d) => toPlain(d)), hidden);
    const capped = capRows(plain);
    return {
      result: { rows: capped.rows, returned: capped.rows.length, truncated: capped.truncated, limit },
      rows: capped.rows,
      queryForDisplay: { find: args.collection, filter, ...(projection && { projection }), ...(sort && { sort }), limit },
      rowCount: capped.rows.length,
      truncated: capped.truncated || docs.length === limit,
    };
  });
}

export async function mongo_count(args: any, ctx: ToolContext) {
  return runQuery("mongo_count", args, ctx, async (bridge, hidden) => {
    const filter = parseFilterArg(args.filter);
    assertSafeFilter(filter, { hidden, scope: bridge.scope, db: args.db });
    const count = await withCollection(bridge, args.db, args.collection, (coll) =>
      Object.keys(filter).length === 0
        ? coll.estimatedDocumentCount({ maxTimeMS: QUERY_TIMEOUT_MS })
        : coll.countDocuments(filter, { maxTimeMS: QUERY_TIMEOUT_MS })
    );
    return {
      result: { count },
      queryForDisplay: { count: args.collection, filter },
      rowCount: 1,
      truncated: false,
    };
  });
}

export async function mongo_distinct(args: any, ctx: ToolContext) {
  return runQuery("mongo_distinct", args, ctx, async (bridge, hidden) => {
    const field = String(args.field ?? "");
    if (!field) throw new GuardError("field is required.");
    assertFieldPathAllowed(field, hidden);
    const filter = parseFilterArg(args.filter);
    assertSafeFilter(filter, { hidden, scope: bridge.scope, db: args.db });

    const values = await withCollection(bridge, args.db, args.collection, (coll) =>
      coll.distinct(field, filter, { maxTimeMS: QUERY_TIMEOUT_MS })
    );
    const truncated = values.length > MAX_DISTINCT_VALUES;
    // Distinct values can be sub-documents that contain hidden fields
    const plainValues = redactValue(values.slice(0, MAX_DISTINCT_VALUES).map((v) => toPlain(v)), hidden);
    return {
      result: { values: plainValues, totalDistinct: values.length, truncated },
      rows: plainValues.map((v) => ({ [field]: v })),
      queryForDisplay: { distinct: args.collection, field, filter },
      rowCount: plainValues.length,
      truncated,
    };
  });
}

export async function mongo_aggregate(args: any, ctx: ToolContext) {
  return runQuery("mongo_aggregate", args, ctx, async (bridge, hidden) => {
    const pipeline = parseEjsonArg<any[]>(args.pipeline, []);
    if (!Array.isArray(pipeline)) throw new GuardError("pipeline must be a JSON array of stages.");
    assertSafePipeline(pipeline, { hidden, scope: bridge.scope, db: args.db });
    const limit = clampLimit(args.limit);

    const docs = await withCollection(bridge, args.db, args.collection, (coll) =>
      coll.aggregate([...pipeline, { $limit: limit }], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray()
    );

    const plain = redactValue(docs.map((d) => toPlain(d)), hidden);
    const capped = capRows(plain);
    return {
      result: { rows: capped.rows, returned: capped.rows.length, truncated: capped.truncated, limit },
      rows: capped.rows,
      queryForDisplay: { aggregate: args.collection, pipeline },
      rowCount: capped.rows.length,
      truncated: capped.truncated || docs.length === limit,
    };
  });
}

export const MONGO_TOOLS = {
  mongo_list_sources,
  mongo_describe,
  mongo_find,
  mongo_count,
  mongo_distinct,
  mongo_aggregate,
};

const connectionIdParam = { type: "STRING", description: "The connectionId of the MongoDB bridge (from ACTIVE DB BRIDGES)." };
const dbParam = { type: "STRING", description: "Database name, e.g. sample_mflix." };
const collectionParam = { type: "STRING", description: "Collection name." };
const filterParam = {
  type: "STRING",
  description:
    'MongoDB filter as an Extended JSON string, e.g. {"year":{"$gte":2000}}. Use {"$oid":"..."} for ObjectIds and {"$date":"2024-01-01T00:00:00Z"} for dates. Omit for all documents.',
};

/** Gemini function declarations for the MongoDB tools. */
export const MONGO_TOOL_DECLARATIONS = [
  {
    name: "mongo_list_sources",
    description: "Lists the databases and collections (with document counts) this MongoDB bridge may query.",
    parameters: { type: "OBJECT", properties: { connectionId: connectionIdParam }, required: ["connectionId"] },
  },
  {
    name: "mongo_describe",
    description:
      "Describes one collection: field paths with types and how often they appear, indexes, hidden fields, and 3 sample documents. Call this before querying a collection you haven't seen.",
    parameters: {
      type: "OBJECT",
      properties: { connectionId: connectionIdParam, db: dbParam, collection: collectionParam },
      required: ["connectionId", "db", "collection"],
    },
  },
  {
    name: "mongo_find",
    description: `Reads documents from a collection. Returns at most ${MAX_LIMIT} documents (default ${DEFAULT_LIMIT}). Use for listing or looking up records.`,
    parameters: {
      type: "OBJECT",
      properties: {
        connectionId: connectionIdParam,
        db: dbParam,
        collection: collectionParam,
        filter: filterParam,
        projection: { type: "STRING", description: 'Fields to return as a JSON string, e.g. {"title":1,"year":1,"_id":0}.' },
        sort: { type: "STRING", description: 'Sort as a JSON string, e.g. {"year":-1}.' },
        limit: { type: "NUMBER", description: `Max documents to return (1-${MAX_LIMIT}).` },
      },
      required: ["connectionId", "db", "collection"],
    },
  },
  {
    name: "mongo_count",
    description: "Counts documents matching a filter. Use for any 'how many' question.",
    parameters: {
      type: "OBJECT",
      properties: { connectionId: connectionIdParam, db: dbParam, collection: collectionParam, filter: filterParam },
      required: ["connectionId", "db", "collection"],
    },
  },
  {
    name: "mongo_distinct",
    description: "Returns the distinct values of a field (up to 200), optionally filtered.",
    parameters: {
      type: "OBJECT",
      properties: {
        connectionId: connectionIdParam,
        db: dbParam,
        collection: collectionParam,
        field: { type: "STRING", description: "Field path, e.g. genres or imdb.rating." },
        filter: filterParam,
      },
      required: ["connectionId", "db", "collection", "field"],
    },
  },
  {
    name: "mongo_aggregate",
    description:
      `Runs a read-only aggregation pipeline. Use for grouping, averages, top-N, joins ($lookup within the same database) and anything analytical. Only read stages are allowed ($match, $group, $sort, $lookup, $facet, $setWindowFields and similar); $out and $merge are blocked. Results are capped at ${MAX_LIMIT} rows.`,
    parameters: {
      type: "OBJECT",
      properties: {
        connectionId: connectionIdParam,
        db: dbParam,
        collection: collectionParam,
        pipeline: {
          type: "STRING",
          description:
            'Pipeline as an Extended JSON array string, e.g. [{"$unwind":"$genres"},{"$group":{"_id":"$genres","count":{"$sum":1}}},{"$sort":{"count":-1}}].',
        },
        limit: { type: "NUMBER", description: `Max rows to return (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).` },
      },
      required: ["connectionId", "db", "collection", "pipeline"],
    },
  },
];
