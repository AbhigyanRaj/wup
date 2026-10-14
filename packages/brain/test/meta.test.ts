import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { META_END, META_START, MetaStreamFilter, extractJsonObject, parseStructuredResponse } from "../src/orchestrator/meta";

describe("parseStructuredResponse (lenient)", () => {
  test("a missing META_END never leaks the JSON into content", () => {
    const raw = `Total is 42.\n${META_START}\n{"type":"answer","followUps":[{"label":"More","suggestedPrompt":"Show more"}],"visualType":"table"}`;
    const r = parseStructuredResponse(raw);
    assert.equal(r.content, "Total is 42.");
    assert.equal(r.visualType, "table");
    assert.equal(r.followUps.length, 1);
    assert.doesNotMatch(r.content, /followUps|WUP_META/);
  });

  test("a truncated meta block (cut mid-JSON) still hides the JSON", () => {
    const raw = `Answer here.\n${META_START}\n{"type":"answer","followUps":[{"label":"A","suggestedPrompt":"B"}],"visualType":"ch`;
    const r = parseStructuredResponse(raw);
    assert.equal(r.content, "Answer here.");
    assert.equal(r.visualType, "none");
    assert.deepEqual(r.followUps, []);
  });

  test("recovers JSON with trailing junk by shrinking to an earlier brace", () => {
    const raw = `Hi\n${META_START}\n{"type":"answer","visualType":"none","followUps":[]} trailing } junk`;
    const r = parseStructuredResponse(raw);
    assert.equal(r.content, "Hi");
    assert.equal(r.visualType, "none");
  });

  test("bad visualType and chart type are coerced", () => {
    const raw = `Chart\n${META_START}\n{"type":"answer","visualType":"hologram","followUps":[]}\n${META_END}`;
    assert.equal(parseStructuredResponse(raw).visualType, "none");
    const chart = parseStructuredResponse(
      `Chart\n${META_START}\n{"type":"answer","visualType":"chart","chartData":{"type":"donut","xAxisKey":"g","yAxisKey":"n","series":[{"g":"a","n":1}]}}\n${META_END}`
    );
    assert.equal(chart.visualType, "chart");
    assert.equal(chart.chartData!.type, "bar");
  });

  test("handles a fenced meta block and strips stray markers from content", () => {
    const raw = `Text ${META_END} more\n${META_START}\n\`\`\`json\n{"type":"answer","visualType":"none","followUps":[]}\n\`\`\`\n${META_END}`;
    const r = parseStructuredResponse(raw);
    assert.equal(r.content, "Text  more");
    assert.doesNotMatch(r.content, /WUP_META/);
  });

  test("a clarification without a question falls back to the content", () => {
    const r = parseStructuredResponse(`Which one?\n${META_START}\n{"type":"clarification","options":["movies","users"]}\n${META_END}`);
    assert.equal(r.clarification!.question, "Which one?");
    assert.deepEqual(r.followUps, []);
  });

  test("plain text without markers is returned as is", () => {
    assert.deepEqual(parseStructuredResponse("  hello  "), { content: "hello", followUps: [], visualType: "none" });
  });

  test("extractJsonObject gives up gracefully", () => {
    assert.equal(extractJsonObject("no json here"), undefined);
    assert.deepEqual(extractJsonObject('x {"a":1} y'), { a: 1 });
  });
});

describe("MetaStreamFilter", () => {
  test("drops a stray META_END split across chunks from the visible stream", () => {
    const f = new MetaStreamFilter();
    const raw = `Before ${META_END} after, and more text to push it through.`;
    let shown = "";
    for (let i = 0; i < raw.length; i += 4) shown += f.push(raw.slice(i, i + 4));
    shown += f.flush();
    assert.equal(shown, "Before  after, and more text to push it through.");
  });

  test("text after the meta block starts is never shown", () => {
    const f = new MetaStreamFilter();
    let shown = f.push(`Answer.${META_START}{"a":`);
    shown += f.push(`1}${META_END} trailing`);
    shown += f.flush();
    assert.equal(shown, "Answer.");
    assert.equal(f.inMeta, true);
  });
});
