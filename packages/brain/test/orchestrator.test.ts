import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { User } from "@wup/models";
import {
  CLARIFICATION_ALREADY_ASKED,
  MetaStreamFilter,
  RAN_OUT_OF_STEPS,
  applyGrounding,
  chatMaxTurns,
  heuristicTitle,
  parseStructuredResponse,
  tidyTitle,
} from "../src/orchestrator";
import { WUP_TOOLS_REGISTRY } from "../src/tools/registry";
import { FakeDriver, META, docChunk, makeBrain, mongoBridge, request, runCollect, waitForAbort } from "./helpers/fakes";

describe("MetaStreamFilter", () => {
  test("hides the meta block even when the marker is split across chunks", () => {
    const f = new MetaStreamFilter();
    const raw = `There are **21,349** movies.\n\n${META({ type: "answer", followUps: [], visualType: "none" })}`;
    let shown = "";
    // Feed 3 characters at a time so the marker is always split
    for (let i = 0; i < raw.length; i += 3) shown += f.push(raw.slice(i, i + 3));
    shown += f.flush();
    assert.equal(shown.trim(), "There are **21,349** movies.");
    assert.equal(parseStructuredResponse(f.fullText()).content, "There are **21,349** movies.");
  });

  test("flushes everything when there is no meta block", () => {
    const f = new MetaStreamFilter();
    const shown = f.push("short") + f.flush();
    assert.equal(shown, "short");
    assert.equal(f.fullText(), "short");
  });
});

describe("applyGrounding", () => {
  const rows = [
    { _id: "Drama", avgRating: 7.2, count: 100 },
    { _id: "Comedy", avgRating: 6.4, count: 80 },
  ];

  test("replaces model-written table data with the real rows", () => {
    const out = applyGrounding(
      { content: "x", followUps: [], visualType: "table", tableData: { columns: ["fake"], rows: [{ fake: 999 }] } },
      rows
    );
    assert.equal(out.visualType, "table");
    assert.deepEqual(out.tableData!.columns, ["avgRating", "count", "_id"]);
    assert.equal(out.tableData!.rows[0].avgRating, 7.2);
  });

  test("fills chart series from real rows when the axis keys match", () => {
    const out = applyGrounding(
      {
        content: "x",
        followUps: [],
        visualType: "chart",
        chartData: { type: "bar", xAxisKey: "_id", yAxisKey: "avgRating", series: [{ _id: "Made up", avgRating: 10 }] },
      },
      rows
    );
    assert.equal(out.visualType, "chart");
    assert.deepEqual(out.chartData!.series, [
      { _id: "Drama", avgRating: 7.2 },
      { _id: "Comedy", avgRating: 6.4 },
    ]);
  });

  test("falls back to a table when chart keys don't exist in the rows", () => {
    const out = applyGrounding(
      { content: "x", followUps: [], visualType: "chart", chartData: { type: "bar", xAxisKey: "genre", yAxisKey: "avg", series: [] } },
      rows
    );
    assert.equal(out.visualType, "table");
    assert.equal(out.chartData, undefined);
  });

  test("leaves diagrams, clarifications and query-free answers alone", () => {
    const diagram = { content: "x", followUps: [], visualType: "diagram" as const, diagramData: { nodes: [], edges: [] } };
    assert.deepEqual(applyGrounding(diagram, rows), diagram);
    const clar = { content: "?", followUps: [], visualType: "none" as const, clarification: { question: "?", options: [], allowFreeText: true } };
    assert.deepEqual(applyGrounding(clar, rows), clar);
    const plain = { content: "hi", followUps: [], visualType: "none" as const };
    assert.deepEqual(applyGrounding(plain, undefined), plain);
  });
});

