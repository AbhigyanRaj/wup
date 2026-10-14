import { z } from "zod";
import { ErrorCodeSchema, ISODateSchema, IdSchema } from "./common";
import { ChatModeSchema, FeedbackRatingSchema } from "./chat";
import { LlmProviderSchema } from "./user";

export const MessageStatusSchema = z.enum(["complete", "stopped", "error"]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const VISUAL_TYPES = ["none", "chart", "table", "diagram", "mermaid"] as const;
export const VisualTypeSchema = z.enum(VISUAL_TYPES);
export type VisualType = z.infer<typeof VisualTypeSchema>;

// ─── Visual payloads ──────────────────────────────────────────────────────────

export const ChartTypeSchema = z.enum(["bar", "line", "pie"]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const ChartDataSchema = z.object({
  type: ChartTypeSchema,
  xAxisKey: z.string(),
  yAxisKey: z.string(),
  title: z.string().optional(),
  series: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
});
export type ChartData = z.infer<typeof ChartDataSchema>;

export const TableCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type TableCell = z.infer<typeof TableCellSchema>;

export const TableDataSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), TableCellSchema)),
});
export type TableData = z.infer<typeof TableDataSchema>;

export const DIAGRAM_NODE_TYPES = ["start", "action", "decision", "success", "error"] as const;
export const DiagramNodeTypeSchema = z.enum(DIAGRAM_NODE_TYPES);
export type DiagramNodeType = z.infer<typeof DiagramNodeTypeSchema>;

export const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  sublabel: z.string().optional(),
  type: DiagramNodeTypeSchema.optional(),
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramDataSchema = z.object({
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
});
export type DiagramData = z.infer<typeof DiagramDataSchema>;

// ─── Small types ──────────────────────────────────────────────────────────────

export const FollowUpSchema = z.object({
  label: z.string(),
  suggestedPrompt: z.string(),
});
export type FollowUp = z.infer<typeof FollowUpSchema>;

export const ClarificationSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  allowFreeText: z.boolean(),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

/** One database or sheet query run while answering (shown as "Query used"). */
export const QueryRecordSchema = z.object({
  tool: z.string(),
  connectionName: z.string(),
  db: z.string(),
  collection: z.string(),
  /** Pretty-printed Extended JSON (or the sheet range). */
  query: z.string(),
  rowCount: z.number(),
  truncated: z.boolean(),
  durationMs: z.number(),
  error: z.string().optional(),
});
export type QueryRecord = z.infer<typeof QueryRecordSchema>;

// ─── Sources (citations) ──────────────────────────────────────────────────────

const SourceBase = {
  /** 1-based citation number, matches [n] markers in the content. */
  n: z.number().int(),
  title: z.string(),
  /** true when the answer text actually cites [n]. */
  cited: z.boolean(),
};

export const DocSourceSchema = z.object({
  ...SourceBase,
  kind: z.literal("doc"),
  sourceId: IdSchema,
  page: z.number().nullable(),
  chunkIndex: z.number(),
  /** A short excerpt only; the full chunk is never sent. */
  snippet: z.string(),
  score: z.number(),
});
export type DocSource = z.infer<typeof DocSourceSchema>;

export const WebSourceSchema = z.object({
  ...SourceBase,
  kind: z.literal("web"),
  url: z.string(),
  snippet: z.string().nullable(),
});
export type WebSource = z.infer<typeof WebSourceSchema>;

export const DataSourceSchema = z.object({
  ...SourceBase,
  kind: z.literal("data"),
  connectionName: z.string(),
  db: z.string(),
  collection: z.string(),
  /** Index into MessageDTO.queries. */
  queryIndex: z.number().int(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

export const SourceSchema = z.discriminatedUnion("kind", [DocSourceSchema, WebSourceSchema, DataSourceSchema]);
export type Source = z.infer<typeof SourceSchema>;
export type SourceKind = Source["kind"];

// ─── Research ─────────────────────────────────────────────────────────────────

export const ResearchStepStatusSchema = z.enum(["pending", "running", "done", "error", "skipped"]);
export type ResearchStepStatus = z.infer<typeof ResearchStepStatusSchema>;

export const ResearchStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ResearchStepStatusSchema,
  detail: z.string().nullable(),
  /** Source numbers (Source.n) gathered by this step. */
  sourceNs: z.array(z.number().int()),
  startedAt: ISODateSchema.nullable(),
  finishedAt: ISODateSchema.nullable(),
});
export type ResearchStep = z.infer<typeof ResearchStepSchema>;

// ─── Message ──────────────────────────────────────────────────────────────────

/** @deprecated legacy citation shape, replaced by Source (kind "doc"). */
export const LegacyRagSourceSchema = z.object({
  sourceFile: z.string(),
  pageNumber: z.number(),
  score: z.number(),
  text: z.string().optional(),
});
export type LegacyRagSource = z.infer<typeof LegacyRagSourceSchema>;

/** @deprecated legacy citation shape, replaced by Source (kind "web"). */
export const LegacyWebSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});
export type LegacyWebSource = z.infer<typeof LegacyWebSourceSchema>;

export const MessageModelSchema = z.object({
  provider: LlmProviderSchema,
  id: z.string(),
  usingOwnKey: z.boolean(),
});
export type MessageModel = z.infer<typeof MessageModelSchema>;

export const MessageMetricsSchema = z.object({
  latencyMs: z.number(),
  firstTokenMs: z.number().nullable(),
  tokensIn: z.number().nullable(),
  tokensOut: z.number().nullable(),
  toolCalls: z.number(),
});
export type MessageMetrics = z.infer<typeof MessageMetricsSchema>;

export const MessageFeedbackSchema = z.object({
  rating: FeedbackRatingSchema,
  note: z.string().nullable(),
  at: ISODateSchema,
});
export type MessageFeedback = z.infer<typeof MessageFeedbackSchema>;

export const MessageErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
});
export type MessageError = z.infer<typeof MessageErrorSchema>;

export const MessageDTOSchema = z.object({
  id: IdSchema,
  /** @deprecated alias of id, kept for older clients */
  _id: IdSchema,
  chatId: IdSchema,
  /** For assistant messages: the user message it answers. */
  parentId: IdSchema.nullable(),
  role: MessageRoleSchema,
  content: z.string(),
  status: MessageStatusSchema,
  mode: ChatModeSchema,
  createdAt: ISODateSchema,
  visualType: VisualTypeSchema,
  chartData: ChartDataSchema.nullable(),
  tableData: TableDataSchema.nullable(),
  diagramData: DiagramDataSchema.nullable(),
  followUps: z.array(FollowUpSchema),
  clarification: ClarificationSchema.nullable(),
  sources: z.array(SourceSchema),
  queries: z.array(QueryRecordSchema),
  research: z
    .object({
      steps: z.array(ResearchStepSchema),
      durationMs: z.number(),
    })
    .nullable(),
  model: MessageModelSchema.nullable(),
  metrics: MessageMetricsSchema.nullable(),
  feedback: MessageFeedbackSchema.nullable(),
  error: MessageErrorSchema.nullable(),
  /** @deprecated use sources (kind "doc") */
  ragSources: z.array(LegacyRagSourceSchema).optional(),
  /** @deprecated use sources (kind "web") */
  webSources: z.array(LegacyWebSourceSchema).optional(),
});
export type MessageDTO = z.infer<typeof MessageDTOSchema>;
