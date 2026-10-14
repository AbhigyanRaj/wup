import { createHash } from "crypto";
import type { ModelOption } from "@wup/contracts";
import { User } from "@wup/models";
import { createDriver, type DriverFactory } from "../ai/driver";
import {
  AUTO_MODEL,
  REGION_MESSAGE,
  isAutoModel,
  log,
  toLlmError,
  type ChatTurn,
  type LlmCredentials,
  type LlmDriver,
  type LlmError,
  type LlmProvider,
} from "../ai/common";
import { MODEL_ROTATION } from "../ai/gemini";
import { DEFAULT_MODELS } from "../ai/providers";
import { modelHealth as defaultHealth, type ModelHealth } from "../ai/modelHealth";
import { SourceRegistry } from "../citations/sourceRegistry";
import { buildBridgeDigest } from "../bridges/mongo/digest";
import { buildRagContext } from "../rag/retriever";
import { toolDeclarations } from "../tools/registry";
import type { QueryRecord } from "../tools/types";
import { cryptoService } from "../utils/crypto";
import { runResearch } from "../research/runner";
import type { SourceUse } from "../research/plan";
import { defaultContextLoader, isMongoBridge, isSheetsBridge, loadContext, type ContextLoader } from "./context";
import { MetaStreamFilter, extractJsonObject, parseStructuredResponse } from "./meta";
import { QueryRecorder, applyGrounding } from "./grounding";
import { rowsToTable } from "../bridges/mongo/values";
import { NO_ANSWER_TEXT, buildRetryPrompt, fillEmptyAnswer, type FillInput } from "./emptyAnswer";
import { buildAvailableData, buildSystemPrompt } from "./prompt";
import { generateTitle, heuristicTitle, lightModel } from "./titles";
import { ToolRunner } from "./toolRunner";
import type { BrainEvent, BrainRequest, BrainResult, RunOptions } from "./types";
import { RESEARCH_MAX_TOOL_CALLS } from "../research/runner";

export * from "./types";
export { MetaStreamFilter, parseStructuredResponse, META_START, META_END, extractJsonObject, type StructuredResponse } from "./meta";
export { applyGrounding, QueryRecorder, MAX_CHART_POINTS } from "./grounding";
export { buildSystemPrompt, buildPreferencesBlock, STATIC_PROMPT, CLARIFICATION_ALREADY_ASKED } from "./prompt";
export { heuristicTitle, generateTitle, tidyTitle } from "./titles";
export {
  ANSWER_NOW_NUDGE,
  CLARIFY_FALLBACK,
  FOUND_ROWS_TEXT,
  NO_ANSWER_TEXT,
  buildRetryPrompt,
  fillEmptyAnswer,
} from "./emptyAnswer";
export { loadContext, defaultContextLoader, type ContextLoader, type LoadedContext } from "./context";
export { ToolRunner, toolLabel, toolStatusCode } from "./toolRunner";
export type { ChatTurn, LlmCredentials };

/**
 * The brain: answers one message.
 *
 *   1. Load context in parallel: RAG chunks for the prompt, the chat's bridges, document names
 *   2. Number sources (RAG first) and build the system prompt (static first, for caching)
 *   3. Run the provider's tool loop (chat) or plan/steps/report (research), streaming
 *      tokens through MetaStreamFilter and tool/status/sources/step events through emit
 *   4. Parse the meta block, ground visuals on the real query rows, finalize citations
 *   5. Never return an empty "complete" answer: fall back to the clarification question or
 *      the rows found, else retry the final turn once without tools, else NO_ANSWER_TEXT
 *      with producedOutput false (so the API refunds the quota)
 *
 * run() never throws: failures come back as outcome "error" with a contracts
 * error code, and an abort comes back as outcome "stopped" with the partial answer.
 * The brain no longer reads the User model or charges quota; the API does both
 * (except in the legacy askStream wrapper).
 */

/** Sliding window: max prior messages (user + assistant) sent as history. */
export const CHAT_CONTEXT_MAX_MESSAGES = 10;

export const RAN_OUT_OF_STEPS = "\n\nI ran out of steps; here is what I found so far.";

export function chatMaxTurns(): number {
  const v = Number(process.env.CHAT_MAX_TURNS);
  return Number.isInteger(v) && v >= 1 && v <= 12 ? v : 6;
}

/** Stable, non-reversible id for a user's API key ("server" for the server key). */
export function keyIdFor(apiKey: string | null | undefined): string {
  return apiKey ? createHash("sha256").update(apiKey).digest("hex").slice(0, 12) : "server";
}

