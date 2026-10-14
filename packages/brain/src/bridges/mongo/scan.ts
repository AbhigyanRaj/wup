import { Connection } from "@wup/models";
import { cryptoService } from "../../utils/crypto";
import { getGeminiModel } from "../../ai/gemini";
import { releasePooledClient, withPooledClient } from "./clientPool";
import { buildBridgeDigest, type DigestConnection } from "./digest";
import { describeMongoError } from "./errors";
import { scanScope, type CollectionSchema } from "./introspect";
import { detectSensitiveFields, redactionKey, type RedactionMap } from "./redact";

/**
 * Background job: samples every in-scope collection, stores the schema cache,
 * auto-detects sensitive fields for newly seen collections, and generates
 * starter questions. Never throws; failures are written to metadata.lastError.
 *
 * Redactions are written with optimistic concurrency on redactionsVersion, so
 * an edit the user makes while a scan is running is never lost: the scan
 * reloads, merges (user keys win) and retries.
 */

export interface ScanOptions {
  /**
   * Generates starter questions from the bridge digest. When omitted (or when
   * it fails / returns nothing) the server Gemini key is used if set, then
   * deterministic templates.
   */
  suggest?: (digest: string) => Promise<string[]>;
}

const MAX_WRITE_ATTEMPTS = 3;
export const STUCK_SCAN_MS = 15 * 60 * 1000;
export const SCAN_INTERRUPTED_MESSAGE = "Scan interrupted. Click Refresh";
const SCAN_CONFLICT_MESSAGE = "The bridge changed while it was being scanned. Click Refresh";

export type ScannedDb = { name: string; collections: CollectionSchema[] };

/** Auto-detected redactions for collections the scan actually sampled (fields.length > 0). */
export function autoRedactions(dbs: ScannedDb[]): RedactionMap {
  const out: RedactionMap = {};
  for (const db of dbs) {
    for (const coll of db.collections) {
      if (coll.fields.length === 0) continue; // views that failed, collections past the cap
      out[redactionKey(db.name, coll.name)] = detectSensitiveFields(coll.fields);
    }
  }
  return out;
}

/** User keys win; auto-detected keys only fill collections the user has no entry for. */
export function mergeRedactions(user: RedactionMap | undefined, auto: RedactionMap): RedactionMap {
  const merged: RedactionMap = {};
  for (const [k, v] of Object.entries(auto)) merged[k] = v;
  for (const [k, v] of Object.entries(user ?? {})) if (Array.isArray(v)) merged[k] = v;
  return merged;
}

/** Never keep sample values for hidden fields in the cache. */
export function stripHiddenSamples(dbs: ScannedDb[], redactions: RedactionMap): ScannedDb[] {
  return dbs.map((db) => ({
    name: db.name,
    collections: db.collections.map((coll) => {
      const hidden = new Set(redactions[redactionKey(db.name, coll.name)] ?? []);
      return {
        ...coll,
        fields: coll.fields.map((f) => {
          if (!hidden.has(f.path)) return f;
          const { sample: _drop, ...rest } = f;
          return rest;
        }),
      };
    }),
  }));
}

export async function scanConnection(connectionId: string, opts: ScanOptions = {}): Promise<void> {
  let id: unknown = connectionId;
  try {
    const conn: any = await Connection.findById(connectionId);
    if (!conn || conn.type !== "mongodb" || conn.isSystem) return;
    id = conn._id;

    // Raw driver write: scanStartedAt isn't in the mongoose schema
    await Connection.collection.updateOne(
      { _id: conn._id },
      { $set: { "metadata.status": "scanning", "metadata.scanStartedAt": new Date() } }
    );

    const uri = cryptoService.decrypt(conn.config);
    const key = String(conn._id);
    // Drop any pooled client so a changed URI or scope is picked up fresh
    releasePooledClient(key);
    const scope = (conn.scope ?? []).map((s: any) => ({ db: s.db, collections: s.collections ?? ["*"] }));
    const dbs: ScannedDb[] = await withPooledClient(key, uri, (client) => scanScope(client, scope));
    const auto = autoRedactions(dbs);

    // Suggestions see the provisional redactions so hidden names never reach the LLM
    const provisional = mergeRedactions(conn.redactedFields, auto);
    const suggestions = await generateSuggestions(
      {
        _id: conn._id,
        name: conn.name,
        type: conn.type,
        scope,
        redactedFields: provisional,
        schemaCache: { scannedAt: new Date(), dbs: stripHiddenSamples(dbs, provisional) },
      },
      opts.suggest
    );

    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const fresh: any = await Connection.findById(conn._id).select("redactedFields redactionsVersion").lean();
      if (!fresh) return; // deleted mid-scan
      const version = typeof fresh.redactionsVersion === "number" ? fresh.redactionsVersion : null;
      const redactedFields = mergeRedactions(fresh.redactedFields, auto);
      const res = await Connection.updateOne(
        // null also matches legacy rows with no redactionsVersion
        { _id: conn._id, redactionsVersion: version },
        {
          $set: {
            schemaCache: { scannedAt: new Date(), dbs: stripHiddenSamples(dbs, redactedFields) },
            redactedFields,
            suggestions,
            "metadata.status": "active",
            "metadata.lastSynced": new Date(),
            "metadata.lastError": null,
          },
          $inc: { redactionsVersion: 1 },
        }
      );
      if (res.matchedCount === 1) {
        const total = dbs.reduce((n, d) => n + d.collections.length, 0);
        console.log(`[WUP Bridge] Scanned connection ${conn._id}: ${dbs.length} dbs, ${total} collections`);
        return;
      }
    }
    console.warn(`[WUP Bridge] Scan of ${conn._id} lost the redaction race ${MAX_WRITE_ATTEMPTS} times`);
    await markError(conn._id, SCAN_CONFLICT_MESSAGE);
  } catch (err) {
    const message = describeMongoError(err);
    console.error(`[WUP Bridge] Scan failed for connection ${String(id)}: ${message}`);
    await markError(id, message);
  }
}

