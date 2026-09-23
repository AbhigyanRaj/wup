/**
 * Streaming chat + tool calling for bring-your-own-key providers
 * (OpenAI, OpenRouter, Anthropic) over their raw HTTP APIs.
 *
 * Yields text tokens as they arrive. When the model calls tools, runs them via
 * executeTool, appends the results, and continues, up to maxTurns rounds.
 */

export type CustomProvider = "openai" | "openrouter" | "anthropic";

export interface ProviderTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export type ToolExecutor = (name: string, args: any) => Promise<any>;

export interface StreamWithToolsOptions {
  provider: CustomProvider;
  apiKey: string;
  model: string;
  systemInstruction: string;
  history: ProviderTurn[];
  prompt: string;
  /** Gemini-style function declarations (uppercase types); converted per provider. */
  declarations: any[];
  executeTool: ToolExecutor;
  maxTurns?: number;
}

const ENDPOINTS: Record<CustomProvider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

const DEFAULT_MODELS: Record<CustomProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "google/gemini-2.5-flash",
  anthropic: "claude-opus-5",
};

/** Opus 5 can decline via safety classifiers; server-side fallbacks re-run the request on another model. */
const ANTHROPIC_FALLBACK_MODELS = new Set(["claude-opus-5"]);

export function resolveModel(provider: CustomProvider, model?: string): string {
  return !model || model === "Auto-Rotate" ? DEFAULT_MODELS[provider] : model;
}

/** Converts Gemini schema types ("OBJECT", "STRING", …) to JSON Schema ("object", "string", …). */
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

async function* readSse(response: Response): AsyncGenerator<{ event?: string; data: string }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let event: string | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
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
  } finally {
    reader.releaseLock();
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr = errorText;
    try {
      const parsed = JSON.parse(errorText);
      parsedErr = parsed.error?.message || parsed.message || errorText;
    } catch {}
    throw new Error(`API error: ${response.status} - ${parsedErr}`);
  }
  return response;
}

