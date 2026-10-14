import crypto from "crypto";
import * as brain from "@wup/brain";
import * as ingestor from "@wup/ingestor";
import { User } from "@wup/models";
import { HttpError } from "../lib/httpError";
import { env } from "../config/env";

/** The pre-redesign web client starts demo mode by logging in as this email with no password. */
export const LEGACY_DEMO_EMAIL = "google-demo@wup.ai";
export const DEMO_EMAIL_DOMAIN = "demo.wuup.in";
/** Demo seeding is awaited at most this long; anything slower finishes in the background. */
export const DEMO_SEED_TIMEOUT_MS = 8000;
const PURGE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface DemoSession {
  user: any;
  expiresAt: Date;
  seededKnowledge: boolean;
  seededBridge: boolean;
}

/** Resolves to the task's success, or false after `ms` (the task keeps running). */
function within(ms: number, task: () => Promise<unknown>): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    timer.unref?.();
    Promise.resolve()
      .then(task)
      .then(
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        (err: any) => {
          clearTimeout(timer);
          console.error("[WUP API] Demo seeding step failed:", err?.message ?? err);
          resolve(false);
        }
      );
  });
}

export async function countActiveDemos(now = new Date()): Promise<number> {
  return User.countDocuments({ isDemo: true, demoExpiresAt: { $gt: now }, deletingAt: { $exists: false } });
}

/**
 * Creates an isolated, throwaway demo account: its own user, bridges,
 * documents and quota, so demo visitors never see each other's data.
 *
 * Throws 503 DEMO_UNAVAILABLE when demos are disabled or at capacity.
 */
export async function createDemoSession(): Promise<DemoSession> {
  if (!env.DEMO_ENABLED) {
    throw new HttpError(503, "DEMO_UNAVAILABLE", "The demo is not available right now. Please sign up instead.");
  }
  if ((await countActiveDemos()) >= env.DEMO_MAX_ACTIVE) {
    throw new HttpError(503, "DEMO_UNAVAILABLE", "The demo is busy right now. Please try again shortly or sign up.");
  }

  const now = Date.now();
  const expiresAt = new Date(now + env.DEMO_TTL_HOURS * 60 * 60 * 1000);
  const user: any = await User.create({
    email: `demo-${crypto.randomUUID()}@${DEMO_EMAIL_DOMAIN}`,
    password: null,
    name: "Guest",
    role: "Demo",
    isDemo: true,
    demoExpiresAt: expiresAt,
    purgeAt: new Date(expiresAt.getTime() + PURGE_GRACE_MS),
    freeTierUsage: 0,
    freeTierLimit: env.DEMO_MESSAGE_LIMIT,
    customApiKey: "",
    lastLoginAt: new Date(now),
  });
  const userId = String(user._id);

  const seedKnowledge = (ingestor as any).seedTemplateKnowledge;
  const createSampleBridge = (brain as any).createSampleBridge;

  const [seededKnowledge, seededBridge] = await Promise.all([
    typeof seedKnowledge === "function" && env.GEMINI_API_KEY
      ? within(DEMO_SEED_TIMEOUT_MS, () => seedKnowledge(userId, "demo-guide"))
      : Promise.resolve(false),
    typeof createSampleBridge === "function" && env.SAMPLE_MONGODB_URI
      ? within(DEMO_SEED_TIMEOUT_MS, () => createSampleBridge(userId))
      : Promise.resolve(false),
  ]);

  return { user, expiresAt, seededKnowledge, seededBridge };
}
