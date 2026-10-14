/**
 * Shared runtime pieces for the LLM drivers: the driver interface, a typed
 * error, a request guard (connect timeout + stream-idle watchdog + abort) and
 * an SSE reader. Kept separate from driver.ts so the provider modules can use
 * them without a circular import.
 */

import { brainLog } from "../utils/logger";

export type LlmProvider = "gemini" | "openai" | "openrouter" | "anthropic";

export interface LlmCredentials {
  provider: LlmProvider;
  /** null = the server's Gemini key */
  apiKey: string | null;
  /** "server", or sha256(key).slice(0, 12) for a user's own key */
  keyId: string;
}

/** One prior chat turn. */
export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Gemini-style function declaration (uppercase schema types); converted per provider. */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: any;
}

export interface Usage {
  tokensIn: number;
  tokensOut: number;
}

export interface RunToolLoopParams {
  /** A string, or blocks ordered static-first (providers that support prompt caching cache the first block). */
  system: string | string[];
  history: ChatTurn[];
  prompt: string;
  tools: ToolDeclaration[];
  /** Must not throw; drivers still guard against it. */
  executeTool: (name: string, args: any) => Promise<any>;
  maxTurns: number;
  signal: AbortSignal;
  onText: (text: string) => void;
  /** Reserved for providers that expose a reasoning effort knob. Currently ignored. */
  effort?: "low" | "medium" | "high";
}

export interface ToolLoopResult {
  text: string;
  /** The model that actually answered (after any rotation). */
  model: string;
  usage: Usage;
  turns: number;
  /** True when the last allowed turn still asked for tools (those calls were not run). */
  hitTurnLimit: boolean;
}

export interface CompleteParams {
  system?: string;
  prompt: string;
  maxTokens: number;
  /** Ask for a JSON object. Callers must still parse leniently. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface CompleteResult {
  text: string;
  usage: Usage;
}

export interface LlmDriver {
  readonly provider: LlmProvider;
  /** The resolved model id ("auto" resolved to the provider default / first rotation model). */
  readonly model: string;
  readonly usingOwnKey: boolean;
  runToolLoop(params: RunToolLoopParams): Promise<ToolLoopResult>;
  complete(params: CompleteParams): Promise<CompleteResult>;
}

export interface DriverOptions {
  /** Time allowed until response headers arrive. Default LLM_CONNECT_TIMEOUT_MS or 30s. */
  connectMs?: number;
  /** Max silence while streaming. Default LLM_IDLE_TIMEOUT_MS or 60s. */
  idleMs?: number;
}

export const AUTO_MODEL = "auto";

/** "auto", the legacy "Auto-Rotate", empty and undefined all mean "pick for me". */
export function isAutoModel(model?: string | null): boolean {
  return !model || model === AUTO_MODEL || model === "Auto-Rotate";
}

const envMs = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function resolveTimeouts(opts?: DriverOptions): { connectMs: number; idleMs: number } {
  return {
    connectMs: opts?.connectMs ?? envMs("LLM_CONNECT_TIMEOUT_MS", 120_000),
    idleMs: opts?.idleMs ?? envMs("LLM_IDLE_TIMEOUT_MS", 90_000),
  };
}

export const systemText = (system: string | string[] | undefined) =>
  Array.isArray(system) ? system.filter(Boolean).join("\n\n") : system ?? "";

// ─── Errors ───────────────────────────────────────────────────────────────────

export type LlmErrorCode = "PROVIDER_AUTH" | "MODEL_UNAVAILABLE" | "PROVIDER_ERROR" | "ABORTED";

export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    message: string,
    public readonly status?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export const REGION_MESSAGE =
  "The AI provider isn't available in the server's region right now. Add your own API key in settings to keep chatting.";

function isLocationError(message: string, details: unknown): boolean {
  const text = `${message} ${safeJson(details)}`.toLowerCase();
  return text.includes("user location is not supported") || (text.includes("location") && text.includes("not supported"));
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? "");
  } catch {
    return "";
  }
}

export function codeForStatus(status: number | undefined): LlmErrorCode {
  if (status === 401 || status === 403) return "PROVIDER_AUTH";
  if (status === 404 || status === 429) return "MODEL_UNAVAILABLE";
  return "PROVIDER_ERROR";
}

/** Normalises any provider/SDK/network error into an LlmError. */
export function toLlmError(err: unknown, signal?: AbortSignal): LlmError {
  if (err instanceof LlmError) return err;
  if (signal?.aborted) return new LlmError("ABORTED", "The request was stopped.");
  const e = err as any;
  const message: string = typeof e?.message === "string" ? e.message : String(err);
  let status: number | undefined = typeof e?.status === "number" ? e.status : undefined;
  if (status === undefined) {
    const m = /\[(\d{3})[ \]]|API error: (\d{3})/.exec(message);
    if (m) status = Number(m[1] ?? m[2]);
  }
  if (e?.name === "AbortError") return new LlmError("ABORTED", "The request was stopped.");
  if (isLocationError(message, e?.errorDetails)) {
    return new LlmError("MODEL_UNAVAILABLE", REGION_MESSAGE, status, e?.errorDetails);
  }
  return new LlmError(codeForStatus(status), message, status, e?.errorDetails);
}

