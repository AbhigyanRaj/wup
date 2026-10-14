/**
 * Tiny className joiner (clsx is not installed).
 * Accepts strings, numbers, falsy values, nested arrays and { className: boolean } maps.
 *   cn("btn", isActive && "is-active", { "btn--block": block }, className)
 * It does not merge conflicting Tailwind classes; put the overriding class last.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | null
  | undefined
  | boolean
  | ClassDictionary
  | ClassValue[];

export type ClassDictionary = Record<string, unknown>;

function toVal(input: ClassValue): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (typeof input === "number" || typeof input === "bigint") return String(input);
  if (typeof input === "boolean") return "";
  let out = "";
  if (Array.isArray(input)) {
    for (const item of input) {
      const v = toVal(item);
      if (v) out = out ? `${out} ${v}` : v;
    }
    return out;
  }
  for (const key in input) {
    if (input[key]) out = out ? `${out} ${key}` : key;
  }
  return out;
}

export function cn(...inputs: ClassValue[]): string {
  return toVal(inputs);
}

export default cn;
