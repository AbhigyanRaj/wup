import type { QueryRecord } from "@wup/contracts";

/** One database or sheet query run while answering. Shared with the API and web via @wup/contracts. */
export type { QueryRecord };

/** Minimal structured logger (pino and console both satisfy it). */
export interface ToolLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Context passed to every tool call by the orchestrator. Tools must scope all
 * data access to ctx.userId: the model supplies connectionIds, and a
 * connectionId alone is never proof of ownership.
 */
export interface ToolContext {
  userId: string;
  /** Bridges enabled for the current chat. Empty/undefined = all of the user's bridges. */
  allowedConnectionIds?: string[];
  /**
   * Called after each database query so the orchestrator can ground visuals and
   * show "Query used". `rows` are the (redacted) result rows, when there are any.
   */
  onQuery?: (record: QueryRecord, rows?: Array<Record<string, any>>) => void;
  /** Progress messages streamed to the UI. */
  onStatus?: (message: string) => void;
  /** Aborted when the user stops generation or disconnects. Tools should pass it to drivers and bail early. */
  signal?: AbortSignal;
  /**
   * Registers a citation (a Source from @wup/contracts without its `n`) and
   * returns its 1-based citation number for [n] markers.
   */
  registerSource?: (source: unknown) => number;
  /** Request-scoped logger. */
  log?: ToolLogger;
}

export type ToolFn = (args: any, ctx: ToolContext) => Promise<any>;
