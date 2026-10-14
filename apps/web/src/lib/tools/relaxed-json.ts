/**
 * Parses what people actually paste into MongoDB tools: strict JSON, relaxed
 * JSON (JSON5: unquoted keys, single quotes, trailing commas, comments) and
 * mongosh output with ObjectId(...), ISODate(...), new Date(...),
 * NumberDecimal(...), NumberLong(...), NumberInt(...) and /regex/flags.
 *
 * Shell helpers become MongoDB Extended JSON ({"$oid"}, {"$date"},
 * {"$numberDecimal"}), so the result is plain JSON that round-trips through
 * mongo-format.ts. Pure and browser-safe.
 */
import JSON5 from "json5";
import type { Json } from "./mongo-format";

export type ParseResult<T = Json> = { ok: true; value: T } | { ok: false; error: string };

const STR = String.raw`(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')`;
const strArg = (m: RegExpExecArray | string[], i: number) => (m[i] ?? m[i + 1] ?? "").replace(/\\(.)/g, "$1");

/**
 * Rewrites shell helpers into Extended JSON. It skips text inside string
 * literals so a value like "ObjectId(x)" in a string is left alone.
 */
export function shellToExtendedJson(input: string): string {
  let out = "";
  let i = 0;
  const n = input.length;
  const helpers: Array<{ re: RegExp; to: (m: RegExpExecArray) => string }> = [
    { re: new RegExp(String.raw`^(?:new\s+)?ObjectId\s*\(\s*${STR}\s*\)`), to: (m) => JSON.stringify({ $oid: strArg(m, 1) }) },
    { re: new RegExp(String.raw`^(?:new\s+)?(?:ISODate|Date)\s*\(\s*${STR}\s*\)`), to: (m) => JSON.stringify({ $date: toIso(strArg(m, 1)) }) },
    { re: /^(?:new\s+)?(?:ISODate|Date)\s*\(\s*\)/, to: () => JSON.stringify({ $date: new Date().toISOString() }) },
    { re: /^(?:new\s+)?Date\s*\(\s*(-?\d+)\s*\)/, to: (m) => JSON.stringify({ $date: new Date(Number(m[1])).toISOString() }) },
    { re: new RegExp(String.raw`^(?:NumberDecimal|Decimal128(?:\.fromString)?)\s*\(\s*${STR}\s*\)`), to: (m) => JSON.stringify({ $numberDecimal: strArg(m, 1) }) },
    { re: new RegExp(String.raw`^(?:NumberLong|NumberInt|Int32|Long)\s*\(\s*(?:${STR}|(-?\d+))\s*\)`), to: (m) => String(Number(m[3] ?? strArg(m, 1))) },
    { re: new RegExp(String.raw`^UUID\s*\(\s*${STR}\s*\)`), to: (m) => JSON.stringify(strArg(m, 1)) },
  ];

  while (i < n) {
    const ch = input[i];
    // Copy string literals verbatim
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && input[j] !== ch) j += input[j] === "\\" ? 2 : 1;
      const lit = input.slice(i, j + 1);
      out += ch === "`" ? JSON.stringify(lit.slice(1, -1)) : lit;
      i = j + 1;
      continue;
    }
    // Comments are left for JSON5
    if (ch === "/" && (input[i + 1] === "/" || input[i + 1] === "*")) {
      const end = input[i + 1] === "/" ? input.indexOf("\n", i) : input.indexOf("*/", i) + 2;
      const stop = end <= 0 ? n : end;
      out += input.slice(i, stop);
      i = stop;
      continue;
    }
    // Regex literal in a value position: /abc/i
    if (ch === "/" && /[:,[(]\s*$/.test(out)) {
      const m = /^\/((?:[^/\\\n]|\\.)+)\/([gimsuyx]*)/.exec(input.slice(i));
      if (m) {
        const regex: Record<string, string> = { $regex: m[1] };
        if (m[2]) regex.$options = m[2].replace(/[gy]/g, "");
        out += JSON.stringify(regex);
        i += m[0].length;
        continue;
      }
    }
    if ("nODINLU".includes(ch) && !/[A-Za-z0-9_$.]/.test(input[i - 1] ?? "")) {
      const rest = input.slice(i, i + 400);
      const hit = helpers.map((h) => ({ h, m: h.re.exec(rest) })).find((x) => x.m);
      if (hit && hit.m) {
        out += hit.h.to(hit.m);
        i += hit.m[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

function toIso(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().replace(".000Z", "Z");
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // JSON5: "JSON5: invalid character 'x' at 3:14"
  const at = /at (\d+):(\d+)/.exec(msg);
  const what = msg.replace(/^JSON5:\s*/, "").replace(/\s*at \d+:\d+$/, "");
  return at ? `Line ${at[1]}, column ${at[2]}: ${what}.` : `${what}.`;
}

/** Parses one JSON or mongosh value. */
export function parseRelaxed(text: string): ParseResult {
  const src = text.trim();
  if (!src) return { ok: false, error: "Nothing to parse." };
  try {
    return { ok: true, value: JSON5.parse(shellToExtendedJson(src)) as Json };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/**
 * Parses pasted documents: a JSON array, a single document, or one document
 * per line (mongosh / mongoexport output). Always returns an array of objects.
 */
export function parseDocuments(text: string): ParseResult<Array<Record<string, Json>>> {
  const src = text.trim();
  if (!src) return { ok: false, error: "Paste at least one document." };
  const whole = parseRelaxed(src);
  if (whole.ok) {
    const v = whole.value;
    if (Array.isArray(v)) {
      const docs = v.filter((d): d is Record<string, Json> => !!d && typeof d === "object" && !Array.isArray(d));
      if (!docs.length) return { ok: false, error: "The array has no documents (objects) in it." };
      return { ok: true, value: docs };
    }
    if (v && typeof v === "object") return { ok: true, value: [v as Record<string, Json>] };
    return { ok: false, error: "Expected a document ({ ... }) or an array of documents." };
  }
  // One document per line, or documents separated by blank lines / commas
  const chunks = splitTopLevelObjects(src);
  if (chunks.length > 1) {
    const docs: Array<Record<string, Json>> = [];
    for (const [idx, chunk] of chunks.entries()) {
      const r = parseRelaxed(chunk);
      if (!r.ok) return { ok: false, error: `Document ${idx + 1}: ${r.error}` };
      if (r.value && typeof r.value === "object" && !Array.isArray(r.value)) docs.push(r.value as Record<string, Json>);
    }
    return { ok: true, value: docs };
  }
  return { ok: false, error: whole.error };
}

/** Splits "{...}\n{...}" into top-level object texts, respecting strings. */
export function splitTopLevelObjects(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j += src[j] === "\\" ? 2 : 1;
      i = j;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(src.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

/**
 * Extracts a pipeline from pasted text: a bare array, or the array inside
 * db.coll.aggregate([...]) / db.getCollection("x").aggregate([...]).
 * Returns the collection name when it can be read.
 */
export function parsePipeline(text: string): ParseResult<{ pipeline: Array<Record<string, Json>>; collection?: string }> {
  let src = text.trim();
  let collection: string | undefined;
  const call = /db\.(?:getCollection\(\s*["']([^"']+)["']\s*\)|([A-Za-z_][\w$]*))\s*\.\s*aggregate\s*\(/.exec(src);
  if (call) {
    collection = call[1] ?? call[2];
    const open = src.indexOf("[", call.index + call[0].length - 1);
    if (open === -1) return { ok: false, error: "Couldn't find the [ that starts the pipeline." };
    const close = matchingBracket(src, open);
    if (close === -1) return { ok: false, error: "The pipeline's [ is never closed." };
    src = src.slice(open, close + 1);
  }
  const r = parseRelaxed(src);
  if (!r.ok) return r;
  let value = r.value;
  if (value && typeof value === "object" && !Array.isArray(value)) value = [value];
  if (!Array.isArray(value)) return { ok: false, error: "A pipeline is an array of stages, like [{ $match: { ... } }]." };
  const stages = value.filter((s): s is Record<string, Json> => !!s && typeof s === "object" && !Array.isArray(s));
  if (stages.length !== value.length) return { ok: false, error: "Every stage must be an object such as { $match: { ... } }." };
  return { ok: true, value: { pipeline: stages, collection } };
}

function matchingBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j += src[j] === "\\" ? 2 : 1;
      i = j;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return i;
  }
  return -1;
}

/** Canonical JSON text of a parsed value (what the API receives). */
export function toJsonText(value: Json): string {
  return JSON.stringify(value, null, 2);
}
