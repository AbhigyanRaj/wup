import crypto from "crypto";
import * as brain from "@wup/brain";
import { User } from "@wup/models";
import { AUTO_MODEL_ID, LLM_PROVIDERS, type LlmProvider } from "@wup/contracts";
import { HttpError } from "../lib/httpError";
import { env } from "../config/env";
import { hasOwnKey } from "../dto/user";

/**
 * Credentials the brain should use for one request. Mirrors the WS-3a
 * `LlmCredentials` type: apiKey null means "use the server's Gemini keys".
 */
export interface LlmCredentials {
  provider: LlmProvider;
  apiKey: string | null;
  /** "server", or sha256(key).slice(0, 12) for a user's own key (cooldown / cache bucketing). */
  keyId: string;
}

const FALLBACK_ROTATION = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
];

/** The server-key Gemini rotation, from the brain when it exposes it. */
export function serverModelRotation(): string[] {
  const b = brain as any;
  const candidates = [b.GEMINI_MODEL_ROTATION, b.MODEL_ROTATION, b.BrainOrchestrator?.MODEL_ROTATION];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0 && c.every((m: unknown) => typeof m === "string")) return [...c];
  }
  return [...FALLBACK_ROTATION];
}

/** Display hint for a key: first 4 and last 4 characters (last 2 only for short keys). */
export function keyHint(apiKey: string): string {
  const k = apiKey.trim();
  if (k.length >= 16) return `${k.slice(0, 4)}••••${k.slice(-4)}`;
  return `••••${k.slice(-2)}`;
}

/** Matches the brain's LlmCredentials.keyId: "server", or sha256(key).slice(0, 12). */
const keyIdFor = (apiKey: string) => crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 12);

const normProvider = (p: unknown): LlmProvider =>
  (LLM_PROVIDERS as readonly string[]).includes(p as string) ? (p as LlmProvider) : "gemini";

/** Encrypts a key and verifies the round trip before anything is written. */
export function encryptApiKey(apiKey: string): { enc: string; hint: string } {
  const enc = brain.cryptoService.encrypt(apiKey);
  if (brain.cryptoService.decrypt(enc) !== apiKey) {
    throw new Error("API key encryption round trip failed");
  }
  return { enc, hint: keyHint(apiKey) };
}

/**
 * Moves a legacy plaintext key into customApiKeyEnc. The update is guarded on
 * the same plaintext value so a concurrent key change is never clobbered.
 * Returns true when this call migrated the row.
 */
export async function migrateLegacyKey(userId: unknown, plaintext: string): Promise<boolean> {
  if (!plaintext) return false;
  const { enc, hint } = encryptApiKey(plaintext);
  const r = await User.updateOne(
    { _id: userId, customApiKey: plaintext },
    { $set: { customApiKeyEnc: enc, customApiKeyHint: hint }, $unset: { customApiKey: 1 } }
  );
  return r.modifiedCount === 1;
}

/**
 * Resolves the LLM credentials for a user. Decrypts the BYOK key, and lazily
 * migrates a legacy plaintext key on first use. A key that cannot be
 * decrypted (for example after an ENCRYPTION_KEY change) is treated as absent
 * and logged, so the user falls back to the free tier instead of erroring.
 */
export async function resolveLlmCredentials(user: any): Promise<LlmCredentials> {
  const provider = normProvider(user?.customApiProvider);
  const legacy = typeof user?.customApiKey === "string" ? user.customApiKey : "";

  if (user?.customApiKeyEnc) {
    try {
      const apiKey = brain.cryptoService.decrypt(user.customApiKeyEnc);
      if (legacy) {
        // Both present (half-migrated row): drop the plaintext copy.
        await User.updateOne({ _id: user._id, customApiKey: legacy }, { $unset: { customApiKey: 1 } }).catch(() => {});
      }
      return { provider, apiKey, keyId: keyIdFor(apiKey) };
    } catch (err: any) {
      console.error(`[WUP API] Could not decrypt the stored API key for user ${String(user?._id)}`);
      if (!legacy) return { provider: "gemini", apiKey: null, keyId: "server" };
    }
  }

  if (legacy) {
    try {
      await migrateLegacyKey(user._id, legacy);
    } catch (err: any) {
      // Migration is best effort; the plaintext key still works for this request.
      console.error("[WUP API] Lazy BYOK migration failed:", err?.message ?? err);
    }
    return { provider, apiKey: legacy, keyId: keyIdFor(legacy) };
  }

  return { provider: "gemini", apiKey: null, keyId: "server" };
}

const BYOK_MODEL_ID = /^[\w.\-/:]{1,100}$/;
const LEGACY_AUTO_IDS = new Set(["auto", "auto-rotate"]);

/**
 * Validates a requested model id for this user.
 *   - undefined, "auto" (or the legacy "Auto-Rotate") -> "auto"
 *   - server-key users: the Gemini rotation plus SERVER_MODEL_ALLOWLIST
 *   - BYOK users: any id matching /^[\w.\-/:]{1,100}$/
 * Anything else is a 400 MODEL_UNAVAILABLE.
 */
export function validateRequestedModel(user: any, model?: string | null): string {
  if (model === undefined || model === null) return AUTO_MODEL_ID;
  if (typeof model !== "string") {
    throw new HttpError(400, "MODEL_UNAVAILABLE", "That model is not available");
  }
  const m = model.trim();
  if (!m || LEGACY_AUTO_IDS.has(m.toLowerCase())) return AUTO_MODEL_ID;

  if (hasOwnKey(user) && !user?.isDemo) {
    if (BYOK_MODEL_ID.test(m)) return m;
  } else {
    const allowed = new Set([...serverModelRotation(), ...env.SERVER_MODEL_ALLOWLIST]);
    if (allowed.has(m)) return m;
  }
  throw new HttpError(400, "MODEL_UNAVAILABLE", "That model is not available");
}
