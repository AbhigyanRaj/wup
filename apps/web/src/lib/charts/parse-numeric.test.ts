import { describe, expect, it } from "vitest";
import { parseNumeric, parseNumericDetailed } from "./parse-numeric";

describe("parseNumeric", () => {
  it.each([
    [1234, 1234],
    ["1,234", 1234],
    ["$1,234.50", 1234.5],
    ["12%", 12],
    ["(120)", -120],
    ["($1,200)", -1200],
    ["3.4k", 3400],
    ["1.2M", 1_200_000],
    ["2bn", 2e9],
    ["-$5", -5],
    ["$-5", -5],
    ["−3", -3],
    ["+7", 7],
    [" 1 234 ", 1234],
    [".5", 0.5],
    ["1e3", 1000],
    ["₹2,50,000", 250000],
  ])("parses %j", (input, expected) => {
    expect(parseNumeric(input)).toBeCloseTo(expected as number);
  });

  it.each<unknown>(["", "N/A", "-", "abc", null, undefined, true, {}, NaN, Infinity, "2026-01-01", "12 apples"])(
    "rejects %j",
    (input) => {
      expect(parseNumeric(input)).toBeNull();
    },
  );

  it("keeps currency prefix and percent suffix", () => {
    expect(parseNumericDetailed("$1,234")).toEqual({ value: 1234, prefix: "$", suffix: "" });
    expect(parseNumericDetailed("12.5%")).toEqual({ value: 12.5, prefix: "", suffix: "%" });
  });
});