describe("parseStructuredResponse", () => {
  test("parses answers with follow-ups", () => {
    const r = parseStructuredResponse(`Answer\n${META({ type: "answer", followUps: [{ label: "a", suggestedPrompt: "b" }], visualType: "chart" })}`);
    assert.equal(r.content, "Answer");
    assert.equal(r.followUps.length, 1);
    assert.equal(r.visualType, "chart");
  });

  test("parses clarifications and survives broken JSON", () => {
    const c = parseStructuredResponse(`Which?\n${META({ type: "clarification", question: "Which?", options: ["A", "B"] })}`);
    // Sanitised by the contracts MetaBlockSchema, which adds allowFreeText (default true).
    assert.deepEqual(c.clarification, { question: "Which?", options: ["A", "B"], allowFreeText: true });
    const broken = parseStructuredResponse("Hi\n---WUP_META---\n{nope\n---END_WUP_META---");
    assert.equal(broken.content, "Hi");
    assert.equal(broken.visualType, "none");
  });
});

describe("titles", () => {
  test("heuristicTitle: first line, collapsed, word boundary, no trailing punctuation", () => {
    assert.equal(heuristicTitle("  How many   movies\nare there?"), "How many movies");
    assert.equal(heuristicTitle("What are the top genres by average rating?"), "What are the top genres by average rating");
    const long = heuristicTitle("Show me every customer who placed more than three orders in the last quarter of the year please");
    assert.ok(long.length <= 60, long);
    assert.ok(!long.endsWith(" "));
    assert.equal(long, "Show me every customer who placed more than three orders in");
    assert.equal(heuristicTitle("   \n "), "New chat");
  });

  test("tidyTitle strips quotes, prefixes and em dashes", () => {
    assert.equal(tidyTitle('Title: "Revenue \u2014 Q3 review."'), "Revenue - Q3 review");
  });
});

