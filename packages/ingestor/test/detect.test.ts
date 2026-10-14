import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { detectFileType, listZipEntries } from "../src/parsers/detect";
import { parseDocx } from "../src/parsers/docx";
import { parseCsvRows, parseCsv } from "../src/parsers/csv";
import { parseText } from "../src/parsers/text";

/** A minimal but valid .docx (mammoth can read it). */
export async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("PDF magic bytes are detected regardless of name", () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from([0xe2, 0xe3, 0xcf, 0xd3, 0, 1, 2])]);
  assert.deepEqual(detectFileType(pdf, "report.pdf"), { type: "pdf", mime: "application/pdf" });
  assert.equal(detectFileType(pdf, "report.txt")?.type, "pdf");
});

test("docx: zip with word/document.xml", async () => {
  const docx = await makeDocx(["Hello docx world", "Second paragraph"]);
  assert.ok(listZipEntries(docx)?.includes("word/document.xml"));
  assert.equal(detectFileType(docx, "file.docx")?.type, "docx");
  const parsed = await parseDocx(docx);
  assert.match(parsed.text, /Hello docx world/);
  assert.match(parsed.text, /Second paragraph/);
});

test("a zip that is not a docx is rejected", async () => {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", "<workbook/>");
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  assert.equal(detectFileType(buf, "sheet.docx"), null);
});

test("text: extension decides md / csv / txt", () => {
  const text = Buffer.from("# Title\n\nSome text, with commas.\n");
  assert.deepEqual(detectFileType(text, "notes.md"), { type: "md", mime: "text/markdown" });
  assert.deepEqual(detectFileType(text, "data.CSV"), { type: "csv", mime: "text/csv" });
  assert.deepEqual(detectFileType(text, "a.txt"), { type: "txt", mime: "text/plain" });
  // UTF-8 BOM and multi-byte characters are fine
  assert.equal(detectFileType(Buffer.from("﻿naïve café ✓"), "u.txt")?.type, "txt");
});

test("text renamed to .pdf or .docx is rejected (fake PDF)", () => {
  const text = Buffer.from("I am not really a PDF");
  assert.equal(detectFileType(text, "fake.pdf"), null);
  assert.equal(detectFileType(text, "fake.docx"), null);
});

test("NUL bytes in the first 8KB are rejected", () => {
  const buf = Buffer.from("hello\u0000world");
  assert.equal(detectFileType(buf, "a.txt"), null);
});

test("a renamed binary is rejected", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  assert.equal(detectFileType(png, "image.txt"), null);
  assert.equal(detectFileType(png, "image.pdf"), null);
  // invalid UTF-8 without NULs
  assert.equal(detectFileType(Buffer.from([0xc3, 0x28, 0x41, 0x42]), "x.md"), null);
  assert.equal(detectFileType(Buffer.alloc(0), "empty.txt"), null);
});

test("csv parser: RFC-4180 quotes, delimiters and row cap", async () => {
  const { rows } = parseCsvRows('a,b,c\n1,"x, y","say ""hi"""\n2,"multi\nline",z\n\n');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "x, y", 'say "hi"'],
    ["2", "multi\nline", "z"],
  ]);
  assert.deepEqual(parseCsvRows("a;b\n1;2").rows, [["a", "b"], ["1", "2"]]);
  const big = Array.from({ length: 20 }, (_, i) => `${i},v`).join("\n");
  const capped = parseCsvRows(big, { maxRows: 5 });
  assert.equal(capped.rows.length, 5);
  assert.equal(capped.truncated, true);
  const parsed = await parseCsv(Buffer.from('h1,h2\r\n" a ",b\r\n'));
  assert.equal(parsed.text, "h1,h2\na,b");
});

test("text parser strips the BOM", async () => {
  assert.equal((await parseText(Buffer.from("﻿hello"))).text, "hello");
});
