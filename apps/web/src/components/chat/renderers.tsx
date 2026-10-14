/*
 * Single seam between chat and APP-3's renderers (src/components/renderers).
 * Chat code imports VisualBlock, MermaidBlock and HighlightedCode from here,
 * plus DiagramPersistContext (chatId, messageId and saved diagram edits).
 */
export { VisualBlock } from "@/components/renderers/visual-block";
export { MermaidBlock } from "@/components/renderers/mermaid-block";
export { HighlightedCode } from "@/components/renderers/highlighted-code";
export { DiagramPersistContext, type DiagramPersistValue } from "@/components/renderers/excalidraw/persist";