const PROVIDER_NAMES: Record<LlmProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
};

const GUARD_MESSAGES = new Set([
  "The AI provider stopped responding. Please try again.",
  "The AI provider took too long to respond. Please try again.",
]);

/** A message that is safe and useful to show the user. No em dashes. */
export function friendlyError(e: LlmError, llm: LlmCredentials): string {
  const name = PROVIDER_NAMES[llm.provider] ?? "AI provider";
  const own = !!llm.apiKey;
  const detail = own && e.message && !GUARD_MESSAGES.has(e.message) ? ` (${e.message.slice(0, 300)})` : "";
  switch (e.code) {
    case "PROVIDER_AUTH":
      return own
        ? `Your ${name} API key was rejected. Please check it in settings.${detail}`
        : "The AI service isn't configured correctly right now. Please try again later.";
    case "MODEL_UNAVAILABLE":
      if (e.message === REGION_MESSAGE) return REGION_MESSAGE;
      if (e.status === 404) return `That model isn't available. Pick another model or use Auto.${detail}`;
      return own
        ? `${name} is rate limiting this key right now. Please wait a moment and try again.${detail}`
        : "All available Gemini models have reached their limits for now. Please try again later, or add your own API key in settings.";
    case "ABORTED":
      return "Stopped.";
    default:
      if (GUARD_MESSAGES.has(e.message)) return e.message;
      return `${name} had a problem answering. Please try again in a moment.${detail}`;
  }
}

/** Whether trying the same request again later can succeed. */
export function isRetryable(e: LlmError): boolean {
  if (e.code === "PROVIDER_AUTH" || e.code === "ABORTED") return false;
  if (e.message === REGION_MESSAGE || e.status === 404 || e.status === 400) return false;
  return true;
}

export interface ListModelsOptions {
  /** Model ids the user's key can use (stored when the key was validated). */
  availableModels?: string[];
}

const MODEL_LABELS: Record<string, string> = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-flash-latest": "Gemini Flash (latest)",
  "gemini-flash-lite-latest": "Gemini Flash Lite (latest)",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4o": "GPT-4o",
  "google/gemini-2.5-flash": "Gemini 2.5 Flash (OpenRouter)",
};

const CURATED: Record<LlmProvider, string[]> = {
  gemini: MODEL_ROTATION,
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  openrouter: ["google/gemini-2.5-flash"],
};

const LISTABLE: Record<LlmProvider, RegExp> = {
  gemini: /^gemini-[\w.-]*(flash|pro)[\w.-]*$/,
  anthropic: /^claude-/,
  openai: /^(gpt-|o\d|chatgpt-)/,
  openrouter: /^[\w.-]+\/[\w.:-]+$/,
};

const SUGGEST_SYSTEM = `You suggest questions a user could ask wuup, a data assistant, about their own data.
Reply with JSON only: {"questions":["...","..."]}
Rules: 4 or 5 short questions (max 100 characters each), each answerable from the data described, using its real collection, field, sheet or document names in plain English. Mix counts, top-N, trends and lookups. No numbering.`;

export interface BrainDeps {
  createDriver?: DriverFactory;
  contextLoader?: ContextLoader;
  health?: ModelHealth;
}

/** Legacy options for askStream (the pre-WS-3b chat controller). */
export interface AskOptions {
  chatHistory?: ChatTurn[];
  model?: string;
  searchWeb?: boolean;
  /** Bridges enabled for this chat; empty/undefined = all of the user's bridges */
  bridgeIds?: string[];
  onStatus?: (message: string) => void;
}

/** @deprecated legacy follow-up shape (same as contracts FollowUp). */
export interface FollowUpSuggestion {
  label: string;
  suggestedPrompt: string;
}

/** @deprecated legacy clarification shape. */
export interface ClarificationData {
  question: string;
  options: string[];
  allowFreeText?: boolean;
}

/** The legacy `done` payload askStream yields. */
export interface BrainResponse {
  content: string;
  source?: string;
  queryPerformed?: string;
  clarification?: ClarificationData;
  followUps?: FollowUpSuggestion[];
  ragSources?: Array<{ sourceFile: string; pageNumber: number; score: number; text?: string }>;
  webSources?: Array<{ title: string; url: string }>;
  queries?: QueryRecord[];
  visualType?: "none" | "mermaid" | "chart" | "table" | "diagram";
  chartData?: any;
  tableData?: any;
  diagramData?: any;
  usedModel?: string;
  exhausted?: string[];
}

