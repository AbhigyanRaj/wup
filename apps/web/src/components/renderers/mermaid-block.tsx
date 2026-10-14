"use client";

import dynamic from "next/dynamic";
import { RendererBoundary } from "./renderer-boundary";
import { RendererSkeleton } from "./renderer-skeleton";

/*
 * Public: render a ```mermaid fence. The view (and mermaid itself) load lazily.
 * Pass `streaming` while the fence is still arriving to hold back error states.
 */

const MermaidView = dynamic(() => import("./mermaid-view").then((m) => m.MermaidView), {
  ssr: false,
  loading: () => <RendererSkeleton kind="diagram" />,
});

export function MermaidBlock({ code, streaming }: { code: string; streaming?: boolean }) {
  return (
    <RendererBoundary raw={code} title="Diagram">
      <MermaidView code={typeof code === "string" ? code : ""} streaming={streaming} />
    </RendererBoundary>
  );
}

export default MermaidBlock;