async function markError(id: unknown, message: string) {
  try {
    await Connection.updateOne({ _id: id }, { $set: { "metadata.status": "error", "metadata.lastError": message } });
  } catch {
    // never throws
  }
}

/**
 * Marks scans that have been "scanning" for over 15 minutes as errored, so a
 * process restart mid-scan doesn't leave a bridge spinning forever. Call at
 * boot. Returns how many bridges were recovered. Never throws.
 */
export async function recoverStuckScans(now: Date = new Date()): Promise<number> {
  try {
    const cutoff = new Date(now.getTime() - STUCK_SCAN_MS);
    // Raw driver query: scanStartedAt isn't in the mongoose schema, and strictQuery
    // must never be able to drop it from the filter (that would match every scan)
    const res = await Connection.collection.updateMany(
      {
        "metadata.status": "scanning",
        $or: [
          { "metadata.scanStartedAt": { $lt: cutoff } },
          // Rows from before scanStartedAt existed: fall back to the last sync / creation time
          { "metadata.scanStartedAt": { $exists: false }, "metadata.lastSynced": { $lt: cutoff } },
          { "metadata.scanStartedAt": { $exists: false }, "metadata.lastSynced": { $exists: false }, createdAt: { $lt: cutoff } },
        ],
      },
      { $set: { "metadata.status": "error", "metadata.lastError": SCAN_INTERRUPTED_MESSAGE } }
    );
    return res.modifiedCount ?? 0;
  } catch (err) {
    console.error("[WUP Bridge] recoverStuckScans failed:", describeMongoError(err));
    return 0;
  }
}

const SUGGESTION_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

const cleanQuestions = (list: unknown): string[] =>
  Array.isArray(list)
    ? list
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .map((q) => q.trim())
        .slice(0, 6)
    : [];

/** Starter questions: the caller's suggest callback, else the server Gemini key, else templates. */
async function generateSuggestions(
  conn: DigestConnection,
  suggest?: (digest: string) => Promise<string[]>
): Promise<string[]> {
  const digest = buildBridgeDigest([conn]);

  if (suggest) {
    try {
      const questions = cleanQuestions(await suggest(digest));
      if (questions.length > 0) return questions;
    } catch {
      // fall through to the defaults
    }
    return templateSuggestions(conn);
  }

  const prompt =
    "Here is the schema of a user's MongoDB data:\n" +
    digest +
    "\n\nWrite 5 short, specific questions (max 12 words each) a business user would ask about this data, " +
    "mixing counts, top-N rankings, trends over time and comparisons. Use real collection and field meanings, " +
    "not field names in code style. Return ONLY a JSON array of strings.";

  if (!process.env.GEMINI_API_KEY) return templateSuggestions(conn);

  for (const model of SUGGESTION_MODELS) {
    try {
      const res = await getGeminiModel(undefined, undefined, model).generateContent(prompt);
      const match = res.response.text().match(/\[[\s\S]*\]/);
      const questions = cleanQuestions(match ? JSON.parse(match[0]) : null);
      if (questions.length > 0) return questions;
    } catch {
      // try the next model
    }
  }
  return templateSuggestions(conn);
}

/** Exported for tests: deterministic questions when no LLM is available. */
export function templateSuggestions(conn: DigestConnection): string[] {
  const colls = (conn.schemaCache?.dbs ?? [])
    .flatMap((d) => d.collections.map((c) => ({ db: d.name, ...c })))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const out: string[] = [];
  for (const c of colls.slice(0, 3)) {
    out.push(`How many ${c.name} are there?`);
    const dateField = c.fields.find((f) => f.types.includes("date"));
    if (dateField) out.push(`How have ${c.name} grown over time by ${dateField.path}?`);
    else out.push(`Show me 10 sample ${c.name}`);
  }
  return out.slice(0, 5);
}
