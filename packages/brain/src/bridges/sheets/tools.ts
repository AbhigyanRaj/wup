import { isObjectIdOrHexString } from "mongoose";
import { Connection } from "@wup/models";
import { cryptoService } from "../../utils/crypto";
import type { ToolContext } from "../../tools/types";
import { BridgeError, capRowsToBytes, recordDataQuery } from "../shared";
import {
  RANGE_RE,
  fetchSpreadsheetMeta,
  getSheetsClient,
  parseSpreadsheetId,
  quoteTab,
  safeSheetsErrorMessage,
  toSheetsError,
} from "./client";

/**
 * Read-only Google Sheets tools exposed to the model.
 */

export const SHEETS_MAX_ROWS = 500;
export const SHEETS_MAX_BYTES = 50 * 1024;
const DEFAULT_RANGE = "A1:Z100";

/** Loads a Sheets bridge owned by the current user and enabled for this chat. */
async function loadSheetsConnection(connectionId: string, ctx: ToolContext) {
  if (ctx.allowedConnectionIds?.length && !ctx.allowedConnectionIds.includes(String(connectionId))) {
    throw new Error("That bridge isn't enabled for this chat.");
  }
  if (typeof connectionId !== "string" || !isObjectIdOrHexString(connectionId)) {
    throw new Error("Connection not found");
  }
  const conn: any = await Connection.findOne({ _id: connectionId, userId: ctx.userId }).catch(() => null);
  // Only Google Sheets bridges: never decrypt another bridge type's config
  // (e.g. a MongoDB URI) and send it to Google as a spreadsheet id.
  if (!conn || conn.type !== "sheets") throw new Error("Connection not found");
  Connection.updateOne({ _id: conn._id }, { $set: { "metadata.lastUsedAt": new Date() } }).catch(() => {});
  return conn;
}

function spreadsheetIdOf(conn: any): string {
  const id = parseSpreadsheetId(cryptoService.decrypt(conn.config));
  if (!id) throw new Error("This bridge doesn't have a valid Google Sheets link. Reconnect it.");
  return id;
}

const colToNum = (col: string) => [...col].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
const numToCol = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

interface ParsedRange {
  range: string;
  startCol: string;
  endCol: string;
  startRow: number;
}

/** Validates an A1 range and clamps it to the header row plus SHEETS_MAX_ROWS data rows. */
export function normaliseRange(input: unknown): ParsedRange {
  const raw = typeof input === "string" && input.trim() ? input.trim().toUpperCase() : DEFAULT_RANGE;
  if (!RANGE_RE.test(raw)) {
    throw new BridgeError("VALIDATION_FAILED", 'range must be an A1 range without the tab name, e.g. "A1:G50" or "A:D".');
  }
  const m = raw.match(/^([A-Z]{1,3})(\d*)(?::([A-Z]{1,3})(\d*))?$/)!;
  const startCol = m[1];
  const endCol = m[3] ?? m[1];
  const startRow = m[2] ? Math.max(1, Number(m[2])) : 1;
  if (m[3] === undefined && m[2]) return { range: raw, startCol, endCol, startRow }; // single cell
  const maxEnd = startRow + SHEETS_MAX_ROWS;
  const endRow = m[4] ? Math.min(Number(m[4]), maxEnd) : maxEnd;
  return { range: `${startCol}${startRow}:${endCol}${Math.max(endRow, startRow)}`, startCol, endCol, startRow };
}

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const cellValue = (v: unknown) => (typeof v === "string" && NUMERIC_RE.test(v.trim()) ? Number(v) : v ?? "");

/** Turns header + data rows into objects keyed by (deduplicated) header names. */
export function rowsToObjects(headers: unknown[], rows: unknown[][], startCol = "A"): {
  headers: string[];
  rows: Array<Record<string, unknown>>;
} {
  const width = Math.max(headers.length, ...rows.map((r) => r.length), 0);
  const seen = new Map<string, number>();
  const names: string[] = [];
  const first = colToNum(startCol);
  for (let i = 0; i < width; i++) {
    const h = headers[i];
    let name = h === undefined || h === null || String(h).trim() === "" ? `Column ${numToCol(first + i)}` : String(h).trim();
    if (name === "__proto__") name = "_proto_";
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    names.push(count > 1 ? `${name}_${count}` : name);
  }
  const objects = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    names.forEach((n, i) => {
      obj[n] = cellValue(r[i]);
    });
    return obj;
  });
  return { headers: names, rows: objects };
}

/**
 * Reads data from a bridged Google Sheet. The header row becomes object keys;
 * results are capped at 500 rows and 50KB.
 */
