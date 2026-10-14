"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FileCode2, FileImage, GitFork, PenLine, RotateCcw, Workflow } from "lucide-react";
import { QueryClientContext } from "@tanstack/react-query";
import type { DiagramData, DiagramEdit } from "@wup/contracts";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { normalizeDiagram, type CleanDiagram, type DiagramKind } from "@/lib/diagram/normalize";
import { toMermaidSource } from "@/lib/diagram/to-mermaid";
import { cleanMermaid, hashCode, mermaidTitle } from "@/lib/mermaid";
import { copyText, downloadBlob, safeFilename } from "@/lib/export/download";
import { errorMessage, isApiError } from "@/lib/api";
import { RendererShell } from "../renderer-shell";
import { ActionIcon, CopyAction, ExportMenu } from "../renderer-actions";
import { useSeenOnce } from "../hooks";
import type { DiagramScene } from "./types";
import { fromSaved, resetDiagram, saveDiagram, type DiagramTarget } from "./persist";

/*
 * The one diagram experience: DiagramData and ```mermaid fences both become an
 * Excalidraw scene.
 *
 * - This file is light (it ships with chat). Excalidraw, the converter and its
 *   mermaid only load through dynamic import() once the card nears the viewport.
 * - Conversions are cached in an LRU keyed by a hash of the Mermaid code, so
 *   re-mounts and repeated diagrams never convert twice.
 * - While `streaming` is true nothing is parsed; the card shows "Drawing diagram".
 * - Inline: a read-only, fitted canvas. Edit opens the full editor fullscreen.
 * - Edits autosave per message and diagram key (see ./persist); a saved edit is
 *   shown instead of the generated diagram, with "Edited" and "Reset to original".
 */

const DiagramCanvas = dynamic(() => import("./canvas").then((m) => m.DiagramCanvas), {
  ssr: false,
  loading: () => <CanvasSkeleton />,
});

const DiagramEditor = dynamic(() => import("./editor").then((m) => m.DiagramEditor), { ssr: false });

const loadEngine = () => import("./engine");

/* ---------------------------------------------------------------------------
 * Conversion cache
 * ------------------------------------------------------------------------- */

type Result = { ok: true; scene: DiagramScene } | { ok: false; error: string };

const CACHE_MAX = 40;
const results = new Map<string, Result>();
const inflight = new Map<string, Promise<Result>>();

function peek(key: string): Result | undefined {
  const hit = results.get(key);
  if (hit) {
    results.delete(key);
    results.set(key, hit);
  }
  return hit;
}

function remember(key: string, value: Result) {
  results.set(key, value);
  while (results.size > CACHE_MAX) results.delete(results.keys().next().value as string);
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  const maybe = err as { message?: unknown; str?: unknown } | null;
  return String(maybe?.message ?? maybe?.str ?? "Invalid diagram");
}

function convert(src: Source): Promise<Result> {
  const hit = peek(src.key);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(src.key);
  if (running) return running;
  const job = loadEngine()
    .then((engine) => engine.convertMermaid(src.code, src.kinds))
    .then(
      (scene): Result => (scene.elements.length ? { ok: true, scene } : { ok: false, error: "The diagram is empty" }),
      (err: unknown): Result => ({ ok: false, error: errorText(err) }),
    )
    .then((r) => {
      remember(src.key, r);
      inflight.delete(src.key);
      return r;
    });
  inflight.set(src.key, job);
  return job;
}

/* ---------------------------------------------------------------------------
 * Sources
 * ------------------------------------------------------------------------- */

interface Source {
  key: string;
  /** Code handed to the converter. */
  code: string;
  /** What "Copy Mermaid" and "Show source" give back. */
  copy: string;
  kinds?: ReadonlyMap<string, DiagramKind>;
  clean?: CleanDiagram;
}

function fromMermaid(code: string): Source {
  const clean = cleanMermaid(code);
  return { key: `m${hashCode(clean)}`, code: clean, copy: code.trim() };
}

function fromDiagram(raw: DiagramData): Source {
  const clean = normalizeDiagram(raw);
  const { code, kinds } = toMermaidSource(raw);
  return { key: `d${hashCode(code)}`, code, copy: code, kinds, clean };
}

function useConversion(src: Source | null, enabled: boolean): Result | undefined {
  const [state, setState] = useState<{ key: string; result: Result } | null>(null);
  const cached = src ? peek(src.key) : undefined;
  useEffect(() => {
    if (!src || !enabled || cached) return;
    let alive = true;
    convert(src).then((result) => {
      if (alive) setState({ key: src.key, result });
    });
    return () => {
      alive = false;
    };
  }, [src, enabled, cached]);
  if (!src) return undefined;
  return cached ?? (state?.key === src.key ? state.result : undefined);
}

/* ---------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------- */

const CANVAS_BOX = "relative h-[280px] w-full overflow-hidden rounded-xl border border-st-secondary bg-white sm:h-[360px]";

