import { describe, expect, it } from "vitest";
import { normalizeChart, PIE_MAX_SLICES } from "./normalize";
import { CHART_OTHER, CHART_PALETTE } from "./palette";

const bar = (series: Array<Record<string, string | number>>, extra: Record<string, unknown> = {}) => ({
  type: "bar",
  xAxisKey: "x",
  yAxisKey: "y",
  series,
  ...extra,
});

describe("normalizeChart", () => {
  it("never throws on garbage", () => {
    for (const raw of [undefined, null, 42, "x", [], {}, { series: null }, { series: [null, 1, "a"] }]) {
      const r = normalizeChart(raw);
      expect(r.ok).toBe(false);
    }
  });

  it("parses string numbers and notes skipped rows", () => {
    const r = normalizeChart(bar([{ x: "a", y: "1,234" }, { x: "b", y: "$2.5k" }, { x: "c", y: "n/a" }, { x: "d", y: "oops" }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chart.points.map((p) => p.value)).toEqual([1234, 2500]);
    expect(r.chart.skipped).toBe(2);
    expect(r.chart.notes).toContain("2 rows skipped");
  });

  it("maps type aliases", () => {
    const kind = (type: string) => {
      const r = normalizeChart(bar([{ x: "a", y: 1 }], { type }));
      return r.ok ? r.chart.kind : r.reason;
    };
    expect(kind("column")).toBe("bar");
    expect(kind("area")).toBe("line");
    expect(kind("donut")).toBe("pie");
    expect(kind("doughnut")).toBe("pie");
    expect(kind("barh")).toBe("hbar");
    expect(kind("horizontalBar")).toBe("hbar");
    expect(kind("scatter3d")).toBe("unknown-type");
    const area = normalizeChart(bar([{ x: "a", y: 1 }], { type: "area" }));
    expect(area.ok && area.chart.area).toBe(true);
  });

  it("falls back to a table for unknown types, keeping rows", () => {
    const r = normalizeChart(bar([{ x: "a", y: 1 }], { type: "radar", title: "T" }));
    expect(r).toMatchObject({ ok: false, reason: "unknown-type", message: "Shown as a table", title: "T" });
    if (!r.ok) expect(r.rows).toHaveLength(1);
  });

  it("switches bars to horizontal for many categories or long labels", () => {
    const many = normalizeChart(bar(Array.from({ length: 13 }, (_, i) => ({ x: `c${i}`, y: i }))));
    expect(many.ok && many.chart.kind).toBe("hbar");
    const long = normalizeChart(bar([{ x: "A really long category name", y: 1 }, { x: "Another long category", y: 2 }]));
    expect(long.ok && long.chart.kind).toBe("hbar");
    const short = normalizeChart(bar([{ x: "Jan", y: 1 }, { x: "Feb", y: 2 }]));
    expect(short.ok && short.chart.kind).toBe("bar");
  });

  it("pie: drops non-positive, folds past 5 into Other", () => {
    const series = [9, 8, 7, 6, 5, 4, 3, 0, -2].map((y, i) => ({ x: `s${i}`, y }));
    const r = normalizeChart(bar(series, { type: "pie" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chart.points).toHaveLength(PIE_MAX_SLICES + 1);
    expect(r.chart.points.slice(0, 5).map((p) => p.color)).toEqual([...CHART_PALETTE]);
    const other = r.chart.points[5];
    expect(other).toMatchObject({ label: "Other", value: 7, color: CHART_OTHER, other: true, count: 2 });
    expect(r.chart.notes.join(" ")).toMatch(/2 zero or negative values left out/);
  });

  it("pie: a single slice survives, all-zero is empty", () => {
    const one = normalizeChart(bar([{ x: "only", y: 5 }], { type: "pie" }));
    expect(one.ok && one.chart.points).toHaveLength(1);
    const zero = normalizeChart(bar([{ x: "a", y: 0 }, { x: "b", y: 0 }], { type: "pie" }));
    expect(zero.ok && zero.chart.empty).toBe(true);
  });

  it("infers keys when the given ones are missing", () => {
    const r = normalizeChart({ type: "line", series: [{ month: "Jan", users: "1,000" }, { month: "Feb", users: 1200 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chart.xKey).toBe("month");
    expect(r.chart.yKey).toBe("users");
    expect(r.chart.title).toBe("Users by month");
  });

  it("detects a shared currency affix", () => {
    const r = normalizeChart(bar([{ x: "a", y: "$1" }, { x: "b", y: "$2" }]));
    expect(r.ok && r.chart.affix).toEqual({ prefix: "$", suffix: "" });
  });
});
