export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Perform a keyless web search query using DuckDuckGo HTML results
 */
export async function web_search(args: { query: string }): Promise<{ results: SearchResult[] }> {
  const query = args.query;
  if (!query) {
    return { results: [] };
  }

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      }
    });

    if (!response.ok) {
      console.error(`[Web Search] DuckDuckGo returned status ${response.status}`);
      return { results: [] };
    }

    const html = await response.text();
    const results: SearchResult[] = [];
    
    const resultBlocks = html.split('<div class="result results_links results_links_deep web-result');
    for (let i = 1; i < Math.min(resultBlocks.length, 6); i++) {
      const block = resultBlocks[i];
      
      const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/);
      const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      
      if (urlMatch && titleMatch) {
        let title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
        let link = urlMatch[1];
        let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        
        if (link.includes("uddg=")) {
          const parts = link.split("uddg=");
          if (parts[1]) {
            link = decodeURIComponent(parts[1].split("&")[0]);
          }
        }
        
        results.push({
          title,
          url: link,
          snippet
        });
      }
    }

    return { results };
  } catch (error) {
    console.error("[Web Search] Search execution failed:", error);
    return { results: [] };
  }
}
