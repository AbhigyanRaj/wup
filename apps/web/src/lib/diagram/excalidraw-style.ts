/*
 * The wuup look for Excalidraw scenes: clean (roughness 0), a plain sans font,
 * hairline strokes and kit fills by node kind. Works on the converter's element
 * skeletons (before Excalidraw measures text), so it stays a pure function with
 * no Excalidraw runtime import and is unit tested on plain objects.
 */

import type { DiagramKind } from "./normalize";

/** Excalidraw FONT_FAMILY.Helvetica: a system sans, no web font download. */
export const DIAGRAM_FONT_FAMILY = 2;
export const DIAGRAM_FONT_SIZE = 16;
export const DIAGRAM_EDGE_FONT_SIZE = 14;

export const INK = "#1f1f1f";
export const LINE = "#b3b3b3";
export const MUTED_TEXT = "#666666";
export const CANVAS_BG = "#ffffff";

export const KIND_STYLE: Record<DiagramKind, { fill: string; stroke: string }> = {
  start: { fill: "#f9f9f9", stroke: LINE },
  end: { fill: "#f9f9f9", stroke: LINE },
  action: { fill: "#ffffff", stroke: LINE },
  decision: { fill: "#e8effc", stroke: "#a7c0f1" },
  success: { fill: "#f2f8eb", stroke: "#acd587" },
  error: { fill: "#fde7e2", stroke: "#eba18f" },
};

/**
 * Mermaid theme for the converter's render pass. Sequence, class and state
 * diagrams read colours back from that SVG, and unsupported types become an
 * image of it, so this keeps both on the kit palette.
 */
export const MERMAID_THEME = {
  theme: "base",
  themeVariables: {
    fontFamily: "Helvetica, Arial, sans-serif",
    primaryColor: "#ffffff",
    primaryBorderColor: LINE,
    primaryTextColor: INK,
    secondaryColor: "#e8effc",
    tertiaryColor: "#f9f9f9",
    lineColor: MUTED_TEXT,
    textColor: INK,
    mainBkg: "#ffffff",
    nodeBorder: LINE,
    clusterBkg: "#f9f9f9",
    clusterBorder: "#e6e6e6",
    edgeLabelBackground: "#ffffff",
    actorBkg: "#ffffff",
    actorBorder: LINE,
    actorTextColor: INK,
    actorLineColor: LINE,
    signalColor: MUTED_TEXT,
    signalTextColor: INK,
    labelBoxBkgColor: "#ffffff",
    labelBoxBorderColor: LINE,
    activationBkgColor: "#e8effc",
    activationBorderColor: "#a7c0f1",
    noteBkgColor: "#fff8e6",
    noteBorderColor: "#ffcb79",
    noteTextColor: INK,
    pie1: "#2563eb",
    pie2: "#6ea335",
    pie3: "#556adc",
    pie4: "#df9c2a",
    pie5: "#38bdf8",
    pieStrokeColor: "#ffffff",
    pieOuterStrokeColor: "#e6e6e6",
    pieTitleTextColor: INK,
    pieSectionTextColor: "#ffffff",
    pieLegendTextColor: INK,
  },
} as const;

type Skeleton = Record<string, unknown> & { type: string };

/* Mermaid default-theme colours that leak through some converters. */
const DEFAULT_FILLS: Record<string, string> = {
  "#eaeaea": "#ffffff",
  "#ececff": "#ffffff",
  "#e9ecef": "#f0f0f0",
  "#f4f4f4": "#f9f9f9",
  "#ffffde": "#f9f9f9",
  "#fff5ad": "#fff8e6",
};
const DEFAULT_STROKES = new Set(["#000", "#000000", "black", "#333", "#333333", "#666", "#666666", "#9370db", "#aaaa33", "#ccc"]);
const DEFAULT_TEXT = new Set(["#000", "#000000", "black", "#333", "#333333"]);

const CONTAINERS = new Set(["rectangle", "diamond", "ellipse"]);
const TRANSPARENT = new Set(["", "transparent", "none", "#00000000"]);

/** Mermaid labels can carry `<br/>`, `<small>` and friends. Excalidraw wants plain text. */
export function plainLabel(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function isColor(v: unknown): v is string {
  return typeof v === "string" && !TRANSPARENT.has(v.trim().toLowerCase());
}

/** True when a converter result is the image fallback (unsupported diagram type). */
export function isImageScene(elements: ReadonlyArray<{ type: string }>): boolean {
  return elements.length > 0 && elements.every((e) => e.type === "image");
}

/**
 * Restyle converter skeletons. `kinds` maps Mermaid node ids to DiagramData
 * kinds (only for scenes built from diagramData); other scenes keep any
 * classDef fills and fall back to white nodes.
 */
export function styleSkeletons<T extends Skeleton>(elements: readonly T[], kinds?: ReadonlyMap<string, DiagramKind>): T[] {
  return elements.map((raw) => {
    const el: Skeleton = { ...raw, roughness: 0 };
    const id = typeof el.id === "string" ? el.id : undefined;
    const kind = id ? kinds?.get(id) : undefined;

    if (CONTAINERS.has(el.type)) {
      const style = KIND_STYLE[kind ?? "action"];
      el.strokeWidth = 1;
      el.fillStyle = "solid";
      el.strokeStyle = el.strokeStyle === "dashed" ? "dashed" : "solid";
      if (kind) {
        el.backgroundColor = style.fill;
        el.strokeColor = style.stroke;
      } else {
        const fill = isColor(el.backgroundColor) ? el.backgroundColor.toLowerCase() : "#ffffff";
        el.backgroundColor = DEFAULT_FILLS[fill] ?? fill;
        const stroke = isColor(el.strokeColor) ? el.strokeColor.toLowerCase() : "";
        el.strokeColor = stroke && !DEFAULT_STROKES.has(stroke) ? stroke : LINE;
      }
      if (el.type === "rectangle") el.roundness = { type: 3 };
    } else if (el.type === "arrow" || el.type === "line") {
      el.strokeColor = el.type === "arrow" ? MUTED_TEXT : LINE;
      el.strokeWidth = 1;
      // Dotted arrowheads look broken; dashed reads as "reply" just as well.
      if (el.strokeStyle === "dotted") el.strokeStyle = "dashed";
      if (el.type === "arrow") el.roundness = { type: 2 };
    } else if (el.type === "text") {
      el.fontFamily = DIAGRAM_FONT_FAMILY;
      if (typeof el.text === "string") el.text = plainLabel(el.text);
      if (!isColor(el.strokeColor) || DEFAULT_TEXT.has(el.strokeColor.toLowerCase())) el.strokeColor = INK;
    }

    const label = el.label as Record<string, unknown> | undefined;
    if (label && typeof label.text === "string") {
      const isEdge = el.type === "arrow" || el.type === "line";
      el.label = {
        ...label,
        text: plainLabel(label.text),
        fontFamily: DIAGRAM_FONT_FAMILY,
        fontSize: isEdge ? DIAGRAM_EDGE_FONT_SIZE : label.fontSize ?? DIAGRAM_FONT_SIZE,
        strokeColor: isEdge ? MUTED_TEXT : isColor(label.strokeColor) && !DEFAULT_TEXT.has(label.strokeColor.toLowerCase()) ? label.strokeColor : INK,
      };
    }
    return el as T;
  });
}

/** Final pass on created elements: nothing sketchy survives (bound labels included). */
export function finishElements<T extends { type: string; roughness?: number }>(elements: readonly T[]): T[] {
  return elements.map((e) => (e.roughness === 0 ? e : { ...e, roughness: 0 }));
}
