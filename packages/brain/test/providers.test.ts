import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ANTHROPIC_FALLBACK_BETA,
  GROQ_TOOL_MODELS,
  anthropicEchoContent,
  anthropicMaxTokens,
  isGroqChatModel,
  parseToolInput,
  resolveLightModel,
  resolveModel,
  toJsonSchema,
} from "../src/ai/providers";
import { lightModel } from "../src/orchestrator/titles";
import { Brain } from "../src/orchestrator";
import { createDriver, LlmError, type LlmCredentials, type RunToolLoopParams } from "../src/ai/driver";
import { MODEL_ROTATION } from "../src/ai/gemini";
import { modelHealth, nextQuotaReset } from "../src/ai/modelHealth";

const countDecl = {
  name: "mongo_count",
  description: "Counts documents",
  parameters: {
    type: "OBJECT",
    properties: { connectionId: { type: "STRING" }, db: { type: "STRING" }, collection: { type: "STRING" } },
    required: ["connectionId", "db", "collection"],
  },
};

/** Builds a streaming Response from SSE lines. */
const sse = (events: Array<{ event?: string; data: unknown }>) =>
  new Response(
    events.map((e) => `${e.event ? `event: ${e.event}\n` : ""}data: ${typeof e.data === "string" ? e.data : JSON.stringify(e.data)}\n\n`).join(""),
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );

