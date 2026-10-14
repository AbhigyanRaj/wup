/*
 * CSV (RFC 4180) and TSV serialisation for table and chart rows.
 * Objects become compact JSON; null and undefined become empty cells.
 * Text that a spreadsheet would run as a formula gets a leading apostrophe.
 */

function cellString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** "=SUM(A1)" and "@cmd" are neutralised; plain negative numbers like "-5" are left alone. */
function guardFormula(s: string): string {
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d,.]*%?$/.test(s)) return `'${s}`;
  return s;
}

function csvCell(v: unknown): string {
  const s = guardFormula(cellString(v));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row?.[c])).join(","));
  return lines.join("\r\n");
}

/** Tab separated, for pasting into a spreadsheet. Tabs and newlines inside cells become spaces. */
export function rowsToTsv(columns: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  const cell = (v: unknown) => guardFormula(cellString(v)).replace(/[\t\r\n]+/g, " ");
  const lines = [columns.map(cell).join("\t")];
  for (const row of rows) lines.push(columns.map((c) => cell(row?.[c])).join("\t"));
  return lines.join("\n");
}
