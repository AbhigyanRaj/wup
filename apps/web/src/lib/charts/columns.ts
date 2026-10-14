/*
 * Table data helpers: column discovery, per-column type detection, stable row ids
 * and a comparator that sorts numbers as numbers and puts empty values last.
 */

import { parseNumeric } from "./parse-numeric";

export type ColumnType = "number" | "date" | "string";

export type TableRowInput = Record<string, unknown>;
export type TableRow = TableRowInput & { __rowId: string };

export interface PreparedTable {
  columns: string[];
  types: Record<string, ColumnType>;
  rows: TableRow[];
}

/** Share of non-empty values that must parse for a column to count as numeric or date. */
export const TYPE_THRESHOLD = 0.8;

export function isEmptyCell(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

const DATE_SHAPE =
  /^(\d{4}-\d{1,2}(-\d{1,2})?([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|[A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2} [A-Za-z]{3,9}\.? \d{4}|[A-Za-z]{3,9} \d{4})$/;

/** Parses obvious date strings only (never a bare number like "12"). */
export function parseDate(v: unknown): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!DATE_SHAPE.test(s)) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function detectColumnType(values: unknown[]): ColumnType {
  const present = values.filter((v) => !isEmptyCell(v));
  if (present.length === 0) return "string";
  const share = (fn: (v: unknown) => unknown) =>
    present.filter((v) => fn(v) !== null).length / present.length;
  // Booleans are labels, not quantities.
  if (present.every((v) => typeof v === "boolean")) return "string";
  if (share(parseNumeric) >= TYPE_THRESHOLD) return "number";
  if (share(parseDate) >= TYPE_THRESHOLD) return "date";
  return "string";
}

function isRecord(v: unknown): v is TableRowInput {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Columns from `columns` when given, else the union of row keys in first-seen order. */
export function prepareTable(columnsIn: unknown, rowsIn: unknown): PreparedTable {
  const source = Array.isArray(rowsIn) ? rowsIn.filter(isRecord) : [];
  let columns = Array.isArray(columnsIn)
    ? [...new Set(columnsIn.filter((c): c is string => typeof c === "string" && c !== "__rowId"))]
    : [];
  if (columns.length === 0) {
    const seen = new Set<string>();
    for (const r of source) for (const k of Object.keys(r)) if (k !== "__rowId") seen.add(k);
    columns = [...seen];
  }
  const rows: TableRow[] = source.map((r, i) => ({ ...r, __rowId: `r${i}` }));
  const types: Record<string, ColumnType> = {};
  for (const c of columns) types[c] = detectColumnType(rows.map((r) => r[c]));
  return { columns, types, rows };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function cellText(v: unknown): string {
  if (isEmptyCell(v)) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Comparator for one column; empty values always sort last, whatever the direction. */
export function compareCells(type: ColumnType, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1;
  return (a: unknown, b: unknown): number => {
    const ae = isEmptyCell(a);
    const be = isEmptyCell(b);
    if (ae || be) return ae === be ? 0 : ae ? 1 : -1;
    if (type === "number") {
      const an = parseNumeric(a);
      const bn = parseNumeric(b);
      if (an !== null && bn !== null) return (an - bn) * sign;
      if (an === null || bn === null) return an === bn ? 0 : an === null ? 1 : -1;
    }
    if (type === "date") {
      const at = parseDate(a);
      const bt = parseDate(b);
      if (at !== null && bt !== null) return (at - bt) * sign;
      if (at === null || bt === null) return at === bt ? 0 : at === null ? 1 : -1;
    }
    return collator.compare(cellText(a), cellText(b)) * sign;
  };
}

export function sortRows(
  rows: TableRow[],
  column: string,
  type: ColumnType,
  dir: "asc" | "desc",
): TableRow[] {
  const cmp = compareCells(type, dir);
  return [...rows].sort((x, y) => cmp(x[column], y[column]));
}
