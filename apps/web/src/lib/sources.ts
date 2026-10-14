import type { DataSource, DocSource, MessageDTO, Source, WebSource } from "@/lib/types";

/*
 * One numbered list of sources per answer. The server sends `sources` with
 * `n` matching the [n] markers in the text. Older messages only have the
 * legacy `ragSources` / `webSources` arrays, which are numbered here in order
 * (documents first, then web), matching how the old prompt numbered them.
 */

type SourceCarrier = Pick<MessageDTO, "sources"> & Partial<Pick<MessageDTO, "ragSources" | "webSources" | "content">>;

export function unifySources(message: SourceCarrier | null | undefined): Source[] {
  if (!message) return [];
  if (message.sources && message.sources.length > 0) {
    return [...message.sources].sort((a, b) => a.n - b.n);
  }
  const out: Source[] = [];
  const cited = citedNumbers(message.content ?? "");
  for (const r of message.ragSources ?? []) {
    const n = out.length + 1;
    const doc: DocSource = {
      n,
      kind: "doc",
      title: r.sourceFile,
      cited: cited.has(n),
      sourceId: "",
      page: r.pageNumber > 0 ? r.pageNumber : null,
      chunkIndex: 0,
      snippet: r.text ?? "",
      score: r.score,
    };
    out.push(doc);
  }
  for (const w of message.webSources ?? []) {
    const n = out.length + 1;
    const web: WebSource = { n, kind: "web", title: w.title, cited: cited.has(n), url: w.url, snippet: null };
    out.push(web);
  }
  return out;
}

/** The set of [n] numbers used in a text (outside code is not checked here). */
export function citedNumbers(text: string): Set<number> {
  const set = new Set<number>();
  for (const m of text.matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)) {
    for (const part of m[1].split(",")) set.add(Number(part.trim()));
  }
  return set;
}

export function findSource(sources: Source[], n: number): Source | undefined {
  return sources.find((s) => s.n === n);
}

/** "example.com" from a URL (falls back to the raw string). */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only http(s) links are rendered as anchors. */
export function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Short accessible description, e.g. "report.pdf, page 4". */
export function sourceLabel(s: Source): string {
  switch (s.kind) {
    case "doc":
      return s.page ? `${s.title}, page ${s.page}` : s.title;
    case "web":
      return `${s.title}, ${domainOf(s.url)}`;
    case "data":
      return `${s.connectionName}, ${s.db}.${s.collection}`;
  }
}

/** Snippet text for tooltips (data sources have none). */
export function sourceSnippet(s: Source): string | null {
  if (s.kind === "doc") return s.snippet || null;
  if (s.kind === "web") return s.snippet;
  return null;
}

export type { Source, DocSource, WebSource, DataSource };