function CanvasSkeleton() {
  return (
    <div role="status" aria-label="Drawing diagram" className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white">
      <Skeleton shape="block" className="h-10 w-40 rounded-xl" />
      <Skeleton className="h-6 w-px rounded-none" />
      <div className="flex gap-6">
        <Skeleton shape="block" className="h-10 w-28 rounded-xl" />
        <Skeleton shape="block" className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}

/** Same look as the chat's pending fence: the diagram is still arriving. */
function PendingDiagram() {
  return (
    <div
      role="status"
      className="flex h-[140px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 text-[14px] text-indigo-800"
    >
      <Workflow className="size-5 animate-pulse motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
      <span>Drawing diagram</span>
    </div>
  );
}

function ErrorCard({ source, error, kind }: { source: string; error: string; kind: "mermaid" | "diagram" }) {
  const [show, setShow] = useState(false);
  return (
    <RendererShell
      title="Couldn't draw this diagram"
      caption={
        kind === "mermaid"
          ? "The diagram code has a syntax error. The rest of the answer is unaffected."
          : "This diagram couldn't be laid out. The rest of the answer is unaffected."
      }
      actions={
        <Button variant="soft" size="sm" onClick={() => setShow((s) => !s)} aria-expanded={show}>
          {show ? "Hide source" : "Show source"}
        </Button>
      }
    >
      {show ? (
        <div className="flex flex-col gap-3">
          <pre className="max-h-[360px] overflow-auto rounded-xl border border-st-secondary bg-[#fafafa] p-4 font-mono text-[13px] leading-[1.7] text-tx">
            {source}
          </pre>
          <p className="font-mono text-[12px] leading-5 text-tx-tertiary">{error.split("\n")[0]}</p>
        </div>
      ) : null}
    </RendererShell>
  );
}

function describe(d: CleanDiagram | undefined, title: string): string {
  if (!d) return `${title}. Open the editor to explore it.`;
  const labels = new Map(d.nodes.map((n) => [n.id, n.label]));
  const steps = d.nodes.map((n) => n.label).join(", ");
  const links = d.edges.map((e) => `${labels.get(e.from)} to ${labels.get(e.to)}${e.label ? ` (${e.label})` : ""}`).join("; ");
  return `Flow diagram with ${d.nodes.length} ${d.nodes.length === 1 ? "step" : "steps"}: ${steps}.${links ? ` Connections: ${links}.` : ""}`;
}

/* ---------------------------------------------------------------------------
 * Public
 * ------------------------------------------------------------------------- */

export interface ExcalidrawDiagramProps {
  /** Mermaid source (a ```mermaid fence). */
  mermaid?: string;
  /** Structured diagram from the API. Used when `mermaid` is not given. */
  diagram?: DiagramData | null;
  title?: string;
  /** True while the fence is still streaming in: nothing is parsed yet. */
  streaming?: boolean;
  /** Where edits are saved. Without all three, editing works but isn't saved. */
  chatId?: string;
  messageId?: string;
  /** "visual" for diagramData, "m:<n>" for the n-th mermaid fence. */
  diagramKey?: string;
  /** The user's saved edit; shown instead of the generated diagram. */
  savedScene?: DiagramEdit | null;
  /** False keeps edits local even with a target (the demo sandbox). */
  persist?: boolean;
}

function saveErrorText(err: unknown): string {
  if (isApiError(err) && err.status === 413) return "This diagram is too large to save. Your changes stay here until you reload.";
  return `${errorMessage(err, "The connection dropped.")} Your changes stay here until you reload.`;
}

export function ExcalidrawDiagram({
  mermaid,
  diagram,
  title,
  streaming,
  chatId,
  messageId,
  diagramKey,
  savedScene,
  persist = true,
}: ExcalidrawDiagramProps) {
  const isMermaid = typeof mermaid === "string";
  const source = useMemo<Source | null>(() => {
    if (streaming) return null;
    if (isMermaid) return mermaid.trim() ? fromMermaid(mermaid) : null;
    return diagram ? fromDiagram(diagram) : null;
  }, [streaming, isMermaid, mermaid, diagram]);

  const qc = useContext(QueryClientContext);
  const target = useMemo<DiagramTarget | null>(
    () => (persist && chatId && messageId && diagramKey ? { chatId, messageId, key: diagramKey } : null),
    [persist, chatId, messageId, diagramKey],
  );
  const saved = useMemo(() => (savedScene ? fromSaved(savedScene) : undefined), [savedScene]);

  const [boxRef, seen] = useSeenOnce<HTMLDivElement>();
  // A saved edit replaces the generated diagram, so there is nothing to convert.
  const result = useConversion(source, seen && !saved);
  const [edited, setEdited] = useState<{ key: string; scene: DiagramScene } | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fitZoom, setFitZoom] = useState(1);

  const save = useMemo(
    () =>
      target
        ? (next: DiagramScene) =>
            saveDiagram(qc, target, next).then(
              () => undefined,
              (err: unknown) => {
                toast.error("Couldn't save your diagram", { id: `diagram-save-${target.messageId}-${target.key}`, description: saveErrorText(err) });
                throw err;
              },
            )
        : undefined,
    [qc, target],
  );

  if (streaming) return <PendingDiagram />;

  const heading = title ?? (isMermaid ? mermaidTitle(mermaid) : "Diagram");

  if (!source || (!saved && source.clean && source.clean.nodes.length === 0)) {
    return isMermaid ? (
      <ErrorCard source={mermaid ?? ""} error="The diagram code is empty" kind="mermaid" />
    ) : (
      <RendererShell title={heading}>
        <p className="py-8 text-center text-[14px] text-tx-tertiary">No steps to draw</p>
      </RendererShell>
    );
  }

  if (!saved && result && !result.ok) {
    return <ErrorCard source={source.copy} error={result.error} kind={isMermaid ? "mermaid" : "diagram"} />;
  }

  const local = edited?.key === source.key ? edited.scene : undefined;
  const scene = local ?? saved ?? (result?.ok ? result.scene : undefined);
  const isEdited = Boolean(saved || local);
  const name = safeFilename(heading, "wuup-diagram");

  const download = async (kind: "png" | "svg", from: DiagramScene) => {
    const engine = await loadEngine();
    const blob = kind === "png" ? await engine.exportPng(from) : await engine.exportSvg(from);
    downloadBlob(blob, `${name}.${kind}`);
  };

  const reset = async () => {
    try {
      if (target && saved) await resetDiagram(qc, target);
      setEdited(null);
      toast.success("Diagram reset to the original");
    } catch (err) {
      toast.error("Couldn't reset the diagram", { description: errorMessage(err) });
      throw err;
    }
  };

  const notes: string[] = [];
  if (!isEdited && source.clean?.droppedEdges) {
    const n = source.clean.droppedEdges;
    notes.push(`${n} broken ${n === 1 ? "link" : "links"} left out`);
  }
  if (scene?.image && !isEdited) notes.push("Drawn as an image, so shapes can't be edited one by one");
  else if (fitZoom < 0.5) notes.push("Large diagram. Open the editor to zoom in");
  if (local && !target) notes.push("Edits are not saved");

  const copyMermaid = (
    <CopyAction
      label={isEdited ? "Copy original Mermaid" : "Copy Mermaid"}
      doneLabel="Mermaid copied"
      icon={<GitFork aria-hidden="true" strokeWidth={1.5} />}
      getText={() => source.copy}
      copy={copyText}
    />
  );

  return (
    <RendererShell
      title={
        isEdited ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {heading}
            <span
              data-diagram-edited=""
              className="inline-flex h-5 items-center rounded-full bg-indigo-50 px-2 text-[12px] font-medium leading-4 text-indigo-800 ring-1 ring-indigo-200 ring-inset"
            >
              Edited
            </span>
          </span>
        ) : (
          heading
        )
      }
      caption={notes.length ? notes.join(". ") : undefined}
      actions={
        scene ? (
          <>
            {isEdited ? (
              <ActionIcon label="Reset to original" onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden="true" strokeWidth={1.5} />
              </ActionIcon>
            ) : null}
            {copyMermaid}
            <ExportMenu
              items={[
                { label: "Download PNG", icon: <FileImage />, onSelect: () => download("png", scene) },
                { label: "Download SVG", icon: <FileCode2 />, onSelect: () => download("svg", scene) },
              ]}
            />
            <ActionIcon label="Edit" onClick={() => setEditing(true)}>
              <PenLine aria-hidden="true" strokeWidth={1.5} />
            </ActionIcon>
          </>
        ) : null
      }
    >
      <div ref={boxRef} className={CANVAS_BOX} data-diagram-canvas="">
        {scene ? (
          <>
            <DiagramCanvas scene={scene} mode="view" onFit={setFitZoom} />
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Open ${heading} in the editor`}
              className="group absolute inset-0 z-10 cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400"
            >
              <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-st-secondary bg-white/95 px-3 py-1.5 text-[13px] font-medium leading-4 text-tx-secondary opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-opacity duration-200 ease-standard group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                <PenLine className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                Edit
              </span>
            </button>
            <p className="sr-only">{isEdited ? `${heading}, edited.` : describe(source.clean, heading)}</p>
          </>
        ) : (
          <CanvasSkeleton />
        )}
      </div>
      {scene && editing ? (
        <DiagramEditor
          open={editing}
          onOpenChange={setEditing}
          title={heading}
          scene={scene}
          save={save}
          onCommit={(next) => setEdited({ key: source.key, scene: next })}
          onExport={(from, kind) => {
            download(kind, from).catch((err: unknown) =>
              toast.error("Export failed", { description: err instanceof Error ? err.message : undefined }),
            );
          }}
          copyAction={copyMermaid}
        />
      ) : null}
      {isEdited ? (
        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Reset to the original diagram?"
          body="Your edits to this diagram will be removed. The original stays in the answer."
          confirmLabel="Reset"
          tone="danger"
          onConfirm={reset}
        />
      ) : null}
    </RendererShell>
  );
}

export default ExcalidrawDiagram;
