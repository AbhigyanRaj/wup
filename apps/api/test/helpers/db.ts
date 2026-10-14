/**
 * In-memory MongoDB for tests.
 *
 *   import { useTestDb } from "./helpers/db";
 *   useTestDb();                 // registers before/after/beforeEach hooks
 *
 * or manually: await startTestDb(); await clearTestDb(); await stopTestDb();
 *
 * clearTestDb() empties every collection (deleteMany) instead of dropDatabase so
 * model indexes (unique email, TTLs) survive between tests. Pass
 * { drop: true } to drop the whole database instead.
 * useTestDb({ replSet: true }) starts a single-node replica set (transactions,
 * change streams).
 */
import { after, before, beforeEach } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import "@wup/models";

let server: MongoMemoryServer | MongoMemoryReplSet | null = null;

export async function startTestDb(opts: { replSet?: boolean } = {}): Promise<string> {
  if (!server) {
    server = opts.replSet
      ? await MongoMemoryReplSet.create({ replSet: { count: 1 } })
      : await MongoMemoryServer.create();
  }
  const uri = server.getUri("wuup-test");
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }
  // Make sure model indexes exist before tests rely on them
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => undefined)));
  return uri;
}

/** The URI of the running test server (after startTestDb). */
export function testDbUri(): string {
  if (!server) throw new Error("test db not started");
  return server.getUri("wuup-test");
}

export async function clearTestDb(opts: { drop?: boolean } = {}): Promise<void> {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) return;
  if (opts.drop) {
    await db.dropDatabase();
    return;
  }
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect().catch(() => undefined);
  if (server) {
    await server.stop();
    server = null;
  }
}

/** Registers hooks: start before all, clear before each, stop after all. */
export function useTestDb(opts: { replSet?: boolean; drop?: boolean } = {}): void {
  before(async () => {
    await startTestDb(opts);
  });
  beforeEach(async () => {
    await clearTestDb({ drop: opts.drop });
  });
  after(async () => {
    await stopTestDb();
  });
}
