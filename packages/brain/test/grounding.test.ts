import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QueryRecorder, applyGrounding } from "../src/orchestrator/grounding";

const q = (tool: string, extra: Record<string, unknown> = {}) => ({
  tool,
  connectionName: "Movies",
  db: "mflix",
  collection: "movies",
  query: "{}",
  rowCount: 0,
  truncated: false,
  durationMs: 1,
  ...extra,
});

describe("QueryRecorder", () => {
  test("lastRows is only set by a successful query with rows; errors, empty results and counts reset it", () => {
    const r = new QueryRecorder();
    const rows = [{ a: 1 }, { a: 2 }];
    assert.equal(r.record(q("mongo_find"), rows), 0);
    assert.equal(r.lastRows, rows);

    r.record(q("mongo_find", { error: "boom" }), undefined);
    assert.equal(r.lastRows, undefined);

    r.record(q("mongo_aggregate"), rows);
    assert.equal(r.lastRows, rows);
    r.record(q("mongo_find"), []);
    assert.equal(r.lastRows, undefined);

    r.record(q("mongo_aggregate"), rows);
    r.record(q("mongo_count"), [{ count: 5 }]);
    assert.equal(r.lastRows, undefined);

    assert.equal(r.queries.length, 6);
    assert.equal(r.rowSets.length, 3);
  });

  test("schema lookups are not recorded and keep rows; rowSets are newest first", () => {
    const r = new QueryRecorder();
    const first = [{ x: 1 }];
    const second = [{ y: 2 }];
    r.record(q("mongo_find"), first);
    r.record(q("mongo_find"), second);
    assert.equal(r.record(q("mongo_describe"), [{ field: "x" }]), -1);
    assert.equal(r.lastRows, second);
    assert.deepEqual(r.rowSets, [second, first]);
    assert.equal(r.queries.length, 2);
  });
});

describe("applyGrounding rules", () => {
  const genre = [
    { genre: "Drama", n: 10 },
    { genre: "Comedy", n: 8 },
  ];
  const years = [
    { year: 2001, total: 3 },
    { year: 2002, total: 4 },
  ];

  test('"none" with 2+ rows keeps none and attaches supplementary tableData', () => {
    const out = applyGrounding({ content: "Drama leads.", followUps: [], visualType: "none" }, genre);
    assert.equal(out.visualType, "none");
    assert.deepEqual(out.tableData!.columns, ["genre", "n"]);
    const single = applyGrounding({ content: "x", followUps: [], visualType: "none" }, [{ n: 1 }]);
    assert.equal(single.tableData, undefined);
  });

  test("chart matches against an older row set when the newest lacks the keys", () => {
    const out = applyGrounding(
      { content: "x", followUps: [], visualType: "chart", chartData: { type: "line", xAxisKey: "genre", yAxisKey: "n", series: [] } },
      years,
      [years, genre]
    );
    assert.equal(out.visualType, "chart");
    assert.deepEqual(out.chartData!.series, [
      { genre: "Drama", n: 10 },
      { genre: "Comedy", n: 8 },
    ]);
    assert.deepEqual(out.tableData!.columns, ["genre", "n"]);
  });

  test("stale rows are not used: after a reset, a table falls back to the sanitised model table", () => {
    const out = applyGrounding(
      { content: "x", followUps: [], visualType: "table", tableData: { columns: ["a"], rows: [{ a: 1 }] } },
      undefined,
      [genre]
    );
    assert.equal(out.visualType, "table");
    assert.deepEqual(out.tableData, { columns: ["a"], rows: [{ a: 1 }] });

    const none = applyGrounding({ content: "x", followUps: [], visualType: "chart", chartData: { type: "bar", xAxisKey: "q", yAxisKey: "r", series: [] } }, undefined, [genre]);
    assert.equal(none.visualType, "none");
    assert.equal(none.chartData, undefined);
  });

  test("model charts without any database rows are left alone", () => {
    const chart = { content: "x", followUps: [], visualType: "chart" as const, chartData: { type: "pie" as const, xAxisKey: "k", yAxisKey: "v", series: [{ k: "a", v: 1 }] } };
    assert.deepEqual(applyGrounding(chart, undefined, []), chart);
  });

  test("mermaid is untouched", () => {
    const m = { content: "```mermaid\nflowchart TD\n```", followUps: [], visualType: "mermaid" as const };
    assert.deepEqual(applyGrounding(m, genre, [genre]), m);
  });
});
