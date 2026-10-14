"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Content-box width of an element, tracked with a ResizeObserver (0 until measured). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** useId made safe for SVG ids and url(#...) references. */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Resolves once web fonts are ready so canvas text measurement matches the render. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => typeof document !== "undefined" && document.fonts?.status === "loaded");
  useEffect(() => {
    if (ready || typeof document === "undefined" || !document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}

/** A boolean that flips back to false after `ms` (for "Copied" ticks). */
export function useFlash(ms = 1600) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, flash] as const;
}
