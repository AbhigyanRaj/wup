/**
 * Read-only and scope enforcement for AI-generated queries.
 * Every check throws a GuardError whose message is safe to show the model,
 * so it can correct itself on the next turn.
 *
 * Pipelines are checked against an ALLOWLIST of stages; anything else
 * (writes, server inspection, search, $documents, future stages) is refused.
 * Inside every stage, filters and expressions are walked to reject:
 *   - server-side JS and schema-probing operators (ALWAYS_BLOCKED_OPS)
 *   - dynamic-key operators when any field is hidden (BLOCKED_WHEN_HIDDEN)
 *   - references to hidden fields as keys, "$a.b" paths or "$$var.a.b" paths
 *   - literal field-name arguments ($lookup localField, $getField field, ...)
 *     that name a hidden field, or are computed while fields are hidden
 *   - cross-collection stages that point outside the bridge scope
 */

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

export const SYSTEM_DBS = new Set(["admin", "local", "config"]);

export const ALLOWED_STAGES: ReadonlySet<string> = new Set([
  "$match",
  "$project",
  "$addFields",
  "$set",
  "$unset",
  "$group",
  "$sort",
  "$limit",
  "$skip",
  "$unwind",
  "$count",
  "$sortByCount",
  "$bucket",
  "$bucketAuto",
  "$facet",
  "$lookup",
  "$graphLookup",
  "$unionWith",
  "$replaceRoot",
  "$replaceWith",
  "$sample",
  "$setWindowFields",
  "$densify",
  "$fill",
  "$geoNear",
]);

/** Operators refused anywhere in a query: server-side JS and schema probing. */
export const ALWAYS_BLOCKED_OPS: ReadonlySet<string> = new Set(["$where", "$function", "$accumulator", "$jsonSchema"]);

/**
 * Operators that enumerate or search field names/values dynamically. When any
 * field is hidden they could reach a hidden value that static path checks
 * can't see.
 */
export const BLOCKED_WHEN_HIDDEN: ReadonlySet<string> = new Set(["$objectToArray", "$arrayToObject", "$text"]);

/**
 * Arguments that name a field as a plain string (not a "$path" expression).
 * They are checked against hidden fields; a computed (non-string) value is
 * rejected while any field is hidden.
 */
export const LITERAL_FIELD_ARGS: ReadonlyMap<string, readonly string[]> = new Map([
  ["$lookup", ["localField", "foreignField"]],
  ["$graphLookup", ["connectFromField", "connectToField"]],
  ["$densify", ["field", "partitionByFields"]],
  ["$fill", ["partitionByFields"]],
  ["$geoNear", ["key"]],
  ["$getField", ["field"]],
  ["$setField", ["field"]],
  ["$unsetField", ["field"]],
]);

/** Operators whose short form is a bare string field name, e.g. { $getField: "price" }. */
const STRING_SHORT_FORM = new Set(["$getField"]);

/** Expression operators (not stages) that take a field name. */
const EXPRESSION_FIELD_OPS = new Set(["$getField", "$setField", "$unsetField"]);

/** System variables that are always safe to reference on their own. */
const BLOCKED_VARIABLES = new Set(["USER_ROLES"]);

export const MAX_PIPELINE_STAGES = 30;
export const MAX_QUERY_DEPTH = 32;
export const MAX_QUERY_NODES = 5000;

const ALLOWED_STAGE_LIST = [...ALLOWED_STAGES].join(", ");

export interface ScopeEntry {
  db: string;
  collections: string[];
}

export interface GuardOptions {
  hidden: Set<string>;
  scope?: ScopeEntry[];
  db: string;
}

const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

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

const isPositionalSegment = (segment: string) =>
  segment === "" || segment === "$" || /^\d+$/.test(segment) || /^\$\[[^\]]*\]$/.test(segment);

/**
 * Returns the first hidden segment of a dotted field path, or undefined.
 * Every segment is checked (not just the leaf) so "tokens.0" is caught when
 * "tokens" is hidden and "auth.password" when "password" is hidden. Numeric
 * segments (array indexes), "$" and "$[]" are skipped.
 */
