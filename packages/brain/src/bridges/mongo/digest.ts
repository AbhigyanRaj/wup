import { isInScope, type ScopeEntry } from "./guard";
import { hiddenLeavesForDb, leafOf, type RedactionMap } from "./redact";

/**
 * Builds the compact "what data is available" block injected into the system
 * prompt, so the model uses real field names instead of guessing.
 */

const MAX_FIELDS_PER_COLLECTION = 15;
const MAX_SHEET_TABS = 20;
const MAX_SHEET_HEADERS = 20;
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
      collections: Array<DigestCollection>;
    }>;
  };
  /** Google Sheets bridges: spreadsheet title and tab shapes. */
  sheetsCache?: {
    title?: string;
    tabs?: Array<{ name: string; rows?: number; cols?: number; headers?: string[] }>;
  } | null;
  metadata?: { status?: string };
}

interface DigestCollection {
  name: string;
  count: number | null;
  fields: Array<{ path: string; types: string[] }>;
}

const fmtCount = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toLocaleString("en-US")} docs` : "view";

function describeCollection(db: string, coll: DigestCollection, hidden: Set<string>, withFields: boolean): string {
  const head = `  ${db}.${coll.name} (${fmtCount(coll.count)})`;
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
  if (c.type === "sheets") return describeSheets(c, header, withFields);
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

/** Sheets bridges: one line per tab with its size and header row. */
function describeSheets(c: DigestConnection, header: string, withHeaders: boolean): string {
  const cache = c.sheetsCache;
  const tabs = cache?.tabs ?? [];
  if (tabs.length === 0) return `${header}\n  (tabs not loaded yet; call get_sheets_metadata, then read_sheets)`;
  const lines = [cache?.title ? `${header} | Spreadsheet: ${cache.title}` : header];
  for (const tab of tabs.slice(0, MAX_SHEET_TABS)) {
    const size = `${tab.rows ?? 0} rows x ${tab.cols ?? 0} cols`;
    const headers = (tab.headers ?? []).filter((h) => h && h.trim()).slice(0, MAX_SHEET_HEADERS);
    lines.push(
      withHeaders && headers.length > 0
        ? `  tab "${tab.name}" (${size}): ${headers.join(", ")}`
        : `  tab "${tab.name}" (${size})`
    );
  }
  if (tabs.length > MAX_SHEET_TABS) lines.push(`  ...and ${tabs.length - MAX_SHEET_TABS} more tabs (call get_sheets_metadata)`);
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
