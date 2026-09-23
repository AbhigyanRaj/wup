import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MetaStreamFilter, applyGrounding, parseStructuredResponse } from "../src/orchestrator";

const META = (obj: unknown) => `---WUP_META---\n${JSON.stringify(obj)}\n---END_WUP_META---`;

describe("MetaStreamFilter", () => {
  test("hides the meta block even when the marker is split across chunks", () => {
    const f = new MetaStreamFilter();
    const raw = `There are **21,349** movies.\n\n${META({ type: "answer", followUps: [], visualType: "none" })}`;
    let shown = "";
    // Feed 3 characters at a time so the marker is always split
    for (let i = 0; i < raw.length; i += 3) shown += f.push(raw.slice(i, i + 3));
    shown += f.flush();
    assert.equal(shown.trim(), "There are **21,349** movies.");
    assert.equal(parseStructuredResponse(f.fullText()).content, "There are **21,349** movies.");
  });

  test("flushes everything when there is no meta block", () => {
    const f = new MetaStreamFilter();
    const shown = f.push("short") + f.flush();
    assert.equal(shown, "short");
    assert.equal(f.fullText(), "short");
  });
});

describe("applyGrounding", () => {
  const rows = [
    { _id: "Drama", avgRating: 7.2, count: 100 },
    { _id: "Comedy", avgRating: 6.4, count: 80 },
  ];

  test("replaces model-written table data with the real rows", () => {
    const out = applyGrounding(
      { content: "x", followUps: [], visualType: "table", tableData: { columns: ["fake"], rows: [{ fake: 999 }] } },
      rows
    );
    assert.equal(out.visualType, "table");
    assert.deepEqual(out.tableData.columns, ["avgRating", "count", "_id"]);
    assert.equal(out.tableData.rows[0].avgRating, 7.2);
  });

  test("fills chart series from real rows when the axis keys match", () => {
    const out = applyGrounding(
      {
        content: "x",
        followUps: [],
        visualType: "chart",
        chartData: { type: "bar", xAxisKey: "_id", yAxisKey: "avgRating", series: [{ _id: "Made up", avgRating: 10 }] },
      },
      rows
    );
    assert.equal(out.visualType, "chart");
    assert.deepEqual(out.chartData.series, [
      { _id: "Drama", avgRating: 7.2 },
      { _id: "Comedy", avgRating: 6.4 },
    ]);
  });

  test("falls back to a table when chart keys don't exist in the rows", () => {
    const out = applyGrounding(
      { content: "x", followUps: [], visualType: "chart", chartData: { type: "bar", xAxisKey: "genre", yAxisKey: "avg", series: [] } },
      rows
    );
    assert.equal(out.visualType, "table");
    assert.equal(out.chartData, undefined);
  });

  test("leaves diagrams, clarifications and query-free answers alone", () => {
    const diagram = { content: "x", followUps: [], visualType: "diagram", diagramData: { nodes: [], edges: [] } };
    assert.deepEqual(applyGrounding(diagram, rows), diagram);
    const clar = { content: "?", followUps: [], visualType: "none", clarification: { question: "?", options: [] } };
    assert.deepEqual(applyGrounding(clar, rows), clar);
    const plain = { content: "hi", followUps: [], visualType: "none" };
    assert.deepEqual(applyGrounding(plain, undefined), plain);
  });
});

describe("parseStructuredResponse", () => {
  test("parses answers with follow-ups", () => {
    const r = parseStructuredResponse(`Answer\n${META({ type: "answer", followUps: [{ label: "a", suggestedPrompt: "b" }], visualType: "chart" })}`);
    assert.equal(r.content, "Answer");
    assert.equal(r.followUps.length, 1);
    assert.equal(r.visualType, "chart");
  });

  test("parses clarifications and survives broken JSON", () => {
    const c = parseStructuredResponse(`Which?\n${META({ type: "clarification", question: "Which?", options: ["A", "B"] })}`);
    assert.deepEqual(c.clarification, { question: "Which?", options: ["A", "B"] });
    const broken = parseStructuredResponse("Hi\n---WUP_META---\n{nope\n---END_WUP_META---");
    assert.equal(broken.content, "Hi");
    assert.equal(broken.visualType, "none");
  });
});