export function hitsHidden(path: string, hidden: Set<string>): string | undefined {
  if (hidden.size === 0) return undefined;
  for (const segment of path.split(".")) {
    if (isPositionalSegment(segment)) continue;
    if (hidden.has(segment)) return segment;
  }
  return undefined;
}

/** @deprecated alias of hitsHidden */
export const hiddenSegmentOf = hitsHidden;

/** Throws if a plain field path (e.g. a distinct field or localField) touches a hidden field. */
export function assertFieldPathAllowed(path: string, hidden: Set<string>) {
  const p = path.startsWith("$") && !path.startsWith("$$") ? path.slice(1) : path;
  const seg = hitsHidden(p, hidden);
  if (seg !== undefined) throw hiddenFieldError(seg);
}

/** Checks a string value: "$a.b" field paths and "$$var.a.b" variable paths. */
function checkStringReference(node: string, hidden: Set<string>) {
  if (!node.startsWith("$")) return;
  if (node.startsWith("$$")) {
    const dot = node.indexOf(".");
    const name = dot === -1 ? node.slice(2) : node.slice(2, dot);
    if (BLOCKED_VARIABLES.has(name)) throw new GuardError(`$$${name} is not available on wuup bridges.`);
    // Bare variables ($$ROOT, $$CURRENT, $$NOW, $$this) are fine: hidden
    // fields are stripped from every result. "$$ROOT.password" is a path.
    if (dot === -1 || hidden.size === 0) return;
    const seg = hitsHidden(node.slice(dot + 1), hidden);
    if (seg !== undefined) throw hiddenFieldError(seg);
    return;
  }
  if (hidden.size === 0) return;
  const seg = hitsHidden(node.slice(1), hidden);
  if (seg !== undefined) throw hiddenFieldError(seg);
}

const isExclusion = (v: unknown) => v === 0 || v === false;

/** BSON values and dates have no user-controlled keys. */
function isLeafObject(node: object): boolean {
  return Boolean((node as any)._bsontype) || node instanceof Date || node instanceof RegExp;
}

function isPlainObject(node: unknown): node is Record<string, unknown> {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return false;
  const proto = Object.getPrototypeOf(node);
  return proto === Object.prototype || proto === null;
}

type Mode = "expr" | "projection" | "sort";

/**
 * One walk over one query. Shares the node budget across sub-pipelines so a
 * $facet of $facets can't multiply the work.
 */
class Walker {
  private nodes = 0;

  constructor(private readonly opts: GuardOptions) {}

  private get hidden() {
    return this.opts.hidden;
  }

  private tick(depth: number) {
    if (++this.nodes > MAX_QUERY_NODES) {
      throw new GuardError(`This query is too large (more than ${MAX_QUERY_NODES} values). Simplify it.`);
    }
    if (depth > MAX_QUERY_DEPTH) {
      throw new GuardError(`This query is nested too deeply (more than ${MAX_QUERY_DEPTH} levels). Simplify it.`);
    }
  }

  pipeline(value: unknown, depth: number) {
    this.tick(depth);
    if (!Array.isArray(value)) throw new GuardError("pipeline must be a JSON array of stages.");
    if (value.length > MAX_PIPELINE_STAGES) {
      throw new GuardError(`A pipeline can have at most ${MAX_PIPELINE_STAGES} stages.`);
    }
    for (const stage of value) this.stage(stage, depth + 1);
  }

