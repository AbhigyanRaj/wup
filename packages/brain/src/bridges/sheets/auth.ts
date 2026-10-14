import crypto from "crypto";
import fs from "fs";
import { google } from "googleapis";

/**
 * Google credentials for Sheets bridges.
 *
 * Preferred: a service account, from GOOGLE_SERVICE_ACCOUNT_JSON (inline JSON
 * or base64 of it) or GOOGLE_SERVICE_ACCOUNT_JSON_PATH (a key file). Users
 * share their sheet with the service account's email as a Viewer.
 *
 * Fallback (only when no service account is configured): the server's
 * GEMINI_API_KEY as a Google API key, which can read public sheets only.
 * The key is never logged.
 */

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

type GoogleAuthT = InstanceType<typeof google.auth.GoogleAuth>;

interface AuthState {
  envKey: string;
  auth: GoogleAuthT | null;
  email: string | null;
}

let cached: AuthState | undefined;

function parseInlineJson(raw: string): Record<string, any> | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    if (text.startsWith("{")) return JSON.parse(text);
    return JSON.parse(Buffer.from(text, "base64").toString("utf8"));
  } catch {
    console.warn("[WUP Sheets] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64 JSON; ignoring it.");
    return null;
  }
}

function loadState(env: NodeJS.ProcessEnv = process.env): AuthState {
  const inline = env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  const keyPath = env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH ?? "";
  const envKey = crypto.createHash("sha256").update(`${inline}\0${keyPath}`).digest("hex");
  if (cached && cached.envKey === envKey) return cached;

  let state: AuthState = { envKey, auth: null, email: null };
  const credentials = inline ? parseInlineJson(inline) : null;
  if (credentials?.client_email && credentials?.private_key) {
    state = {
      envKey,
      auth: new google.auth.GoogleAuth({ credentials, scopes: [SHEETS_SCOPE] }),
      email: String(credentials.client_email),
    };
  } else if (keyPath) {
    try {
      const file = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      state = {
        envKey,
        auth: new google.auth.GoogleAuth({ keyFile: keyPath, scopes: [SHEETS_SCOPE] }),
        email: typeof file?.client_email === "string" ? file.client_email : null,
      };
    } catch {
      console.warn("[WUP Sheets] Could not read GOOGLE_SERVICE_ACCOUNT_JSON_PATH; falling back to public sheets only.");
    }
  }
  cached = state;
  return state;
}

/** The cached GoogleAuth for the service account, or null when none is configured. */
export function getSheetsAuth(): GoogleAuthT | null {
  return loadState().auth;
}

/** The service account email users share their sheets with, or null. */
export function getServiceAccountEmail(): string | null {
  return loadState().email;
}

/** API key for public sheets, used only when no service account is configured. */
export function getPublicApiKey(): string | null {
  if (getSheetsAuth()) return null;
  return process.env.GEMINI_API_KEY || null;
}

/** Whether Sheets bridges can work at all on this server. */
export function isSheetsConfigured(): boolean {
  return getSheetsAuth() !== null || getPublicApiKey() !== null;
}

/** Test hook: forget cached credentials (after changing env vars). */
export function resetSheetsAuthCache() {
  cached = undefined;
}