const LIMIT_MSG =
  "You have reached your free tier limit. Please add your own Gemini API key in settings to continue chatting.";

const LLM_PROVIDERS = new Set<LlmProvider>(["gemini", "openai", "openrouter", "anthropic"]);

export class Brain {
  private readonly factory: DriverFactory;
  private readonly loader: ContextLoader;
  private readonly health: ModelHealth;

  constructor(deps: BrainDeps = {}) {
    this.factory = deps.createDriver ?? createDriver;
    this.loader = deps.contextLoader ?? defaultContextLoader;
    this.health = deps.health ?? defaultHealth;
  }

  heuristicTitle = heuristicTitle;

  generateTitle = (prompt: string, llm: LlmCredentials, signal?: AbortSignal): Promise<string> =>
    generateTitle(prompt, llm, signal, this.factory);

  /** Answers one message. Never throws. */
  run = async (req: BrainRequest, opts: RunOptions): Promise<BrainResult> => {
    const t0 = Date.now();
    const { signal } = opts;
    const llm: LlmCredentials = req.llm ?? { provider: "gemini", apiKey: null, keyId: "server" };
    const emit = (e: BrainEvent) => {
      try {
        opts.emit(e);
      } catch (err) {
        log().warn("emit failed", { message: (err as Error)?.message });
      }
    };

    const recorder = new QueryRecorder();
    const sources = new SourceRegistry((list) => emit({ type: "sources", sources: list }));
    // `let`: an empty answer is retried once into a fresh filter.
    let filter = new MetaStreamFilter();
    let firstTokenMs: number | null = null;
    let produced = false;
    const emitToken = (text: string) => {
      if (!text) return;
      produced = true;
      if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
      emit({ type: "token", text });
    };
    const onText = (t: string) => emitToken(filter.push(t));

    const usage = { tokensIn: 0, tokensOut: 0 };
    let modelId = isAutoModel(req.model) ? AUTO_MODEL : String(req.model);
    let runner: ToolRunner | undefined;
    let research: BrainResult["research"] = null;

    /** Flushes the stream filter and returns the parsed, grounded response. */
    const parseGrounded = () => {
      const tail = filter.flush();
      if (tail && !signal.aborted) emitToken(tail);
      return applyGrounding(parseStructuredResponse(filter.fullText()), recorder.lastRows, recorder.rowSets);
    };
    const fillInput = (g: ReturnType<typeof parseGrounded>, content: string): FillInput => ({
      content,
      clarification: g.clarification ?? null,
      visualType: g.visualType,
      tableData: g.tableData ?? null,
      fallbackTable: recorder.lastRows?.length ? rowsToTable(recorder.lastRows) : null,
      hasVisual: !!(g.chartData || g.diagramData),
    });
    /** True when the answer so far is empty and there is nothing to fill it from. */
    const answerMissing = () => {
      const g = parseGrounded();
      return fillEmptyAnswer(fillInput(g, g.content)).kind === "empty";
    };

    const finish = (outcome: BrainResult["outcome"], error?: LlmError): BrainResult => {
      const grounded = parseGrounded();
      let content = sources.finalize(grounded.content);
      let visualType = grounded.visualType;
      let tableData = grounded.tableData ?? null;
      let producedOutput = produced;
      const clarification = outcome === "complete" ? grounded.clarification ?? null : null;

      if (outcome === "complete") {
        const fill = fillEmptyAnswer({ ...fillInput(grounded, content), clarification });
        if (fill.kind !== "kept") {
          content = fill.kind === "empty" ? NO_ANSWER_TEXT : fill.content;
          if (fill.kind === "found") {
            visualType = fill.visualType;
            tableData = fill.tableData;
          }
          // The client shows what was streamed: stream the filled-in text too.
          emit({ type: "token", text: produced ? `\n\n${content}` : content });
          producedOutput = fill.kind !== "empty";
          if (fill.kind === "empty") log().warn("the model produced no answer; returning the fallback text", { model: modelId });
        }
      }

      return {
        content,
        followUps: outcome === "complete" ? grounded.followUps : [],
        clarification,
        visualType,
        chartData: grounded.chartData ?? null,
        tableData,
        diagramData: grounded.diagramData ?? null,
        sources: sources.snapshot(),
        queries: recorder.queries,
        research,
        model: { provider: llm.provider, id: modelId, usingOwnKey: !!llm.apiKey },
        usage,
        toolCalls: runner?.calls ?? 0,
        firstTokenMs,
        exhausted: this.health.exhausted(llm.keyId ?? "server"),
        producedOutput,
        outcome,
        ...(error ? { error: { code: error.code, message: friendlyError(error, llm), retryable: isRetryable(error) } } : {}),
      };
    };

    let driver: LlmDriver;
    try {
      if (!LLM_PROVIDERS.has(llm.provider)) throw toLlmError(new Error(`Unknown AI provider: ${String(llm.provider)}`));
      driver = this.factory(llm, req.model);
      modelId = driver.model;
    } catch (err) {
      return finish("error", toLlmError(err));
    }

    try {
      if (signal.aborted) return finish("stopped");

      emit({ type: "status", message: "Searching your documents", code: "context.rag" });
      emit({ type: "status", message: "Checking your data bridges", code: "context.bridges" });
      const ctx = await loadContext(
        {
          userId: req.userId,
          prompt: req.prompt,
          bridgeIds: req.bridgeIds,
          ragApiKey: llm.provider === "gemini" && llm.apiKey ? llm.apiKey : undefined,
          signal,
        },
        this.loader
      );
      if (signal.aborted) return finish("stopped");

      const nums = sources.registerChunks(ctx.chunks);
      const ragContext = ctx.chunks.length > 0 ? buildRagContext(ctx.chunks, nums) : "";
      const hasBridges = ctx.connections.some(isMongoBridge);
      const hasSheets = ctx.connections.some(isSheetsBridge);
      const digest = ctx.connections.length > 0 ? buildBridgeDigest(ctx.connections) : "";
      const system = buildSystemPrompt({
        preferences: req.preferences,
        bridgeDigest: digest,
        knowledgeNames: ctx.knowledgeNames,
        ragContext,
        searchWeb: !!req.searchWeb,
        previousWasClarification: !!req.previousWasClarification,
      });
      const tools = toolDeclarations({ searchWeb: !!req.searchWeb, hasBridges, hasSheets });
      runner = new ToolRunner({
        userId: req.userId,
        bridgeIds: req.bridgeIds,
        emit,
        signal,
        sources,
        recorder,
        enabled: tools.map((t) => t.name),
        maxCalls: req.mode === "research" ? RESEARCH_MAX_TOOL_CALLS : undefined,
      });

      emit({
        type: "status",
        message: isAutoModel(req.model) ? "Choosing the best available model" : `Routing to ${driver.model}`,
        code: "llm.routing",
      });

      if (req.mode === "research") {
        const available: SourceUse[] = [
          ...(hasBridges || hasSheets ? (["data"] as const) : []),
          ...(ctx.chunks.length > 0 || ctx.knowledgeNames.length > 0 ? (["docs"] as const) : []),
          ...(req.searchWeb ? (["web"] as const) : []),
        ];
        const out = await runResearch({
          driver,
          question: req.prompt,
          system,
          availableData: buildAvailableData(digest, ctx.knowledgeNames),
          available,
          tools,
          runner,
          sources,
          retrieve: (query, s) =>
            this.loader.retrieve(req.userId, query, {
              signal: s,
              apiKey: llm.provider === "gemini" && llm.apiKey ? llm.apiKey : undefined,
            }),
          emit,
          signal,
          onReportText: onText,
        });
        usage.tokensIn += out.usage.tokensIn;
        usage.tokensOut += out.usage.tokensOut;
        modelId = out.model;
        research = { steps: out.steps, durationMs: out.durationMs };
        if (out.reportHitTurnLimit) onText(RAN_OUT_OF_STEPS);
        if (out.stopped || signal.aborted) return finish("stopped");
        if (out.error) return finish("error", out.error);
        return finish("complete");
      }

      emit({ type: "status", message: "Generating the answer", code: "llm.generating" });
      const history = (req.history ?? [])
        .filter((t) => t.role === "user" || t.role === "assistant")
        .slice(-2 * CHAT_CONTEXT_MAX_MESSAGES);
      const loop = await driver.runToolLoop({
        system,
        history,
        prompt: req.prompt,
        tools,
        executeTool: (name, args) => runner!.execute(name, args),
        maxTurns: chatMaxTurns(),
        signal,
        onText,
      });
      usage.tokensIn += loop.usage.tokensIn;
      usage.tokensOut += loop.usage.tokensOut;
      modelId = loop.model;
      if (loop.hitTurnLimit) onText(RAN_OUT_OF_STEPS);
      if (signal.aborted) return finish("stopped");

      // An empty final turn (only a meta block, or nothing after tool calls): ask once more, without tools.
      if (answerMissing()) {
        log().warn("empty answer; retrying the final turn once without tools", { model: modelId, toolCalls: runner.calls });
        filter = new MetaStreamFilter();
        try {
          const retry = await driver.runToolLoop({
            system,
            history,
            prompt: buildRetryPrompt(req.prompt, recorder.queries, sources.snapshot()),
            tools: [],
            executeTool: async () => ({ success: false, error: "Tools are not available for this answer." }),
            maxTurns: 1,
            signal,
            onText,
          });
          usage.tokensIn += retry.usage.tokensIn;
          usage.tokensOut += retry.usage.tokensOut;
          modelId = retry.model;
        } catch (err) {
          const e = toLlmError(err, signal);
          if (e.code === "ABORTED" || signal.aborted) return finish("stopped");
          log().warn("the empty-answer retry failed", { code: e.code, status: e.status, message: e.message });
        }
        if (signal.aborted) return finish("stopped");
      }
      return finish("complete");
    } catch (err) {
      const e = toLlmError(err, signal);
      if (e.code === "ABORTED" || signal.aborted) return finish("stopped");
      log().warn("brain run failed", { code: e.code, status: e.status, message: e.message });
      return finish("error", e);
    }
  };