  private stage(stage: unknown, depth: number) {
    this.tick(depth);
    if (!isPlainObject(stage)) {
      throw new GuardError('Each pipeline stage must be a JSON object with one key, e.g. {"$match":{...}}.');
    }
    const keys = Object.keys(stage);
    if (keys.length !== 1) {
      throw new GuardError(
        `Each pipeline stage must have exactly one key, got ${keys.length === 0 ? "none" : keys.join(", ")}. Split it into separate stages.`
      );
    }
    const name = keys[0];
    if (!ALLOWED_STAGES.has(name)) {
      throw new GuardError(
        `${name} is not allowed. wuup bridges are read-only and support these stages: ${ALLOWED_STAGE_LIST}.`
      );
    }
    const arg = stage[name];
    const d = depth + 1;

    switch (name) {
      case "$match":
        return this.filter(arg, d);
      case "$project":
        return this.objectArg(name, arg, d, "projection");
      case "$sort":
        return this.sort(arg, d);
      case "$facet": {
        if (!isPlainObject(arg)) throw new GuardError("$facet takes an object of named sub-pipelines.");
        for (const key of Object.keys(arg)) {
          this.checkKey(key, "expr", arg[key]);
          this.pipeline(arg[key], d + 1);
        }
        return;
      }
      case "$lookup": {
        if (!isPlainObject(arg)) throw new GuardError("$lookup takes an object.");
        this.crossCollection(name, arg.from);
        this.literalFieldArgs(name, arg);
        for (const key of Object.keys(arg)) {
          if (key === "pipeline") this.pipeline(arg.pipeline, d + 1);
          else if (key !== "from") this.visit(arg[key], d + 1, "expr");
        }
        return;
      }
      case "$graphLookup": {
        if (!isPlainObject(arg)) throw new GuardError("$graphLookup takes an object.");
        this.crossCollection(name, arg.from);
        this.literalFieldArgs(name, arg);
        for (const key of Object.keys(arg)) {
          if (key === "restrictSearchWithMatch") this.filter(arg[key], d + 1);
          else if (key !== "from") this.visit(arg[key], d + 1, "expr");
        }
        return;
      }
      case "$unionWith": {
        if (typeof arg === "string") return this.crossCollection(name, arg);
        if (!isPlainObject(arg)) throw new GuardError("$unionWith takes a collection name or { coll, pipeline }.");
        this.crossCollection(name, arg.coll);
        for (const key of Object.keys(arg)) {
          if (key === "pipeline") this.pipeline(arg.pipeline, d + 1);
          else if (key !== "coll") this.visit(arg[key], d + 1, "expr");
        }
        return;
      }
      default:
        this.literalFieldArgsIfObject(name, arg);
        return this.visit(arg, d, "expr");
    }
  }

  filter(value: unknown, depth: number) {
    if (!isPlainObject(value)) {
      throw new GuardError('filter must be a JSON object, e.g. {"year":{"$gte":2000}}. Omit it to match all documents.');
    }
    this.visit(value, depth, "expr");
  }

  projection(value: unknown, depth: number) {
    if (!isPlainObject(value)) throw new GuardError('projection must be a JSON object, e.g. {"title":1,"_id":0}.');
    this.visit(value, depth, "projection");
  }

  sort(value: unknown, depth: number) {
    this.tick(depth);
    if (!isPlainObject(value)) throw new GuardError('sort must be a JSON object, e.g. {"year":-1}.');
    for (const key of Object.keys(value)) {
      this.checkKey(key, "sort", value[key]);
      const dir = value[key];
      const isMeta = isPlainObject(dir) && Object.keys(dir).length === 1 && dir.$meta === "textScore";
      if (dir !== 1 && dir !== -1 && !isMeta) {
        throw new GuardError(`Sort values must be 1, -1 or {"$meta":"textScore"} (got ${JSON.stringify(dir)} for "${key}").`);
      }
    }
  }

  private objectArg(stage: string, arg: unknown, depth: number, mode: Mode) {
    if (!isPlainObject(arg)) throw new GuardError(`${stage} takes an object.`);
    this.visit(arg, depth, mode);
  }

  private crossCollection(stage: string, target: unknown) {
    if (target === undefined) return;
    // Cross-database targets ({ db, coll }) are never allowed
    if (typeof target !== "string" || !isInScope(this.opts.scope, this.opts.db, target)) {
      const label = typeof target === "string" ? target : JSON.stringify(target);
      throw new GuardError(`${stage} into ${label} is not allowed: that collection is not enabled for this bridge.`);
    }
  }

  private literalFieldArgsIfObject(op: string, arg: unknown) {
    if (!LITERAL_FIELD_ARGS.has(op)) return;
    if (STRING_SHORT_FORM.has(op) && typeof arg === "string") return this.literalField(op, "field", arg);
    // { $getField: { $literal: "password" } } is the short form with a computed
    // name: an expression operator without a "field" argument is computed.
    if (isPlainObject(arg) && EXPRESSION_FIELD_OPS.has(op) && !hasOwn(arg, "field")) {
      return this.literalField(op, "field", arg);
    }
    if (isPlainObject(arg)) return this.literalFieldArgs(op, arg);
    if (this.hidden.size > 0) {
      throw new GuardError(`${op} needs a literal field name while some fields are hidden by this bridge's privacy settings.`);
    }
  }

