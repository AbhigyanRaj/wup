import type { ParsedDocument } from "./pdf";
import { decodeUtf8 } from "./text";

/** Hard cap on parsed CSV rows (header included). */
export const MAX_CSV_ROWS = 50_000;

export interface CsvParseResult {
  rows: string[][];
  delimiter: string;
  /** true when the input had more than maxRows rows. */
  truncated: boolean;
}

/**
 * Picks the delimiter (comma, semicolon or tab) that occurs most often in the
 * first line outside quotes. Defaults to comma.
 */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < text.length && i < 64 * 1024; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

/**
 * RFC-4180 parser: quoted fields may contain the delimiter, newlines and
 * doubled quotes (""). Accepts \n and \r\n line endings. Blank lines are
 * skipped. Stops after `maxRows` rows.
 */
export function parseCsvRows(
  text: string,
  options: { maxRows?: number; delimiter?: string } = {}
): CsvParseResult {
  const maxRows = options.maxRows ?? MAX_CSV_ROWS;
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let truncated = false;
  let i = 0;
  const n = text.length;

  const endRow = () => {
    row.push(field);
    field = "";
    // Skip blank lines (a single empty field)
    if (!(row.length === 1 && row[0].trim() === "")) rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
      i++;
      if (rows.length >= maxRows) {
        truncated = text.slice(i).trim().length > 0;
        return { rows, delimiter, truncated };
      }
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) endRow();
  if (rows.length > maxRows) {
    rows.length = maxRows;
    truncated = true;
  }
  return { rows, delimiter, truncated };
}

/** Quotes a field when it contains a comma, quote or newline (RFC-4180). */
function quoteField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialises rows back to comma-separated CSV text, one record per line. */
export function serializeCsv(rows: string[][]): string {
  return rows.map((r) => r.map((f) => quoteField(f.trim())).join(",")).join("\n");
}

/**
 * Parses a CSV upload and returns normalised CSV text (comma-delimited,
 * trimmed fields, one record per line), ready for chunkCsv().
 */
export async function parseCsv(input: Buffer | string): Promise<ParsedDocument> {
  const text = typeof input === "string" ? input : decodeUtf8(input);
  const { rows, truncated } = parseCsvRows(text);
  return {
    text: serializeCsv(rows),
    pageCount: 1,
    info: { rowCount: rows.length },
    truncated,
  };
}