/** A response that sends one SSE frame and then stays silent forever (unless aborted). */
const stalledSse = (first: unknown) =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(first)}\n\n`));
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
beforeEach(() => modelHealth.clear());

/** Replaces fetch with a queue of responses and records request bodies. */
function mockFetch(responses: Array<Response | (() => Response)>) {
  const calls: Array<{ url: string; headers: any; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return typeof next === "function" ? next() : next;
  }) as any;
  return calls;
}

const key = (provider: LlmCredentials["provider"], apiKey: string | null = "sk-test"): LlmCredentials => ({
  provider,
  apiKey,
  keyId: apiKey ? "k_test" : "server",
});

function loopParams(over: Partial<RunToolLoopParams> = {}): RunToolLoopParams & { out: () => string } {
  let text = "";
  const p: any = {
    system: "sys",
    history: [],
    prompt: "p",
    tools: [countDecl],
    executeTool: async () => ({ success: true }),
    maxTurns: 5,
    signal: new AbortController().signal,
    onText: (t: string) => {
      text += t;
    },
    ...over,
  };
  p.out = () => text;
  return p;
}

describe("schema + input helpers", () => {
  test("toJsonSchema lowercases Gemini types recursively", () => {
    assert.deepEqual(toJsonSchema(countDecl.parameters), {
      type: "object",
      properties: { connectionId: { type: "string" }, db: { type: "string" }, collection: { type: "string" } },
      required: ["connectionId", "db", "collection"],
    });
  });

  test("parseToolInput validates JSON and required fields", () => {
    assert.deepEqual(parseToolInput('{"connectionId":"c","db":"d","collection":"x"}', countDecl).args, {
      connectionId: "c",
      db: "d",
      collection: "x",
    });
    assert.match(parseToolInput('{"db":"d"', countDecl).error!, /INVALID_JSON/);
    assert.match(parseToolInput('{"db":"d"}', countDecl).error!, /Missing required argument\(s\): connectionId, collection/);
    assert.match(parseToolInput("[1]", countDecl).error!, /JSON object/);
  });

  test("resolveModel defaults per provider (auto and the legacy Auto-Rotate)", () => {
    assert.equal(resolveModel("anthropic", "Auto-Rotate"), "claude-opus-5-5");
    assert.equal(resolveModel("anthropic", "auto"), "claude-opus-5-5");
    assert.equal(resolveModel("openai"), "gpt-4o-mini");
    assert.equal(resolveModel("anthropic", "claude-sonnet-5-5"), "claude-sonnet-5-5");
  });

  test("anthropicEchoContent drops declined-attempt blocks before a fallback marker", () => {
    const content = anthropicEchoContent([
      { type: "thinking", thinking: "old", signature: "s1" },
      { type: "tool_use", id: "t0", name: "mongo_count", partialJson: "{}" },
      { type: "text", text: "partial " },
      { type: "fallback" },
      { type: "thinking", thinking: "new", signature: "s2" },
      { type: "text", text: "" },
      { type: "tool_use", id: "t1", name: "mongo_count", partialJson: '{"db":"d"}' },
    ]);
    assert.deepEqual(content, [
      { type: "text", text: "partial " },
      { type: "thinking", thinking: "new", signature: "s2" },
      { type: "tool_use", id: "t1", name: "mongo_count", input: { db: "d" } },
    ]);
  });

  test("anthropic max_tokens table: 64k for modern families, else 8192", () => {
    for (const m of [
      "claude-opus-5-5",
      "claude-opus-5",
      "claude-opus-4-5",
      "claude-opus-4-6",
      "claude-sonnet-4-20250514",
      "claude-sonnet-5-5",
      "claude-haiku-4-5",
      "claude-haiku-5-5",
      "claude-fable-5-1",
    ]) {
      assert.equal(anthropicMaxTokens(m), 64000, m);
    }
    for (const m of ["claude-opus-4-1", "claude-3-5-sonnet-latest", "claude-3-haiku-20240307", "claude-haiku-3-5"]) {
      assert.equal(anthropicMaxTokens(m), 8192, m);
    }
  });
});

describe("createDriver", () => {
  test("unknown provider throws PROVIDER_ERROR", () => {
    assert.throws(
      () => createDriver({ provider: "mistral" as any, apiKey: "k", keyId: "k" }),
      (e: any) => e instanceof LlmError && e.code === "PROVIDER_ERROR"
    );
  });

  test("BYOK providers need a key", () => {
    assert.throws(() => createDriver(key("openai", null)), (e: any) => e.code === "PROVIDER_AUTH");
  });
});

describe("OpenAI-compatible tool loop", () => {
  test("streams text, runs tool calls, sends results back, sums usage, no temperature", async () => {
    const calls = mockFetch([
      sse([
        { data: { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "mongo_count", arguments: '{"connectionId":"c",' } }] } }] } },
        { data: { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"db":"mflix","collection":"movies"}' } }] } }] } },
        { data: { choices: [], usage: { prompt_tokens: 100, completion_tokens: 10 } } },
        { data: "[DONE]" },
      ]),
      sse([
        { data: { choices: [{ delta: { content: "There are 21,349 " } }] } },
        { data: { choices: [{ delta: { content: "movies." } }] } },
        { data: { choices: [], usage: { prompt_tokens: 150, completion_tokens: 5 } } },
        { data: "[DONE]" },
      ]),
    ]);
    const executed: any[] = [];
    const p = loopParams({
      history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
      prompt: "How many movies?",
      executeTool: async (name, args) => {
        executed.push({ name, args });
        return { success: true, count: 21349 };
      },
    });
    const res = await createDriver(key("openai"), "gpt-4o-mini").runToolLoop(p);

    assert.equal(p.out(), "There are 21,349 movies.");
    assert.equal(res.text, "There are 21,349 movies.");
    assert.deepEqual(res.usage, { tokensIn: 250, tokensOut: 15 });
    assert.equal(res.turns, 2);
    assert.equal(res.hitTurnLimit, false);
    assert.deepEqual(executed, [{ name: "mongo_count", args: { connectionId: "c", db: "mflix", collection: "movies" } }]);
    assert.equal(calls[0].headers.Authorization, "Bearer sk-test");
    assert.equal(calls[0].body.tools[0].function.parameters.type, "object");
    assert.equal("temperature" in calls[0].body, false);
    assert.deepEqual(calls[0].body.stream_options, { include_usage: true });
    const second = calls[1].body.messages;
    assert.equal(second.at(-2).tool_calls[0].id, "call_1");
    assert.deepEqual(second.at(-1), { role: "tool", tool_call_id: "call_1", content: JSON.stringify({ success: true, count: 21349 }) });
  });

  test("returns invalid tool input to the model instead of running the tool", async () => {
    const calls = mockFetch([
      sse([{ data: { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "mongo_count", arguments: '{"db":' } }] } }] } }]),
      sse([{ data: { choices: [{ delta: { content: "Sorry." } }] } }]),
    ]);
    let ran = false;
    await createDriver(key("openrouter", "k"), "Auto-Rotate").runToolLoop(
      loopParams({
        executeTool: async () => {
          ran = true;
        },
      })
    );
    assert.equal(ran, false);
    assert.match(calls[1].body.messages.at(-1).content, /INVALID_JSON/);
    assert.equal(calls[0].headers["X-Title"], "Wuup");
    assert.equal(calls[0].body.model, "google/gemini-2.5-flash");
  });

  test("forces a final answer on the last round", async () => {
    const toolTurn = () =>
      sse([{ data: { choices: [{ delta: { tool_calls: [{ index: 0, id: "c", function: { name: "mongo_count", arguments: '{"connectionId":"c","db":"d","collection":"x"}' } }] } }] } }]);
    const calls = mockFetch([toolTurn(), sse([{ data: { choices: [{ delta: { content: "done" } }] } }])]);
    await createDriver(key("openai", "k"), "m").runToolLoop(loopParams({ maxTurns: 2 }));
    assert.equal(calls[0].body.tool_choice, undefined);
    assert.equal(calls[1].body.tool_choice, "none");
  });

  test("tool calls on the last turn are not run and hitTurnLimit is set", async () => {
    const toolTurn = () =>
      sse([{ data: { choices: [{ delta: { tool_calls: [{ index: 0, id: "c", function: { name: "mongo_count", arguments: '{"connectionId":"c","db":"d","collection":"x"}' } }] } }] } }]);
    mockFetch([toolTurn()]);
    let runs = 0;
    const res = await createDriver(key("openai", "k"), "m").runToolLoop(
      loopParams({
        maxTurns: 1,
        executeTool: async () => {
          runs++;
          return {};
        },
      })
    );
    assert.equal(runs, 0);
    assert.equal(res.hitTurnLimit, true);
  });

  test("a throwing tool becomes a tool error, not a model error", async () => {
    const calls = mockFetch([
      sse([{ data: { choices: [{ delta: { tool_calls: [{ index: 0, id: "c", function: { name: "mongo_count", arguments: '{"connectionId":"c","db":"d","collection":"x"}' } }] } }] } }]),
      sse([{ data: { choices: [{ delta: { content: "It failed." } }] } }]),
    ]);
    const res = await createDriver(key("openai", "k"), "m").runToolLoop(
      loopParams({
        executeTool: async () => {
          throw new Error("boom");
        },
      })
    );
    assert.equal(res.text, "It failed.");
    assert.match(calls[1].body.messages.at(-1).content, /boom/);
  });

  test("a 429 on a user's key is recorded for the model picker", async () => {
    mockFetch([new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), { status: 429, headers: { "retry-after": "20" } })]);
    await assert.rejects(createDriver(key("openai", "k"), "gpt-4o").runToolLoop(loopParams({ tools: [] })), (e: any) => e.code === "MODEL_UNAVAILABLE");
    const until = modelHealth.cooldownUntil("k_test", "gpt-4o")!;
    assert.ok(until > Date.now() + 15_000 && until <= Date.now() + 20_000);
  });

  test("surfaces HTTP errors with the provider message and an error code", async () => {
    mockFetch([new Response(JSON.stringify({ error: { message: "Incorrect API key" } }), { status: 401 })]);
    await assert.rejects(createDriver(key("openai", "bad"), "m").runToolLoop(loopParams({ tools: [] })), (e: any) => {
      assert.match(e.message, /401 - Incorrect API key/);
      assert.equal(e.code, "PROVIDER_AUTH");
      return true;
    });
  });

  test("abort mid-stream rejects with ABORTED after the first token", async () => {
    mockFetch([stalledSse({ choices: [{ delta: { content: "Hel" } }] })]);
    const ctl = new AbortController();
    const p = loopParams({ tools: [], signal: ctl.signal, onText: () => ctl.abort() });
    await assert.rejects(createDriver(key("openai", "k"), "m").runToolLoop(p), (e: any) => e.code === "ABORTED");
  });

  test("a silent stream trips the idle watchdog", async () => {
    mockFetch([stalledSse({ choices: [{ delta: { content: "Hel" } }] })]);
    const started = Date.now();
    await assert.rejects(
      createDriver(key("openai", "k"), "m", { idleMs: 50 }).runToolLoop(loopParams({ tools: [] })),
      (e: any) => e.code === "PROVIDER_ERROR" && /stopped responding/.test(e.message)
    );
    assert.ok(Date.now() - started < 2000);
  });

  test("a request that never connects trips the connect timeout", async () => {
    globalThis.fetch = ((_url: any, init: any) =>
      new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))) as any;
    await assert.rejects(
      createDriver(key("openai", "k"), "m", { connectMs: 30 }).runToolLoop(loopParams({ tools: [] })),
      (e: any) => e.code === "PROVIDER_ERROR" && /too long/.test(e.message)
    );
  });
});

describe("Anthropic tool loop", () => {
  const anthropicToolTurn = () =>
    sse([
      { event: "message_start", data: { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 50, cache_read_input_tokens: 20 } } } },
      { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } } },
      { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Need a count." } } },
      { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig123" } } },
      { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
      { event: "content_block_start", data: { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } } },
      { event: "content_block_delta", data: { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Checking. " } } },
      { event: "content_block_start", data: { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_1", name: "mongo_count", input: {} } } },
      { event: "content_block_delta", data: { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"connectionId":"c","db":"mflix",' } } },
      { event: "content_block_delta", data: { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '"collection":"movies"}' } } },
      { event: "content_block_stop", data: { type: "content_block_stop", index: 2 } },
      { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 30 } } },
      { event: "message_stop", data: { type: "message_stop" } },
    ]);
  const endTurn = (text = "ok") =>
    sse([
      { data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
      { data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } } },
      { data: { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 7 } } },
    ]);

  test("defaults to claude-opus-5-5 with fallbacks, runs tool_use blocks and echoes thinking", async () => {
    const calls = mockFetch([anthropicToolTurn(), endTurn("21,349 movies.")]);
    const executed: any[] = [];
    const p = loopParams({
      system: ["static rules", "dynamic context"],
      history: [{ role: "assistant", content: "orphan" }, { role: "user", content: "earlier" }],
      prompt: "How many movies?",
      executeTool: async (name, args) => {
        executed.push({ name, args });
        return { success: true, count: 21349 };
      },
    });
    const res = await createDriver(key("anthropic", "sk-ant-test"), "auto").runToolLoop(p);

    assert.equal(p.out(), "Checking. 21,349 movies.");
    assert.deepEqual(executed, [{ name: "mongo_count", args: { connectionId: "c", db: "mflix", collection: "movies" } }]);
    assert.deepEqual(res.usage, { tokensIn: 70, tokensOut: 37 });

    const first = calls[0];
    assert.equal(first.headers["x-api-key"], "sk-ant-test");
    assert.equal(first.headers["anthropic-beta"], ANTHROPIC_FALLBACK_BETA);
    assert.equal(first.body.model, "claude-opus-5-5");
    assert.equal(first.body.fallbacks, "default");
    assert.equal(first.body.max_tokens, 64000);
    assert.equal("temperature" in first.body, false);
    assert.equal(first.body.tool_choice, undefined);
    assert.equal(first.body.tools[0].eager_input_streaming, true);
    assert.equal(first.body.tools[0].input_schema.type, "object");
    // Static block is cached; the dynamic block is not
    assert.deepEqual(first.body.system, [
      { type: "text", text: "static rules", cache_control: { type: "ephemeral" } },
      { type: "text", text: "dynamic context" },
    ]);
    // History must start with a user turn; the prompt merges into the trailing user turn
    assert.deepEqual(first.body.messages, [{ role: "user", content: "earlier\n\nHow many movies?" }]);

    const msgs = calls[1].body.messages;
    assert.deepEqual(msgs[1], {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Need a count.", signature: "sig123" },
        { type: "text", text: "Checking. " },
        { type: "tool_use", id: "toolu_1", name: "mongo_count", input: { connectionId: "c", db: "mflix", collection: "movies" } },
      ],
    });
    assert.deepEqual(msgs[2], {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify({ success: true, count: 21349 }) }],
    });
  });

  test("fallbacks are sent only for the supported set", async () => {
    const cases: Array<[string, boolean]> = [
      ["claude-opus-5-5", true],
      ["claude-opus-5", true],
      ["claude-sonnet-5-5", true],
      ["claude-fable-5-1", true],
      ["claude-haiku-5-5", false],
      ["claude-haiku-4-5", false],
      ["claude-sonnet-4-5", false],
    ];
    for (const [model, expected] of cases) {
      const calls = mockFetch([endTurn()]);
      await createDriver(key("anthropic", "k"), model).runToolLoop(loopParams());
      assert.equal(calls[0].body.fallbacks === "default", expected, model);
      assert.equal(calls[0].headers["anthropic-beta"] === ANTHROPIC_FALLBACK_BETA, expected, model);
    }
  });

  test("uses tool_choice none on the last turn (never forced any/tool)", async () => {
    const calls = mockFetch([anthropicToolTurn(), endTurn()]);
    await createDriver(key("anthropic", "k")).runToolLoop(loopParams({ maxTurns: 2 }));
    assert.equal(calls[0].body.tool_choice, undefined);
    assert.deepEqual(calls[1].body.tool_choice, { type: "none" });
  });

  test("retries once at 8192 when max_tokens is rejected", async () => {
    const calls = mockFetch([
      new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "max_tokens: 64000 > 32000, which is the maximum" } }), { status: 400 }),
      endTurn("fine"),
    ]);
    const p = loopParams({ tools: [] });
    await createDriver(key("anthropic", "k"), "claude-sonnet-4-0").runToolLoop(p);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.max_tokens, 64000);
    assert.equal(calls[1].body.max_tokens, 8192);
    assert.equal(p.out(), "fine");
  });

  test("older models get 8192 output tokens", async () => {
    const calls = mockFetch([endTurn()]);
    await createDriver(key("anthropic", "k"), "claude-3-5-sonnet-latest").runToolLoop(loopParams());
    assert.equal(calls[0].body.max_tokens, 8192);
  });

  test("never runs tools on a refusal", async () => {
    mockFetch([
      sse([
        { data: { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t", name: "mongo_count", input: {} } } },
        { data: { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"conn' } } },
        { data: { type: "message_delta", delta: { stop_reason: "refusal" } } },
      ]),
    ]);
    let ran = false;
    const p = loopParams({
      executeTool: async () => {
        ran = true;
      },
    });
    await createDriver(key("anthropic", "k"), "claude-opus-5-5").runToolLoop(p);
    assert.equal(ran, false);
    assert.match(p.out(), /declined/);
  });

  test("never runs tools when cut off at max_tokens", async () => {
    mockFetch([
      sse([
        { data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "Partial" } } },
        { data: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t", name: "mongo_count", input: {} } } },
        { data: { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"connectionId":"c","db":"d","collection":"x"}' } } },
        { data: { type: "message_delta", delta: { stop_reason: "max_tokens" } } },
      ]),
    ]);
    let ran = false;
    const p = loopParams({
      executeTool: async () => {
        ran = true;
      },
    });
    const res = await createDriver(key("anthropic", "k")).runToolLoop(p);
    assert.equal(ran, false);
    assert.equal(res.hitTurnLimit, false);
    assert.match(p.out(), /^Partial[\s\S]*cut off/);
  });

  test("stream error events are raised", async () => {
    mockFetch([sse([{ event: "error", data: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } }])]);
    await assert.rejects(createDriver(key("anthropic", "k")).runToolLoop(loopParams({ tools: [] })), /Overloaded/);
  });

  test("complete() sends no temperature and returns text + usage", async () => {
    const calls = mockFetch([
      new Response(JSON.stringify({ content: [{ type: "text", text: "Sales by region" }], usage: { input_tokens: 9, output_tokens: 4 } }), { status: 200 }),
    ]);
    const res = await createDriver(key("anthropic", "k"), "claude-haiku-5-5").complete({ prompt: "x", maxTokens: 30 });
    assert.equal(res.text, "Sales by region");
    assert.deepEqual(res.usage, { tokensIn: 9, tokensOut: 4 });
    assert.equal(calls[0].body.max_tokens, 30);
    assert.equal("temperature" in calls[0].body, false);
    assert.equal(calls[0].body.stream, undefined);
  });
});

describe("Gemini driver", () => {
  const geminiFrame = (parts: any[], usage?: any) => ({
    candidates: [{ content: { role: "model", parts } }],
    ...(usage ? { usageMetadata: usage } : {}),
  });
  const geminiSse = (...frames: any[]) =>
    new Response(frames.map((f) => `data: ${JSON.stringify(f)}\r\n\r\n`).join(""), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  const geminiError = (status: number, details: any[] = []) =>
    new Response(JSON.stringify({ error: { code: status, message: "quota", status: "RESOURCE_EXHAUSTED", details } }), { status });
  const modelOf = (url: string) => /models\/([^:]+):/.exec(url)?.[1];

  test("runs the tool loop, echoes function-call parts and forces NONE on the last turn", async () => {
    const calls = mockFetch([
      geminiSse(geminiFrame([{ functionCall: { name: "mongo_count", args: { connectionId: "c", db: "d", collection: "x" } }, thoughtSignature: "sig" }], { promptTokenCount: 10, candidatesTokenCount: 2 })),
      geminiSse(geminiFrame([{ text: "There are 5." }], { promptTokenCount: 20, candidatesTokenCount: 4 })),
    ]);
    const p = loopParams({ maxTurns: 2, executeTool: async () => ({ success: true, count: 5 }) });
    const res = await createDriver(key("gemini", null), "auto").runToolLoop(p);
    assert.equal(p.out(), "There are 5.");
    assert.equal(res.model, MODEL_ROTATION[0]);
    assert.deepEqual(res.usage, { tokensIn: 30, tokensOut: 6 });
    assert.equal(calls[0].body.toolConfig, undefined);
    assert.deepEqual(calls[1].body.toolConfig, { functionCallingConfig: { mode: "NONE" } });
    const echoed = calls[1].body.contents.at(-2);
    assert.equal(echoed.role, "model");
    assert.equal(echoed.parts[0].thoughtSignature, "sig");
    assert.deepEqual(calls[1].body.contents.at(-1).parts[0].functionResponse, { name: "mongo_count", response: { success: true, count: 5 } });
  });

  test("auto rotates to the next model on 429 before any output and marks the model exhausted", async () => {
    const calls = mockFetch([
      geminiError(429, [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }]),
      geminiSse(geminiFrame([{ text: "hi" }])),
    ]);
    const res = await createDriver(key("gemini", null), "auto").runToolLoop(loopParams({ tools: [] }));
    assert.equal(modelOf(calls[0].url), MODEL_ROTATION[0]);
    assert.equal(modelOf(calls[1].url), MODEL_ROTATION[1]);
    assert.equal(res.model, MODEL_ROTATION[1]);
    assert.deepEqual(modelHealth.exhausted("server"), [MODEL_ROTATION[0]]);
    // A "PerDay" quota cools down until the next Los Angeles midnight
    assert.equal(modelHealth.cooldownUntil("server", MODEL_ROTATION[0]), nextQuotaReset(Date.now()));
    // The next request skips the exhausted model
    const again = mockFetch([geminiSse(geminiFrame([{ text: "hi" }]))]);
    await createDriver(key("gemini", null), "auto").runToolLoop(loopParams({ tools: [] }));
    assert.equal(modelOf(again[0].url), MODEL_ROTATION[1]);
  });

  test("a throwing tool never causes rotation", async () => {
    const calls = mockFetch([
      geminiSse(geminiFrame([{ functionCall: { name: "mongo_count", args: { connectionId: "c", db: "d", collection: "x" } } }])),
      geminiSse(geminiFrame([{ text: "The query failed." }])),
    ]);
    const res = await createDriver(key("gemini", null), "auto").runToolLoop(
      loopParams({
        executeTool: async () => {
          throw new Error("ECONNREFUSED");
        },
      })
    );
    assert.equal(calls.length, 2);
    assert.equal(modelOf(calls[1].url), MODEL_ROTATION[0]);
    assert.equal(res.model, MODEL_ROTATION[0]);
    assert.match(JSON.stringify(calls[1].body.contents.at(-1)), /ECONNREFUSED/);
  });

  test("no rotation after output; an explicit model never rotates", async () => {
    mockFetch([geminiError(500)]);
    await assert.rejects(createDriver(key("gemini", "AIza-test"), "gemini-2.5-flash").runToolLoop(loopParams({ tools: [] })), (e: any) => e.code === "PROVIDER_ERROR");

    const calls = mockFetch([
      geminiSse(geminiFrame([{ functionCall: { name: "mongo_count", args: { connectionId: "c", db: "d", collection: "x" } } }])),
      geminiError(503),
    ]);
    await assert.rejects(createDriver(key("gemini", null), "auto").runToolLoop(loopParams()), (e: any) => e.status === 503);
    assert.equal(calls.length, 2);
  });

  test("400 errors (bad request) do not rotate; location errors get the generic region message", async () => {
    mockFetch([new Response(JSON.stringify({ error: { code: 400, message: "User location is not supported for the API use." } }), { status: 400 })]);
    await assert.rejects(createDriver(key("gemini", null), "auto").runToolLoop(loopParams({ tools: [] })), (e: any) => {
      assert.equal(e.code, "MODEL_UNAVAILABLE");
      assert.match(e.message, /isn't available in the server's region/);
      assert.doesNotMatch(e.message, /Singapore/);
      return true;
    });
  });
});

// ─── Groq ─────────────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
  "whisper-large-v3",
  "canopylabs/orpheus-v1-english",
  "meta-llama/llama-prompt-guard-2-86m",
  "openai/gpt-oss-safeguard-20b",
];
const groqKey = (availableModels?: string[]): LlmCredentials => ({ provider: "groq", apiKey: "gsk_test", keyId: "groq_k", availableModels });
const groqToolTurn = (id = "call_g1") =>
  sse([
    { data: { model: "openai/gpt-oss-120b", choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name: "mongo_count", arguments: "" } }] } }] } },
    { data: { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"connectionId":"c","db":"d","collection":"x"}' } }] } }] } },
    { data: { choices: [{ delta: {}, finish_reason: "tool_calls" }], x_groq: { usage: { prompt_tokens: 80, completion_tokens: 12 } } } },
    { data: "[DONE]" },
  ]);
const groqError = (status: number, message: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { message, type: "invalid_request_error" } }), { status, headers });

describe("Groq", () => {
  test("model choice: auto picks the best tool model the key has; light picks a small fast one; chat filter", () => {
    assert.equal(resolveModel("groq", "auto"), GROQ_TOOL_MODELS[0]);
    assert.equal(resolveModel("groq", "auto", ["llama-3.3-70b-versatile", "whisper-large-v3"]), "llama-3.3-70b-versatile");
    assert.equal(resolveModel("groq", "auto", GROQ_KEY_MODELS), "openai/gpt-oss-120b");
    assert.equal(resolveModel("groq", "llama-3.1-8b-instant"), "llama-3.1-8b-instant");
    assert.equal(resolveLightModel("groq", GROQ_KEY_MODELS), "llama-3.1-8b-instant");
    assert.equal(resolveLightModel("groq", ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]), "openai/gpt-oss-20b");
    assert.equal(lightModel(groqKey(["openai/gpt-oss-120b"])), "openai/gpt-oss-120b");
    assert.equal(lightModel(groqKey()), "llama-3.1-8b-instant");
    assert.deepEqual(GROQ_KEY_MODELS.filter(isGroqChatModel), ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"]);
    assert.equal(createDriver(groqKey(["llama-3.3-70b-versatile"])).model, "llama-3.3-70b-versatile");
  });

  test("streams a tool loop over the OpenAI-compatible endpoint", async () => {
    const calls = mockFetch([
      groqToolTurn(),
      sse([
        { data: { model: "openai/gpt-oss-120b", choices: [{ delta: { reasoning: "thinking..." } }] } },
        { data: { choices: [{ delta: { content: "There are " } }] } },
        { data: { choices: [{ delta: { content: "42 rows." } }] } },
        { data: { choices: [], usage: { prompt_tokens: 120, completion_tokens: 6 } } },
        { data: "[DONE]" },
      ]),
    ]);
    const executed: any[] = [];
    const p = loopParams({
      executeTool: async (name, args) => {
        executed.push({ name, args });
        return { success: true, count: 42 };
      },
    });
    const res = await createDriver(groqKey(GROQ_KEY_MODELS), "auto").runToolLoop(p);

    assert.equal(p.out(), "There are 42 rows.");
    assert.equal(res.model, "openai/gpt-oss-120b");
    assert.equal(res.turns, 2);
    assert.deepEqual(res.usage, { tokensIn: 200, tokensOut: 18 });
    assert.deepEqual(executed, [{ name: "mongo_count", args: { connectionId: "c", db: "d", collection: "x" } }]);
    assert.equal(calls[0].url, GROQ_URL);
    assert.equal(calls[0].headers.Authorization, "Bearer gsk_test");
    assert.equal(calls[0].headers["X-Title"], undefined);
    assert.equal(calls[0].body.model, "openai/gpt-oss-120b");
    assert.equal(calls[0].body.stream, true);
    assert.deepEqual(calls[0].body.stream_options, { include_usage: true });
    assert.equal("temperature" in calls[0].body, false);
    assert.equal("parallel_tool_calls" in calls[0].body, false);
    assert.equal(calls[0].body.tool_choice, undefined);
    assert.equal(calls[1].body.messages.at(-2).tool_calls[0].id, "call_g1");
    assert.equal(calls[1].body.messages.at(-1).role, "tool");
  });

  test("forces a final answer with tool_choice none on the last turn", async () => {
    const calls = mockFetch([groqToolTurn(), sse([{ data: { choices: [{ delta: { content: "done" } }] } }])]);
    const res = await createDriver(groqKey(), "llama-3.3-70b-versatile").runToolLoop(loopParams({ maxTurns: 2 }));
    assert.equal(res.text, "done");
    assert.equal(calls[0].body.tool_choice, undefined);
    assert.equal(calls[1].body.tool_choice, "none");
    assert.equal(calls[1].body.model, "llama-3.3-70b-versatile");
  });

  test("a 401 surfaces PROVIDER_AUTH", async () => {
    mockFetch([groqError(401, "Invalid API Key")]);
    await assert.rejects(
      createDriver(groqKey(), "auto").runToolLoop(loopParams()),
      (e: any) => e instanceof LlmError && e.code === "PROVIDER_AUTH" && e.status === 401 && /Invalid API Key/.test(e.message)
    );
  });

  test("a 429 cools the model down for retry-after seconds", async () => {
    mockFetch([groqError(429, "Rate limit reached for model llama-3.3-70b-versatile", { "retry-after": "17" })]);
    const before = Date.now();
    await assert.rejects(
      createDriver(groqKey(), "llama-3.3-70b-versatile").runToolLoop(loopParams()),
      (e: any) => e.code === "MODEL_UNAVAILABLE" && e.status === 429
    );
    const until = modelHealth.cooldownUntil("groq_k", "llama-3.3-70b-versatile")!;
    assert.ok(until >= before + 17_000 && until <= Date.now() + 17_000, String(until - before));
    assert.ok(modelHealth.isAvailable("other_key", "llama-3.3-70b-versatile"));
  });

  test("auto moves to the next model on a 429 and skips cooled-down models next time", async () => {
    const calls = mockFetch([
      groqError(429, "Rate limit reached", { "retry-after": "30" }),
      sse([{ data: { model: "llama-3.3-70b-versatile", choices: [{ delta: { content: "hi" } }] } }]),
    ]);
    const res = await createDriver(groqKey(GROQ_KEY_MODELS), "auto").runToolLoop(loopParams());
    assert.equal(res.text, "hi");
    assert.equal(res.model, "llama-3.3-70b-versatile");
    assert.deepEqual(calls.map((c) => c.body.model), ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"]);
    assert.equal(modelHealth.isAvailable("groq_k", "openai/gpt-oss-120b"), false);
    assert.equal(createDriver(groqKey(GROQ_KEY_MODELS), "auto").model, "llama-3.3-70b-versatile");
  });

  test("a 400 tool_use_failed is re-sampled once", async () => {
    const calls = mockFetch([
      groqError(400, "Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details."),
      sse([{ data: { choices: [{ delta: { content: "ok" } }] } }]),
    ]);
    const res = await createDriver(groqKey(), "openai/gpt-oss-120b").runToolLoop(loopParams());
    assert.equal(res.text, "ok");
    assert.equal(calls.length, 2);
  });

  test("complete uses max_completion_tokens and low reasoning for gpt-oss", async () => {
    const calls = mockFetch([
      new Response(JSON.stringify({ choices: [{ message: { content: "Sales by region" } }], usage: { prompt_tokens: 9, completion_tokens: 3 } }), { status: 200 }),
      new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200 }),
    ]);
    const out = await createDriver(groqKey(), "openai/gpt-oss-20b").complete({ prompt: "p", maxTokens: 30 });
    assert.equal(out.text, "Sales by region");
    assert.deepEqual(out.usage, { tokensIn: 9, tokensOut: 3 });
    assert.equal(calls[0].url, GROQ_URL);
    assert.equal(calls[0].body.max_completion_tokens, 30);
    assert.equal(calls[0].body.max_tokens, undefined);
    assert.equal(calls[0].body.reasoning_effort, "low");
    await createDriver(groqKey(), "llama-3.1-8b-instant").complete({ prompt: "p", maxTokens: 30, json: true });
    assert.equal(calls[1].body.reasoning_effort, undefined);
    assert.equal(calls[1].body.response_format, undefined);
  });

  test("listModels shows the key's chat models only, best tool models first", () => {
    const brain = new Brain();
    const models = brain.listModels(groqKey(), { availableModels: [...GROQ_KEY_MODELS, "qwen/qwen3.8-27b"] });
    assert.deepEqual(
      models.map((m) => m.id),
      ["auto", "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "qwen/qwen3.8-27b", "llama-3.1-8b-instant"]
    );
    assert.ok(models.every((m) => m.provider === "groq"));
    assert.equal(models.find((m) => m.id === "llama-3.3-70b-versatile")!.label, "Llama 3.3 70B");
    modelHealth.markExhausted("groq_k", "openai/gpt-oss-120b", { retryAfterMs: 30_000 });
    const after = brain.listModels(groqKey(), { availableModels: GROQ_KEY_MODELS });
    assert.equal(after[0].available, true, "auto still works through the other models");
    assert.equal(after.find((m) => m.id === "openai/gpt-oss-120b")!.available, false);
  });
});
