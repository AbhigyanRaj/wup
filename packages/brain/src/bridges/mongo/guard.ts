import { leafOf } from "./redact";

/**
 * Read-only and scope enforcement for AI-generated queries.
 * Every check throws a GuardError whose message is safe to show the model,
 * so it can correct itself on the next turn.
 */

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

export const SYSTEM_DBS = new Set(["admin", "local", "config"]);

/** Stages/operators that write data, run server-side JS, or inspect the server. */
const BLOCKED_OPERATORS = new Set([
  "$out",
  "$merge",
  "$function",
  "$accumulator",
  "$where",
  "$currentOp",
  "$listSessions",
  "$listLocalSessions",
]);

/** Stages that read another collection, which must also be in scope. */
const CROSS_COLLECTION_STAGES: Record<string, (v: any) => unknown> = {
  $lookup: (v) => v?.from,
  $graphLookup: (v) => v?.from,
  $unionWith: (v) => (typeof v === "string" ? v : v?.coll),
};

export interface ScopeEntry {
  db: string;
  collections: string[];
}

/** Whether a db/collection is allowed by a bridge's scope (empty scope = all non-system dbs). */
export function isInScope(scope: ScopeEntry[] | undefined, db: string, collection?: string): boolean {
  if (SYSTEM_DBS.has(db)) return false;
  if (collection !== undefined && collection.startsWith("system.")) return false;
  if (!scope || scope.length === 0) return true;
  const entry = scope.find((s) => s.db === db);
  if (!entry) return false;
  if (collection === undefined) return true;
  return entry.collections.includes("*") || entry.collections.includes(collection);
}

export function assertInScope(scope: ScopeEntry[] | undefined, db: string, collection: string) {
  if (!db || !collection) throw new GuardError("Both db and collection are required.");
  if (!isInScope(scope, db, collection)) {
    throw new GuardError(
      `${db}.${collection} is not enabled for this bridge. Call mongo_list_sources to see what is available.`
    );
  }
}

/**
 * Walks any filter/projection/sort/pipeline and rejects:
 *   - write or server-side-JS operators
 *   - references to hidden (redacted) fields, as keys or "$field" paths
 *   - cross-collection stages that point outside the bridge scope
 */
export function assertSafeQuery(
  value: unknown,
  opts: { hidden: Set<string>; scope?: ScopeEntry[]; db: string }
) {
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      if (node.startsWith("$") && !node.startsWith("$$")) {
        const leaf = leafOf(node.slice(1));
        if (opts.hidden.has(leaf)) throw hiddenFieldError(leaf);
      }
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    // BSON values (ObjectId, Date, …) have no user-controlled keys
    if ((node as any)._bsontype || node instanceof Date) return;

    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (BLOCKED_OPERATORS.has(key)) {
        throw new GuardError(`${key} is not allowed. WUUP bridges are strictly read-only.`);
      }
      const target = CROSS_COLLECTION_STAGES[key]?.(child);
      // Cross-database targets ({ db, coll }) are never allowed
      if (target !== undefined && (typeof target !== "string" || !isInScope(opts.scope, opts.db, target))) {
        const label = typeof target === "string" ? target : JSON.stringify(target);
        throw new GuardError(`${key} into ${label} is not allowed: that collection is not enabled for this bridge.`);
      }
      if (!key.startsWith("$") && opts.hidden.has(leafOf(key))) {
        throw hiddenFieldError(leafOf(key));
      }
      visit(child);
    }
  };
  visit(value);
}

const hiddenFieldError = (field: string) =>
  new GuardError(`The field "${field}" is hidden by this bridge's privacy settings and can't be queried.`);
