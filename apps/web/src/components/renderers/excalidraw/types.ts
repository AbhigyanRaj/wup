import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

/* Type-only module: safe to import from the light (initial bundle) side. */

export interface DiagramScene {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
  /** The converter fell back to a flat image (unsupported Mermaid type). */
  image: boolean;
}
