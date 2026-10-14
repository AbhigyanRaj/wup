"use client";

import { useEffect, useRef } from "react";

/*
 * The contact page's dark "glyph field" (kit contact.md 2.2), recoloured to
 * deep indigo. A dense monospaced grid of query tokens on a near-black ground;
 * brighter glyphs form a faint bar-chart silhouette in the middle third, and
 * a few cells twinkle over time. Decorative: aria-hidden, no pointer events.
 * It pauses when the tab is hidden or the panel is off screen, and draws a
 * single still frame under prefers-reduced-motion.
 */

const PITCH = 13;
const GLYPHS = "{}[]():,$01234567890abcdefghijklmnopqrstuvwxyz<>=.*#".split("");
const TOKENS = ["$match", "$group", "find", "sum", "avg", "rows", "id", "$sort", "date", "city"];
const DIM = ["rgba(43,59,176,0.55)", "rgba(66,80,213,0.45)", "rgba(66,80,213,0.35)", "rgba(106,136,226,0.5)"];
const BRIGHT = ["rgba(106,136,226,0.85)", "rgba(66,80,213,0.95)", "rgba(125,211,252,0.7)"];
const WHITE = "rgba(232,239,252,0.95)";

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function GlyphField({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cols = 0;
    let rows = 0;
    let cells: Array<{ ch: string; color: string; bright: boolean }> = [];
    let size = { w: 0, h: 0 };
    let raf = 0;
    let last = 0;
    let onScreen = true;

    // Bar-chart silhouette: five bars rising from a baseline in the middle third.
    const inShape = (cx: number, cy: number) => {
      // Short bands (the mobile title strip) skip the silhouette so the title stays legible.
      if (size.h < 400) return false;
      const x = cx / cols;
      const y = cy / rows;
      const base = 0.68;
      const bars = [
        [0.2, 0.3, 0.52],
        [0.34, 0.44, 0.42],
        [0.48, 0.58, 0.3],
        [0.62, 0.72, 0.38],
        [0.76, 0.86, 0.22],
      ];
      return bars.some(([a, b, top]) => x >= a && x <= b && y >= top && y <= base) || (y > base && y < base + 0.012 && x > 0.15 && x < 0.9);
    };

    const pick = (cx: number, cy: number, salt = 0) => {
      const r = hash(cx + salt * 7.3, cy - salt * 3.1);
      const shape = inShape(cx, cy);
      if (r < 0.32 && !shape) return { ch: "", color: "", bright: false };
      const ch = GLYPHS[Math.floor(hash(cx * 3.7 + salt, cy * 1.9) * GLYPHS.length)]!;
      if (shape) {
        const w = hash(cy, cx + salt);
        return { ch, color: w > 0.93 ? WHITE : BRIGHT[Math.floor(w * BRIGHT.length) % BRIGHT.length]!, bright: true };
      }
      return { ch, color: r > 0.995 ? WHITE : DIM[Math.floor(r * 97) % DIM.length]!, bright: false };
    };

    const build = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      size = { w: rect.width, h: rect.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(rect.width / PITCH);
      rows = Math.ceil(rect.height / PITCH);
      cells = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push(pick(x, y));
      // Sprinkle a few whole tokens along random rows.
      for (let i = 0; i < Math.floor(rows / 3); i++) {
        const y = Math.floor(hash(i, 99) * rows);
        const x = Math.floor(hash(99, i) * cols);
        const t = TOKENS[i % TOKENS.length]!;
        for (let k = 0; k < t.length && x + k < cols; k++) {
          const c = cells[y * cols + x + k];
          if (c && !c.bright) cells[y * cols + x + k] = { ch: t[k]!, color: DIM[3]!, bright: false };
        }
      }
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.font = `10px ui-monospace, "DM Mono", SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const c = cells[y * cols + x];
          if (!c || !c.ch) continue;
          ctx.fillStyle = c.color;
          ctx.fillText(c.ch, x * PITCH + 2, y * PITCH + 1);
        }
      }
    };

    let tick = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!onScreen || document.hidden || t - last < 110) return;
      last = t;
      tick++;
      // Twinkle about 0.6% of cells per frame.
      const n = Math.max(4, Math.floor(cells.length * 0.006));
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * cells.length);
        cells[idx] = pick(idx % cols, Math.floor(idx / cols), tick + i);
      }
      draw();
    };

    build();
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      if (Math.abs(r.width - size.w) > 1 || Math.abs(r.height - size.h) > 1) build();
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
    });
    io.observe(wrap);
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="pointer-events-none block h-full w-full" />
    </div>
  );
}
