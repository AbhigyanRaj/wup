/**
 * Bring-your-own-key drivers over the providers' raw HTTP APIs:
 * OpenAI-compatible (OpenAI, OpenRouter, Groq) and Anthropic.
 *
 * Raw fetch is kept on purpose (rather than @anthropic-ai/sdk): the streaming
 * tool loop, the server-side fallback beta and the echo rules below are all
 * covered by fetch-level tests.
 */

import { modelHealth } from "./modelHealth";
import {
  LlmError,
  RequestGuard,
  isAutoModel,
  isRotatable,
  log,
  postJson,
  readSse,
  resolveTimeouts,
  safeExecute,
  systemText,
  toLlmError,
  type ChatTurn,
  type CompleteParams,
  type CompleteResult,
  type DriverOptions,
  type LlmCredentials,
  type LlmDriver,
  type RunToolLoopParams,
  type ToolDeclaration,
  type ToolLoopResult,
} from "./common";

export type CustomProvider = "openai" | "openrouter" | "anthropic" | "groq";
export type OpenAICompatibleProvider = "openai" | "openrouter" | "groq";

export const ENDPOINTS: Record<CustomProvider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

export const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

/**
 * Groq chat models in order of preference for the tool loop: the strongest
 * production tool callers first, then preview models, then small ones.
 * "auto" picks the first one the user's key can see (from GET /models).
 */
export const GROQ_TOOL_MODELS = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "qwen/qwen3.8-27b",
  "minimaxai/minimax-m2.7",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

/** Small, fast Groq models for titles and suggestions (non-reasoning first, so a 30-token title is never eaten by reasoning). */
export const GROQ_LIGHT_MODELS = ["llama-3.1-8b-instant", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"];

/** Groq also hosts speech, TTS, safety and agentic-system models that can't run the chat tool loop. */
const GROQ_NON_CHAT = /(whisper|tts|orpheus|playai|guard|safeguard|embed|compound)/i;

/** True for Groq model ids that can serve chat completions with tools. */
export function isGroqChatModel(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 200 && !GROQ_NON_CHAT.test(id);
}

/** The first preferred model the key can use; the head of the list when the key's models are unknown. */
export function pickPreferred(preferred: string[], available?: string[] | null): string {
  if (!available || available.length === 0) return preferred[0];
  const set = new Set(available);
  return preferred.find((m) => set.has(m)) ?? available.find(isGroqChatModel) ?? preferred[0];
}

export const DEFAULT_MODELS: Record<CustomProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "google/gemini-2.5-flash",
  anthropic: "claude-opus-5-5",
  groq: GROQ_TOOL_MODELS[0],
};

/** Small, cheap models for titles and suggestions. */
export const LIGHT_MODELS: Record<CustomProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "google/gemini-2.5-flash",
  anthropic: "claude-haiku-5-5",
  groq: GROQ_LIGHT_MODELS[0],
};

/**
 * Models that support server-side fallbacks (`fallbacks: "default"` plus the
 * server-side-fallback beta): the request is re-run on another model when a
 * safety classifier declines it.
 */
export const ANTHROPIC_FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);
export const ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Families that accept 64k output tokens; everything else gets 8192. */
const MODERN_ANTHROPIC = /^claude-(opus-4-([5-9]|\d\d)|opus-5|sonnet-4|sonnet-5|haiku-4-5|haiku-5|fable)/;

export function anthropicMaxTokens(model: string): number {
  return MODERN_ANTHROPIC.test(model) ? 64000 : 8192;
}

/** "auto" resolves to the provider default (for Groq, the best tool model the key can see). */
export function resolveModel(provider: CustomProvider, model?: string, availableModels?: string[] | null): string {
  if (!isAutoModel(model)) return model!;
  if (provider === "groq") return pickPreferred(GROQ_TOOL_MODELS, availableModels);
  return DEFAULT_MODELS[provider];
}

/** A small, fast model for titles and suggestions. */
export function resolveLightModel(provider: CustomProvider, availableModels?: string[] | null): string {
  if (provider === "groq") return pickPreferred(GROQ_LIGHT_MODELS, availableModels);
  return LIGHT_MODELS[provider];
}

