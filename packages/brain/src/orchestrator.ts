import type { Content } from "@google/generative-ai";
import { Connection } from "../../../apps/api/src/models/Connection";
import { User } from "../../../apps/api/src/models/User";
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
    text?: string;
  }>;
  /** Web sources retrieved by Google Search grounding */
  webSources?: Array<{
    title: string;
    url: string;
  }>;
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
  chartData?: any;
  tableData?: any;
  diagramData?: any;
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
      chartData: parsed.chartData ?? undefined,
      tableData: parsed.tableData ?? undefined,
      diagramData: parsed.diagramData ?? undefined,
    };
  } catch {
    return { content, followUps: [], visualType: "none" };
  }
}

async function* streamOpenAICompatible(
  url: string,
  apiKey: string,
  modelName: string,
  systemInstruction: string,
  prompt: string,
  chatHistory: ChatTurn[],
  provider: string
): AsyncGenerator<string, void, unknown> {
  const messages = [
    { role: "system", content: systemInstruction },
    ...chatHistory.map(turn => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.content
    })),
    { role: "user", content: prompt }
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://wuup.ai";
    headers["X-Title"] = "Wuup";
  }

  let resolvedModel = modelName;
  if (modelName === "Auto-Rotate") {
    if (provider === "openrouter") {
      resolvedModel = "google/gemini-2.5-flash";
    } else if (provider === "openai") {
      resolvedModel = "gpt-4o-mini";
    } else {
      resolvedModel = "claude-3-5-sonnet-20241022";
    }
  }

  const payload: any = {
    model: resolvedModel,
    stream: true,
  };

  if (provider === "anthropic") {
    payload.messages = messages.filter(m => m.role !== "system");
    const sysMsg = messages.find(m => m.role === "system");
    if (sysMsg) {
      payload.system = sysMsg.content;
    }
    payload.max_tokens = 4096;
  } else {
    payload.messages = messages;
    payload.temperature = 0.2;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr = errorText;
    try {
      const parsed = JSON.parse(errorText);
      parsedErr = parsed.error?.message || parsed.message || errorText;
    } catch (e) {}
    throw new Error(`API error: ${response.status} - ${parsedErr}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine.startsWith("data: ")) {
          const dataStr = cleanLine.slice(6);
          if (dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error?.message) {
              throw new Error(parsed.error.message);
            }
            if (provider === "anthropic") {
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                yield parsed.delta.text;
              }
            } else {
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            }
          } catch (e: any) {
            if (e instanceof SyntaxError) {
              // Ignore partial chunk syntax parse errors
            } else {
              throw e;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class BrainOrchestrator {
  /** Models tried in order during Auto-Rotate mode */
  private static readonly MODEL_ROTATION = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
    "gemini-1.5-flash-latest",
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

    // ── Step 0: Check Hybrid Model Limits ───────────────────────────────────
    const user = await User.findById(userId);
    let customKey: string | undefined = undefined;

    if (user) {
      const u = user as any;
      if (u.customApiKey) {
        customKey = u.customApiKey;
        console.log(`[WUP Brain] Using custom API key for user ${userId}`);
      } else {
        if (u.freeTierUsage >= u.freeTierLimit) {
          console.log(`[WUP Brain] User ${userId} hit free tier limit`);
          return {
            content: "You have reached your free tier limit. Please add your own Gemini API key in settings to continue chatting.",
            source: "system",
            followUps: [
              { label: "Add API Key", suggestedPrompt: "How do I add my API key?" }
            ]
          };
        }
        u.freeTierUsage += 1;
        await user.save();
        console.log(`[WUP Brain] User ${userId} free tier usage: ${u.freeTierUsage}/${u.freeTierLimit}`);
      }
    }

    if (user && (user as any).customApiKey && (user as any).customApiProvider && (user as any).customApiProvider !== "gemini") {
      let fullText = "";
      const stream = this.askStream(userId, prompt, options);
      for await (const chunk of stream) {
        if (typeof chunk === "string") {
          fullText += chunk;
        }
      }
      const structured = parseStructuredResponse(fullText);
      return {
        ...structured,
        visualType: structured.visualType as any,
        source: (user as any).customApiProvider,
        usedModel: requestedModel || "Auto-Rotate"
      };
    }

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

        const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS, modelName, customKey);
        const chat = model.startChat({ history: geminiHistory });
        let result = await this.callWithRetry(() => chat.sendMessage(prompt));
        let response = result.response;

        // ── Step 5: Tool call loop (DB bridge function-calling) ───────────────
        let calls = response.functionCalls();
        let turns = 0;
        const MAX_TURNS = 5; // L-5: prevent runaway tool loops

        while (calls && calls.length > 0 && turns < MAX_TURNS) {
          turns++;
          const toolResponses: any[] = [];

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

    const isLocationError =
      lastErr?.message?.toLowerCase().includes("location") ||
      JSON.stringify(lastErr?.errorDetails)?.toLowerCase().includes("location");

    const fallbackContent = isLocationError
      ? "Google restricts direct Gemini API access from this server's region (Singapore). Please deploy your backend server in a supported region (like US-East or US-West), or add your own OpenAI, Anthropic, or OpenRouter API key in settings to continue chatting."
      : isQuotaError
      ? "All available Gemini models have reached their daily limits. Please try again tomorrow."
      : "I'm currently unable to process your request. Please try a different model or try again in a moment.";

    return {
      content: fallbackContent,
      exhausted: Array.from(BrainOrchestrator.exhaustedModels),
    };
  }

  /**
   * SSE Streaming variant of ask(). 
   * Yields text tokens as they stream, handles tool calls silently, and returns the final metadata object.
   */
  async *askStream(
    userId: string,
    prompt: string,
    options?: { chatHistory?: ChatTurn[]; model?: string; searchWeb?: boolean; onStatus?: (message: string) => void }
  ): AsyncGenerator<
    string | { type: "done"; data: BrainResponse & { usedModel?: string; exhausted?: string[] } },
    BrainResponse & { usedModel?: string; exhausted?: string[] }
  > {
    options?.onStatus?.("Connecting to WUP Engine...");
    
    const historyTurns = (options?.chatHistory ?? []).slice(-CHAT_CONTEXT_MAX_MESSAGES);
    const geminiHistory = buildGeminiHistory(historyTurns);

    const requestedModel = options?.model;
    const modelsToTry = requestedModel && requestedModel !== "Auto-Rotate"
        ? [requestedModel]
        : BrainOrchestrator.MODEL_ROTATION.filter(m => !BrainOrchestrator.exhaustedModels.has(m));

    if (modelsToTry.length === 0) {
      modelsToTry.push(BrainOrchestrator.MODEL_ROTATION[BrainOrchestrator.MODEL_ROTATION.length - 1]);
    }

    const user = await User.findById(userId);
    let customKey: string | undefined = undefined;

    if (user) {
      const u = user as any;
      if (u.customApiKey) {
        customKey = u.customApiKey;
      } else {
        if (u.freeTierUsage >= u.freeTierLimit) {
          const limitMsg = "You have reached your free tier limit. Please add your own Gemini API key in settings to continue chatting.";
          yield limitMsg;
          return { content: limitMsg, source: "system", followUps: [{ label: "Add API Key", suggestedPrompt: "How do I add my API key?" }] };
        }
        u.freeTierUsage += 1;
        await user.save();
      }
    }

    if (user && (user as any).customApiKey && (user as any).customApiProvider && (user as any).customApiProvider !== "gemini") {
      const u = user as any;
      const customProvider = u.customApiProvider;
      options?.onStatus?.("Searching Knowledge Base for context...");
      const retrievedChunks = await safeRetrieve(ragService, userId, prompt);
      const ragContext = buildRagContext(retrievedChunks);

      const connections = await Connection.find({ userId });
      const bridgeInfo = connections
        .map((c) => `- Bridge: ${c.name} | Type: ${c.type} | connectionId: ${c._id}`)
        .join("\n");
      const bridgeSection = connections.length > 0 ? bridgeInfo : "NONE. Remind the user to add a DB bridge via the 'Add DB' button.";

      const dynamicInstruction = `${WUP_SYSTEM_PROMPT}${ragContext}\n\nACTIVE DB BRIDGES FOR THIS USER:\n${bridgeSection}`;

      options?.onStatus?.(`Routing to ${customProvider} model...`);
      
      let apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      if (customProvider === "openai") {
        apiUrl = "https://api.openai.com/v1/chat/completions";
      } else if (customProvider === "anthropic") {
        apiUrl = "https://api.anthropic.com/v1/messages";
      }

      let fullText = "";
      try {
        const stream = streamOpenAICompatible(
          apiUrl,
          u.customApiKey,
          requestedModel || "Auto-Rotate",
          dynamicInstruction,
          prompt,
          historyTurns,
          customProvider
        );

        for await (const chunk of stream) {
          fullText += chunk;
          yield chunk;
        }

        const structured = parseStructuredResponse(fullText);
        const finalResult = {
          type: "done" as const,
          data: {
            content: structured.content,
            followUps: structured.followUps,
            clarification: structured.clarification,
            source: connections.length > 0 ? connections[0].name : undefined,
            ragSources: retrievedChunks.map((c) => ({
              sourceFile: c.metadata.sourceFile,
              pageNumber: c.metadata.pageNumber,
              score: c.score,
              text: c.text,
            })),
            webSources: [],
            visualType: structured.visualType as any,
            chartData: structured.chartData,
            tableData: structured.tableData,
            diagramData: structured.diagramData,
            usedModel: requestedModel || "Auto-Rotate",
            exhausted: []
          }
        };
        yield finalResult;
        return finalResult.data;
      } catch (err: any) {
        console.error(`[WUP Brain] ${customProvider} streaming error:`, err);
        const errorMsg = `Error communicating with ${customProvider}: ${err.message || "Please verify your API key."}`;
        yield errorMsg;
        const fallbackResult = {
          type: "done" as const,
          data: {
            content: errorMsg,
            followUps: [{ label: "Verify API Key", suggestedPrompt: "How do I check my API key?" }],
            visualType: "none" as const,
            usedModel: requestedModel || "Auto-Rotate",
            exhausted: []
          }
        };
        yield fallbackResult;
        return fallbackResult.data;
      }
    }

    options?.onStatus?.("Searching Knowledge Base for context...");

    const retrievedChunks = await safeRetrieve(ragService, userId, prompt);
    const ragContext = buildRagContext(retrievedChunks);

    if (retrievedChunks.length > 0) {
      options?.onStatus?.(`Found ${retrievedChunks.length} relevant document chunks.`);
    } else {
      options?.onStatus?.(`No relevant documents found. Relying on general knowledge.`);
    }

    const connections = await Connection.find({ userId });
    
    if (connections.length > 0) {
      options?.onStatus?.(`Checking ${connections.length} active database bridges...`);
    }

    const bridgeInfo = connections
      .map((c) => `- Bridge: ${c.name} | Type: ${c.type} | connectionId: ${c._id}`)
      .join("\n");
    const bridgeSection = connections.length > 0 ? bridgeInfo : "NONE. Remind the user to add a DB bridge via the 'Add DB' button.";

    const dynamicInstruction = `${WUP_SYSTEM_PROMPT}${ragContext}\n\nACTIVE DB BRIDGES FOR THIS USER:\n${bridgeSection}`;

    let lastErr: GeminiError | null = null;

    for (const modelName of modelsToTry) {
      try {
        options?.onStatus?.(`Routing to ${modelName}...`);
        const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS, modelName, customKey, options?.searchWeb);
        const chat = model.startChat({ history: geminiHistory });
        
        if (options?.searchWeb) {
           options?.onStatus?.(`Searching the web for current information...`);
        } else {
           options?.onStatus?.(`Generating Response...`);
        }

        let currentPrompt: any = prompt;
        let turns = 0;
        const MAX_TURNS = 5;

        while (turns < MAX_TURNS) {
          turns++;
          // Instead of sendMessage, we use sendMessageStream to stream tokens
          const result = await this.callWithRetry(() => chat.sendMessageStream(currentPrompt));
          
          let hasToolCall = false;
          let toolResponses: any[] = [];
          
          let fullText = "";
          let buffer = "";
          let metaStarted = false;

          for await (const chunk of result.stream) {
            const calls = chunk.functionCalls();
            if (calls && calls.length > 0) {
              hasToolCall = true;
              for (const call of calls) {
                const toolFn = WUP_TOOLS_REGISTRY[call.name];
                if (toolFn) {
                  const toolResult = await toolFn(call.args);
                  toolResponses.push({
                    functionResponse: { name: call.name, response: toolResult },
                  });
                }
              }
              break; // exit stream chunk loop to handle tool responses
            } else if (chunk.text) {
              const textChunk = chunk.text();
              buffer += textChunk;
              
              if (!metaStarted) {
                const matchIdx = buffer.indexOf(META_START);
                if (matchIdx !== -1) {
                  metaStarted = true;
                  const cleanNew = buffer.slice(0, matchIdx);
                  if (cleanNew.length > 0) {
                    fullText += cleanNew;
                    yield cleanNew;
                  }
                  buffer = buffer.slice(matchIdx + META_START.length);
                } else {
                  // Not found yet. To prevent chunk boundaries from splitting META_START,
                  // we yield everything EXCEPT the last (META_START.length - 1) characters.
                  const safeLength = buffer.length - (META_START.length - 1);
                  if (safeLength > 0) {
                    const toYield = buffer.slice(0, safeLength);
                    fullText += toYield;
                    yield toYield;
                    buffer = buffer.slice(safeLength);
                  }
                }
              }
              // If metaStarted is true, buffer just accumulates textChunk seamlessly
            }
          }

          if (hasToolCall && toolResponses.length > 0) {
            currentPrompt = toolResponses;
            continue; // Go back to top of while loop with the tool response
          }

          // Complete response successfully generated
          if (!metaStarted && buffer.length > 0) {
             // Flush remaining buffer if we never hit META_START
             fullText += buffer;
             yield buffer;
             buffer = "";
          }

          if (metaStarted) {
             fullText += META_START + buffer; // reconstruct full string for the parser
          }

          // Extract web sources from Gemini Grounding metadata
          const finalResponse = await result.response;
          const gm: any = finalResponse.candidates?.[0]?.groundingMetadata;
          const webSources: Array<{title: string, url: string}> = [];
          
          if (gm) {
             if (gm.groundingChunks) {
                gm.groundingChunks.forEach((c: any) => {
                   if (c.web?.uri) webSources.push({ url: c.web.uri, title: c.web.title || c.web.uri });
                });
             } else if (gm.web?.webUris) {
                gm.web.webUris.forEach((u: any) => {
                   webSources.push({ url: u.uri, title: u.title || u.uri });
                });
             }
          }

          const structured = parseStructuredResponse(fullText);
          const finalResult = {
            type: "done" as const,
            data: {
              content: structured.content,
              followUps: structured.followUps,
              clarification: structured.clarification,
              source: connections.length > 0 ? connections[0].name : undefined,
              ragSources: retrievedChunks.map((c) => ({
                sourceFile: c.metadata.sourceFile,
                pageNumber: c.metadata.pageNumber,
                score: c.score,
                text: c.text,
              })),
              webSources,
              visualType: structured.visualType as any,
              chartData: structured.chartData,
              tableData: structured.tableData,
              diagramData: structured.diagramData,
              usedModel: modelName,
              exhausted: Array.from(BrainOrchestrator.exhaustedModels),
            }
          };
          yield finalResult;
          return finalResult.data;
        }
      } catch (err: unknown) {
        const error = err as GeminiError;
        lastErr = error;
        const isDailyQuota = JSON.stringify(error.errorDetails)?.includes("PerDay") || error.message?.includes("RESOURCE_EXHAUSTED");
        if (isDailyQuota || error.status === 429) {
          BrainOrchestrator.exhaustedModels.add(modelName);
          continue;
        }
        continue;
      }
    }

    const isQuotaError = lastErr?.message?.includes("quota") || JSON.stringify(lastErr?.errorDetails)?.includes("QuotaFailure");
    const isLocationError = lastErr?.message?.toLowerCase().includes("location") || JSON.stringify(lastErr?.errorDetails)?.toLowerCase().includes("location");
    
    const fallbackMsg = isLocationError
        ? "Google restricts direct Gemini API access from this server's region (Singapore). Please deploy your backend server in a supported region (like US-East or US-West), or add your own OpenAI, Anthropic, or OpenRouter API key in settings to continue chatting."
        : isQuotaError
        ? "All available Gemini models have reached their daily limits. Please try again tomorrow."
        : "I'm currently unable to process your request. Please try a different model or try again in a moment.";
    yield fallbackMsg;
    const fallbackResult = {
      type: "done" as const,
      data: {
        content: fallbackMsg,
        exhausted: Array.from(BrainOrchestrator.exhaustedModels),
      }
    };
    yield fallbackResult;
    return fallbackResult.data;
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
