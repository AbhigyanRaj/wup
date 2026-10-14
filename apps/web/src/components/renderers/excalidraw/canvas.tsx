"use client";

import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, MainMenu, getSceneVersion } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { cn } from "@/lib/cn";
import { CANVAS_BG, DIAGRAM_FONT_FAMILY, INK } from "@/lib/diagram/excalidraw-style";
import type { DiagramScene } from "./types";
import styles from "./excalidraw.module.css";

/*
 * The Excalidraw canvas (lazy chunk). "view": read-only, no chrome, fitted to
 * the content, refitted on resize. "edit": the full editor, starting from the
 * same scene with clean defaults (no sketchiness, sans font, ink strokes).
 */

export interface DiagramCanvasProps {
  scene: DiagramScene;
  mode: "view" | "edit";
  onApi?: (api: ExcalidrawImperativeAPI) => void;
  /** Zoom level after each fit (the inline card hints "open to zoom" when small). */
  onFit?: (zoom: number) => void;
  /** Editor only: fires when the elements actually change (not on selection or scroll). */
  onSceneChange?: (scene: DiagramScene) => void;
  className?: string;
}

const VIEW_UI = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false as const,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: null,
    saveAsImage: false,
  },
  tools: { image: false },
};

const EDIT_UI = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: true,
    export: false as const,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: null,
    saveAsImage: false,
  },
  tools: { image: false },
};

function noTopRight() {
  return null;
}

export function DiagramCanvas({ scene, mode, onApi, onFit, onSceneChange, className }: DiagramCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const shown = useRef(scene);
  const view = mode === "view";

  // initialData is read once; later scene changes go through updateScene.
  const [initialData] = useState(() => ({
    elements: scene.elements,
    files: scene.files,
    scrollToContent: true,
    appState: {
      viewBackgroundColor: CANVAS_BG,
      theme: "light" as const,
      currentItemFontFamily: DIAGRAM_FONT_FAMILY as 2,
      currentItemRoughness: 0,
      currentItemStrokeColor: INK,
      currentItemStrokeWidth: 1,
      currentItemRoundness: "round" as const,
      currentItemFontSize: 16,
      gridModeEnabled: false,
    },
  }));

  const fit = useCallback(() => {
    if (!api) return;
    api.refresh();
    api.scrollToContent(undefined, { fitToContent: true, viewportZoomFactor: view ? 0.92 : 0.85, animate: false, minZoom: 0.1 });
    if (onFit) requestAnimationFrame(() => onFit(api.getAppState().zoom.value));
  }, [api, view, onFit]);

  // Excalidraw calls onChange for every pointer move; only element edits count.
  const version = useRef<number | null>(null);
  const handleChange = useCallback(
    (elements: readonly DiagramScene["elements"][number][], _state: unknown, files: DiagramScene["files"]) => {
      if (!onSceneChange) return;
      const v = getSceneVersion(elements);
      if (version.current === null) {
        version.current = v;
        return;
      }
      if (v === version.current) return;
      version.current = v;
      onSceneChange({ elements, files, image: scene.image });
    },
    [onSceneChange, scene.image],
  );

  const handleApi = useCallback(
    (a: ExcalidrawImperativeAPI) => {
      setApi(a);
      onApi?.(a);
    },
    [onApi],
  );

  // First fit once the scene has loaded (initialData resolves a tick later).
  useEffect(() => {
    if (!api) return;
    let raf = 0;
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(fit);
    }, 30);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [api, fit]);

  // The inline view keeps the whole diagram in frame as the column resizes.
  useEffect(() => {
    if (!api || !view || !wrap.current) return;
    let raf = 0;
    let last = wrap.current.getBoundingClientRect().width;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(w - last) < 1) return;
      last = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(wrap.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [api, view, fit]);

  // Edits made in the fullscreen editor flow back into the inline view.
  useEffect(() => {
    if (!api || shown.current === scene) return;
    shown.current = scene;
    const files = Object.values(scene.files);
    if (files.length) api.addFiles(files);
    api.updateScene({ elements: scene.elements });
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [api, scene, fit]);

  return (
    <div ref={wrap} className={cn(styles.root, view ? styles.view : styles.edit, className)}>
      <Excalidraw
        excalidrawAPI={handleApi}
        initialData={initialData}
        onChange={view ? undefined : handleChange}
        viewModeEnabled={view}
        zenModeEnabled={view}
        gridModeEnabled={false}
        theme="light"
        name="wuup diagram"
        UIOptions={view ? VIEW_UI : EDIT_UI}
        renderTopRightUI={noTopRight}
        detectScroll={!view}
        handleKeyboardGlobally={false}
        autoFocus={!view}
        aiEnabled={false}
      >
        <MainMenu>
          {view ? null : (
            <>
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.DefaultItems.Help />
            </>
          )}
        </MainMenu>
      </Excalidraw>
    </div>
  );
}

export default DiagramCanvas;
