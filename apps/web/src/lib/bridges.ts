/**
 * Data bridges (MongoDB and Google Sheets connections): API client, scan
 * polling and the pure helpers the connect wizard and the drawer share.
 */

import type {
  BridgeDetails,
  BridgeSummary,
  CreateConnectionBody,
  CreateConnectionResponse,
  MongoTestResult,
  RedactionMap,
  ScopeEntry,
  SheetsTestResult,
  UpdateConnectionBody,
} from "@/lib/types";
import { api } from "@/lib/api";

export type { BridgeDetails, BridgeSummary, MongoTestResult, RedactionMap, ScopeEntry, SheetsTestResult };

/* -------------------------------------------------------------------------- */
/* Normalisers (older API builds used `name` where the contract says `db`)     */
/* -------------------------------------------------------------------------- */

type Loose = Record<string, unknown>;

function dbName(d: Loose): string {
  return String(d.db ?? d.name ?? "");
}

function normalizeSummary<T extends BridgeSummary>(raw: T): T {
  const r = raw as T & Loose;
  const id = String(r.id ?? r._id);
  return {
    ...r,
    id,
    _id: id,
    isSystem: Boolean(r.isSystem),
    scope: Array.isArray(r.scope) ? r.scope : [],
    redactedFields: r.redactedFields ?? {},
    suggestions: Array.isArray(r.suggestions) ? r.suggestions : [],
    lastError: r.lastError ?? null,
    lastScannedAt: r.lastScannedAt ?? null,
    lastUsedAt: r.lastUsedAt ?? null,
    stats: r.stats ?? { databases: 0, collections: 0 },
    sheets: r.sheets ?? null,
  };
}

function normalizeDetails(raw: BridgeDetails): BridgeDetails {
  const base = normalizeSummary(raw);
  const schema = Array.isArray(raw.schema) ? raw.schema : [];
  return {
    ...base,
    schema: schema.map((d) => ({
      db: dbName(d as unknown as Loose),
      collections: (d.collections ?? []).map((c) => ({
        name: c.name,
        count: c.count ?? null,
        fields: Array.isArray(c.fields) ? c.fields : [],
      })),
    })),
  };
}

function normalizeMongoTest(raw: MongoTestResult): MongoTestResult {
  return {
    ...raw,
    databases: (raw.databases ?? []).map((d) => ({
      db: dbName(d as unknown as Loose),
      collections: (d.collections ?? []).map((c) => ({ ...c, count: c.count ?? null })),
    })),
    sensitive: raw.sensitive ?? {},
  };
}

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

export interface ServiceAccountInfo {
  email: string;
}

export const bridgesApi = {
  list: async () => {
    const res = await api<BridgeSummary[] | { items: BridgeSummary[] }>("/connections");
    const items = Array.isArray(res) ? res : (res.items ?? []);
    return items.map(normalizeSummary);
  },

  get: async (id: string) => normalizeDetails(await api<BridgeDetails>(`/connections/${id}`)),

  testMongo: async (config: string) =>
    normalizeMongoTest(
      await api<MongoTestResult>("/connections/test", {
        method: "POST",
        json: { type: "mongodb", config },
      }),
    ),

  testSheets: (config: string) =>
    api<SheetsTestResult>("/connections/test", {
      method: "POST",
      json: { type: "sheets", config },
    }),

  create: async (body: CreateConnectionBody) => {
    const res = await api<CreateConnectionResponse>("/connections", { method: "POST", json: body });
    return { ...res, connection: res.connection ? normalizeSummary(res.connection) : res.connection };
  },

  update: async (id: string, body: UpdateConnectionBody) =>
    normalizeSummary(await api<BridgeSummary>(`/connections/${id}`, { method: "PATCH", json: body })),

  refresh: (id: string) => api<{ status: string }>(`/connections/${id}/refresh`, { method: "POST" }),

  remove: (id: string) => api<{ message?: string }>(`/connections/${id}`, { method: "DELETE" }),

  sample: async () => {
    const res = await api<CreateConnectionResponse>("/connections/sample", { method: "POST" });
    return { ...res, connection: res.connection ? normalizeSummary(res.connection) : res.connection };
  },

  sheetsServiceAccount: () => api<ServiceAccountInfo>("/connections/sheets/service-account"),

  joinWaitlist: (feature: "postgresql" | "mysql") =>
    api<{ ok?: boolean }>("/waitlist", { method: "POST", json: { feature } }),
};

/** Only these bridge types can be re-scanned (the API returns 400 for anything else). */
export function canRefresh(b: Pick<BridgeSummary, "type" | "isSystem">): boolean {
  return !b.isSystem && (b.type === "mongodb" || b.type === "sheets");
}

/* -------------------------------------------------------------------------- */
/* Scan polling                                                                */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

