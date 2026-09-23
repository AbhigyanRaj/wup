import type { Content } from "@google/generative-ai";
import { Connection } from "@wup/models";
import { User } from "@wup/models";
import { getGeminiModel, WUP_SYSTEM_PROMPT } from "./ai/gemini";
import { streamWithTools, resolveModel, type CustomProvider } from "./ai/providers";
import { WUP_AI_TOOLS, WUP_TOOLS_REGISTRY } from "./tools/registry";
import type { QueryRecord, ToolContext } from "./tools/types";
import { ragService, safeRetrieve, buildRagContext, type RetrievedChunk } from "./rag/retriever";
import { buildBridgeDigest } from "./bridges/mongo/digest";
import { rowsToTable } from "./bridges/mongo/values";

/**
 * BrainOrchestrator: The central intelligence engine for WUP.
 *
 * Query pipeline (RAG-first):
 *   1. Fetch user's active DB bridges (connections), filtered by the chat's selection
 *   2. RAG retrieval — embed query → vector search → top-K chunks (non-blocking)
 *   3. Build context: [RAG chunks] + [chat history] + [bridge schema digest]
 *   4. Call the LLM (Gemini, or the user's own provider) with full context + tools
 *   5. Execute tool calls (DB bridge function-calling loop), recording each query
 *   6. Return a grounded answer: tables/charts are built from the real query rows
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FollowUpSuggestion {
  label: string;
  suggestedPrompt: string;
}

export interface ClarificationData {
  question: string;
  options: string[];
}

export interface BrainResponse {
  content: string;
  source?: string;
  queryPerformed?: string;
  /** When set, the AI is asking for clarification before answering */
  clarification?: ClarificationData;
  /** Structured follow-up suggestions for the UI chips */
  followUps?: FollowUpSuggestion[];
  /** Chunks retrieved by RAG — used to render citation pills in the UI */
  ragSources?: Array<{
    sourceFile: string;
    pageNumber: number;
    score: number;
    text?: string;
  }>;
  /** Web sources retrieved by Google Search grounding */
  webSources?: Array<{
    title: string;
    url: string;
  }>;
  /** Database queries run to produce this answer (shown as "Query used") */
  queries?: QueryRecord[];
  visualType?: "none" | "mermaid" | "chart" | "table" | "diagram";
  chartData?: {
    type: "bar" | "line" | "pie";
    xAxisKey: string;
    yAxisKey: string;
    title?: string;
    series: Array<Record<string, string | number>>;
  };
  tableData?: {
    columns: string[];
    rows: Array<Record<string, string | number>>;
  };
  diagramData?: {
    nodes: Array<{ id: string; label: string; sublabel?: string; type?: string }>;
    edges: Array<{ from: string; to: string; label?: string }>;
  };
}

/** One stored message role + text (from DB or tests). */
export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AskOptions {
  chatHistory?: ChatTurn[];
  model?: string;
  searchWeb?: boolean;
  /** Bridges enabled for this chat; empty/undefined = all of the user's bridges */
  bridgeIds?: string[];
  onStatus?: (message: string) => void;
}

type BrainResult = BrainResponse & { usedModel?: string; exhausted?: string[] };

interface GeminiError extends Error {
  status?: number;
  errorDetails?: Array<{
    "@type": string;
    retryDelay?: string;
    [key: string]: unknown;
  }>;
}

/** Sliding window: max prior messages (user + assistant) injected into Gemini history */
export const CHAT_CONTEXT_MAX_MESSAGES = 10;

// ─── History Builder ──────────────────────────────────────────────────────────

/**
 * Converts ChatTurn[] into the strict alternating user/model format
 * required by Gemini's multi-turn chat API.
 */
