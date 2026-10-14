import type { Request, Response } from "express";
import { Chat, Connection } from "@wup/models";
import {
  BridgeError,
  UnsafeHostError,
  assertPublicMongoUri,
  createSampleBridge,
  cryptoService,
  describeMongoError,
  detectSensitiveFields,
  fetchSpreadsheetMeta,
  getServiceAccountEmail,
  isMongoUri,
  isSheetsConfigured,
  listSources,
  parseSpreadsheetId,
  releasePooledClient,
  scanCollection,
  scanConnection,
  testSheets,
  withTempClient,
  type SourceDb,
} from "@wup/brain";
import type { ErrorCode } from "@wup/contracts";
import { HttpError } from "../lib/httpError";

/**
 * Data bridges (MongoDB and Google Sheets).
 *
 * Responses keep every field the current web client reads (`_id`, `name` in
 * schema and test results) and add the @wup/contracts fields alongside
 * (`id`, `isSystem`, `sheets`, `db`).
 */

const userIdOf = (req: Request) => (req as any).user.id as string;

const COMING_SOON = "PostgreSQL and Supabase are coming soon";
const NOT_MONGO_URL = "That doesn't look like a MongoDB URL. It should start with mongodb:// or mongodb+srv://";
const SYSTEM_READ_ONLY = "The sample bridge is read-only. You can rename or remove it, but not change what it shares.";

const TEST_BUDGET_MS = 20_000;
const PROBE_MAX_COLLECTIONS = 10;
const PROBE_CONCURRENCY = 3;

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : null);

/** Public shape of a connection: never includes the encrypted config. */
export function toPublic(conn: any) {
  const dbs = conn.schemaCache?.dbs ?? [];
  const sheetsCache = conn.sheetsCache;
  return {
    id: String(conn._id),
    _id: conn._id,
    name: conn.name,
    type: conn.type,
    isSystem: conn.isSystem === true,
    scope: conn.scope ?? [],
    redactedFields: conn.redactedFields ?? {},
    suggestions: conn.suggestions ?? [],
    status: conn.metadata?.status ?? "active",
    lastError: conn.metadata?.lastError ?? null,
    lastScannedAt: iso(conn.schemaCache?.scannedAt ?? (conn.type === "sheets" ? sheetsCache?.fetchedAt : null)),
    lastUsedAt: iso(conn.metadata?.lastUsedAt),
    stats: {
      databases: dbs.length,
      collections: dbs.reduce((n: number, d: any) => n + (d.collections?.length ?? 0), 0),
    },
    sheets:
      conn.type === "sheets" && sheetsCache
        ? {
            title: sheetsCache.title ?? "",
            tabs: (sheetsCache.tabs ?? []).map((t: any) => ({
              name: t.name,
              rows: t.rows ?? 0,
              cols: t.cols ?? 0,
              headers: t.headers ?? [],
            })),
          }
        : null,
    createdAt: conn.createdAt,
  };
}

/** Collection summary with counts and fields (no sample values) for the details drawer. */
function toSchemaSummary(conn: any) {
  return (conn.schemaCache?.dbs ?? []).map((d: any) => ({
    db: d.name,
    name: d.name,
    collections: (d.collections ?? []).map((c: any) => ({
      name: c.name,
      count: typeof c.count === "number" ? c.count : null,
      fields: (c.fields ?? []).map((f: any) => ({ path: f.path, types: f.types, pct: f.pct })),
    })),
  }));
}

/** Maps a brain BridgeError (Sheets) to an HttpError. */
function fromBridgeError(err: BridgeError): HttpError {
  return new HttpError(err.status, err.code as ErrorCode, err.message);
}

/**
 * SSRF guard: throws 400 if the URI points at a private, loopback, link-local
 * or otherwise internal host (or at wuup's own database).
 */
