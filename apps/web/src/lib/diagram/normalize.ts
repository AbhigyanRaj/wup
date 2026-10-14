/*
 * Guards for DiagramData: nodes and edges default to [], ids are coerced and
 * deduplicated, dangling and duplicate edges are dropped. Never throws.
 */

export type DiagramKind = "start" | "end" | "action" | "decision" | "success" | "error";

export interface CleanNode {
  id: string;
  label: string;
  sublabel?: string;
  type: DiagramKind;
}

export interface CleanEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface CleanDiagram {
  nodes: CleanNode[];
  edges: CleanEdge[];
  /** Edges removed because an endpoint was missing. */
  droppedEdges: number;
  /** Nodes removed as duplicates. */
  duplicateNodes: number;
}

/** Above this the graph is shown as a list instead of a layout. */
export const DIAGRAM_MAX_NODES = 60;

const KINDS = new Set<DiagramKind>(["start", "end", "action", "decision", "success", "error"]);

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizeDiagram(raw: unknown): CleanDiagram {
  const data = isRecord(raw) ? raw : {};
  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const rawEdges = Array.isArray(data.edges) ? data.edges : [];

  const nodes: CleanNode[] = [];
  const seen = new Set<string>();
  let duplicateNodes = 0;
  for (const n of rawNodes) {
    if (!isRecord(n)) continue;
    const id = str(n.id)?.trim();
    if (!id) continue;
    if (seen.has(id)) {
      duplicateNodes++;
      continue;
    }
    seen.add(id);
    const typeRaw = typeof n.type === "string" ? (n.type.toLowerCase() as DiagramKind) : "action";
    const sub = str(n.sublabel)?.trim();
    nodes.push({
      id,
      label: str(n.label)?.trim() || id,
      sublabel: sub || undefined,
      type: KINDS.has(typeRaw) ? typeRaw : "action",
    });
  }

  const edges: CleanEdge[] = [];
  const edgeKeys = new Set<string>();
  let droppedEdges = 0;
  for (const e of rawEdges) {
    if (!isRecord(e)) {
      droppedEdges++;
      continue;
    }
    const from = str(e.from)?.trim();
    const to = str(e.to)?.trim();
    if (!from || !to || !seen.has(from) || !seen.has(to)) {
      droppedEdges++;
      continue;
    }
    const label = str(e.label)?.trim() || undefined;
    const key = `${from}\u0000${to}\u0000${label ?? ""}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ id: `e${edges.length}`, from, to, label });
  }

  return { nodes, edges, droppedEdges, duplicateNodes };
}

/** Longest-path depth (cycle safe) and widest rank, used to pick the layout direction. */
export function graphShape(d: Pick<CleanDiagram, "nodes" | "edges">): { depth: number; width: number } {
  const incoming = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const n of d.nodes) {
    incoming.set(n.id, 0);
    out.set(n.id, []);
  }
  for (const e of d.edges) {
    if (e.from === e.to) continue;
    out.get(e.from)?.push(e.to);
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }
  // Kahn's algorithm. When only cycles remain, break one at the node with the
  // fewest unresolved inputs and carry on, so every node gets a rank.
  const rank = new Map<string, number>();
  const remaining = new Map(incoming);
  const done = new Set<string>();
  const queue = d.nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  for (const id of queue) rank.set(id, 0);
  while (done.size < d.nodes.length) {
    if (queue.length === 0) {
      let pick: string | undefined;
      let best = Infinity;
      for (const n of d.nodes) {
        if (done.has(n.id)) continue;
        const left = remaining.get(n.id) ?? 0;
        // Prefer nodes already reached (they continue a path) over isolated cycles.
        const score = left - (rank.has(n.id) ? 0.5 : 0);
        if (score < best) [pick, best] = [n.id, score];
      }
      if (!pick) break;
      if (!rank.has(pick)) rank.set(pick, 0);
      queue.push(pick);
    }
    const id = queue.shift()!;
    if (done.has(id)) continue;
    done.add(id);
    for (const next of out.get(id) ?? []) {
      if (done.has(next)) continue;
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(id) ?? 0) + 1));
      const left = (remaining.get(next) ?? 1) - 1;
      remaining.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  const perRank = new Map<number, number>();
  for (const n of d.nodes) {
    const r = rank.get(n.id) ?? 0;
    perRank.set(r, (perRank.get(r) ?? 0) + 1);
  }
  const depth = perRank.size === 0 ? 0 : Math.max(...perRank.keys()) + 1;
  const width = perRank.size === 0 ? 0 : Math.max(...perRank.values());
  return { depth, width };
}

/** TB by default; LR when the graph is shallow (depth 3 or less) and wide (more than 4). */
export function pickDirection(d: Pick<CleanDiagram, "nodes" | "edges">): "TB" | "LR" {
  const { depth, width } = graphShape(d);
  return depth <= 3 && width > 4 ? "LR" : "TB";
}