function buildGeminiHistory(turns: ChatTurn[]): Content[] {
  const raw: Content[] = [];
  for (const t of turns) {
    if (t.role === "system") continue;
    const text = t.content?.trim();
    if (!text) continue;
    raw.push({
      role: t.role === "user" ? "user" : "model",
      parts: [{ text }],
    });
  }

  // History must start with "user" and end with "model"
  while (raw.length > 0 && raw[0].role !== "user") raw.shift();
  while (raw.length > 0 && raw[raw.length - 1].role !== "model") raw.pop();

  // Enforce strict alternation
  const fixed: Content[] = [];
  for (const c of raw) {
    const want = fixed.length % 2 === 0 ? "user" : "model";
    if (c.role === want) fixed.push(c);
  }
  while (fixed.length > 0 && fixed[fixed.length - 1].role !== "model") {
    fixed.pop();
  }

  return fixed;
}

// ─── Structured Response Parser ───────────────────────────────────────────────

const META_START = "---WUP_META---";
const META_END = "---END_WUP_META---";

interface StructuredResponse {
  content: string;
  followUps: FollowUpSuggestion[];
  clarification?: ClarificationData;
  visualType: string;
  chartData?: any;
  tableData?: any;
  diagramData?: any;
}

/**
 * Splits the model's response on delimiter markers to extract:
 *   - content: the clean markdown before the meta block
 *   - followUps: structured chip suggestions
 *   - visualType: hint for the UI renderer
 *
 * Gracefully falls back to plain text with empty followUps if parsing fails.
 */
export function parseStructuredResponse(raw: string): StructuredResponse {
  const metaStart = raw.indexOf(META_START);
  const metaEnd = raw.indexOf(META_END);

  if (metaStart === -1 || metaEnd === -1) {
    return { content: raw.trim(), followUps: [], visualType: "none" };
  }

  const content = raw.slice(0, metaStart).trim();
  const metaJson = raw.slice(metaStart + META_START.length, metaEnd).trim();

  try {
    const parsed = JSON.parse(metaJson);

    if (parsed.type === "clarification") {
      return {
        content,
        followUps: [],
        visualType: "none",
        clarification: {
          question: parsed.question ?? content,
          options: Array.isArray(parsed.options) ? parsed.options : [],
        },
      };
    }

    return {
      content,
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
      visualType: parsed.visualType ?? "none",
      chartData: parsed.chartData ?? undefined,
      tableData: parsed.tableData ?? undefined,
      diagramData: parsed.diagramData ?? undefined,
    };
  } catch {
    return { content, followUps: [], visualType: "none" };
  }
}

/**
 * Hides the meta block from the token stream. Holds back the last
 * (META_START.length - 1) characters so a marker split across chunks is caught.
 */
export class MetaStreamFilter {
  private buffer = "";
  private metaStarted = false;
  private visible = "";
  private meta = "";

  push(text: string): string {
    if (this.metaStarted) {
      this.meta += text;
      return "";
    }
    this.buffer += text;
    const idx = this.buffer.indexOf(META_START);
    if (idx !== -1) {
      this.metaStarted = true;
      const out = this.buffer.slice(0, idx);
      this.meta = this.buffer.slice(idx + META_START.length);
      this.buffer = "";
      this.visible += out;
      return out;
    }
    const safeLength = this.buffer.length - (META_START.length - 1);
    if (safeLength <= 0) return "";
    const out = this.buffer.slice(0, safeLength);
    this.buffer = this.buffer.slice(safeLength);
    this.visible += out;
    return out;
  }

  /** Flushes held-back text when the stream ends without a meta block. */
  flush(): string {
    if (this.metaStarted) return "";
    const out = this.buffer;
    this.buffer = "";
    this.visible += out;
    return out;
  }

  /** The full response (visible text + meta block) for parseStructuredResponse. */
  fullText(): string {
    return this.metaStarted ? this.visible + META_START + this.meta : this.visible + this.buffer;
  }
}

// ─── Grounding ────────────────────────────────────────────────────────────────

const MAX_CHART_POINTS = 50;

/**
 * Replaces model-written table/chart data with the real rows from the last
 * database query, so numbers on screen always match what the database returned.
 */
