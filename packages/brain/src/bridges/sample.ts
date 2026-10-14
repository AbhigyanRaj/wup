import { Connection } from "@wup/models";
import { cryptoService } from "../utils/crypto";
import { systemPoolKey, withPooledClient } from "./mongo/clientPool";
import type { ScopeEntry } from "./mongo/guard";
import { scanScope } from "./mongo/introspect";
import type { RedactionMap } from "./mongo/redact";
import { autoRedactions, stripHiddenSamples, templateSuggestions, type ScannedDb } from "./mongo/scan";

/**
 * The shared "Sample data" bridge: a read-only MongoDB (SAMPLE_MONGODB_URI)
 * every user can add with one click. Its schema is scanned once per process
 * (refreshed every 24h) and copied into each user's Connection, so adding it
 * never triggers a per-user scan. Rows are flagged isSystem: users can rename
 * or delete their copy but not change its scope or redactions.
 */

export const SAMPLE_BRIDGE_NAME = "Sample data (read-only)";
export const SAMPLE_REFRESH_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SAMPLE_SCOPE: ScopeEntry[] = [{ db: "sample_mflix", collections: ["movies", "comments", "theaters"] }];

export interface SampleSchema {
  scope: ScopeEntry[];
  schemaCache: { scannedAt: Date; dbs: ScannedDb[] };
  redactedFields: RedactionMap;
  suggestions: string[];
}

interface CacheState {
  uri: string;
  scopeKey: string;
  fetchedAt: number;
  value?: SampleSchema;
  pending?: Promise<SampleSchema>;
}

let cache: CacheState | undefined;

export const sampleUri = () => process.env.SAMPLE_MONGODB_URI?.trim() || null;

/** SAMPLE_MONGODB_SCOPE as JSON ([{ db, collections }]), or the sample_mflix default. */
export function sampleScope(): ScopeEntry[] {
  const raw = process.env.SAMPLE_MONGODB_SCOPE?.trim();
  if (!raw) return DEFAULT_SAMPLE_SCOPE;
  try {
    const parsed = JSON.parse(raw);
    const valid =
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (e) =>
          e &&
          typeof e.db === "string" &&
          e.db &&
          Array.isArray(e.collections) &&
          e.collections.length > 0 &&
          e.collections.every((c: unknown) => typeof c === "string" && c)
      );
    if (valid) return parsed.map((e: any) => ({ db: e.db, collections: [...e.collections] }));
  } catch {
    // fall through
  }
  console.warn("[WUP Sample] SAMPLE_MONGODB_SCOPE is not a valid [{db, collections}] list; using the default.");
  return DEFAULT_SAMPLE_SCOPE;
}

async function scanSample(uri: string, scope: ScopeEntry[]): Promise<SampleSchema> {
  const dbs = await withPooledClient(systemPoolKey(uri), uri, (client) => scanScope(client, scope), { system: true });
  const redactedFields = autoRedactions(dbs);
  const schemaCache = { scannedAt: new Date(), dbs: stripHiddenSamples(dbs, redactedFields) };
  const suggestions = templateSuggestions({ _id: "sample", name: SAMPLE_BRIDGE_NAME, type: "mongodb", scope, redactedFields, schemaCache });
  return { scope, schemaCache, redactedFields, suggestions };
}

function startScan(state: CacheState, scope: ScopeEntry[]): Promise<SampleSchema> {
  const pending = scanSample(state.uri, scope);
  state.pending = pending;
  pending.then(
    (value) => {
      if (cache !== state) return;
      state.value = value;
      state.fetchedAt = Date.now();
      state.pending = undefined;
    },
    (err) => {
      if (cache !== state) return;
      state.pending = undefined;
      console.error("[WUP Sample] Sample schema scan failed:", err instanceof Error ? err.message : String(err));
    }
  );
  return pending;
}

/**
 * The sample bridge's scope, schema, redactions and suggestions. Scanned once
 * per process and refreshed in the background every 24h. Null when
 * SAMPLE_MONGODB_URI is unset.
 */
export async function getSampleSchemaCache(now: number = Date.now()): Promise<SampleSchema | null> {
  const uri = sampleUri();
  if (!uri) return null;
  const scope = sampleScope();
  const scopeKey = JSON.stringify(scope);

  if (!cache || cache.uri !== uri || cache.scopeKey !== scopeKey) {
    cache = { uri, scopeKey, fetchedAt: 0 };
  }
  const state = cache;
  if (state.value) {
    if (now - state.fetchedAt > SAMPLE_REFRESH_MS && !state.pending) startScan(state, scope).catch(() => {});
    return state.value;
  }
  return state.pending ?? startScan(state, scope);
}

/** Test hook: forget the cached sample schema. */
export function resetSampleSchemaCache() {
  cache = undefined;
}

/**
 * Creates this user's copy of the sample bridge. Returns null when
 * SAMPLE_MONGODB_URI is unset. Throws on a duplicate name (code 11000) or a
 * failed scan; the API maps both.
 */
export async function createSampleBridge(userId: string): Promise<any | null> {
  const uri = sampleUri();
  if (!uri) return null;
  const sample = await getSampleSchemaCache();
  if (!sample) return null;
  const copy = structuredClone(sample);

  return Connection.create({
    userId,
    name: SAMPLE_BRIDGE_NAME,
    type: "mongodb",
    isSystem: true,
    config: cryptoService.encrypt(uri),
    scope: copy.scope,
    schemaCache: copy.schemaCache,
    redactedFields: copy.redactedFields,
    suggestions: copy.suggestions,
    metadata: { status: "active", lastSynced: copy.schemaCache.scannedAt },
  });
}
