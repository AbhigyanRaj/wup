"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { area as d3area, curveMonotoneX, line as d3line } from "d3-shape";
import type { NormalizedChart } from "@/lib/charts/normalize";
import { formatCompact, formatFull } from "@/lib/charts/format";
import { ellipsize, measureText } from "@/lib/charts/measure-text";
import { CHART_AXIS, CHART_GRID, CHART_PRIMARY, CHART_SURFACE, CHART_TEXT } from "@/lib/charts/palette";
import { ChartTooltip, type TooltipDatum } from "./chart-tooltip";
import { useSvgId } from "../hooks";

/*
 * Bar (vertical and horizontal) and line charts, hand drawn on d3-scale + d3-shape
 * at true pixel size (no viewBox letterboxing), so the HTML tooltip lines up exactly.
 */

const TICK = { size: 12, weight: 425 } as const;
const CAT = { size: 13, weight: 425 } as const;
const RADIUS = 4;

/** Rect path with only the data end rounded (square at the baseline). */
function barPath(x: number, y: number, w: number, h: number, end: "top" | "bottom" | "right" | "left"): string {
  if (w <= 0 || h <= 0) return "";
  const r = Math.min(RADIUS, end === "top" || end === "bottom" ? Math.min(w / 2, h) : Math.min(h / 2, w));
  const x2 = x + w;
  const y2 = y + h;
  switch (end) {
    case "top":
      return `M${x},${y2}V${y + r}Q${x},${y} ${x + r},${y}H${x2 - r}Q${x2},${y} ${x2},${y + r}V${y2}Z`;
    case "bottom":
      return `M${x},${y}V${y2 - r}Q${x},${y2} ${x + r},${y2}H${x2 - r}Q${x2},${y2} ${x2},${y2 - r}V${y}Z`;
    case "right":
      return `M${x},${y}H${x2 - r}Q${x2},${y} ${x2},${y + r}V${y2 - r}Q${x2},${y2} ${x2 - r},${y2}H${x}Z`;
    case "left":
      return `M${x2},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y2 - r}Q${x},${y2} ${x + r},${y2}H${x2}Z`;
  }
}

const crisp = (v: number) => Math.round(v) + 0.5;

function niceLinear(values: number[], range: [number, number]) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const scale = scaleLinear()
    .domain(lo === hi ? [0, 1] : [lo, hi])
    .range(range)
    .nice(5);
  return scale;
}

/** Every k-th label, each cut to the room it gets. */
function thinLabels(labels: string[], step: number, maxW: number) {
  const widest = Math.min(120, Math.max(0, ...labels.map((l) => measureText(l, TICK.size, TICK.weight))));
  const k = Math.max(1, Math.ceil((widest + 12) / Math.max(1, step)));
  const room = Math.min(maxW, k * step - 12);
  return labels.map((l, i) => (i % k === 0 ? ellipsize(l, room, TICK.size, TICK.weight) : null));
}

export interface CartesianChartProps {
  chart: NormalizedChart;
  width: number;
  svgRef?: Ref<SVGSVGElement>;
  ariaLabel: string;
}

