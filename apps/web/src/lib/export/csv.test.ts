import { describe, expect, it } from "vitest";
import { rowsToCsv, rowsToTsv } from "./csv";

describe("rowsToCsv", () => {
  it("quotes commas, quotes and newlines; CRLF rows", () => {
    const csv = rowsToCsv(["name", "note"], [
      { name: "Asha, R", note: 'said "hi"' },
      { name: "Line\nbreak", note: null },
    ]);
    expect(csv).toBe('name,note\r\n"Asha, R","said ""hi"""\r\n"Line\nbreak",');
  });
  it("serialises objects as JSON and blanks missing cells", () => {
    expect(rowsToCsv(["a", "b"], [{ a: { x: 1 } }])).toBe('a,b\r\n"{""x"":1}",');
  });
  it("neutralises formulas but keeps negative numbers", () => {
    expect(rowsToCsv(["v"], [{ v: "=SUM(A1)" }, { v: "-5" }, { v: "@cmd" }, { v: -3 }])).toBe("v\r\n'=SUM(A1)\r\n-5\r\n'@cmd\r\n-3");
  });
});

describe("rowsToTsv", () => {
  it("flattens tabs and newlines", () => {
    expect(rowsToTsv(["a", "b"], [{ a: "x\ty", b: "1\n2" }])).toBe("a\tb\nx y\t1 2");
  });
});
