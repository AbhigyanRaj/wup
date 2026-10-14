/**
 * System routes:
 *   GET /        -> { name: "wuup-api", version, status: "ok" }
 *   GET /health  -> HealthResponse; 503 when the database does not answer a ping
 */
import { Router } from "express";
import mongoose from "mongoose";
import type { HealthResponse } from "@wup/contracts";
import { env } from "../config/env";

const PING_TIMEOUT_MS = 1000;

/** Pings MongoDB with a 1s timeout. */
export async function pingDb(connection: mongoose.Connection = mongoose.connection): Promise<boolean> {
  if (connection.readyState !== 1 || !connection.db) return false;
  let timer: NodeJS.Timeout | undefined;
  try {
    const ping = connection.db.admin().command({ ping: 1 });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ping timeout")), PING_TIMEOUT_MS);
    });
    const res: any = await Promise.race([ping, timeout]);
    return res?.ok === 1;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const router = Router();

router.get("/", (_req, res) => {
  res.json({ name: "wuup-api", version: env.APP_VERSION, status: "ok" });
});

router.get("/health", async (_req, res) => {
  const dbUp = await pingDb();
  const body: HealthResponse = {
    status: dbUp ? "healthy" : "degraded",
    db: dbUp ? "up" : "down",
    version: env.APP_VERSION,
    uptimeS: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  res.setHeader("Cache-Control", "no-store");
  res.status(dbUp ? 200 : 503).json(body);
});

export default router;
