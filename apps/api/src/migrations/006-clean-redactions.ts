/**
 * Migration 006-clean-redactions
 *
 * Earlier schema scans wrote `[]` into Connection.redactedFields for views and
 * for collections past the scan cap. An empty list reads as "the user chose to
 * hide nothing", so later scans never auto-hid sensitive fields there.
 *
 * For every Connection:
 *   - delete redactedFields keys whose value is [] AND whose schemaCache
 *     collection has no fields (or isn't in the cache at all); a [] on a
 *     collection with known fields is a real user choice and is kept
 *   - set redactionsVersion: 0 where it is missing (rows that already have one
 *     and get cleaned are bumped by 1)
 * Writes are guarded on the redactionsVersion that was read, so an edit made
 * while this runs is never overwritten. Idempotent: a second run finds nothing
 * to change.
 */
import type { Db } from "mongodb";

export const id = "006-clean-redactions";

type Ctx = { db?: Db; log?: { info?: (...a: any[]) => void } } | undefined;

/** Whether the schema cache knows fields for "db.collection". */
export function cachedFieldCount(schemaCache: any, key: string): number {
  const dot = key.indexOf(".");
  if (dot <= 0) return 0;
  const dbName = key.slice(0, dot);
  const collName = key.slice(dot + 1);
  const db = (schemaCache?.dbs ?? []).find((d: any) => d?.name === dbName);
  const coll = (db?.collections ?? []).find((c: any) => c?.name === collName);
  return Array.isArray(coll?.fields) ? coll.fields.length : 0;
}

/** Keys to drop: empty lists for collections the cache has no fields for. */
export function staleEmptyKeys(redactedFields: unknown, schemaCache: unknown): string[] {
  if (!redactedFields || typeof redactedFields !== "object" || Array.isArray(redactedFields)) return [];
  return Object.keys(redactedFields).filter((key) => {
    const value = (redactedFields as Record<string, unknown>)[key];
    return Array.isArray(value) && value.length === 0 && cachedFieldCount(schemaCache, key) === 0;
  });
}

export async function up(ctx?: unknown): Promise<void> {
  const c = ctx as Ctx;
  const log = c?.log ?? console;
  const db = c?.db ?? (await import("mongoose")).default.connection.db;
  if (!db) throw new Error(`${id}: no database handle`);
  const connections = db.collection("connections");

  let cleaned = 0;
  let versioned = 0;
  const cursor = connections.find(
    {},
    { projection: { redactedFields: 1, schemaCache: 1, redactionsVersion: 1 }, batchSize: 200 }
  );

  for await (const doc of cursor) {
    const stale = staleEmptyKeys(doc.redactedFields, doc.schemaCache);
    const missingVersion = typeof doc.redactionsVersion !== "number";
    if (stale.length === 0 && !missingVersion) continue;

    const $set: Record<string, unknown> = {};
    if (stale.length > 0) {
      const next: Record<string, unknown> = {};
      for (const key of Object.keys(doc.redactedFields)) {
        if (!stale.includes(key)) next[key] = doc.redactedFields[key];
      }
      $set.redactedFields = next;
    }
    const update: Record<string, unknown> = { $set };
    if (missingVersion) $set.redactionsVersion = 0;
    // A versioned row gets a bump, so an in-flight scan's guarded write retries on the cleaned map
    else update.$inc = { redactionsVersion: 1 };

    const res = await connections.updateOne(
      // Guarded on what we read: a concurrent edit or scan bumps redactionsVersion
      // (null matches both a missing and a null redactionsVersion)
      { _id: doc._id, redactionsVersion: missingVersion ? null : doc.redactionsVersion },
      update
    );
    if (res.modifiedCount) {
      if (stale.length > 0) cleaned++;
      if (missingVersion) versioned++;
    }
  }

  log.info?.(`[${id}] cleaned empty redactions on ${cleaned} connection(s), set redactionsVersion on ${versioned}`);
}

export default { id, up };
