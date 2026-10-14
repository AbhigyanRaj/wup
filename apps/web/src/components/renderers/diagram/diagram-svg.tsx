"use client";

import { useState, type Ref } from "react";
import { curveBasis, line as d3line } from "d3-shape";
import type { DiagramKind } from "@/lib/diagram/normalize";
import { NODE_SUB, NODE_TEXT, type DiagramLayout, type LaidNode } from "@/lib/diagram/layout";
import { measureText } from "@/lib/charts/measure-text";
import { useSvgId } from "../hooks";

/* Draws a dagre layout: curved edges with per-instance arrow markers, pill edge labels, typed nodes. */

const NODE_STYLE: Record<DiagramKind, { fill: string; stroke: string; text: string; radius: "pill" | number }> = {
  start: { fill: "#f9f9f9", stroke: "#e6e6e6", text: "#1f1f1f", radius: "pill" },
  end: { fill: "#f9f9f9", stroke: "#e6e6e6", text: "#1f1f1f", radius: "pill" },
  action: { fill: "#ffffff", stroke: "#e6e6e6", text: "#1f1f1f", radius: 12 },
  decision: { fill: "#fafcff", stroke: "#d2dff9", text: "#3333cc", radius: 12 },
  success: { fill: "#f2f8eb", stroke: "#e6e6e6", text: "#496d21", radius: 12 },
  error: { fill: "#fde7e2", stroke: "#e6e6e6", text: "#c43d2b", radius: 12 },
};

const EDGE = "#b3b3b3";
const EDGE_ACTIVE = "#666666";
const GLYPH_W = 22;
const FIT_HEIGHT = 560;

const edgeLine = d3line<{ x: number; y: number }>()
  .x((p) => p.x)
  .y((p) => p.y)
  .curve(curveBasis);

function Glyph({ kind, x, y, color }: { kind: DiagramKind; x: number; y: number; color: string }) {
  if (kind === "decision") {
    return (
      <path
        d={`M${x + 7},${y - 6} L${x + 13},${y} L${x + 7},${y + 6} L${x + 1},${y} Z`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    );
  }
  if (kind === "success") {
    return (
      <path
        d={`M${x + 1.5},${y + 0.5} L${x + 5.5},${y + 4.5} L${x + 12.5},${y - 4}`}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (kind === "error") {
    return (
      <path
        d={`M${x + 2},${y - 5} L${x + 12},${y + 5} M${x + 12},${y - 5} L${x + 2},${y + 5}`}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    );
  }
  return null;
}

function Node({ n, dim }: { n: LaidNode; dim: boolean }) {
  const s = NODE_STYLE[n.type];
  const rx = s.radius === "pill" ? Math.min(n.height / 2, 22) : Math.min(s.radius, n.height / 2);
  const textW = Math.max(
    ...n.lines.map((l) => measureText(l, NODE_TEXT.size, NODE_TEXT.weight)),
    ...n.subLines.map((l) => measureText(l, NODE_SUB.size, NODE_SUB.weight)),
  );
  const contentW = textW + (n.glyph ? GLYPH_W : 0);
  const startX = (n.width - contentW) / 2;
  const cx = startX + (n.glyph ? GLYPH_W : 0) + textW / 2;
  const blockH = n.lines.length * NODE_TEXT.line + (n.subLines.length ? 2 + n.subLines.length * NODE_SUB.line : 0);
  const top = (n.height - blockH) / 2;
  return (
    <g
      transform={`translate(${n.x - n.width / 2},${n.y - n.height / 2})`}
      opacity={dim ? 0.45 : 1}
      className="transition-opacity duration-150 ease-out"
    >
      <rect width={n.width} height={n.height} rx={rx} ry={rx} fill={s.fill} stroke={s.stroke} strokeWidth={1} />
      {n.glyph ? <Glyph kind={n.type} x={startX} y={top + NODE_TEXT.line / 2} color={s.text} /> : null}
      {n.lines.map((l, i) => (
        <text
          key={i}
          x={cx}
          y={top + i * NODE_TEXT.line + NODE_TEXT.line / 2}
          dominantBaseline="central"
          textAnchor="middle"
          style={{ fontSize: NODE_TEXT.size, fontWeight: n.type === "start" || n.type === "end" ? 525 : NODE_TEXT.weight, fill: s.text }}
        >
          {l}
        </text>
      ))}
      {n.subLines.map((l, i) => (
        <text
          key={`s${i}`}
          x={cx}
          y={top + n.lines.length * NODE_TEXT.line + 2 + i * NODE_SUB.line + NODE_SUB.line / 2}
          dominantBaseline="central"
          textAnchor="middle"
          style={{ fontSize: NODE_SUB.size, fill: "#666666" }}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

export interface DiagramSvgProps {
  layout: DiagramLayout;
  svgRef?: Ref<SVGSVGElement>;
  /** Natural pixel size (expanded view) instead of fit to width. */
  natural?: boolean;
  label: string;
}

export function DiagramSvg({ layout, svgRef, natural, label }: DiagramSvgProps) {
  const arrowId = useSvgId("arrow");
  const arrowActiveId = useSvgId("arrow-on");
  const [hover, setHover] = useState<string | null>(null);
  const linked = new Set<string>();
  if (hover) {
    linked.add(hover);
    for (const e of layout.edges) {
      if (e.from === hover) linked.add(e.to);
      if (e.to === hover) linked.add(e.from);
    }
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="block font-sans"
      style={
        natural
          ? undefined
          : // Fit to the card width, and keep tall graphs within FIT_HEIGHT (Expand shows full size).
            { maxWidth: `min(100%, ${Math.round(layout.width * Math.min(1, FIT_HEIGHT / Math.max(1, layout.height)))}px)`, height: "auto" }
      }
    >
      <defs>
        {[
          [arrowId, EDGE],
          [arrowActiveId, EDGE_ACTIVE],
        ].map(([id, color]) => (
          <marker key={id} id={id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={8} markerHeight={8} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M1,1.5 L9,5 L1,8.5 Z" fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />
          </marker>
        ))}
      </defs>
      <g fill="none">
        {layout.edges.map((e) => {
          const on = hover !== null && (e.from === hover || e.to === hover);
          const dim = hover !== null && !on;
          return e.points.length > 1 ? (
            <path
              key={e.id}
              d={edgeLine(e.points) ?? ""}
              stroke={on ? EDGE_ACTIVE : EDGE}
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={dim ? 0.4 : 1}
              markerEnd={`url(#${on ? arrowActiveId : arrowId})`}
              className="transition-opacity duration-150 ease-out"
            />
          ) : null;
        })}
      </g>
      {layout.edges.map((e) =>
        e.label ? (
          <g key={`l-${e.id}`} opacity={hover !== null && e.from !== hover && e.to !== hover ? 0.4 : 1}>
            <rect
              x={e.label.x - e.label.width / 2}
              y={e.label.y - e.label.height / 2}
              width={e.label.width}
              height={e.label.height}
              rx={e.label.height / 2}
              fill="#ffffff"
              stroke="#e6e6e6"
            />
            <text x={e.label.x} y={e.label.y} dominantBaseline="central" textAnchor="middle" style={{ fontSize: 12, fill: "#666666" }}>
              {e.label.text}
            </text>
          </g>
        ) : null,
      )}
      {layout.nodes.map((n) => (
        <g key={n.id} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}>
          <Node n={n} dim={hover !== null && !linked.has(n.id)} />
        </g>
      ))}
    </svg>
  );
}
