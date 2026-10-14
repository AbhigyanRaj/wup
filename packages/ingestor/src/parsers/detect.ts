import path from "path";
import type { KnowledgeFileType } from "../types";

export interface DetectedFileType {
  type: KnowledgeFileType;
  mime: string;
}

export const MIME_BY_TYPE: Record<KnowledgeFileType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  csv: "text/csv",
  txt: "text/plain",
};

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const ZIP_LOCAL_MAGIC = 0x04034b50; // PK\x03\x04
const ZIP_EOCD_MAGIC = 0x06054b50; // PK\x05\x06
const ZIP_CENTRAL_MAGIC = 0x02014b50; // PK\x01\x02
const DOCX_MAIN_PART = "word/document.xml";
const TEXT_SNIFF_BYTES = 8 * 1024;

/**
 * Lists the entry names in a zip's central directory. Returns null when the
 * buffer is not a well-formed zip.
 */
export function listZipEntries(buf: Buffer): string[] | null {
  if (buf.length < 22) return null;
  // The end-of-central-directory record is in the last 22 + 65535 bytes.
  const minPos = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === ZIP_EOCD_MAGIC) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let k = 0; k < count; k++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== ZIP_CENTRAL_MAGIC) return null;
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    if (nameStart + nameLen > buf.length) return null;
    names.push(buf.toString("utf8", nameStart, nameStart + nameLen));
    offset = nameStart + nameLen + extraLen + commentLen;
  }
  return names;
}

/** Valid UTF-8 (BOM allowed) with no NUL byte in the first 8KB. */
export function isLikelyUtf8Text(buf: Buffer): boolean {
  const head = buf.subarray(0, TEXT_SNIFF_BYTES);
  if (head.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects the real type of an upload from its bytes. The client's mimetype is
 * never consulted; the file extension only chooses between the text formats.
 *
 *   %PDF-                         → pdf
 *   zip with word/document.xml    → docx
 *   valid UTF-8, no NUL in 8KB    → md / csv / txt by extension
 *   anything else                 → null (reject as UNSUPPORTED_FILE)
 */
export function detectFileType(buf: Buffer, originalName: string): DetectedFileType | null {
  if (!buf || buf.length === 0) return null;
  const ext = path.extname(originalName ?? "").toLowerCase();

  // PDF: the header must be at the start (allow a few leading bytes, as
  // readers tolerate up to 1KB of junk before %PDF-).
  const pdfAt = buf.subarray(0, 1024).indexOf(PDF_MAGIC);
  if (pdfAt === 0 || (pdfAt > 0 && pdfAt < 1024 && ext === ".pdf")) {
    return { type: "pdf", mime: MIME_BY_TYPE.pdf };
  }

  if (buf.length >= 4 && buf.readUInt32LE(0) === ZIP_LOCAL_MAGIC) {
    const entries = listZipEntries(buf);
    if (entries && entries.includes(DOCX_MAIN_PART)) {
      return { type: "docx", mime: MIME_BY_TYPE.docx };
    }
    return null; // other zip formats (xlsx, odt, plain zip) are not supported
  }

  if (!isLikelyUtf8Text(buf)) return null;

  switch (ext) {
    case ".md":
    case ".markdown":
      return { type: "md", mime: MIME_BY_TYPE.md };
    case ".csv":
      return { type: "csv", mime: MIME_BY_TYPE.csv };
    case ".txt":
    case ".text":
    case "":
      return { type: "txt", mime: MIME_BY_TYPE.txt };
    default:
      // Text content behind a .pdf / .docx (or unknown) name is a spoof.
      return null;
  }
}
