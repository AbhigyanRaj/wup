/**
 * Recursively splits text into overlapping chunks suitable for embedding.
 *
 * Strategy:
 *   1. Try to split on paragraph boundaries (\n\n)
 *   2. Fall back to sentence boundaries (.\n or . )
 *   3. Fall back to hard character split at chunkSize
 *
 * This preserves semantic coherence much better than a naive hard split.
 *
 * ADR-4: chunkSize=512 chars, overlap=64 chars — industry sweet spot.
 * Too small (<200): loses context. Too large (>1000): hurts retrieval precision.
 */

export interface ChunkOptions {
  chunkSize?: number;   // characters per chunk (default: 1800 — ~512 tokens at ~3.5 chars/token)
  overlap?: number;     // characters of overlap between consecutive chunks (default: 200)
  minChunkSize?: number; // drop chunks shorter than this (default: 80)
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1800,
  overlap: 200,
  minChunkSize: 5,
};

/**
 * Cleans raw PDF text extracted by pdf-parse:
 *   - Normalizes whitespace
 *   - Removes null bytes / control characters
 *   - Collapses excessive blank lines
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\x00/g, "") // null bytes
    .replace(/[^\S\n]+/g, " ") // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
    .trim();
}

/**
 * Splits text on the given separator, returning an array of segments
 * that are each at most maxLen characters.
 */
function splitOnSeparator(text: string, separator: string): string[] {
  return text
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Core recursive character text splitter.
 *
 * Tries paragraph → sentence → word → character splits in order,
 * accumulating segments into chunks of at most chunkSize characters.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const { chunkSize, overlap, minChunkSize } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const cleaned = cleanText(text);
  if (cleaned.length === 0) return [];

  // If the whole text fits in one chunk, return it directly
  if (cleaned.length <= chunkSize) {
    return cleaned.length >= minChunkSize ? [cleaned] : [];
  }

  // Separator priority: paragraph > sentence > newline > space
  const separators = ["\n\n", ".\n", ". ", "\n", " "];

  const rawChunks: string[] = [];
  let remaining = cleaned;

  while (remaining.length > chunkSize) {
    // Find the best split point within the chunkSize window
    let splitAt = -1;

    for (const sep of separators) {
      // Look for the last occurrence of `sep` before chunkSize
      const idx = remaining.lastIndexOf(sep, chunkSize);
      if (idx > 0) {
        splitAt = idx + sep.length;
        break;
      }
    }

    // Hard split if no good separator found
    if (splitAt <= 0) {
      splitAt = chunkSize;
    }

    rawChunks.push(remaining.slice(0, splitAt).trim());
    // Overlap: back up by `overlap` characters so the next chunk
    // starts with some repeated context from the current one
    remaining = remaining.slice(Math.max(0, splitAt - overlap)).trim();
  }

  // Remainder
  if (remaining.length >= minChunkSize) {
    rawChunks.push(remaining);
  }

  // Final filter: drop anything too short
  return rawChunks.filter((c) => c.length >= minChunkSize);
}
