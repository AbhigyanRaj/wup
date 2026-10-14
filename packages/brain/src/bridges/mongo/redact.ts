/**
 * Privacy layer: fields whose names look sensitive are hidden from the AI.
 *
 * Redactions are stored per "db.collection" as field paths (editable by the
 * user). Enforcement uses the leaf field name at any depth, so a hidden
 * "password" can't leak through a nested object, a $lookup, or a rename.
 */

/** Any of these tokens marks a field as sensitive. */
const SENSITIVE_TOKENS = new Set(["password", "passwd", "pwd", "secret", "jwt", "ssn", "cvv", "cvc", "otp", "salt"]);
/** "token" / "hash" / "key" are only sensitive after one of these, e.g. apiKey, accessToken. */
const CREDENTIAL_SUFFIXES = new Set(["token", "hash", "key"]);
const CREDENTIAL_PREFIXES = new Set(["api", "private", "secret", "access", "refresh", "auth", "session"]);
/** Token pairs that are sensitive together, e.g. cardNumber, credit_card. */
const SENSITIVE_PAIRS: Array<[string, string]> = [
  ["card", "number"],
  ["credit", "card"],
  ["client", "secret"],
];
/** Fields holding only these types can't carry a secret worth hiding. */
const HARMLESS_TYPES = new Set(["bool", "number", "date"]);

/**
 * Splits a field name into lowercase word tokens on camelCase, snake_case,
 * kebab-case, dots and digits: "apiKey2" -> ["api", "key"].
 */
export function tokenizeFieldName(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

/** Whether a single field name looks like it holds a credential or personal secret. */
export function isSensitiveFieldName(name: string): boolean {
  const tokens = tokenizeFieldName(name);
  if (tokens.some((t) => SENSITIVE_TOKENS.has(t))) return true;
  const last = tokens.length - 1;
  if (last >= 1 && CREDENTIAL_SUFFIXES.has(tokens[last]) && CREDENTIAL_PREFIXES.has(tokens[last - 1])) return true;
  const set = new Set(tokens);
  return SENSITIVE_PAIRS.some(([a, b]) => set.has(a) && set.has(b));
}

export type RedactionMap = Record<string, string[]>;

export const redactionKey = (db: string, collection: string) => `${db}.${collection}`;

export const leafOf = (path: string) => path.split(".").pop() ?? path;

/** Picks field paths that look sensitive, or hold binary blobs (e.g. embeddings). */
export function detectSensitiveFields(fields: Array<{ path: string; types: string[] }>): string[] {
  return fields
    .filter((f) => {
      const types = f.types ?? [];
      if (types.includes("binary")) return true;
      const meaningful = types.filter((t) => t !== "null");
      if (meaningful.length > 0 && meaningful.every((t) => HARMLESS_TYPES.has(t))) return false;
      return isSensitiveFieldName(leafOf(f.path));
    })
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
