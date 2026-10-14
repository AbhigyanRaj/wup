import { describe, expect, it } from "vitest";
import { detectColumnType, prepareTable, sortRows } from "./columns";

describe("detectColumnType", () => {
  it("numeric when at least 80% parse", () => {
    expect(detectColumnType(["1", "2,000", "$3", "4%", "x"])).toBe("number");
    expect(detectColumnType(["1", "2", "x", "y"])).toBe("string");
    expect(detectColumnType([1, null, "", 3])).toBe("number");
  });
  it("dates, but never bare numbers", () => {
    expect(detectColumnType(["2026-01-01", "2026-02-15", "2026-03-01T10:00:00Z"])).toBe("date");
    expect(detectColumnType(["Jan 5, 2026", "Feb 1, 2026"])).toBe("date");
    expect(detectColumnType(["2024", "2025"])).toBe("number");
  });
  it("strings otherwise, including booleans and empties", () => {
    expect(detectColumnType(["a", "b"])).toBe("string");
    expect(detectColumnType([true, false])).toBe("string");
    expect(detectColumnType([null, undefined, ""])).toBe("string");
  });
});

describe("prepareTable", () => {
  it("uses the union of row keys when columns are missing", () => {
    const t = prepareTable(undefined, [{ a: 1 }, { b: 2 }, null, "junk"]);
    expect(t.columns).toEqual(["a", "b"]);
    expect(t.rows.map((r) => r.__rowId)).toEqual(["r0", "r1"]);
  });
  it("survives undefined rows", () => {
    expect(prepareTable(["a"], undefined)).toEqual({ columns: ["a"], types: { a: "string" }, rows: [] });
  });
});

describe("sortRows", () => {
  const t = prepareTable(["n"], [{ n: "75" }, { n: "9" }, { n: "" }, { n: "1,240" }, { n: null }]);
  it("sorts numeric strings as numbers with empties last", () => {
    expect(sortRows(t.rows, "n", t.types.n, "asc").map((r) => r.n)).toEqual(["9", "75", "1,240", "", null]);
    expect(sortRows(t.rows, "n", t.types.n, "desc").map((r) => r.n)).toEqual(["1,240", "75", "9", "", null]);
  });
  it("sorts strings with a numeric collator", () => {
    const s = prepareTable(["k"], [{ k: "A-10" }, { k: "a-2" }, { k: "A-1" }]);
    expect(sortRows(s.rows, "k", "string", "asc").map((r) => r.k)).toEqual(["A-1", "a-2", "A-10"]);
  });
});
