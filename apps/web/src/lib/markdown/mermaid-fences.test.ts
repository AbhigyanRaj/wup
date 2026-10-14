import { describe, expect, it } from "vitest";
import { mermaidFenceLines } from "./fences";

describe("mermaidFenceLines", () => {
  it("lists where closed mermaid fences open, skipping other languages and open fences", () => {
    const md = ["Intro", "```mermaid", "flowchart TD", "A-->B", "```", "", "```js", "x", "```", "```Mermaid", "graph LR", "```", "```mermaid", "half"].join("\n");
    expect(mermaidFenceLines(md)).toEqual([2, 10]);
  });

  it("ignores mermaid text inside another fence", () => {
    expect(mermaidFenceLines("````md\n```mermaid\nA\n```\n````")).toEqual([]);
  });
});