describe("Brain.run with a fake driver", () => {
  test("hitting the turn limit appends the ran-out note and flushes the held-back tail", async () => {
    const driver = new FakeDriver("gemini-2.5-flash", async (p) => {
      p.onText("Partial"); // shorter than the filter's hold-back, so it stays buffered
      return { hitTurnLimit: true };
    });
    const { brain } = makeBrain(driver);
    const { result, tokens } = await runCollect(brain, request());
    assert.equal(driver.loops[0].maxTurns, chatMaxTurns());
    assert.equal(result.outcome, "complete");
    assert.equal(tokens, `Partial${RAN_OUT_OF_STEPS}`);
    assert.equal(result.content, `Partial${RAN_OUT_OF_STEPS}`.trim());
    assert.equal(result.producedOutput, true);
    assert.notEqual(result.firstTokenMs, null);
  });

  test("a throwing tool comes back as a tool error and an error tool event (no model error)", async () => {
    const original = WUP_TOOLS_REGISTRY.web_search;
    WUP_TOOLS_REGISTRY.web_search = async () => {
      throw new Error("network down");
    };
    try {
      let toolResult: any;
      const driver = new FakeDriver("gemini-2.5-flash", async (p) => {
        toolResult = await p.executeTool("web_search", { query: "x" });
        p.onText("Sorry, search failed.");
      });
      const { brain } = makeBrain(driver);
      const { result, events } = await runCollect(brain, request({ searchWeb: true }));
      assert.deepEqual(toolResult, { success: false, error: "network down" });
      assert.equal(result.outcome, "complete");
      assert.equal(result.toolCalls, 1);
      const toolEvents = events.filter((e) => e.type === "tool");
      assert.deepEqual(
        toolEvents.map((e: any) => e.state),
        ["running", "error"]
      );
      assert.ok(events.some((e) => e.type === "status" && e.code === "tool.web"));
    } finally {
      WUP_TOOLS_REGISTRY.web_search = original;
    }
  });

  test("prototype names and disabled tools are unknown tools", async () => {
    const results: any[] = [];
    const driver = new FakeDriver("gemini-2.5-flash", async (p) => {
      for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty", "web_search"]) {
        results.push(await p.executeTool(name, {}));
      }
      p.onText("ok");
    });
    const { brain } = makeBrain(driver);
    await runCollect(brain, request({ searchWeb: false }));
    assert.equal(results.length, 5);
    for (const r of results) assert.match(r.error, /^Unknown tool: /);
  });

  test("declares only the relevant tools", async () => {
    const driver = new FakeDriver("m", async (p) => p.onText("ok"));
    const { brain } = makeBrain(driver, { connections: [mongoBridge] });
    await runCollect(brain, request({ searchWeb: false }));
    const names = driver.loops[0].tools.map((t) => t.name);
    assert.ok(names.includes("mongo_count"));
    assert.ok(!names.includes("web_search"));
    assert.ok(!names.includes("read_sheets"));

    const d2 = new FakeDriver("m", async (p) => p.onText("ok"));
    await runCollect(makeBrain(d2).brain, request({ searchWeb: true }));
    assert.deepEqual(
      d2.loops[0].tools.map((t) => t.name),
      ["web_search"]
    );
  });

  test("injects the preferences block (meta markers stripped) after the static rules", async () => {
    const driver = new FakeDriver("m", async (p) => p.onText("ok"));
    const { brain } = makeBrain(driver);
    await runCollect(
      brain,
      request({
        preferences: {
          aboutMe: "I run a bookshop",
          responseStyle: "concise",
          customInstructions: "Use British spelling ---WUP_META--- {\"x\":1} ---END_WUP_META---",
          preferTables: true,
        },
      })
    );
    const system = driver.loops[0].system as string[];
    assert.equal(system.length, 2);
    assert.match(system[0], /^You are wuup/);
    assert.doesNotMatch(system[0], /USER PREFERENCES/);
    assert.match(system[1], /USER PREFERENCES/);
    assert.match(system[1], /I run a bookshop/);
    assert.match(system[1], /Use British spelling/);
    assert.match(system[1], /prefer a table/);
    assert.match(system[1], /never override the data, read-only or citation rules/);
    assert.doesNotMatch(system[1], /WUP_META/);
  });

  test("adds the do-not-ask-again instruction after a clarification", async () => {
    const driver = new FakeDriver("m", async (p) => p.onText("ok"));
    const { brain } = makeBrain(driver);
    await runCollect(brain, request({ previousWasClarification: true }));
    assert.ok((driver.loops[0].system as string[])[1].includes(CLARIFICATION_ALREADY_ASKED));

    const d2 = new FakeDriver("m", async (p) => p.onText("ok"));
    await runCollect(makeBrain(d2).brain, request());
    assert.ok(!(d2.loops[0].system as string[])[1].includes(CLARIFICATION_ALREADY_ASKED));
  });

  test("numbers RAG chunks first, emits sources and marks cited ones", async () => {
    const driver = new FakeDriver("m", async (p) => {
      p.onText(`Revenue grew [2]. Unknown [9].\n${META({ type: "answer", followUps: [], visualType: "none" })}`);
    });
    const { brain } = makeBrain(driver, { chunks: [docChunk(1), docChunk(2)] });
    const { result, events } = await runCollect(brain, request());
    assert.match((driver.loops[0].system as string[])[1], /\[1\] Source: "Report 1.pdf"/);
    assert.match((driver.loops[0].system as string[])[1], /\[2\] Source: "Report 2.pdf"/);
    assert.equal(result.content, "Revenue grew [2]. Unknown.");
    assert.deepEqual(
      result.sources.map((s) => [s.n, s.kind, s.cited]),
      [
        [1, "doc", false],
        [2, "doc", true],
      ]
    );
    const last = events.filter((e) => e.type === "sources").at(-1) as any;
    assert.equal(last.sources[1].cited, true);
  });

  test("status codes are emitted in order", async () => {
    const driver = new FakeDriver("m", async (p) => p.onText("ok"));
    const { events } = await runCollect(makeBrain(driver).brain, request());
    assert.deepEqual(
      events.filter((e) => e.type === "status").map((e: any) => e.code),
      ["context.rag", "context.bridges", "llm.routing", "llm.generating"]
    );
  });

  test("abort returns the partial answer with outcome stopped", async () => {
    const ctl = new AbortController();
    const driver = new FakeDriver("m", async (p) => {
      p.onText("The first part of a long answer");
      ctl.abort();
      return waitForAbort(p.signal);
    });
    const { result } = await runCollect(makeBrain(driver).brain, request(), ctl.signal);
    assert.equal(result.outcome, "stopped");
    assert.equal(result.content, "The first part of a long answer");
    assert.equal(result.error, undefined);
  });

  test("provider errors become outcome error with a code (never a throw)", async () => {
    const { LlmError } = await import("../src/ai/driver");
    const driver = new FakeDriver("m", async () => {
      throw new LlmError("PROVIDER_AUTH", "API error: 401 - bad key", 401);
    });
    const { result } = await runCollect(makeBrain(driver).brain, request({ llm: { provider: "gemini", apiKey: "AIza", keyId: "abc" } }));
    assert.equal(result.outcome, "error");
    assert.equal(result.error?.code, "PROVIDER_AUTH");
    assert.match(result.error!.message, /Gemini API key was rejected/);
    assert.equal(result.producedOutput, false);
  });

  test("an unknown provider is an error result, not a throw", async () => {
    const { Brain } = await import("../src/orchestrator");
    const brain = new Brain({ contextLoader: makeBrain(new FakeDriver("m", async () => {})).loader });
    const { result } = await runCollect(brain, request({ llm: { provider: "mistral" as any, apiKey: "k", keyId: "k" } }));
    assert.equal(result.outcome, "error");
    assert.equal(result.error?.code, "PROVIDER_ERROR");
  });

  test("clarification answers carry no follow-ups", async () => {
    const driver = new FakeDriver("m", async (p) =>
      p.onText(`Which collection?\n${META({ type: "clarification", question: "Which collection?", options: ["movies", "comments"] })}`)
    );
    const { result } = await runCollect(makeBrain(driver, { connections: [mongoBridge] }).brain, request());
    assert.equal(result.clarification?.question, "Which collection?");
    assert.deepEqual(result.followUps, []);
    assert.equal(result.content, "Which collection?");
  });
});

