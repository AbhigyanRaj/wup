import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MAX_SNIPPET_CHARS, SourceRegistry } from "../src/citations/sourceRegistry";
import { docChunk } from "./helpers/fakes";

describe("SourceRegistry", () => {
  test("numbers RAG first, then web and data in tool order; repeats keep their number", () => {
    const snapshots: number[] = [];
    const reg = new SourceRegistry((s) => snapshots.push(s.length));
    assert.deepEqual(reg.registerChunks([docChunk(1), docChunk(2)]), [1, 2]);
    assert.equal(reg.register({ kind: "web", title: "Wiki", url: "https://en.wikipedia.org/x", snippet: "s" }), 3);
    assert.equal(
      reg.register({ kind: "data", title: "Movies: mflix.movies", connectionName: "Movies", db: "mflix", collection: "movies", queryIndex: 0 }),
      4
    );
    assert.equal(reg.register({ kind: "web", title: "Wiki again", url: "https://en.wikipedia.org/x/" }), 3);
    assert.equal(reg.register({ kind: "data", connectionName: "Movies", db: "mflix", collection: "movies", queryIndex: 3 }), 4);
    assert.equal(reg.register({ kind: "web", title: "bad", url: "javascript:alert(1)" }), 0);
    assert.equal(reg.register({ kind: "nope" }), 0);
    assert.deepEqual(
      reg.snapshot().map((s) => [s.n, s.kind]),
      [
        [1, "doc"],
        [2, "doc"],
        [3, "web"],
        [4, "data"],
      ]
    );
    // RAG chunks are one batch snapshot, then one per new source
    assert.deepEqual(snapshots, [2, 3, 4]);
  });

  test("finalize marks cited sources and strips unknown [n]", () => {
    let last: any[] = [];
    const reg = new SourceRegistry((s) => (last = s));
    reg.registerChunks([docChunk(1), docChunk(2)]);
    const out = reg.finalize("Growth was 12% [2]. Also [7]. Both [1, 7] and [1][2].");
    assert.equal(out, "Growth was 12% [2]. Also. Both [1] and [1][2].");
    assert.deepEqual(
      reg.snapshot().map((s) => s.cited),
      [true, true]
    );
    assert.equal(last[0].cited, true);
  });

  test("finalize leaves code and markdown links alone", () => {
    const reg = new SourceRegistry();
    reg.registerChunks([docChunk(1)]);
    const text = "Use `arr[5]` here.\n```js\nconst x = rows[3];\n```\nSee [2](https://x.y) and fact [1].";
    assert.equal(reg.finalize(text), text);
    assert.equal(reg.snapshot()[0].cited, true);
  });

  test("snippets are capped at 300 chars", () => {
    const reg = new SourceRegistry();
    reg.registerChunks([docChunk(1, "word ".repeat(200))]);
    reg.register({ kind: "web", title: "t", url: "https://a.b", snippet: "y".repeat(1000) });
    const [doc, web] = reg.snapshot() as any[];
    assert.ok(doc.snippet.length <= MAX_SNIPPET_CHARS);
    assert.ok(web.snippet.length <= MAX_SNIPPET_CHARS);
    assert.ok(web.snippet.endsWith("..."));
  });

  test("citedIn only returns known numbers", () => {
    const reg = new SourceRegistry();
    reg.registerChunks([docChunk(1)]);
    assert.deepEqual(reg.citedIn("a [1] b [4]"), [1]);
  });
});
