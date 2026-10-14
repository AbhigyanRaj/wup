import { z } from "zod";
import { ErrorCodeSchema, IdSchema, LIMITS } from "./common";
import { ChatModeSchema } from "./chat";
import {
  ChartTypeSchema,
  ClarificationSchema,
  DiagramNodeTypeSchema,
  FollowUpSchema,
  MessageDTOSchema,
  ResearchStepSchema,
  SourceSchema,
  VisualTypeSchema,
  type ChartData,
  type Clarification,
  type DiagramData,
  type DiagramEdge,
  type DiagramNode,
  type FollowUp,
  type TableCell,
  type TableData,
  type VisualType,
} from "./message";
import { PlanTierSchema } from "./user";

// ─── Status codes ─────────────────────────────────────────────────────────────

export const STATUS_CODES = [
  "context.rag",
  "context.bridges",
  "llm.routing",
  "llm.generating",
  "tool.db",
  "tool.sheets",
  "tool.web",
  "research.plan",
  "research.report",
] as const;
export const StatusCodeSchema = z.enum(STATUS_CODES);
export type StatusCode = z.infer<typeof StatusCodeSchema>;

// ─── Done payload ─────────────────────────────────────────────────────────────

export const DonePayloadSchema = z.object({
  userMessage: MessageDTOSchema,
  assistantMessage: MessageDTOSchema,
  followUps: z.array(FollowUpSchema),
  clarification: ClarificationSchema.nullable(),
  usedModel: z.string().nullable(),
  /** Model ids that hit a quota or rate limit during this turn. */
  exhausted: z.array(z.string()),
  usage: z.object({
    tier: PlanTierSchema,
    freeTierUsage: z.number(),
    freeTierLimit: z.number(),
  }),
});
export type DonePayload = z.infer<typeof DonePayloadSchema>;

// ─── Stream events (SSE `data:` lines) ────────────────────────────────────────

export const StartEventSchema = z.object({
  type: z.literal("start"),
  chatId: IdSchema,
  userMessageId: IdSchema,
  assistantMessageId: IdSchema,
  mode: ChatModeSchema,
  requestId: z.string(),
});

export const StatusEventSchema = z.object({
  type: z.literal("status"),
  message: z.string(),
  code: StatusCodeSchema.optional(),
});

export const TokenEventSchema = z.object({
  type: z.literal("token"),
  text: z.string(),
});

export const ToolStateSchema = z.enum(["running", "done", "error"]);
export type ToolState = z.infer<typeof ToolStateSchema>;

export const ToolEventSchema = z.object({
  type: z.literal("tool"),
  id: z.string(),
  name: z.string(),
  label: z.string(),
  state: ToolStateSchema,
  query: z.string().optional(),
});

export const SourcesEventSchema = z.object({
  type: z.literal("sources"),
  sources: z.array(SourceSchema),
});

export const StepEventSchema = z.object({
  type: z.literal("step"),
  step: ResearchStepSchema,
});

export const TitleEventSchema = z.object({
  type: z.literal("title"),
  chatId: IdSchema,
  title: z.string(),
});

export const DoneEventSchema = z.object({
  type: z.literal("done"),
  message: DonePayloadSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  code: ErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  /** The partially saved assistant message (status "error" or "stopped"), when one exists. */
  assistantMessage: MessageDTOSchema.optional(),
});

