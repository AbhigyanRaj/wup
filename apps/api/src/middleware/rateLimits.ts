/**
 * Shared rate limiters. Each answers 429 with an ApiError body
 * ({ error, code: "RATE_LIMITED", retryAfterS, requestId }) and sends the
 * RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset headers.
 *
 * Per-IP limiters rely on `app.set("trust proxy", env.TRUST_PROXY)`.
 * Per-user limiters must be mounted AFTER authenticate (they fall back to the IP).
 *
 *   router.post("/login", loginLimiter, handler);
 *   router.post("/:chatId/messages", authenticate, chatLimiter, handler);
 *
 * Tests: call resetRateLimits() to clear every counter.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { rateLimit, MemoryStore, type Options } from "express-rate-limit";
import { env } from "../config/env";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const stores: MemoryStore[] = [];

/** Clears every limiter's counters (for tests). */
export function resetRateLimits(): void {
  for (const s of stores) s.resetAll();
}

const ipKey = (req: Request): string => req.ip ?? req.socket?.remoteAddress ?? "unknown";
const userKey = (req: Request): string => {
  const id = req.auth?.userId ?? req.user?.id;
  return id ? `u:${id}` : `ip:${ipKey(req)}`;
};

interface LimiterSpec {
  windowMs: number;
  limit: number;
  message: string;
  key?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

/** Builds a limiter with the shared JSON error body and headers. */
export function createLimiter(spec: LimiterSpec): RequestHandler {
  const store = new MemoryStore();
  stores.push(store);
  const options: Partial<Options> = {
    windowMs: spec.windowMs,
    limit: spec.limit,
    standardHeaders: "draft-6",
    legacyHeaders: false,
    store,
    keyGenerator: spec.key ?? ipKey,
    skip: (req) => req.method === "OPTIONS" || (spec.skip ? spec.skip(req) : false),
    handler: (req: Request, res: Response, _next: NextFunction) => {
      const resetTime: Date | undefined = (req as any).rateLimit?.resetTime;
      const retryAfterS = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(spec.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfterS));
      const requestId = (req as any).id;
      res.status(429).json({
        error: spec.message,
        code: "RATE_LIMITED",
        retryAfterS,
        ...(requestId ? { requestId: String(requestId) } : {}),
      });
    },
  };
  return rateLimit(options);
}

/** 300 requests per 5 minutes per IP, across the whole API. */
export const globalLimiter = createLimiter({
  windowMs: 5 * MINUTE,
  limit: 300,
  message: "Too many requests. Please slow down and try again shortly.",
  skip: (req) => req.path === "/health" || req.path === "/",
});

/** 20 login attempts per 15 minutes per IP. */
export const loginLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many login attempts. Please wait a few minutes and try again.",
});

/** 10 signups per hour per IP. */
export const signupLimiter = createLimiter({
  windowMs: HOUR,
  limit: 10,
  message: "Too many sign-up attempts. Please try again later.",
});

/** 5 demo sessions per hour per IP. */
export const demoLimiter = createLimiter({
  windowMs: HOUR,
  limit: 5,
  message: "Too many demo sessions from this network. Please try again later.",
});

/** CHAT_RATE_LIMIT_PER_MIN messages per minute per user. */
export const chatLimiter = createLimiter({
  windowMs: MINUTE,
  limit: env.CHAT_RATE_LIMIT_PER_MIN,
  key: userKey,
  message: "You are sending messages too quickly. Please wait a moment.",
});

/** 10 connection create/test calls per 10 minutes per user. */
export const connectionLimiter = createLimiter({
  windowMs: 10 * MINUTE,
  limit: 10,
  key: userKey,
  message: "Too many connection attempts. Please wait a few minutes and try again.",
});

/** UPLOAD_RATE_LIMIT_PER_HOUR uploads per hour per user. */
export const uploadLimiter = createLimiter({
  windowMs: HOUR,
  limit: env.UPLOAD_RATE_LIMIT_PER_HOUR,
  key: userKey,
  message: `Too many uploads. Maximum ${env.UPLOAD_RATE_LIMIT_PER_HOUR} per hour. Please wait and try again.`,
});

/** 10 waitlist sign-ups per hour per IP. */
export const waitlistLimiter = createLimiter({
  windowMs: HOUR,
  limit: 10,
  message: "Too many requests. Please try again later.",
});
