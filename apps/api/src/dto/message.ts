import type {
  ChartData,
  Clarification,
  DiagramData,
  FollowUp,
  LegacyRagSource,
  LegacyWebSource,
  MessageDTO,
  QueryRecord,
  ResearchStep,
  Source,
  TableData,
  VisualType,
} from "@wup/contracts";
import { VISUAL_TYPES } from "@wup/contracts";

/**
 * Message document -> MessageDTO.
 *
 * Normalises legacy documents (no status/mode, citations only in
 * ragSources/webSources, empty nested visual paths) and always includes both
 * `id` and the deprecated `_id`, plus the legacy ragSources/webSources arrays
 * the pre-v2 web client reads.
 */

const VISUALS = new Set<string>(VISUAL_TYPES);

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : v == null ? fallback : String(v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const idOf = (v: unknown): string | null => (v == null ? null : String(v));

export function plain(doc: any): any {
  if (!doc) return doc;
  return typeof doc.toObject === "function" ? doc.toObject({ depopulate: true }) : doc;
}

function sourceToDTO(s: any, index: number): Source | null {
  if (!s || typeof s !== "object") return null;
  const n = num(s.n) ?? index + 1;
  const base = { n, title: str(s.title), cited: Boolean(s.cited) };
  switch (s.kind) {
    case "doc":
      return {
        ...base,
        kind: "doc",
        sourceId: str(idOf(s.sourceId)),
        page: num(s.page),
        chunkIndex: num(s.chunkIndex) ?? 0,
        snippet: str(s.snippet),
        score: num(s.score) ?? 0,
      };
    case "web":
      return { ...base, kind: "web", url: str(s.url), snippet: typeof s.snippet === "string" ? s.snippet : null };
    case "data":
      return {
        ...base,
        kind: "data",
        connectionName: str(s.connectionName),
        db: str(s.db),
        collection: str(s.collection),
        queryIndex: num(s.queryIndex) ?? 0,
      };
    default:
      return null;
  }
}

/** Builds `sources` from the legacy citation arrays (doc first, then web). */
export function sourcesFromLegacy(rag: any[], web: any[]): Source[] {
  const out: Source[] = [];
  for (const r of rag) {
    out.push({
      n: out.length + 1,
      kind: "doc",
      title: str(r?.sourceFile, "Document"),
      cited: false,
      sourceId: "",
      page: num(r?.pageNumber),
      chunkIndex: 0,
      snippet: str(r?.text).slice(0, 300),
      score: num(r?.score) ?? 0,
    });
  }
  for (const w of web) {
    out.push({ n: out.length + 1, kind: "web", title: str(w?.title ?? w?.url), cited: false, url: str(w?.url), snippet: null });
  }
  return out;
}

/** Legacy citation arrays derived from `sources`, for the old client. */
export function legacyFromSources(sources: Array<Partial<Source> & { kind: string }>): {
  ragSources: LegacyRagSource[];
  webSources: LegacyWebSource[];
} {
  const ragSources: LegacyRagSource[] = [];
  const webSources: LegacyWebSource[] = [];
  for (const s of sources as any[]) {
    if (s.kind === "doc") {
      ragSources.push({
        sourceFile: str(s.title, "Document") || "Document",
        pageNumber: num(s.page) ?? 0,
        score: num(s.score) ?? 0,
        ...(typeof s.snippet === "string" && s.snippet ? { text: s.snippet } : {}),
      });
    } else if (s.kind === "web") {
      webSources.push({ title: str(s.title) || str(s.url), url: str(s.url) });
    }
  }
  return { ragSources, webSources };
}

function chartToDTO(c: any): ChartData | null {
  if (!c || typeof c !== "object" || !c.type || !c.xAxisKey || !c.yAxisKey) return null;
  return {
    type: c.type,
    xAxisKey: str(c.xAxisKey),
    yAxisKey: str(c.yAxisKey),
    ...(c.title ? { title: str(c.title) } : {}),
    series: arr(c.series),
  };
}

function tableToDTO(t: any): TableData | null {
  if (!t || typeof t !== "object" || arr(t.columns).length === 0) return null;
  return { columns: arr(t.columns).map((c) => str(c)), rows: arr(t.rows) };
}

function diagramToDTO(d: any): DiagramData | null {
  if (!d || typeof d !== "object" || arr(d.nodes).length === 0) return null;
  const clean = (o: any) => {
    const out: any = {};
    for (const [k, v] of Object.entries(o ?? {})) if (v != null && k !== "_id") out[k] = v;
    return out;
  };
  return { nodes: arr(d.nodes).map(clean), edges: arr(d.edges).map(clean) };
}

function queryToDTO(q: any): QueryRecord {
  return {
    tool: str(q?.tool),
    connectionName: str(q?.connectionName),
    db: str(q?.db),
    collection: str(q?.collection),
    query: str(q?.query),
    rowCount: num(q?.rowCount) ?? 0,
    truncated: Boolean(q?.truncated),
    durationMs: num(q?.durationMs) ?? 0,
    ...(q?.error ? { error: str(q.error) } : {}),
  };
}

function stepToDTO(s: any): ResearchStep {
  return {
    id: str(s?.id),
    title: str(s?.title),
    status: s?.status ?? "pending",
    detail: typeof s?.detail === "string" ? s.detail : null,
    sourceNs: arr(s?.sourceNs).filter((n) => typeof n === "number"),
    startedAt: iso(s?.startedAt),
    finishedAt: iso(s?.finishedAt),
  };
}

function clarificationToDTO(c: any): Clarification | null {
  if (!c || typeof c !== "object") return null;
  const options = arr(c.options).map((o) => str(o)).filter(Boolean);
  if (!c.question && options.length === 0) return null;
  return { question: str(c.question), options, allowFreeText: c.allowFreeText !== false };
}

export function toMessageDTO(doc: any): MessageDTO {
  const d = plain(doc) ?? {};
  const id = String(d._id);
  const legacyRag = arr(d.ragSources);
  const legacyWeb = arr(d.webSources);

  const stored = arr(d.sources)
    .map(sourceToDTO)
    .filter((s): s is Source => s !== null);
  const sources = stored.length > 0 ? stored : sourcesFromLegacy(legacyRag, legacyWeb);

  const derived = legacyFromSources(sources);
  const ragSources: LegacyRagSource[] =
    legacyRag.length > 0
      ? legacyRag.map((r) => ({
          sourceFile: str(r?.sourceFile, "Document"),
          pageNumber: num(r?.pageNumber) ?? 0,
          score: num(r?.score) ?? 0,
          ...(typeof r?.text === "string" ? { text: r.text } : {}),
        }))
      : derived.ragSources;
  const webSources: LegacyWebSource[] =
    legacyWeb.length > 0 ? legacyWeb.map((w) => ({ title: str(w?.title), url: str(w?.url) })) : derived.webSources;

  const visualType: VisualType = VISUALS.has(d.visualType) ? d.visualType : "none";
  const followUps: FollowUp[] = arr(d.followUps)
    .filter((f) => f && (f.label || f.suggestedPrompt))
    .map((f) => ({ label: str(f.label ?? f.suggestedPrompt), suggestedPrompt: str(f.suggestedPrompt ?? f.label) }));

  const research = d.research
    ? { steps: arr(d.research.steps).map(stepToDTO), durationMs: num(d.research.durationMs) ?? 0 }
    : null;

  const model = d.model && d.model.id ? { provider: d.model.provider ?? "gemini", id: str(d.model.id), usingOwnKey: Boolean(d.model.usingOwnKey) } : null;

  const metrics = d.metrics
    ? {
        latencyMs: num(d.metrics.latencyMs) ?? 0,
        firstTokenMs: num(d.metrics.firstTokenMs),
        tokensIn: num(d.metrics.tokensIn),
        tokensOut: num(d.metrics.tokensOut),
        toolCalls: num(d.metrics.toolCalls) ?? 0,
      }
    : null;

  const feedback =
    d.feedback && d.feedback.rating
      ? { rating: d.feedback.rating, note: typeof d.feedback.note === "string" ? d.feedback.note : null, at: iso(d.feedback.at) ?? new Date(0).toISOString() }
      : null;

  const error = d.error && (d.error.code || d.error.message) ? { code: d.error.code ?? "INTERNAL", message: str(d.error.message) } : null;

  return {
    id,
    _id: id,
    chatId: str(idOf(d.chatId)),
    parentId: idOf(d.parentId),
    role: d.role === "user" ? "user" : "assistant",
    content: str(d.content),
    status: d.status === "stopped" || d.status === "error" ? d.status : "complete",
    mode: d.mode === "research" ? "research" : "chat",
    createdAt: iso(d.createdAt) ?? new Date(0).toISOString(),
    visualType,
    chartData: chartToDTO(d.chartData),
    tableData: tableToDTO(d.tableData),
    diagramData: diagramToDTO(d.diagramData),
    followUps,
    clarification: clarificationToDTO(d.clarification),
    sources,
    queries: arr(d.queries).map(queryToDTO),
    research,
    model,
    metrics,
    feedback,
    error,
    ragSources,
    webSources,
  } as MessageDTO;
}