export const read_sheets = async (
  { connectionId, sheetName, range }: { connectionId: string; sheetName?: string; range?: string },
  ctx: ToolContext
) => {
  const started = Date.now();
  let conn: any;
  let tab = typeof sheetName === "string" ? sheetName : "";
  let shownRange = typeof range === "string" ? range : DEFAULT_RANGE;
  try {
    conn = await loadSheetsConnection(connectionId, ctx);
    const spreadsheetId = spreadsheetIdOf(conn);
    const parsed = normaliseRange(range);
    shownRange = parsed.range;
    const api = getSheetsClient();

    let title: string = conn.sheetsCache?.title || conn.name;
    if (!tab) {
      tab = conn.sheetsCache?.tabs?.[0]?.name ?? "";
      if (!tab) {
        const meta = await fetchSpreadsheetMeta(spreadsheetId, api);
        title = meta.title;
        tab = meta.tabs[0]?.name ?? "";
      }
    }
    if (!tab) throw new BridgeError("NOT_FOUND", "This spreadsheet has no tabs to read.", 404);
    ctx.onStatus?.(`Reading ${tab}...`);

    let values: unknown[][];
    let headerRow: unknown[];
    try {
      const res = await api.spreadsheets.values.get({ spreadsheetId, range: `${quoteTab(tab)}!${parsed.range}` });
      values = (res.data?.values ?? []) as unknown[][];
      if (parsed.startRow === 1) {
        headerRow = values[0] ?? [];
        values = values.slice(1);
      } else {
        const head = await api.spreadsheets.values.get({
          spreadsheetId,
          range: `${quoteTab(tab)}!${parsed.startCol}1:${parsed.endCol}1`,
        });
        headerRow = head.data?.values?.[0] ?? [];
      }
    } catch (err) {
      throw toSheetsError(err);
    }

    const rowLimited = values.length > SHEETS_MAX_ROWS;
    const objects = rowsToObjects(headerRow, values.slice(0, SHEETS_MAX_ROWS), parsed.startCol);
    const capped = capRowsToBytes(objects.rows, SHEETS_MAX_BYTES);
    const truncated = rowLimited || capped.truncated;

    const citation = recordDataQuery(
      ctx,
      {
        tool: "sheets_read",
        connectionName: conn.name,
        db: title,
        collection: tab,
        query: parsed.range,
        rowCount: capped.rows.length,
        truncated,
        durationMs: Date.now() - started,
      },
      capped.rows as Array<Record<string, any>>
    );

    return {
      success: true,
      title,
      sheetName: tab,
      range: parsed.range,
      headers: objects.headers,
      rows: capped.rows,
      count: capped.rows.length,
      truncated,
      ...(citation !== undefined && { citation }),
    };
  } catch (err: any) {
    const message = err instanceof BridgeError ? err.message : safeSheetsErrorMessage(err);
    console.error("[WUP Brain Tool] Sheets read failed:", message);
    if (conn) {
      recordDataQuery(ctx, {
        tool: "sheets_read",
        connectionName: conn.name,
        db: conn.sheetsCache?.title || conn.name,
        collection: tab,
        query: shownRange,
        rowCount: 0,
        truncated: false,
        durationMs: Date.now() - started,
        error: message,
      });
    }
    return { success: false, error: message };
  }
};

/**
 * Lists the title and tabs (with sizes and header rows) of a bridged spreadsheet.
 */
export const get_sheets_metadata = async ({ connectionId }: { connectionId: string }, ctx: ToolContext) => {
  try {
    const conn = await loadSheetsConnection(connectionId, ctx);
    const meta = await fetchSpreadsheetMeta(spreadsheetIdOf(conn));
    await Connection.updateOne(
      { _id: conn._id },
      { $set: { sheetsCache: { title: meta.title, tabs: meta.tabs, fetchedAt: new Date() } } }
    ).catch(() => {});
    return {
      success: true,
      title: meta.title,
      sheets: meta.tabs.map((t) => t.name),
      tabs: meta.tabs,
    };
  } catch (err: any) {
    const message = err instanceof BridgeError ? err.message : safeSheetsErrorMessage(err);
    console.error("[WUP Brain Tool] Sheets metadata failed:", message);
    return { success: false, error: message };
  }
};

export const SHEETS_TOOLS = { read_sheets, get_sheets_metadata };

/** Gemini function declarations for the Sheets tools (names unchanged for registry.ts). */
export const SHEETS_BRIDGE_TOOL_DECLARATIONS = [
  {
    name: "read_sheets",
    description: `Reads a range of data from a bridged Google Sheet. The first row is treated as headers and each row comes back as an object. At most ${SHEETS_MAX_ROWS} rows. Requires a sheetName (tab name).`,
    parameters: {
      type: "OBJECT",
      properties: {
        connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." },
        sheetName: { type: "STRING", description: "The name of the tab/sheet (e.g. 'Sheet1')." },
        range: { type: "STRING", description: "The A1 range to read, without the tab name (e.g. A1:G50 or A:D)." },
      },
      required: ["connectionId", "sheetName"],
    },
  },
  {
    name: "get_sheets_metadata",
    description: "Lists the title and all tabs (with row counts and header rows) of a Google Sheets bridge.",
    parameters: {
      type: "OBJECT",
      properties: {
        connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." },
      },
      required: ["connectionId"],
    },
  },
];
