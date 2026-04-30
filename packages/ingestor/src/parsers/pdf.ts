import pdfParse from "pdf-parse";

export interface ParsedDocument {
  text: string;
  pageCount: number;
  info: Record<string, unknown>;
}

/**
 * Parses a PDF buffer and extracts all text content.
 *
 * Failure modes handled:
 *   - I-1: Non-PDF bytes → pdf-parse throws → caller handles
 *   - I-2: Password-protected PDF → empty/short text → caller detects
 *   - I-3: Scanned/image-only PDF → empty text → caller detects
 *   - I-10: Empty file → pdf-parse throws or returns nothing → caller handles
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer, {
    // Limit pages parsed in dev to avoid OOM on huge files.
    // In production, lift this limit and rely on chunk cap instead.
    max: 0, // 0 = no limit; chunk cap (I-9) handles size
  });

  return {
    text: data.text,
    pageCount: data.numpages,
    info: (data.info as Record<string, unknown>) ?? {},
  };
}

/**
 * Parses a plain-text file buffer.
 */
export async function parseTxt(buffer: Buffer): Promise<ParsedDocument> {
  return {
    text: buffer.toString("utf-8"),
    pageCount: 1,
    info: {},
  };
}
