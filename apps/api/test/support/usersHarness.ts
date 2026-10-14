/**
 * Shared setup for the WS-5 (users) tests: an in-memory MongoDB, the Express
 * app, and small request helpers.
 *
 * The app comes from src/app.ts (WS-1) when it exists; otherwise an equivalent
 * minimal app is built here from the same middleware.
 */
import "./env";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import * as models from "@wup/models";
import authRoutes from "../../src/routes/auth";
import userRoutes from "../../src/routes/user";
import { errorHandler, notFoundHandler } from "../../src/middleware/error";
import { rejectOperators } from "../../src/middleware/rejectOperators";
import { resetRateLimits } from "../../src/middleware/rateLimits";

/** An allowed Origin (any localhost origin outside production) for cookie-authenticated writes. */
export const ORIGIN = "http://localhost:3000";

let server: MongoMemoryServer | null = null;

export async function startDb(): Promise<void> {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "wuup_test" });
  for (const name of ["User", "UsageDaily", "Chat", "Message", "Connection", "KnowledgeSource", "KnowledgeChunk", "KnowledgeSourceText"]) {
    await (models as any)[name]?.init?.();
  }
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  await server?.stop();
  server = null;
}

export async function clearDb(): Promise<void> {
  const db = mongoose.connection.db!;
  for (const c of await db.collections()) await c.deleteMany({});
  resetRateLimits();
}

function tryAppModule(): Express | null {
  let mod: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("../../src/app");
  } catch (err: any) {
    if (err?.code === "MODULE_NOT_FOUND" && String(err.message).includes("src/app")) return null;
    throw err;
  }
  const app = typeof mod.createApp === "function" ? mod.createApp() : mod.app ?? mod.default;
  return app ?? null;
}

export function buildApp(): Express {
  const fromWs1 = tryAppModule();
  if (fromWs1) return fromWs1;

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(rejectOperators);
  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Reads the session cookie pair ("name=value") from a response. */
export function sessionCookie(res: request.Response): string | null {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const c = raw?.find((s) => /wuup_session=/.test(s) && !/wuup_session=;/.test(s));
  return c ? c.split(";")[0] : null;
}

export function rawSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  return raw?.find((s) => /wuup_session=/.test(s)) ?? "";
}

/** Signs a user up and returns their token, cookie and id. */
export async function signup(
  app: Express,
  email = `user-${Math.random().toString(36).slice(2, 10)}@example.com`,
  password = "correct horse battery"
): Promise<{ token: string; cookie: string; id: string; email: string; password: string }> {
  const res = await request(app).post("/auth/signup").set("Origin", ORIGIN).send({ email, password });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, cookie: sessionCookie(res)!, id: res.body.user.id, email: res.body.user.email, password };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Strips per-request fields so two error bodies can be compared. */
export const stable = (body: any) => {
  const { requestId: _r, ...rest } = body ?? {};
  return rest;
};

export { request, models, mongoose };
