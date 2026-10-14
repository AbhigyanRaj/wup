"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, FileCode2, FileImage, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { instanceSvg, peekMermaid, renderMermaid, type MermaidResult } from "@/lib/mermaid";
import { downloadBlob, safeFilename } from "@/lib/export/download";
import { svgToPngBlob } from "@/lib/export/png";
import { serializeSvg, svgBlob } from "@/lib/export/svg";
import { RendererShell } from "./renderer-shell";
import { ActionIcon, ExportMenu } from "./renderer-actions";
import { useSvgId } from "./hooks";
import { ZoomPan } from "./zoom-pan";

/*
 * Mermaid diagram card. Code is debounced while it streams in, so partial fences
 * never trigger a render storm, and a parse error only shows once the code has
 * settled. Results come from the shared LRU cache in lib/mermaid.
 */

const DEBOUNCE_MS = 350;
const SETTLE_MS = 1200;

const TYPE_TITLES: Array<[RegExp, string]> = [
  [/^(flowchart|graph)\b/, "Flowchart"],
  [/^sequenceDiagram\b/, "Sequence diagram"],
  [/^classDiagram/, "Class diagram"],
  [/^stateDiagram/, "State diagram"],
  [/^erDiagram\b/, "Entity relationship diagram"],
  [/^gantt\b/, "Timeline"],
  [/^journey\b/, "User journey"],
  [/^pie\b/, "Pie chart"],
  [/^mindmap\b/, "Mind map"],
  [/^timeline\b/, "Timeline"],
  [/^gitGraph\b/, "Git graph"],
];

function titleFor(code: string): string {
  const first = code
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("%%") && !l.startsWith("---"));
  if (!first) return "Diagram";
  for (const [re, t] of TYPE_TITLES) if (re.test(first)) return t;
  return "Diagram";
}

export interface MermaidViewProps {
  code: string;
  /** True while the fence is still streaming; errors stay hidden until it is false. */
  streaming?: boolean;
}

export function MermaidView({ code, streaming }: MermaidViewProps) {
  const [stable, setStable] = useState(code);
  // The code value that has stopped changing for SETTLE_MS.
  const [settledCode, setSettledCode] = useState(code);
  const [result, setResult] = useState<MermaidResult | undefined>(() => peekMermaid(code));
  const [lastGood, setLastGood] = useState<Extract<MermaidResult, { ok: true }> | undefined>(() => {
    const r = peekMermaid(code);
    return r?.ok ? r : undefined;
  });
  const [showSource, setShowSource] = useState(false);
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const inlineId = useSvgId("mmd");
  const expandedId = useSvgId("mmdx");

  // Debounce changes to the code (streaming), and track when it has settled.
  useEffect(() => {
    if (code === stable && code === settledCode) return;
    const t = setTimeout(() => setStable(code), DEBOUNCE_MS);
    const s = setTimeout(() => setSettledCode(code), SETTLE_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(s);
    };
  }, [code, stable, settledCode]);

  useEffect(() => {
    let alive = true;
    renderMermaid(stable).then((r) => {
      if (!alive) return;
      setResult(r);
      if (r.ok) setLastGood(r);
    });
    return () => {
      alive = false;
    };
  }, [stable]);

  const title = titleFor(code);
  const settled = settledCode === code;
  const showError = result && !result.ok && settled && !streaming;
  const shown = result?.ok ? result : lastGood;

  if (showError && !result.ok) {
    return (
      <RendererShell
        title="Couldn't draw this diagram"
        caption="The diagram code has a syntax error. The rest of the answer is unaffected."
        actions={
          <Button variant="soft" size="sm" onClick={() => setShowSource((s) => !s)} aria-expanded={showSource}>
            {showSource ? "Hide source" : "Show source"}
          </Button>
        }
      >
        {showSource ? (
          <div className="flex flex-col gap-3">
            <pre className="max-h-[360px] overflow-auto rounded-xl border border-st-secondary bg-[#fafafa] p-4 font-mono text-[13px] leading-[1.7] text-tx">
              {code.trim()}
            </pre>
            <p className="font-mono text-[12px] leading-5 text-tx-tertiary">{result.error.split("\n")[0]}</p>
          </div>
        ) : null}
      </RendererShell>
    );
  }

  const name = safeFilename(title, "wuup-diagram");
  const exportSvg = () => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) throw new Error("Diagram is not ready yet");
    return serializeSvg(svg, { padding: 24 });
  };

  return (
    <RendererShell
      title={title}
      actions={
        shown ? (
          <>
            <ActionIcon label={showSource ? "Hide source" : "Show source"} pressed={showSource} onClick={() => setShowSource((s) => !s)}>
              <Code2 aria-hidden="true" strokeWidth={1.5} />
            </ActionIcon>
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
        ) : null
      }
    >
      {showSource ? (
        <pre className="mb-4 max-h-[320px] overflow-auto rounded-xl border border-st-secondary bg-[#fafafa] p-4 font-mono text-[13px] leading-[1.7] text-tx">
          {code.trim()}
        </pre>
      ) : null}
      {shown ? (
        <div className="flex max-h-[640px] justify-center overflow-auto rounded-xl bg-[#fcfcfc] px-4 py-6 sm:px-6">
          <div
            ref={holder}
            role="img"
            aria-label={title}
            className="mermaid-svg w-full [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto"
            style={{ maxWidth: Math.round(shown.width * Math.min(1, 560 / Math.max(1, shown.height))) }}
            dangerouslySetInnerHTML={{ __html: instanceSvg(shown, inlineId) }}
          />
        </div>
      ) : (
        <div role="status" aria-label="Drawing diagram" className="flex flex-col items-center gap-3 rounded-xl bg-[#fcfcfc] py-10">
          <Skeleton shape="block" className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-6 w-px rounded-none" />
          <div className="flex gap-6">
            <Skeleton shape="block" className="h-10 w-32 rounded-xl" />
            <Skeleton shape="block" className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      )}
      {shown ? (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          description="Drag to pan. Use Ctrl and scroll, or the buttons, to zoom."
          className="sm:h-[calc(100dvh-48px)] sm:max-w-[min(1280px,calc(100vw-48px))]!"
        >
          <div className="-mx-6 -mb-6 h-[70dvh] sm:h-full">
            <ZoomPan width={shown.width} height={shown.height} className="h-full rounded-none">
              <div
                className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none!"
                style={{ width: shown.width, height: shown.height }}
                dangerouslySetInnerHTML={{ __html: instanceSvg(shown, expandedId) }}
              />
            </ZoomPan>
          </div>
        </Dialog>
      ) : null}
    </RendererShell>
  );
}

export { MermaidView as default };
