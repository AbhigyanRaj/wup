/**
 * Dependency seam for the chat controllers.
 *
 * Everything the chat API needs from other workstreams goes through this file:
 *   - WS-1  HttpError, asyncHandler, validate, objectIdParam, chatLimiter, env, auth
 *   - WS-5  reserveQuota, settleQuota, resolveLlmCredentials, validateRequestedModel, recordUsage
 *   - WS-3a brain.run, brain.generateTitle, brain.heuristicTitle
 *
 * The brain must expose `run` (WS-3a). The deprecated `askStream` wrapper is
 * never used: it reads the legacy plaintext key and charges free-tier usage
 * itself, which would bypass resolveLlmCredentials and double-charge.
 */
import type { Request } from "express";
import { type ErrorCode, type ErrorDetail, ERROR_CODES, type PlanTier } from "@wup/contracts";
import { User } from "@wup/models";
import { brain as defaultBrain } from "@wup/brain";
import { HttpError } from "../../lib/httpError";
import { planTier } from "../../dto/user";
import type { LlmCredentials } from "../../services/llmCredentials";

export { HttpError } from "../../lib/httpError";
export { asyncHandler } from "../../lib/asyncHandler";
export { validate } from "../../middleware/validate";
export { objectIdParam, isObjectIdString } from "../../lib/objectId";
export { chatLimiter } from "../../middleware/rateLimits";
export { env } from "../../config/env";
export { resolveLlmCredentials, validateRequestedModel, type LlmCredentials } from "../../services/llmCredentials";
export { recordUsage } from "../../services/usage";
export { reserveQuota, settleQuota, type QuotaReservation } from "../../services/quota";

// ─── Errors ───────────────────────────────────────────────────────────────────

export const httpError = (
  status: number,
  code: ErrorCode,
  message: string,
  extra: { details?: ErrorDetail[]; retryAfterS?: number } = {}
) => new HttpError(status, code, message, extra.details, { retryAfterS: extra.retryAfterS });

export const notFound = (what = "Chat") => httpError(404, "NOT_FOUND", `${what} not found`);

const KNOWN_CODES = new Set<string>(ERROR_CODES);
export const isErrorCode = (v: unknown): v is ErrorCode => typeof v === "string" && KNOWN_CODES.has(v);

// ─── Request helpers ──────────────────────────────────────────────────────────

/** authenticate sets req.auth.userId (legacy middleware: req.user.id). */
export function getUserId(req: Request): string {
  const id = req.auth?.userId ?? req.user?.id;
  if (!id) throw HttpError.unauthenticated("Please sign in again.");
  return String(id);
}

/** The pino-http request id. */
export function getRequestId(req: Request): string | undefined {
  const id = (req as any).id;
  return id === undefined || id === null ? undefined : String(id);
}

export function validatedQuery<T>(req: Request): T {
  return (req.validatedQuery ?? req.query) as T;
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export async function getUsageSnapshot(userId: string): Promise<{ tier: PlanTier; freeTierUsage: number; freeTierLimit: number }> {
  const user: any = await User.findById(userId).lean();
  return {
    tier: planTier(user),
    freeTierUsage: Number(user?.freeTierUsage ?? 0),
    freeTierLimit: Number(user?.freeTierLimit ?? 0),
  };
}

// ─── Brain contract (WS-3a) ───────────────────────────────────────────────────

export interface BrainHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface BrainRequest {
  userId: string;
  prompt: string;
  mode: "chat" | "research";
  history: BrainHistoryTurn[];
  model?: string;
  searchWeb?: boolean;
  bridgeIds?: string[];
  llm: LlmCredentials;
  preferences?: unknown;
  previousWasClarification?: boolean;
}

/** status / token / tool / sources / step events, shaped like @wup/contracts StreamEvent. */
export type BrainEmitEvent = { type: string; [key: string]: unknown };

/** Structural view of WS-3a's BrainResult (only what the API reads). */
export interface BrainResult {
  content: string;
  followUps?: unknown[];
  clarification?: unknown;
  visualType?: unknown;
  chartData?: unknown;
  tableData?: unknown;
  diagramData?: unknown;
  sources?: unknown[];
  queries?: unknown[];
  research?: { steps?: unknown[]; durationMs?: number } | null;
  model?: { provider?: string; id?: string; usingOwnKey?: boolean } | null;
  usage?: { tokensIn?: number | null; tokensOut?: number | null } | null;
  toolCalls?: number | unknown[];
  firstTokenMs?: number | null;
  exhausted?: string[];
  producedOutput?: boolean;
  outcome?: string;
  error?: { code?: string; message?: string; retryable?: boolean } | null;
}

export interface ChatBrain {
  run(req: BrainRequest, opts: { emit: (ev: BrainEmitEvent) => void; signal: AbortSignal }): Promise<BrainResult>;
  generateTitle?(prompt: string, llm: LlmCredentials, signal?: AbortSignal): Promise<string>;
  heuristicTitle?(prompt: string): string;
}

/** First line of the prompt, at most 8 words / 60 chars (used when the brain has no heuristicTitle). */
export function localHeuristicTitle(prompt: string): string {
  const line = prompt.replace(/\s+/g, " ").trim();
  const words = line.split(" ").slice(0, 8).join(" ");
  const clipped = words.length > 60 ? words.slice(0, 60).replace(/\s+\S*$/, "") : words;
  return clipped.replace(/[.,;:!?\s]+$/, "") || "New chat";
}

const hasRun = (b: any): b is ChatBrain => Boolean(b) && typeof b.run === "function";

/**
 * req.app.locals.brain (createApp({brain}) / tests), else the package brain.
 * A brain without `run` is a deploy mismatch: fail with a JSON 503 before any
 * quota is reserved rather than fall back to askStream.
 */
export function resolveBrain(req: Request): ChatBrain {
  const candidate = (req.app?.locals as any)?.brain ?? defaultBrain;
  if (hasRun(candidate)) return candidate;
  throw httpError(503, "MODEL_UNAVAILABLE", "The assistant is being updated. Please try again in a minute.", { retryAfterS: 30 });
}