export function CartesianChart({ chart, width, svgRef, ariaLabel }: CartesianChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const areaId = useSvgId("area");
  const clipId = useSvgId("clip");
  const { points, affix, kind } = chart;
  const values = points.map((p) => p.value);
  const color = CHART_PRIMARY;
  const compact = width < 480;

  const geo = useMemo(() => {
    if (kind === "hbar") {
      const n = points.length;
      const pitch = n <= 12 ? 40 : n <= 24 ? 30 : 26;
      const thick = n <= 12 ? 22 : n <= 24 ? 16 : 14;
      const showTips = n <= 16;
      const labelW = Math.min(
        compact ? width * 0.36 : Math.min(200, width * 0.3),
        Math.max(...points.map((p) => measureText(p.label, CAT.size, CAT.weight))),
      );
      const tipW = showTips
        ? Math.max(...values.map((v) => measureText(formatCompact(v, affix), TICK.size, 525))) + 10
        : 12;
      const top = 4;
      const bottom = showTips ? 8 : 28;
      const left = Math.ceil(labelW) + 16;
      const negTip = values.some((v) => v < 0) && showTips ? tipW : 0;
      const innerW = Math.max(40, width - left - tipW - negTip);
      const height = top + n * pitch + bottom;
      const x = niceLinear(values, [left + negTip, left + negTip + innerW]);
      return { kind: "hbar" as const, n, pitch, thick, showTips, labelW, left, top, height, x, innerW };
    }
    const height = compact ? 236 : 288;
    const tickVals = niceLinear(values, [0, 1]).ticks(5);
    const gutter = Math.ceil(Math.max(...tickVals.map((t) => measureText(formatCompact(t, affix), TICK.size, TICK.weight)))) + 14;
    const lastW = kind === "line" ? Math.min(60, measureText(points[points.length - 1]?.label ?? "", TICK.size) / 2) : 0;
    const left = gutter;
    const right = Math.max(8, lastW);
    const top = kind === "bar" && points.length <= 8 ? 22 : 10;
    const bottom = 32;
    const innerW = Math.max(40, width - left - right);
    const innerH = height - top - bottom;
    const y = niceLinear(values, [top + innerH, top]);
    return { kind: "xy" as const, height, left, right, top, bottom, innerW, innerH, y };
  }, [kind, points, values, affix, width, compact]);

  const datumFor = (i: number): TooltipDatum | null => {
    const p = points[i];
    if (!p) return null;
    let x = 0;
    let y = 0;
    if (geo.kind === "hbar") {
      x = geo.x(Math.max(0, p.value));
      y = geo.top + i * geo.pitch + geo.pitch / 2 - geo.thick / 2;
      x = Math.min(x, width - 8);
    } else if (kind === "bar") {
      x = band(i) + bandW / 2;
      y = geo.y(Math.max(0, p.value));
    } else {
      x = px(i);
      y = geo.y(p.value);
    }
    return { x, y, value: formatFull(p.value, affix), label: p.label, color, key: kind === "line" ? "line" : "swatch" };
  };

  // Scales for vertical layouts.
  const xBand = useMemo(
    () =>
      scaleBand<string>()
        .domain(points.map((p) => p.key))
        .range(geo.kind === "hbar" ? [0, 1] : [geo.left, geo.left + geo.innerW])
        .paddingInner(0.32)
        .paddingOuter(0.16),
    [points, geo],
  );
  const xPoint = useMemo(
    () =>
      scalePoint<string>()
        .domain(points.map((p) => p.key))
        .range(geo.kind === "hbar" ? [0, 1] : [geo.left, geo.left + geo.innerW])
        .padding(points.length === 1 ? 0.5 : 0),
    [points, geo],
  );
  const band = (i: number) => xBand(points[i]?.key ?? "") ?? 0;
  const bandW = xBand.bandwidth();
  const px = (i: number) => xPoint(points[i]?.key ?? "") ?? 0;

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const n = points.length;
    const fwd = geo.kind === "hbar" ? "ArrowDown" : "ArrowRight";
    const back = geo.kind === "hbar" ? "ArrowUp" : "ArrowLeft";
    let next: number | null = null;
    if (e.key === fwd || e.key === "ArrowRight" || e.key === "ArrowDown") next = active === null ? 0 : Math.min(n - 1, active + 1);
    else if (e.key === back || e.key === "ArrowLeft" || e.key === "ArrowUp") next = active === null ? n - 1 : Math.max(0, active - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
  }

  function onPointer(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left + (geo.kind === "hbar" ? 0 : geo.left);
    const my = e.clientY - rect.top;
    if (geo.kind === "hbar") {
      setActive(Math.max(0, Math.min(points.length - 1, Math.floor(my / geo.pitch))));
      return;
    }
    let best = 0;
    let bestD = Infinity;
    points.forEach((_, i) => {
      const cx = kind === "bar" ? band(i) + bandW / 2 : px(i);
      const d = Math.abs(cx - mx);
      if (d < bestD) [best, bestD] = [i, d];
    });
    setActive(best);
  }

  const datum = active !== null ? datumFor(active) : null;
  const activePoint = active !== null ? points[active] : null;

  let body: ReactNode;
  let height: number;

  if (geo.kind === "hbar") {
    height = geo.height;
    const zeroX = geo.x(0);
    const ticks = geo.x.ticks(compact ? 3 : 5);
    const plotBottom = geo.top + geo.n * geo.pitch;
    body = (
      <>
        {!geo.showTips
          ? ticks.map((t) => (
              <g key={t}>
                <line x1={crisp(geo.x(t))} x2={crisp(geo.x(t))} y1={geo.top} y2={plotBottom} stroke={CHART_GRID} shapeRendering="crispEdges" />
                <text x={geo.x(t)} y={plotBottom + 18} textAnchor="middle" className="chart-tick">
                  {formatCompact(t, affix)}
                </text>
              </g>
            ))
          : null}
        {points.map((p, i) => {
          const cy = geo.top + i * geo.pitch + geo.pitch / 2;
          const x0 = geo.x(Math.min(0, p.value));
          const x1 = geo.x(Math.max(0, p.value));
          const dim = active !== null && active !== i;
          const neg = p.value < 0;
          return (
            <g key={p.key}>
              <text x={geo.left - 16} y={cy} dy="0.35em" textAnchor="end" className="chart-cat">
                {ellipsize(p.label, geo.labelW, CAT.size, CAT.weight)}
              </text>
              <path
                d={barPath(x0, cy - geo.thick / 2, Math.max(1, x1 - x0), geo.thick, neg ? "left" : "right")}
                fill={color}
                className="transition-opacity duration-150 ease-out"
                opacity={dim ? 0.35 : 1}
              />
              {geo.showTips ? (
                <text
                  x={neg ? x0 - 8 : x1 + 8}
                  y={cy}
                  dy="0.35em"
                  textAnchor={neg ? "end" : "start"}
                  className="chart-value"
                >
                  {formatCompact(p.value, affix)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={crisp(zeroX)} x2={crisp(zeroX)} y1={geo.top - 4} y2={plotBottom + 2} stroke={CHART_AXIS} shapeRendering="crispEdges" />
        <rect
          data-export="exclude"
          x={0}
          y={geo.top}
          width={width}
          height={geo.n * geo.pitch}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
        />
      </>
    );
  } else {
    height = geo.height;
    const ticks = geo.y.ticks(compact ? 4 : 5);
    const base = geo.y(Math.max(geo.y.domain()[0], Math.min(0, geo.y.domain()[1])));
    const plotBottom = geo.top + geo.innerH;
    const step = kind === "bar" ? xBand.step() : points.length > 1 ? geo.innerW / (points.length - 1) : geo.innerW;
    const xLabels = thinLabels(
      points.map((p) => p.label),
      step,
      kind === "bar" ? 140 : 120,
    );
    const lineGen = d3line<number>()
      .x((_, i) => px(i))
      .y((v) => geo.y(v))
      .curve(curveMonotoneX);
    const areaGen = d3area<number>()
      .x((_, i) => px(i))
      .y0(base)
      .y1((v) => geo.y(v))
      .curve(curveMonotoneX);
    const barW = Math.min(bandW, compact ? 28 : 40);

    body = (
      <>
        {ticks.map((t) => (
          <g key={t}>
            {t !== 0 ? (
              <line x1={geo.left} x2={geo.left + geo.innerW} y1={crisp(geo.y(t))} y2={crisp(geo.y(t))} stroke={CHART_GRID} shapeRendering="crispEdges" />
            ) : null}
            <text x={geo.left - 12} y={geo.y(t)} dy="0.35em" textAnchor="end" className="chart-tick">
              {formatCompact(t, affix)}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) =>
          l === null ? null : (
            <text
              key={points[i].key}
              x={kind === "bar" ? band(i) + bandW / 2 : px(i)}
              y={plotBottom + 20}
              textAnchor="middle"
              className="chart-tick"
            >
              {l}
            </text>
          ),
        )}

        {kind === "bar" ? (
          points.map((p, i) => {
            const y0 = geo.y(Math.max(0, p.value));
            const y1 = geo.y(Math.min(0, p.value));
            const dim = active !== null && active !== i;
            const capText = formatCompact(p.value, affix);
            const showCap = points.length <= 8 && measureText(capText, 12, 525) + 4 <= xBand.step();
            return (
              <g key={p.key} className="transition-opacity duration-150 ease-out" opacity={dim ? 0.35 : 1}>
                <path
                  d={barPath(band(i) + (bandW - barW) / 2, y0, barW, Math.max(1, y1 - y0), p.value < 0 ? "bottom" : "top")}
                  fill={color}
                />
                {showCap ? (
                  <text x={band(i) + bandW / 2} y={p.value < 0 ? y1 + 16 : y0 - 8} textAnchor="middle" className="chart-value">
                    {capText}
                  </text>
                ) : null}
              </g>
            );
          })
        ) : (
          <g>
            <defs>
              <clipPath id={clipId}>
                <rect x={geo.left - 6} y={geo.top - 6} width={geo.innerW + 12} height={geo.innerH + 12} />
              </clipPath>
              <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={chart.area ? 0.16 : 0.1} />
                <stop offset="100%" stopColor={color} stopOpacity={chart.area ? 0.06 : 0.02} />
              </linearGradient>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <path d={areaGen(values) ?? ""} fill={`url(#${areaId})`} />
              <path d={lineGen(values) ?? ""} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
            {/* End marker anchors the latest value. */}
            <circle cx={px(points.length - 1)} cy={geo.y(values[values.length - 1])} r={4} fill={color} stroke={CHART_SURFACE} strokeWidth={2} />
          </g>
        )}

        <line x1={geo.left} x2={geo.left + geo.innerW} y1={crisp(base)} y2={crisp(base)} stroke={CHART_AXIS} shapeRendering="crispEdges" />

        {kind === "line" && active !== null ? (
          <g data-export="exclude" pointerEvents="none">
            <line x1={crisp(px(active))} x2={crisp(px(active))} y1={geo.top} y2={plotBottom} stroke="#cccccc" shapeRendering="crispEdges" />
            <circle cx={px(active)} cy={geo.y(values[active])} r={5} fill={color} stroke={CHART_SURFACE} strokeWidth={2} />
          </g>
        ) : null}

        <rect
          data-export="exclude"
          x={geo.left}
          y={geo.top}
          width={geo.innerW}
          height={geo.innerH}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
        />
      </>
    );
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-roledescription="chart"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      onFocus={(e) => {
        if (active === null && e.currentTarget.matches(":focus-visible")) setActive(0);
      }}
      onBlur={() => setActive(null)}
      className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-4"
      style={{ height }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        aria-hidden="true"
        className="chart-svg block overflow-visible font-sans transition-opacity duration-300 ease-out starting:opacity-0 motion-reduce:transition-none"
        style={{ touchAction: "pan-y" }}
      >
        <style>{`.chart-tick{font-size:${TICK.size}px;fill:${CHART_TEXT};font-variant-numeric:tabular-nums}.chart-cat{font-size:${CAT.size}px;fill:#3d3d3d}.chart-value{font-size:12px;font-weight:525;fill:#3d3d3d;font-variant-numeric:tabular-nums}`}</style>
        {body}
      </svg>
      <ChartTooltip datum={datum} bounds={{ width, height }} />
      <div className="sr-only" aria-live="polite">
        {activePoint ? `${activePoint.label}: ${formatFull(activePoint.value, affix)}` : ""}
      </div>
    </div>
  );
}
