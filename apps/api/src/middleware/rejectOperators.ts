/**
 * Rejects request bodies and query strings that contain object KEYS starting
 * with "$" (MongoDB operator injection, e.g. { "email": { "$gt": "" } } or
 * ?id[$ne]=x), plus "__proto__" keys. Only keys are checked: string VALUES may
 * contain "$" freely.
 *
 * Skipped for routes whose bodies legitimately carry user-defined keys or
 * free-form documents:
 *   /connections/**        bridge configs, scopes, redaction maps
 *   /chats/:id/messages    chat content
 *   /public/**             marketing tools (own parser and validation)
 */
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/httpError";

const EXCLUDED: RegExp[] = [/^\/connections(\/|$)/, /^\/chats\/[^/]+\/messages(\/|$)/, /^\/public(\/|$)/];

const MAX_NODES = 100_000;

/** Returns the path of the first forbidden key, or null. Iterative (no recursion limits). */
export function findForbiddenKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const stack: Array<{ v: unknown; path: string }> = [{ v: value, path: "" }];
  let seen = 0;
  while (stack.length) {
    const { v, path } = stack.pop()!;
    if (++seen > MAX_NODES) return path || "(too deep)";
    if (!v || typeof v !== "object") continue;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        if (v[i] && typeof v[i] === "object") stack.push({ v: v[i], path: `${path}[${i}]` });
      }
      continue;
    }
    for (const key of Object.keys(v as object)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key.startsWith("$") || key === "__proto__") return childPath;
      const child = (v as any)[key];
      if (child && typeof child === "object") stack.push({ v: child, path: childPath });
    }
  }
  return null;
}

export function rejectOperators(req: Request, _res: Response, next: NextFunction) {
  const path = req.path;
  if (EXCLUDED.some((re) => re.test(path))) return next();
  const bad = findForbiddenKey(req.body) ?? findForbiddenKey(req.query);
  if (bad) {
    return next(
      new HttpError(400, "VALIDATION_FAILED", "Invalid request: keys may not start with \"$\".", [
        { path: bad, message: "Forbidden key" },
      ])
    );
  }
  next();
}
