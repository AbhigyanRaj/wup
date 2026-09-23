/**
 * Context passed to every tool call by the orchestrator. Tools must scope all
 * data access to ctx.userId: the model supplies connectionIds, and a
 * connectionId alone is never proof of ownership.
 */
export interface ToolContext {
  userId: string;
  /** Bridges enabled for the current chat. Empty/undefined = all of the user's bridges. */
  allowedConnectionIds?: string[];
  /** Called after each database query so the orchestrator can ground visuals and show "Query used". */
  onQuery?: (record: QueryRecord, rows?: Array<Record<string, any>>) => void;
  /** Progress messages streamed to the UI. */
  onStatus?: (message: string) => void;
}

export interface QueryRecord {
  tool: string;
  connectionName: string;
  db: string;
  collection: string;
  query: string;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  error?: string;
}

export type ToolFn = (args: any, ctx: ToolContext) => Promise<any>;
