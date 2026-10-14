import { parseMetaBlock, type ChartData, type TableData } from "@wup/contracts";
import { rowsToTable } from "../bridges/mongo/values";
import type { QueryRecord } from "../tools/types";
import type { StructuredResponse } from "./meta";

/**
 * Grounding: tables and charts shown under a data answer are built from the
 * rows the database actually returned, never from numbers the model wrote.
 */

export const MAX_CHART_POINTS = 50;
const MAX_ROW_SETS = 10;

type Row = Record<string, any>;

/** Tools whose results are schema or counts, not rows to show. */
const NON_ROW_TOOLS = new Set(["mongo_describe", "mongo_list_sources"]);
const COUNT_TOOLS = new Set(["mongo_count"]);

/** Collects database queries and their result rows during one request. */
export class QueryRecorder {
  queries: QueryRecord[] = [];
  /** Rows of the most recent query, only while that query succeeded with rows. */
  lastRows?: Row[];
  /** Successful row sets, newest first. */
  rowSets: Row[][] = [];

  /** Clears state (e.g. before retrying on another model). */
  reset() {
    this.queries = [];
    this.lastRows = undefined;
    this.rowSets = [];
  }

  /**
   * Records a query and returns its index in `queries` (bridges use it as the
   * data source's queryIndex). Schema lookups are not recorded and return -1.
   */
  record = (record: QueryRecord, rows?: Row[]): number => {
    if (NON_ROW_TOOLS.has(record.tool)) return -1;
    this.queries.push(record);
    const ok = !record.error && !COUNT_TOOLS.has(record.tool) && Array.isArray(rows) && rows.length > 0;
    if (ok) {
      this.lastRows = rows;
      this.rowSets.unshift(rows);
      if (this.rowSets.length > MAX_ROW_SETS) this.rowSets.length = MAX_ROW_SETS;
    } else {
      // An error, an empty result or a count supersedes older rows: never show stale data.
      this.lastRows = undefined;
    }
    return this.queries.length - 1;
  };
}

const hasKeys = (rows: Row[], x: string, y: string) => {
  const table = rowsToTable(rows);
  return table.rows.length > 0 && table.rows.every((r) => x in r && y in r) ? table : null;
};

function chartFrom(chart: ChartData, table: TableData | ReturnType<typeof rowsToTable>): ChartData {
  const x = chart.xAxisKey;
  const y = chart.yAxisKey;
  return {
    ...chart,
    series: table.rows.slice(0, MAX_CHART_POINTS).map((r: any) => ({ [x]: String(r[x]), [y]: Number(r[y]) || 0 })),
  };
}

/** Re-sanitises a model-written table (same rules as the meta block). */
function sanitisedModelTable(table: unknown): TableData | undefined {
  return parseMetaBlock({ visualType: "table", tableData: table }).tableData ?? undefined;
}

/**
 * Applies grounding rules to a parsed response.
 *
 *   - clarification, diagram, mermaid: untouched
 *   - chart: series from the newest row set that has both axis keys; otherwise a table
 *   - table: the last query's rows; otherwise the sanitised model table
 *   - "none" with 2+ rows from the last query: stays "none" with tableData as supplementary rows
 *
 * `rows` is the last query's rows (QueryRecorder.lastRows). `rowSets` (newest
 * first) defaults to [rows]. With no rows and no row sets nothing changes.
 */
export function applyGrounding(structured: StructuredResponse, rows?: Row[], rowSets?: Row[][]): StructuredResponse {
  if (structured.clarification) return structured;
  const vt = structured.visualType;
  if (vt === "diagram" || vt === "mermaid") return structured;

  const lastRows = rows && rows.length > 0 ? rows : undefined;
  const sets = (rowSets ?? (lastRows ? [lastRows] : [])).filter((s) => s.length > 0);
  if (!lastRows && sets.length === 0) return structured;

  const asTable = (): StructuredResponse => {
    if (lastRows) return { ...structured, visualType: "table", chartData: undefined, tableData: rowsToTable(lastRows) };
    const modelTable = sanitisedModelTable(structured.tableData);
    return modelTable
      ? { ...structured, visualType: "table", chartData: undefined, tableData: modelTable }
      : { ...structured, visualType: "none", chartData: undefined, tableData: undefined };
  };

  if (vt === "chart") {
    const chart = structured.chartData;
    if (chart?.xAxisKey && chart?.yAxisKey) {
      for (const set of sets) {
        const table = hasKeys(set, chart.xAxisKey, chart.yAxisKey);
        if (table) return { ...structured, chartData: chartFrom(chart, table), tableData: table };
      }
    }
    return asTable();
  }

  if (vt === "table") return asTable();

  // "none": keep the prose answer, attach the real rows as supplementary data.
  if (lastRows && lastRows.length >= 2) return { ...structured, tableData: rowsToTable(lastRows) };
  return structured;
}
