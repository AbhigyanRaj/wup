"use client";

import { RendererBoundary } from "./renderer-boundary";
import { ExcalidrawDiagram } from "./excalidraw/excalidraw-diagram";
import { useDiagramPersist } from "./excalidraw/persist";

/*
 * Public: render a ```mermaid fence as an Excalidraw diagram. Excalidraw and the
 * converter load lazily once the card is on screen. Pass `streaming` while the
 * fence is still arriving: nothing is parsed until it is complete. `index` is
 * the fence's position among the message's mermaid fences (0 based); with the
 * persist context from the chat it keys saved edits as "m:<index>".
 */

export function MermaidBlock({ code, streaming, index }: { code: string; streaming?: boolean; index?: number }) {
  const ctx = useDiagramPersist();
  const key = typeof index === "number" && index >= 0 ? `m:${index}` : undefined;
  return (
    <RendererBoundary raw={code} title="Diagram">
      <ExcalidrawDiagram
        mermaid={typeof code === "string" ? code : ""}
        streaming={streaming}
        chatId={ctx?.chatId}
        messageId={ctx?.messageId}
        diagramKey={key}
        savedScene={key ? ctx?.edits?.[key] : undefined}
        persist={ctx?.persist}
      />
    </RendererBoundary>
  );
}

export default MermaidBlock;
