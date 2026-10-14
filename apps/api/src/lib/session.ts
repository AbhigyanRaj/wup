/**
 * Session tokens and the session cookie.
 *
 * Token payload (HS256, issuer "wuup-api"):
 *   { sub, sv, demo, id, email, role }
 * `sub`/`sv`/`demo` drive authentication. `id`/`email`/`role` are kept so the
 * legacy web client, which reads the token payload from GET /auth/verify, keeps
 * working with new tokens.
 *
 * Cookie: httpOnly, SameSite=Lax, Path=/, Max-Age SESSION_TTL_DAYS.
 *   production:                 `__Host-wuup_session` (Secure, no Domain)
 *   production + COOKIE_DOMAIN: `__Secure-wuup_session` (Secure, Domain set)
 *   otherwise:                  `wuup_session` (not Secure, so http://localhost works)
 *
 * Usage (login/signup):
 *   const token = issueSession(res, user);
 *   res.json({ token, user });   // `token` keeps the legacy Bearer client working
 */
import type { Request, Response, CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { env, JWT_SECRET } from "../config/env";

export { JWT_SECRET };

export const TOKEN_ISSUER = "wuup-api";
export const DEV_COOKIE_NAME = "wuup_session";
export const HOST_COOKIE_NAME = "__Host-wuup_session";
export const SECURE_COOKIE_NAME = "__Secure-wuup_session";

/** Every cookie name a session may be stored under, most specific first. */
export const SESSION_COOKIE_NAMES = [HOST_COOKIE_NAME, SECURE_COOKIE_NAME, DEV_COOKIE_NAME] as const;

export function sessionTtlMs(): number {
  return env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/** The cookie name this server writes. */
export function sessionCookieName(): string {
  if (!env.IS_PRODUCTION) return DEV_COOKIE_NAME;
  return env.COOKIE_DOMAIN ? SECURE_COOKIE_NAME : HOST_COOKIE_NAME;
}

function cookieOptions(): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
  };
  if (env.IS_PRODUCTION && env.COOKIE_DOMAIN) opts.domain = env.COOKIE_DOMAIN;
  return opts;
}

/** Minimal user shape needed to sign a session. Works with docs and lean objects. */
export interface SessionUser {
  _id: unknown;
  email?: string | null;
  role?: string | null;
  isDemo?: boolean | null;
  sessionVersion?: number | null;
}

export interface SessionTokenPayload {
  sub: string;
  sv: number;
  demo: boolean;
  iss: typeof TOKEN_ISSUER;
  // Legacy-compatible fields
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** Legacy token payload issued before sessions existed. Still accepted. */
export interface LegacyTokenPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** Signs a new-style session token for `user`. */
export function signToken(user: SessionUser): string {
  const id = String(user._id);
  const payload = {
    sub: id,
    sv: user.sessionVersion ?? 0,
    demo: !!user.isDemo,
    id,
    email: user.email ?? "",
    role: user.role ?? "Founder",
  };
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    issuer: TOKEN_ISSUER,
    expiresIn: `${env.SESSION_TTL_DAYS}d`,
  });
}

/** Verifies a token (HS256 only). Returns the payload or null. */
export function verifyToken(token: string): (SessionTokenPayload | LegacyTokenPayload) | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload || typeof payload !== "object") return null;
    return payload as SessionTokenPayload | LegacyTokenPayload;
  } catch {
    return null;
  }
}

export function isSessionPayload(p: unknown): p is SessionTokenPayload {
  return !!p && typeof p === "object" && (p as any).iss === TOKEN_ISSUER && typeof (p as any).sub === "string";
}

/** Sets the session cookie and returns the signed token (for legacy `token` responses). */
export function issueSession(res: Response, user: SessionUser): string {
  const token = signToken(user);
  res.cookie(sessionCookieName(), token, { ...cookieOptions(), maxAge: sessionTtlMs() });
  return token;
}

/** Clears the session cookie (every name this server may have written). */
export function clearSession(res: Response): void {
  const opts = cookieOptions();
  res.clearCookie(sessionCookieName(), opts);
  if (!env.IS_PRODUCTION) return;
  // Also clear the other production variant in case COOKIE_DOMAIN changed
  if (env.COOKIE_DOMAIN) res.clearCookie(HOST_COOKIE_NAME, { ...opts, domain: undefined });
}

/** Reads the session token from the request cookies, if any. */
export function readSessionCookie(req: Request): string | null {
  const cookies = (req as any).cookies as Record<string, unknown> | undefined;
  if (!cookies) return null;
  // In production only the prefixed names count: a plain `wuup_session` cookie
  // could be planted by a sibling subdomain (cookie tossing).
  const names = env.IS_PRODUCTION ? [HOST_COOKIE_NAME, SECURE_COOKIE_NAME] : SESSION_COOKIE_NAMES;
  for (const name of names) {
    const v = cookies[name];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

/** True when more than half of the token's lifetime has passed. */
export function shouldRefresh(payload: { iat?: number; exp?: number }, nowMs = Date.now()): boolean {
  if (!payload.iat || !payload.exp) return false;
  const lifetime = payload.exp - payload.iat;
  return nowMs / 1000 - payload.iat > lifetime / 2;
}
