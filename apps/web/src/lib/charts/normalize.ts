/*
 * normalizeChart: validate and repair a ChartData payload BEFORE any React hook
 * touches it. Everything the renderer needs (kind, points, notes) is decided here,
 * so the SVG components never see undefined, NaN or an unsupported type.
 */

import type { ChartData } from "@wup/contracts";
import { parseNumericDetailed } from "./parse-numeric";
import type { Affix } from "./format";
import { CHART_OTHER, CHART_PALETTE } from "./palette";

export type ChartKind = "bar" | "hbar" | "line" | "pie";

export interface ChartPoint {
  /** Stable key (row index based), unique even when labels repeat. */
  key: string;
  label: string;
  value: number;
  /** Pie only: slice colour. */
  color?: string;
  /** Pie only: true for the folded "Other" slice. */
  other?: boolean;
  /** Pie only: how many rows the "Other" slice holds. */
  count?: number;
}

export type ChartRow = Record<string, unknown>;

export interface NormalizedChart {
  kind: ChartKind;
  /** The type as sent, lowercased. */
  requestedType: string;
  title: string;
  xKey: string;
  yKey: string;
  points: ChartPoint[];
  /** Line charts get an area wash; `area` makes it the explicit request. */
  area: boolean;
  affix: Affix;
  /** Original rows and columns, for the table view and CSV. */
  rows: ChartRow[];
  columns: string[];
  skipped: number;
  /** Short human notes shown as the card caption ("2 rows skipped"). */
  notes: string[];
  /** Pie with nothing positive to draw. */
  empty: boolean;
}

export type NormalizeFailure = {
  ok: false;
  reason: "no-data" | "unknown-type" | "no-numeric";
  message: string;
  title: string;
  rows: ChartRow[];
  columns: string[];
};

export type NormalizeResult = { ok: true; chart: NormalizedChart } | NormalizeFailure;

const TYPE_ALIASES: Record<string, { kind: ChartKind | "auto-bar"; area?: boolean }> = {
  bar: { kind: "auto-bar" },
  bars: { kind: "auto-bar" },
  barchart: { kind: "auto-bar" },
  column: { kind: "auto-bar" },
  columns: { kind: "auto-bar" },
  columnchart: { kind: "auto-bar" },
  vbar: { kind: "auto-bar" },
  verticalbar: { kind: "auto-bar" },
  histogram: { kind: "auto-bar" },
  barh: { kind: "hbar" },
  hbar: { kind: "hbar" },
  horizontalbar: { kind: "hbar" },
  horizontalbarchart: { kind: "hbar" },
  line: { kind: "line" },
  lines: { kind: "line" },
  linechart: { kind: "line" },
  spline: { kind: "line" },
  timeseries: { kind: "line" },
  area: { kind: "line", area: true },
  areachart: { kind: "line", area: true },
  pie: { kind: "pie" },
  piechart: { kind: "pie" },
  donut: { kind: "pie" },
  doughnut: { kind: "pie" },
  ring: { kind: "pie" },
};

/** Max pie slices before the rest fold into "Other". */
export const PIE_MAX_SLICES = 5;
const HBAR_LABEL_CHARS = 12;
const HBAR_CATEGORIES = 12;

