import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDriver, isAutoModel, LlmError, RequestGuard, isRotatable, toLlmError } from "../src/ai/driver";
import { executeTool, toolDeclarations, truncateToolResult, MAX_TOOL_RESULT_BYTES } from "../src/tools/registry";
import { decodeHtmlEntities, parseDuckDuckGoHtml } from "../src/tools/websearch";

describe("createDriver", () => {
  test("switches on the provider", () => {
    assert.equal(createDriver({ provider: "gemini", apiKey: null, keyId: "server" }).provider, "gemini");
    assert.equal(createDriver({ provider: "gemini", apiKey: null, keyId: "server" }, "auto").model, "gemini-2.5-flash");
    assert.equal(createDriver({ provider: "openai", apiKey: "k", keyId: "a" }).provider, "openai");
    assert.equal(createDriver({ provider: "openrouter", apiKey: "k", keyId: "a" }).provider, "openrouter");
    assert.equal(createDriver({ provider: "anthropic", apiKey: "k", keyId: "a" }).model, "claude-opus-5-5");
    assert.equal(createDriver({ provider: "groq", apiKey: "k", keyId: "a" }).provider, "groq");
    assert.equal(createDriver({ provider: "groq", apiKey: "k", keyId: "a" }, "auto").model, "openai/gpt-oss-120b");
    assert.equal(
      createDriver({ provider: "groq", apiKey: "k", keyId: "a", availableModels: ["llama-3.1-8b-instant", "whisper-large-v3"] }, "auto").model,
      "llama-3.1-8b-instant"
    );
    assert.throws(() => createDriver({ provider: "groq", apiKey: null, keyId: "a" }), (e: any) => e.code === "PROVIDER_AUTH");
    assert.throws(() => createDriver({ provider: "cohere" as any, apiKey: "k", keyId: "a" }), /Unknown AI provider/);
  });

  test("isAutoModel accepts auto, the legacy Auto-Rotate and empty", () => {
    assert.ok(isAutoModel("auto") && isAutoModel("Auto-Rotate") && isAutoModel(undefined) && isAutoModel(""));
    assert.ok(!isAutoModel("gemini-2.5-flash"));
  });
});

describe("error classification", () => {
  test("maps statuses to contract codes", () => {
    assert.equal(toLlmError({ status: 401, message: "x" }).code, "PROVIDER_AUTH");
    assert.equal(toLlmError({ status: 429, message: "x" }).code, "MODEL_UNAVAILABLE");
    assert.equal(toLlmError(new Error("Error fetching from u: [404 Not Found] no model")).status, 404);
    assert.equal(toLlmError(new Error("API error: 503 - busy")).code, "PROVIDER_ERROR");
    const ctl = new AbortController();
    ctl.abort();
    assert.equal(toLlmError(new Error("whatever"), ctl.signal).code, "ABORTED");
  });

  test("only 429, 404 and 5xx rotate", () => {
    assert.ok(isRotatable(new LlmError("MODEL_UNAVAILABLE", "x", 429)));
    assert.ok(isRotatable(new LlmError("MODEL_UNAVAILABLE", "x", 404)));
    assert.ok(isRotatable(new LlmError("PROVIDER_ERROR", "x", 502)));
    assert.ok(!isRotatable(new LlmError("PROVIDER_ERROR", "x", 400)));
    assert.ok(!isRotatable(new LlmError("PROVIDER_AUTH", "x", 401)));
    assert.ok(!isRotatable(new LlmError("PROVIDER_ERROR", "tool failed")));
  });
});

describe("RequestGuard", () => {
  test("race rejects with ABORTED when the parent aborts", async () => {
    const ctl = new AbortController();
    const g = new RequestGuard(ctl.signal, 1000, 1000);
    const p = g.race(new Promise(() => {}));
    ctl.abort();
    await assert.rejects(p, (e: any) => e.code === "ABORTED");
    g.dispose();
  });

  test("touch keeps a chatty stream alive past connectMs", async () => {
    const g = new RequestGuard(undefined, 30, 60);
    async function* slow() {
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 20));
        yield i;
      }
    }
    const seen: number[] = [];
    for await (const v of g.iterate(slow())) seen.push(v);
    g.dispose();
    assert.deepEqual(seen, [0, 1, 2, 3]);
  });
});

describe("tool registry", () => {
  const ctx = { userId: "u" };

  test("resolves only enabled own tools", async () => {
    assert.match((await executeTool("constructor", {}, ctx, ["constructor"])).error, /Unknown tool/);
    assert.match((await executeTool("web_search", { query: "x" }, ctx, [])).error, /Unknown tool/);
    assert.match((await executeTool("nope", {}, ctx, ["nope"])).error, /Unknown tool/);
  });

  test("declares only the relevant tools", () => {
    assert.deepEqual(toolDeclarations({}), []);
    assert.deepEqual(toolDeclarations({ searchWeb: true }).map((d) => d.name), ["web_search"]);
    const names = toolDeclarations({ hasBridges: true, hasSheets: true }).map((d) => d.name);
    assert.ok(names.includes("mongo_aggregate") && names.includes("read_sheets") && !names.includes("web_search"));
  });

  test("truncates large results to 30KB", () => {
    const big = { success: true, rows: Array.from({ length: 2000 }, (_, i) => ({ i, text: "x".repeat(50) })) };
    const out = truncateToolResult(big);
    assert.ok(JSON.stringify(out).length <= MAX_TOOL_RESULT_BYTES);
    assert.equal(out.truncated, true);
    assert.ok(out.rows.length > 100 && out.rows.length < 2000);
    const blob = truncateToolResult({ text: "y".repeat(100_000) });
    assert.ok(JSON.stringify(blob).length <= MAX_TOOL_RESULT_BYTES);
    assert.equal(blob.truncated, true);
    const small = { success: true, count: 3 };
    assert.equal(truncateToolResult(small), small);
  });
});

describe("web search parsing", () => {
  test("decodes entities and unwraps DuckDuckGo redirect links", () => {
    assert.equal(decodeHtmlEntities("Tom &amp; Jerry &#39;s &quot;show&quot; &#x27;x&#x27; &nbsp;ok"), `Tom & Jerry 's "show" 'x'  ok`);
    const html =
      '<div class="result results_links results_links_deep web-result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&amp;rut=x">Example &amp; Co</a><a class="result__snippet" href="#">It&#39;s <b>here</b></a></div>';
    assert.deepEqual(parseDuckDuckGoHtml(html), [{ title: "Example & Co", url: "https://example.com/a?b=1", snippet: "It's here" }]);
  });
});
