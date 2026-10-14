"use client";

import { memo, useMemo, useRef, useState } from "react";
import { FileCode2, FileImage, GitFork, Maximize2 } from "lucide-react";
import type { DiagramData } from "@wup/contracts";
import { Dialog } from "@/components/ui/dialog";
import { DIAGRAM_MAX_NODES, normalizeDiagram, type CleanDiagram, type CleanNode } from "@/lib/diagram/normalize";
import { layoutDiagram } from "@/lib/diagram/layout";
import { toMermaid } from "@/lib/diagram/to-mermaid";
import { copyText, downloadBlob, safeFilename } from "@/lib/export/download";
import { svgToPngBlob } from "@/lib/export/png";
import { serializeSvg, svgBlob } from "@/lib/export/svg";
import { RendererShell } from "../renderer-shell";
import { ActionIcon, CopyAction, ExportMenu } from "../renderer-actions";
import { useFontsReady } from "../hooks";
import { ZoomPan } from "../zoom-pan";
import { DiagramSvg } from "./diagram-svg";

/*
 * Flow diagram card: guarded data, dagre layout, typed nodes. Expand opens a
 * zoomable fullscreen dialog. Exports: SVG, PNG and "Copy as Mermaid".
 */

export interface DiagramBlockProps {
  diagram: unknown;
  title?: string;
}

const KIND_LABEL: Record<CleanNode["type"], string> = {
  start: "Start",
  end: "End",
  action: "Step",
  decision: "Decision",
  success: "Success",
  error: "Error",
};

function describe(d: CleanDiagram): string {
  return `Flow diagram with ${d.nodes.length} ${d.nodes.length === 1 ? "step" : "steps"} and ${d.edges.length} ${d.edges.length === 1 ? "connection" : "connections"}`;
}

export const DiagramBlock = memo(function DiagramBlock({ diagram, title }: DiagramBlockProps) {
  const clean = normalizeDiagram(diagram);
  if (clean.nodes.length === 0) {
    return (
      <RendererShell title={title ?? "Diagram"}>
        <p className="py-8 text-center text-[14px] text-tx-tertiary">No steps to draw</p>
      </RendererShell>
    );
  }
  if (clean.nodes.length > DIAGRAM_MAX_NODES) return <DiagramList diagram={clean} title={title} />;
  return <DiagramCard clean={clean} title={title} />;
});

/** sr-only (and large-graph) text form of the flow. */
function FlowList({ d, className }: { d: CleanDiagram; className?: string }) {
  const labels = new Map(d.nodes.map((n) => [n.id, n.label]));
  return (
    <ol className={className}>
      {d.nodes.map((n) => {
        const out = d.edges.filter((e) => e.from === n.id);
        return (
          <li key={n.id} className="border-t border-st-secondary py-2.5 first:border-t-0">
            <div className="flex items-baseline gap-2">
              <span className="w-[72px] shrink-0 text-[12px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">
                {KIND_LABEL[n.type]}
              </span>
              <span className="text-[14px] text-tx">{n.label}</span>
            </div>
            {out.length ? (
              <ul className="mt-1 pl-[80px] text-[13px] text-tx-tertiary">
                {out.map((e) => (
                  <li key={e.id}>
                    to {labels.get(e.to)}
                    {e.label ? ` (${e.label})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function DiagramList({ diagram, title }: { diagram: CleanDiagram; title?: string }) {
  return (
    <RendererShell
      title={title ?? "Diagram"}
      caption={`${diagram.nodes.length} steps is too many to draw clearly. Shown as a list`}
      actions={
        <CopyAction
          label="Copy as Mermaid"
          icon={<GitFork aria-hidden="true" strokeWidth={1.5} />}
          getText={() => toMermaid(diagram as unknown as DiagramData)}
          copy={copyText}
        />
      }
    >
      <FlowList d={diagram} className="max-h-[480px] overflow-auto" />
    </RendererShell>
  );
}

function DiagramCard({ clean, title }: { clean: CleanDiagram; title?: string }) {
  const fontsReady = useFontsReady();
  // Re-measure once web fonts are in, so wrapped labels match the rendered text.
  const layout = useMemo(() => {
    void fontsReady;
    return layoutDiagram(clean);
  }, [clean, fontsReady]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [open, setOpen] = useState(false);
  const label = describe(clean);
  const name = safeFilename(title, "wuup-diagram");
  const notes: string[] = [];
  if (clean.droppedEdges) notes.push(`${clean.droppedEdges} broken ${clean.droppedEdges === 1 ? "link" : "links"} left out`);

  const exportSvg = () => {
    if (!svgRef.current) throw new Error("Diagram is not ready yet");
    return serializeSvg(svgRef.current, { padding: 24, title });
  };

  return (
    <RendererShell
      title={title ?? "Diagram"}
      caption={notes.length ? notes.join(", ") : undefined}
      actions={
        <>
          <CopyAction
            label="Copy as Mermaid"
            icon={<GitFork aria-hidden="true" strokeWidth={1.5} />}
            getText={() => toMermaid(clean as unknown as DiagramData)}
            copy={copyText}
          />
          <ExportMenu
            items={[
              {
                label: "Download PNG",
                icon: <FileImage />,
                onSelect: async () => downloadBlob(await svgToPngBlob(exportSvg(), 2), `${name}.png`),
              },
              { label: "Download SVG", icon: <FileCode2 />, onSelect: () => downloadBlob(svgBlob(exportSvg()), `${name}.svg`) },
            ]}
          />
          <ActionIcon label="Expand" onClick={() => setOpen(true)}>
            <Maximize2 aria-hidden="true" strokeWidth={1.5} />
          </ActionIcon>
        </>
      }
    >
      <div className="flex max-h-[640px] justify-center overflow-auto rounded-xl bg-[#fcfcfc] px-4 py-6 sm:px-6">
        <DiagramSvg layout={layout} svgRef={svgRef} label={label} />
      </div>
      <FlowList d={clean} className="sr-only" />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title ?? "Diagram"}
        description="Drag to pan. Use Ctrl and scroll, or the buttons, to zoom."
        className="sm:h-[calc(100dvh-48px)] sm:max-w-[min(1280px,calc(100vw-48px))]!"
      >
        <div className="-mx-6 -mb-6 h-[70dvh] sm:h-full">
          <ZoomPan width={layout.width} height={layout.height} className="h-full rounded-none">
            <DiagramSvg layout={layout} natural label={label} />
          </ZoomPan>
        </div>
      </Dialog>
    </RendererShell>
  );
}

export { DiagramBlock as default };
