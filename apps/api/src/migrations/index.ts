/**
 * Data migration runner.
 *
 * Migrations run in the order of MIGRATIONS below, once each. Applied ids are
 * stored in the `migrations` collection (Migration model). A lock document with
 * an expiry in `migrationlocks` keeps concurrent boots from running them twice.
 *
 * Contract for a migration module:
 *   export const id = "00N-name";
 *   export async function up(ctx: MigrationContext): Promise<void>  // idempotent
 *
 * A failing migration is logged and STOPS the remaining ones (later migrations
 * may depend on it). The server keeps running; the next boot retries.
 */
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import type { Db } from "mongodb";
import { Migration } from "@wup/models";
import { logger as rootLogger, type Logger } from "../lib/logger";
import m001 from "./001-drop-username-index";
import m002 from "./002-encrypt-byok";
import m003 from "./003-lowercase-emails";
import m004 from "./004-backfill-chats-messages";
import m005 from "./005-backfill-knowledge";
import m006 from "./006-clean-redactions";
import m007 from "./007-sync-indexes";

/**
 * Migration logger: callable as log("message") (info) and as a pino-style
 * object (log.info / warn / error / debug, with or without a meta object).
 */
export type MigrationLogger = ((msg: string) => void) &
  Pick<Logger, "info" | "warn" | "error" | "debug" | "child">;

function migrationLogger(base: Logger): MigrationLogger {
  const fn = ((msg: string) => base.info(msg)) as MigrationLogger;
  fn.info = base.info.bind(base);
  fn.warn = base.warn.bind(base);
  fn.error = base.error.bind(base);
  fn.debug = base.debug.bind(base);
  fn.child = base.child.bind(base);
  return fn;
}

export interface MigrationContext {
  /** Native driver database handle. */
  db: Db;
  /** The mongoose connection (models are registered on it). */
  connection: mongoose.Connection;
  log: MigrationLogger;
}

export interface MigrationModule {
  id: string;
  up: (ctx: MigrationContext) => Promise<void>;
}

export const MIGRATIONS: MigrationModule[] = [m001, m002, m003, m004, m005, m006, m007] as MigrationModule[];

const LOCK_COLLECTION = "migrationlocks";
const LOCK_ID = "migrations";
const LOCK_TTL_MS = 15 * 60 * 1000;

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
  failed: { id: string; error: string } | null;
  locked: boolean;
}

async function acquireLock(db: Db, owner: string): Promise<boolean> {
  const locks = db.collection<{ _id: string; owner: string; expiresAt: Date }>(LOCK_COLLECTION);
  // TTL index cleans up locks left by a crashed process (best effort)
  await locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => undefined);
  const now = new Date();
  try {
    const res = await locks.findOneAndUpdate(
      { _id: LOCK_ID, expiresAt: { $lt: now } },
      { $set: { owner, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
      { upsert: true, returnDocument: "after" }
    );
    return (res as any)?.owner === owner || (res as any)?.value?.owner === owner;
  } catch (err: any) {
    // Duplicate key: the lock exists and has not expired, another process holds it
    if (err?.code === 11000) return false;
    throw err;
  }
}

async function releaseLock(db: Db, owner: string): Promise<void> {
  await db
    .collection<{ _id: string; owner: string }>(LOCK_COLLECTION)
    .deleteOne({ _id: LOCK_ID, owner })
    .catch(() => undefined);
}

/**
 * Runs pending migrations. Never throws: problems are logged and reported in
 * the result. Requires an open mongoose connection.
 */
export async function runMigrations(
  opts: { migrations?: MigrationModule[]; log?: Logger; connection?: mongoose.Connection } = {}
): Promise<MigrationRunResult> {
  const log = (opts.log ?? rootLogger).child({ mod: "migrations" });
  const connection = opts.connection ?? mongoose.connection;
  const migrations = opts.migrations ?? MIGRATIONS;
  const result: MigrationRunResult = { applied: [], skipped: [], failed: null, locked: false };

  const db = connection.db as unknown as Db | undefined;
  if (!db || connection.readyState !== 1) {
    log.warn("database not connected; migrations skipped");
    return result;
  }

  const owner = `${process.pid}-${randomUUID()}`;
  try {
    if (!(await acquireLock(db, owner))) {
      log.info("another instance holds the migration lock; skipping");
      result.locked = true;
      return result;
    }
  } catch (err) {
    log.error({ err }, "could not acquire the migration lock; skipping");
    return result;
  }

  try {
    const done = new Set(
      (await Migration.find({}, { _id: 1 }).lean()).map((d: any) => String(d._id))
    );
    const ctx = { db, connection };

    for (const m of migrations) {
      if (done.has(m.id)) {
        result.skipped.push(m.id);
        continue;
      }
      const started = Date.now();
      try {
        log.info({ migration: m.id }, "running migration");
        await m.up({ ...ctx, log: migrationLogger(log.child({ migration: m.id })) });
        await Migration.updateOne({ _id: m.id }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
        result.applied.push(m.id);
        log.info({ migration: m.id, ms: Date.now() - started }, "migration applied");
      } catch (err: any) {
        result.failed = { id: m.id, error: err?.message ?? String(err) };
        log.error({ err, migration: m.id }, "migration failed; remaining migrations stopped until next boot");
        break;
      }
    }
  } catch (err) {
    log.error({ err }, "migration runner failed");
  } finally {
    await releaseLock(db, owner);
  }
  return result;
}
