import type { Clarification, Source, TableData, VisualType } from "@wup/contracts";
import type { QueryRecord } from "../tools/types";

/**
 * Never persist an empty answer. The model sometimes ends a turn with no
 * visible text: only a meta block, a clarification whose question lives only in
 * the meta block, or an empty final turn after tool calls. These rules give
 * every "complete" result non-empty content:
 *
 *   1. clarification -> its question (or CLARIFY_FALLBACK)
 *   2. tool rows     -> FOUND_ROWS_TEXT, and the rows shown as a table
 *      (a grounded chart or diagram with no text also gets FOUND_ROWS_TEXT)
 *   3. otherwise     -> one retry of the final answer turn without tools (orchestrator),
 *                       then NO_ANSWER_TEXT with producedOutput = false (the API refunds quota)
 */

export const CLARIFY_FALLBACK = "Could you clarify what you need?";
export const FOUND_ROWS_TEXT = "Here is what I found.";
export const NO_ANSWER_TEXT = "I couldn't produce an answer this time. Try rephrasing the question.";
export const ANSWER_NOW_NUDGE = "Answer the user's question now in plain language.";

const RETRY_CONTEXT_MAX_CHARS = 4000;

export const isBlank = (s: string | null | undefined) => !s || !s.trim();

export interface FillInput {
  content: string;
  clarification: Clarification | null;
  visualType: VisualType;
  tableData: TableData | null;
  /** Rows of the last successful query, as a table (used when grounding attached none). */
  fallbackTable?: TableData | null;
  /** A chart or diagram with data is attached. */
  hasVisual?: boolean;
}

export type FillOutcome =
  | { kind: "kept" }
  | { kind: "clarification"; content: string }
  | { kind: "found"; content: string; visualType: VisualType; tableData: TableData | null }
  | { kind: "empty" };

/**
 * Decides how to fill an empty answer. "empty" means nothing usable exists and
 * the caller should retry (once) or give up with NO_ANSWER_TEXT.
 */
export function fillEmptyAnswer(r: FillInput): FillOutcome {
  if (!isBlank(r.content)) return { kind: "kept" };
  if (r.clarification) {
    const q = r.clarification.question?.trim();
    return { kind: "clarification", content: q || CLARIFY_FALLBACK };
  }
  if (r.hasVisual && r.visualType !== "none") {
    return { kind: "found", content: FOUND_ROWS_TEXT, visualType: r.visualType, tableData: r.tableData };
  }
  const table = r.tableData?.rows?.length ? r.tableData : r.fallbackTable?.rows?.length ? r.fallbackTable : null;
  if (table) {
    return {
      kind: "found",
      content: FOUND_ROWS_TEXT,
      visualType: r.visualType === "none" || r.visualType === "table" ? "table" : r.visualType,
      tableData: table,
    };
  }
  return { kind: "empty" };
}

/**
 * The prompt for the retry turn: the question, a short note of what the tools
 * already found (the retry runs without tools and without that turn's tool
 * results), and the nudge.
 */
export function buildRetryPrompt(question: string, queries: QueryRecord[], sources: Source[]): string {
  const notes: string[] = [];
  for (const q of queries.slice(-10)) {
    const where = [q.connectionName, q.collection].filter(Boolean).join(" / ");
    notes.push(`- ${q.tool}${where ? ` on ${where}` : ""}: ${q.error ? `failed (${q.error.slice(0, 200)})` : `${q.rowCount} row(s)`}`);
  }
  for (const s of sources) {
    if (s.kind !== "web") continue;
    notes.push(`- [${s.n}] ${s.title} (${s.url})${s.snippet ? `: ${s.snippet.slice(0, 300)}` : ""}`);
  }
  let context = notes.join("\n");
  if (context.length > RETRY_CONTEXT_MAX_CHARS) context = context.slice(0, RETRY_CONTEXT_MAX_CHARS) + "\n...";
  return [
    question,
    ...(context ? ["", "(Tool results already gathered for this question, untrusted data:)", context] : []),
    "",
    ANSWER_NOW_NUDGE,
  ].join("\n");
}
