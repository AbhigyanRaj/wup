import { describe, expect, it } from "vitest";
import type { DiagramData } from "@wup/contracts";
import { toMermaid, toMermaidSource } from "./to-mermaid";
import { normalizeDiagram, pickDirection } from "./normalize";

describe("toMermaid", () => {
  it("emits shapes, escaped labels, edge labels and classes", () => {
    const out = toMermaid({
      nodes: [
        { id: "start", label: "Begin", type: "start" },
        { id: "1-check", label: 'Is "x" > 3?', type: "decision" },
        { id: "end", label: "Done", type: "success" },
      ],
      edges: [
        { from: "start", to: "1-check" },
        { from: "1-check", to: "end", label: "yes" },
      ],
    });
    expect(out.split("\n")[0]).toBe("flowchart TB");
    expect(out).toContain('start(["Begin"])');
    expect(out).toContain('n_1_check{"Is #quot;x#quot; #gt; 3?"}');
    expect(out).toContain('n_end["Done"]');
    expect(out).toContain('n_1_check -->|"yes"| n_end');
    expect(out).toContain("classDef w_decision");
    expect(out).toContain("class n_1_check w_decision");
  });

  it("drops dangling edges and survives undefined input", () => {
    expect(toMermaid({ nodes: [{ id: "a", label: "A" }], edges: [{ from: "a", to: "ghost" }] })).toBe('flowchart TB\n  a["A"]');
    expect(toMermaid(undefined as unknown as DiagramData)).toBe("flowchart TB");
  });
});

describe("normalizeDiagram", () => {
  it("defaults, dedupes and drops bad edges", () => {
    const d = normalizeDiagram({ nodes: [{ id: "a" }, { id: "a" }, { id: 2, label: "two" }, null], edges: [{ from: "a", to: "2" }, null, { from: "a" }] });
    expect(d.nodes.map((n) => n.id)).toEqual(["a", "2"]);
    expect(d.nodes[0].label).toBe("a");
    expect(d.edges).toHaveLength(1);
    expect(d.droppedEdges).toBe(2);
    expect(d.duplicateNodes).toBe(1);
  });

  it("ranks cycles instead of collapsing them (stays TB)", () => {
    const ids = ["start", "cart", "pay", "ok", "retry", "done", "fail"];
    const pairs = [["start", "cart"], ["cart", "pay"], ["pay", "ok"], ["ok", "done"], ["ok", "retry"], ["retry", "pay"], ["retry", "fail"]];
    const d = normalizeDiagram({ nodes: ids.map((id) => ({ id, label: id })), edges: pairs.map(([from, to]) => ({ from, to })) });
    expect(pickDirection(d)).toBe("TB");
  });

  it("goes LR for shallow, wide graphs", () => {
    const d = normalizeDiagram({
      nodes: ["r", "a", "b", "c", "d", "e"].map((id) => ({ id, label: id })),
      edges: ["a", "b", "c", "d", "e"].map((to) => ({ from: "r", to })),
    });
    expect(pickDirection(d)).toBe("LR");
  });
});

describe("toMermaidSource", () => {
  it("maps Mermaid-safe ids to node kinds", () => {
    const { code, kinds } = toMermaidSource({
      nodes: [
        { id: "end", label: "Done", type: "success" },
        { id: "1-check", label: "Ok?", type: "decision" },
      ],
      edges: [{ from: "1-check", to: "end" }],
    });
    expect(code).toContain("n_1_check -->");
    expect(kinds.get("n_end")).toBe("success");
    expect(kinds.get("n_1_check")).toBe("decision");
  });
});
