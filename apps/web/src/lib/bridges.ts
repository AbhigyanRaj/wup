/**
 * Client helpers and types for data bridges (MongoDB connections).
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type BridgeStatus = "scanning" | "active" | "error";

export interface ScopeEntry {
  db: string;
  collections: string[]; // ["*"] = all
}

export type RedactionMap = Record<string, string[]>;

export interface BridgeSummary {
  _id: string;
  name: string;
  type: string;
  scope: ScopeEntry[];
  redactedFields: RedactionMap;
  suggestions: string[];
  status: BridgeStatus;
  lastError: string | null;
  lastScannedAt: string | null;
  lastUsedAt: string | null;
  stats: { databases: number; collections: number };
}

export interface BridgeDetails extends BridgeSummary {
  schema: Array<{
    name: string;
    collections: Array<{
      name: string;
      count: number;
      fields: Array<{ path: string; types: string[]; pct: number }>;
    }>;
  }>;
}

export interface TestResult {
  databases: Array<{
    name: string;
    collections: Array<{ name: string; count: number | null; type: "collection" | "view" }>;
  }>;
  sensitive: RedactionMap;
  defaultDb: string;
}

export interface QueryRecord {
  tool: string;
  connectionName: string;
  db: string;
  collection: string;
  query: string;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  error?: string;
}

function authHeaders(json = false): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wuup_token") : null;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const bridgesApi = {
  test: (config: string) =>
    request<TestResult & { ok: true }>("/connections/test", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ type: "mongodb", config }),
    }),

  create: (body: { name: string; type: string; config: string; scope?: ScopeEntry[]; redactedFields?: RedactionMap }) =>
    request<{ id: string; connection: BridgeSummary }>("/connections", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    }),

  list: () => request<BridgeSummary[]>("/connections", { headers: authHeaders() }),

  get: (id: string) => request<BridgeDetails>(`/connections/${id}`, { headers: authHeaders() }),

  update: (id: string, body: { name?: string; scope?: ScopeEntry[]; redactedFields?: RedactionMap }) =>
    request<BridgeSummary>(`/connections/${id}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    }),

  refresh: (id: string) =>
    request<{ status: string }>(`/connections/${id}/refresh`, { method: "POST", headers: authHeaders() }),

  remove: (id: string) => request<{ message: string }>(`/connections/${id}`, { method: "DELETE", headers: authHeaders() }),

  setChatBridges: (chatId: string, bridgeIds: string[]) =>
    request<{ bridgeIds: string[] }>(`/chats/${chatId}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ bridgeIds }),
    }),
};

/** Polls a bridge until its schema scan finishes (or ~2 minutes pass). */
export async function waitForScan(id: string, onUpdate?: (b: BridgeDetails) => void): Promise<BridgeDetails> {
  let delay = 1500;
  let latest = await bridgesApi.get(id);
  for (let i = 0; i < 30 && latest.status === "scanning"; i++) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.3, 5000);
    latest = await bridgesApi.get(id);
    onUpdate?.(latest);
  }
  return latest;
}

/** Suggests a bridge name from the URL host, e.g. "cluster0 (MongoDB)". */
export function suggestBridgeName(uri: string): string {
  const host = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("@").pop()?.split(/[/?]/)[0] ?? "";
  const short = host.split(".")[0] || "MongoDB";
  return `${short} (MongoDB)`;
}

export const formatCount = (n: number | null | undefined) =>
  n === null || n === undefined ? "view" : n.toLocaleString("en-US");