/** Errors that justify trying the next model in an auto rotation. */
export function isRotatable(err: LlmError): boolean {
  if (err.message === REGION_MESSAGE) return false;
  const s = err.status;
  return s === 429 || s === 404 || (s !== undefined && s >= 500);
}

// ─── Request guard ────────────────────────────────────────────────────────────

/**
 * One network request's lifetime: aborts when the caller's signal aborts, when
 * the response does not start within connectMs, or when the stream goes quiet
 * for idleMs. Equivalent to AbortSignal.any([signal, AbortSignal.timeout(connectMs)])
 * until the first byte, then a resettable idle watchdog.
 */
export class RequestGuard {
  private readonly ctl = new AbortController();
  readonly signal: AbortSignal;
  private timer?: ReturnType<typeof setTimeout>;
  private reason: "connect" | "idle" | null = null;

  constructor(private readonly parent: AbortSignal | undefined, connectMs: number, private readonly idleMs: number) {
    this.signal = parent ? AbortSignal.any([parent, this.ctl.signal]) : this.ctl.signal;
    this.arm(connectMs, "connect");
  }

  private arm(ms: number, reason: "connect" | "idle") {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.reason = reason;
      this.ctl.abort();
    }, ms);
    (this.timer as any).unref?.();
  }

  /** Resets the idle watchdog (call on every received chunk). */
  touch() {
    if (!this.signal.aborted) this.arm(this.idleMs, "idle");
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
  }

  abortError(): LlmError {
    if (this.parent?.aborted) return new LlmError("ABORTED", "The request was stopped.");
    // 504 marks timeouts as rotatable: "auto" moves to the next model when nothing reached the user yet.
    if (this.reason === "idle") return new LlmError("PROVIDER_ERROR", "The AI provider stopped responding. Please try again.", 504);
    return new LlmError("PROVIDER_ERROR", "The AI provider took too long to respond. Please try again.", 504);
  }

  /** Resolves with p, or rejects as soon as the guard aborts. */
  race<T>(p: Promise<T>): Promise<T> {
    if (this.signal.aborted) {
      p.catch(() => {});
      return Promise.reject(this.abortError());
    }
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(this.abortError());
      this.signal.addEventListener("abort", onAbort, { once: true });
      p.then(
        (v) => {
          this.signal.removeEventListener("abort", onAbort);
          resolve(v);
        },
        (e) => {
          this.signal.removeEventListener("abort", onAbort);
          reject(this.signal.aborted ? this.abortError() : e);
        }
      );
    });
  }

  /** Iterates a stream under the idle watchdog. */
  async *iterate<T>(source: AsyncIterable<T>): AsyncGenerator<T> {
    const it = source[Symbol.asyncIterator]();
    this.touch();
    let finished = false;
    try {
      while (true) {
        const r = await this.race(it.next());
        if (r.done) {
          finished = true;
          return;
        }
        this.touch();
        yield r.value;
      }
    } finally {
      // Never await: a pending next() would block return() forever.
      if (!finished) Promise.resolve(it.return?.()).catch(() => {});
    }
  }
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

async function* readChunks(response: Response): AsyncGenerator<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new LlmError("PROVIDER_ERROR", "Response body is not readable");
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** Parses an SSE response into {event, data} records under the guard's watchdog. */
export async function* readSse(response: Response, guard: RequestGuard): AsyncGenerator<{ event?: string; data: string }> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let event: string | undefined;
  for await (const value of guard.iterate(readChunks(response))) {
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) {
        event = undefined;
        continue;
      }
      if (clean.startsWith("event:")) event = clean.slice(6).trim();
      else if (clean.startsWith("data:")) yield { event, data: clean.slice(5).trim() };
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) yield { event, data: tail.slice(5).trim() };
}

/** POSTs JSON under the guard and throws an LlmError with the provider's message on non-2xx. */
export async function postJson(url: string, headers: Record<string, string>, body: unknown, guard: RequestGuard): Promise<Response> {
  const response = await guard.race(fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: guard.signal }));
  if (!response.ok) {
    const errorText = await guard.race(response.text()).catch(() => "");
    let parsedErr = errorText;
    try {
      const parsed = JSON.parse(errorText);
      parsedErr = parsed.error?.message || parsed.message || errorText;
    } catch {}
    const err = new LlmError(codeForStatus(response.status), `API error: ${response.status} - ${parsedErr}`, response.status);
    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) (err as any).retryAfterMs = retryAfter * 1000;
    throw err;
  }
  return response;
}

/** Runs a tool and turns a throw into a tool error (never a model error). */
export async function safeExecute(executeTool: (n: string, a: any) => Promise<any>, name: string, args: any): Promise<any> {
  try {
    const out = await executeTool(name, args);
    return out === undefined ? { success: true } : out;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Logging ──────────────────────────────────────────────────────────────────

export interface BrainLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/** The brain's pluggable logger (utils/logger; the API routes it to pino). */
export function log(): BrainLogger {
  return brainLog;
}