  /** 4 or 5 starter questions for a bridge or document digest. Never throws ([] on failure). */
  suggestQuestions = async (digest: string, llm: LlmCredentials): Promise<string[]> => {
    if (!digest?.trim()) return [];
    try {
      const driver = this.factory(llm, lightModel(llm), { connectMs: 10_000, idleMs: 10_000 });
      const { text } = await driver.complete({
        system: SUGGEST_SYSTEM,
        prompt: `DATA (untrusted, describes the user's data):\n${digest.slice(0, 6000)}`,
        maxTokens: 500,
        json: true,
        signal: AbortSignal.timeout(15_000),
      });
      let parsed: any;
      try {
        parsed = JSON.parse(text.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, ""));
      } catch {
        parsed = extractJsonObject(text);
      }
      const list: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
      const out: string[] = [];
      for (const q of list) {
        if (typeof q !== "string") continue;
        const clean = q
          .replace(/\s*[\u2014\u2013]\s*/g, ", ")
          .replace(/^\s*(\d+[.)]|[-*])\s*/, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 140);
        if (clean.length >= 5 && !out.includes(clean)) out.push(clean);
        if (out.length >= 5) break;
      }
      return out;
    } catch (err) {
      log().warn("suggestQuestions failed", { message: (err as Error)?.message });
      return [];
    }
  };

  /** Model picker options for GET /user/models ("auto" first), with cooldown state. */
  listModels = (llm: LlmCredentials, opts: ListModelsOptions = {}): ModelOption[] => {
    const provider = llm.provider;
    const ids = [...(CURATED[provider] ?? [])];
    if (llm.apiKey && provider !== "gemini") {
      for (const id of opts.availableModels ?? []) {
        if (ids.length >= 30) break;
        if (typeof id === "string" && LISTABLE[provider]?.test(id) && !ids.includes(id)) ids.push(id);
      }
    }
    const option = (id: string): ModelOption => {
      const until = this.health.cooldownUntil(llm.keyId, id);
      return {
        id,
        label: MODEL_LABELS[id] ?? id,
        provider,
        available: until === null,
        cooldownUntil: until === null ? null : new Date(until).toISOString(),
      };
    };
    const models = ids.map(option);
    const autoTarget = provider === "gemini" ? null : DEFAULT_MODELS[provider];
    const autoAvailable = autoTarget ? this.health.isAvailable(llm.keyId, autoTarget) : models.some((m) => m.available);
    const cooldowns = models.map((m) => m.cooldownUntil).filter((x): x is string => !!x).sort();
    return [
      {
        id: AUTO_MODEL,
        label: "Auto",
        provider,
        available: autoAvailable,
        cooldownUntil: autoAvailable ? null : cooldowns[0] ?? null,
      },
      ...models,
    ];
  };

  /**
   * @deprecated Compatibility wrapper for the pre-WS-3b chat controller.
   * Loads the user's key itself, applies the free-tier check and increment
   * exactly as before, runs `run`, and yields string tokens followed by
   * `{ type: "done", data }` in the legacy shape.
   */
  async *askStream(
    userId: string,
    prompt: string,
    options?: AskOptions
  ): AsyncGenerator<string | { type: "done"; data: BrainResponse }, BrainResponse> {
    options?.onStatus?.("Connecting to wuup...");

    const user: any = await User.findById(userId);
    let customKey: string | undefined;
    let provider: LlmProvider = "gemini";

    if (user) {
      customKey = legacyUserKey(user);
      if (customKey) {
        const p = String(user.customApiProvider || "gemini") as LlmProvider;
        provider = LLM_PROVIDERS.has(p) ? p : "gemini";
      } else {
        if (user.freeTierUsage >= user.freeTierLimit) {
          yield LIMIT_MSG;
          const data: BrainResponse = {
            content: LIMIT_MSG,
            source: "system",
            followUps: [{ label: "Add API Key", suggestedPrompt: "How do I add my API key?" }],
          };
          yield { type: "done", data };
          return data;
        }
        user.freeTierUsage += 1;
        await user.save();
      }
    }

    const llm: LlmCredentials = { provider, apiKey: customKey ?? null, keyId: keyIdFor(customKey) };
    const history = (options?.chatHistory ?? [])
      .filter((t): t is { role: "user" | "assistant"; content: string } => t.role === "user" || t.role === "assistant")
      .slice(-CHAT_CONTEXT_MAX_MESSAGES);
    const prefs = user?.preferences ?? undefined;

    const queue: string[] = [];
    let wake: (() => void) | null = null;
    let finished = false;
    const notify = () => {
      const w = wake;
      wake = null;
      w?.();
    };
    const resultPromise = this.run(
      {
        userId,
        prompt,
        mode: "chat",
        history,
        model: isAutoModel(options?.model) ? AUTO_MODEL : options?.model,
        searchWeb: options?.searchWeb,
        bridgeIds: options?.bridgeIds,
        llm,
        preferences: prefs
          ? {
              aboutMe: prefs.aboutMe,
              responseStyle: prefs.responseStyle,
              customInstructions: prefs.customInstructions,
              preferTables: prefs.preferTables,
            }
          : undefined,
      },
      {
        signal: new AbortController().signal,
        emit: (e) => {
          if (e.type === "token") {
            queue.push(e.text);
            notify();
          } else if (e.type === "status") {
            options?.onStatus?.(e.message);
          }
        },
      }
    ).finally(() => {
      finished = true;
      notify();
    });

    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (finished) break;
      await new Promise<void>((resolve) => (wake = resolve));
    }
    const result = await resultPromise;

    let content = result.content;
    let followUps = result.followUps;
    if (result.outcome === "error" && result.error) {
      if (!result.producedOutput) {
        content = result.error.message;
        yield result.error.message;
      }
      if (result.error.code === "PROVIDER_AUTH") followUps = [{ label: "Verify API Key", suggestedPrompt: "How do I check my API key?" }];
    }

    const firstQuery = result.queries[0];
    const data: BrainResponse = {
      content,
      followUps,
      clarification: result.clarification ?? undefined,
      source: firstQuery?.connectionName,
      queryPerformed: firstQuery?.tool,
      queries: result.queries,
      ragSources: result.sources
        .filter((s): s is Extract<typeof s, { kind: "doc" }> => s.kind === "doc")
        .map((s) => ({ sourceFile: s.title, pageNumber: s.page ?? 0, score: s.score, text: s.snippet })),
      webSources: result.sources
        .filter((s): s is Extract<typeof s, { kind: "web" }> => s.kind === "web")
        .map((s) => ({ title: s.title, url: s.url })),
      visualType: result.visualType,
      chartData: result.chartData ?? undefined,
      tableData: result.tableData ?? undefined,
      diagramData: result.diagramData ?? undefined,
      usedModel: result.model.id,
      exhausted: result.exhausted,
    };
    yield { type: "done", data };
    return data;
  }
}

/** The user's own key: encrypted (customApiKeyEnc) first, then the legacy plaintext field. */
function legacyUserKey(user: any): string | undefined {
  if (user?.customApiKeyEnc) {
    try {
      const key = cryptoService.decrypt(String(user.customApiKeyEnc));
      if (key) return key;
    } catch {
      log().warn("could not decrypt the user's API key; falling back to the free tier");
    }
  }
  return typeof user?.customApiKey === "string" && user.customApiKey ? user.customApiKey : undefined;
}

/** @deprecated alias kept for older imports. */
export const BrainOrchestrator = Brain;

export const brain = new Brain();
