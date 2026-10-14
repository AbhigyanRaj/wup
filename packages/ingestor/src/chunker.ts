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
 * ADR-4 defaults: chunkSize=1800 chars (about 512 tokens at ~3.5 chars/token),
 * overlap=200 chars, minChunkSize=5 chars (so very short test documents still
 * index). Much smaller chunks lose context; much larger ones hurt retrieval
 * precision.
 */

export interface ChunkOptions {
  chunkSize?: number;   // characters per chunk (default: 1800, about 512 tokens at ~3.5 chars/token)
  overlap?: number;     // characters of overlap between consecutive chunks (default: 200)
  minChunkSize?: number; // drop chunks shorter than this (default: 5)
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1800,
  overlap: 200,
  minChunkSize: 5,
};

/**
 * Cleans raw extracted text (PDF, DOCX, plain text, Markdown):
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
  const n = cleaned.length;
  let start = 0;

  // Hard iteration guard: every iteration advances `start` by at least 1,
  // so this can never be reached, but it makes an infinite loop impossible
  // even if the logic below is changed incorrectly later.
  const maxIterations = n + 1;
  let iterations = 0;

  while (n - start > chunkSize && iterations++ < maxIterations) {
    const windowEnd = start + chunkSize;
    // A split point must leave more than `overlap` characters in this chunk,
    // otherwise the next start (splitAt - overlap) would not move forward.
    const minSplit = start + overlap;
    let splitAt = -1;

    for (const sep of separators) {
      // Last occurrence of `sep` that ends inside the window
      const idx = cleaned.lastIndexOf(sep, windowEnd - sep.length);
      if (idx < start) continue;
      const candidate = idx + sep.length;
      if (candidate > minSplit && candidate <= windowEnd) {
        splitAt = candidate;
        break;
      }
    }

    // Hard split if no good separator found
    if (splitAt <= start) {
      splitAt = windowEnd;
    }

    const chunk = cleaned.slice(start, splitAt).trim();
    if (chunk.length > 0) rawChunks.push(chunk);

    // Overlap: back up by `overlap` characters so the next chunk starts with
    // some repeated context from the current one, but always move forward.
    start = Math.max(splitAt - overlap, start + 1);
  }

  // Remainder
  const remaining = cleaned.slice(start).trim();
  if (remaining.length >= minChunkSize) {
    rawChunks.push(remaining);
  }

  // Final filter: drop anything too short
  return rawChunks.filter((c) => c.length >= minChunkSize);
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export interface CsvChunkOptions {
  /** Max characters per chunk, header included (default: 1800). */
  maxChars?: number;
}

/**
 * Splits CSV text into records. A record ends at a newline that is outside a
 * double-quoted field (RFC-4180), so quoted multi-line values stay together.
 * Returns the raw text of each record (no trailing newline), skipping blanks.
 */
export function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let inQuotes = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes; // an escaped quote ("") toggles twice
    } else if (ch === "\n" && !inQuotes) {
      let end = i;
      if (end > start && text[end - 1] === "\r") end--;
      const rec = text.slice(start, end);
      if (rec.trim().length > 0) records.push(rec);
      start = i + 1;
    }
  }
  const last = text.slice(start).replace(/\r$/, "");
  if (last.trim().length > 0) records.push(last);
  return records;
}

/**
 * Chunks CSV text for embedding: rows are grouped into chunks of at most
 * `maxChars` characters, and every chunk starts with the header row so each
 * chunk is self-describing. A single row longer than the budget is hard-split
 * (each piece still gets the header). Never loops forever: every iteration
 * consumes at least one row or one character.
 */
export function chunkCsv(text: string, options: CsvChunkOptions = {}): string[] {
  const maxChars = Math.max(20, options.maxChars ?? DEFAULT_OPTIONS.chunkSize);
  const records = splitCsvRecords(text.replace(/\x00/g, ""));
  if (records.length === 0) return [];

  // Keep the header to at most half the budget so rows always have room.
  let header = records[0].trim();
  if (header.length > Math.floor(maxChars / 2)) header = header.slice(0, Math.floor(maxChars / 2));
  const rows = records.slice(1);

  // Header only: one chunk with the header itself.
  if (rows.length === 0) return header.length >= DEFAULT_OPTIONS.minChunkSize ? [header] : [];

  const room = maxChars - header.length - 1; // 1 for the newline after the header
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length > 0) chunks.push(header + "\n" + current.join("\n"));
    current = [];
    currentLen = 0;
  };

  for (const row of rows) {
    if (row.length > room) {
      // Oversized row: flush what we have, then hard-split the row.
      flush();
      for (let i = 0; i < row.length; i += room) {
        chunks.push(header + "\n" + row.slice(i, i + room));
      }
      continue;
    }
    const added = (current.length > 0 ? 1 : 0) + row.length;
    if (currentLen + added > room) flush();
    currentLen += (current.length > 0 ? 1 : 0) + row.length;
    current.push(row);
  }
  flush();
  return chunks;
}
