"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";

/*
 * Zoom and pan surface for expanded diagrams. Drag to pan, Ctrl/Cmd + wheel or
 * pinch to zoom, + / - / 0 on the keyboard. Starts fitted to the viewport.
 */

const MIN = 0.2;
const MAX = 4;

export function ZoomPan({
  width,
  height,
  children,
  className,
}: {
  /** Natural content size in px. */
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el || !width || !height) return;
    const pad = 32;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const k = Math.min(MAX, Math.max(MIN, Math.min((vw - pad * 2) / width, (vh - pad * 2) / height, 1.5)));
    setView({ k, x: (vw - width * k) / 2, y: (vh - height * k) / 2 });
  }, [width, height]);

  useEffect(() => {
    fit();
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = viewport.current;
    if (!el) return;
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    setView((v) => {
      const k = Math.min(MAX, Math.max(MIN, v.k * factor));
      const r = k / v.k;
      return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  return (
    <div className={cn("relative h-full min-h-[320px] w-full overflow-hidden rounded-xl bg-[#fcfcfc]", className)}>
      <div
        ref={viewport}
        role="application"
        aria-label="Zoomable diagram. Drag to pan, plus and minus keys to zoom, 0 to fit"
        tabIndex={0}
        className="absolute inset-0 cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-inset active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(circle, #e6e6e6 1px, transparent 1px)",
          backgroundSize: `${20 * view.k}px ${20 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          drag.current = { id: d.id, x: e.clientX, y: e.clientY };
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = 40;
          if (e.key === "+" || e.key === "=") zoomAt(1.2);
          else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.2);
          else if (e.key === "0") fit();
          else if (e.key === "ArrowLeft") setView((v) => ({ ...v, x: v.x + step }));
          else if (e.key === "ArrowRight") setView((v) => ({ ...v, x: v.x - step }));
          else if (e.key === "ArrowUp") setView((v) => ({ ...v, y: v.y + step }));
          else if (e.key === "ArrowDown") setView((v) => ({ ...v, y: v.y - step }));
          else return;
          e.preventDefault();
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          {children}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full border border-st bg-sf-white p-1 shadow-card">
        <IconButton size="sm" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}>
          <Minus aria-hidden="true" strokeWidth={1.5} />
        </IconButton>
        <span className="min-w-12 text-center text-[12px] font-medium tabular-nums text-tx-tertiary" aria-live="polite">
          {Math.round(view.k * 100)}%
        </span>
        <IconButton size="sm" aria-label="Zoom in" onClick={() => zoomAt(1.25)}>
          <Plus aria-hidden="true" strokeWidth={1.5} />
        </IconButton>
        <IconButton size="sm" aria-label="Fit to screen" onClick={fit}>
          <Scan aria-hidden="true" strokeWidth={1.5} />
        </IconButton>
      </div>
    </div>
  );
}
