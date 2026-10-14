import crypto from "crypto";
import { MongoClient, type MongoClientOptions } from "mongodb";
import { assertNoBlockedLiteralHosts, privateHostsAllowed, safeLookup } from "../net/ssrf";

/**
 * Pooled MongoClient per bridge. Opening a client costs a TLS + SRV + auth
 * round-trip (often 1-3s on Atlas), so we keep one per connection and close
 * it after it has been idle for a while.
 *
 * Entries count in-flight users: the idle sweeper and LRU eviction never
 * close a client that a query is still using, and an explicit release (bridge
 * deleted, URI changed) is deferred until the last user is done.
 *
 * SSRF: user bridges connect with `lookup: safeLookup`, so every socket the
 * driver opens (SRV members, reconnects after a DNS change) is checked against
 * the private-address block list. System bridges and local development
 * (BRIDGE_ALLOW_PRIVATE_HOSTS=true) skip it.
 */

export const IDLE_CLOSE_MS = 10 * 60 * 1000;
export const MAX_POOLED_CLIENTS = 50;

export const CLIENT_OPTIONS: MongoClientOptions = {
  readPreference: "secondaryPreferred",
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  maxPoolSize: 5,
  appName: "wuup-bridge",
};

/** The subset of MongoClient the pool uses, so tests can inject fakes. */
export type PoolableClient = Pick<MongoClient, "connect" | "close" | "db">;
export type ClientFactory = (uri: string, options: MongoClientOptions) => PoolableClient;

const defaultFactory: ClientFactory = (uri, options) => new MongoClient(uri, options);
let clientFactory: ClientFactory = defaultFactory;

/** Test hook: replaces how clients are created. Pass null to restore the default. */
export function setClientFactory(factory: ClientFactory | null) {
  clientFactory = factory ?? defaultFactory;
}

export interface PoolOptions {
  /** System bridges (the sample data) connect without the private-host lookup guard. */
  system?: boolean;
}

interface PoolEntry {
  client: Promise<MongoClient>;
  uriHash: string;
  lastUsed: number;
  inFlight: number;
  closing: boolean;
}

const pool = new Map<string, PoolEntry>();

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Pool key shared by every user's copy of a system bridge. */
export const systemPoolKey = (uri: string) => `system:${hash(uri)}`;

/** Client options for a URI: adds the SSRF lookup guard unless allowed to skip it. */
export function clientOptionsFor(uri: string, opts: PoolOptions = {}): MongoClientOptions {
  if (opts.system || privateHostsAllowed()) return CLIENT_OPTIONS;
  // IP literals and unix sockets never reach DNS, so check them here
  assertNoBlockedLiteralHosts(uri);
  return { ...CLIENT_OPTIONS, lookup: safeLookup as any };
}

function closeNow(entry: PoolEntry) {
  entry.client.then((c) => c.close()).catch(() => {});
}

/** Removes an entry from the pool and closes it once nothing is using it. */
function retire(key: string, entry: PoolEntry) {
  if (pool.get(key) === entry) pool.delete(key);
  if (entry.closing) return;
  entry.closing = true;
  if (entry.inFlight === 0) closeNow(entry);
}

function evictForSpace() {
  if (pool.size < MAX_POOLED_CLIENTS) return;
  let oldest: [string, PoolEntry] | undefined;
  for (const item of pool) {
    if (item[1].inFlight > 0) continue;
    if (!oldest || item[1].lastUsed < oldest[1].lastUsed) oldest = item;
  }
  // Every entry busy: go over the soft limit rather than kill a running query
  if (oldest) retire(oldest[0], oldest[1]);
}

function acquireEntry(key: string, uri: string, opts: PoolOptions): PoolEntry {
  const uriHash = hash(uri);
  const existing = pool.get(key);
  if (existing && existing.uriHash === uriHash && !existing.closing) {
    existing.lastUsed = Date.now();
    return existing;
  }
  if (existing) retire(key, existing);
  evictForSpace();

  const options = clientOptionsFor(uri, opts);
  const client = Promise.resolve()
    .then(() => clientFactory(uri, options).connect())
    .then((c) => c as MongoClient);
  const entry: PoolEntry = { client, uriHash, lastUsed: Date.now(), inFlight: 0, closing: false };
  pool.set(key, entry);
  // Don't keep a failed connection around
  client.catch(() => {
    if (pool.get(key) === entry) pool.delete(key);
  });
  return entry;
}

/**
 * Runs fn with a pooled client for this bridge. The client can't be swept,
 * evicted or released-and-closed while fn is running.
 */
export async function withPooledClient<T>(
  key: string,
  uri: string,
  fn: (client: MongoClient) => Promise<T>,
  opts: PoolOptions = {}
): Promise<T> {
  const entry = acquireEntry(key, uri, opts);
  entry.inFlight++;
  try {
    const client = await entry.client;
    return await fn(client);
  } finally {
    entry.inFlight--;
    entry.lastUsed = Date.now();
    if (entry.closing && entry.inFlight === 0) closeNow(entry);
  }
}

/**
 * Returns a connected client for this bridge, reusing a pooled one when possible.
 * Prefer withPooledClient: a client returned here isn't protected from the
 * idle sweeper while you use it.
 */
export async function getPooledClient(key: string, uri: string, opts: PoolOptions = {}): Promise<MongoClient> {
  return acquireEntry(key, uri, opts).client;
}

/** Drops a pooled client (e.g. when a bridge is deleted or its URI changes). Closes once idle. */
export function releasePooledClient(key: string) {
  const entry = pool.get(key);
  if (entry) retire(key, entry);
}

/** Closes clients idle for longer than IDLE_CLOSE_MS. Exported for tests. Returns how many closed. */
export function sweepIdle(now: number = Date.now()): number {
  let closed = 0;
  for (const [key, entry] of pool) {
    if (entry.inFlight > 0) continue;
    if (now - entry.lastUsed > IDLE_CLOSE_MS) {
      retire(key, entry);
      closed++;
    }
  }
  return closed;
}

/** Test/introspection helper: the pool's keys and in-flight counts. */
export function poolStats(): Array<{ key: string; inFlight: number; lastUsed: number }> {
  return [...pool].map(([key, e]) => ({ key, inFlight: e.inFlight, lastUsed: e.lastUsed }));
}

/** Opens a short-lived client, runs fn, and always closes it. Used for "test connection". */
export async function withTempClient<T>(
  uri: string,
  fn: (client: MongoClient) => Promise<T>,
  opts: PoolOptions = {}
): Promise<T> {
  const client = clientFactory(uri, clientOptionsFor(uri, opts)) as MongoClient;
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

const sweeper = setInterval(() => sweepIdle(), 60 * 1000);
sweeper.unref();
