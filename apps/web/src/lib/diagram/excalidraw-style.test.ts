import { describe, expect, it } from "vitest";
import { DIAGRAM_FONT_FAMILY, KIND_STYLE, finishElements, isImageScene, plainLabel, styleSkeletons } from "./excalidraw-style";
import { toMermaidSource } from "./to-mermaid";

describe("plainLabel", () => {
  it("turns Mermaid HTML labels into plain lines", () => {
    expect(plainLabel("Validate cart<br/><small>orders collection</small>")).toBe("Validate cart\norders collection");
    expect(plainLabel("  a <b>bold</b>   word ")).toBe("a bold word");
  });
});

describe("styleSkeletons", () => {
  const kinds = toMermaidSource({
    nodes: [
      { id: "q", label: "Approved?", type: "decision" },
      { id: "ok", label: "Done", type: "success" },
      { id: "x", label: "Failed", type: "error" },
      { id: "s", label: "Start", type: "start" },
      { id: "step", label: "Step" },
    ],
    edges: [],
  }).kinds;

  it("fills nodes from the kit palette by kind", () => {
    const out: Array<Record<string, unknown>> = styleSkeletons(
      ["q", "ok", "x", "s", "step"].map((id) => ({ id, type: id === "q" ? "diamond" : "rectangle", label: { text: id } })),
      kinds,
    );
    expect(out[0]).toMatchObject({ backgroundColor: KIND_STYLE.decision.fill, strokeColor: KIND_STYLE.decision.stroke, fillStyle: "solid" });
    expect(out[0].backgroundColor).toBe("#e8effc");
    expect(out[1].backgroundColor).toBe("#f2f8eb");
    expect(out[2].backgroundColor).toBe("#fde7e2");
    expect(out[3].backgroundColor).toBe("#f9f9f9");
    expect(out[4].backgroundColor).toBe("#ffffff");
  });

  it("is never sketchy and uses the sans font", () => {
    const out = styleSkeletons([
      { type: "rectangle", roughness: 2, label: { text: "A<br/>B" } },
      { type: "arrow", roughness: 1, label: { text: "yes" } },
      { type: "text", text: "<b>Title</b>", fontFamily: 1 },
    ]);
    for (const el of out) expect(el.roughness).toBe(0);
    expect(out[0].label).toMatchObject({ text: "A\nB", fontFamily: DIAGRAM_FONT_FAMILY });
    expect(out[1].label).toMatchObject({ text: "yes", fontFamily: DIAGRAM_FONT_FAMILY, fontSize: 14 });
    expect(out[2]).toMatchObject({ text: "Title", fontFamily: DIAGRAM_FONT_FAMILY });
  });

  it("keeps classDef fills on Mermaid scenes and whitens transparent nodes", () => {
    const out = styleSkeletons([
      { type: "rectangle", backgroundColor: "#ffeeaa" },
      { type: "ellipse", backgroundColor: "transparent" },
    ]);
    expect(out[0].backgroundColor).toBe("#ffeeaa");
    expect(out[1].backgroundColor).toBe("#ffffff");
  });
});

describe("finishElements and isImageScene", () => {
  it("forces roughness 0 on created elements", () => {
    expect(finishElements([{ type: "text", roughness: 1 }, { type: "rectangle", roughness: 0 }]).map((e) => e.roughness)).toEqual([0, 0]);
  });

  it("spots the image fallback", () => {
    expect(isImageScene([{ type: "image" }])).toBe(true);
    expect(isImageScene([{ type: "image" }, { type: "text" }])).toBe(false);
    expect(isImageScene([])).toBe(false);
  });
});
