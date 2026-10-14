/**
 * Free public tools: plain English (or SQL) to MongoDB, and pipeline
 * explanations. Gemini writes JSON against a response schema; the output is
 * validated with zod and run through the read-only guard (with no hidden
 * fields). A rejected answer is regenerated once with the problem as
 * feedback, then the call fails cleanly. Nothing is ever executed.
 */
import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";
import type { ZodType } from "zod";
import { GuardError, assertSafeFilter, assertSafePipeline, assertSafeProjection, assertSafeSort } from "../bridges/mongo/guard";
import {
  AGGREGATION_SYSTEM,
  EXPLAIN_SYSTEM,
  QUERY_SYSTEM,
  SQL_SYSTEM,
  explainUserMessage,
  queryUserMessage,
  retryFeedback,
  sqlUserMessage,
} from "./prompts";
import {
  EXPLAIN_RESPONSE_SCHEMA,
  QUERY_RESPONSE_SCHEMA,
  RawExplainOutputSchema,
  RawQueryOutputSchema,
  type GeneratedExplanation,
  type GeneratedQuery,
  type RawQueryOutput,
} from "./schemas";

export const DEFAULT_PUBLIC_TOOLS_MODEL = "gemini-2.5-flash";

/** Operators that are refused anywhere in a public tool answer, at any depth. */
export const PUBLIC_BLOCKED_OPERATORS: ReadonlySet<string> = new Set([
  "$out",
  "$merge",
  "$where",
  "$function",
  "$accumulator",
  "$currentOp",
  "$listSessions",
  "$listLocalSessions",
]);

export type PublicToolErrorCode = "NOT_CONFIGURED" | "UNSAFE_OUTPUT" | "INVALID_OUTPUT" | "PROVIDER_ERROR";

export class PublicToolError extends Error {
  constructor(
    readonly code: PublicToolErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PublicToolError";
  }
}

/** One JSON completion. Swappable in tests. */
export type JsonCompleter = (req: { system: string; user: string; schema: ResponseSchema }) => Promise<string>;

export interface PublicToolOptions {
  /** Defaults to process.env.GEMINI_API_KEY. */
  apiKey?: string;
  /** Defaults to process.env.PUBLIC_TOOLS_MODEL, then gemini-2.5-flash. */
  model?: string;
  /** Override the model call (tests). */
  complete?: JsonCompleter;
}

function geminiCompleter(opts: PublicToolOptions): JsonCompleter {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new PublicToolError("NOT_CONFIGURED", "The free tools are not configured on this server.");
  const modelName = opts.model ?? (process.env.PUBLIC_TOOLS_MODEL || DEFAULT_PUBLIC_TOOLS_MODEL);
  const client = new GoogleGenerativeAI(apiKey);
  return async ({ system, user, schema }) => {
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: system,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    try {
      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: user }] }] });
      return result.response.text();
    } catch (err) {
      throw new PublicToolError("PROVIDER_ERROR", "The model is unavailable right now. Please try again in a minute.");
    }
  };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

/** Throws GuardError if any key at any depth is a blocked operator. */
export function assertNoBlockedOperators(value: unknown, depth = 0): void {
  if (depth > 64 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoBlockedOperators(item, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PUBLIC_BLOCKED_OPERATORS.has(key)) {
      throw new GuardError(`${key} is not allowed: the free tools only write read-only queries.`);
    }
    assertNoBlockedOperators(child, depth + 1);
  }
}

const GUARD_OPTS = { hidden: new Set<string>(), db: "public" };

function parseJsonPart(text: string | undefined, label: string, shape: "object" | "array"): any {
  if (text === undefined || text.trim() === "") return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new GuardError(`${label} is not valid JSON.`);
  }
  if (shape === "array" ? !Array.isArray(value) : value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GuardError(`${label} must be a JSON ${shape}.`);
  }
  return value;
}

