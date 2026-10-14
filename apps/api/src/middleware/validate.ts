/**
 * Zod request validation. Parsed output is written back, so transforms and
 * defaults apply:
 *
 *   validate({ body: LoginBodySchema })                  // req.body = parsed
 *   validate({ query: ListQuery, params: IdParams })     // req.validatedQuery, req.params
 *   validate(BodySchema)                                 // a bare schema means body
 *   validate(z.object({ body: ..., params: ... }))       // legacy wrapper form, still supported
 *
 * Failures go to the error middleware as 400 VALIDATION_FAILED with details.
 */
import type { NextFunction, Request, Response } from "express";
import { z, ZodError, type ZodType } from "zod";

export interface ValidateParts {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

const PART_KEYS = new Set(["body", "query", "params"]);

function isZodSchema(v: unknown): v is ZodType {
  return !!v && typeof v === "object" && typeof (v as any).safeParseAsync === "function";
}

/** z.object({ body?, query?, params? }) with no other keys: the legacy wrapper form. */
function isLegacyWrapper(schema: ZodType): schema is z.ZodObject<any> {
  if (!(schema instanceof z.ZodObject)) return false;
  const keys = Object.keys(schema.shape);
  return keys.length > 0 && keys.every((k) => PART_KEYS.has(k));
}

function prefixIssues(err: ZodError, prefix: string | null): ZodError {
  if (!prefix) return err;
  return new ZodError(err.issues.map((i) => ({ ...i, path: [prefix, ...i.path] })));
}

function setQuery(req: Request, value: unknown) {
  req.validatedQuery = value;
  try {
    // Writable in Express 4; a getter in Express 5, where this is skipped.
    (req as any).query = value;
  } catch {
    /* ignore */
  }
}

export function validate(schemaOrParts: ZodType | ValidateParts) {
  let parts: ValidateParts;
  let legacy: z.ZodObject<any> | null = null;

  if (isZodSchema(schemaOrParts)) {
    if (isLegacyWrapper(schemaOrParts)) legacy = schemaOrParts;
    else parts = { body: schemaOrParts };
  } else {
    parts = schemaOrParts ?? {};
  }

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (legacy) {
        const shape = legacy.shape;
        const parsed: any = await legacy.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        if ("body" in shape) req.body = parsed.body;
        if ("params" in shape) req.params = parsed.params;
        if ("query" in shape) setQuery(req, parsed.query);
        return next();
      }

      const issues: ZodError["issues"] = [];
      const run = async (schema: ZodType | undefined, input: unknown, prefix: string | null) => {
        if (!schema) return { ok: false as const };
        const r = await schema.safeParseAsync(input);
        if (r.success) return { ok: true as const, data: r.data };
        issues.push(...prefixIssues(r.error, prefix).issues);
        return { ok: false as const };
      };

      const body = await run(parts!.body, req.body, null);
      const query = await run(parts!.query, req.query, "query");
      const params = await run(parts!.params, req.params, "params");
      if (issues.length) return next(new ZodError(issues));

      if (body.ok) req.body = body.data;
      if (query.ok) setQuery(req, query.data);
      if (params.ok) req.params = params.data as any;
      next();
    } catch (err) {
      next(err);
    }
  };
}
