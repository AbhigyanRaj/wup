"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Download, FileCode2, X } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { overlayClass, useReturnFocus } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { DiagramCanvas } from "./canvas";
import type { DiagramScene } from "./types";

/*
 * Fullscreen diagram editor (lazy chunk). The full Excalidraw editor on a
 * near-fullscreen sheet: drag, add shapes and arrows, edit text. Edits stay in
 * component state and flow back to the inline view on close. With `save`,
 * changes autosave 1.2s after the last edit and again on close, with a quiet
 * status in the header; without it the header says "Not saved". Esc first goes to
 * Excalidraw (finish text, drop selection, back to the select tool) and only
 * closes the sheet when there is nothing left to cancel.
 */

export interface DiagramEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  scene: DiagramScene;
  /** Called with the edited scene when the editor closes. */
  onCommit: (scene: DiagramScene) => void;
  onExport: (scene: DiagramScene, kind: "png" | "svg") => void;
  copyAction?: ReactNode;
  /** Persist a scene. Omitted when edits can't be saved (gallery, demo). */
  save?: (scene: DiagramScene) => Promise<void>;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
const AUTOSAVE_MS = 1200;

function SaveStatus({ state, canSave }: { state: SaveState; canSave: boolean }) {
  const label = !canSave
    ? "Not saved"
    : state === "saving" || state === "dirty"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Couldn't save"
          : "";
  return (
    <span
      role="status"
      aria-live="polite"
      data-save-state={canSave ? state : "local"}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-[13px] leading-5",
        state === "error" ? "text-red-400" : "text-tx-tertiary",
        !label && "invisible",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          !canSave ? "bg-grey-400" : state === "error" ? "bg-red-400" : state === "saved" || state === "idle" ? "bg-green-500" : "bg-indigo-400 motion-safe:animate-pulse",
        )}
      />
      {label || "Saved"}
    </span>
  );
}

function busy(api: ExcalidrawImperativeAPI | null): boolean {
  if (!api) return false;
  const s = api.getAppState();
  return Boolean(
    s.editingTextElement ||
      s.newElement ||
      s.editingLinearElement ||
      s.openMenu ||
      s.openPopup ||
      s.openDialog ||
      s.contextMenu ||
      s.activeTool.type !== "selection" ||
      Object.keys(s.selectedElementIds).length > 0,
  );
}

function sceneOf(api: ExcalidrawImperativeAPI | null, fallback: DiagramScene): DiagramScene {
  if (!api) return fallback;
  return { elements: api.getSceneElements(), files: api.getFiles(), image: fallback.image };
}

const pill =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium leading-5 text-tx transition-colors duration-200 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 [&_svg]:size-4 [&_svg]:shrink-0";

export function DiagramEditor({ open, onOpenChange, title, scene, onCommit, onExport, copyAction, save }: DiagramEditorProps) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const focus = useReturnFocus();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const pending = useRef<DiagramScene | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!save || !next) return;
    pending.current = null;
    const mine = ++seq.current;
    setSaveState("saving");
    save(next).then(
      () => {
        if (mine === seq.current) setSaveState(pending.current ? "dirty" : "saved");
      },
      () => {
        if (mine === seq.current) setSaveState("error");
      },
    );
  }, [save]);

  const onSceneChange = useCallback(
    (next: DiagramScene) => {
      if (!save) return;
      pending.current = next;
      setSaveState("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [save, flush],
  );

  // Never drop an edit: an unmount with a pending save still sends it.
  useEffect(() => () => flush(), [flush]);

  const close = (next: boolean) => {
    if (!next) {
      if (pending.current) pending.current = sceneOf(api.current, scene);
      flush();
      onCommit(sceneOf(api.current, scene));
    }
    onOpenChange(next);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn(overlayClass, "motion-safe:animate-[backdrop-fade_160ms_ease-out]")} />
        <DialogPrimitive.Content
          {...focus}
          onEscapeKeyDown={(e) => {
            // Esc inside the canvas belongs to Excalidraw while there is something
            // to cancel; from the header buttons it always closes.
            const inCanvas = e.target instanceof Element && e.target.closest(".excalidraw");
            if (inCanvas && busy(api.current)) e.preventDefault();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          className={cn(
            "fixed inset-0 z-[101] flex flex-col overflow-hidden bg-sf-white text-tx outline-none",
            "sm:inset-4 sm:rounded-2xl sm:border sm:border-st-secondary sm:shadow-card lg:inset-6",
          )}
        >
          <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-st-secondary px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1 basis-48">
              <DialogPrimitive.Title className="truncate text-[15px] font-medium leading-[22px] tracking-[-0.005em] text-tx">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Drag shapes, draw arrows and double-click to edit text.
                {save ? " Changes save automatically." : " Changes are not saved."}
              </DialogPrimitive.Description>
              <SaveStatus state={saveState} canSave={!!save} />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(pill, "bg-sf-secondary hover:bg-sf-tertiary")}
                onClick={() => onExport(sceneOf(api.current, scene), "png")}
              >
                <Download aria-hidden="true" strokeWidth={1.5} />
                PNG
              </button>
              <button
                type="button"
                className={cn(pill, "bg-sf-secondary hover:bg-sf-tertiary")}
                onClick={() => onExport(sceneOf(api.current, scene), "svg")}
              >
                <FileCode2 aria-hidden="true" strokeWidth={1.5} />
                SVG
              </button>
              {copyAction}
              <button
                type="button"
                className={cn(pill, "ml-1 hidden bg-ink text-white hover:bg-[#363944] sm:inline-flex")}
                onClick={() => close(false)}
              >
                <Check aria-hidden="true" strokeWidth={1.5} />
                Done
              </button>
              <Tooltip content="Close">
                <DialogPrimitive.Close asChild>
                  <IconButton aria-label="Close editor" size="md" className="text-tx-tertiary hover:text-tx sm:hidden">
                    <X aria-hidden="true" strokeWidth={1.5} />
                  </IconButton>
                </DialogPrimitive.Close>
              </Tooltip>
            </div>
          </header>
          <div className="relative min-h-0 flex-1">
            <DiagramCanvas
              scene={scene}
              mode="edit"
              onSceneChange={onSceneChange}
              onApi={(a) => {
                api.current = a;
              }}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default DiagramEditor;
