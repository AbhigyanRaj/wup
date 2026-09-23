import crypto from "crypto";
import { MongoClient, type MongoClientOptions } from "mongodb";

/**
 * Pooled MongoClient per bridge. Opening a client costs a TLS + SRV + auth
 * round-trip (often 1-3s on Atlas), so we keep one per connection and close
 * it after it has been idle for a while.
 */

const IDLE_CLOSE_MS = 10 * 60 * 1000;
const MAX_POOLED_CLIENTS = 50;

export const CLIENT_OPTIONS: MongoClientOptions = {
  readPreference: "secondaryPreferred",
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  maxPoolSize: 5,
  appName: "wuup-bridge",
};

interface PoolEntry {
  client: Promise<MongoClient>;
  uriHash: string;
  lastUsed: number;
}

const pool = new Map<string, PoolEntry>();

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function closeEntry(key: string, entry: PoolEntry) {
  pool.delete(key);
  entry.client.then((c) => c.close()).catch(() => {});
}

/** Returns a connected client for this bridge, reusing a pooled one when possible. */
export async function getPooledClient(key: string, uri: string): Promise<MongoClient> {
  const uriHash = hash(uri);
  const existing = pool.get(key);

  if (existing && existing.uriHash === uriHash) {
    existing.lastUsed = Date.now();
    return existing.client;
  }
  if (existing) closeEntry(key, existing);

  // Evict least-recently-used when full
  if (pool.size >= MAX_POOLED_CLIENTS) {
    const [oldestKey, oldest] = [...pool.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
    closeEntry(oldestKey, oldest);
  }

  const client = new MongoClient(uri, CLIENT_OPTIONS).connect();
  const entry: PoolEntry = { client, uriHash, lastUsed: Date.now() };
  pool.set(key, entry);

  try {
    return await client;
  } catch (err) {
    // Don't keep a failed connection around
    if (pool.get(key) === entry) pool.delete(key);
    throw err;
  }
}

/** Drops a pooled client (e.g. when a bridge is deleted or its URI changes). */
export function releasePooledClient(key: string) {
  const entry = pool.get(key);
  if (entry) closeEntry(key, entry);
}

/** Opens a short-lived client, runs fn, and always closes it. Used for "test connection". */
export async function withTempClient<T>(uri: string, fn: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(uri, CLIENT_OPTIONS);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pool) {
    if (now - entry.lastUsed > IDLE_CLOSE_MS) closeEntry(key, entry);
  }
}, 60 * 1000);
sweeper.unref();
