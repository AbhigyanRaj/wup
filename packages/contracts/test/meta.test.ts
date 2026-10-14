import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_META_BLOCK, MetaBlockSchema, parseMetaBlock, StreamEventSchema, SignupBodySchema } from "../src/index";

test("non-object input never throws and yields the empty block", () => {
  for (const bad of [undefined, null, 42, "nope", [], [1, 2], true]) {
    assert.deepEqual(MetaBlockSchema.parse(bad), EMPTY_META_BLOCK);
  }
  assert.deepEqual(parseMetaBlock("{not json"), EMPTY_META_BLOCK);
});

test("unknown visualType becomes none and bad chart type falls back to bar", () => {
  const out = MetaBlockSchema.parse({
    visualType: "hologram",
    chartData: { type: "donut3d", xAxisKey: "month", yAxisKey: "revenue", series: [{ month: "Jan", revenue: 10 }, "junk", { month: "Feb", revenue: { nested: true } }] },
  });
  assert.equal(out.visualType, "none");
  assert.equal(out.chartData?.type, "bar");
  assert.deepEqual(out.chartData?.series, [{ month: "Jan", revenue: 10 }, { month: "Feb" }]);
});

test("chart without axis keys is dropped", () => {
  const out = MetaBlockSchema.parse({ visualType: "chart", chartData: { type: "line", series: [] } });
  assert.equal(out.visualType, "chart");
  assert.equal(out.chartData, null);
});

test("at most 3 followUps, malformed ones dropped", () => {
  const out = MetaBlockSchema.parse({
    followUps: [
      { label: "A", suggestedPrompt: "Do A" },
      null,
      { label: "" },
      { label: "B", suggestedPrompt: "Do B" },
      { label: "C" },
      { label: "D", suggestedPrompt: "Do D" },
    ],
  });
  assert.deepEqual(out.followUps, [
    { label: "A", suggestedPrompt: "Do A" },
    { label: "B", suggestedPrompt: "Do B" },
    { label: "C", suggestedPrompt: "C" },
  ]);
});

test("clarification options are bounded to 2..5 strings of at most 80 chars", () => {
  const long = "x".repeat(200);
  const out = MetaBlockSchema.parse({
    type: "clarification",
    question: "Which period?",
    options: ["Q1", 7, null, "Q1", long, "Q2", "Q3", "Q4", "Q5"],
  });
  assert.equal(out.type, "clarification");
  assert.equal(out.clarification?.question, "Which period?");
  assert.equal(out.clarification?.options.length, 5);
  assert.ok(out.clarification!.options.every((o) => o.length <= 80));
  assert.deepEqual(out.clarification?.options.slice(0, 2), ["Q1", "7"]);
  assert.equal(out.clarification?.allowFreeText, true);

  const tooFew = MetaBlockSchema.parse({ type: "clarification", question: "Hm?", options: ["only one"] });
  assert.equal(tooFew.clarification, null);
  assert.equal(tooFew.type, "answer");
});

test("diagram is capped at 30 nodes / 60 edges and dangling edges are dropped", () => {
  const nodes = Array.from({ length: 50 }, (_, i) => ({ id: String(i), label: `N${i}`, type: i === 0 ? "start" : "weird" }));
  const edges = Array.from({ length: 100 }, (_, i) => ({ from: String(i % 40), to: String((i + 1) % 40) }));
  const out = MetaBlockSchema.parse({ visualType: "diagram", diagramData: { nodes, edges } });
  assert.equal(out.diagramData?.nodes.length, 30);
  assert.ok(out.diagramData!.edges.length <= 60);
  const ids = new Set(out.diagramData!.nodes.map((n) => n.id));
  assert.ok(out.diagramData!.edges.every((e) => ids.has(e.from) && ids.has(e.to)));
  assert.equal(out.diagramData?.nodes[0].type, "start");
  assert.equal(out.diagramData?.nodes[1].type, undefined);
});

test("table is capped at 100 rows / 12 columns with primitive cells", () => {
  const columns = Array.from({ length: 20 }, (_, i) => `c${i}`);
  const rows = Array.from({ length: 150 }, (_, r) => Object.fromEntries(columns.map((c) => [c, c === "c1" ? { deep: r } : r])));
  const out = MetaBlockSchema.parse({ visualType: "table", tableData: { columns, rows: [...rows, "junk"] } });
  assert.equal(out.visualType, "table");
  assert.equal(out.tableData?.columns.length, 12);
  assert.equal(out.tableData?.rows.length, 100);
  assert.equal(Object.keys(out.tableData!.rows[0]).length, 12);
  assert.equal(out.tableData?.rows[3].c1, '{"deep":3}');
});

test("malformed parts do not poison the valid ones", () => {
  const out = MetaBlockSchema.parse({
    type: "answer",
    visualType: "table",
    followUps: "not an array",
    chartData: 5,
    diagramData: { nodes: "x" },
    tableData: { rows: [{ a: 1, b: "two" }] },
  });
  assert.equal(out.visualType, "table");
  assert.deepEqual(out.followUps, []);
  assert.equal(out.chartData, null);
  assert.equal(out.diagramData, null);
  assert.deepEqual(out.tableData, { columns: ["a", "b"], rows: [{ a: 1, b: "two" }] });
});

test("stream events and password policy sanity", () => {
  assert.ok(StreamEventSchema.safeParse({ type: "token", text: "hi" }).success);
  assert.ok(!StreamEventSchema.safeParse({ type: "token" }).success);
  assert.ok(!SignupBodySchema.safeParse({ email: "a@b.co", password: "short" }).success);
  // 24 three-byte chars = 72 bytes: allowed. 25 = 75 bytes: rejected.
  assert.ok(SignupBodySchema.safeParse({ email: "a@b.co", password: "€".repeat(24) }).success);
  assert.ok(!SignupBodySchema.safeParse({ email: "a@b.co", password: "€".repeat(25) }).success);
  const parsed = SignupBodySchema.parse({ email: "  Mixed@Case.COM ", password: "longenough1" });
  assert.equal(parsed.email, "mixed@case.com");
});
