/**
 * Authentication middleware.
 *
 *   router.use(authenticate);          // 401 unless signed in
 *   router.post("/x", optionalAuthenticate, handler);  // req.auth set when signed in
 *
 * Token sources, in order: the session cookie, then `Authorization: Bearer`.
 * Accepted tokens (HS256 only):
 *   - session tokens  { sub, sv, demo, iss: "wuup-api", id, email, role }
 *   - legacy tokens   { id, email, role }   (held by the current web client)
 *
 * On success:
 *   req.auth = { userId, isDemo, via }
 *   req.user = { id, email, role, isDemo }   ((req as any).user.id keeps working)
 *
 * Rejections are 401 UNAUTHENTICATED, or 401 DEMO_EXPIRED for an expired demo.
 * Cookie sessions past half their lifetime get a fresh cookie (sliding session).
 */
import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "@wup/models";
import {
  LEGACY_DEFAULT_JWT_SECRET,
  JWT_SECRET as ENV_JWT_SECRET,
} from "../config/env";
import { HttpError } from "../lib/httpError";
import {
  isSessionPayload,
  issueSession,
  readSessionCookie,
  shouldRefresh,
  verifyToken,
  type LegacyTokenPayload,
  type SessionTokenPayload,
} from "../lib/session";

/**
 * Resolves the JWT signing secret. Kept for compatibility with the security
 * hotfix: in production a missing or legacy-default secret is fatal.
 * config/env.ts applies the same rule at boot.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV === "production") {
    if (!secret || secret === LEGACY_DEFAULT_JWT_SECRET) {
      throw new Error("JWT_SECRET must be set to a non-default value in production");
    }
    return secret;
  }
  return secret || LEGACY_DEFAULT_JWT_SECRET;
}

/** The JWT signing secret (from config/env). */
export const JWT_SECRET = ENV_JWT_SECRET;

/**
 * Extracts a token from an `Authorization: Bearer <token>` header.
 * Any other scheme (or a malformed header) yields null.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== "string") return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export type AuthSource = "cookie" | "bearer";

export interface AuthContext {
  userId: string;
  isDemo: boolean;
  via: AuthSource;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  isDemo: boolean;
}

const NO_TOKEN = "Access denied. No token provided.";
const INVALID_TOKEN = "Invalid or expired token.";

interface AuthUserDoc {
  _id: mongoose.Types.ObjectId;
  email?: string;
  role?: string;
  isDemo?: boolean;
  demoExpiresAt?: Date;
  deletingAt?: Date;
  sessionVersion?: number;
}

type Resolved =
  | { kind: "none" }
  | { kind: "error"; error: HttpError }
  | {
      kind: "ok";
      user: AuthUserDoc;
      payload: SessionTokenPayload | LegacyTokenPayload;
      via: AuthSource;
    };

async function resolveAuth(req: Request): Promise<Resolved> {
  const candidates: Array<{ token: string; via: AuthSource }> = [];
  const cookieToken = readSessionCookie(req);
  if (cookieToken) candidates.push({ token: cookieToken, via: "cookie" });
  const bearer = extractBearerToken(req.headers.authorization);
  if (bearer) candidates.push({ token: bearer, via: "bearer" });
  if (candidates.length === 0) return { kind: "none" };

  // A stale cookie must not shadow a valid Bearer token: use the first that verifies.
  let verified: { payload: SessionTokenPayload | LegacyTokenPayload; via: AuthSource } | null = null;
  for (const c of candidates) {
    const payload = verifyToken(c.token);
    if (payload) {
      verified = { payload, via: c.via };
      break;
    }
  }
  if (!verified) return { kind: "error", error: HttpError.unauthenticated(INVALID_TOKEN) };

  const { payload, via } = verified;
  const isNew = isSessionPayload(payload);
  const userId = isNew ? payload.sub : (payload as LegacyTokenPayload).id;
  if (typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
    return { kind: "error", error: HttpError.unauthenticated(INVALID_TOKEN) };
  }

  const user = (await User.findById(userId)
    .select("email role isDemo demoExpiresAt deletingAt sessionVersion")
    .lean()) as AuthUserDoc | null;

  if (!user || user.deletingAt) {
    return { kind: "error", error: HttpError.unauthenticated(INVALID_TOKEN) };
  }

  const currentSv = user.sessionVersion ?? 0;
  if (isNew) {
    if ((payload.sv ?? 0) !== currentSv) {
      return { kind: "error", error: HttpError.unauthenticated("Your session has ended. Please sign in again.") };
    }
  } else if (currentSv > 0) {
    // The user signed out everywhere or changed their password after this
    // legacy token was issued: it can no longer be trusted.
    return { kind: "error", error: HttpError.unauthenticated("Your session has ended. Please sign in again.") };
  }

  if (user.isDemo && user.demoExpiresAt && new Date(user.demoExpiresAt).getTime() < Date.now()) {
    return { kind: "error", error: new HttpError(401, "DEMO_EXPIRED", "Your demo session has ended.") };
  }

  return { kind: "ok", user, payload, via };
}

function attach(req: Request, res: Response, r: Extract<Resolved, { kind: "ok" }>): void {
  const id = String(r.user._id);
  const isDemo = !!r.user.isDemo;
  req.auth = { userId: id, isDemo, via: r.via };
  req.user = {
    id,
    email: r.user.email ?? (r.payload as any).email ?? "",
    role: r.user.role ?? (r.payload as any).role ?? "Founder",
    isDemo,
  };

  // Sliding session: refresh a cookie that is past half its lifetime
  if (r.via === "cookie" && isSessionPayload(r.payload) && shouldRefresh(r.payload)) {
    try {
      issueSession(res, r.user);
    } catch (err) {
      req.log?.warn({ err }, "session refresh failed");
    }
  }
}

/** Requires a valid session. */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  resolveAuth(req)
    .then((r) => {
      if (r.kind === "none") return next(HttpError.unauthenticated(NO_TOKEN));
      if (r.kind === "error") return next(r.error);
      attach(req, res, r);
      next();
    })
    .catch(next);
};

/** Sets req.auth / req.user when a valid session is present; never rejects. */
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  resolveAuth(req)
    .then((r) => {
      if (r.kind === "ok") attach(req, res, r);
      next();
    })
    .catch((err) => {
      req.log?.warn({ err }, "optional auth lookup failed");
      next();
    });
};

export const requireAuth = authenticate;