  private literalFieldArgs(op: string, arg: Record<string, unknown>) {
    for (const param of LITERAL_FIELD_ARGS.get(op) ?? []) {
      if (!hasOwn(arg, param)) continue;
      const value = arg[param];
      if (Array.isArray(value)) for (const v of value) this.literalField(op, param, v);
      else this.literalField(op, param, value);
    }
  }

  private literalField(op: string, param: string, value: unknown) {
    if (typeof value === "string") {
      const seg = hitsHidden(value.startsWith("$") && !value.startsWith("$$") ? value.slice(1) : value, this.hidden);
      if (seg !== undefined) throw hiddenFieldError(seg);
      return;
    }
    if (value === undefined || value === null) return;
    if (this.hidden.size > 0) {
      throw new GuardError(
        `${op}.${param} must be a literal field name while some fields are hidden by this bridge's privacy settings.`
      );
    }
  }

  private checkKey(key: string, mode: Mode, child: unknown) {
    if (key === "__proto__") throw new GuardError('"__proto__" is not a valid field name.');
    if (key.startsWith("$")) return;
    const seg = hitsHidden(key, this.hidden);
    if (seg === undefined) return;
    // { password: 0 } in a projection removes the hidden field: always safe.
    if (mode === "projection" && isExclusion(child)) return;
    throw hiddenFieldError(seg);
  }

  visit(node: unknown, depth: number, mode: Mode) {
    this.tick(depth);
    if (typeof node === "string") return checkStringReference(node, this.hidden);
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) this.visit(item, depth + 1, "expr");
      return;
    }
    if (isLeafObject(node)) return;
    if (!isPlainObject(node)) throw new GuardError("Queries must be plain JSON.");

    for (const key of Object.keys(node)) {
      const child = node[key];
      this.checkKey(key, mode, child);

      if (!key.startsWith("$")) {
        // Nested projection specs ({ auth: { password: 0 } }) stay in projection context
        this.visit(child, depth + 1, mode === "projection" ? "projection" : "expr");
        continue;
      }

      if (ALWAYS_BLOCKED_OPS.has(key)) {
        throw new GuardError(`${key} is not allowed. wuup bridges are read-only and never run server-side code.`);
      }
      if (this.hidden.size > 0 && BLOCKED_WHEN_HIDDEN.has(key)) {
        throw new GuardError(
          `${key} is not allowed on this collection because some fields are hidden by the bridge's privacy settings.`
        );
      }
      this.literalFieldArgsIfObject(key, child);
      // Operators reset projection context
      this.visit(child, depth + 1, "expr");
    }
  }
}

/** Validates an aggregation pipeline: at most 30 allowlisted stages, each a one-key object. */
export function assertSafePipeline(pipeline: unknown, opts: GuardOptions): void {
  new Walker(opts).pipeline(pipeline, 0);
}

/** Validates a find/count/distinct filter (must be a plain object). */
export function assertSafeFilter(filter: unknown, opts: GuardOptions): void {
  new Walker(opts).filter(filter, 0);
}

/** Validates a find projection. Excluding hidden fields is allowed; including them is not. */
export function assertSafeProjection(projection: unknown, opts: GuardOptions): void {
  new Walker(opts).projection(projection, 0);
}

/** Validates a sort spec: values must be 1, -1 or {"$meta":"textScore"}. */
export function assertSafeSort(sort: unknown, opts: GuardOptions): void {
  new Walker(opts).sort(sort, 0);
}

/**
 * @deprecated compatibility wrapper. Arrays are checked as pipelines,
 * `projection: true` as a projection, anything else as a filter.
 */
export function assertSafeQuery(value: unknown, opts: GuardOptions & { projection?: boolean }) {
  if (Array.isArray(value)) return assertSafePipeline(value, opts);
  if (opts.projection) return assertSafeProjection(value, opts);
  return assertSafeFilter(value, opts);
}

const hiddenFieldError = (field: string) =>
  new GuardError(`The field "${field}" is hidden by this bridge's privacy settings and can't be queried.`);