/** Groq answers a malformed tool call with 400 "tool_use_failed"; a fresh sample usually succeeds. */
export function isGroqToolUseFailed(err: LlmError): boolean {
  return err.status === 400 && /tool_use_failed|failed to call a function/i.test(err.message);
}

const GPT_OSS = /(^|\/)gpt-oss/;

/** Groq "auto": the preferred tool models this key can see, cooled-down ones last. */
export function groqAutoCandidates(llm: Pick<LlmCredentials, "keyId" | "availableModels">): string[] {
  const available = (llm.availableModels ?? []).filter(isGroqChatModel);
  const set = new Set(available);
  const ordered = available.length > 0 ? GROQ_TOOL_MODELS.filter((m) => set.has(m)) : [...GROQ_TOOL_MODELS];
  if (ordered.length === 0) ordered.push(available[0] ?? GROQ_TOOL_MODELS[0]);
  const ready = ordered.filter((m) => modelHealth.isAvailable(llm.keyId, m));
  return [...ready, ...ordered.filter((m) => !ready.includes(m))];
}

/** Converts Gemini schema types ("OBJECT", "STRING", ...) to JSON Schema ("object", "string", ...). */
export function toJsonSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "type" && typeof v === "string") out.type = v.toLowerCase();
    else if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toJsonSchema(pv)]));
    } else out[k] = toJsonSchema(v);
  }
  return out;
}

/** Strict parse + required-field check. Returns an error string when the input can't be used. */
export function parseToolInput(raw: string, declaration: any): { args?: any; error?: string } {
  let args: any;
  try {
    args = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return { error: JSON.stringify({ INVALID_JSON: raw }) };
  }
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return { error: "Tool input must be a JSON object." };
  }
  const missing = (declaration?.parameters?.required ?? []).filter((k: string) => args[k] === undefined);
  if (missing.length > 0) return { error: `Missing required argument(s): ${missing.join(", ")}` };
  return { args };
}

/** Records a 429 so the model picker can show the cooldown for this key. */
function noteRateLimit(llm: LlmCredentials, model: string, err: LlmError): LlmError {
  if (err.status === 429) modelHealth.markExhausted(llm.keyId, model, { message: err.message, retryAfterMs: (err as any).retryAfterMs });
  return err;
}

const usableHistory = (history: ChatTurn[]) => history.filter((t) => t.role !== "system" && t.content?.trim());

// ─── OpenAI / OpenRouter / Groq ───────────────────────────────────────────────

export class OpenAICompatibleDriver implements LlmDriver {
  readonly usingOwnKey = true;
  readonly model: string;
  private readonly timeouts: { connectMs: number; idleMs: number };
  /** Models to try in order. More than one only for Groq "auto", which skips to the next model on a rate limit. */
  private readonly candidates: string[];
  private active: string;

  constructor(readonly provider: OpenAICompatibleProvider, private readonly llm: LlmCredentials, model?: string, opts?: DriverOptions) {
    this.candidates = provider === "groq" && isAutoModel(model) ? groqAutoCandidates(llm) : [resolveModel(provider, model, llm.availableModels)];
    this.model = this.candidates[0];
    this.active = this.model;
    this.timeouts = resolveTimeouts(opts);
  }

