/*
 * Streaming holdback filter.
 *
 * While tokens are still arriving, the tail of the text can be an unfinished
 * construct that would render wrongly for a frame or two:
 *   - "[" or "[1" or "[1, 2": a citation marker that is not closed yet
 *   - "`" or "``" at the start of a line: a code fence that is not open yet
 *   - "---WUP" ...: the start of the model's metadata block
 * Those characters are held back until the next token resolves them.
 *
 * The metadata block (---WUP_META--- ... ---WUP_META---) must never reach the
 * screen. The server strips it, but if it leaks it is cut here, streaming or not.
 */

export const META_MARKER = "---WUP_META---";

/** Removes a leaked ---WUP_META--- block (and anything after an unclosed one). */
export function stripMeta(text: string): string {
  const start = text.indexOf(META_MARKER);
  if (start === -1) return text;
  const end = text.indexOf(META_MARKER, start + META_MARKER.length);
  const before = text.slice(0, start).replace(/\s+$/, "");
  if (end === -1) return before;
  const after = text.slice(end + META_MARKER.length);
  return stripMeta(before + after);
}

/** Length of the longest suffix of `text` that is a proper prefix of `marker`. */
function partialSuffix(text: string, marker: string): number {
  const max = Math.min(text.length, marker.length - 1);
  for (let n = max; n > 0; n--) {
    if (marker.startsWith(text.slice(text.length - n))) return n;
  }
  return 0;
}

/**
 * Returns the text that is safe to render.
 * With `streaming` false only the metadata block is removed.
 */
export function holdback(text: string, streaming: boolean): string {
  let out = stripMeta(text);
  if (!streaming) return out;

  // A partial metadata marker at the very end ("-", "---W", "---WUP_ME").
  // Only hold "-" runs when they could start the marker (line start), so a
  // trailing hyphen in a word ("well-") does not flicker.
  const metaTail = partialSuffix(out, META_MARKER);
  if (metaTail > 0) {
    const cut = out.length - metaTail;
    const lineStart = cut === 0 || out[cut - 1] === "\n";
    if (lineStart || metaTail >= 4) out = out.slice(0, cut);
  }

  // A citation that is still open: "[", "[1", "[12", "[1,", "[1, 2".
  const cite = /\[(?:\d{1,3}(?:\s*,\s*\d{0,3})*)?$/.exec(out);
  if (cite) out = out.slice(0, cite.index);

  // One or two backticks at the start of a line could become a ``` fence.
  const fence = /(^|\n)[ ]{0,3}`{1,2}$/.exec(out);
  if (fence) out = out.slice(0, fence.index + fence[1].length);

  return out;
}
