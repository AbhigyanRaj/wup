/**
 * Client for the public tool endpoints (POST /public/tools/<tool>). No
 * credentials are sent: the tools need no account.
 */
import type { MongoQuery } from "./mongo-format";
import { SITE } from "@/lib/site";

export type PublicToolId = "mongodb-query" | "mongodb-aggregation" | "aggregation-explain" | "sql-to-mongodb";

export interface QueryToolResult extends MongoQuery {
  explanation: string[];
  assumptions: string[];
  warnings: string[];
  cached?: boolean;
}

export interface ExplainToolResult {
  summary: string;
  stages: Array<{ index: number; operator: string; plain: string }>;
  performanceNotes: string[];
  warnings: string[];
  cached?: boolean;
}

export interface ToolError {
  status: number;
  message: string;
  /** Present on 429: where to sign up for more. */
  signupUrl?: string;
  retryAfterS?: number;
}

export type ToolResponse<T> = { ok: true; data: T } | { ok: false; error: ToolError };

export async function callPublicTool<T>(tool: PublicToolId, body: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResponse<T>> {
  let res: Response;
  try {
    res = await fetch(`${SITE.apiUrl}/public/tools/${tool}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false, error: { status: 0, message: "Couldn't reach the server. Check your connection and try again." } };
  }
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (res.ok) return { ok: true, data: json as T };
  const details = Array.isArray(json.details) ? (json.details as Array<{ message?: string }>) : [];
  return {
    ok: false,
    error: {
      status: res.status,
      message: (details[0]?.message as string) || (json.error as string) || `Request failed (${res.status}).`,
      signupUrl: typeof json.signupUrl === "string" ? json.signupUrl : undefined,
      retryAfterS: typeof json.retryAfterS === "number" ? json.retryAfterS : undefined,
    },
  };
}

/** Same check the API runs, so we can warn before sending. */
const CREDENTIAL_RE = [
  /mongodb(\+srv)?:\/\//i,
  /-----BEGIN/,
  /\bsk-(proj-|ant-|or-)?[A-Za-z0-9_-]{20,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];

export function looksLikeCredential(...values: Array<string | undefined>): boolean {
  return values.some((v) => !!v && CREDENTIAL_RE.some((re) => re.test(v)));
}

export const CREDENTIALS_MESSAGE = "Don't paste credentials; a sample document is enough.";
