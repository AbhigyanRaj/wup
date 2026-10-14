import { describe, expect, it } from "vitest";
import { toSaveBody } from "./persist";
import type { DiagramScene } from "./types";

describe("toSaveBody", () => {
  it("drops deleted elements and unused files, and pins a white background", () => {
    const scene = {
      elements: [
        { id: "a", type: "rectangle", isDeleted: false },
        { id: "b", type: "rectangle", isDeleted: true },
        { id: "c", type: "image", isDeleted: false, fileId: "f1" },
      ],
      files: {
        f1: { id: "f1", mimeType: "image/png", dataURL: "data:image/png;base64,AA", created: 1 },
        f2: { id: "f2", mimeType: "image/png", dataURL: "data:image/png;base64,BB", created: 2 },
      },
      image: false,
    } as unknown as DiagramScene;
    const body = toSaveBody(scene);
    expect(body.elements.map((e) => e.id)).toEqual(["a", "c"]);
    expect(Object.keys(body.files ?? {})).toEqual(["f1"]);
    expect(body.appState).toEqual({ viewBackgroundColor: "#ffffff" });
  });
});
