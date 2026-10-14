export * from "./orchestrator";
export * from "./utils/crypto";
export * from "./utils/logger";
export * from "./tools/registry";
export * from "./rag/retriever";
export * from "./tools/types";
export * from "./bridges"; // mongo, sheets, sample bridge (WS-2)

// LLM drivers
export {
  createDriver,
  LlmError,
  RequestGuard,
  isAutoModel,
  AUTO_MODEL,
  type DriverFactory,
  type LlmDriver,
  type LlmProvider,
  type DriverOptions,
  type RunToolLoopParams,
  type ToolLoopResult,
  type CompleteParams,
  type CompleteResult,
  type ToolDeclaration,
  type Usage,
} from "./ai/driver";
export { modelHealth, ModelHealth, nextQuotaReset } from "./ai/modelHealth";
export { MODEL_ROTATION } from "./ai/gemini";

// Citations
export { SourceRegistry, MAX_SNIPPET_CHARS, type SourceInput } from "./citations/sourceRegistry";

// Research
export { runResearch } from "./research/runner";
export { parsePlan, researchMaxSteps } from "./research/plan";
export * as publicTools from "./public-tools";
