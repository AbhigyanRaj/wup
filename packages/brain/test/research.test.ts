import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { WUP_TOOLS_REGISTRY } from "../src/tools/registry";
import { parsePlan } from "../src/research/plan";
import type { RunToolLoopParams } from "../src/ai/driver";
import { FakeDriver, META, makeBrain, mongoBridge, request, runCollect, waitForAbort } from "./helpers/fakes";

const isReport = (p: RunToolLoopParams) => (p.system as string[])[1].includes("RESEARCH REPORT MODE");
const stepEvents = (events: any[]) => events.filter((e) => e.type === "step").map((e) => `${e.step.id}:${e.step.status}`);

const originals = { ...WUP_TOOLS_REGISTRY };
afterEach(() => {
  Object.assign(WUP_TOOLS_REGISTRY, originals);
  delete process.env.RESEARCH_TIMEOUT_MS;
  delete process.env.RESEARCH_MAX_STEPS;
});

describe("parsePlan", () => {
  test("validates, caps steps and filters sources to what is available", () => {
    const text = JSON.stringify({
      steps: [
        { title: "A", question: "qa", use: ["data", "web"] },
        { title: "B", question: "qb", use: ["telepathy"] },
        { title: "C", question: "qc", use: ["docs"] },
      ],
    });
    const steps = parsePlan(text, ["data", "docs"], 2)!;
    assert.equal(steps.length, 2);
    assert.deepEqual(steps[0].use, ["data"]);
    assert.deepEqual(steps[1].use, ["data", "docs"]);
    assert.equal(parsePlan("nope", ["data"], 5), null);
    assert.equal(parsePlan('{"steps":[]}', ["data"], 5), null);
    assert.equal(parsePlan('Here you go: {"steps":[{"title":"T","question":"Q"}]} thanks', [], 5)!.length, 1);
  });
});

