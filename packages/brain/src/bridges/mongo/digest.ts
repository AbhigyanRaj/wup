import { isInScope, type ScopeEntry } from "./guard";
import { hiddenLeavesForDb, leafOf, type RedactionMap } from "./redact";

/**
 * Builds the compact "what data is available" block injected into the system
 * prompt, so the model uses real field names instead of guessing.
 */

const MAX_FIELDS_PER_COLLECTION = 15;
export const MAX_DIGEST_CHARS = 3500;

export interface DigestConnection {
  _id: unknown;
  name: string;
  type: string;
  scope?: ScopeEntry[];
  redactedFields?: RedactionMap;
  schemaCache?: {
    scannedAt?: Date;
    dbs?: Array<{
      name: string;
      collections: Array<{ name: string; count: number; fields: Array<{ path: string; types: string[] }> }>;
    }>;
  };
  metadata?: { status?: string };
}

const fmtCount = (n: number) => n.toLocaleString("en-US");

function describeCollection(
  db: string,
  coll: { name: string; count: number; fields: Array<{ path: string; types: string[] }> },
  hidden: Set<string>,
  withFields: boolean
): string {
  const head = `  ${db}.${coll.name} (${fmtCount(coll.count)} docs)`;
  if (!withFields || coll.fields.length === 0) return head;
  const fields = coll.fields
    .filter((f) => f.path !== "_id" && !hidden.has(leafOf(f.path)))
    .slice(0, MAX_FIELDS_PER_COLLECTION)
    .map((f) => `${f.path}:${f.types.join("|")}`)
    .join(", ");
  return fields ? `${head}: ${fields}` : head;
}

function describeConnection(c: DigestConnection, withFields: boolean): string {
  const header = `- Bridge: ${c.name} | Type: ${c.type} | connectionId: ${String(c._id)}`;
  if (c.type !== "mongodb") return header;

  const dbs = c.schemaCache?.dbs ?? [];
  if (dbs.length === 0) {
    const status = c.metadata?.status === "scanning" ? "schema scan in progress" : "schema not scanned yet";
    return `${header}\n  (${status}; call mongo_list_sources, then mongo_describe)`;
  }

  const lines = [header];
  for (const db of dbs) {
    if (!isInScope(c.scope, db.name)) continue;
    const hidden = hiddenLeavesForDb(c.redactedFields, db.name);
    for (const coll of db.collections) {
      if (!isInScope(c.scope, db.name, coll.name)) continue;
      lines.push(describeCollection(db.name, coll, hidden, withFields));
    }
  }
  return lines.join("\n");
}

/**
 * Full digest with field lists; falls back to collection names only when the
 * schemas don't fit the budget (the model can still call mongo_describe).
 */
export function buildBridgeDigest(connections: DigestConnection[]): string {
  if (connections.length === 0) return "";
  const full = connections.map((c) => describeConnection(c, true)).join("\n");
  if (full.length <= MAX_DIGEST_CHARS) return full;

  const compact = connections.map((c) => describeConnection(c, false)).join("\n");
  const note = "\n  (field lists omitted for size; call mongo_describe before querying a collection)";
  if (compact.length + note.length <= MAX_DIGEST_CHARS) return compact + note;
  return compact.slice(0, MAX_DIGEST_CHARS) + "\n  …(truncated; call mongo_list_sources for the full list)";
}
