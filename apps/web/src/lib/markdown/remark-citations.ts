import type { Root, Parent, PhrasingContent, Text, RootContent } from "mdast";

/*
 * remark plugin: turns citation markers like [2] or [1, 3] into citation nodes.
 *
 * It walks the mdast tree and only touches `text` nodes, so markers inside
 * inline code, fenced code, link text and link labels stay literal. Each
 * marker becomes a node rendered as <sup data-citation="n">n</sup>, which the
 * markdown components map turns into a <Citation n={n} />.
 */

export const CITATION_RE = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;

/** Node types whose text must stay literal. */
const SKIP = new Set(["code", "inlineCode", "link", "linkReference", "definition", "html", "math", "inlineMath"]);

export interface CitationOptions {
  /** Highest citation number accepted (markers above it stay literal). Default 999. */
  max?: number;
}

function citationNode(n: number): PhrasingContent {
  return {
    type: "citation",
    data: {
      hName: "sup",
      hProperties: { dataCitation: String(n) },
      hChildren: [{ type: "text", value: String(n) }],
    },
    children: [{ type: "text", value: String(n) }],
  } as unknown as PhrasingContent;
}

/** Splits one text value into text + citation nodes. Returns null when it has no markers. */
export function splitCitations(value: string, max = 999): PhrasingContent[] | null {
  CITATION_RE.lastIndex = 0;
  if (!CITATION_RE.test(value)) return null;
  CITATION_RE.lastIndex = 0;

  const out: PhrasingContent[] = [];
  let last = 0;
  let changed = false;
  for (const m of value.matchAll(CITATION_RE)) {
    const nums = m[1].split(",").map((s) => Number(s.trim()));
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > max)) continue;
    const start = m.index ?? 0;
    if (start > last) out.push({ type: "text", value: value.slice(last, start) } as Text);
    for (const n of nums) out.push(citationNode(n));
    last = start + m[0].length;
    changed = true;
  }
  if (!changed) return null;
  if (last < value.length) out.push({ type: "text", value: value.slice(last) } as Text);
  return out;
}

function walk(node: Parent, max: number) {
  const next: RootContent[] = [];
  let changed = false;
  for (const child of node.children as RootContent[]) {
    if (SKIP.has(child.type)) {
      next.push(child);
      continue;
    }
    if (child.type === "text") {
      const parts = splitCitations(child.value, max);
      if (parts) {
        next.push(...(parts as RootContent[]));
        changed = true;
        continue;
      }
      next.push(child);
      continue;
    }
    if ("children" in child && Array.isArray((child as Parent).children)) {
      walk(child as Parent, max);
    }
    next.push(child);
  }
  if (changed) (node as Parent).children = next as Parent["children"];
}

/** The remark plugin (use as `remarkPlugins={[remarkGfm, remarkCitations]}`). */
export function remarkCitations(options: CitationOptions = {}) {
  const max = options.max ?? 999;
  return (tree: Root) => {
    walk(tree, max);
  };
}
