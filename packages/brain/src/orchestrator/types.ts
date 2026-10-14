import type {
  ChartData,
  Clarification,
  DiagramData,
  ErrorCode,
  FollowUp,
  ResearchStep,
  Source,
  StreamEvent,
  TableData,
  VisualType,
} from "@wup/contracts";
import type { QueryRecord } from "../tools/types";
import type { LlmCredentials, LlmProvider } from "../ai/common";

export type { LlmCredentials };

export interface BrainPreferences {
  aboutMe?: string;
  responseStyle?: "concise" | "balanced" | "detailed";
  customInstructions?: string;
  preferTables?: boolean;
}

export interface BrainRequest {
  userId: string;
  prompt: string;
  mode: "chat" | "research";
  /** Prior turns, oldest first (the API trims the window). */
  history: { role: "user" | "assistant"; content: string }[];
  /** "auto" or a model id. */
  model?: string;
  searchWeb?: boolean;
  /** Bridges enabled for the chat; empty/undefined = all of the user's bridges. */
  bridgeIds?: string[];
  llm: LlmCredentials;
  preferences?: BrainPreferences;
  /** The previous assistant turn was a clarification: answer now instead of asking again. */
  previousWasClarification?: boolean;
}

/** Events streamed while answering: StreamEvent minus start/done/title/error (the API owns those). */
export type BrainEvent = Exclude<StreamEvent, { type: "start" } | { type: "done" } | { type: "title" } | { type: "error" }>;

export type BrainOutcome = "complete" | "stopped" | "error";

export interface BrainResult {
  content: string;
  followUps: FollowUp[];
  clarification: Clarification | null;
  visualType: VisualType;
  chartData: ChartData | null;
  tableData: TableData | null;
  diagramData: DiagramData | null;
  sources: Source[];
  queries: QueryRecord[];
  research: { steps: ResearchStep[]; durationMs: number } | null;
  model: { provider: LlmProvider; id: string; usingOwnKey: boolean };
  usage: { tokensIn: number; tokensOut: number };
  toolCalls: number;
  /** ms from run() start to the first visible token. */
  firstTokenMs: number | null;
  /** Models cooling down (rate limited / out of quota) for this key. */
  exhausted: string[];
  /** Any visible text was emitted. */
  producedOutput: boolean;
  outcome: BrainOutcome;
  /** Set when outcome is "error". `message` is safe to show the user (no em dashes). */
  error?: { code: ErrorCode; message: string; retryable: boolean };
}

export interface RunOptions {
  emit(e: BrainEvent): void;
  signal: AbortSignal;
}