async function runTool(executeTool: ToolExecutor, name: string, args: any): Promise<any> {
  try {
    return await executeTool(name, args);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function* streamWithTools(opts: StreamWithToolsOptions): AsyncGenerator<string, void, unknown> {
  if (opts.provider === "anthropic") yield* streamAnthropic(opts);
  else yield* streamOpenAICompatible(opts);
}

// ─── OpenAI / OpenRouter ──────────────────────────────────────────────────────

async function* streamOpenAICompatible(opts: StreamWithToolsOptions): AsyncGenerator<string, void, unknown> {
  const maxTurns = opts.maxTurns ?? 5;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.apiKey}`,
  };
  if (opts.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://wuup.ai";
    headers["X-Title"] = "Wuup";
  }

  const tools = opts.declarations.map((d) => ({
    type: "function",
    function: { name: d.name, description: d.description, parameters: toJsonSchema(d.parameters) },
  }));
  const messages: any[] = [
    { role: "system", content: opts.systemInstruction },
    ...opts.history
      .filter((t) => t.role !== "system" && t.content?.trim())
      .map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", content: t.content })),
    { role: "user", content: opts.prompt },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const payload: any = { model: resolveModel(opts.provider, opts.model), stream: true, temperature: 0.2, messages };
    if (tools.length > 0) {
      payload.tools = tools;
      // Last round: force a final answer
      if (turn === maxTurns - 1) payload.tool_choice = "none";
    }

    const response = await postJson(ENDPOINTS[opts.provider], headers, payload);
    let text = "";
    const calls: Array<{ id: string; name: string; arguments: string }> = [];

    for await (const { data } of readSse(response)) {
      if (data === "[DONE]") continue;
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (parsed.error?.message) throw new Error(parsed.error.message);
      const delta = parsed.choices?.[0]?.delta;
      if (delta?.content) {
        text += delta.content;
        yield delta.content;
      }
      for (const tc of delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        calls[idx] ??= { id: "", name: "", arguments: "" };
        if (tc.id) calls[idx].id = tc.id;
        if (tc.function?.name) calls[idx].name += tc.function.name;
        if (tc.function?.arguments) calls[idx].arguments += tc.function.arguments;
      }
    }

    const toolCalls = calls.filter(Boolean);
    if (toolCalls.length === 0) return;

    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
    });
    for (const call of toolCalls) {
      const declaration = opts.declarations.find((d) => d.name === call.name);
      const input = parseToolInput(call.arguments, declaration);
      const result = input.error
        ? { success: false, error: input.error }
        : await runTool(opts.executeTool, call.name, input.args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
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

async function* streamAnthropic(opts: StreamWithToolsOptions): AsyncGenerator<string, void, unknown> {
  const maxTurns = opts.maxTurns ?? 5;
  const model = resolveModel("anthropic", opts.model);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": opts.apiKey,
    "anthropic-version": "2023-06-01",
  };
  const useFallbacks = ANTHROPIC_FALLBACK_MODELS.has(model);
  if (useFallbacks) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";

  const tools = opts.declarations.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: toJsonSchema(d.parameters),
    eager_input_streaming: true,
  }));

  // Anthropic requires alternating turns starting with the user
  const messages: any[] = [];
  for (const t of opts.history) {
    if (t.role === "system" || !t.content?.trim()) continue;
    const role = t.role === "assistant" ? "assistant" : "user";
    if (messages.length === 0 && role !== "user") continue;
    const last = messages[messages.length - 1];
    if (last?.role === role) last.content += `\n\n${t.content}`;
    else messages.push({ role, content: t.content });
  }
  const last = messages[messages.length - 1];
  if (last?.role === "user") last.content += `\n\n${opts.prompt}`;
  else messages.push({ role: "user", content: opts.prompt });

  for (let turn = 0; turn < maxTurns; turn++) {
    const payload: any = {
      model,
      max_tokens: 64000,
      stream: true,
      system: opts.systemInstruction,
      messages,
    };
    if (useFallbacks) payload.fallbacks = "default";
    if (tools.length > 0) {
      payload.tools = tools;
      if (turn === maxTurns - 1) payload.tool_choice = { type: "none" };
    }

    const response = await postJson(ENDPOINTS.anthropic, headers, payload);
    const blocks: AnthropicBlock[] = [];
    let stopReason: string | undefined;

    for await (const { data } of readSse(response)) {
      let ev: any;
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      switch (ev.type) {
        case "error":
          throw new Error(ev.error?.message ?? "Anthropic stream error");
        case "content_block_start": {
          const cb = ev.content_block ?? {};
          blocks[ev.index] = { ...cb, partialJson: "" };
          if (cb.type === "text" && cb.text) yield cb.text;
          break;
        }
        case "content_block_delta": {
          const b = blocks[ev.index];
          const d = ev.delta ?? {};
          if (!b) break;
          if (d.type === "text_delta") {
            b.text = (b.text ?? "") + d.text;
            yield d.text;
          } else if (d.type === "thinking_delta") b.thinking = (b.thinking ?? "") + d.thinking;
          else if (d.type === "signature_delta") b.signature = d.signature;
          else if (d.type === "input_json_delta") b.partialJson = (b.partialJson ?? "") + d.partial_json;
          break;
        }
        case "message_delta":
          if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
          break;
      }
    }

    if (stopReason === "refusal") {
      yield "\n\nThe model declined to answer this request.";
      return;
    }

    const content = anthropicEchoContent(blocks.filter(Boolean));
    const toolUses = content.filter((b) => b.type === "tool_use");
    if (stopReason !== "tool_use" || toolUses.length === 0) {
      if (stopReason === "max_tokens") yield "\n\n(Response was cut off at the length limit.)";
      return;
    }

    messages.push({ role: "assistant", content });

    // Re-parse from the raw stream text so invalid JSON is reported, not silently emptied
    const rawById = new Map(blocks.filter((b) => b?.type === "tool_use").map((b) => [b.id, b.partialJson ?? ""]));
    const results = [];
    for (const use of toolUses) {
      const declaration = opts.declarations.find((d) => d.name === use.name);
      const input = parseToolInput(rawById.get(use.id) ?? "", declaration);
      if (input.error) {
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: input.error });
        continue;
      }
      const result = await runTool(opts.executeTool, use.name, input.args);
      results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
    }
    // All results for one assistant turn go back in a single user message
    messages.push({ role: "user", content: results });
  }
}
