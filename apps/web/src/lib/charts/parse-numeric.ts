/*
 * Lenient number parsing for values that arrive as display strings.
 * Handles "1,234", "$1,234.50", "12%", "(120)", "3.4k", "-$5", "1.2M", "−3" (unicode minus).
 * Returns null for anything that is not clearly a number ("", "N/A", "-", booleans, objects).
 */

export interface ParsedNumber {
  value: number;
  /** Currency symbol or code found before the digits, e.g. "$". */
  prefix: string;
  /** Unit found after the digits, e.g. "%". Magnitude suffixes (k, M) are not kept. */
  suffix: string;
}

const MAGNITUDE: Record<string, number> = { k: 1e3, m: 1e6, mm: 1e6, b: 1e9, bn: 1e9, t: 1e12 };
const CURRENCY = /^(?:[$€£₹¥]|usd|eur|gbp|inr|rs\.?)\s*/i;

export function parseNumericDetailed(raw: unknown): ParsedNumber | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { value: raw, prefix: "", suffix: "" } : null;
  }
  if (typeof raw === "bigint") return { value: Number(raw), prefix: "", suffix: "" };
  if (typeof raw !== "string") return null;

  let s = raw.trim().replace(/[\u2212\u2012\u2013]/g, "-");
  if (!s) return null;

  let negative = false;
  // Accounting negatives: "(120)" or "($1,200)".
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1].trim();
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }

  let prefix = "";
  const cur = CURRENCY.exec(s);
  if (cur) {
    prefix = cur[0].trim();
    s = s.slice(cur[0].length);
    // "$-5"
    if (s.startsWith("-")) {
      negative = !negative;
      s = s.slice(1);
    }
  }

  let suffix = "";
  if (s.endsWith("%")) {
    suffix = "%";
    s = s.slice(0, -1).trim();
  }

  let multiplier = 1;
  const mag = /^(.*?\d)\s*(k|mm|m|bn|b|t)$/i.exec(s);
  if (mag) {
    multiplier = MAGNITUDE[mag[2].toLowerCase()] ?? 1;
    s = mag[1];
  }

  // Thousands separators: commas, spaces, thin spaces, underscores, apostrophes.
  s = s.replace(/[,\s   _']/g, "");
  if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;

  const n = Number(s) * multiplier;
  if (!Number.isFinite(n)) return null;
  return { value: negative ? -n : n, prefix, suffix };
}

export function parseNumeric(raw: unknown): number | null {
  return parseNumericDetailed(raw)?.value ?? null;
}