export function applyGrounding(structured: StructuredResponse, rows?: Array<Record<string, any>>): StructuredResponse {
  if (!rows || rows.length === 0 || structured.clarification) return structured;
  const vt = structured.visualType;
  if (vt === "diagram" || vt === "mermaid") return structured;

  const table = rowsToTable(rows);
  const x = structured.chartData?.xAxisKey;
  const y = structured.chartData?.yAxisKey;
  if (vt === "chart" && x && y && table.rows.every((r) => x in r && y in r)) {
    return {
      ...structured,
      chartData: {
        ...structured.chartData,
        series: table.rows.slice(0, MAX_CHART_POINTS).map((r) => ({ [x]: String(r[x]), [y]: Number(r[y]) || 0 })),
      },
      tableData: table,
    };
  }
  return { ...structured, visualType: "table", chartData: undefined, tableData: table };
}

/** Collects database queries and the last result rows during one request. */
class QueryRecorder {
  queries: QueryRecord[] = [];
  lastRows?: Array<Record<string, any>>;

  /** Clears state before retrying the request on another model. */
  reset() {
    this.queries = [];
    this.lastRows = undefined;
  }

  record = (record: QueryRecord, rows?: Array<Record<string, any>>) => {
    if (record.tool === "mongo_describe") return;
    this.queries.push(record);
    if (!record.error && rows && rows.length > 0) this.lastRows = rows;
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

const LIMIT_MSG =
  "You have reached your free tier limit. Please add your own Gemini API key in settings to continue chatting.";

const DATA_BRIDGE_PROMPT = `

DATA BRIDGE RULES:
- The bridge digest below lists every queryable collection with its real field names and types. Use those exact field names; never guess.
- If a collection shows no fields, call mongo_describe before querying it.
- "How many" questions: use mongo_count. Grouping, averages, top-N, trends, joins: use mongo_aggregate. Listing or looking up records: use mongo_find with a projection of the relevant fields.
- Filters and pipelines are Extended JSON strings: {"$oid":"..."} for ObjectIds, {"$date":"2024-01-01T00:00:00Z"} for dates.
- Never invent numbers or records. Every figure you state must come from a tool result. If a query returns nothing or fails, say so plainly and suggest a fix.
- The app renders the real query rows automatically. For database answers do NOT write rows into tableData or chartData.series. For a chart, set visualType "chart" with chartData.type, xAxisKey and yAxisKey naming fields in your last query's result (use $project to give them readable names) and leave series empty.
- If a tool says a field is hidden or a collection isn't enabled, tell the user; don't try to work around it.`;

export class BrainOrchestrator {
  /** Models tried in order during Auto-Rotate mode */
  private static readonly MODEL_ROTATION = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
  ];

  /** Models that hit daily limits in this server process lifetime */
  private static exhaustedModels = new Set<string>();

  /**
   * Non-streaming variant: consumes askStream and returns the final metadata.
   */
  async ask(userId: string, prompt: string, options?: AskOptions): Promise<BrainResult> {
    let final: BrainResult | undefined;
    let text = "";
    for await (const chunk of this.askStream(userId, prompt, options)) {
      if (typeof chunk === "string") text += chunk;
      else final = chunk.data;
    }
    return final ?? { content: text };
  }

  /**
   * Builds the system instruction: base prompt + web search + RAG context + bridge digest.
   */
  private async prepareContext(userId: string, prompt: string, options?: AskOptions) {
    options?.onStatus?.("Searching Knowledge Base for context...");
    const retrievedChunks = await safeRetrieve(ragService, userId, prompt);
    if (retrievedChunks.length > 0) {
      options?.onStatus?.(`Found ${retrievedChunks.length} relevant document chunks.`);
    }

    const filter: Record<string, unknown> = { userId };
    if (options?.bridgeIds?.length) filter._id = { $in: options.bridgeIds };
    const connections: any[] = await Connection.find(filter).select("-config").lean();
    if (connections.length > 0) {
      options?.onStatus?.(`Checking ${connections.length} active database bridge${connections.length > 1 ? "s" : ""}...`);
    }

    const bridgeSection =
      connections.length > 0
        ? `${DATA_BRIDGE_PROMPT}\n\nACTIVE DB BRIDGES FOR THIS USER:\n${buildBridgeDigest(connections)}`
        : "\n\nACTIVE DB BRIDGES FOR THIS USER:\nNONE. Remind the user to add a DB bridge via the 'Add DB' button.";

    const webSearchInstruction = options?.searchWeb
      ? "\n\nWEB SEARCH CAPABILITY:\n- You have a custom `web_search` tool. Use it to search the web for any current facts, news, realtime prices, cryptocurrency rates, weather, or public information outside of your database context. Cite any sources used."
      : "";

    const dynamicInstruction = `${WUP_SYSTEM_PROMPT}${webSearchInstruction}${buildRagContext(retrievedChunks)}${bridgeSection}`;
    return { retrievedChunks, connections, dynamicInstruction };
  }

