/*
 * Canvas text measurement for SVG layout (axis gutters, label thinning, diagram
 * wrapping). Falls back to a width estimate when there is no DOM (tests, SSR).
 */

let ctx: CanvasRenderingContext2D | null | undefined;
let family: string | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  if (typeof document === "undefined") return (ctx = null);
  ctx = document.createElement("canvas").getContext("2d");
  return ctx;
}

/** The resolved UI font stack (Figtree via next/font), read once from <body>. */
export function uiFontFamily(): string {
  if (family) return family;
  if (typeof document === "undefined") return "system-ui, sans-serif";
  family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  return family;
}

export function measureText(text: string, size = 12, weight = 425): number {
  const c = context();
  if (!c) return text.length * size * 0.56;
  c.font = `${weight} ${size}px ${uiFontFamily()}`;
  return c.measureText(text).width;
}

/** Cut `text` with an ellipsis so it fits in `max` px. */
export function ellipsize(text: string, max: number, size = 12, weight = 425): string {
  if (max <= 0) return "";
  if (measureText(text, size, weight) <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureText(`${text.slice(0, mid).trimEnd()}…`, size, weight) <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "…" : `${text.slice(0, lo).trimEnd()}…`;
}

/**
 * Greedy word wrap to `max` px, at most `maxLines` lines; the last line gets an
 * ellipsis when text remains. Words longer than a line are hard-broken.
 */
export function wrapText(text: string, max: number, maxLines: number, size = 14, weight = 425): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let i = 0;
  while (i < words.length) {
    const word = words[i];
    const candidate = line ? `${line} ${word}` : word;
    if (measureText(candidate, size, weight) <= max) {
      line = candidate;
      i++;
      continue;
    }
    if (!line) {
      // A single word wider than the line: hard-break it.
      let cut = word.length - 1;
      while (cut > 1 && measureText(word.slice(0, cut), size, weight) > max) cut--;
      lines.push(word.slice(0, cut));
      words[i] = word.slice(cut);
    } else {
      lines.push(line);
      line = "";
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    line = "";
  }
  const rest = [line, ...words.slice(i)].filter(Boolean).join(" ");
  if (rest && lines.length === maxLines) {
    lines[maxLines - 1] = ellipsize(`${lines[maxLines - 1]} ${rest}`, max, size, weight);
  }
  return lines.length ? lines : [""];
}
