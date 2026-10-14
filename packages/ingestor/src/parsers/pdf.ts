import pdfParse from "pdf-parse";
import { parseText } from "./text";

export interface ParsedDocument {
  text: string;
  pageCount: number;
  info: Record<string, unknown>;
  /** true when the parser dropped part of the input (e.g. the CSV row cap). */
  truncated?: boolean;
}

/**
 * Parses a PDF buffer and extracts all text content.
 *
 * pdf-parse is CPU heavy and runs inline on the event loop; the ingest queue
 * bounds how many run at once (INGEST_CONCURRENCY).
 *
 * Failure modes handled:
 *   - I-1: Non-PDF bytes → pdf-parse throws → caller handles
 *   - I-2: Password-protected PDF → empty/short text → caller detects
 *   - I-3: Scanned/image-only PDF → empty text → caller detects
 *   - I-10: Empty file → pdf-parse throws or returns nothing → caller handles
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer, {
    max: 0, // 0 = no page limit; the chunk cap (I-9) bounds the work instead
  });

  return {
    text: data.text,
    pageCount: data.numpages,
    info: (data.info as Record<string, unknown>) ?? {},
  };
}

/**
 * Parses a plain-text file buffer.
 * @deprecated use parseText from ./text
 */
export async function parseTxt(buffer: Buffer): Promise<ParsedDocument> {
  return parseText(buffer);
}
