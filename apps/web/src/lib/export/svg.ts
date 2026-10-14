/*
 * Standalone SVG export: clone the live SVG, inline the computed presentation
 * styles (so Tailwind classes and CSS variables survive), drop interaction-only
 * layers ([data-export="exclude"]) and paint a white background.
 */

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant-numeric",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "visibility",
] as const;

export interface SerializedSvg {
  svg: string;
  width: number;
  height: number;
}

export interface SerializeOptions {
  background?: string | null;
  /** Extra space around the drawing, in px. */
  padding?: number;
  /** Title drawn above the drawing (15px / 525, kit ink). */
  title?: string;
  /** Font stack for the title; defaults to the page's UI font. */
  fontFamily?: string;
}

const NS = "http://www.w3.org/2000/svg";

function sizeOf(svg: SVGSVGElement): { width: number; height: number; minX: number; minY: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { width: vb.width, height: vb.height, minX: vb.x, minY: vb.y };
  }
  const rect = svg.getBoundingClientRect();
  const w = rect.width || Number(svg.getAttribute("width")) || 600;
  const h = rect.height || Number(svg.getAttribute("height")) || 400;
  return { width: w, height: h, minX: 0, minY: 0 };
}

export function serializeSvg(svg: SVGSVGElement, opts: SerializeOptions = {}): SerializedSvg {
  const { background = "#ffffff", padding = 0, title } = opts;
  const clone = svg.cloneNode(true) as SVGSVGElement;

  const src = [svg, ...Array.from(svg.querySelectorAll<SVGElement>("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll<SVGElement>("*"))];
  const remove: Element[] = [];
  src.forEach((el, i) => {
    const target = dst[i];
    if (!target) return;
    if (el.getAttribute("data-export") === "exclude") {
      remove.push(target);
      return;
    }
    const cs = getComputedStyle(el);
    if (cs.display === "none") {
      remove.push(target);
      return;
    }
    const decl: string[] = [];
    for (const p of STYLE_PROPS) {
      const v = cs.getPropertyValue(p);
      if (v && v !== "normal" && v !== "auto") decl.push(`${p}:${v}`);
    }
    const existing = target.getAttribute("style");
    target.setAttribute("style", existing ? `${existing};${decl.join(";")}` : decl.join(";"));
    target.removeAttribute("class");
    target.removeAttribute("tabindex");
  });
  for (const el of remove) el.remove();

  const { width, height, minX, minY } = sizeOf(svg);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
  clone.style.removeProperty("max-width");
  clone.style.removeProperty("width");
  clone.style.removeProperty("height");
  clone.style.removeProperty("transform");

  const titleH = title ? 40 : 0;
  const W = Math.ceil(width + padding * 2);
  const H = Math.ceil(height + padding * 2 + titleH);
  const outer = document.createElementNS(NS, "svg");
  outer.setAttribute("xmlns", NS);
  outer.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  outer.setAttribute("width", String(W));
  outer.setAttribute("height", String(H));
  outer.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (background) {
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("width", String(W));
    bg.setAttribute("height", String(H));
    bg.setAttribute("fill", background);
    outer.appendChild(bg);
  }
  if (title) {
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", String(padding));
    t.setAttribute("y", String(padding + 16));
    t.setAttribute(
      "style",
      `font-family:${opts.fontFamily ?? getComputedStyle(document.body).fontFamily};font-size:15px;font-weight:525;fill:#1f1f1f`,
    );
    t.textContent = title;
    outer.appendChild(t);
  }
  clone.setAttribute("x", String(padding));
  clone.setAttribute("y", String(padding + titleH));
  outer.appendChild(clone);

  const xml = new XMLSerializer().serializeToString(outer);
  return { svg: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, width: W, height: H };
}

export function svgBlob(s: SerializedSvg): Blob {
  return new Blob([s.svg], { type: "image/svg+xml;charset=utf-8" });
}
