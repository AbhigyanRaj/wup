import type { Content } from "@google/generative-ai";
import { Connection } from "../../../apps/api/src/models/Connection";
import { getGeminiModel, WUP_SYSTEM_PROMPT } from "./ai/gemini";
import { WUP_AI_TOOLS, WUP_TOOLS_REGISTRY } from "./tools/registry";

/**
 * The BrainOrchestrator coordinates between user prompts, 
 * connected databases, and the Gemini AI model.
 */

export interface BrainResponse {
  content: string;
  source?: string;
  queryPerformed?: string;
}

/** One stored message role + text (from DB or tests). */
export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Sliding window: max prior messages (user + assistant) injected into Gemini history */
export const CHAT_CONTEXT_MAX_MESSAGES = 10;

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

  while (raw.length > 0 && raw[0].role !== "user") {
    raw.shift();
  }
  while (raw.length > 0 && raw[raw.length - 1].role !== "model") {
    raw.pop();
  }

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

export class BrainOrchestrator {
  /** List of models to try in order during auto-rotation */
  private static readonly MODEL_ROTATION = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
  ];

  /** TRACKER: Models that hit daily limits in this run */
  private static exhaustedModels = new Set<string>();

  /**
   * Main entry point for a user's question to the Brain.
   * Handles the Function Calling loop (Tools) internally.
   * @param chatHistory prior turns in this thread (oldest → newest); current user message is sent separately via `prompt`.
   */
  async ask(
    userId: string,
    prompt: string,
    options?: { chatHistory?: ChatTurn[]; model?: string }
  ): Promise<BrainResponse & { usedModel?: string; exhausted?: string[] }> {
    const historyTurns = (options?.chatHistory ?? []).slice(-CHAT_CONTEXT_MAX_MESSAGES);
    const geminiHistory = buildGeminiHistory(historyTurns);

    const requestedModel = options?.model;
    const modelsToTry = requestedModel && requestedModel !== "Auto-Rotate"
      ? [requestedModel]
      : BrainOrchestrator.MODEL_ROTATION.filter(m => !BrainOrchestrator.exhaustedModels.has(m));

    // Fallback if all preferred models are exhausted
    if (modelsToTry.length === 0) {
      modelsToTry.push(BrainOrchestrator.MODEL_ROTATION[1]); // Try 1.5-flash as final hope
    }

    console.log(
      `[WUP Brain] Processing query for user ${userId} using ${requestedModel || "Auto-Rotate"}: "${prompt.slice(0, 100)}..."`
    );

    // 1. Fetch available connections
    const connections = await Connection.find({ userId });
    const bridgeInfo = connections.map(c => 
      `- Bridge: ${c.name} | Type: ${c.type} | connectionId: ${c._id}`
    ).join("\n");
    const dynamicInstruction = `${WUP_SYSTEM_PROMPT}\n\nACTIVE BRIDGES FOR THIS USER:\n${connections.length > 0 ? bridgeInfo : "NONE. Remind user to add a DB."}`;

    let lastErr: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[WUP Brain] Attempting model: ${modelName}`);
        
        // 3. Initialize Gemini with Tools
        const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS, modelName);
        
        // 4. Start chat
        const chat = model.startChat({ history: geminiHistory });
        let result = await this.callWithRetry(() => chat.sendMessage(prompt));
        let response = result.response;

        // 5. Tool Loop
        let calls = response.functionCalls();
        let turns = 0;
        const MAX_TURNS = 5;

        while (calls && calls.length > 0 && turns < MAX_TURNS) {
          turns++;
          const toolResponses = [];
          for (const call of calls) {
            const toolFn = WUP_TOOLS_REGISTRY[call.name];
            if (toolFn) {
              const toolResult = await toolFn(call.args);
              toolResponses.push({ functionResponse: { name: call.name, response: toolResult } });
            }
          }

          if (toolResponses.length > 0) {
            result = await this.callWithRetry(() => chat.sendMessage(toolResponses));
            response = result.response;
            calls = response.functionCalls();
          } else break;
        }

        return {
          content: response.text(),
          source: connections.length > 0 ? connections[0].name : undefined,
          queryPerformed: calls && calls.length > 0 ? calls[0].name : undefined,
          usedModel: modelName,
          exhausted: Array.from(BrainOrchestrator.exhaustedModels)
        };
      } catch (err: any) {
        lastErr = err;
        const isDailyQuota = JSON.stringify(err.errorDetails)?.includes("PerDay");
        
        if (isDailyQuota || err.status === 429) {
          console.warn(`[WUP Brain] Model ${modelName} hit limits. Tracking as exhausted.`);
          BrainOrchestrator.exhaustedModels.add(modelName);
          // If we have more models to try, continue the loop
          continue;
        }
        // For other errors (like 404), switch to next model too
        console.error(`[WUP Brain] Error with ${modelName}:`, err.message);
        continue;
      }
    }

    // If we reach here, all attempted models failed
    const isQuotaError = lastErr?.message?.includes("quota") || JSON.stringify(lastErr?.errorDetails)?.includes("QuotaFailure");

    return {
      content: isQuotaError 
        ? "All available Gemini models have reached their daily limits. Please try again tomorrow or use a different API key." 
        : "I'm currently unable to process your request. Please try a different model.",
      exhausted: Array.from(BrainOrchestrator.exhaustedModels)
    };
  }

  /**
   * Helper to handle API retries, especially for 429 (Rate Limit) errors.
   */
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        
        // Check for 429 Too Many Requests
        if (err.status === 429 || err.message?.includes("429")) {
          // If it's a DAILY quota limit, don't bother retrying
          const isDailyLimit = JSON.stringify(err.errorDetails)?.includes("PerDay");
          if (isDailyLimit) {
            console.error("[WUP Brain] Daily quota exhausted. Failing fast.");
            throw err;
          }

          let delayMs = Math.pow(2, attempt) * 2000; // Default exponential backoff

          // Try to extract retryDelay from Google API error details
          const retryInfo = err.errorDetails?.find(
            (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
          );

          if (retryInfo?.retryDelay) {
            const seconds = parseInt(retryInfo.retryDelay.replace("s", ""));
            if (!isNaN(seconds)) {
              delayMs = seconds * 1000;
            }
          }

          // Safety cap: don't wait more than 15 seconds in a web request
          if (delayMs > 15000) {
            console.warn(`[WUP Brain] Retry delay ${delayMs}ms is too long. Failing.`);
            throw err;
          }

          console.warn(
            `[WUP Brain] Rate limit hit (429). Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${maxRetries})`
          );
          
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
}


export const brain = new BrainOrchestrator();
