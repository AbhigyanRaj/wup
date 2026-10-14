/**
 * CSRF protection for cookie sessions.
 *
 * A state-changing request (POST/PUT/PATCH/DELETE) that carries the session
 * cookie must come from an allowed Origin (or, when Origin is absent, a Referer
 * whose origin is allowed). Otherwise: 403 FORBIDDEN.
 *
 * Requests with `Authorization: Bearer` are exempt: a cross-site page cannot set
 * that header without passing CORS. Requests without the session cookie are not
 * affected (there is no ambient credential to abuse).
 *
 * Mounted globally in app.ts after cookie-parser.
 */
import type { NextFunction, Request, Response } from "express";
import { env, isAllowedOrigin, type Env } from "../config/env";
import { HttpError } from "../lib/httpError";
import { readSessionCookie } from "../lib/session";
import { extractBearerToken } from "./auth";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin && origin !== "null") return origin;
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

export function createCsrfProtection(e: Env = env) {
  return function csrfProtection(req: Request, _res: Response, next: NextFunction) {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    if (extractBearerToken(req.headers.authorization)) return next();
    if (!readSessionCookie(req)) return next();
    if (isAllowedOrigin(requestOrigin(req), e)) return next();
    next(HttpError.forbidden("Request origin is not allowed."));
  };
}

export const csrfProtection = createCsrfProtection();
