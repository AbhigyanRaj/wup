/**
 * LlmDriver: one interface over every provider wuup supports.
 *
 *   runToolLoop: streams text through onText, runs tool calls through
 *     executeTool (whose errors go back to the model, never up), and forces a
 *     final answer on the last turn.
 *   complete: one non-streaming completion (titles, plans, suggestions).
 *
 * Every network call is bounded by the caller's AbortSignal, a connect timeout
 * and a 60s stream-idle watchdog (see RequestGuard). Errors surface as LlmError
 * with a contracts ErrorCode (PROVIDER_AUTH, MODEL_UNAVAILABLE, PROVIDER_ERROR, ABORTED).
 */

import { GeminiDriver } from "./gemini";
import { AnthropicDriver, OpenAICompatibleDriver } from "./providers";
import { LlmError, type DriverOptions, type LlmCredentials, type LlmDriver } from "./common";

export * from "./common";

export function createDriver(llm: LlmCredentials, model?: string, opts?: DriverOptions): LlmDriver {
  const provider = llm.provider;
  switch (provider) {
    case "gemini":
      return new GeminiDriver(llm, model, opts);
    case "openai":
    case "openrouter":
      if (!llm.apiKey) throw new LlmError("PROVIDER_AUTH", `An API key is required for ${provider}.`);
      return new OpenAICompatibleDriver(provider, llm, model, opts);
    case "anthropic":
      if (!llm.apiKey) throw new LlmError("PROVIDER_AUTH", "An API key is required for anthropic.");
      return new AnthropicDriver(llm, model, opts);
    default: {
      const never: never = provider;
      throw new LlmError("PROVIDER_ERROR", `Unknown AI provider: ${String(never)}`);
    }
  }
}

export type DriverFactory = typeof createDriver;
