/*
 * DiagramData to Mermaid flowchart source. It feeds the Excalidraw converter and
 * "Copy Mermaid". Ids are made Mermaid safe, labels are quoted with entity
 * escapes, and node types map to shapes plus classDefs that match the in-app
 * diagram palette.
 */

import type { DiagramData } from "@wup/contracts";
import { normalizeDiagram, pickDirection, type DiagramKind } from "./normalize";

function escapeLabel(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .trim();
}

function shape(kind: DiagramKind, label: string): string {
  const l = `"${label}"`;
  switch (kind) {
    case "start":
    case "end":
      return `([${l}])`;
    case "decision":
      return `{${l}}`;
    default:
      return `[${l}]`;
  }
}

const CLASS_DEFS: Partial<Record<DiagramKind, string>> = {
  start: "fill:#f9f9f9,stroke:#e6e6e6,color:#1f1f1f",
  end: "fill:#f9f9f9,stroke:#e6e6e6,color:#1f1f1f",
  decision: "fill:#e8effc,stroke:#a7c0f1,color:#1f1f1f",
  success: "fill:#f2f8eb,stroke:#acd587,color:#1f1f1f",
  error: "fill:#fde7e2,stroke:#eba18f,color:#1f1f1f",
};

export interface MermaidSource {
  code: string;
  /** Node kind by Mermaid-safe id (the ids the Excalidraw converter keeps). */
  kinds: Map<string, DiagramKind>;
}

export function toMermaid(d: DiagramData): string {
  return toMermaidSource(d).code;
}

export function toMermaidSource(d: DiagramData): MermaidSource {
  const g = normalizeDiagram(d);
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const n of g.nodes) {
    let base = n.id.replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "n";
    if (/^\d/.test(base) || /^(end|graph|subgraph|flowchart|class|classDef|style|click|default)$/i.test(base)) {
      base = `n_${base}`;
    }
    let id = base;
    let i = 2;
    while (used.has(id)) id = `${base}_${i++}`;
    used.add(id);
    ids.set(n.id, id);
  }

  const lines = [`flowchart ${pickDirection(g)}`];
  for (const n of g.nodes) {
    const text = n.sublabel ? `${escapeLabel(n.label)}<br/><small>${escapeLabel(n.sublabel)}</small>` : escapeLabel(n.label);
    lines.push(`  ${ids.get(n.id)}${shape(n.type, text)}`);
  }
  for (const e of g.edges) {
    const label = e.label ? `|"${escapeLabel(e.label)}"|` : "";
    lines.push(`  ${ids.get(e.from)} -->${label} ${ids.get(e.to)}`);
  }

  const byKind = new Map<DiagramKind, string[]>();
  for (const n of g.nodes) {
    if (!CLASS_DEFS[n.type]) continue;
    byKind.set(n.type, [...(byKind.get(n.type) ?? []), ids.get(n.id)!]);
  }
  for (const [kind, members] of byKind) {
    // "end" is a Mermaid keyword, so class names get a prefix.
    const cls = `w_${kind}`;
    lines.push(`  classDef ${cls} ${CLASS_DEFS[kind]}`);
    lines.push(`  class ${members.join(",")} ${cls}`);
  }
  const kinds = new Map(g.nodes.map((n) => [ids.get(n.id)!, n.type]));
  return { code: lines.join("\n"), kinds };
}