function isRecord(v: unknown): v is ChartRow {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

function columnsOf(rows: ChartRow[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
  return [...seen];
}

function numericShare(rows: ChartRow[], key: string): number {
  let present = 0;
  let numeric = 0;
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    present++;
    if (parseNumericDetailed(v)) numeric++;
  }
  return present === 0 ? 0 : numeric / present;
}

function pickKeys(rows: ChartRow[], columns: string[], xHint: unknown, yHint: unknown) {
  const has = (k: unknown): k is string => typeof k === "string" && columns.includes(k);
  let yKey = has(yHint) && numericShare(rows, yHint) > 0 ? yHint : undefined;
  let xKey = has(xHint) && xHint !== yKey ? xHint : undefined;
  if (!xKey) {
    xKey =
      columns.find((c) => c !== yKey && numericShare(rows, c) < 0.8) ??
      columns.find((c) => c !== yKey) ??
      columns[0];
  }
  if (!yKey) {
    yKey = columns.find((c) => c !== xKey && numericShare(rows, c) >= 0.8);
  }
  return { xKey, yKey };
}

function labelOf(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(blank)";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function dominantAffix(affixes: Affix[]): Affix {
  if (affixes.length === 0) return { prefix: "", suffix: "" };
  const counts = new Map<string, number>();
  for (const a of affixes) {
    const k = `${a.prefix}\u0000${a.suffix}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  if (bestN / affixes.length < 0.8) return { prefix: "", suffix: "" };
  const [prefix, suffix] = best.split("\u0000");
  return { prefix, suffix };
}

export function normalizeChart(raw: unknown): NormalizeResult {
  const data = (isRecord(raw) ? raw : {}) as Partial<ChartData> & Record<string, unknown>;
  const rows = Array.isArray(data.series) ? data.series.filter(isRecord) : [];
  const columns = columnsOf(rows);
  const requestedType = typeof data.type === "string" ? data.type.trim().toLowerCase() : "";
  const givenTitle = typeof data.title === "string" ? data.title.trim() : "";

  const fail = (reason: NormalizeFailure["reason"], message: string, title = givenTitle): NormalizeFailure => ({
    ok: false,
    reason,
    message,
    title: title || "Data",
    rows,
    columns,
  });

  if (rows.length === 0 || columns.length === 0) return fail("no-data", "No rows to chart");

  const alias = requestedType ? TYPE_ALIASES[requestedType.replace(/[^a-z]/g, "")] : TYPE_ALIASES.bar;
  if (!alias) return fail("unknown-type", "Shown as a table");

  const { xKey, yKey } = pickKeys(rows, columns, data.xAxisKey, data.yAxisKey);
  if (!yKey) return fail("no-numeric", "Shown as a table");

  const title = givenTitle || `${humanizeKey(yKey)} by ${humanizeKey(xKey).toLowerCase()}`;
  const notes: string[] = [];

  let skipped = 0;
  const affixes: Affix[] = [];
  let points: ChartPoint[] = [];
  rows.forEach((row, i) => {
    const parsed = parseNumericDetailed(row[yKey]);
    if (!parsed) {
      skipped++;
      return;
    }
    affixes.push({ prefix: parsed.prefix, suffix: parsed.suffix });
    points.push({ key: `p${i}`, label: labelOf(row[xKey]), value: parsed.value });
  });
  if (skipped > 0) notes.push(`${plural(skipped, "row")} skipped`);
  if (points.length === 0) return fail("no-numeric", "Shown as a table", title);

  const affix = dominantAffix(affixes);
  let kind: ChartKind;
  let empty = false;

  if (alias.kind === "pie") {
    kind = "pie";
    const positive = points.filter((p) => p.value > 0);
    const dropped = points.length - positive.length;
    if (positive.length === 0) {
      empty = true;
      points = [];
    } else {
      if (dropped > 0) notes.push(`${plural(dropped, "zero or negative value")} left out`);
      positive.sort((a, b) => b.value - a.value);
      const head = positive.slice(0, PIE_MAX_SLICES);
      const tail = positive.slice(PIE_MAX_SLICES);
      points = head.map((p, i) => ({ ...p, color: CHART_PALETTE[i] }));
      if (tail.length > 0) {
        points.push({
          key: "other",
          label: "Other",
          value: tail.reduce((s, p) => s + p.value, 0),
          color: CHART_OTHER,
          other: true,
          count: tail.length,
        });
        notes.push(`${plural(tail.length, "smaller slice")} grouped as Other`);
      }
    }
  } else if (alias.kind === "auto-bar") {
    const avgLabel = points.reduce((s, p) => s + p.label.length, 0) / points.length;
    kind = avgLabel > HBAR_LABEL_CHARS || points.length > HBAR_CATEGORIES ? "hbar" : "bar";
  } else {
    kind = alias.kind;
  }

  return {
    ok: true,
    chart: {
      kind,
      requestedType: requestedType || "bar",
      title,
      xKey,
      yKey,
      points,
      area: Boolean(alias.area),
      affix,
      rows,
      columns,
      skipped,
      notes,
      empty,
    },
  };
}