export const StreamEventSchema = z.discriminatedUnion("type", [
  StartEventSchema,
  StatusEventSchema,
  TokenEventSchema,
  ToolEventSchema,
  SourcesEventSchema,
  StepEventSchema,
  TitleEventSchema,
  DoneEventSchema,
  ErrorEventSchema,
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type StreamEventType = StreamEvent["type"];
export type StreamEventOf<T extends StreamEventType> = Extract<StreamEvent, { type: T }>;

/** Serialises one event as an SSE frame. */
export function encodeStreamEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Parses the payload of one SSE `data:` line. Returns null for anything that is
 * not a known event, so clients can ignore unknown future events.
 */
export function parseStreamEvent(data: string): StreamEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  const parsed = StreamEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ─── LLM meta block sanitiser ─────────────────────────────────────────────────

/** Bounds applied to whatever the model writes in its ---WUP_META--- block. */
export const META_LIMITS = {
  maxFollowUps: LIMITS.maxFollowUps,
  minOptions: 2,
  maxOptions: 5,
  maxOptionChars: 80,
  maxQuestionChars: 500,
  maxLabelChars: 80,
  maxPromptChars: 500,
  maxDiagramNodes: 30,
  maxDiagramEdges: 60,
  maxTableRows: 100,
  maxTableCols: 12,
  maxChartPoints: 500,
  maxCellChars: 500,
} as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** A trimmed non-empty string (numbers are stringified), clipped to max chars; otherwise undefined. */
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return clip(String(v), max);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? clip(t, max) : undefined;
};

const toArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function toCell(v: unknown): TableCell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return clip(v, META_LIMITS.maxCellChars);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  try {
    return clip(JSON.stringify(v) ?? "", META_LIMITS.maxCellChars);
  } catch {
    return null;
  }
}

function sanitizeFollowUps(v: unknown): FollowUp[] {
  const out: FollowUp[] = [];
  for (const item of toArray(v)) {
    if (!isRecord(item)) continue;
    const label = text(item.label, META_LIMITS.maxLabelChars);
    const suggestedPrompt = text(item.suggestedPrompt ?? item.prompt, META_LIMITS.maxPromptChars) ?? label;
    if (!label || !suggestedPrompt) continue;
    out.push({ label, suggestedPrompt });
    if (out.length >= META_LIMITS.maxFollowUps) break;
  }
  return out;
}

function sanitizeClarification(v: unknown): Clarification | null {
  if (!isRecord(v)) return null;
  const options: string[] = [];
  for (const o of toArray(v.options)) {
    const t = text(o, META_LIMITS.maxOptionChars);
    if (t && !options.includes(t)) options.push(t);
    if (options.length >= META_LIMITS.maxOptions) break;
  }
  if (options.length < META_LIMITS.minOptions) return null;
  return {
    // Empty when the model omitted it: callers fall back to the visible content.
    question: text(v.question, META_LIMITS.maxQuestionChars) ?? "",
    options,
    allowFreeText: typeof v.allowFreeText === "boolean" ? v.allowFreeText : true,
  };
}

function sanitizeChart(v: unknown): ChartData | null {
  if (!isRecord(v)) return null;
  const xAxisKey = text(v.xAxisKey, 200);
  const yAxisKey = text(v.yAxisKey, 200);
  if (!xAxisKey || !yAxisKey) return null;
  const type = ChartTypeSchema.catch("bar").parse(v.type);
  const series: ChartData["series"] = [];
  for (const point of toArray(v.series)) {
    if (!isRecord(point)) continue;
    const clean: Record<string, string | number> = {};
    for (const [k, val] of Object.entries(point)) {
      if (typeof val === "number" && Number.isFinite(val)) clean[k] = val;
      else if (typeof val === "string") clean[k] = clip(val, META_LIMITS.maxCellChars);
    }
    series.push(clean);
    if (series.length >= META_LIMITS.maxChartPoints) break;
  }
  const title = text(v.title, 200);
  return { type, xAxisKey, yAxisKey, ...(title ? { title } : {}), series };
}

function sanitizeTable(v: unknown): TableData | null {
  if (!isRecord(v)) return null;
  const rawRows = toArray(v.rows).filter(isRecord).slice(0, META_LIMITS.maxTableRows);
  let columns: string[] = [];
  for (const c of toArray(v.columns)) {
    const t = text(c, 200);
    if (t && !columns.includes(t)) columns.push(t);
  }
  if (columns.length === 0 && rawRows.length > 0) columns = Object.keys(rawRows[0]);
  columns = columns.slice(0, META_LIMITS.maxTableCols);
  if (columns.length === 0) return null;
  const rows = rawRows.map((r) => {
    const row: Record<string, TableCell> = {};
    for (const c of columns) row[c] = toCell(r[c]);
    return row;
  });
  return { columns, rows };
}

