import mongoose from "mongoose";
import { MetaBlockSchema, META_LIMITS, ResearchStepStatusSchema } from "@wup/contracts";
import { Message } from "@wup/models";
import { legacyFromSources } from "../../dto/message";
import type { BrainResult } from "./deps";

/**
 * Turns a brain result into a Message document that is safe to store:
 *   - visualType / chart type are whitelisted (MetaBlockSchema)
 *   - sources keep a short snippet only (<= 300 chars), never full chunks
 *   - legacy ragSources / webSources are derived from sources for the old client
 * If the insert still fails validation, it is retried without the visual
 * fields (and then without anything optional) so an answer is never lost.
 */

export const SNIPPET_MAX = 300;
const MAX_SOURCES = 50;
const MAX_QUERIES = 50;
const MAX_STEPS = 50;

const isRecord = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const clip = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const finite = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function sanitizeSources(list: unknown): Record<string, unknown>[] {
  if (!Array.isArray(list)) return [];
  const out: Record<string, unknown>[] = [];
  for (const s of list) {
    if (!isRecord(s) || !["doc", "web", "data"].includes(s.kind)) continue;
    const base: Record<string, unknown> = {
      n: Number.isInteger(s.n) ? s.n : out.length + 1,
      kind: s.kind,
      title: clip(s.title, 300) ?? "",
      cited: s.cited === true,
    };
    if (s.kind === "doc") {
      if (s.sourceId != null && mongoose.isValidObjectId(s.sourceId)) base.sourceId = String(s.sourceId);
      base.page = finite(s.page);
      base.chunkIndex = finite(s.chunkIndex);
      base.score = finite(s.score);
      base.snippet = clip(s.snippet, SNIPPET_MAX) ?? "";
    } else if (s.kind === "web") {
      base.url = clip(s.url, 2000) ?? "";
      base.snippet = clip(s.snippet, SNIPPET_MAX);
    } else {
      base.connectionName = clip(s.connectionName, 200) ?? "";
      base.db = clip(s.db, 200) ?? "";
      base.collection = clip(s.collection, 200) ?? "";
      base.queryIndex = finite(s.queryIndex) ?? 0;
    }
    for (const k of Object.keys(base)) if (base[k] === undefined) delete base[k];
    out.push(base);
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

function sanitizeQueries(list: unknown): Record<string, unknown>[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isRecord)
    .slice(0, MAX_QUERIES)
    .map((q) => {
      const out: Record<string, unknown> = {
        tool: clip(q.tool, 100),
        connectionName: clip(q.connectionName, 200),
        db: clip(q.db, 200),
        collection: clip(q.collection, 200),
        query: clip(q.query, 20_000),
        rowCount: finite(q.rowCount),
        truncated: typeof q.truncated === "boolean" ? q.truncated : undefined,
        durationMs: finite(q.durationMs),
        error: clip(q.error, 1000),
      };
      for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
      return out;
    });
}

export function sanitizeSteps(list: unknown): Record<string, unknown>[] {
  if (!Array.isArray(list)) return [];
  const date = (v: unknown) => {
    if (v == null) return undefined;
    const d = new Date(v as any);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  return list
    .filter(isRecord)
    .slice(0, MAX_STEPS)
    .map((s) => ({
      id: clip(s.id, 100) ?? "",
      title: clip(s.title, 300) ?? "",
      status: ResearchStepStatusSchema.catch("done").parse(s.status),
      detail: clip(s.detail, 2000),
      sourceNs: Array.isArray(s.sourceNs) ? s.sourceNs.filter((n: unknown) => Number.isInteger(n)).slice(0, 100) : [],
      startedAt: date(s.startedAt),
      finishedAt: date(s.finishedAt),
    }));
}

/** Same texts as @wup/brain's FOUND_ROWS_TEXT / NO_ANSWER_TEXT / CLARIFY_FALLBACK. */
export const FOUND_ROWS_TEXT = "Here is what I found.";
export const EMPTY_ANSWER_TEXT = "I couldn't produce an answer this time. Try rephrasing the question.";
const CLARIFY_FALLBACK = "Could you clarify what you need?";

/**
 * A complete answer is never stored (or sent in `done`) with empty content.
 * The brain already guarantees this; this is the API's safety net for any
 * brain result that slips through. `refund` is true when nothing useful was
 * produced, so the caller settles the quota as "no output".
 */
export function ensureAnswerContent(
  status: "complete" | "stopped" | "error",
  content: string,
  result: BrainResult | null
): { content: string; refund: boolean } {
  const text = (content ?? "").trim();
  if (status !== "complete" || text) return { content: text, refund: false };
  const c = result?.clarification;
  if (isRecord(c)) {
    const q = typeof c.question === "string" ? c.question.trim() : "";
    return { content: q || CLARIFY_FALLBACK, refund: false };
  }
  const t = result?.tableData as { rows?: unknown[] } | null | undefined;
  if (isRecord(t) && Array.isArray(t.rows) && t.rows.length > 0) return { content: FOUND_ROWS_TEXT, refund: false };
  return { content: EMPTY_ANSWER_TEXT, refund: true };
}

export interface PersistInput {
  _id: mongoose.Types.ObjectId;
  chatId: string;
  userId: string;
  parentId: mongoose.Types.ObjectId | string;
  mode: "chat" | "research";
  status: "complete" | "stopped" | "error";
  content: string;
  result: BrainResult | null;
  /** Fallbacks used when the brain did not return (stopped / threw). */
  liveSources?: unknown[];
  liveSteps?: unknown[];
  error?: { code: string; message: string } | null;
  metrics: { latencyMs: number; firstTokenMs: number | null; tokensIn: number | null; tokensOut: number | null; toolCalls: number };
}

export function sanitizeForPersist(input: PersistInput): { base: Record<string, unknown>; visuals: Record<string, unknown> } {
  const r = input.result;
  const sources = sanitizeSources(r?.sources?.length ? r.sources : input.liveSources);
  const { ragSources, webSources } = legacyFromSources(sources as any);

  // Followups, visuals and the chart type are whitelisted by the shared meta sanitiser.
  const meta = MetaBlockSchema.parse({
    visualType: r?.visualType,
    chartData: r?.chartData,
    tableData: r?.tableData,
    diagramData: r?.diagramData,
    followUps: r?.followUps,
  });
  let clarification = isRecord(r?.clarification)
    ? MetaBlockSchema.parse({ type: "clarification", ...r.clarification }).clarification
    : null;
  // A free-text question (fewer than 2 options) is still worth keeping.
  if (!clarification && isRecord(r?.clarification) && typeof r.clarification.question === "string" && r.clarification.question.trim()) {
    clarification = { question: r.clarification.question.trim().slice(0, META_LIMITS.maxQuestionChars), options: [], allowFreeText: true };
  }

  const steps = sanitizeSteps(r?.research?.steps?.length ? r.research.steps : input.liveSteps);
  const research =
    input.mode === "research" || steps.length > 0
      ? { steps, durationMs: finite(r?.research?.durationMs) ?? input.metrics.latencyMs }
      : null;

  const model =
    r?.model && typeof r.model.id === "string" && r.model.id
      ? { provider: clip(r.model.provider, 50) ?? "gemini", id: r.model.id.slice(0, 200), usingOwnKey: r.model.usingOwnKey === true }
      : null;

  const base: Record<string, unknown> = {
    _id: input._id,
    chatId: input.chatId,
    userId: input.userId,
    role: "assistant",
    parentId: input.parentId,
    content: input.content,
    status: input.status,
    mode: input.mode,
    sources,
    ragSources,
    webSources,
    queries: sanitizeQueries(r?.queries),
    followUps: input.status === "complete" ? meta.followUps.slice(0, META_LIMITS.maxFollowUps) : [],
    clarification: input.status === "complete" ? clarification : null,
    research,
    model,
    metrics: input.metrics,
    error: input.error ?? null,
  };

  const visuals: Record<string, unknown> =
    input.status === "complete"
      ? {
          visualType: meta.visualType,
          chartData: meta.chartData,
          tableData: meta.tableData,
          diagramData: meta.diagramData,
        }
      : {};

  return { base, visuals };
}

/** Inserts the assistant message, degrading gracefully. Returns the stored document. */
export async function persistAssistant(input: PersistInput): Promise<any> {
  const { base, visuals } = sanitizeForPersist(input);
  const minimal = {
    _id: base._id,
    chatId: base.chatId,
    userId: base.userId,
    role: "assistant",
    parentId: base.parentId,
    content: base.content,
    status: base.status,
    mode: base.mode,
    model: base.model,
    metrics: base.metrics,
    error: base.error,
  };
  const attempts = [{ ...base, ...visuals }, base, minimal];
  let lastErr: unknown;
  for (const doc of attempts) {
    try {
      return await Message.create(doc);
    } catch (err: any) {
      lastErr = err;
      if (err?.code === 11000) {
        const existing = await Message.findById(base._id);
        if (existing) return existing;
      }
      console.error("[wuup api] saving the assistant message failed, retrying with fewer fields:", err?.message ?? err);
    }
  }
  throw lastErr;
}
