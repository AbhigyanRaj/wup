import { z } from "zod";

/**
 * Shared conventions for the wuup HTTP API.
 *
 * - Every id on the wire is a 24-char hex string (`Id`).
 * - Every date on the wire is an ISO 8601 string (`ISODate`).
 * - Cursor-paginated lists use `Page<T>`.
 * - Every non-2xx JSON response is an `ApiError`.
 */

export type Id = string;
export type ISODate = string;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const IdSchema = z.string();
export const ISODateSchema = z.string();

/** A MongoDB ObjectId as a 24-char hex string. Use for ids supplied by the client. */
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** Builds a `Page<T>` schema for a given item schema. */
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

// ─── Errors ───────────────────────────────────────────────────────────────────

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "FREE_LIMIT_REACHED",
  "DEMO_EXPIRED",
  "DEMO_UNAVAILABLE",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_FILE",
  "BRIDGE_UNREACHABLE",
  "BRIDGE_BLOCKED_HOST",
  "SHEETS_NOT_SHARED",
  "SHEETS_NOT_CONFIGURED",
  "PROVIDER_ERROR",
  "PROVIDER_AUTH",
  "MODEL_UNAVAILABLE",
  "CHAT_BUSY",
  "ABORTED",
  "INTERNAL",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

export const ApiErrorSchema = z.object({
  /** Human readable message, safe to show to the user. */
  error: z.string(),
  code: ErrorCodeSchema,
  /** Per-field problems, present for VALIDATION_FAILED. */
  details: z.array(ErrorDetailSchema).optional(),
  requestId: z.string().optional(),
  /** Seconds until the client may retry (RATE_LIMITED, CHAT_BUSY, MODEL_UNAVAILABLE). */
  retryAfterS: z.number().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Suggested HTTP status for each error code. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  FREE_LIMIT_REACHED: 429,
  DEMO_EXPIRED: 401,
  DEMO_UNAVAILABLE: 503,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  BRIDGE_UNREACHABLE: 502,
  BRIDGE_BLOCKED_HOST: 400,
  SHEETS_NOT_SHARED: 403,
  SHEETS_NOT_CONFIGURED: 503,
  PROVIDER_ERROR: 502,
  PROVIDER_AUTH: 401,
  MODEL_UNAVAILABLE: 503,
  CHAT_BUSY: 409,
  ABORTED: 499,
  INTERNAL: 500,
};

export function isApiError(value: unknown): value is ApiError {
  return ApiErrorSchema.safeParse(value).success;
}

// ─── Limits shared by client and server ───────────────────────────────────────

export const LIMITS = {
  maxPromptChars: 8000,
  maxChatTitle: 120,
  maxChatSearch: 100,
  maxChatPageSize: 50,
  maxBridgesPerChat: 50,
  maxFeedbackNote: 1000,
  maxPreferenceText: 1500,
  maxNameLength: 80,
  maxEmailLength: 254,
  minPasswordBytes: 10,
  /** bcrypt silently truncates input past 72 bytes, so reject it instead. */
  maxPasswordBytes: 72,
  maxFollowUps: 3,
  maxContactMessage: 4000,
} as const;

/** UTF-8 byte length without relying on Buffer or TextEncoder (works in every runtime). */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
  }
  return bytes;
}
