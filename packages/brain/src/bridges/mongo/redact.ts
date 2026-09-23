/**
 * Privacy layer: fields matching these patterns are hidden from the AI.
 *
 * Redactions are stored per "db.collection" as field paths (editable by the
 * user). Enforcement uses the leaf field name at any depth, so a hidden
 * "password" can't leak through a nested object, a $lookup, or a rename.
 */

const SENSITIVE_FIELD_RE =
  /(password|passwd|pwd|secret|token|jwt|api_?key|apikey|private_?key|ssn|cvv|otp|salt|hash|card_?number|credit_?card)/i;

export type RedactionMap = Record<string, string[]>;

export const redactionKey = (db: string, collection: string) => `${db}.${collection}`;

export const leafOf = (path: string) => path.split(".").pop() ?? path;

/** Picks field paths that look sensitive, or hold binary blobs (e.g. embeddings). */
export function detectSensitiveFields(fields: Array<{ path: string; types: string[] }>): string[] {
  return fields
    .filter((f) => SENSITIVE_FIELD_RE.test(leafOf(f.path)) || f.types.includes("binary"))
    .map((f) => f.path);
}

/**
 * Leaf names hidden for a query. Includes every collection in the db because
 * aggregation can pull other collections in via $lookup / $unionWith.
 */
export function hiddenLeavesForDb(redactions: RedactionMap | undefined, db: string): Set<string> {
  const leaves = new Set<string>();
  for (const [key, paths] of Object.entries(redactions ?? {})) {
    if (!key.startsWith(`${db}.`) || !Array.isArray(paths)) continue;
    for (const p of paths) leaves.add(leafOf(p));
  }
  return leaves;
}

/** Removes hidden fields at any depth. Input is expected to be plain JSON. */
export function redactValue<T>(value: T, hidden: Set<string>): T {
  if (hidden.size === 0 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, hidden)) as any;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    if (hidden.has(k)) continue;
    out[k] = redactValue(v, hidden);
  }
  return out as T;
}
