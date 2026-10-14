import { read_sheets, get_sheets_metadata } from "./sheets";
import { web_search } from "./websearch";
import { MONGO_TOOLS, MONGO_TOOL_DECLARATIONS } from "../bridges/mongo/tools";
import type { ToolContext, ToolFn } from "./types";

/**
 * Registry of every tool the brain can call. Each tool receives a ToolContext
 * (userId, allowed bridges, query recorder, source registry, signal).
 */
export const WUP_TOOLS_REGISTRY: Record<string, ToolFn> = {
  ...MONGO_TOOLS,
  read_sheets,
  get_sheets_metadata,
  web_search,
};

export const WEB_SEARCH_DECLARATION = {
  name: "web_search",
  description:
    "Searches the web for current facts, news and public information. Each result has a number n; cite it as [n].",
  parameters: {
    type: "OBJECT",
    properties: { query: { type: "STRING", description: "The specific search query." } },
    required: ["query"],
  },
};

export const SHEETS_TOOL_DECLARATIONS = [
  {
    name: "read_sheets",
    description: "Reads a range of data from a bridged Google Sheet. Requires a sheetName (tab name).",
    parameters: {
      type: "OBJECT",
      properties: {
        connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." },
        sheetName: { type: "STRING", description: "The name of the tab/sheet (e.g. 'Sheet1')." },
        range: { type: "STRING", description: "The A1 range to read (e.g. A1:G50)." },
      },
      required: ["connectionId", "sheetName"],
    },
  },
  {
    name: "get_sheets_metadata",
    description: "Lists the title and all available sheet/tab names within a Google Spreadsheet connection.",
    parameters: {
      type: "OBJECT",
      properties: { connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." } },
      required: ["connectionId"],
    },
  },
];

/** All declarations (legacy shape used by older callers). */
export const WUP_AI_TOOLS = [
  { functionDeclarations: [WEB_SEARCH_DECLARATION, ...MONGO_TOOL_DECLARATIONS, ...SHEETS_TOOL_DECLARATIONS] },
];

export interface ToolSelection {
  searchWeb?: boolean;
  /** The request has at least one MongoDB bridge. */
  hasBridges?: boolean;
  /** The request has at least one Google Sheets bridge. */
  hasSheets?: boolean;
}

/** Only the tools that make sense for this request. */
export function toolDeclarations(sel: ToolSelection): Array<{ name: string; description: string; parameters: any }> {
  return [
    ...(sel.hasBridges ? MONGO_TOOL_DECLARATIONS : []),
    ...(sel.hasSheets ? SHEETS_TOOL_DECLARATIONS : []),
    ...(sel.searchWeb ? [WEB_SEARCH_DECLARATION] : []),
  ];
}

export const MAX_TOOL_RESULT_BYTES = 30 * 1024;

/** Object.hasOwn (ES2022) without widening the package's lib setting. */
const hasOwn = (Object as unknown as { hasOwn(o: object, k: PropertyKey): boolean }).hasOwn;

const byteLength = (s: string) => Buffer.byteLength(s, "utf8");

/**
 * Shrinks a result to fit the model budget: drops items from the largest array
 * first, then falls back to a clipped JSON string. Always returns an object.
 */
export function truncateToolResult(result: any, maxBytes = MAX_TOOL_RESULT_BYTES): any {
  let json: string;
  try {
    json = JSON.stringify(result) ?? "null";
  } catch {
    return { success: false, error: "The tool returned a result that could not be serialised." };
  }
  if (byteLength(json) <= maxBytes) return result;

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const arrays = Object.entries(result).filter(([, v]) => Array.isArray(v)) as Array<[string, any[]]>;
    if (arrays.length > 0) {
      const [key, arr] = arrays.sort((a, b) => JSON.stringify(b[1]).length - JSON.stringify(a[1]).length)[0];
      let lo = 0;
      let hi = arr.length;
      // Binary search the largest prefix that fits.
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const candidate = { ...result, [key]: arr.slice(0, mid), truncated: true };
        if (byteLength(JSON.stringify(candidate)) <= maxBytes) lo = mid;
        else hi = mid - 1;
      }
      const candidate = { ...result, [key]: arr.slice(0, lo), truncated: true, note: `Showing ${lo} of ${arr.length} ${key}.` };
      if (byteLength(JSON.stringify(candidate)) <= maxBytes) return candidate;
    }
  }
  let clipped = json.slice(0, maxBytes - 200);
  while (byteLength(clipped) > maxBytes - 200) clipped = clipped.slice(0, -100);
  return { truncated: true, note: "Result truncated to fit the size limit.", partialJson: clipped };
}

/**
 * Runs one tool call. The name is resolved with Object.hasOwn against ONLY the
 * tools enabled for this request (so "constructor" or a disabled tool is an
 * unknown tool). Never throws: failures come back as {success:false, error},
 * so a tool error is reported to the model and never triggers model rotation.
 */
export async function executeTool(name: string, args: any, ctx: ToolContext, enabled: readonly string[]): Promise<any> {
  if (typeof name !== "string" || !enabled.includes(name) || !hasOwn(WUP_TOOLS_REGISTRY, name)) {
    return { success: false, error: `Unknown tool: ${String(name)}` };
  }
  const fn = WUP_TOOLS_REGISTRY[name];
  if (typeof fn !== "function") return { success: false, error: `Unknown tool: ${name}` };
  try {
    const safeArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
    const result = await fn(safeArgs, ctx);
    return truncateToolResult(result === undefined ? { success: true } : result);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
