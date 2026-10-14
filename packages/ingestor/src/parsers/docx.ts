import mammoth from "mammoth";
import type { ParsedDocument } from "./pdf";

/** Extracts the raw text of a .docx file with mammoth (no formatting). */
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value ?? "", pageCount: 1, info: {} };
}
