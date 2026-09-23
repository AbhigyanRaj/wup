import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  anthropicEchoContent,
  parseToolInput,
  resolveModel,
  streamWithTools,
  toJsonSchema,
} from "../src/ai/providers";

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

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replaces fetch with a queue of responses and records request bodies. */
function mockFetch(responses: Response[]) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return next;
  }) as any;
  return calls;
}

async function collect(gen: AsyncGenerator<string>) {
  let out = "";
  for await (const c of gen) out += c;
  return out;
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

  test("resolveModel defaults per provider", () => {
    assert.equal(resolveModel("anthropic", "Auto-Rotate"), "claude-opus-5");
    assert.equal(resolveModel("openai"), "gpt-4o-mini");
    assert.equal(resolveModel("anthropic", "claude-sonnet-5"), "claude-sonnet-5");
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
});

describe("OpenAI-compatible tool loop", () => {
  test("streams text, runs tool calls, and sends results back", async () => {
    const calls = mockFetch([
      sse([
        { data: { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "mongo_count", arguments: '{"connectionId":"c",' } }] } }] } },
        { data: { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"db":"mflix","collection":"movies"}' } }] } }] } },
        { data: "[DONE]" },
      ]),
      sse([{ data: { choices: [{ delta: { content: "There are 21,349 " } }] } }, { data: { choices: [{ delta: { content: "movies." } }] } }, { data: "[DONE]" }]),
    ]);
    const executed: any[] = [];
    const text = await collect(
      streamWithTools({
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        systemInstruction: "sys",
        history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
        prompt: "How many movies?",
        declarations: [countDecl],
        executeTool: async (name, args) => {
          executed.push({ name, args });
          return { success: true, count: 21349 };
        },
      })
    );

    assert.equal(text, "There are 21,349 movies.");
    assert.deepEqual(executed, [{ name: "mongo_count", args: { connectionId: "c", db: "mflix", collection: "movies" } }]);
    assert.equal(calls[0].headers.Authorization, "Bearer sk-test");
    assert.equal(calls[0].body.tools[0].function.parameters.type, "object");
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
    await collect(
      streamWithTools({
        provider: "openrouter",
        apiKey: "k",
        model: "Auto-Rotate",
        systemInstruction: "s",
        history: [],
        prompt: "p",
        declarations: [countDecl],
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
    await collect(
      streamWithTools({
        provider: "openai",
        apiKey: "k",
        model: "m",
        systemInstruction: "s",
        history: [],
        prompt: "p",
        declarations: [countDecl],
        executeTool: async () => ({ success: true }),
        maxTurns: 2,
      })
    );
    assert.equal(calls[0].body.tool_choice, undefined);
    assert.equal(calls[1].body.tool_choice, "none");
  });

  test("surfaces HTTP errors with the provider message", async () => {
    mockFetch([new Response(JSON.stringify({ error: { message: "Incorrect API key" } }), { status: 401 })]);
    await assert.rejects(
      collect(
        streamWithTools({
          provider: "openai",
          apiKey: "bad",
          model: "m",
          systemInstruction: "s",
          history: [],
          prompt: "p",
          declarations: [],
          executeTool: async () => ({}),
        })
      ),
      /401 - Incorrect API key/
    );
  });
});

describe("Anthropic tool loop", () => {
  const anthropicToolTurn = () =>
    sse([
      { event: "message_start", data: { type: "message_start", message: { model: "claude-opus-5" } } },
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
      { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "tool_use" } } },
      { event: "message_stop", data: { type: "message_stop" } },
    ]);

  test("runs tool_use blocks, echoes thinking, and returns results in one user message", async () => {
    const calls = mockFetch([
      anthropicToolTurn(),
      sse([
        { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
        { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "21,349 movies." } } },
        { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn" } } },
      ]),
    ]);
    const executed: any[] = [];
    const text = await collect(
      streamWithTools({
        provider: "anthropic",
        apiKey: "sk-ant-test",
        model: "Auto-Rotate",
        systemInstruction: "sys",
        history: [{ role: "assistant", content: "orphan" }, { role: "user", content: "earlier" }],
        prompt: "How many movies?",
        declarations: [countDecl],
        executeTool: async (name, args) => {
          executed.push({ name, args });
          return { success: true, count: 21349 };
        },
      })
    );

    assert.equal(text, "Checking. 21,349 movies.");
    assert.deepEqual(executed, [{ name: "mongo_count", args: { connectionId: "c", db: "mflix", collection: "movies" } }]);

    const first = calls[0];
    assert.equal(first.headers["x-api-key"], "sk-ant-test");
    assert.equal(first.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
    assert.equal(first.body.model, "claude-opus-5");
    assert.equal(first.body.fallbacks, "default");
    assert.equal(first.body.tools[0].eager_input_streaming, true);
    assert.equal(first.body.tools[0].input_schema.type, "object");
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

  test("does not send fallbacks for models that don't use them", async () => {
    const calls = mockFetch([
      sse([{ data: { type: "message_delta", delta: { stop_reason: "end_turn" } } }]),
    ]);
    await collect(
      streamWithTools({
        provider: "anthropic",
        apiKey: "k",
        model: "claude-haiku-4-5",
        systemInstruction: "s",
        history: [],
        prompt: "p",
        declarations: [countDecl],
        executeTool: async () => ({}),
      })
    );
    assert.equal(calls[0].body.fallbacks, undefined);
    assert.equal(calls[0].headers["anthropic-beta"], undefined);
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
    const text = await collect(
      streamWithTools({
        provider: "anthropic",
        apiKey: "k",
        model: "claude-opus-5",
        systemInstruction: "s",
        history: [],
        prompt: "p",
        declarations: [countDecl],
        executeTool: async () => {
          ran = true;
        },
      })
    );
    assert.equal(ran, false);
    assert.match(text, /declined/);
  });

  test("stream error events are raised", async () => {
    mockFetch([sse([{ event: "error", data: { type: "error", error: { message: "Overloaded" } } }])]);
    await assert.rejects(
      collect(
        streamWithTools({
          provider: "anthropic",
          apiKey: "k",
          model: "claude-opus-5",
          systemInstruction: "s",
          history: [],
          prompt: "p",
          declarations: [],
          executeTool: async () => ({}),
        })
      ),
      /Overloaded/
    );
  });
});