async function assertPublicHost(uri: string): Promise<void> {
  try {
    await assertPublicMongoUri(uri);
  } catch (err) {
    if (err instanceof UnsafeHostError) throw new HttpError(400, "BRIDGE_BLOCKED_HOST", err.message);
    // Unparseable URI and similar: the driver would fail anyway, so refuse here
    throw new HttpError(400, "VALIDATION_FAILED", "That doesn't look like a valid MongoDB URL. Check the hosts in your connection string.");
  }
}

function assertSupportedType(type: unknown): asserts type is "mongodb" | "sheets" {
  if (type === "postgresql" || type === "supabase") throw HttpError.badRequest(COMING_SOON);
  if (type !== "mongodb" && type !== "sheets") throw HttpError.badRequest("Bridges currently support MongoDB and Google Sheets");
}

/** Rejects with a 400 once `ms` has passed, so a slow cluster can't hold the request. */
function withBudget<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HttpError(400, "BRIDGE_UNREACHABLE", message)), ms);
  });
  work.catch(() => {}); // the loser of the race must not become an unhandled rejection
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Runs fn over items with at most `limit` in flight. Stops starting new work after `deadline`. */
async function mapLimit<T>(items: T[], limit: number, deadline: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Quick sensitive-field probe on the largest collections so the user can review redactions up front. */
async function testMongo(uri: string) {
  const deadline = Date.now() + TEST_BUDGET_MS - 3000;
  return withTempClient(uri, async (client) => {
    const databases: SourceDb[] = await listSources(client);
    const sensitive: Record<string, string[]> = {};
    const candidates = databases
      .flatMap((d) => d.collections.filter((c) => c.type === "collection").map((c) => ({ db: d.name, ...c })))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, PROBE_MAX_COLLECTIONS);
    await mapLimit(candidates, PROBE_CONCURRENCY, deadline, async (c) => {
      const schema = await scanCollection(client.db(c.db), c.name, c.count ?? 0).catch(() => null);
      const found = schema ? detectSensitiveFields(schema.fields) : [];
      if (found.length > 0) sensitive[`${c.db}.${c.name}`] = found;
    });
    return {
      ok: true as const,
      type: "mongodb" as const,
      databases: databases.map((d) => ({ db: d.name, name: d.name, collections: d.collections })),
      sensitive,
      defaultDb: client.db().databaseName,
    };
  });
}

async function sheetsMetaOrThrow(config: string) {
  try {
    return await testSheets(config);
  } catch (err) {
    if (err instanceof BridgeError) throw fromBridgeError(err);
    throw err;
  }
}

/**
 * POST /connections/test
 * Connects without saving. MongoDB: databases, collections and detected
 * sensitive fields. Sheets: spreadsheet title and tabs.
 */
export const testConnection = async (req: Request, res: Response) => {
  const { type, config } = req.body ?? {};
  assertSupportedType(type);
  if (typeof config !== "string" || !config.trim()) throw HttpError.badRequest("Connection URL is required");
  const value = config.trim();

  if (type === "sheets") {
    const result = await withBudget(sheetsMetaOrThrow(value), TEST_BUDGET_MS, "Google Sheets took too long to answer. Try again.");
    return res.json(result);
  }

  if (!isMongoUri(value)) throw HttpError.badRequest(NOT_MONGO_URL);
  await assertPublicHost(value);
  try {
    const result = await withBudget(
      testMongo(value),
      TEST_BUDGET_MS,
      "The cluster took longer than 20 seconds to answer. Check Network Access and try again."
    );
    res.json(result);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "BRIDGE_UNREACHABLE", describeMongoError(err));
  }
};

