import type { ToolContext } from "./types";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export const WEB_SEARCH_TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "...",
  mdash: "-",
  ndash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

/** Decodes the HTML entities DuckDuckGo leaves in titles and snippets. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

const stripTags = (html: string) => decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** Parses DuckDuckGo's HTML results page. Exported for tests. */
export function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const blocks = html.split('<div class="result results_links results_links_deep web-result');
  for (let i = 1; i < blocks.length && results.length < MAX_RESULTS; i++) {
    const block = blocks[i];
    const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/);
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    if (!urlMatch || !titleMatch) continue;
    let link = decodeHtmlEntities(urlMatch[1]);
    if (link.includes("uddg=")) {
      const encoded = link.split("uddg=")[1]?.split("&")[0];
      if (encoded) {
        try {
          link = decodeURIComponent(encoded);
        } catch {}
      }
    }
    if (link.startsWith("//")) link = `https:${link}`;
    if (!/^https?:\/\//i.test(link)) continue;
    results.push({ title: stripTags(titleMatch[1]) || link, url: link, snippet: snippetMatch ? stripTags(snippetMatch[1]) : "" });
  }
  return results;
}

/**
 * Keyless web search over DuckDuckGo's HTML endpoint. Each result is registered
 * as a web source; the model gets its citation number `n` to cite as [n].
 */
export async function web_search(
  args: { query: string },
  ctx?: ToolContext
): Promise<{ results: Array<SearchResult & { n?: number }>; error?: string }> {
  const query = typeof args?.query === "string" ? args.query.trim() : "";
  if (!query) return { results: [], error: "A search query is required." };

  const signal = ctx?.signal
    ? AbortSignal.any([ctx.signal, AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS)])
    : AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal,
    });
    if (!response.ok) {
      ctx?.log?.warn("web search failed", { status: response.status });
      return { results: [], error: `Web search failed (status ${response.status}).` };
    }
    const results = parseDuckDuckGoHtml(await response.text());
    return {
      results: results.map((r) => {
        const n = ctx?.registerSource?.({ kind: "web", title: r.title, url: r.url, snippet: r.snippet });
        return typeof n === "number" ? { n, ...r } : r;
      }),
    };
  } catch (error) {
    const timedOut = !ctx?.signal?.aborted && signal.aborted;
    ctx?.log?.warn("web search error", { message: error instanceof Error ? error.message : String(error) });
    return { results: [], error: timedOut ? "Web search timed out." : "Web search failed." };
  }
}
