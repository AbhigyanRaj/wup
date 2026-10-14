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
  "$collStats",
  "$indexStats",
  "$planCacheStats",
  "$listSearchIndexes",
  "$search",
  "$searchMeta",
  "$vectorSearch",
  "$jsonSchema",
  "$changeStream",
  "$querySettings",
  "$listSampledQueries",
  "$documents",
]);

/**
 * Operators that read or build field names dynamically. When any field is
 * hidden they could be used to reach a hidden value under a computed name,
 * which static path checks can't see.
 */
const DYNAMIC_KEY_OPERATORS = new Set([
  "$getField",
  "$setField",
  "$unsetField",
  "$objectToArray",
  "$arrayToObject",
]);

/** Stages that read another collection, which must also be in scope. */
const CROSS_COLLECTION_STAGES = new Map<string, (v: any) => unknown>([
  ["$lookup", (v) => v?.from],
  ["$graphLookup", (v) => v?.from],
  ["$unionWith", (v) => (typeof v === "string" ? v : v?.coll)],
]);

/** Stage parameters that name a field (as a plain path, not a "$path" expression). */
const FIELD_NAME_PARAMS = new Map<string, string[]>([
  ["$lookup", ["localField", "foreignField"]],
  ["$graphLookup", ["connectFromField", "connectToField"]],
]);

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
 * Returns the first hidden segment of a dotted field path, or undefined.
 * Every segment is checked (not just the leaf) so "tokens.0" is caught when
 * "tokens" is hidden and "auth.password" when "password" is hidden. Numeric
 * segments (array indexes) are skipped.
 */
export function hiddenSegmentOf(path: string, hidden: Set<string>): string | undefined {
  if (hidden.size === 0) return undefined;
  for (const segment of path.split(".")) {
    if (segment === "" || /^\d+$/.test(segment)) continue;
    if (hidden.has(segment)) return segment;
  }
  return undefined;
}

/** Throws if a plain field path (e.g. a distinct field or localField) touches a hidden field. */
export function assertFieldPathAllowed(path: string, hidden: Set<string>) {
  const p = path.startsWith("$") && !path.startsWith("$$") ? path.slice(1) : path;
  const seg = hiddenSegmentOf(p, hidden);
  if (seg !== undefined) throw hiddenFieldError(seg);
}

/** Checks a string value: "$a.b" field paths and "$$var.a.b" variable paths. */
function checkStringReference(node: string, hidden: Set<string>) {
  if (!node.startsWith("$") || hidden.size === 0) return;
  let path: string;
  if (node.startsWith("$$")) {
    // "$$ROOT.password", "$$CURRENT.auth.token", "$$this.password": the part
    // after the variable name is a field path.
    const dot = node.indexOf(".");
    if (dot === -1) return;
    path = node.slice(dot + 1);
  } else {
    path = node.slice(1);
  }
  const seg = hiddenSegmentOf(path, hidden);
  if (seg !== undefined) throw hiddenFieldError(seg);
}

const isExclusion = (v: unknown) => v === 0 || v === false;

/**
 * Walks any filter/projection/sort/pipeline and rejects:
 *   - write, server-side-JS and server-inspection operators
 *   - references to hidden (redacted) fields, as keys, "$field" paths or "$$var.field" paths
 *   - dynamic-key operators when any field is hidden
 *   - cross-collection stages that point outside the bridge scope
 *
 * Excluding a hidden field ({ password: 0 }) is allowed in a projection
 * (pass `projection: true`) and inside a $project stage.
 */
export function assertSafeQuery(
  value: unknown,
  opts: { hidden: Set<string>; scope?: ScopeEntry[]; db: string; projection?: boolean }
) {
  const hidden = opts.hidden;

  const visit = (node: unknown, inProjection: boolean) => {
    if (typeof node === "string") {
      checkStringReference(node, hidden);
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, false);
      return;
    }
    // BSON values (ObjectId, Date, …) have no user-controlled keys
    if ((node as any)._bsontype || node instanceof Date) return;

    for (const key of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[key];

      if (BLOCKED_OPERATORS.has(key)) {
        throw new GuardError(`${key} is not allowed. WUUP bridges are strictly read-only.`);
      }
      if (hidden.size > 0 && DYNAMIC_KEY_OPERATORS.has(key)) {
        throw new GuardError(
          `${key} is not allowed on this collection because some fields are hidden by the bridge's privacy settings.`
        );
      }

      const crossCollection = CROSS_COLLECTION_STAGES.get(key);
      if (crossCollection) {
        const target = crossCollection(child);
        // Cross-database targets ({ db, coll }) are never allowed
        if (target !== undefined && (typeof target !== "string" || !isInScope(opts.scope, opts.db, target))) {
          const label = typeof target === "string" ? target : JSON.stringify(target);
          throw new GuardError(`${key} into ${label} is not allowed: that collection is not enabled for this bridge.`);
        }
      }

      const fieldParams = FIELD_NAME_PARAMS.get(key);
      if (fieldParams && child && typeof child === "object" && !Array.isArray(child)) {
        for (const param of fieldParams) {
          if (!Object.prototype.hasOwnProperty.call(child, param)) continue;
          const fieldPath = (child as Record<string, unknown>)[param];
          if (typeof fieldPath === "string") assertFieldPathAllowed(fieldPath, hidden);
        }
      }

      if (key.startsWith("$")) {
        // Operators reset projection context, except $project whose spec is a projection.
        visit(child, key === "$project");
        continue;
      }

      const seg = hiddenSegmentOf(key, hidden);
      if (seg !== undefined) {
        // { password: 0 } in a projection removes the hidden field: always safe.
        if (inProjection && isExclusion(child)) continue;
        throw hiddenFieldError(seg);
      }
      // Nested projection specs ({ auth: { password: 0 } }) stay in projection context
      visit(child, inProjection);
    }
  };
  visit(value, opts.projection === true);
}

const hiddenFieldError = (field: string) =>
  new GuardError(`The field "${field}" is hidden by this bridge's privacy settings and can't be queried.`);