function sanitizeDiagram(v: unknown): DiagramData | null {
  if (!isRecord(v)) return null;
  const nodes: DiagramNode[] = [];
  const ids = new Set<string>();
  for (const n of toArray(v.nodes)) {
    if (!isRecord(n)) continue;
    const id = text(n.id, 100);
    if (!id || ids.has(id)) continue;
    const label = text(n.label, 200) ?? id;
    const sublabel = text(n.sublabel, 300);
    const type = DiagramNodeTypeSchema.optional().catch(undefined).parse(n.type);
    nodes.push({ id, label, ...(sublabel ? { sublabel } : {}), ...(type ? { type } : {}) });
    ids.add(id);
    if (nodes.length >= META_LIMITS.maxDiagramNodes) break;
  }
  if (nodes.length === 0) return null;
  const edges: DiagramEdge[] = [];
  for (const e of toArray(v.edges)) {
    if (!isRecord(e)) continue;
    const from = text(e.from, 100);
    const to = text(e.to, 100);
    // Drop edges that point at missing (or truncated) nodes.
    if (!from || !to || !ids.has(from) || !ids.has(to)) continue;
    const label = text(e.label, 100);
    edges.push({ from, to, ...(label ? { label } : {}) });
    if (edges.length >= META_LIMITS.maxDiagramEdges) break;
  }
  return { nodes, edges };
}

export interface MetaBlock {
  type: "answer" | "clarification";
  visualType: VisualType;
  followUps: FollowUp[];
  clarification: Clarification | null;
  chartData: ChartData | null;
  tableData: TableData | null;
  diagramData: DiagramData | null;
}

export const EMPTY_META_BLOCK: MetaBlock = {
  type: "answer",
  visualType: "none",
  followUps: [],
  clarification: null,
  chartData: null,
  tableData: null,
  diagramData: null,
};

function sanitizeMeta(input: unknown): MetaBlock {
  if (!isRecord(input)) return { ...EMPTY_META_BLOCK };

  // Clarifications arrive either flat ({type:"clarification", question, options})
  // or nested ({clarification:{question, options}}).
  const clarification =
    input.type === "clarification" ? sanitizeClarification(input) : sanitizeClarification(input.clarification);

  if (clarification) {
    return { ...EMPTY_META_BLOCK, type: "clarification", clarification };
  }

  return {
    type: "answer",
    visualType: VisualTypeSchema.catch("none").parse(input.visualType),
    followUps: sanitizeFollowUps(input.followUps),
    clarification: null,
    chartData: sanitizeChart(input.chartData),
    tableData: sanitizeTable(input.tableData),
    diagramData: sanitizeDiagram(input.diagramData),
  };
}

/**
 * Sanitises the JSON the model writes between ---WUP_META--- markers.
 * It never throws: any malformed part falls back to a safe default.
 *
 *   - unknown visualType becomes "none"
 *   - unknown chart.type becomes "bar"; charts without axis keys are dropped
 *   - at most 3 followUps
 *   - clarification needs 2..5 distinct options of at most 80 chars, else it is dropped
 *   - diagrams keep at most 30 nodes and 60 edges (dangling edges are dropped)
 *   - tables keep at most 100 rows and 12 columns
 */
export const MetaBlockSchema = z
  .unknown()
  .transform((input): MetaBlock => {
    try {
      return sanitizeMeta(input);
    } catch {
      return { ...EMPTY_META_BLOCK };
    }
  })
  .catch((): MetaBlock => ({ ...EMPTY_META_BLOCK }));

/** Parses raw meta JSON text (or an already parsed value). Never throws. */
export function parseMetaBlock(raw: unknown): MetaBlock {
  if (typeof raw === "string") {
    try {
      return MetaBlockSchema.parse(JSON.parse(raw));
    } catch {
      return { ...EMPTY_META_BLOCK };
    }
  }
  return MetaBlockSchema.parse(raw);
}
