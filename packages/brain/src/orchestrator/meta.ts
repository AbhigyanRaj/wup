import {
  parseMetaBlock,
  type ChartData,
  type Clarification,
  type DiagramData,
  type FollowUp,
  type MetaBlock,
  type TableData,
  type VisualType,
} from "@wup/contracts";

/**
 * The meta protocol: the model writes its markdown answer, then a JSON block
 * between META_START and META_END with follow-ups, a clarification or a visual.
 * MetaStreamFilter hides that block from the token stream; parseStructuredResponse
 * splits it out and sanitises it with the contracts MetaBlockSchema.
 */

export const META_START = "---WUP_META---";
export const META_END = "---END_WUP_META---";

export interface StructuredResponse {
  content: string;
  followUps: FollowUp[];
  clarification?: Clarification;
  visualType: VisualType;
  chartData?: ChartData;
  tableData?: TableData;
  diagramData?: DiagramData;
}

const stripMarkers = (s: string) => s.split(META_START).join("").split(META_END).join("");

/** Removes a ```json fence the model sometimes wraps around the meta JSON. */
const unfence = (s: string) =>
  s
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

/**
 * Finds a JSON object inside text: first `{` to last `}`, shrinking the end to
 * earlier `}` on parse failure. Returns undefined when nothing parses.
 */
export function extractJsonObject(text: string, maxAttempts = 50): unknown {
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  let end = text.lastIndexOf("}");
  for (let i = 0; i < maxAttempts && end > start; i++) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      end = text.lastIndexOf("}", end - 1);
    }
  }
  return undefined;
}

function fromMeta(content: string, meta: MetaBlock): StructuredResponse {
  if (meta.type === "clarification" && meta.clarification) {
    const clarification = { ...meta.clarification, question: meta.clarification.question || content };
    return { content, followUps: [], visualType: "none", clarification };
  }
  return {
    content,
    followUps: meta.followUps,
    visualType: meta.visualType,
    ...(meta.chartData ? { chartData: meta.chartData } : {}),
    ...(meta.tableData ? { tableData: meta.tableData } : {}),
    ...(meta.diagramData ? { diagramData: meta.diagramData } : {}),
  };
}

/**
 * Splits the model's raw response into visible content and a sanitised meta block.
 *
 * Lenient: when META_START is present but META_END is missing (the stream was
 * cut off or the model forgot it), the content is everything before META_START
 * and the meta JSON is recovered from the first `{` to the last parseable `}`.
 * The meta JSON never leaks into content, and stray markers are stripped.
 */
export function parseStructuredResponse(raw: string): StructuredResponse {
  const text = raw ?? "";
  const metaStart = text.indexOf(META_START);
  if (metaStart === -1) {
    return { content: stripMarkers(text).trim(), followUps: [], visualType: "none" };
  }

  const content = stripMarkers(text.slice(0, metaStart)).trim();
  const afterStart = text.slice(metaStart + META_START.length);
  const endIdx = afterStart.indexOf(META_END);
  const metaText = unfence(stripMarkers(endIdx === -1 ? afterStart : afterStart.slice(0, endIdx)));

  let parsed: unknown;
  try {
    parsed = JSON.parse(metaText);
  } catch {
    parsed = extractJsonObject(metaText);
  }
  if (parsed === undefined) return { content, followUps: [], visualType: "none" };
  return fromMeta(content, parseMetaBlock(parsed));
}

const HOLD_BACK = Math.max(META_START.length, META_END.length) - 1;

/**
 * Hides the meta block from the token stream. Holds back the last few
 * characters so a marker split across chunks is caught, and drops stray
 * META_END markers that appear outside a block.
 */
export class MetaStreamFilter {
  private buffer = "";
  private metaStarted = false;
  private visible = "";
  private meta = "";

  push(text: string): string {
    if (!text) return "";
    if (this.metaStarted) {
      this.meta += text;
      return "";
    }
    this.buffer = (this.buffer + text).split(META_END).join("");
    const idx = this.buffer.indexOf(META_START);
    if (idx !== -1) {
      this.metaStarted = true;
      const out = this.buffer.slice(0, idx);
      this.meta = this.buffer.slice(idx + META_START.length);
      this.buffer = "";
      this.visible += out;
      return out;
    }
    const safeLength = this.buffer.length - HOLD_BACK;
    if (safeLength <= 0) return "";
    const out = this.buffer.slice(0, safeLength);
    this.buffer = this.buffer.slice(safeLength);
    this.visible += out;
    return out;
  }

  /** Flushes held-back text when the stream ends without a meta block. */
  flush(): string {
    if (this.metaStarted) return "";
    const out = this.buffer;
    this.buffer = "";
    this.visible += out;
    return out;
  }

  /** True once the meta block has started (later text is hidden). */
  get inMeta(): boolean {
    return this.metaStarted;
  }

  /** Text shown to the user so far. */
  visibleText(): string {
    return this.visible;
  }

  /** The full response (visible text + meta block) for parseStructuredResponse. */
  fullText(): string {
    return this.metaStarted ? this.visible + META_START + this.meta : this.visible + this.buffer;
  }
}
