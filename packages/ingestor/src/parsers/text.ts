import type { ParsedDocument } from "./pdf";

/**
 * Decodes a UTF-8 text buffer (plain text or Markdown). A leading byte order
 * mark is removed. Invalid sequences become U+FFFD; detectFileType() has
 * already rejected buffers that are not valid UTF-8 at upload time.
 */
export function decodeUtf8(buffer: Buffer): string {
  const text = buffer.toString("utf-8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Parses a .txt or .md file. Markdown is indexed as-is (headings help retrieval). */
export async function parseText(buffer: Buffer): Promise<ParsedDocument> {
  return { text: decodeUtf8(buffer), pageCount: 1, info: {} };
}