  /**
   * Opens one streamed turn. Groq only: a 400 tool_use_failed is re-sampled once,
   * and in "auto" a rate limit, 404 or 5xx moves on to the next candidate model
   * (nothing of this turn has streamed yet, so switching is invisible to the user).
   */
  private async openTurn(payload: any, signal: AbortSignal): Promise<{ response: Response; guard: RequestGuard }> {
    let resampled = false;
    for (;;) {
      payload.model = this.active;
      const guard = new RequestGuard(signal, this.timeouts.connectMs, this.timeouts.idleMs);
      try {
        return { response: await postJson(ENDPOINTS[this.provider], this.headers(), payload, guard), guard };
      } catch (err) {
        guard.dispose();
        const e = toLlmError(err, signal);
        if (this.provider !== "groq" || e.code === "ABORTED") throw e;
        if (!resampled && isGroqToolUseFailed(e)) {
          resampled = true;
          continue;
        }
        const next = this.candidates[this.candidates.indexOf(this.active) + 1];
        if (!next || !isRotatable(e)) throw e;
        noteRateLimit(this.llm, this.active, e);
        log().warn("groq model unavailable; trying the next one", { from: this.active, to: next, status: e.status });
        this.active = next;
      }
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.llm.apiKey ?? ""}`,
    };
    if (this.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://wuup.ai";
      headers["X-Title"] = "Wuup";
    }
    return headers;
  }

  async runToolLoop(p: RunToolLoopParams): Promise<ToolLoopResult> {
    const maxTurns = Math.max(1, p.maxTurns);
    const tools = p.tools.map((d) => ({
      type: "function",
      function: { name: d.name, description: d.description, parameters: toJsonSchema(d.parameters) },
    }));
    const messages: any[] = [
      { role: "system", content: systemText(p.system) },
      ...usableHistory(p.history).map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", content: t.content })),
      { role: "user", content: p.prompt },
    ];
    const usage = { tokensIn: 0, tokensOut: 0 };
    let fullText = "";
    let model = this.active;

    for (let turn = 0; turn < maxTurns; turn++) {
      const last = turn === maxTurns - 1;
      // No temperature: newer reasoning models reject non-default values (Groq's default of 1 is fine too).
      // No parallel_tool_calls: Groq's gpt-oss models don't support parallel calls, and the default is right elsewhere.
      const payload: any = { model: this.active, stream: true, stream_options: { include_usage: true }, messages };
      if (tools.length > 0) {
        payload.tools = tools;
        if (last) payload.tool_choice = "none";
      }

      let guard: RequestGuard | undefined;
      let text = "";
      const calls: Array<{ id: string; name: string; arguments: string }> = [];
      // Per turn: the `usage` chunk (stream_options.include_usage), else Groq's x_groq.usage.
      let turnUsage: any = null;
      let groqUsage: any = null;
      try {
        const opened = await this.openTurn(payload, p.signal);
        guard = opened.guard;
        model = this.active;
        for await (const { data } of readSse(opened.response, guard)) {
          if (data === "[DONE]") continue;
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (parsed.error?.message) throw new LlmError("PROVIDER_ERROR", parsed.error.message);
          if (typeof parsed.model === "string" && parsed.model) model = parsed.model;
          if (parsed.usage) turnUsage = parsed.usage;
          if (parsed.x_groq?.usage) groqUsage = parsed.x_groq.usage;
          const delta = parsed.choices?.[0]?.delta;
          if (typeof delta?.content === "string" && delta.content) {
            text += delta.content;
            fullText += delta.content;
            p.onText(delta.content);
          }
          for (const tc of delta?.tool_calls ?? []) {
            const idx = tc.index ?? 0;
            calls[idx] ??= { id: "", name: "", arguments: "" };
            if (tc.id) calls[idx].id = tc.id;
            if (tc.function?.name) calls[idx].name += tc.function.name;
            if (tc.function?.arguments) calls[idx].arguments += tc.function.arguments;
          }
        }
      } catch (err) {
        throw noteRateLimit(this.llm, this.active, toLlmError(err, p.signal));
      } finally {
        guard?.dispose();
      }
      const u = turnUsage ?? groqUsage;
      if (u) {
        usage.tokensIn += Number(u.prompt_tokens) || 0;
        usage.tokensOut += Number(u.completion_tokens) || 0;
      }

      const toolCalls = calls.filter(Boolean);
      if (toolCalls.length === 0) return { text: fullText, model, usage, turns: turn + 1, hitTurnLimit: false };
      if (last) return { text: fullText, model, usage, turns: turn + 1, hitTurnLimit: true };

      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
      });
      for (const call of toolCalls) {
        const declaration = p.tools.find((d) => d.name === call.name);
        const input = parseToolInput(call.arguments, declaration);
        const result = input.error ? { success: false, error: input.error } : await safeExecute(p.executeTool, call.name, input.args);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return { text: fullText, model, usage, turns: maxTurns, hitTurnLimit: true };
  }

  async complete(p: CompleteParams): Promise<CompleteResult> {
    const payload: any = {
      model: this.active,
      messages: [...(p.system ? [{ role: "system", content: p.system }] : []), { role: "user", content: p.prompt }],
    };
    // OpenAI's newer models only accept max_completion_tokens (Groq deprecates max_tokens too); OpenRouter documents max_tokens.
    if (this.provider === "openrouter") payload.max_tokens = p.maxTokens;
    else payload.max_completion_tokens = p.maxTokens;
    if (p.json && this.provider === "openai") payload.response_format = { type: "json_object" };
    // gpt-oss reasons by default (medium); keep short completions short so reasoning can't eat the budget.
    if (this.provider === "groq" && GPT_OSS.test(this.active)) payload.reasoning_effort = "low";

    const guard = new RequestGuard(p.signal, Math.max(this.timeouts.connectMs, this.timeouts.idleMs), this.timeouts.idleMs);
    try {
      const response = await postJson(ENDPOINTS[this.provider], this.headers(), payload, guard);
      const body: any = await guard.race(response.json());
      return {
        text: String(body?.choices?.[0]?.message?.content ?? ""),
        usage: { tokensIn: Number(body?.usage?.prompt_tokens) || 0, tokensOut: Number(body?.usage?.completion_tokens) || 0 },
      };
    } catch (err) {
      throw noteRateLimit(this.llm, this.active, toLlmError(err, p.signal));
    } finally {
      guard.dispose();
    }
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

interface AnthropicBlock {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  data?: string;
  id?: string;
  name?: string;
  partialJson?: string;
  [key: string]: any;
}

/**
 * Builds the assistant content to echo back. After a mid-output server-side
 * fallback, thinking/tool_use blocks before the last `fallback` marker belong
 * to the declined attempt and must be omitted.
 */
export function anthropicEchoContent(blocks: AnthropicBlock[]): any[] {
  const lastFallback = blocks.map((b) => b.type).lastIndexOf("fallback");
  const out: any[] = [];
  blocks.forEach((b, i) => {
    const beforeBoundary = i < lastFallback;
    switch (b.type) {
      case "text":
        if (b.text) out.push({ type: "text", text: b.text });
        break;
      case "thinking":
        if (!beforeBoundary) out.push({ type: "thinking", thinking: b.thinking ?? "", signature: b.signature ?? "" });
        break;
      case "redacted_thinking":
        if (!beforeBoundary) out.push({ type: "redacted_thinking", data: b.data });
        break;
      case "tool_use":
        if (!beforeBoundary) {
          let input: any = {};
          try {
            input = b.partialJson ? JSON.parse(b.partialJson) : {};
          } catch {}
          out.push({ type: "tool_use", id: b.id, name: b.name, input });
        }
        break;
      // `fallback` markers and unknown model-internal blocks are dropped
    }
  });
  return out;
}

export const ANTHROPIC_REFUSAL_TEXT = "\n\nThe model declined to answer this request.";
export const ANTHROPIC_CUTOFF_TEXT = "\n\n(Response was cut off at the length limit.)";

/** Anthropic requires alternating turns starting with the user; the prompt merges into a trailing user turn. */
function anthropicMessages(history: ChatTurn[], prompt: string): any[] {
  const messages: any[] = [];
  for (const t of usableHistory(history)) {
    const role = t.role === "assistant" ? "assistant" : "user";
    if (messages.length === 0 && role !== "user") continue;
    const last = messages[messages.length - 1];
    if (last?.role === role) last.content += `\n\n${t.content}`;
    else messages.push({ role, content: t.content });
  }
  const last = messages[messages.length - 1];
  if (last?.role === "user") last.content += `\n\n${prompt}`;
  else messages.push({ role: "user", content: prompt });
  return messages;
}

/** System blocks with the first (static) block marked for prompt caching. */
function anthropicSystem(system: string | string[] | undefined): any {
  const blocks = (Array.isArray(system) ? system : [system ?? ""]).filter((s) => s && s.trim());
  if (blocks.length === 0) return undefined;
  return blocks.map((text, i) => (i === 0 ? { type: "text", text, cache_control: { type: "ephemeral" } } : { type: "text", text }));
}

const mentionsMaxTokens = (err: LlmError) => err.status === 400 && /max_tokens/i.test(err.message);

export class AnthropicDriver implements LlmDriver {
  readonly provider = "anthropic" as const;
  readonly usingOwnKey = true;
  readonly model: string;
  private readonly timeouts: { connectMs: number; idleMs: number };
  private maxTokensCap: number;

  constructor(private readonly llm: LlmCredentials, model?: string, opts?: DriverOptions) {
    this.model = resolveModel("anthropic", model);
    this.timeouts = resolveTimeouts(opts);
    this.maxTokensCap = anthropicMaxTokens(this.model);
  }

  private get useFallbacks() {
    return ANTHROPIC_FALLBACK_MODELS.has(this.model);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": this.llm.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    };
    if (this.useFallbacks) headers["anthropic-beta"] = ANTHROPIC_FALLBACK_BETA;
    return headers;
  }

  /** POSTs, retrying once at 8192 output tokens when the model rejects the larger max_tokens. */
  private async post(payload: any, makeGuard: () => RequestGuard): Promise<{ response: Response; guard: RequestGuard }> {
    const attempt = async () => {
      const g = makeGuard();
      try {
        return { response: await postJson(ENDPOINTS.anthropic, this.headers(), payload, g), guard: g };
      } catch (err) {
        g.dispose();
        throw err;
      }
    };
    try {
      return await attempt();
    } catch (err) {
      const e = toLlmError(err);
      if (!mentionsMaxTokens(e) || payload.max_tokens <= 8192) throw err;
      this.maxTokensCap = 8192;
      payload.max_tokens = 8192;
      return attempt();
    }
  }

  async runToolLoop(p: RunToolLoopParams): Promise<ToolLoopResult> {
    const maxTurns = Math.max(1, p.maxTurns);
    const tools = p.tools.map((d: ToolDeclaration) => ({
      name: d.name,
      description: d.description,
      input_schema: toJsonSchema(d.parameters),
      eager_input_streaming: true,
    }));
    const messages = anthropicMessages(p.history, p.prompt);
    const usage = { tokensIn: 0, tokensOut: 0 };
    let fullText = "";
    let model = this.model;
    const emit = (t: string) => {
      fullText += t;
      p.onText(t);
    };

    for (let turn = 0; turn < maxTurns; turn++) {
      const last = turn === maxTurns - 1;
      // No temperature: Opus 5.x rejects it and 5.5 models reject non-default values.
      const payload: any = { model: this.model, max_tokens: this.maxTokensCap, stream: true, messages };
      const system = anthropicSystem(p.system);
      if (system) payload.system = system;
      if (this.useFallbacks) payload.fallbacks = "default";
      if (tools.length > 0) {
        payload.tools = tools;
        // Forced tool_choice (any/tool) is rejected on 5.5 models; "none" is fine.
        if (last) payload.tool_choice = { type: "none" };
      }

      const blocks: AnthropicBlock[] = [];
      let stopReason: string | undefined;
      let guard: RequestGuard | undefined;
      try {
        const posted = await this.post(payload, () => new RequestGuard(p.signal, this.timeouts.connectMs, this.timeouts.idleMs));
        guard = posted.guard;
        for await (const { data } of readSse(posted.response, guard)) {
          let ev: any;
          try {
            ev = JSON.parse(data);
          } catch {
            continue;
          }
          switch (ev.type) {
            case "error":
              throw new LlmError(
                ev.error?.type === "rate_limit_error" ? "MODEL_UNAVAILABLE" : "PROVIDER_ERROR",
                ev.error?.message ?? "Anthropic stream error"
              );
            case "message_start": {
              const u = ev.message?.usage ?? {};
              usage.tokensIn +=
                (Number(u.input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0);
              if (typeof ev.message?.model === "string" && ev.message.model) model = ev.message.model;
              break;
            }
            case "content_block_start": {
              const cb = ev.content_block ?? {};
              blocks[ev.index] = { ...cb, partialJson: "" };
              if (cb.type === "text" && cb.text) emit(cb.text);
              break;
            }
            case "content_block_delta": {
              const b = blocks[ev.index];
              const d = ev.delta ?? {};
              if (!b) break;
              if (d.type === "text_delta") {
                b.text = (b.text ?? "") + d.text;
                emit(d.text);
              } else if (d.type === "thinking_delta") b.thinking = (b.thinking ?? "") + d.thinking;
              else if (d.type === "signature_delta") b.signature = d.signature;
              else if (d.type === "input_json_delta") b.partialJson = (b.partialJson ?? "") + d.partial_json;
              break;
            }
            case "message_delta":
              if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
              if (ev.usage?.output_tokens) usage.tokensOut += Number(ev.usage.output_tokens) || 0;
              break;
          }
        }
      } catch (err) {
        throw noteRateLimit(this.llm, this.model, toLlmError(err, p.signal));
      } finally {
        guard?.dispose();
      }

      if (stopReason === "refusal") {
        emit(ANTHROPIC_REFUSAL_TEXT);
        return { text: fullText, model, usage, turns: turn + 1, hitTurnLimit: false };
      }

      const content = anthropicEchoContent(blocks.filter(Boolean));
      const toolUses = content.filter((b) => b.type === "tool_use");
      if (stopReason !== "tool_use" || toolUses.length === 0) {
        if (stopReason === "max_tokens") emit(ANTHROPIC_CUTOFF_TEXT);
        return { text: fullText, model, usage, turns: turn + 1, hitTurnLimit: false };
      }
      if (last) return { text: fullText, model, usage, turns: turn + 1, hitTurnLimit: true };

      messages.push({ role: "assistant", content });

      // Re-parse from the raw stream text so invalid JSON is reported, not silently emptied
      const rawById = new Map(blocks.filter((b) => b?.type === "tool_use").map((b) => [b.id, b.partialJson ?? ""]));
      const results: any[] = [];
      for (const use of toolUses) {
        const declaration = p.tools.find((d) => d.name === use.name);
        const input = parseToolInput(rawById.get(use.id) ?? "", declaration);
        if (input.error) {
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: input.error });
          continue;
        }
        const result = await safeExecute(p.executeTool, use.name, input.args);
        results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
      }
      // All results for one assistant turn go back in a single user message
      messages.push({ role: "user", content: results });
    }
    return { text: fullText, model, usage, turns: maxTurns, hitTurnLimit: true };
  }

  async complete(p: CompleteParams): Promise<CompleteResult> {
    const payload: any = {
      model: this.model,
      max_tokens: Math.min(p.maxTokens, this.maxTokensCap),
      messages: [{ role: "user", content: p.json ? `${p.prompt}\n\nRespond with a single JSON object only.` : p.prompt }],
    };
    if (p.system) payload.system = p.system;
    if (this.useFallbacks) payload.fallbacks = "default";

    const timeout = Math.max(this.timeouts.connectMs, this.timeouts.idleMs);
    let guard: RequestGuard | undefined;
    try {
      const posted = await this.post(payload, () => new RequestGuard(p.signal, timeout, timeout));
      guard = posted.guard;
      const body: any = await guard.race(posted.response.json());
      if (body?.stop_reason === "refusal") return { text: "", usage: { tokensIn: 0, tokensOut: 0 } };
      const text = (Array.isArray(body?.content) ? body.content : [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("");
      return {
        text,
        usage: { tokensIn: Number(body?.usage?.input_tokens) || 0, tokensOut: Number(body?.usage?.output_tokens) || 0 },
      };
    } catch (err) {
      throw toLlmError(err, p.signal);
    } finally {
      guard?.dispose();
    }
  }
}