describe("research mode", () => {
  test("falls back to a one-step plan and streams the report through the meta filter", async () => {
    const driver = new FakeDriver(
      "gemini-2.5-flash",
      async (p) => {
        if (isReport(p)) {
          p.onText(`## Summary\nThe answer.\n${META({ type: "answer", followUps: [{ label: "More", suggestedPrompt: "Tell me more" }], visualType: "none" })}`);
        } else {
          p.onText("Notes: found it.");
        }
      },
      async () => "I cannot produce JSON today"
    );
    const { result, events, tokens } = await runCollect(makeBrain(driver).brain, request({ mode: "research", prompt: "Why?" }));
    assert.equal(result.outcome, "complete");
    assert.deepEqual(stepEvents(events), ["s1:pending", "s1:running", "s1:done"]);
    assert.equal(result.research!.steps[0].title, "Research the question");
    assert.equal(result.research!.steps[0].detail, "Notes: found it.");
    assert.equal(result.content, "## Summary\nThe answer.");
    assert.equal(tokens.trim(), "## Summary\nThe answer.");
    assert.equal(result.followUps.length, 1);
    const codes = events.filter((e) => e.type === "status").map((e: any) => e.code);
    assert.ok(codes.indexOf("research.plan") < codes.indexOf("research.report"));
    assert.ok(result.research!.durationMs >= 0);
  });

  test("runs steps in order with tools filtered by each step's sources", async () => {
    WUP_TOOLS_REGISTRY.web_search = async (_args, ctx) => {
      const n = ctx.registerSource!({ kind: "web", title: "News", url: "https://news.example/a", snippet: "s" });
      return { results: [{ n, title: "News", url: "https://news.example/a" }] };
    };
    const plan = {
      steps: [
        { title: "Count movies", question: "How many movies?", use: ["data"] },
        { title: "Check the news", question: "Any news?", use: ["web", "docs"] },
      ],
    };
    const driver = new FakeDriver(
      "m",
      async (p, call) => {
        if (isReport(p)) return void p.onText(`Report citing [1].`);
        if (call === 1) {
          await p.executeTool("web_search", { query: "news" });
          p.onText("x".repeat(3000));
        } else p.onText("There are 21,349 movies.");
      },
      async () => JSON.stringify(plan)
    );
    const { brain, loader } = makeBrain(driver, { connections: [mongoBridge], knowledgeNames: ["Q3.pdf"] });
    const { result, events } = await runCollect(brain, request({ mode: "research", searchWeb: true }));

    assert.deepEqual(stepEvents(events), ["s1:pending", "s2:pending", "s1:running", "s1:done", "s2:running", "s2:done"]);
    const [stepA, stepB] = driver.loops;
    assert.equal(stepA.maxTurns, 4);
    assert.ok(stepA.tools.every((t) => t.name.startsWith("mongo_")));
    assert.deepEqual(
      stepB.tools.map((t) => t.name),
      ["web_search"]
    );
    assert.ok(loader.retrieves.includes("Any news?"));
    const s2 = result.research!.steps[1];
    assert.deepEqual(s2.sourceNs, [1]);
    assert.ok(s2.detail!.length <= 200);
    const report = driver.loops[2];
    assert.equal(report.tools.length, 0);
    assert.match(report.prompt, /\[1\] web: News/);
    // Notes are capped before they reach the report
    assert.ok(!report.prompt.includes("x".repeat(1600)));
    assert.equal(result.sources[0].cited, true);
  });

  test("caps steps and tool calls", async () => {
    let executed = 0;
    WUP_TOOLS_REGISTRY.mongo_count = async () => {
      executed++;
      return { success: true, count: 1 };
    };
    const plan = { steps: Array.from({ length: 8 }, (_, i) => ({ title: `S${i}`, question: `q${i}`, use: ["data"] })) };
    const budgetErrors: string[] = [];
    const driver = new FakeDriver(
      "m",
      async (p) => {
        if (isReport(p)) return void p.onText("Report.");
        for (let i = 0; i < 10; i++) {
          const r = await p.executeTool("mongo_count", { connectionId: "c", db: "d", collection: "x" });
          if (r?.success === false) budgetErrors.push(r.error);
        }
        p.onText("notes");
      },
      async () => JSON.stringify(plan)
    );
    const { result } = await runCollect(makeBrain(driver, { connections: [mongoBridge] }).brain, request({ mode: "research" }));
    assert.equal(result.research!.steps.length, 5);
    assert.equal(executed, 20);
    assert.equal(result.toolCalls, 20);
    assert.equal(budgetErrors.length, 30);
    assert.match(budgetErrors[0], /budget/);
  });

  test("the wall clock skips later steps but still writes the report", async () => {
    process.env.RESEARCH_TIMEOUT_MS = "40";
    const plan = { steps: [1, 2, 3].map((i) => ({ title: `S${i}`, question: `q${i}`, use: [] })) };
    const driver = new FakeDriver(
      "m",
      async (p) => {
        if (isReport(p)) return void p.onText("Report from partial notes.");
        p.onText("partial");
        return waitForAbort(p.signal);
      },
      async () => JSON.stringify(plan)
    );
    const { result, events } = await runCollect(makeBrain(driver).brain, request({ mode: "research" }));
    assert.equal(result.outcome, "complete");
    assert.deepEqual(
      result.research!.steps.map((s) => s.status),
      ["error", "skipped", "skipped"]
    );
    assert.equal(result.research!.steps[0].detail, "Ran out of time.");
    assert.equal(result.content, "Report from partial notes.");
    assert.ok(stepEvents(events).includes("s3:skipped"));
  });

  test("abort during the report returns the partial report as stopped", async () => {
    const ctl = new AbortController();
    const driver = new FakeDriver(
      "m",
      async (p) => {
        if (!isReport(p)) return void p.onText("notes");
        p.onText("## Summary\nPartial findings so far");
        ctl.abort();
        return waitForAbort(p.signal);
      },
      async () => '{"steps":[{"title":"Only","question":"q","use":[]}]}'
    );
    const { result } = await runCollect(makeBrain(driver).brain, request({ mode: "research" }), ctl.signal);
    assert.equal(result.outcome, "stopped");
    assert.equal(result.content, "## Summary\nPartial findings so far");
    assert.equal(result.research!.steps[0].status, "done");
    assert.deepEqual(result.followUps, []);
  });

  test("abort during a step stops without a report", async () => {
    const ctl = new AbortController();
    const driver = new FakeDriver(
      "m",
      async (p) => {
        ctl.abort();
        return waitForAbort(p.signal);
      },
      async () => '{"steps":[{"title":"A","question":"q","use":[]},{"title":"B","question":"q2","use":[]}]}'
    );
    const { result } = await runCollect(makeBrain(driver).brain, request({ mode: "research" }), ctl.signal);
    assert.equal(result.outcome, "stopped");
    assert.deepEqual(
      result.research!.steps.map((s) => s.status),
      ["error", "skipped"]
    );
    assert.equal(driver.loops.length, 1);
  });
});