/** POST /connections */
export const createConnection = async (req: Request, res: Response) => {
  const { name, type, config, scope, redactedFields } = req.body ?? {};
  const userId = userIdOf(req);
  assertSupportedType(type);
  const rawConfig = typeof config === "string" ? config.trim() : JSON.stringify(config);

  let sheetsCache: Record<string, unknown> | undefined;
  if (type === "mongodb") {
    // Verify MongoDB URLs before saving so broken bridges never reach the AI
    if (!isMongoUri(rawConfig)) throw HttpError.badRequest(NOT_MONGO_URL);
    await assertPublicHost(rawConfig);
    try {
      await withBudget(
        withTempClient(rawConfig, (client) => client.db().admin().ping()),
        TEST_BUDGET_MS,
        "The cluster took longer than 20 seconds to answer. Check Network Access and try again."
      );
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, "BRIDGE_UNREACHABLE", describeMongoError(err));
    }
  } else {
    const meta = await withBudget(sheetsMetaOrThrow(rawConfig), TEST_BUDGET_MS, "Google Sheets took too long to answer. Try again.");
    sheetsCache = { title: meta.title, tabs: meta.tabs, fetchedAt: new Date() };
  }

  let connection: any;
  try {
    connection = await Connection.create({
      userId,
      name,
      type,
      config: cryptoService.encrypt(rawConfig),
      scope: type === "mongodb" && Array.isArray(scope) ? scope : [],
      redactedFields: type === "mongodb" && redactedFields && typeof redactedFields === "object" ? redactedFields : {},
      ...(sheetsCache && { sheetsCache }),
      metadata: { status: type === "mongodb" ? "scanning" : "active", ...(sheetsCache && { lastSynced: new Date() }) },
    });
  } catch (err: any) {
    if (err?.code === 11000) throw HttpError.conflict(`You already have a bridge named "${name}". Pick another name.`);
    throw err;
  }

  res.status(201).json({
    message: "Connection bridged successfully",
    id: String(connection._id),
    name: connection.name,
    type: connection.type,
    connection: toPublic(connection),
  });

  // Schema scan + suggestions run in the background; the UI polls GET /connections/:id
  if (type === "mongodb") {
    scanConnection(String(connection._id)).catch((err) =>
      console.error("[WUP API] Unexpected scan escape:", describeMongoError(err))
    );
  }
};

/** GET /connections */
export const getConnections = async (req: Request, res: Response) => {
  const connections = await Connection.find({ userId: userIdOf(req) }).select("-config").sort({ createdAt: -1 }).lean();
  res.json(connections.map(toPublic));
};

/** GET /connections/:id */
export const getConnection = async (req: Request, res: Response) => {
  const conn = await Connection.findOne({ _id: req.params.id, userId: userIdOf(req) }).select("-config").lean();
  if (!conn) throw HttpError.notFound("Connection not found");
  res.json({ ...toPublic(conn), schema: toSchemaSummary(conn) });
};

/**
 * PATCH /connections/:id
 * Rename, change scope, or edit hidden fields. Changing a MongoDB bridge's
 * scope triggers a re-scan. System bridges can only be renamed.
 */
export const updateConnection = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  const { name, scope, redactedFields } = req.body ?? {};

  const conn: any = await Connection.findOne({ _id: req.params.id, userId }).select("-config").lean();
  if (!conn) throw HttpError.notFound("Connection not found");

  const scopeChanged = Array.isArray(scope) && JSON.stringify(scope) !== JSON.stringify(conn.scope ?? []);
  const redactionsGiven = redactedFields && typeof redactedFields === "object";
  if (conn.isSystem && (scopeChanged || redactionsGiven)) throw HttpError.forbidden(SYSTEM_READ_ONLY);

  const $set: Record<string, unknown> = {};
  const update: Record<string, unknown> = { $set };
  if (typeof name === "string" && name.trim()) $set.name = name.trim();
  if (redactionsGiven) {
    $set.redactedFields = redactedFields;
    update.$inc = { redactionsVersion: 1 };
  }
  const rescan = scopeChanged && conn.type === "mongodb";
  if (scopeChanged) $set.scope = scope;
  if (rescan) $set["metadata.status"] = "scanning";

  let updated: any = conn;
  if (Object.keys($set).length > 0) {
    try {
      updated = await Connection.findOneAndUpdate({ _id: conn._id, userId }, update, { new: true })
        .select("-config")
        .lean();
    } catch (err: any) {
      if (err?.code === 11000) throw HttpError.conflict(`You already have a bridge named "${name}".`);
      throw err;
    }
    if (!updated) throw HttpError.notFound("Connection not found");
  }

  res.json(toPublic(updated));

  if (rescan) scanConnection(String(conn._id)).catch(() => {});
};

