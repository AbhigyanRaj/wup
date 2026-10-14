/*
 * Heavy half of the diagram renderer: Mermaid to Excalidraw conversion and
 * PNG/SVG export. Only ever loaded with a dynamic import() once a diagram is on
 * screen, so neither Excalidraw nor mermaid lands in the chat bundle.
 */

import { convertToExcalidrawElements, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import type { DiagramKind } from "@/lib/diagram/normalize";
import { CANVAS_BG, DIAGRAM_FONT_SIZE, MERMAID_THEME, finishElements, isImageScene, styleSkeletons } from "@/lib/diagram/excalidraw-style";
import type { DiagramScene } from "./types";

type Skeleton = Parameters<typeof convertToExcalidrawElements>[0] extends (infer A)[] | null ? A : never;

export async function convertMermaid(code: string, kinds?: ReadonlyMap<string, DiagramKind>): Promise<DiagramScene> {
  // The converter spreads its config into mermaid.initialize, so the kit theme
  // rides along even though its MermaidConfig type only names fontSize.
  const config = {
    ...MERMAID_THEME,
    themeVariables: { ...MERMAID_THEME.themeVariables, fontSize: `${DIAGRAM_FONT_SIZE}px` },
    securityLevel: "strict",
    maxEdges: 1000,
    maxTextSize: 100_000,
  };
  const { elements, files } = await parseMermaidToExcalidraw(code, config as Parameters<typeof parseMermaidToExcalidraw>[1]);
  const styled = styleSkeletons(elements as unknown as Array<Skeleton & { type: string }>, kinds);
  const scene = finishElements(convertToExcalidrawElements(styled as Skeleton[]));
  return { elements: scene, files: files ?? {}, image: isImageScene(scene) };
}

const EXPORT_APP_STATE = {
  exportBackground: true,
  viewBackgroundColor: CANVAS_BG,
  exportWithDarkMode: false,
  exportEmbedScene: false,
} as const;

function live(scene: DiagramScene) {
  return scene.elements.filter((e) => !e.isDeleted);
}

export async function exportPng(scene: DiagramScene): Promise<Blob> {
  return exportToBlob({
    elements: live(scene),
    files: scene.files,
    mimeType: "image/png",
    exportPadding: 24,
    appState: { ...EXPORT_APP_STATE, exportScale: 2 },
    // exportToBlob ignores exportScale; retina output comes from getDimensions.
    getDimensions: (width: number, height: number) => ({ width: width * 2, height: height * 2, scale: 2 }),
  });
}

export async function exportSvg(scene: DiagramScene): Promise<Blob> {
  const svg = await exportToSvg({
    elements: live(scene),
    files: scene.files,
    exportPadding: 24,
    appState: { ...EXPORT_APP_STATE, exportScale: 1 },
  });
  const text = new XMLSerializer().serializeToString(svg);
  return new Blob([text], { type: "image/svg+xml;charset=utf-8" });
}
