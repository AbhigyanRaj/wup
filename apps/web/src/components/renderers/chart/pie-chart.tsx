"use client";

import { useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { arc as d3arc, pie as d3pie, type PieArcDatum } from "d3-shape";
import type { ChartPoint, NormalizedChart } from "@/lib/charts/normalize";
import { formatFull, formatPercent } from "@/lib/charts/format";
import { ellipsize, measureText } from "@/lib/charts/measure-text";
import { CHART_SURFACE } from "@/lib/charts/palette";

/*
 * Donut chart with 2px white separators, a total in the middle, direct percentage
 * labels when there are 4 or fewer slices, and a legend drawn inside the SVG so
 * exports keep it. A single slice is a full ring.
 */

const ROW = 30;

/** White or ink text on a coloured fill, whichever reads better. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const onWhite = 1.05 / (L + 0.05);
  return onWhite >= 3 ? "#ffffff" : "#1f1f1f";
}

export interface PieChartProps {
  chart: NormalizedChart;
  width: number;
  svgRef?: Ref<SVGSVGElement>;
  ariaLabel: string;
}

export function PieChart({ chart, width, svgRef, ariaLabel }: PieChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const { points, affix } = chart;
  const total = points.reduce((s, p) => s + p.value, 0);
  const side = width >= 520;
  // Values that are already percentages make a share column redundant.
  const showPct = affix.suffix !== "%";

  const layout = useMemo(() => {
    const diameter = side ? Math.min(232, width * 0.4) : Math.min(216, width - 32);
    const R = diameter / 2;
    const inner = R * 0.7;
    const gap = 56;
    const legendW = side ? Math.min(340, width - diameter - gap - 16) : width;
    // Centre the donut + legend composition in the card.
    const offset = side ? Math.max(0, (width - (diameter + gap + legendW)) / 2) : 0;
    const cx = side ? offset + R + 8 : width / 2;
    const cy = R + 8;
    const legendX = side ? offset + diameter + gap : 0;
    const legendTop = side ? Math.max(8, cy - (points.length * ROW) / 2) : diameter + 36;
    const height = side ? Math.max(diameter + 16, points.length * ROW + 16) : legendTop + points.length * ROW;
    const pctW = showPct ? 52 : 0;
    const valueW = Math.max(...points.map((p) => measureText(formatFull(p.value, affix), 14, 425))) + 8;
    const labelMax = Math.max(40, legendW - 22 - valueW - pctW - 12);
    return { R, inner, cx, cy, legendX, legendW, legendTop, height, pctW, valueW, labelMax };
  }, [side, width, points, affix, showPct]);

  const arcs = useMemo(() => {
    const gen = d3pie<ChartPoint>()
      .value((p) => p.value)
      .sort(null);
    return gen(points);
  }, [points]);

  const arcGen = d3arc<PieArcDatum<ChartPoint>>().innerRadius(layout.inner).outerRadius(layout.R).cornerRadius(points.length > 1 ? 2 : 0);
  const labelArc = d3arc<PieArcDatum<ChartPoint>>()
    .innerRadius((layout.inner + layout.R) / 2)
    .outerRadius((layout.inner + layout.R) / 2);

  const activePoint = active !== null ? points[active] : null;
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const n = points.length;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = active === null ? 0 : (active + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = active === null ? n - 1 : (active - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
  }

  const showDirect = points.length <= 4;
  const centerValue = activePoint ? formatFull(activePoint.value, affix) : formatFull(total, affix);
  const centerLabel = activePoint ? ellipsize(activePoint.label, layout.inner * 1.5, 12) : "Total";

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
      style={{ height: layout.height }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={layout.height}
        aria-hidden="true"
        className="block overflow-visible font-sans transition-opacity duration-300 ease-out starting:opacity-0 motion-reduce:transition-none"
      >
        <g transform={`translate(${layout.cx},${layout.cy})`}>
          {arcs.map((a, i) => (
            <path
              key={a.data.key}
              d={arcGen(a) ?? ""}
              fill={a.data.color}
              stroke={CHART_SURFACE}
              strokeWidth={points.length > 1 ? 2 : 0}
              opacity={active !== null && active !== i ? 0.35 : 1}
              className="transition-opacity duration-150 ease-out"
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
          {showDirect
            ? arcs.map((a) => {
                const share = a.data.value / total;
                if (share < 0.06 || points.length === 1) return null;
                const [lx, ly] = labelArc.centroid(a);
                return (
                  <text
                    key={`l-${a.data.key}`}
                    x={lx}
                    y={ly}
                    dy="0.35em"
                    textAnchor="middle"
                    pointerEvents="none"
                    style={{ fontSize: 12, fontWeight: 525, fill: inkOn(a.data.color ?? "#2563EB"), fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatPercent(share)}
                  </text>
                );
              })
            : null}
          <text textAnchor="middle" y={-4} style={{ fontSize: 22, fontWeight: 525, fill: "#1f1f1f", letterSpacing: "-0.01em" }}>
            {centerValue}
          </text>
          <text textAnchor="middle" y={16} style={{ fontSize: 12, fill: "#666666" }}>
            {centerLabel}
          </text>
        </g>

        <g transform={`translate(${layout.legendX},${layout.legendTop})`}>
          {points.map((p, i) => {
            const y = i * ROW;
            const dim = active !== null && active !== i;
            return (
              <g
                key={p.key}
                transform={`translate(0,${y})`}
                opacity={dim ? 0.45 : 1}
                className="transition-opacity duration-150 ease-out"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
              >
                <rect data-export="exclude" x={-6} y={0} width={layout.legendW + 6} height={ROW} rx={8} fill={active === i ? "#f5f5f5" : "transparent"} />
                <rect x={0} y={ROW / 2 - 5} width={10} height={10} rx={3} fill={p.color} />
                <text x={20} y={ROW / 2} dy="0.35em" style={{ fontSize: 14, fill: "#3d3d3d" }}>
                  {ellipsize(p.other ? `Other (${p.count})` : p.label, layout.labelMax, 14)}
                </text>
                <text
                  x={layout.legendW - layout.pctW - 4}
                  y={ROW / 2}
                  dy="0.35em"
                  textAnchor="end"
                  style={{ fontSize: 14, fill: "#1f1f1f", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatFull(p.value, affix)}
                </text>
                {showPct ? (
                  <text
                    x={layout.legendW - 4}
                    y={ROW / 2}
                    dy="0.35em"
                    textAnchor="end"
                    style={{ fontSize: 13, fill: "#666666", fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatPercent(p.value / total)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="sr-only" aria-live="polite">
        {activePoint ? `${activePoint.label}: ${formatFull(activePoint.value, affix)}, ${formatPercent(activePoint.value / total)}` : ""}
      </div>
    </div>
  );
}
