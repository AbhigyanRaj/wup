import { Request, Response } from "express";
import { Chat, Connection } from "@wup/models";
import {
  cryptoService,
  describeMongoError,
  detectSensitiveFields,
  isMongoUri,
  listSources,
  releasePooledClient,
  scanCollection,
  scanConnection,
  withTempClient,
} from "@wup/brain";

/**
 * Controller for managing external data connections.
 */

/** Public shape of a connection: never includes the encrypted config. */
function toPublic(conn: any) {
  const dbs = conn.schemaCache?.dbs ?? [];
  return {
    _id: conn._id,
    name: conn.name,
    type: conn.type,
    scope: conn.scope ?? [],
    redactedFields: conn.redactedFields ?? {},
    suggestions: conn.suggestions ?? [],
    status: conn.metadata?.status ?? "active",
    lastError: conn.metadata?.lastError ?? null,
    lastScannedAt: conn.schemaCache?.scannedAt ?? null,
    lastUsedAt: conn.metadata?.lastUsedAt ?? null,
    stats: {
      databases: dbs.length,
      collections: dbs.reduce((n: number, d: any) => n + (d.collections?.length ?? 0), 0),
    },
    createdAt: conn.createdAt,
  };
}

/** Collection summary with counts and fields (no sample values) for the details drawer. */
function toSchemaSummary(conn: any) {
  return (conn.schemaCache?.dbs ?? []).map((d: any) => ({
    name: d.name,
    collections: (d.collections ?? []).map((c: any) => ({
      name: c.name,
      count: c.count,
      fields: (c.fields ?? []).map((f: any) => ({ path: f.path, types: f.types, pct: f.pct })),
    })),
  }));
}

const PROBE_SAMPLE_COLLECTIONS = 30;

/**
 * POST /connections/test
 * Connects without saving and returns databases, collections and detected sensitive fields.
 */
export const testConnection = async (req: Request, res: Response) => {
  const { type, config } = req.body;

  if (type !== "mongodb") {
    return res.status(400).json({ ok: false, error: "Live testing is currently available for MongoDB bridges." });
  }
  if (typeof config !== "string" || !isMongoUri(config)) {
    return res.status(400).json({
      ok: false,
      error: "That doesn't look like a MongoDB URL. It should start with mongodb:// or mongodb+srv://",
    });
  }

  try {
    const result = await withTempClient(config.trim(), async (client) => {
      const databases = await listSources(client);
      // Quick sensitive-field probe on the largest collections so the user can review redactions up front
      const sensitive: Record<string, string[]> = {};
      const candidates = databases
        .flatMap((d) => d.collections.filter((c) => c.type === "collection").map((c) => ({ db: d.name, ...c })))
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, PROBE_SAMPLE_COLLECTIONS);
      for (const c of candidates) {
        const schema = await scanCollection(client.db(c.db), c.name, c.count ?? 0).catch(() => null);
        const found = schema ? detectSensitiveFields(schema.fields) : [];
        if (found.length > 0) sensitive[`${c.db}.${c.name}`] = found;
      }
      return { databases, sensitive, defaultDb: client.db().databaseName };
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: describeMongoError(err) });
  }
};

export const createConnection = async (req: Request, res: Response) => {
  const { name, type, config, scope, redactedFields } = req.body;
  const userId = (req as any).user.id;
  const rawConfig = typeof config === "string" ? config.trim() : JSON.stringify(config);

  try {
    // Verify MongoDB URLs before saving so broken bridges never reach the AI
    if (type === "mongodb") {
      if (!isMongoUri(rawConfig)) {
        return res.status(400).json({
          error: "That doesn't look like a MongoDB URL. It should start with mongodb:// or mongodb+srv://",
        });
      }
      try {
        await withTempClient(rawConfig, (client) => client.db().admin().ping());
      } catch (err) {
        return res.status(400).json({ error: describeMongoError(err) });
      }
    }

    // Encrypt the sensitive configuration before saving
    const encryptedConfig = cryptoService.encrypt(rawConfig);

    const connection: any = await Connection.create({
      userId,
      name,
      type,
      config: encryptedConfig,
      scope: Array.isArray(scope) ? scope : [],
      redactedFields: redactedFields && typeof redactedFields === "object" ? redactedFields : {},
      metadata: { status: type === "mongodb" ? "scanning" : "active" },
    });

    res.status(201).json({
      message: "Connection bridged successfully",
      id: connection._id,
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
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: `You already have a bridge named "${name}". Pick another name.` });
    }
    console.error("[WUP API] Create Connection Error:", describeMongoError(err));
    res.status(500).json({ error: "Failed to create connection" });
  }
};

export const getConnections = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const connections = await Connection.find({ userId }).select("-config").sort({ createdAt: -1 }).lean();
    res.json(connections.map(toPublic));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch connections" });
  }
};

export const getConnection = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const conn = await Connection.findOne({ _id: req.params.id, userId }).select("-config").lean();
    if (!conn) return res.status(404).json({ error: "Connection not found" });
    res.json({ ...toPublic(conn), schema: toSchemaSummary(conn) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch connection" });
  }
};

/**
 * PATCH /connections/:id
 * Rename, change scope, or edit hidden fields. Changing scope triggers a re-scan.
 */
export const updateConnection = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, scope, redactedFields } = req.body;

  try {
    const conn: any = await Connection.findOne({ _id: req.params.id, userId });
    if (!conn) return res.status(404).json({ error: "Connection not found" });

    if (typeof name === "string" && name.trim()) conn.name = name.trim();
    if (redactedFields && typeof redactedFields === "object") {
      conn.redactedFields = redactedFields;
      conn.markModified("redactedFields");
    }
    const scopeChanged = Array.isArray(scope) && JSON.stringify(scope) !== JSON.stringify(conn.scope ?? []);
    if (scopeChanged) {
      conn.scope = scope;
      conn.metadata.status = "scanning";
    }
    await conn.save();

    res.json(toPublic(conn));

    if (scopeChanged && conn.type === "mongodb") {
      scanConnection(String(conn._id)).catch(() => {});
    }
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: `You already have a bridge named "${name}".` });
    }
    res.status(500).json({ error: "Failed to update connection" });
  }
};

/** POST /connections/:id/refresh: re-scan schema in the background. */
export const refreshConnection = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const conn: any = await Connection.findOne({ _id: req.params.id, userId }).select("-config");
    if (!conn) return res.status(404).json({ error: "Connection not found" });
    if (conn.type !== "mongodb") return res.status(400).json({ error: "Only MongoDB bridges can be re-scanned." });

    await Connection.updateOne({ _id: conn._id }, { $set: { "metadata.status": "scanning" } });
    res.status(202).json({ status: "scanning" });
    scanConnection(String(conn._id)).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: "Failed to refresh connection" });
  }
};

export const deleteConnection = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;

  try {
    const connection = await Connection.findOneAndDelete({ _id: id, userId });
    if (!connection) return res.status(404).json({ error: "Connection not found" });
    releasePooledClient(String(connection._id));
    await Chat.updateMany({ userId }, { $pull: { bridgeIds: connection._id } });

    res.json({ message: "Connection removed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete connection" });
  }
};