/** Refetches a Sheets bridge's title and tabs into sheetsCache. Never throws. */
async function refreshSheets(id: unknown) {
  try {
    const conn: any = await Connection.findById(id);
    if (!conn) return;
    const spreadsheetId = parseSpreadsheetId(cryptoService.decrypt(conn.config));
    if (!spreadsheetId) throw new BridgeError("VALIDATION_FAILED", "This bridge doesn't have a valid Google Sheets link.");
    const meta = await fetchSpreadsheetMeta(spreadsheetId);
    await Connection.updateOne(
      { _id: conn._id },
      {
        $set: {
          sheetsCache: { title: meta.title, tabs: meta.tabs, fetchedAt: new Date() },
          "metadata.status": "active",
          "metadata.lastSynced": new Date(),
          "metadata.lastError": null,
        },
      }
    );
  } catch (err) {
    const message = err instanceof BridgeError ? err.message : "Couldn't refresh this spreadsheet. Try again.";
    await Connection.updateOne({ _id: id }, { $set: { "metadata.status": "error", "metadata.lastError": message } }).catch(() => {});
  }
}

/** POST /connections/:id/refresh: re-scan schema (MongoDB) or refetch tabs (Sheets) in the background. */
export const refreshConnection = async (req: Request, res: Response) => {
  const conn: any = await Connection.findOne({ _id: req.params.id, userId: userIdOf(req) }).select("-config").lean();
  if (!conn) throw HttpError.notFound("Connection not found");
  if (conn.isSystem) throw HttpError.forbidden("The sample bridge is refreshed automatically.");
  if (conn.type !== "mongodb" && conn.type !== "sheets") throw HttpError.badRequest(COMING_SOON);

  await Connection.updateOne({ _id: conn._id }, { $set: { "metadata.status": "scanning" } });
  res.status(202).json({ status: "scanning" });

  if (conn.type === "sheets") refreshSheets(conn._id);
  else scanConnection(String(conn._id)).catch(() => {});
};

/** DELETE /connections/:id. System bridges belong to the user too, so they can be removed. */
export const deleteConnection = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  const connection: any = await Connection.findOneAndDelete({ _id: req.params.id, userId });
  if (!connection) throw HttpError.notFound("Connection not found");
  // System bridges share one pooled client (keyed by URI hash) across users
  if (!connection.isSystem) releasePooledClient(String(connection._id));
  await Chat.updateMany({ userId }, { $pull: { bridgeIds: connection._id } });
  res.json({ message: "Connection removed successfully" });
};

/** GET /connections/sheets/service-account: the email users share sheets with. */
export const getSheetsServiceAccount = async (_req: Request, res: Response) => {
  const email = getServiceAccountEmail();
  res.json({ enabled: isSheetsConfigured(), email });
};

/** POST /connections/sample: adds the read-only sample bridge for this user. */
export const createSampleConnection = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (await Connection.exists({ userId, isSystem: true })) {
    throw HttpError.conflict("You already have the sample bridge.");
  }
  let conn: any;
  try {
    conn = await createSampleBridge(userId);
  } catch (err: any) {
    if (err?.code === 11000) throw HttpError.conflict("You already have a bridge with the sample bridge's name.");
    console.error("[WUP API] Sample bridge failed:", describeMongoError(err));
    throw new HttpError(503, "BRIDGE_UNREACHABLE", "The sample data isn't available right now. Try again in a minute.");
  }
  if (!conn) throw HttpError.notFound("Sample data isn't available on this server.");
  res.status(201).json({ connection: toPublic(conn) });
};