  private buildResult(
    structured: StructuredResponse,
    ctx: {
      recorder: QueryRecorder;
      retrievedChunks: RetrievedChunk[];
      connections: any[];
      webSources: Array<{ title: string; url: string }>;
      usedModel: string;
      exhausted: string[];
    }
  ): BrainResult {
    const grounded = applyGrounding(structured, ctx.recorder.lastRows);
    const firstQuery = ctx.recorder.queries[0];
    return {
      content: grounded.content,
      followUps: grounded.followUps,
      clarification: grounded.clarification,
      source: firstQuery?.connectionName ?? (ctx.connections.length > 0 ? ctx.connections[0].name : undefined),
      queryPerformed: firstQuery?.tool,
      queries: ctx.recorder.queries,
      ragSources: ctx.retrievedChunks.map((c) => ({
        sourceFile: c.metadata.sourceFile,
        pageNumber: c.metadata.pageNumber,
        score: c.score,
        text: c.text,
      })),
      webSources: ctx.webSources,
      visualType: grounded.visualType as BrainResponse["visualType"],
      chartData: grounded.chartData,
      tableData: grounded.tableData,
      diagramData: grounded.diagramData,
      usedModel: ctx.usedModel,
      exhausted: ctx.exhausted,
    };
  }

  /** Tool declarations for this request (web_search only when enabled). */
  private toolDeclarations(searchWeb?: boolean): any[] {
    return WUP_AI_TOOLS[0].functionDeclarations.filter((d: any) => searchWeb || d.name !== "web_search");
  }