describe("listModels and suggestQuestions", () => {
  test("lists auto first with cooldown state per key", async () => {
    const driver = new FakeDriver("m", async () => {});
    const { brain } = makeBrain(driver);
    const health = (brain as any).health;
    health.markExhausted("server", "gemini-2.5-flash", { errorDetails: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" }] });
    const models = brain.listModels({ provider: "gemini", apiKey: null, keyId: "server" });
    assert.equal(models[0].id, "auto");
    assert.equal(models[0].available, true);
    const flash = models.find((m) => m.id === "gemini-2.5-flash")!;
    assert.equal(flash.available, false);
    assert.ok(flash.cooldownUntil);
    const other = brain.listModels({ provider: "gemini", apiKey: "x", keyId: "user1" });
    assert.equal(other.find((m) => m.id === "gemini-2.5-flash")!.available, true);
    const anthropic = brain.listModels({ provider: "anthropic", apiKey: "k", keyId: "a" }, { availableModels: ["claude-opus-4-1", "text-embedding"] });
    assert.deepEqual(
      anthropic.map((m) => m.id),
      ["auto", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-4-1"]
    );
  });

  test("suggestQuestions parses JSON leniently and never throws", async () => {
    const driver = new FakeDriver("m", async () => {}, async () => 'Sure! {"questions":["How many movies are there?","Top genres \u2014 by rating?"]}');
    const { brain } = makeBrain(driver);
    assert.deepEqual(await brain.suggestQuestions("mflix.movies: title, genres", { provider: "gemini", apiKey: null, keyId: "server" }), [
      "How many movies are there?",
      "Top genres, by rating?",
    ]);
    const failing = new FakeDriver("m", async () => {}, async () => {
      throw new Error("down");
    });
    assert.deepEqual(await makeBrain(failing).brain.suggestQuestions("x", { provider: "gemini", apiKey: null, keyId: "server" }), []);
  });

  test("generateTitle uses the provider and falls back to the heuristic", async () => {
    const driver = new FakeDriver("m", async () => {}, async () => '"Movie counts by genre."');
    assert.equal(await makeBrain(driver).brain.generateTitle("how many movies per genre", { provider: "gemini", apiKey: null, keyId: "server" }), "Movie counts by genre");
    assert.equal(driver.completes[0].maxTokens, 30);
    const failing = new FakeDriver("m", async () => {}, async () => {
      throw new Error("timeout");
    });
    assert.equal(await makeBrain(failing).brain.generateTitle("how many movies per genre?", { provider: "gemini", apiKey: null, keyId: "server" }), "how many movies per genre");
  });
});

describe("askStream (legacy compatibility wrapper)", () => {
  const originalFind = (User as any).findById;
  afterEach(() => {
    (User as any).findById = originalFind;
  });

  test("yields tokens then a done payload in the old shape and charges the free tier", async () => {
    let saved = 0;
    const user: any = { freeTierUsage: 2, freeTierLimit: 50, customApiKey: "", save: async () => void saved++ };
    (User as any).findById = async () => user;
    const driver = new FakeDriver("gemini-2.5-flash", async (p) => {
      p.onText(`There are 21,349 movies [1].\n${META({ type: "answer", followUps: [{ label: "By year", suggestedPrompt: "Movies per year?" }], visualType: "none" })}`);
    });
    const { brain } = makeBrain(driver, { chunks: [docChunk(1)] });
    const statuses: string[] = [];
    const chunks: any[] = [];
    for await (const c of brain.askStream("507f1f77bcf86cd799439011", "How many movies?", { model: "Auto-Rotate", onStatus: (m) => statuses.push(m) })) {
      chunks.push(c);
    }
    const tokens = chunks.filter((c) => typeof c === "string").join("");
    const done = chunks.at(-1);
    assert.equal(done.type, "done");
    assert.equal(tokens.trim(), "There are 21,349 movies [1].");
    assert.equal(done.data.content, "There are 21,349 movies [1].");
    assert.deepEqual(done.data.followUps, [{ label: "By year", suggestedPrompt: "Movies per year?" }]);
    assert.deepEqual(done.data.ragSources, [{ sourceFile: "Report 1.pdf", pageNumber: 1, score: 0.9, text: "Passage 1" }]);
    assert.deepEqual(done.data.webSources, []);
    assert.equal(done.data.usedModel, "gemini-2.5-flash");
    assert.ok(Array.isArray(done.data.exhausted));
    assert.equal(user.freeTierUsage, 3);
    assert.equal(saved, 1);
    assert.ok(statuses.length > 0);
    assert.equal(driver.loops[0].prompt, "How many movies?");
  });

  test("stops at the free tier limit without calling the model", async () => {
    (User as any).findById = async () => ({ freeTierUsage: 50, freeTierLimit: 50, customApiKey: "", save: async () => {} });
    const driver = new FakeDriver("m", async () => {});
    const out: any[] = [];
    for await (const c of makeBrain(driver).brain.askStream("u", "hi")) out.push(c);
    assert.match(out[0], /free tier limit/);
    assert.equal(out[1].data.source, "system");
    assert.equal(driver.loops.length, 0);
  });

  test("a user's own key skips the free tier and is passed to the driver", async () => {
    let saved = false;
    const user: any = { freeTierUsage: 50, freeTierLimit: 50, customApiKey: "sk-ant-legacy", customApiProvider: "anthropic", save: async () => (saved = true) };
    (User as any).findById = async () => user;
    let seen: any;
    const { Brain } = await import("../src/orchestrator");
    const driver = new FakeDriver("claude-opus-5-5", async (p) => p.onText("hello there"));
    const brain = new Brain({
      createDriver: (llm) => {
        seen = llm;
        return driver;
      },
      contextLoader: makeBrain(driver).loader,
    });
    const out: any[] = [];
    for await (const c of brain.askStream("u", "hi")) out.push(c);
    assert.equal(seen.provider, "anthropic");
    assert.equal(seen.apiKey, "sk-ant-legacy");
    assert.match(seen.keyId, /^[0-9a-f]{12}$/);
    assert.equal(saved, false);
    assert.equal(out.at(-1).data.content, "hello there");
  });
});
