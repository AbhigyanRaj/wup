import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import {
  RequestGuard,
  isAutoModel,
  isRotatable,
  log,
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
  type LlmError,
  type RunToolLoopParams,
  type ToolLoopResult,
  type Usage,
} from "./common";
import { modelHealth } from "./modelHealth";

/** Models tried in order for "auto" on Gemini. */
export const MODEL_ROTATION = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];

function apiKeyFor(llm: LlmCredentials): string {
  const key = llm.apiKey || process.env.GEMINI_API_KEY || "";
  if (!key) log().warn("GEMINI_API_KEY is missing from the environment");
  return key;
}

/**
 * Converts chat turns into the strict alternating user/model history Gemini
 * requires (starts with user, ends with model).
 */
export function buildGeminiHistory(turns: ChatTurn[]): Content[] {
  const raw: Content[] = [];
  for (const t of turns) {
    if (t.role === "system") continue;
    const text = t.content?.trim();
    if (!text) continue;
    raw.push({ role: t.role === "user" ? "user" : "model", parts: [{ text }] });
  }
  while (raw.length > 0 && raw[0].role !== "user") raw.shift();
  while (raw.length > 0 && raw[raw.length - 1].role !== "model") raw.pop();
  const fixed: Content[] = [];
  for (const c of raw) {
    const want = fixed.length % 2 === 0 ? "user" : "model";
    if (c.role === want) fixed.push(c);
  }
  while (fixed.length > 0 && fixed[fixed.length - 1].role !== "model") fixed.pop();
  return fixed;
}

/** Thrown inside one model attempt so the rotation knows whether output already reached the user. */
interface AttemptState {
  producedOutput: boolean;
}

export class GeminiDriver implements LlmDriver {
  readonly provider = "gemini" as const;
  readonly usingOwnKey: boolean;
  readonly model: string;
  private readonly auto: boolean;
  private readonly timeouts: { connectMs: number; idleMs: number };

  constructor(private readonly llm: LlmCredentials, model?: string, opts?: DriverOptions) {
    this.auto = isAutoModel(model);
    this.model = this.auto ? MODEL_ROTATION[0] : model!;
    this.usingOwnKey = !!llm.apiKey;
    this.timeouts = resolveTimeouts(opts);
  }

  /** Models to try, in order. Cooling-down models are skipped; if all are, the one that frees up first. */
  candidates(): string[] {
    if (!this.auto) return [this.model];
    const available = MODEL_ROTATION.filter((m) => modelHealth.isAvailable(this.llm.keyId, m));
    if (available.length > 0) return available;
    const soonest = [...MODEL_ROTATION].sort(
      (a, b) => (modelHealth.cooldownUntil(this.llm.keyId, a) ?? 0) - (modelHealth.cooldownUntil(this.llm.keyId, b) ?? 0)
    );
    return [soonest[0]];
  }

  private client(modelName: string, system: string | undefined, tools: any[]) {
    const params: any = { model: modelName };
    if (system) params.systemInstruction = system;
    if (tools.length > 0) params.tools = [{ functionDeclarations: tools }];
    return new GoogleGenerativeAI(apiKeyFor(this.llm)).getGenerativeModel(params, { apiVersion: "v1beta" });
  }

  /**
   * Runs `attempt` on each candidate model. Rotation happens only before any
   * output reached the user, and only on 429, 5xx or 404. Tool errors never
   * reach here (they are returned to the model as results).
   */
  private async rotate<T>(signal: AbortSignal | undefined, attempt: (model: string, state: AttemptState) => Promise<T>): Promise<T> {
    let lastErr: LlmError | undefined;
    for (const m of this.candidates()) {
      const state: AttemptState = { producedOutput: false };
      try {
        return await attempt(m, state);
      } catch (raw) {
        const err = toLlmError(raw, signal);
        if (err.status === 429 || err.status === 404) {
          modelHealth.markExhausted(this.llm.keyId, m, { errorDetails: err.details, message: err.message, retryAfterMs: (err as any).retryAfterMs });
        }
        if (err.code === "ABORTED" || state.producedOutput || !this.auto || !isRotatable(err)) throw err;
        log().warn("gemini model failed, rotating", { model: m, status: err.status });
        lastErr = err;
      }
    }
    throw lastErr ?? toLlmError(new Error("No Gemini model is available right now."));
  }

  runToolLoop(p: RunToolLoopParams): Promise<ToolLoopResult> {
    return this.rotate(p.signal, (m, state) => this.loopOnce(m, p, state));
  }

