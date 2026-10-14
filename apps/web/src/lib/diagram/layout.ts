/*
 * Dagre layout for flow diagrams. Labels are wrapped (220px, up to 3 lines) and
 * measured before layout, and edge labels get a real width and height so dagre
 * routes edges around nodes instead of through them.
 */

import dagre from "@dagrejs/dagre";
import { measureText, wrapText } from "../charts/measure-text";
import type { CleanDiagram, CleanNode, DiagramKind } from "./normalize";
import { pickDirection } from "./normalize";

export const NODE_TEXT = { size: 14, weight: 425, line: 20 } as const;
export const NODE_SUB = { size: 12, weight: 425, line: 16 } as const;
export const EDGE_TEXT = { size: 12, weight: 425 } as const;

const MAX_TEXT_W = 220;
const PAD_X = 16;
const PAD_Y = 12;
const GLYPH = 22;
const MIN_W = 104;
const EDGE_LABEL_H = 22;
const MARGIN = 12;

export interface LaidNode extends CleanNode {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  subLines: string[];
  glyph: boolean;
}

export interface LaidEdge {
  id: string;
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number; width: number; height: number };
}

export interface DiagramLayout {
  direction: "TB" | "LR";
  width: number;
  height: number;
  nodes: LaidNode[];
  edges: LaidEdge[];
}

const GLYPH_KINDS = new Set<DiagramKind>(["decision", "success", "error"]);

export function layoutDiagram(d: CleanDiagram): DiagramLayout {
  const direction = pickDirection(d);
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: direction, nodesep: 32, ranksep: 48, edgesep: 16, marginx: MARGIN, marginy: MARGIN });
  g.setDefaultEdgeLabel(() => ({}));

  const sized = new Map<string, Omit<LaidNode, "x" | "y">>();
  for (const n of d.nodes) {
    const glyph = GLYPH_KINDS.has(n.type);
    const textMax = MAX_TEXT_W - (glyph ? GLYPH : 0);
    const lines = wrapText(n.label, textMax, 3, NODE_TEXT.size, NODE_TEXT.weight);
    const subLines = n.sublabel ? wrapText(n.sublabel, textMax, 2, NODE_SUB.size, NODE_SUB.weight) : [];
    const textW = Math.max(
      ...lines.map((l) => measureText(l, NODE_TEXT.size, NODE_TEXT.weight)),
      ...subLines.map((l) => measureText(l, NODE_SUB.size, NODE_SUB.weight)),
    );
    const pill = n.type === "start" || n.type === "end";
    const width = Math.max(MIN_W, Math.ceil(textW + (glyph ? GLYPH : 0) + PAD_X * 2 + (pill ? 8 : 0)));
    const height = Math.ceil(
      PAD_Y * 2 + lines.length * NODE_TEXT.line + (subLines.length ? 2 + subLines.length * NODE_SUB.line : 0),
    );
    sized.set(n.id, { ...n, width, height, lines, subLines, glyph });
    g.setNode(n.id, { width, height });
  }

  for (const e of d.edges) {
    const label = e.label
      ? { width: Math.ceil(measureText(e.label, EDGE_TEXT.size, EDGE_TEXT.weight) + 20), height: EDGE_LABEL_H }
      : { width: 0, height: 0 };
    g.setEdge(e.from, e.to, { ...label, labelpos: "c" }, e.id);
  }

  dagre.layout(g);

  const nodes: LaidNode[] = d.nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...sized.get(n.id)!, x: pos?.x ?? 0, y: pos?.y ?? 0 };
  });

  const edges: LaidEdge[] = d.edges.map((e) => {
    const data = g.edge({ v: e.from, w: e.to, name: e.id }) as
      | { points?: Array<{ x: number; y: number }>; x?: number; y?: number; width?: number; height?: number }
      | undefined;
    const points = (data?.points ?? []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      points,
      label:
        e.label && data && Number.isFinite(data.x) && Number.isFinite(data.y)
          ? { text: e.label, x: data.x!, y: data.y!, width: data.width ?? 0, height: data.height ?? EDGE_LABEL_H }
          : undefined,
    };
  });

  const graph = g.graph() as { width?: number; height?: number };
  return {
    direction,
    width: Math.ceil(graph.width ?? 0),
    height: Math.ceil(graph.height ?? 0),
    nodes,
    edges,
  };
}
