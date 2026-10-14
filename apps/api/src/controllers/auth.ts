import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { User } from "@wup/models";
import type { ChangePasswordBody, LoginBody, SignupBody } from "@wup/contracts";
import { toLegacyUser, toUserDTO } from "../dto/user";
import { createDemoSession, DEMO_EMAIL_DOMAIN, LEGACY_DEMO_EMAIL } from "../services/demo";
import {
  hashPassword,
  needsRehash,
  normalizeEmail,
  passwordContainsEmail,
  verifyPassword,
} from "../services/password";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";
import { asyncHandler } from "../lib/asyncHandler";
import { clearSession, issueSession } from "../lib/session";
import { demoLimiter } from "../middleware/rateLimits";

const invalidCredentials = () => new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password");

const passwordHasEmailError = (path: string) =>
  new HttpError(400, "VALIDATION_FAILED", "Password must not contain your email name", [
    { path, message: "Password must not contain your email name" },
  ]);

/**
 * Finds a user by normalised email. Falls back to a case-insensitive match so
 * legacy mixed-case rows keep working until migration 003 has run.
 */
export async function findUserByEmail(email: string): Promise<any | null> {
  const exact = await User.findOne({ email });
  if (exact) return exact;
  return User.findOne({ email }).collation({ locale: "en", strength: 2 });
}

/**
 * Loads the signed-in user (after authenticate, which has already checked the
 * token and sessionVersion). Re-checks account state on the full document so
 * a deletion or demo expiry that raced the request is still refused.
 */
export async function loadAuthedUser(req: Request): Promise<any> {
  const id = req.auth?.userId ?? req.user?.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }
  const user: any = await User.findById(id);
  if (!user || user.deletingAt) {
    throw new HttpError(401, "UNAUTHENTICATED", "Your session has ended. Please sign in again.");
  }
  if (user.isDemo && user.demoExpiresAt && new Date(user.demoExpiresAt).getTime() <= Date.now()) {
    throw new HttpError(401, "DEMO_EXPIRED", "Your demo has ended. Sign up to keep exploring.");
  }
  return user;
}

/** NFKC-normalises a raw email before schema validation (which trims and lowercases). */
export function normalizeEmailInput(req: Request, _res: Response, next: NextFunction) {
  const body = req.body;
  if (body && typeof body === "object" && typeof body.email === "string") {
    body.email = body.email.normalize("NFKC");
  }
  next();
}

// ─── Signup ───────────────────────────────────────────────────────────────────

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email: rawEmail, password, name } = req.body as SignupBody;
  const email = normalizeEmail(rawEmail);

  if (email.endsWith(`@${DEMO_EMAIL_DOMAIN}`) || email === LEGACY_DEMO_EMAIL) {
    throw new HttpError(400, "VALIDATION_FAILED", "Please use a different email address", [
      { path: "email", message: "Please use a different email address" },
    ]);
  }
  if (passwordContainsEmail(password, email)) throw passwordHasEmailError("password");

  const conflict = () => new HttpError(409, "CONFLICT", "An account with this email already exists. Try signing in.");
  if (await findUserByEmail(email)) throw conflict();

  let user: any;
  try {
    user = await User.create({
      email,
      password: await hashPassword(password),
      name: name ?? undefined,
      role: "Founder",
      freeTierUsage: 0,
      freeTierLimit: env.FREE_TIER_LIMIT,
      lastLoginAt: new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) throw conflict();
    throw err;
  }

  const token = issueSession(res, user);
  res.status(201).json({ user: toUserDTO(user), token });
});

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Legacy demo entry: the old web client posts { email: "google-demo@wup.ai" }
 * with no password. That creates an isolated demo account through the demo
 * service. Runs before body validation, which would reject the empty password.
 */