  /**
   * SSE Streaming entry point.
   * Yields text tokens as they stream, handles tool calls, and yields a final { type: "done" } object.
   */
  async *askStream(
    userId: string,
    prompt: string,
    options?: AskOptions
  ): AsyncGenerator<string | { type: "done"; data: BrainResult }, BrainResult> {
    options?.onStatus?.("Connecting to WUP Engine...");

    const historyTurns = (options?.chatHistory ?? []).slice(-CHAT_CONTEXT_MAX_MESSAGES);
    const requestedModel = options?.model;

    // ── Step 0: Free tier / custom key ─────────────────────────────────────
    const user: any = await User.findById(userId);
    let customKey: string | undefined;

    if (user) {
      if (user.customApiKey) {
        customKey = user.customApiKey;
      } else {
        if (user.freeTierUsage >= user.freeTierLimit) {
          yield LIMIT_MSG;
          const data: BrainResult = {
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

    // ── Steps 1-3: Context ─────────────────────────────────────────────────
    const { retrievedChunks, connections, dynamicInstruction } = await this.prepareContext(userId, prompt, options);

    const recorder = new QueryRecorder();
    const webSources: Array<{ title: string; url: string }> = [];
    const toolCtx: ToolContext = {
      userId,
      allowedConnectionIds: options?.bridgeIds,
      onQuery: recorder.record,
      onStatus: options?.onStatus,
    };

    const executeTool = async (name: string, args: any) => {
      const toolFn = WUP_TOOLS_REGISTRY[name];
      if (!toolFn) return { success: false, error: `Unknown tool: ${name}` };
      if (name === "web_search") {
        options?.onStatus?.(`Searching the web for: "${args?.query ?? ""}"...`);
      }
      const result = await toolFn(args, toolCtx);
      if (name === "web_search" && result?.results) {
        for (const item of result.results) {
          webSources.push({ title: item.title, url: item.url });
          options?.onStatus?.(`Fetched source: ${item.title}`);
        }
        if (result.results.length === 0) options?.onStatus?.(`No web search results found.`);
      }
      return result;
    };

    // ── Step 4a: Bring-your-own-key providers ──────────────────────────────
    const customProvider: string | undefined = user?.customApiKey ? user.customApiProvider : undefined;
    if (customProvider && customProvider !== "gemini") {
      const provider = customProvider as CustomProvider;
      options?.onStatus?.(`Routing to ${provider} model...`);
      const filter = new MetaStreamFilter();
      try {
        for await (const chunk of streamWithTools({
          provider,
          apiKey: user.customApiKey,
          model: requestedModel || "Auto-Rotate",
          systemInstruction: dynamicInstruction,
          history: historyTurns,
          prompt,
          declarations: this.toolDeclarations(options?.searchWeb),
          executeTool,
        })) {
          const out = filter.push(chunk);
          if (out) yield out;
        }
        const tail = filter.flush();
        if (tail) yield tail;

        const data = this.buildResult(parseStructuredResponse(filter.fullText()), {
          recorder,
          retrievedChunks,
          connections,
          webSources,
          usedModel: resolveModel(provider, requestedModel),
          exhausted: [],
        });
        yield { type: "done", data };
        return data;
      } catch (err: any) {
        console.error(`[WUP Brain] ${provider} streaming error:`, err?.message ?? err);
        const errorMsg = `Error communicating with ${provider}: ${err?.message || "Please verify your API key."}`;
        yield errorMsg;
        const data: BrainResult = {
          content: errorMsg,
          followUps: [{ label: "Verify API Key", suggestedPrompt: "How do I check my API key?" }],
          visualType: "none",
          queries: recorder.queries,
          usedModel: requestedModel || "Auto-Rotate",
          exhausted: [],
        };
        yield { type: "done", data };
        return data;
      }
    }

    // ── Step 4b: Gemini with model rotation ────────────────────────────────
    const geminiHistory = buildGeminiHistory(historyTurns);
    const modelsToTry =
      requestedModel && requestedModel !== "Auto-Rotate"
        ? [requestedModel]
        : BrainOrchestrator.MODEL_ROTATION.filter((m) => !BrainOrchestrator.exhaustedModels.has(m));
    if (modelsToTry.length === 0) {
      modelsToTry.push(BrainOrchestrator.MODEL_ROTATION[BrainOrchestrator.MODEL_ROTATION.length - 1]);
    }

    let lastErr: GeminiError | null = null;

    for (const modelName of modelsToTry) {
      // Nothing streamed yet for this model: safe to retry on the next one
      let streamedAny = false;
      try {
        options?.onStatus?.(`Routing to ${modelName}...`);
        recorder.reset();
        webSources.length = 0;
        const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS, modelName, customKey, options?.searchWeb);
        options?.onStatus?.(options?.searchWeb ? `Searching the web for current information...` : `Generating Response...`);

        // Conversation is managed here rather than via ChatSession: current Gemini models
        // reject the legacy "function" role the SDK uses for tool results, and Gemini 3
        // requires the model's function-call parts (with thought signatures) echoed verbatim.
        const contents: Content[] = [...geminiHistory, { role: "user", parts: [{ text: prompt }] }];
        const filter = new MetaStreamFilter();
        const MAX_TURNS = 5;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const result = await this.callWithRetry(() => model.generateContentStream({ contents }));
          const modelParts: any[] = [];
          const calls: Array<{ name: string; args: any }> = [];

          for await (const chunk of result.stream) {
            for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
              modelParts.push(part);
              if (part.functionCall) {
                calls.push({ name: part.functionCall.name, args: part.functionCall.args });
              } else if (typeof part.text === "string" && !(part as any).thought && calls.length === 0) {
                const out = filter.push(part.text);
                if (out) {
                  streamedAny = true;
                  yield out;
                }
              }
            }
          }

          if (calls.length > 0) {
            contents.push({ role: "model", parts: modelParts });
            const responses: any[] = [];
            for (const call of calls) {
              const toolResult = await executeTool(call.name, call.args);
              responses.push({ functionResponse: { name: call.name, response: toolResult } });
            }
            contents.push({ role: "user", parts: responses });
            continue; // send tool results back to the model
          }

          const tail = filter.flush();
          if (tail) yield tail;

          // Extract web sources from Gemini Grounding metadata
          const finalResponse = await result.response;
          const gm: any = finalResponse.candidates?.[0]?.groundingMetadata;
          if (gm?.groundingChunks) {
            gm.groundingChunks.forEach((c: any) => {
              if (c.web?.uri) webSources.push({ url: c.web.uri, title: c.web.title || c.web.uri });
            });
          } else if (gm?.web?.webUris) {
            gm.web.webUris.forEach((u: any) => webSources.push({ url: u.uri, title: u.title || u.uri }));
          }
          break;
        }

        const data = this.buildResult(parseStructuredResponse(filter.fullText()), {
          recorder,
          retrievedChunks,
          connections,
          webSources,
          usedModel: modelName,
          exhausted: Array.from(BrainOrchestrator.exhaustedModels),
        });
        yield { type: "done", data };
        return data;
      } catch (err: unknown) {
        const error = err as GeminiError;
        lastErr = error;
        const isDailyQuota =
          JSON.stringify(error.errorDetails)?.includes("PerDay") || error.message?.includes("RESOURCE_EXHAUSTED");
        if (isDailyQuota || error.status === 429) {
          BrainOrchestrator.exhaustedModels.add(modelName);
        } else {
          console.error(`[WUP Brain] Error with ${modelName}: ${error.message}`);
        }
        // Retrying after partial output would duplicate text in the client
        if (streamedAny) break;
      }
    }

    const isQuotaError =
      lastErr?.message?.includes("quota") || JSON.stringify(lastErr?.errorDetails)?.includes("QuotaFailure");
    const isLocationError =
      lastErr?.message?.toLowerCase().includes("location") ||
      JSON.stringify(lastErr?.errorDetails)?.toLowerCase().includes("location");

    const fallbackMsg = isLocationError
      ? "Google restricts direct Gemini API access from this server's region (Singapore). Please deploy your backend server in a supported region (like US-East or US-West), or add your own OpenAI, Anthropic, or OpenRouter API key in settings to continue chatting."
      : isQuotaError
      ? "All available Gemini models have reached their daily limits. Please try again tomorrow."
      : "I'm currently unable to process your request. Please try a different model or try again in a moment.";
    yield fallbackMsg;
    const data: BrainResult = {
      content: fallbackMsg,
      queries: recorder.queries,
      exhausted: Array.from(BrainOrchestrator.exhaustedModels),
    };
    yield { type: "done", data };
    return data;
  }

  /**
   * Wraps an API call with exponential backoff for transient 429 rate limits.
   * Daily quota errors (PerDay) are re-thrown immediately without retrying.
   */
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: GeminiError | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        const error = err as GeminiError;
        lastError = error;

        if (error.status === 429 || error.message?.includes("429")) {
          // Daily limit — fail fast, model rotation will handle it
          const isDailyLimit =
            JSON.stringify(error.errorDetails)?.includes("PerDay");
          if (isDailyLimit) {
            console.error("[WUP Brain] Daily quota exhausted. Failing fast.");
            throw error;
          }

          // Per-minute rate limit — use backoff
          let delayMs = Math.pow(2, attempt) * 2000;

          // Respect Google's retryDelay hint if available
          const retryInfo = error.errorDetails?.find(
            (d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
          );
          if (retryInfo?.retryDelay) {
            const seconds = parseInt(
              (retryInfo.retryDelay as string).replace("s", ""),
              10
            );
            if (!isNaN(seconds)) delayMs = seconds * 1000;
          }

          // Safety cap: don't stall a web request for more than 15 seconds
          if (delayMs > 15000) {
            console.warn(
              `[WUP Brain] Retry delay ${delayMs}ms exceeds cap. Failing.`
            );
            throw error;
          }

          console.warn(
            `[WUP Brain] Rate limit (429). Retry in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error("Unknown error during retry sequence");
  }
}

export const brain = new BrainOrchestrator();
