import type { QueryRecord, ToolContext } from "../tools/types";

/**
 * Helpers shared by every bridge type (MongoDB, Google Sheets).
 */

/** How many queries each tool context has recorded, so a source can point at its QueryRecord. */
const queryCounts = new WeakMap<ToolContext, number>();

/**
 * Records a query through ctx.onQuery (so grounding and "Query used" work) and,
 * for a successful one, registers a data citation through ctx.registerSource.
 * Returns the citation number, when the orchestrator hands one out.
 *
 * The orchestrator's recorder appends every onQuery call, so the running count
 * per context is the record's index. If onQuery itself returns a number, that
 * wins.
 */
export function recordDataQuery(
  ctx: ToolContext,
  record: QueryRecord,
  rows?: Array<Record<string, any>>
): number | undefined {
  const counted = queryCounts.get(ctx) ?? 0;
  queryCounts.set(ctx, counted + 1);
  const returned: unknown = ctx.onQuery?.(record, rows);
  if (record.error || !ctx.registerSource) return undefined;

  const queryIndex = typeof returned === "number" ? returned : counted;
  try {
    const n = ctx.registerSource({
      kind: "data",
      title: `${record.connectionName}: ${record.db}.${record.collection}`,
      connectionName: record.connectionName,
      db: record.db,
      collection: record.collection,
      queryIndex,
    });
    return typeof n === "number" ? n : undefined;
  } catch {
    return undefined;
  }
}

/** Clamps a row list to a byte budget, returning the rows that fit. */
export function capRowsToBytes<T>(rows: T[], maxBytes: number): { rows: T[]; truncated: boolean } {
  let size = 2;
  const kept: T[] = [];
  for (const row of rows) {
    const rowSize = JSON.stringify(row).length + 1;
    if (size + rowSize > maxBytes) return { rows: kept, truncated: true };
    size += rowSize;
    kept.push(row);
  }
  return { rows: kept, truncated: false };
}

/**
 * An error a bridge raises for the API to show the user. `code` matches the
 * ErrorCode list in @wup/contracts; `status` is the suggested HTTP status.
 */
export class BridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "BridgeError";
  }
}
