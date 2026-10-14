import type { StatusCode } from "@wup/contracts";
import { executeTool } from "../tools/registry";
import type { ToolContext } from "../tools/types";
import { log } from "../ai/common";
import type { SourceRegistry } from "../citations/sourceRegistry";
import type { QueryRecorder } from "./grounding";
import type { BrainEvent } from "./types";

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 3)}...` : s);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function toolStatusCode(name: string): StatusCode {
  if (name === "web_search") return "tool.web";
  if (name === "read_sheets" || name === "get_sheets_metadata") return "tool.sheets";
  return "tool.db";
}

/** A short human label for a tool call, shown in the UI while it runs. */
export function toolLabel(name: string, args: any): string {
  const where = args?.db && args?.collection ? `${str(args.db)}.${str(args.collection)}` : str(args?.collection);
  switch (name) {
    case "mongo_count":
      return clip(`Counting documents in ${where}`, 120);
    case "mongo_find":
      return clip(`Reading ${where}`, 120);
    case "mongo_aggregate":
      return clip(`Aggregating ${where}`, 120);
    case "mongo_distinct":
      return clip(`Listing values of ${str(args?.field)} in ${where}`, 120);
    case "mongo_describe":
      return clip(`Inspecting ${where}`, 120);
    case "mongo_list_sources":
      return "Listing collections";
    case "read_sheets":
      return clip(`Reading sheet ${str(args?.sheetName)}`.trim(), 120);
    case "get_sheets_metadata":
      return "Listing sheet tabs";
    case "web_search":
      return clip(`Searching the web for "${str(args?.query)}"`, 120);
    default:
      return clip(`Running ${name}`, 120);
  }
}

export interface ToolRunnerOptions {
  userId: string;
  bridgeIds?: string[];
  emit: (e: BrainEvent) => void;
  signal: AbortSignal;
  sources: SourceRegistry;
  recorder: QueryRecorder;
  /** Tools enabled for this request. */
  enabled: string[];
  /** Overall tool-call budget (research mode). */
  maxCalls?: number;
}

export const TOOL_BUDGET_MESSAGE = "The tool budget for this request is used up. Answer with what you already have.";

/**
 * Wraps registry.executeTool with tool/status events, the query recorder,
 * data-source registration and an optional call budget.
 */
export class ToolRunner {
  calls = 0;
  readonly ctx: ToolContext;

  constructor(private readonly o: ToolRunnerOptions) {
    this.ctx = {
      userId: o.userId,
      allowedConnectionIds: o.bridgeIds && o.bridgeIds.length > 0 ? o.bridgeIds : undefined,
      onQuery: (record, rows) => {
        const idx = o.recorder.record(record, rows);
        if (idx >= 0 && !record.error) {
          o.sources.register({
            kind: "data",
            title: `${record.connectionName}: ${record.db}.${record.collection}`,
            connectionName: record.connectionName,
            db: record.db,
            collection: record.collection,
            queryIndex: idx,
          });
        }
        return idx as any;
      },
      onStatus: (message) => o.emit({ type: "status", message }),
      signal: o.signal,
      registerSource: (s) => o.sources.register(s),
      log: log(),
    };
  }

  /** Runs one tool call for `allowed` (defaults to every enabled tool). Never throws. */
  execute = async (name: string, args: any, allowed: readonly string[] = this.o.enabled): Promise<any> => {
    if (this.o.signal.aborted) return { success: false, error: "Stopped." };
    if (this.o.maxCalls !== undefined && this.calls >= this.o.maxCalls) return { success: false, error: TOOL_BUDGET_MESSAGE };
    this.calls++;
    const id = `tool_${this.calls}`;
    const label = toolLabel(String(name), args);
    this.o.emit({ type: "status", message: label, code: toolStatusCode(String(name)) });
    this.o.emit({ type: "tool", id, name: String(name), label, state: "running" });

    const before = this.o.recorder.queries.length;
    const result = await executeTool(name, args, this.ctx, allowed.filter((t) => this.o.enabled.includes(t)));
    const added = this.o.recorder.queries.slice(before);
    const query = added[added.length - 1];
    const failed = result?.success === false || (typeof result?.error === "string" && result.error) || !!query?.error;
    this.o.emit({
      type: "tool",
      id,
      name: String(name),
      label,
      state: failed ? "error" : "done",
      ...(query?.query ? { query: query.query } : {}),
    });
    return result;
  };
}