export function legacyDemoLogin(req: Request, res: Response, next: NextFunction) {
  const b = req.body ?? {};
  const noPassword = b.password === undefined || b.password === null || b.password === "";
  if (typeof b.email !== "string" || !noPassword || normalizeEmail(b.email) !== LEGACY_DEMO_EMAIL) {
    return next();
  }
  demoLimiter(req, res, (err?: unknown) => {
    if (err) return next(err);
    startLegacyDemo(req, res, next);
  });
}

const startLegacyDemo = asyncHandler(async (_req: Request, res: Response) => {
  const demo = await createDemoSession();
  const token = issueSession(res, demo.user);
  res.json({ token, user: toLegacyUser(demo.user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email: rawEmail, password } = req.body as LoginBody;
  const email = normalizeEmail(rawEmail);

  let user: any = await findUserByEmail(email);

  if (!user) {
    if (!env.LEGACY_AUTO_SIGNUP) {
      await verifyPassword(password, null); // equal-time failure
      throw invalidCredentials();
    }
    // Legacy behaviour: the old web client has no separate sign-up form.
    try {
      user = await User.create({
        email,
        password: await hashPassword(password),
        role: "Founder",
        freeTierUsage: 0,
        freeTierLimit: env.FREE_TIER_LIMIT,
        lastLoginAt: new Date(),
      });
    } catch (err: any) {
      if (err?.code === 11000) throw invalidCredentials();
      throw err;
    }
    const token = issueSession(res, user);
    return res.json({ token, user: toLegacyUser(user) });
  }

  // Demo accounts have no password; accounts being deleted cannot sign in.
  const usable = !user.isDemo && !user.deletingAt;
  const ok = await verifyPassword(password, usable ? user.password : null);
  if (!ok || !usable) throw invalidCredentials();

  const set: Record<string, unknown> = { lastLoginAt: new Date() };
  if (needsRehash(user.password)) set.password = await hashPassword(password);
  await User.updateOne({ _id: user._id }, { $set: set });
  Object.assign(user, set);

  const token = issueSession(res, user);
  res.json({ token, user: toLegacyUser(user) });
});

// ─── Demo ─────────────────────────────────────────────────────────────────────

export const demo = asyncHandler(async (_req: Request, res: Response) => {
  const d = await createDemoSession();
  const token = issueSession(res, d.user);
  res.status(201).json({
    user: toUserDTO(d.user),
    demo: {
      expiresAt: d.expiresAt.toISOString(),
      seededKnowledge: d.seededKnowledge,
      seededBridge: d.seededBridge,
    },
    token,
  });
});

// ─── Session ──────────────────────────────────────────────────────────────────

export const logout = (_req: Request, res: Response) => {
  clearSession(res);
  res.status(204).end();
};

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  res.json({ user: toUserDTO(user) });
});

/** Legacy: the old web client calls this on load and reads data.user.email / role. */
export const verify = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  res.json({ valid: true, user: toLegacyUser(user) });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const { currentPassword, newPassword } = req.body as ChangePasswordBody;

  if (user.isDemo || !user.password) {
    throw new HttpError(403, "FORBIDDEN", "Demo accounts do not have a password. Sign up to set one.");
  }
  if (!(await verifyPassword(currentPassword, user.password))) {
    throw new HttpError(400, "VALIDATION_FAILED", "Current password is incorrect", [
      { path: "currentPassword", message: "Current password is incorrect" },
    ]);
  }
  if (passwordContainsEmail(newPassword, user.email)) throw passwordHasEmailError("newPassword");

  // Legacy rows may lack sessionVersion entirely; null matches a missing field.
  const sv = Number(user.sessionVersion ?? 0);
  const r = await User.updateOne(
    { _id: user._id, sessionVersion: sv === 0 ? { $in: [0, null] } : sv },
    { $set: { password: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 } }
  );
  if (r.modifiedCount === 0) {
    throw new HttpError(409, "CONFLICT", "Your account changed while saving. Please try again.");
  }

  const fresh: any = await User.findById(user._id);
  const token = issueSession(res, fresh);
  res.json({ user: toUserDTO(fresh), token });
});