/** Polls a bridge until its schema scan finishes (or about 2 minutes pass). */
export async function waitForScan(
  id: string,
  onUpdate?: (b: BridgeDetails) => void,
  signal?: AbortSignal,
): Promise<BridgeDetails> {
  let delay = 1500;
  let latest = await bridgesApi.get(id);
  onUpdate?.(latest);
  for (let i = 0; i < 30 && latest.status === "scanning"; i++) {
    await sleep(delay, signal);
    delay = Math.min(delay * 1.3, 5000);
    latest = await bridgesApi.get(id);
    onUpdate?.(latest);
  }
  return latest;
}

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Suggests a bridge name from the URL host, e.g. "cluster0 (MongoDB)". */
export function suggestBridgeName(uri: string): string {
  const host = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("@").pop()?.split(/[/?]/)[0] ?? "";
  const short = host.split(".")[0] || "MongoDB";
  return `${short} (MongoDB)`;
}

export const formatCount = (n: number | null | undefined) =>
  n === null || n === undefined ? "view" : n.toLocaleString("en-US");

/** Collections usually not worth exposing by default (auth sessions, internals). */
export const DEFAULT_EXCLUDED = /^(sessions?|_|system\.|migrations?$|changelog)/i;

/** db name -> selected collection names. */
export type Selection = Record<string, string[]>;

/** Every collection except the DEFAULT_EXCLUDED ones. */
export function defaultSelection(test: Pick<MongoTestResult, "databases">): Selection {
  const sel: Selection = {};
  for (const db of test.databases) {
    sel[db.db] = db.collections.filter((c) => !DEFAULT_EXCLUDED.test(c.name)).map((c) => c.name);
  }
  return sel;
}

/** Turns the picker selection into a bridge scope ("*" when a whole db is selected). */
export function selectionToScope(test: Pick<MongoTestResult, "databases">, sel: Selection): ScopeEntry[] {
  const scope: ScopeEntry[] = [];
  for (const db of test.databases) {
    const chosen = sel[db.db];
    if (!chosen || chosen.length === 0) continue;
    const all = db.collections.length > 0 && chosen.length === db.collections.length;
    scope.push({ db: db.db, collections: all ? ["*"] : [...chosen].sort() });
  }
  return scope;
}

export type TriState = "all" | "some" | "none";

export function dbSelectionState(total: number, chosen: number): TriState {
  if (chosen === 0) return "none";
  return chosen >= total ? "all" : "some";
}

export function selectedCount(sel: Selection): number {
  return Object.values(sel).reduce((n, s) => n + s.length, 0);
}

/** Sensitive fields for the collections the user kept: [{ key: "db.coll", fields }]. */
export function privacyRowsFor(sensitive: RedactionMap, sel: Selection) {
  return Object.entries(sensitive)
    .filter(([key, fields]) => {
      if (!fields.length) return false;
      const dot = key.indexOf(".");
      return sel[key.slice(0, dot)]?.includes(key.slice(dot + 1)) ?? false;
    })
    .map(([key, fields]) => ({ key, fields }));
}

/**
 * Removes one collection from a bridge scope. An empty stored scope means
 * "everything the scan saw", so it is expanded from the schema first.
 */
export function scopeWithout(bridge: BridgeDetails, db: string, coll: string): ScopeEntry[] {
  const dbColls = bridge.schema.find((d) => d.db === db)?.collections.map((c) => c.name) ?? [];
  const base: ScopeEntry[] = bridge.scope.length
    ? bridge.scope
    : bridge.schema.map((d) => ({ db: d.db, collections: ["*"] }));
  return base
    .map((s) => {
      if (s.db !== db) return s;
      const list = s.collections.includes("*") ? dbColls : s.collections;
      return { db, collections: list.filter((c) => c !== coll) };
    })
    .filter((s) => s.collections.length > 0);
}

/** Toggles one field in a redaction map (immutably). */
export function toggleRedaction(map: RedactionMap, key: string, field: string): RedactionMap {
  const current = new Set(map[key] ?? []);
  if (current.has(field)) current.delete(field);
  else current.add(field);
  return { ...map, [key]: [...current] };
}

/** Total documents across every scanned collection (views count as 0). */
export function totalDocuments(b: Pick<BridgeDetails, "schema">): number {
  return b.schema.reduce((n, d) => n + d.collections.reduce((m, c) => m + (c.count || 0), 0), 0);
}

/** Short human scope label for tables: "2 dbs, 14 collections" / "3 tabs". */
export function scopeLabel(b: BridgeSummary): string {
  if (b.type === "sheets") {
    const tabs = b.sheets?.tabs.length ?? b.stats.collections;
    return `${tabs} tab${tabs === 1 ? "" : "s"}`;
  }
  const { databases, collections } = b.stats;
  return `${databases} db${databases === 1 ? "" : "s"}, ${collections} collection${collections === 1 ? "" : "s"}`;
}

/** Accepts a Google Sheets URL or a bare spreadsheet id. */
export const SHEETS_URL_RE = /^(https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{30,})/;

export const MONGO_URL_RE = /^mongodb(\+srv)?:\/\/\S+/i;

/** Chat deep link that asks a question straight away. */
export function askHref(question: string): string {
  return `/chat?q=${encodeURIComponent(question)}&send=1`;
}