/** Parses and checks a raw query answer. Throws GuardError with a model-safe message. */
export function checkQueryOutput(raw: RawQueryOutput, forceKind?: "aggregate"): GeneratedQuery {
  const kind = raw.kind;
  if (forceKind && kind !== forceKind) throw new GuardError(`Answer with kind "${forceKind}".`);
  const collection = raw.collection.trim() || "collection";
  if (collection.startsWith("system.") || collection.includes("$")) {
    throw new GuardError(`"${collection}" is not a valid collection name.`);
  }
  const out: GeneratedQuery = {
    kind,
    collection,
    explanation: raw.explanation,
    assumptions: raw.assumptions,
    warnings: raw.warnings,
  };

  if (kind === "aggregate") {
    const pipeline = parseJsonPart(raw.pipelineJson, "pipelineJson", "array");
    if (!pipeline) throw new GuardError('kind "aggregate" needs a pipelineJson array.');
    assertNoBlockedOperators(pipeline);
    assertSafePipeline(pipeline, GUARD_OPTS);
    out.pipeline = pipeline;
    return out;
  }

  const filter = parseJsonPart(raw.filterJson, "filterJson", "object") ?? {};
  const projection = parseJsonPart(raw.projectionJson, "projectionJson", "object");
  const sort = parseJsonPart(raw.sortJson, "sortJson", "object");
  assertNoBlockedOperators([filter, projection ?? {}, sort ?? {}]);
  assertSafeFilter(filter, GUARD_OPTS);
  if (projection && Object.keys(projection).length) assertSafeProjection(projection, GUARD_OPTS);
  if (sort && Object.keys(sort).length) assertSafeSort(sort, GUARD_OPTS);
  out.filter = filter;
  if (projection && Object.keys(projection).length) out.projection = projection;
  if (sort && Object.keys(sort).length) out.sort = sort;
  if (raw.limit !== undefined && raw.limit > 0) out.limit = raw.limit;
  return out;
}

/* ------------------------------------------------------------------ */
/* Generation with one corrective retry                                */
/* ------------------------------------------------------------------ */

function parseModelJson<T>(text: string, schema: ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GuardError("The answer was not valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new GuardError(`The answer did not match the schema (${first?.path.join(".") || "root"}: ${first?.message}).`);
  }
  return parsed.data;
}

async function withRetry<T>(
  complete: JsonCompleter,
  system: string,
  user: string,
  schema: ResponseSchema,
  check: (text: string) => T
): Promise<T> {
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await complete({ system, user: user + feedback, schema });
    try {
      return check(text);
    } catch (err) {
      if (!(err instanceof GuardError)) throw err;
      if (attempt === 1) {
        const unsafe = /not allowed|read-only/i.test(err.message);
        throw new PublicToolError(
          unsafe ? "UNSAFE_OUTPUT" : "INVALID_OUTPUT",
          unsafe
            ? "The generated query used an operator wuup never runs, so it was discarded. Try rephrasing the request."
            : "The model returned an answer we could not use. Try rephrasing the request."
        );
      }
      feedback = retryFeedback(err.message);
    }
  }
  /* istanbul ignore next */
  throw new PublicToolError("INVALID_OUTPUT", "No usable answer.");
}

function completerFor(opts: PublicToolOptions): JsonCompleter {
  return opts.complete ?? geminiCompleter(opts);
}

export interface QueryInput {
  prompt: string;
  collection?: string;
  schema?: string;
}

export async function generateMongoQuery(input: QueryInput, opts: PublicToolOptions = {}): Promise<GeneratedQuery> {
  return withRetry(completerFor(opts), QUERY_SYSTEM, queryUserMessage(input), QUERY_RESPONSE_SCHEMA, (text) =>
    checkQueryOutput(parseModelJson(text, RawQueryOutputSchema))
  );
}

export async function generateAggregation(input: QueryInput, opts: PublicToolOptions = {}): Promise<GeneratedQuery> {
  return withRetry(completerFor(opts), AGGREGATION_SYSTEM, queryUserMessage(input), QUERY_RESPONSE_SCHEMA, (text) =>
    checkQueryOutput(parseModelJson(text, RawQueryOutputSchema), "aggregate")
  );
}

export async function sqlToMongo(input: { sql: string; schema?: string }, opts: PublicToolOptions = {}): Promise<GeneratedQuery> {
  return withRetry(completerFor(opts), SQL_SYSTEM, sqlUserMessage(input), QUERY_RESPONSE_SCHEMA, (text) =>
    checkQueryOutput(parseModelJson(text, RawQueryOutputSchema))
  );
}

const WRITE_STAGE_RE = /["']?\$(out|merge)["']?\s*:/;
const JS_OP_RE = /["']?\$(function|accumulator|where)["']?\s*:/;

export async function explainAggregation(
  input: { pipeline: string },
  opts: PublicToolOptions = {}
): Promise<GeneratedExplanation> {
  const result = await withRetry(completerFor(opts), EXPLAIN_SYSTEM, explainUserMessage(input), EXPLAIN_RESPONSE_SCHEMA, (text) =>
    parseModelJson(text, RawExplainOutputSchema)
  );
  // Deterministic warnings, whatever the model said.
  const warnings = [...result.warnings];
  if (WRITE_STAGE_RE.test(input.pipeline) && !warnings.some((w) => /\$out|\$merge/.test(w))) {
    warnings.unshift("This pipeline writes data ($out or $merge). wuup never runs write stages on a connected database.");
  }
  if (JS_OP_RE.test(input.pipeline) && !warnings.some((w) => /\$function|\$accumulator|\$where/.test(w))) {
    warnings.unshift("This pipeline runs server-side JavaScript. wuup blocks $function, $accumulator and $where.");
  }
  return { ...result, warnings };
}
