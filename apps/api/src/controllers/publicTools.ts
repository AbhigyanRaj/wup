/**
 * Free public tools for the marketing site (no account needed).
 *
 * Each call: input hygiene (no credentials) -> optional Turnstile check ->
 * 7 day cache lookup -> global daily cap -> Gemini generation (validated and
 * guarded in @wup/brain) -> cache store. Nothing is ever executed against a
 * database. Logs carry a hashed IP only.
 */
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { PublicToolCache, PublicToolUsage } from "@wup/models";
import type { PublicTool } from "@wup/contracts";
import { publicTools } from "@wup/brain";

const { PublicToolError, explainAggregation, generateAggregation, generateMongoQuery, sqlToMongo } = publicTools;
type JsonCompleter = publicTools.JsonCompleter;
type PublicToolError = InstanceType<typeof publicTools.PublicToolError>;
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";
import { logger } from "../lib/logger";

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

export type PublicToolGenerator = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
export type PublicToolGenerators = Record<PublicTool, PublicToolGenerator>;

/** The real generators. `complete` swaps the model call (tests). */
export function defaultGenerators(complete?: JsonCompleter): PublicToolGenerators {
  const opts = complete ? { complete } : {};
  return {
    "mongodb-query": (i) => generateMongoQuery(i as any, opts) as any,
    "mongodb-aggregation": (i) => generateAggregation(i as any, opts) as any,
    "aggregation-explain": (i) => explainAggregation(i as any, opts) as any,
    "sql-to-mongodb": (i) => sqlToMongo(i as any, opts) as any,
  };
}

/* ------------------------------------------------------------------ */
/* Input hygiene                                                       */
/* ------------------------------------------------------------------ */

export const CREDENTIALS_MESSAGE = "Don't paste credentials; a sample document is enough.";

const CREDENTIAL_PATTERNS: RegExp[] = [
  /mongodb(\+srv)?:\/\//i,
  /(postgres(ql)?|mysql|redis|amqp):\/\/[^\s/]*:[^\s/]*@/i,
  /-----BEGIN/,
  /\bsk-(proj-|ant-|or-)?[A-Za-z0-9_-]{20,}/, // OpenAI, Anthropic, OpenRouter
  /\bAIza[0-9A-Za-z_-]{35}\b/, // Google API key
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, // GitHub token
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack token
  /\b[rs]k_live_[0-9A-Za-z]{20,}/, // Stripe secret key
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
];

/** Throws 400 if any string looks like a credential. */
export function assertNoCredentials(values: unknown[]): void {
  for (const value of values) {
    if (typeof value !== "string") continue;
    if (CREDENTIAL_PATTERNS.some((re) => re.test(value))) {
      throw new HttpError(400, "VALIDATION_FAILED", CREDENTIALS_MESSAGE);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const IP_SALT = process.env.IP_HASH_SALT || "wuup-public-tools";

export function hashIp(ip: string | undefined): string {
  return crypto.createHash("sha256").update(`${IP_SALT}:${ip ?? "unknown"}`).digest("hex").slice(0, 16);
}

const normalise = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : v);

/** sha256 of the tool plus its normalised input (Turnstile token excluded). */
export function cacheKey(tool: PublicTool, input: Record<string, unknown>): string {
  const fields = Object.keys(input)
    .filter((k) => k !== "turnstileToken")
    .sort()
    .map((k) => [k, normalise(input[k])]);
  return crypto.createHash("sha256").update(JSON.stringify([tool, fields])).digest("hex");
}

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

export function signupUrl(): string {
  const origin = env.CORS_ORIGINS?.find((o) => !o.includes("localhost")) ?? "https://wuup.in";
  return `${origin}/login?mode=signup`;
}

/* ------------------------------------------------------------------ */
/* Turnstile                                                           */
/* ------------------------------------------------------------------ */

const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Verifies a Cloudflare Turnstile token, only when TURNSTILE_SECRET_KEY is set. */
export function turnstile(secret: string | undefined = env.TURNSTILE_SECRET_KEY) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!secret) return next();
    const token = typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : "";
    if (!token) return next(new HttpError(403, "FORBIDDEN", "Verification failed. Reload the page and try again."));
    try {
      const body = new URLSearchParams({ secret, response: token });
      if (req.ip) body.set("remoteip", req.ip);
      const r = await fetch(TURNSTILE_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
      const data = (await r.json()) as { success?: boolean };
      if (!data.success) return next(new HttpError(403, "FORBIDDEN", "Verification failed. Reload the page and try again."));
      next();
    } catch {
      next(new HttpError(503, "MODEL_UNAVAILABLE", "Verification is unavailable right now. Please try again shortly."));
    }
  };
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export interface ToolHandlerDeps {
  generators: PublicToolGenerators;
  /** Global calls per UTC day (model calls only; cache hits are free). */
  dailyCap: number;
}

/** Fields of the request body that are sent to the model. */
const INPUT_FIELDS: Record<PublicTool, string[]> = {
  "mongodb-query": ["prompt", "collection", "schema"],
  "mongodb-aggregation": ["prompt", "collection", "schema"],
  "aggregation-explain": ["pipeline"],
  "sql-to-mongodb": ["sql", "schema"],
};

export function toolHandler(tool: PublicTool, deps: ToolHandlerDeps) {
  return async (req: Request, res: Response) => {
    const started = Date.now();
    const log = ((req as any).log ?? logger).child({ mod: "public-tools", tool, ip: hashIp(req.ip) });

    const input: Record<string, unknown> = {};
    for (const field of INPUT_FIELDS[tool]) {
      if (req.body[field] !== undefined && req.body[field] !== "") input[field] = req.body[field];
    }
    assertNoCredentials(Object.values(input));

    const key = cacheKey(tool, input);
    const hit = await PublicToolCache.findById(key).lean<{ output: Record<string, unknown> }>();
    if (hit) {
      log.info({ cached: true, ms: Date.now() - started }, "public tool");
      return res.json({ ...hit.output, cached: true });
    }

    const usage = await PublicToolUsage.findOneAndUpdate(
      { _id: utcDay() },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    ).lean<{ count: number }>();
    if ((usage?.count ?? 0) > deps.dailyCap) {
      log.warn({ cap: deps.dailyCap }, "public tools daily cap reached");
      throw new HttpError(
        503,
        "MODEL_UNAVAILABLE",
        "The free tools have reached today's limit. Sign up to keep going, or try again tomorrow.",
        undefined,
        { retryAfterS: secondsUntilUtcMidnight() }
      );
    }

    let output: Record<string, unknown>;
    try {
      output = await deps.generators[tool](input);
    } catch (err) {
      if (err instanceof PublicToolError) {
        log.warn({ code: err.code, ms: Date.now() - started }, "public tool failed");
        if (err.code === "NOT_CONFIGURED") throw new HttpError(503, "MODEL_UNAVAILABLE", err.message);
        if (err.code === "PROVIDER_ERROR") throw new HttpError(502, "PROVIDER_ERROR", err.message, undefined, { retryAfterS: 30 });
        throw new HttpError(422, "VALIDATION_FAILED", err.message);
      }
      throw err;
    }

    await PublicToolCache.updateOne(
      { _id: key },
      { $setOnInsert: { tool, output, createdAt: new Date() } },
      { upsert: true }
    ).catch((err: unknown) => log.warn({ err }, "public tool cache write failed"));

    log.info({ cached: false, ms: Date.now() - started }, "public tool");
    res.json({ ...output, cached: false });
  };
}

function secondsUntilUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((next - now.getTime()) / 1000);
}
