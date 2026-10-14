/**
 * /public: endpoints for the marketing site, no account needed.
 *
 *   POST /public/tools/mongodb-query
 *   POST /public/tools/mongodb-aggregation
 *   POST /public/tools/aggregation-explain
 *   POST /public/tools/sql-to-mongodb
 *   POST /public/contact
 *
 * app.ts mounts this router with its own small JSON parser. Abuse controls:
 * PUBLIC_TOOLS_ENABLED kill switch, 5/min and 30/day per IP (429 with a
 * signupUrl), optional Turnstile, a global daily cap (503) and a 7 day cache.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit, { type Options as RateLimitOptions } from "express-rate-limit";
import {
  AggregationExplainRequestSchema,
  ContactBodySchema,
  MongoAggregationRequestSchema,
  MongoQueryRequestSchema,
  SqlToMongoRequestSchema,
  type PublicTool,
} from "@wup/contracts";
import type { ZodType } from "zod";
import { env } from "../config/env";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { validate } from "../middleware/validate";
import { createContactMessage } from "../controllers/contact";
import {
  defaultGenerators,
  signupUrl,
  toolHandler,
  turnstile,
  type PublicToolGenerators,
} from "../controllers/publicTools";
import type { publicTools } from "@wup/brain";
type JsonCompleter = publicTools.JsonCompleter;

export interface PublicRouterOptions {
  enabled?: boolean;
  dailyCap?: number;
  perMinute?: number;
  perDay?: number;
  turnstileSecret?: string;
  /** Replace whole generators (tests). */
  generators?: Partial<PublicToolGenerators>;
  /** Replace only the model call; generators still validate and guard (tests). */
  complete?: JsonCompleter;
}

const TOOL_SCHEMAS: Record<PublicTool, ZodType> = {
  "mongodb-query": MongoQueryRequestSchema,
  "mongodb-aggregation": MongoAggregationRequestSchema,
  "aggregation-explain": AggregationExplainRequestSchema,
  "sql-to-mongodb": SqlToMongoRequestSchema,
};

function limiter(windowMs: number, limit: number, message: string): ReturnType<typeof rateLimit> {
  const opts: Partial<RateLimitOptions> = {
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? "unknown",
    validate: { trustProxy: false, xForwardedForHeader: false },
    handler: (req: Request, res: Response) => {
      const reset = (req as any).rateLimit?.resetTime as Date | undefined;
      const retryAfterS = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfterS));
      res.status(429).json({ error: message, code: "RATE_LIMITED", retryAfterS, signupUrl: signupUrl() });
    },
  };
  return rateLimit(opts);
}

export function createPublicRouter(options: PublicRouterOptions = {}): Router {
  const router = Router();
  const enabled = options.enabled ?? env.PUBLIC_TOOLS_ENABLED;
  const generators: PublicToolGenerators = { ...defaultGenerators(options.complete), ...options.generators };
  const deps = { generators, dailyCap: options.dailyCap ?? env.PUBLIC_TOOLS_DAILY_CAP };
  const verify = turnstile(options.turnstileSecret ?? env.TURNSTILE_SECRET_KEY);

  const killSwitch = (_req: Request, _res: Response, next: NextFunction) =>
    enabled ? next() : next(new HttpError(503, "MODEL_UNAVAILABLE", "The free tools are paused right now. Please try again later."));

  const perMinute = limiter(
    60_000,
    options.perMinute ?? 5,
    "You're going fast. Wait a minute, or sign up free to ask your real database."
  );
  const perDay = limiter(
    24 * 60 * 60_000,
    options.perDay ?? 30,
    "You've used today's free tool requests. Sign up free to keep going."
  );

  for (const tool of Object.keys(TOOL_SCHEMAS) as PublicTool[]) {
    router.post(
      `/tools/${tool}`,
      killSwitch,
      perMinute,
      perDay,
      validate(TOOL_SCHEMAS[tool]),
      verify,
      asyncHandler(toolHandler(tool, deps))
    );
  }

  router.post(
    "/contact",
    limiter(60 * 60_000, 5, "Too many messages. Please try again in an hour."),
    validate(ContactBodySchema),
    verify,
    asyncHandler(createContactMessage)
  );

  return router;
}

export default createPublicRouter();
