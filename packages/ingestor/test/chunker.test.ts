import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText, cleanText } from "../src/chunker";

// Small deterministic PRNG so failures are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEPARATORS = [" ", " ", " ", " ", "\n", "\n\n", ". ", ".\n", "\n\n\n"];

function randomText(rand: () => number): { text: string; words: string[] } {
  const wordCount = Math.floor(rand() * 2500);
  const words: string[] = [];
  let text = rand() < 0.3 ? "Introduction\n\n" : "";
  if (text) words.push("Introduction");
  for (let i = 0; i < wordCount; i++) {
    const len = 1 + Math.floor(rand() * 15);
    let w = "";
    for (let j = 0; j < len; j++) w += String.fromCharCode(97 + Math.floor(rand() * 26));
    words.push(w);
    text += w + SEPARATORS[Math.floor(rand() * SEPARATORS.length)];
  }
  return { text, words };
}

test("regression: separator inside the overlap window terminates", () => {
  const input = "Introduction\n\n" + "word ".repeat(500);
  const chunks = chunkText(input);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 1800);
  assert.ok(chunks[0].startsWith("Introduction"));
});

test("regression: many short paragraphs and a long tail terminate", () => {
  const input = "A.\n\nB.\n\n" + "x".repeat(5000) + "\n\n" + "word ".repeat(1000);
  const chunks = chunkText(input);
  for (const c of chunks) assert.ok(c.length <= 1800);
});

test("overlap >= chunkSize still terminates", () => {
  const chunks = chunkText("word ".repeat(200), { chunkSize: 50, overlap: 80 });
  assert.ok(chunks.length > 0);
  for (const c of chunks) assert.ok(c.length <= 50);
});

test("short text path", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\n  "), []);
  assert.deepEqual(chunkText("hi"), []); // below minChunkSize (5)
  assert.deepEqual(chunkText("  hello   world  "), ["hello world"]);
  const medium = "word ".repeat(300).trim();
  assert.deepEqual(chunkText(medium), [medium]);
});

test("cleanText normalises whitespace", () => {
  assert.equal(cleanText("a\x00b  \t c\n\n\n\nd"), "ab c\n\nd");
});

test("property: random texts terminate, respect chunkSize and keep every word", () => {
  const rand = mulberry32(1234567);
  for (let iter = 0; iter < 300; iter++) {
    const { text, words } = randomText(rand);
    const useDefaults = iter % 2 === 0;
    const chunkSize = useDefaults ? 1800 : 100 + Math.floor(rand() * 900);
    const overlap = useDefaults ? 200 : Math.floor(rand() * (chunkSize / 2));
    const chunks = useDefaults ? chunkText(text) : chunkText(text, { chunkSize, overlap });

    const tokens = new Set<string>();
    for (const c of chunks) {
      assert.ok(c.length <= chunkSize, `iter ${iter}: chunk of ${c.length} > ${chunkSize}`);
      for (const t of c.split(/[\s.]+/)) if (t) tokens.add(t);
    }
    for (const w of words) {
      assert.ok(tokens.has(w), `iter ${iter}: word "${w}" missing from chunks`);
    }
  }
});

// ─── chunkCsv ────────────────────────────────────────────────────────────────

import { chunkCsv, splitCsvRecords } from "../src/chunker";

test("chunkCsv repeats the header at the top of every chunk and keeps every row", () => {
  const header = "id,name,city,notes";
  const rows = Array.from({ length: 400 }, (_, i) => `${i},Person ${i},City ${i % 7},"note, with comma ${i}"`);
  const csv = [header, ...rows].join("\n");
  const chunks = chunkCsv(csv);
  assert.ok(chunks.length > 1);
  const seen: string[] = [];
  for (const c of chunks) {
    assert.ok(c.length <= 1800, `chunk of ${c.length}`);
    const lines = c.split("\n");
    assert.equal(lines[0], header);
    seen.push(...lines.slice(1));
  }
  assert.deepEqual(seen, rows);
});

test("chunkCsv keeps quoted multi-line values in one row", () => {
  const csv = 'a,b\n1,"line one\nline two"\n2,x\r\n3,y\r\n';
  assert.deepEqual(splitCsvRecords(csv), ["a,b", '1,"line one\nline two"', "2,x", "3,y"]);
  const chunks = chunkCsv(csv);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], 'a,b\n1,"line one\nline two"\n2,x\n3,y');
});

test("chunkCsv hard-splits an oversized row and still prefixes the header", () => {
  const csv = "h1,h2\n" + "x".repeat(5000) + "\nshort,row";
  const chunks = chunkCsv(csv, { maxChars: 1000 });
  assert.ok(chunks.length >= 6);
  for (const c of chunks) {
    assert.ok(c.startsWith("h1,h2\n"));
    assert.ok(c.length <= 1000);
  }
  assert.ok(chunks[chunks.length - 1].endsWith("short,row"));
});

test("chunkCsv edge cases", () => {
  assert.deepEqual(chunkCsv(""), []);
  assert.deepEqual(chunkCsv("\n\n"), []);
  assert.deepEqual(chunkCsv("only,header"), ["only,header"]);
});
