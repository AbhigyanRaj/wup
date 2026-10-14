"use client";

import { useLayoutEffect, useRef } from "react";

/*
 * HTML tooltip for SVG charts. Positioned in chart pixels (the SVG is drawn at
 * 1:1, no viewBox scaling) and clamped inside the chart box. Value leads, label follows.
 */

export interface TooltipDatum {
  x: number;
  y: number;
  value: string;
  label: string;
  color: string;
  /** "line" draws a short stroke key; "swatch" a small rounded square. */
  key?: "line" | "swatch";
  note?: string;
}

export function ChartTooltip({ datum, bounds }: { datum: TooltipDatum | null; bounds: { width: number; height: number } }) {
  const ref = useRef<HTMLDivElement>(null);

  // Measure, clamp and place the tooltip directly on the DOM node (no extra render).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!datum || !el) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const gap = 12;
    const left = Math.max(0, Math.min(bounds.width - tw, datum.x - tw / 2));
    let top = datum.y - th - gap;
    if (top < 0) top = Math.min(bounds.height - th, datum.y + gap);
    el.style.transform = `translate(${left}px, ${Math.max(0, top)}px)`;
    el.style.opacity = "1";
  }, [datum, bounds.width, bounds.height]);

  if (!datum) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-10 min-w-[96px] max-w-[240px] rounded-[10px] border border-st bg-sf-white px-3 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-opacity duration-100 ease-out"
      style={{ opacity: 0 }}
    >
      <div className="text-[15px] font-medium leading-5 tabular-nums text-tx">{datum.value}</div>
      <div className="mt-1 flex items-center gap-2 text-[12px] leading-4 text-tx-tertiary">
        {datum.key === "swatch" ? (
          <span className="size-2 shrink-0 rounded-[2px]" style={{ background: datum.color }} />
        ) : (
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: datum.color }} />
        )}
        <span className="min-w-0 truncate">{datum.label}</span>
      </div>
      {datum.note ? <div className="mt-1 text-[12px] leading-4 text-tx-muted">{datum.note}</div> : null}
    </div>
  );
}
