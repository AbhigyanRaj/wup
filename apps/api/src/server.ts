// Load .env before any other import: config/env reads process.env at load time
import "dotenv/config";
import { env, envWarnings } from "./config/env";

import type { Server } from "http";
import mongoose from "mongoose";
import { getCryptoService } from "@wup/brain";
import { createApp } from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./migrations";

const log = logger.child({ mod: "boot" });
for (const w of envWarnings) log.warn(w);

const CONNECT_TIMEOUT_MS = 10_000;
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;
let stopSweepers: (() => void) | null = null;

/** Hooks other workstreams may provide. Missing modules or exports are skipped. */
function optionalExport(candidates: string[], name: string): ((...args: any[]) => any) | null {
  for (const path of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(path);
      if (typeof mod?.[name] === "function") return mod[name];
    } catch (err: any) {
      if (err?.code !== "MODULE_NOT_FOUND") log.warn({ err, path }, `could not load ${path}`);
    }
  }
  return null;
}

async function afterConnect(): Promise<void> {
  const result = await runMigrations();
  if (result.applied.length) log.info({ applied: result.applied }, "migrations applied");
  if (result.failed) log.error({ failed: result.failed }, "a migration failed; continuing without it");

  const recover = optionalExport(["@wup/ingestor"], "recoverInterruptedIngests");
  if (recover) {
    try {
      const n = await recover();
      if (n) log.info({ recovered: n }, "recovered interrupted knowledge ingests");
    } catch (err) {
      log.error({ err }, "recoverInterruptedIngests failed");
    }
  }

  const recoverScans = optionalExport(["@wup/brain"], "recoverStuckScans");
  if (recoverScans) {
    try {
      const n = await recoverScans();
      if (n) log.info({ recovered: n }, "recovered stuck bridge schema scans");
    } catch (err) {
      log.error({ err }, "recoverStuckScans failed");
    }
  }

  const start = optionalExport(["./jobs/sweepers", "./services"], "startUserSweepers");
  if (start && !stopSweepers) {
    try {
      const sweeperLog = logger.child({ mod: "sweepers" });
      const stop = start({
        info: (m: string) => sweeperLog.info(m),
        warn: (m: string) => sweeperLog.warn(m),
        error: (m: string) => sweeperLog.error(m),
        log: (m: string) => sweeperLog.info(m),
      });
      if (typeof stop === "function") stopSweepers = stop;
    } catch (err) {
      log.error({ err }, "startUserSweepers failed");
    }
  }
}

/**
 * Connects to MongoDB. The first attempt is awaited; on failure the server
 * still listens (so /health reports "degraded") and retries in the background.
 */
async function connectWithRetry(attempt = 1): Promise<void> {
  if (shuttingDown) return;
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
    log.info({ attempt }, "connected to MongoDB");
    await afterConnect();
  } catch (err: any) {
    const delay = Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** Math.min(attempt - 1, 5));
    log.error({ err: { name: err?.name, message: err?.message }, attempt, retryInMs: delay }, "MongoDB connection failed");
    setTimeout(() => void connectWithRetry(attempt + 1), delay).unref();
  }
}

function shutdown(server: Server, signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutting down");

  const hardExit = setTimeout(() => {
    log.warn("shutdown timed out; forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  hardExit.unref();

  try {
    stopSweepers?.();
  } catch {
    /* ignore */
  }

  server.close(async () => {
    try {
      await mongoose.disconnect();
    } catch (err) {
      log.error({ err }, "error closing MongoDB");
    }
    log.info("shutdown complete");
    process.exit(0);
  });
  // Idle keep-alive sockets would otherwise hold close() open
  server.closeIdleConnections?.();
  // Long-lived streams (SSE) get most of the grace period, then are cut
  setTimeout(() => server.closeAllConnections?.(), SHUTDOWN_TIMEOUT_MS - 2_000).unref();
}

async function main() {
  // Fail fast on a bad encryption keyring (the hotfix's production rule)
  getCryptoService();

  await connectWithRetry();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT, version: env.APP_VERSION, env: env.NODE_ENV }, "wuup-api listening");
  });
  // Longer than typical proxy idle timeouts so the proxy closes first
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  process.on("SIGTERM", () => shutdown(server, "SIGTERM"));
  process.on("SIGINT", () => shutdown(server, "SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  log.error({ err: reason }, "unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  log.fatal({ err }, "uncaught exception");
  process.exit(1);
});

main().catch((err) => {
  log.fatal({ err }, "failed to start");
  process.exit(1);
});
