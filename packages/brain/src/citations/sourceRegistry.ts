import type { DataSource, DocSource, Source, WebSource } from "@wup/contracts";

/**
 * Hands out citation numbers for one answer.
 *
 * Order: RAG chunks are registered first ([1..k]), then web results and data
 * queries in the order the tools ran. A repeated source (same chunk, same URL,
 * same collection) keeps its first number. Every change emits a full snapshot
 * through onChange, so the UI can render citation pills while streaming.
 */

export const MAX_SNIPPET_CHARS = 300;

type Without<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
/** A source as tools register it: no number, no cited flag. */
export type SourceInput = Without<Source, "n" | "cited">;

const clip = (s: string | null | undefined, max = MAX_SNIPPET_CHARS): string => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 3).trimEnd()}...` : t;
};

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : v == null ? fallback : String(v));

/** Normalises whatever a tool passes into a well-formed SourceInput, or null. */
function normalise(input: any): SourceInput | null {
  if (!input || typeof input !== "object") return null;
  switch (input.kind) {
    case "doc":
      return {
        kind: "doc",
        title: clip(str(input.title, "Document"), 200) || "Document",
        sourceId: str(input.sourceId),
        page: typeof input.page === "number" && input.page > 0 ? input.page : null,
        chunkIndex: Number(input.chunkIndex) || 0,
        snippet: clip(str(input.snippet)),
        score: Number(input.score) || 0,
      };
    case "web": {
      const url = str(input.url);
      if (!/^https?:\/\//i.test(url)) return null;
      return { kind: "web", title: clip(str(input.title, url), 200) || url, url, snippet: input.snippet ? clip(str(input.snippet)) : null };
    }
    case "data":
      return {
        kind: "data",
        title: clip(str(input.title, `${str(input.db)}.${str(input.collection)}`), 200),
        connectionName: str(input.connectionName),
        db: str(input.db),
        collection: str(input.collection),
        queryIndex: Number.isInteger(input.queryIndex) ? input.queryIndex : 0,
      };
    default:
      return null;
  }
}

function dedupeKey(s: SourceInput): string {
  switch (s.kind) {
    case "doc":
      return `doc|${s.sourceId}|${s.chunkIndex}|${s.title}|${s.page ?? ""}`;
    case "web":
      return `web|${s.url.replace(/\/$/, "")}`;
    case "data":
      return `data|${s.connectionName}|${s.db}|${s.collection}`;
  }
}

/** [n] markers, including grouped forms like [1, 3] or [2][4]. */
const CITATION_GROUP = /\[(\s*\d+\s*(?:,\s*\d+\s*)*)\](?!\()/g;
const CITATION_WITH_SPACE = /([ \t]?)\[(\s*\d+\s*(?:,\s*\d+\s*)*)\](?!\()/g;
/** Fenced blocks and inline code (captured, so split keeps them at odd indexes). */
const CODE_SPANS = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

export class SourceRegistry {
  private readonly list: Source[] = [];
  private readonly byKey = new Map<string, number>();

  constructor(private onChange?: (sources: Source[]) => void) {}

  /** Registers a source and returns its 1-based citation number (existing number for a repeat). */
  register = (input: unknown): number => {
    const s = normalise(input);
    if (!s) return 0;
    const key = dedupeKey(s);
    const existing = this.byKey.get(key);
    if (existing !== undefined) return existing;
    const n = this.list.length + 1;
    this.list.push({ ...s, n, cited: false } as Source);
    this.byKey.set(key, n);
    this.onChange?.(this.snapshot());
    return n;
  };

  /** Registers RAG chunks (call before anything else so they are [1..k]). Returns their numbers. */
  registerChunks(chunks: any[]): number[] {
    const before = this.list.length;
    const listener = this.onChange;
    this.onChange = undefined; // one snapshot for the whole batch
    try {
      return this.registerEach(chunks);
    } finally {
      this.onChange = listener;
      if (this.list.length !== before) this.onChange?.(this.snapshot());
    }
  }

  private registerEach(chunks: any[]): number[] {
    return chunks.map((c) =>
      this.register({
        kind: "doc",
        title: c?.sourceFile ?? c?.metadata?.sourceFile ?? "Document",
        sourceId: c?.sourceId ?? c?.metadata?.sourceId ?? "",
        page: c?.pageNumber ?? c?.metadata?.pageNumber ?? null,
        chunkIndex: c?.chunkIndex ?? c?.metadata?.chunkIndex ?? 0,
        snippet: c?.text ?? "",
        score: c?.score ?? 0,
      })
    );
  }

  get size(): number {
    return this.list.length;
  }

  has(n: number): boolean {
    return Number.isInteger(n) && n >= 1 && n <= this.list.length;
  }

  snapshot(): Source[] {
    return this.list.map((s) => ({ ...s }));
  }

  /** Numbers cited in a text (only ones that exist). */
  citedIn(text: string): number[] {
    const out = new Set<number>();
    for (const m of text.matchAll(CITATION_GROUP)) {
      for (const part of m[1].split(",")) {
        const n = Number(part.trim());
        if (this.has(n)) out.add(n);
      }
    }
    return [...out];
  }

  /**
   * Marks sources the content cites, strips citations to numbers that don't
   * exist, and returns the cleaned content. Emits a snapshot when anything changed.
   */
  finalize(content: string): string {
    let changed = false;
    const fix = (segment: string) =>
      segment.replace(CITATION_WITH_SPACE, (_match, space: string, inner: string) => {
        const kept = inner
          .split(",")
          .map((p) => Number(p.trim()))
          .filter((n) => this.has(n));
        // Drop the marker and the space before it ("fact [9]." becomes "fact.")
        if (kept.length === 0) return "";
        for (const n of kept) {
          const s = this.list[n - 1];
          if (!s.cited) {
            s.cited = true;
            changed = true;
          }
        }
        return space + kept.map((n) => `[${n}]`).join("");
      });
    // Leave code alone: `arr[1]` is not a citation.
    const cleaned = content
      .split(CODE_SPANS)
      .map((part, i) => (i % 2 === 1 ? part : fix(part)))
      .join("");
    if (changed) this.onChange?.(this.snapshot());
    return cleaned;
  }
}

export type { Source, DocSource, WebSource, DataSource };
