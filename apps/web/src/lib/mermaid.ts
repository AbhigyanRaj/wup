/*
 * Mermaid source helpers shared by the Excalidraw diagram renderer.
 * Rendering itself happens in @excalidraw/mermaid-to-excalidraw (it bundles
 * its own mermaid); this file only repairs common LLM mistakes and hashes code
 * for the conversion cache. No mermaid import here, so it costs nothing to load.
 */

/** Quote bracket labels that contain characters Mermaid treats as syntax. */
export function sanitizeMermaid(code: string): string {
  return code
    .replace(/\[([^\]"]*[()/\\&|<>][^\]"]*)\]/g, '["$1"]')
    .replace(/\{([^}"]*[()/\\&|<>][^}"]*)\}/g, '{"$1"}');
}

/**
 * Fixes the common LLM mistake of putting classDef lines BEFORE the graph type
 * declaration. Mermaid wants: graph type first, then nodes and edges, then classDef.
 */
export function fixClassDefOrder(code: string): string {
  const lines = code.split("\n");
  const classDefLines: string[] = [];
  const otherLines: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("classDef ")) classDefLines.push(line);
    else otherLines.push(line);
  }
  return classDefLines.length > 0 ? [...otherLines, ...classDefLines].join("\n") : code;
}

/** Label quoting only makes sense for flowcharts; class bodies use { } and ( ) legitimately. */
export function cleanMermaid(code: string): string {
  const trimmed = code.trim();
  const flow = /^(flowchart|graph)\b/.test(mermaidHeader(trimmed));
  return fixClassDefOrder(flow ? sanitizeMermaid(trimmed) : trimmed);
}

function mermaidHeader(code: string): string {
  return (
    code
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("%%") && !l.startsWith("---")) ?? ""
  );
}

/** FNV-1a, 32 bit, base 36. */
export function hashCode(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const TYPE_TITLES: Array<[RegExp, string]> = [
  [/^(flowchart|graph)\b/, "Flowchart"],
  [/^sequenceDiagram\b/, "Sequence diagram"],
  [/^classDiagram/, "Class diagram"],
  [/^stateDiagram/, "State diagram"],
  [/^erDiagram\b/, "Entity relationship diagram"],
  [/^gantt\b/, "Timeline"],
  [/^journey\b/, "User journey"],
  [/^pie\b/, "Pie chart"],
  [/^mindmap\b/, "Mind map"],
  [/^timeline\b/, "Timeline"],
  [/^gitGraph\b/, "Git graph"],
];

/** A human title from the diagram type on the first meaningful line. */
export function mermaidTitle(code: string): string {
  const first = mermaidHeader(code);
  if (!first) return "Diagram";
  for (const [re, t] of TYPE_TITLES) if (re.test(first)) return t;
  return "Diagram";
}
