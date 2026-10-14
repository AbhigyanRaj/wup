import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserPayload } from "@wup/auth";

// Legacy development fallback. Never acceptable in production.
const LEGACY_DEFAULT_JWT_SECRET = "wup_super_secret_brain_key_2026";

/**
 * Resolves the JWT signing secret. In production a missing secret, or the
 * legacy default (which is public in the repo), is a fatal misconfiguration:
 * anyone could forge tokens. Fail fast at module load in that case.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV === "production") {
    if (!secret || secret === LEGACY_DEFAULT_JWT_SECRET) {
      throw new Error("JWT_SECRET must be set to a non-default value in production");
    }
    return secret;
  }
  if (!secret) {
    console.warn("[WUP API] JWT_SECRET is not set; using the insecure development default.");
    return LEGACY_DEFAULT_JWT_SECRET;
  }
  return secret;
}

export const JWT_SECRET = resolveJwtSecret();

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

/**
 * Middleware to protect routes by verifying the JWT token.
 * Attaches the user payload to the request object.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};
