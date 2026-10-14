/*
 * The one HTTP client for the authenticated app.
 *
 * - Always `credentials: "include"` (httpOnly session cookie) plus a Bearer
 *   fallback from localStorage when present.
 * - Non-2xx responses throw `ApiError` (both `{error, code}` and
 *   `{error: {code, message}}` bodies are understood).
 * - A 401 clears the local session, notifies `onUnauthorized` listeners (the
 *   AuthProvider redirects to /login) and then throws.
 */
import { API_URL } from "./env";
import { clearToken, getToken } from "./auth-token";
import type { ErrorCode, ErrorDetail } from "./types";

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body. Sets Content-Type and serialises for you. */
  json?: unknown;
  /** Raw body (FormData, Blob, string). Ignored when `json` is set. */
  body?: BodyInit | null;
  signal?: AbortSignal;
  /** Appended as a query string. null/undefined/"" values are skipped. */
  query?: Record<string, QueryValue>;
  headers?: HeadersInit;
  /**
   * Do not run the global 401 handler (no redirect, no toast). Used by the
   * initial session probe and by login/signup forms, where 401 is expected.
   */
  skipAuthHandler?: boolean;
}

/** Error thrown for every failed request. `status` 0 means a network failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "NETWORK" | "UNKNOWN" | (string & {});
  readonly details?: ErrorDetail[];
  readonly retryAfterS?: number;
  readonly requestId?: string;

  constructor(init: {
    status: number;
    code?: string;
    message: string;
    details?: ErrorDetail[];
    retryAfterS?: number;
    requestId?: string;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code ?? (init.status === 0 ? "NETWORK" : "UNKNOWN");
    this.details = init.details;
    this.retryAfterS = init.retryAfterS;
    this.requestId = init.requestId;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// ─── Unauthorized event ─────────────────────────────────────────────────────

type UnauthorizedListener = (info: { path: string }) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Subscribe to "session expired" events. Returns an unsubscribe function. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function emitUnauthorized(path: string) {
  clearToken();
  for (const l of unauthorizedListeners) {
    try {
      l({ path });
    } catch {
      /* listener errors never break the request path */
    }
  }
}

/** Auth endpoints where a 401 means "wrong password", not "session ended". */
const AUTH_FORM_PATHS = ["/auth/login", "/auth/signup", "/auth/demo", "/auth/change-password"];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

function buildHeaders(opts: ApiOptions, accept = "application/json"): Headers {
  const headers = new Headers(opts.headers);
  if (!headers.has("Accept")) headers.set("Accept", accept);
  if (opts.json !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/** Turns any error body shape into an ApiError. */
export function toApiError(status: number, body: unknown, retryAfterHeader?: string | null): ApiError {
  let code: string | undefined;
  let message: string | undefined;
  let details: ErrorDetail[] | undefined;
  let retryAfterS: number | undefined;
  let requestId: string | undefined;

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const err = b.error;
    if (err && typeof err === "object") {
      // { error: { code, message, details? } }
      const e = err as Record<string, unknown>;
      code = typeof e.code === "string" ? e.code : undefined;
      message = typeof e.message === "string" ? e.message : undefined;
      if (Array.isArray(e.details)) details = e.details as ErrorDetail[];
    } else if (typeof err === "string") {
      // { error, code, details?, requestId?, retryAfterS? }
      message = err;
    }
    if (!code && typeof b.code === "string") code = b.code;
    if (!message && typeof b.message === "string") message = b.message;
    if (!details && Array.isArray(b.details)) details = b.details as ErrorDetail[];
    if (typeof b.retryAfterS === "number") retryAfterS = b.retryAfterS;
    if (typeof b.requestId === "string") requestId = b.requestId;
  } else if (typeof body === "string" && body.trim()) {
    message = body.trim().slice(0, 300);
  }

  if (retryAfterS === undefined && retryAfterHeader) {
    const n = Number(retryAfterHeader);
    if (Number.isFinite(n)) retryAfterS = n;
  }

  return new ApiError({
    status,
    code,
    message: message ?? defaultMessage(status),
    details,
    retryAfterS,
    requestId,
  });
}

function defaultMessage(status: number): string {
  if (status === 0) return "Can't reach wuup right now. Check your connection and try again.";
  if (status === 401) return "Your session ended. Log in again.";
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "We couldn't find that.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return "Something went wrong. Try again.";
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204 || res.status === 205) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  const type = res.headers.get("Content-Type") ?? "";
  if (type.includes("json") || /^[[{"]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

async function rawFetch(path: string, opts: ApiOptions, accept?: string): Promise<Response> {
  const init: RequestInit = {
    method: opts.method ?? (opts.json !== undefined || opts.body ? "POST" : "GET"),
    credentials: "include",
    headers: buildHeaders(opts, accept),
    signal: opts.signal,
  };
  if (opts.json !== undefined) init.body = JSON.stringify(opts.json);
  else if (opts.body !== undefined) init.body = opts.body;

  try {
    return await fetch(buildUrl(path, opts.query), init);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError({ status: 0, code: "NETWORK", message: defaultMessage(0) });
  }
}

function handle401(path: string, opts: ApiOptions) {
  if (opts.skipAuthHandler) return;
  if (AUTH_FORM_PATHS.some((p) => path.startsWith(p))) return;
  emitUnauthorized(path);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** JSON request. Resolves with the parsed body (undefined for 204). */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await rawFetch(path, opts);
  const body = await readBody(res);
  if (!res.ok) {
    if (res.status === 401) handle401(path, opts);
    throw toApiError(res.status, body, res.headers.get("Retry-After"));
  }
  return body as T;
}

/**
 * For SSE: performs the same auth and error checks as `api()`, then returns
 * the raw Response so the caller can read `res.body` as a stream.
 */
export async function apiStream(path: string, opts: ApiOptions = {}): Promise<Response> {
  const res = await rawFetch(path, { method: "POST", ...opts }, "text/event-stream");
  if (!res.ok) {
    const body = await readBody(res);
    if (res.status === 401) handle401(path, opts);
    throw toApiError(res.status, body, res.headers.get("Retry-After"));
  }
  return res;
}

/**
 * Multipart upload with progress (fetch has no upload progress). `onProgress`
 * receives 0..1. Abort with `signal`.
 */
export function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
  onProgress?: (fraction: number) => void,
  opts: { signal?: AbortSignal; method?: "POST" | "PUT"; query?: Record<string, QueryValue> } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? "POST", buildUrl(path, opts.query));
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown = xhr.responseText;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        /* keep text */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(body as T);
        return;
      }
      if (xhr.status === 401) handle401(path, {});
      reject(toApiError(xhr.status, body, xhr.getResponseHeader("Retry-After")));
    };
    xhr.onerror = () => reject(new ApiError({ status: 0, code: "NETWORK", message: defaultMessage(0) }));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(formData);
  });
}

/** A user-facing message for any thrown value. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.name !== "AbortError" && e.message) return e.message;
  return fallback;
}