  private async loopOnce(modelName: string, p: RunToolLoopParams, state: AttemptState): Promise<ToolLoopResult> {
    const maxTurns = Math.max(1, p.maxTurns);
    const model = this.client(modelName, systemText(p.system), p.tools);
    // The conversation is managed here rather than via ChatSession: current Gemini models
    // reject the legacy "function" role the SDK uses for tool results, and Gemini 3
    // requires the model's function-call parts (with thought signatures) echoed verbatim.
    const contents: Content[] = [...buildGeminiHistory(p.history), { role: "user", parts: [{ text: p.prompt }] }];
    const usage: Usage = { tokensIn: 0, tokensOut: 0 };
    let fullText = "";

    for (let turn = 0; turn < maxTurns; turn++) {
      const last = turn === maxTurns - 1;
      const request: any = { contents };
      // Last turn: forbid tools so the model has to answer.
      if (p.tools.length > 0 && last) request.toolConfig = { functionCallingConfig: { mode: "NONE" } };

      const guard = new RequestGuard(p.signal, this.timeouts.connectMs, this.timeouts.idleMs);
      const modelParts: any[] = [];
      const calls: Array<{ name: string; args: any }> = [];
      let turnUsage: any;
      try {
        const result = await guard.race(model.generateContentStream(request, { signal: guard.signal }));
        result.response.catch(() => {}); // the aggregated promise rejects too when the stream fails
        for await (const chunk of guard.iterate(result.stream)) {
          if (chunk.usageMetadata) turnUsage = chunk.usageMetadata;
          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            modelParts.push(part);
            if (part.functionCall) {
              calls.push({ name: part.functionCall.name, args: part.functionCall.args });
            } else if (typeof part.text === "string" && part.text && !(part as any).thought && calls.length === 0) {
              fullText += part.text;
              state.producedOutput = true;
              p.onText(part.text);
            }
          }
        }
      } catch (err) {
        throw toLlmError(err, p.signal);
      } finally {
        guard.dispose();
      }
      usage.tokensIn += Number(turnUsage?.promptTokenCount) || 0;
      usage.tokensOut += (Number(turnUsage?.candidatesTokenCount) || 0) + (Number(turnUsage?.thoughtsTokenCount) || 0);

      if (calls.length === 0) return { text: fullText, model: modelName, usage, turns: turn + 1, hitTurnLimit: false };
      if (last) return { text: fullText, model: modelName, usage, turns: turn + 1, hitTurnLimit: true };

      contents.push({ role: "model", parts: modelParts });
      const responses: any[] = [];
      for (const call of calls) {
        state.producedOutput = true; // tool side effects (events, sources) are visible: no rotation after this
        const toolResult = await safeExecute(p.executeTool, call.name, call.args ?? {});
        const response = toolResult && typeof toolResult === "object" && !Array.isArray(toolResult) ? toolResult : { result: toolResult };
        responses.push({ functionResponse: { name: call.name, response } });
      }
      contents.push({ role: "user", parts: responses });
    }
    return { text: fullText, model: modelName, usage, turns: maxTurns, hitTurnLimit: true };
  }

  complete(p: CompleteParams): Promise<CompleteResult> {
    return this.rotate(p.signal, async (modelName) => {
      const model = this.client(modelName, p.system, []);
      const generationConfig: any = { maxOutputTokens: p.maxTokens + (modelName.startsWith("gemini-2.5") ? 0 : 1024) };
      // 2.5 models think by default and thinking tokens count against the output budget.
      if (modelName.startsWith("gemini-2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      if (p.json) generationConfig.responseMimeType = "application/json";
      const timeout = Math.max(this.timeouts.connectMs, this.timeouts.idleMs);
      const guard = new RequestGuard(p.signal, timeout, timeout);
      try {
        const result = await guard.race(
          model.generateContent({ contents: [{ role: "user", parts: [{ text: p.prompt }] }], generationConfig }, { signal: guard.signal })
        );
        const parts = result.response.candidates?.[0]?.content?.parts ?? [];
        const text = parts
          .filter((x: any) => typeof x.text === "string" && !x.thought)
          .map((x: any) => x.text)
          .join("");
        const u: any = result.response.usageMetadata;
        return { text, usage: { tokensIn: Number(u?.promptTokenCount) || 0, tokensOut: Number(u?.candidatesTokenCount) || 0 } };
      } catch (err) {
        throw toLlmError(err, p.signal);
      } finally {
        guard.dispose();
      }
    });
  }
}

/**
 * @deprecated Low-level model handle kept for bridges/mongo/scan.ts (schema
 * suggestions). New code should use createDriver(...).complete().
 */
export const getGeminiModel = (systemInstruction?: string, tools?: any[], modelOverride?: string, customKey?: string) => {
  const params: any = { model: modelOverride || MODEL_ROTATION[0] };
  if (systemInstruction) params.systemInstruction = systemInstruction;
  if (tools && tools.length > 0) params.tools = tools;
  return new GoogleGenerativeAI(customKey || process.env.GEMINI_API_KEY || "").getGenerativeModel(params, { apiVersion: "v1beta" });
};
