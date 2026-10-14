import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { holdback, stripMeta } from "./holdback";
import { splitBlocks, splitOpenFence } from "./fences";
import { remarkCitations, splitCitations } from "./remark-citations";

const render = (md: string) =>
  renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkCitations]}>{md}</ReactMarkdown>,
  );

describe("holdback", () => {
  it("holds back partial citations while streaming", () => {
    expect(holdback("Revenue grew [", true)).toBe("Revenue grew ");
    expect(holdback("Revenue grew [1", true)).toBe("Revenue grew ");
    expect(holdback("Revenue grew [1, 2", true)).toBe("Revenue grew ");
    expect(holdback("Revenue grew [1]", true)).toBe("Revenue grew [1]");
    expect(holdback("Revenue grew [1", false)).toBe("Revenue grew [1");
  });

  it("holds back a partial fence at line start", () => {
    expect(holdback("Here:\n``", true)).toBe("Here:\n");
    expect(holdback("Here:\n`", true)).toBe("Here:\n");
    expect(holdback("use `x`", true)).toBe("use `x`");
  });

  it("strips a leaked meta block, closed or not", () => {
    expect(stripMeta('Answer.\n---WUP_META---\n{"a":1}\n---WUP_META---\nTail')).toBe("Answer.\nTail");
    expect(holdback('Answer.\n\n---WUP_META---\n{"followUps":[', true)).toBe("Answer.");
    expect(holdback('Answer.\n\n---WUP_META---\n{"followUps":[]}', false)).toBe("Answer.");
  });

  it("holds back a partial meta marker at the end", () => {
    expect(holdback("Answer.\n---WUP", true)).toBe("Answer.\n");
    expect(holdback("Answer.\n-", true)).toBe("Answer.\n");
    expect(holdback("well-", true)).toBe("well-");
  });
});

describe("splitOpenFence", () => {
  it("returns everything when fences are closed", () => {
    const md = "Hi\n\n```js\nx()\n```\n\nBye";
    expect(splitOpenFence(md)).toEqual({ complete: md, pending: null });
  });

  it("splits an unterminated trailing fence", () => {
    const r = splitOpenFence("Look:\n\n```mermaid\ngraph TD\nA-->B");
    expect(r.complete).toBe("Look:");
    expect(r.pending).toEqual({ lang: "mermaid", code: "graph TD\nA-->B" });
  });

  it("needs a closing fence at least as long as the opener", () => {
    const r = splitOpenFence("````md\n```\ninner\n```\n");
    expect(r.pending?.lang).toBe("md");
  });

  it("handles tilde fences and an empty info string", () => {
    expect(splitOpenFence("~~~\ncode").pending).toEqual({ lang: "", code: "code" });
  });
});

describe("splitBlocks", () => {
  it("splits on blank lines but never inside a fence", () => {
    expect(splitBlocks("a\n\nb\n\n```\nx\n\ny\n```\n\nc")).toEqual(["a", "b", "```\nx\n\ny\n```", "c"]);
  });

  it("keeps loose lists together", () => {
    expect(splitBlocks("1. one\n\n2. two\n\n   more\n\nAfter")).toEqual(["1. one\n\n2. two\n\n   more", "After"]);
  });
});

describe("remarkCitations", () => {
  it("turns [n] in text into citation nodes", () => {
    const html = render("Revenue grew 12% [1] and churn fell [2, 3].");
    expect(html).toContain('<sup data-citation="1">1</sup>');
    expect(html).toContain('<sup data-citation="2">2</sup><sup data-citation="3">3</sup>');
    expect(html).not.toContain("[1]");
  });

  it("leaves [1] inside inline code and fenced code literal", () => {
    const html = render("Use `arr[1]` here.\n\n```js\nconst x = arr[1];\n```");
    expect(html).toContain("<code>arr[1]</code>");
    expect(html).toContain("const x = arr[1];");
    expect(html).not.toContain("data-citation");
  });

  it("does not touch link text", () => {
    const html = render("See [the report [1]](https://example.com).");
    expect(html).not.toContain("data-citation");
  });

  it("splitCitations ignores out-of-range numbers", () => {
    expect(splitCitations("x [0] y", 99)).toBeNull();
    expect(splitCitations("no markers")).toBeNull();
  });
});
