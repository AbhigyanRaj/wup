/*
 * Mermaid loader and render service.
 * - One dynamic import, initialised once (strict security, light "base" theme).
 * - Renders run one at a time through a queue (mermaid.render is not re-entrant).
 * - Results (SVG or error) live in a 50-entry LRU keyed by a hash of the cleaned code,
 *   so re-mounts, history scrolls and identical diagrams never render twice.
 * - Every SVG is rendered with a placeholder id; callers swap it for their own
 *   useId-based id so two copies of one diagram never share DOM ids.
 */

type MermaidAPI = (typeof import("mermaid"))["default"];

let loader: Promise<MermaidAPI> | null = null;

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function ensureMermaid(): Promise<MermaidAPI> {
  if (loader) return loader;
  loader = import("mermaid")
    .then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          primaryColor: "#ffffff",
          primaryBorderColor: "#e6e6e6",
          primaryTextColor: "#1f1f1f",
          lineColor: "#b3b3b3",
          secondaryColor: "#e8effc",
          tertiaryColor: "#f5f5f5",
          clusterBkg: "#fafafa",
          clusterBorder: "#f0f0f0",
          edgeLabelBackground: "#ffffff",
          textColor: "#1f1f1f",
          noteBkgColor: "#fafcff",
          noteBorderColor: "#d2dff9",
          actorBkg: "#ffffff",
          actorBorder: "#e6e6e6",
          actorTextColor: "#1f1f1f",
          actorLineColor: "#e6e6e6",
          signalColor: "#666666",
          signalTextColor: "#1f1f1f",
          labelBoxBkgColor: "#ffffff",
          labelBoxBorderColor: "#e6e6e6",
          activationBkgColor: "#e8effc",
          activationBorderColor: "#d2dff9",
          fontFamily: cssVar("--font-sans", "system-ui, sans-serif"),
          fontSize: "14px",
        },
        themeCSS: [
          ".node rect, .node polygon, .node path { stroke-width: 1px; }",
          ".node rect { rx: 10px; ry: 10px; }",
          ".edgeLabel, .edgeLabel p { color: #666666; font-size: 12px; }",
          ".edgeLabel rect { rx: 6px; ry: 6px; }",
          ".cluster rect { rx: 14px; ry: 14px; }",
          "rect.actor { rx: 10px; ry: 10px; stroke-width: 1px; }",
          ".messageText { font-size: 14px !important; }",
          ".actor > tspan, text.actor { font-size: 14px !important; }",
        ].join("\n"),
        flowchart: { curve: "basis", htmlLabels: false, padding: 16, nodeSpacing: 32, rankSpacing: 48 },
        sequence: { useMaxWidth: true, messageFontSize: 14, actorFontSize: 14, noteFontSize: 13, mirrorActors: false },
      });
      return mermaid;
    })
    .catch((err: unknown) => {
      loader = null;
      throw err;
    });
  return loader;
}

/* ---------------------------------------------------------------------------
 * Source repair (kept from the original renderer)
 * ------------------------------------------------------------------------- */

/** Quote bracket labels that contain characters Mermaid treats as syntax. */
export function sanitizeMermaid(code: string): string {
  return code
    .replace(/\[([^\]"]*[()/\\&|<>][^\]"]*)\]/g, '["$1"]')
    .replace(/\{([^}"]*[()/\\&|<>][^}"]*)\}/g, '{"$1"}');
}

/**
 * Fixes the common LLM mistake of putting classDef lines BEFORE the graph type
 * declaration. Mermaid wants: graph type first, then nodes and edges, then classDef.
 */
export function fixClassDefOrder(code: string): string {
  const lines = code.split("\n");
  const classDefLines: string[] = [];
  const otherLines: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("classDef ")) classDefLines.push(line);
    else otherLines.push(line);
  }
  return classDefLines.length > 0 ? [...otherLines, ...classDefLines].join("\n") : code;
}

export function cleanMermaid(code: string): string {
  return fixClassDefOrder(sanitizeMermaid(code.trim()));
}

/* ---------------------------------------------------------------------------
 * Hash, LRU cache and queue
 * ------------------------------------------------------------------------- */

/** FNV-1a, 32 bit, base 36. */
export function hashCode(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export type MermaidResult =
  | { ok: true; svg: string; token: string; width: number; height: number }
  | { ok: false; error: string };

const CACHE_MAX = 50;
const cache = new Map<string, MermaidResult>();

function cacheGet(key: string): MermaidResult | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: MermaidResult) {
  cache.set(key, value);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** Synchronous cache peek, so a re-mount can paint the SVG on the first frame. */
export function peekMermaid(code: string): MermaidResult | undefined {
  return cacheGet(hashCode(cleanMermaid(code)));
}

let queue: Promise<unknown> = Promise.resolve();
const inflight = new Map<string, Promise<MermaidResult>>();

function countRender() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const w = window as unknown as { __wuup?: { mermaidRenders?: number } };
  w.__wuup ??= {};
  w.__wuup.mermaidRenders = (w.__wuup.mermaidRenders ?? 0) + 1;
}

function svgSize(svg: string): { width: number; height: number } {
  const vb = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(svg);
  if (vb) return { width: Number(vb[3]), height: Number(vb[4]) };
  return { width: 600, height: 400 };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  const maybe = err as { message?: unknown; str?: unknown } | null;
  return String(maybe?.message ?? maybe?.str ?? "Invalid diagram");
}

export function renderMermaid(code: string): Promise<MermaidResult> {
  const clean = cleanMermaid(code);
  const key = hashCode(clean);
  const hit = cacheGet(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = queue
    .catch(() => undefined)
    .then(async (): Promise<MermaidResult> => {
      const mermaid = await ensureMermaid();
      const token = `wuupm${key}`;
      try {
        await mermaid.parse(clean);
        const { svg } = await mermaid.render(token, clean);
        countRender();
        return { ok: true, svg, token, ...svgSize(svg) };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      } finally {
        // Mermaid can leave its scratch container behind on failure.
        document.getElementById(`d${token}`)?.remove();
        document.getElementById(token)?.remove();
      }
    })
    .then((result) => {
      cacheSet(key, result);
      inflight.delete(key);
      return result;
    });
  queue = job;
  inflight.set(key, job);
  return job;
}

/** Swap the placeholder id for an instance id (must be a valid CSS id). */
export function instanceSvg(result: Extract<MermaidResult, { ok: true }>, instanceId: string): string {
  return result.svg.split(result.token).join(instanceId);
}
