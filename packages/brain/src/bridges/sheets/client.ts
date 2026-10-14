import { google } from "googleapis";
import type { SheetTab, SheetsTestResult } from "@wup/contracts";
import { BridgeError } from "../shared";
import { getPublicApiKey, getServiceAccountEmail, getSheetsAuth } from "./auth";

/**
 * Thin, injectable Google Sheets client plus the metadata/test helpers the
 * API and tools share.
 */

/** The subset of the googleapis Sheets v4 client wuup uses. Tests inject a fake. */
export interface SheetsApi {
  spreadsheets: {
    get(params: { spreadsheetId: string; fields?: string; includeGridData?: boolean }): Promise<{ data: any }>;
    values: {
      get(params: { spreadsheetId: string; range: string; valueRenderOption?: string }): Promise<{
        data: { range?: string | null; values?: any[][] | null };
      }>;
      batchGet(params: { spreadsheetId: string; ranges: string[]; valueRenderOption?: string }): Promise<{
        data: { valueRanges?: Array<{ range?: string | null; values?: any[][] | null }> | null };
      }>;
    };
  };
}

let clientFactory: (() => SheetsApi) | null = null;

/** Test hook: replaces the Google client. Pass null to restore the real one. */
export function setSheetsClientFactory(factory: (() => SheetsApi) | null) {
  clientFactory = factory;
}

/** The Sheets client: service account if configured, else the public-sheet API key. */
export function getSheetsClient(): SheetsApi {
  if (clientFactory) return clientFactory();
  const auth = getSheetsAuth();
  const key = auth ? null : getPublicApiKey();
  if (!auth && !key) {
    throw new BridgeError("SHEETS_NOT_CONFIGURED", "Google Sheets isn't set up on this server yet.", 503);
  }
  const sheets = google.sheets({ version: "v4", ...(auth ? { auth: auth as any } : {}) });
  const extra = key ? { key } : {};
  return {
    spreadsheets: {
      get: (p) => sheets.spreadsheets.get({ ...p, ...extra } as any) as any,
      values: {
        get: (p) => sheets.spreadsheets.values.get({ ...p, ...extra } as any) as any,
        batchGet: (p) => sheets.spreadsheets.values.batchGet({ ...p, ...extra } as any) as any,
      },
    },
  };
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Returns a log/model-safe error message: never the full error object (which
 * carries request URLs and config), and with any `key=...` query parameter
 * (the API key fallback) redacted.
 */
export function safeSheetsErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "Google Sheets request failed";
  return redactApiKeys(raw || "Google Sheets request failed");
}

function redactApiKeys(text: string): string {
  let out = text.replace(/([?&;\s]key=)[^&\s"']*/gi, "$1[REDACTED]");
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length >= 8) out = out.split(apiKey).join("[REDACTED]");
  return out;
}

function httpStatusOf(err: any): number | undefined {
  const candidates = [err?.response?.status, err?.status, err?.code];
  for (const c of candidates) {
    const n = typeof c === "number" ? c : typeof c === "string" && /^\d{3}$/.test(c) ? Number(c) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function notSharedMessage(): string {
  const email = getServiceAccountEmail();
  return email
    ? `Share the sheet with ${email} as a Viewer`
    : "Share the sheet so anyone with the link can view it";
}

/** Maps a Google API error to a user-facing BridgeError (never leaks the API key). */
export function toSheetsError(err: unknown): BridgeError {
  if (err instanceof BridgeError) return err;
  const status = httpStatusOf(err);
  if (status === 403 || status === 401) return new BridgeError("SHEETS_NOT_SHARED", notSharedMessage(), 400);
  if (status === 404) {
    return new BridgeError("NOT_FOUND", "We couldn't find that spreadsheet. Check the link.", 404);
  }
  const message = safeSheetsErrorMessage(err);
  if (status === 400 && /parse range/i.test(message)) {
    return new BridgeError("VALIDATION_FAILED", "That tab or range doesn't exist in this spreadsheet.", 400);
  }
  return new BridgeError("BRIDGE_UNREACHABLE", message, 400);
}

// ─── Ids and ranges ───────────────────────────────────────────────────────────

const ID_RE = /^[a-zA-Z0-9_-]{20,128}$/;

/**
 * Extracts the spreadsheet id from a Sheets URL, a bare id, or a stored JSON
 * config ({ url } / { spreadsheetId }). Returns null when there isn't one.
 */
export function parseSpreadsheetId(urlOrId: unknown): string | null {
  if (typeof urlOrId !== "string") return null;
  const text = urlOrId.trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      return parseSpreadsheetId(obj?.spreadsheetId ?? obj?.url ?? obj?.id);
    } catch {
      return null;
    }
  }
  const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return ID_RE.test(text) ? text : null;
}

/** 'Tab name' quoted for A1 notation (single quotes doubled). */
export const quoteTab = (name: string) => `'${name.replace(/'/g, "''")}'`;

export const RANGE_RE = /^[A-Z]{1,3}\d*(:[A-Z]{1,3}\d*)?$/;

// ─── Metadata ─────────────────────────────────────────────────────────────────

const MAX_TABS = 50;
const MAX_HEADERS = 50;

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  tabs: SheetTab[];
}

/** Title, tab sizes and row-1 headers for a spreadsheet. Throws BridgeError. */
export async function fetchSpreadsheetMeta(spreadsheetId: string, api: SheetsApi = getSheetsClient()): Promise<SpreadsheetMeta> {
  let data: any;
  try {
    ({ data } = await api.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties(title,gridProperties)",
      includeGridData: false,
    }));
  } catch (err) {
    throw toSheetsError(err);
  }

  const tabs: SheetTab[] = (data?.sheets ?? [])
    .slice(0, MAX_TABS)
    .map((s: any) => ({
      name: String(s?.properties?.title ?? ""),
      rows: Number(s?.properties?.gridProperties?.rowCount ?? 0),
      cols: Number(s?.properties?.gridProperties?.columnCount ?? 0),
      headers: [] as string[],
    }))
    .filter((t: SheetTab) => t.name);

  if (tabs.length > 0) {
    try {
      const res = await api.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: tabs.map((t) => `${quoteTab(t.name)}!1:1`),
      });
      const ranges = res.data?.valueRanges ?? [];
      tabs.forEach((t, i) => {
        const row = ranges[i]?.values?.[0] ?? [];
        t.headers = row.slice(0, MAX_HEADERS).map((h: unknown) => (h === null || h === undefined ? "" : String(h)));
      });
    } catch {
      // Headers are a nicety; the tab list is enough to continue
    }
  }

  return { spreadsheetId, title: String(data?.properties?.title ?? "Untitled spreadsheet"), tabs };
}

/**
 * Validates a Sheets URL/id and returns its title and tabs. Throws BridgeError:
 * SHEETS_NOT_SHARED (403 from Google), NOT_FOUND, SHEETS_NOT_CONFIGURED,
 * VALIDATION_FAILED (not a Sheets link).
 */
export async function testSheets(config: unknown): Promise<SheetsTestResult> {
  const spreadsheetId = parseSpreadsheetId(config);
  if (!spreadsheetId) {
    throw new BridgeError(
      "VALIDATION_FAILED",
      "That doesn't look like a Google Sheets link. Paste the full URL from your browser.",
      400
    );
  }
  const meta = await fetchSpreadsheetMeta(spreadsheetId);
  return { ok: true, type: "sheets", spreadsheetId, title: meta.title, tabs: meta.tabs };
}
