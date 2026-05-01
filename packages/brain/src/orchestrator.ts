import type { Content } from "@google/generative-ai";
import { Connection } from "../../../apps/api/src/models/Connection";
import { getGeminiModel, WUP_SYSTEM_PROMPT } from "./ai/gemini";
import { WUP_AI_TOOLS, WUP_TOOLS_REGISTRY } from "./tools/registry";
import { ragService, safeRetrieve, buildRagContext } from "./rag/retriever";

/**
 * BrainOrchestrator: The central intelligence engine for WUP.
 *
 * Query pipeline (RAG-first):
 *   1. Fetch user's active DB bridges (connections)
 *   2. RAG retrieval — embed query → vector search → top-K chunks (non-blocking)
 *   3. Build context: [RAG chunks] + [chat history] + [bridge list]
 *   4. Call Gemini LLM with full context + tools
 *   5. Execute tool calls if any (DB bridge function-calling loop)
 *   6. Return grounded answer + source citations
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
  }>;
}

/** One stored message role + text (from DB or tests). */
export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

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

/**
 * Splits the model's response on delimiter markers to extract:
 *   - content: the clean markdown before the meta block
 *   - followUps: structured chip suggestions
 *   - visualType: hint for the UI renderer
 *
 * Gracefully falls back to plain text with empty followUps if parsing fails.
 */
function parseStructuredResponse(raw: string): {
  content: string;
  followUps: FollowUpSuggestion[];
  clarification?: ClarificationData;
  visualType: string;
} {
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
    };
  } catch {
    return { content, followUps: [], visualType: "none" };
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class BrainOrchestrator {
  /** Models tried in order during Auto-Rotate mode */
  private static readonly MODEL_ROTATION = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
    "gemini-1.5-flash",
  ];

  /** Models that hit daily limits in this server process lifetime */
  private static exhaustedModels = new Set<string>();

  /**
   * Main entry point for a user's question to the Brain.
   *
   * @param userId      Authenticated user ID (used for RAG scoping + bridge lookup)
   * @param prompt      The current user message
   * @param options.chatHistory  Prior turns in this thread (oldest → newest)
   * @param options.model        Specific model name, or "Auto-Rotate"
   */
  async ask(
    userId: string,
    prompt: string,
    options?: { chatHistory?: ChatTurn[]; model?: string }
  ): Promise<BrainResponse & { usedModel?: string; exhausted?: string[] }> {
    const historyTurns = (options?.chatHistory ?? []).slice(-CHAT_CONTEXT_MAX_MESSAGES);
    const geminiHistory = buildGeminiHistory(historyTurns);

    const requestedModel = options?.model;
    const modelsToTry =
      requestedModel && requestedModel !== "Auto-Rotate"
        ? [requestedModel]
        : BrainOrchestrator.MODEL_ROTATION.filter(
            (m) => !BrainOrchestrator.exhaustedModels.has(m)
          );

    // Fallback: if all preferred models are exhausted, try the last one anyway
    if (modelsToTry.length === 0) {
      modelsToTry.push(
        BrainOrchestrator.MODEL_ROTATION[BrainOrchestrator.MODEL_ROTATION.length - 1]
      );
    }

    console.log(
      `[WUP Brain] Query from userId=${userId} | model=${requestedModel || "Auto-Rotate"} | prompt="${prompt.slice(0, 80)}..."`
    );

    // ── Step 1: Fetch active DB bridges ──────────────────────────────────────
    const connections = await Connection.find({ userId });
    const bridgeInfo = connections
      .map((c) => `- Bridge: ${c.name} | Type: ${c.type} | connectionId: ${c._id}`)
      .join("\n");

    // ── Step 2: RAG Retrieval (non-blocking — failure returns []) ─────────────
    const retrievedChunks = await safeRetrieve(ragService, userId, prompt);

    if (retrievedChunks.length > 0) {
      console.log(
        `[WUP Brain] RAG: ${retrievedChunks.length} chunks retrieved | ` +
        `top_score=${retrievedChunks[0].score.toFixed(3)}`
      );
    } else {
      console.log(`[WUP Brain] RAG: no relevant chunks found — answering from general knowledge`);
    }

    // ── Step 3: Build dynamic system instruction ──────────────────────────────
    const ragContext = buildRagContext(retrievedChunks);
    const bridgeSection =
      connections.length > 0
        ? bridgeInfo
        : "NONE. Remind the user to add a DB bridge via the 'Add DB' button.";

    const dynamicInstruction =
      `${WUP_SYSTEM_PROMPT}` +
      `${ragContext}` +
      `\n\nACTIVE DB BRIDGES FOR THIS USER:\n${bridgeSection}`;

    // ── Step 4: Model rotation loop ───────────────────────────────────────────
    let lastErr: GeminiError | null = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[WUP Brain] Attempting model: ${modelName}`);

        const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS, modelName);
        const chat = model.startChat({ history: geminiHistory });
        let result = await this.callWithRetry(() => chat.sendMessage(prompt));
        let response = result.response;

        // ── Step 5: Tool call loop (DB bridge function-calling) ───────────────
        let calls = response.functionCalls();
        let turns = 0;
        const MAX_TURNS = 5; // L-5: prevent runaway tool loops

        while (calls && calls.length > 0 && turns < MAX_TURNS) {
          turns++;
          const toolResponses = [];

          for (const call of calls) {
            const toolFn = WUP_TOOLS_REGISTRY[call.name];
            if (toolFn) {
              console.log(`[WUP Brain] Tool call: ${call.name} (turn ${turns})`);
              const toolResult = await toolFn(call.args);
              toolResponses.push({
                functionResponse: { name: call.name, response: toolResult },
              });
            }
          }

          if (toolResponses.length > 0) {
            result = await this.callWithRetry(() => chat.sendMessage(toolResponses));
            response = result.response;
            calls = response.functionCalls();
          } else {
            break;
          }
        }

        // ── Step 6: Return enriched response ──────────────────────────────────
        const structured = parseStructuredResponse(response.text());
        return {
          content: structured.content,
          followUps: structured.followUps,
          clarification: structured.clarification,
          source: connections.length > 0 ? connections[0].name : undefined,
          queryPerformed: calls && calls.length > 0 ? calls[0].name : undefined,
          ragSources: retrievedChunks.map((c) => ({
            sourceFile: c.metadata.sourceFile,
            pageNumber: c.metadata.pageNumber,
            score: c.score,
          })),
          usedModel: modelName,
          exhausted: Array.from(BrainOrchestrator.exhaustedModels),
        };
      } catch (err: unknown) {
        const error = err as GeminiError;
        lastErr = error;

        const isDailyQuota =
          JSON.stringify(error.errorDetails)?.includes("PerDay") ||
          error.message?.includes("RESOURCE_EXHAUSTED");

        if (isDailyQuota || error.status === 429) {
          console.warn(
            `[WUP Brain] Model ${modelName} hit limits. Marking exhausted.`
          );
          BrainOrchestrator.exhaustedModels.add(modelName);
          continue; // Try next model
        }

        // Non-quota errors (404, 500, etc.) — try next model too
        console.error(`[WUP Brain] Error with ${modelName}: ${error.message}`);
        continue;
      }
    }

    // All models failed
    const isQuotaError =
      lastErr?.message?.includes("quota") ||
      JSON.stringify(lastErr?.errorDetails)?.includes("QuotaFailure");

    return {
      content: isQuotaError
        ? "All available Gemini models have reached their daily limits. Please try again tomorrow."
        : "I'm currently unable to process your request. Please try a different model or try again in a moment.",
      exhausted: Array.from(BrainOrchestrator.exhaustedModels),
    };
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
