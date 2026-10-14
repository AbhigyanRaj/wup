import type { ResearchStep } from "@wup/contracts";
import { LlmError, log, toLlmError, type LlmDriver, type ToolDeclaration, type Usage } from "../ai/common";
import type { SourceRegistry } from "../citations/sourceRegistry";
import { buildRagContext, type RetrievedChunk } from "../rag/retriever";
import { META_START } from "../orchestrator/meta";
import type { ToolRunner } from "../orchestrator/toolRunner";
import type { BrainEvent } from "../orchestrator/types";
import { planResearch, researchMaxSteps, type PlannedStep, type SourceUse } from "./plan";
import { NOTES_MAX_CHARS, REPORT_INSTRUCTIONS, STEP_INSTRUCTIONS, reportPrompt, stepPrompt } from "./prompts";

/**
 * Research mode: plan, run each step (tools filtered by the step's sources),
 * then stream a cited report.
 *
 * Budgets: RESEARCH_MAX_STEPS steps (default 5), 4 turns per step, 20 tool
 * calls overall, RESEARCH_TIMEOUT_MS wall clock for the steps (default 180s).
 * Steps that don't start before the deadline are skipped; the report is still
 * written from what was gathered.
 */

export const STEP_MAX_TURNS = 4;
export const RESEARCH_MAX_TOOL_CALLS = 20;

export function researchTimeoutMs(): number {
  const v = Number(process.env.RESEARCH_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 180_000;
}

const DATA_TOOLS = new Set([
  "mongo_list_sources",
  "mongo_describe",
  "mongo_find",
  "mongo_count",
  "mongo_distinct",
  "mongo_aggregate",
  "read_sheets",
  "get_sheets_metadata",
]);

export function toolsForUse(tools: ToolDeclaration[], use: SourceUse[]): ToolDeclaration[] {
  return tools.filter((t) => (use.includes("data") && DATA_TOOLS.has(t.name)) || (use.includes("web") && t.name === "web_search"));
}

/** Notes: no meta block, at most NOTES_MAX_CHARS. */
export function cleanNotes(text: string): string {
  const idx = text.indexOf(META_START);
  const body = (idx === -1 ? text : text.slice(0, idx)).trim();
  return body.length > NOTES_MAX_CHARS ? `${body.slice(0, NOTES_MAX_CHARS - 3).trimEnd()}...` : body;
}

/** A one-line step detail, at most 200 chars. */
export function stepDetail(text: string): string {
  const flat = text.replace(/[#*_`>|]/g, "").replace(/\s+/g, " ").trim();
  const sentence = /^(.{20,}?[.!?])(\s|$)/.exec(flat)?.[1] ?? flat;
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}...` : sentence;
}

export interface ResearchDeps {
  driver: LlmDriver;
  question: string;
  /** [static, dynamic] system blocks from buildSystemPrompt. */
  system: [string, string];
  /** AVAILABLE DATA text for the planner. */
  availableData: string;
  available: SourceUse[];
  tools: ToolDeclaration[];
  runner: ToolRunner;
  sources: SourceRegistry;
  retrieve: (query: string, signal: AbortSignal) => Promise<RetrievedChunk[]>;
  emit: (e: BrainEvent) => void;
  signal: AbortSignal;
  /** Receives report text (the orchestrator pipes it through MetaStreamFilter). */
  onReportText: (text: string) => void;
  limits?: { maxSteps?: number; timeoutMs?: number; maxTurnsPerStep?: number };
}

export interface ResearchOutcome {
  steps: ResearchStep[];
  durationMs: number;
  usage: Usage;
  /** Model that wrote the report (or the driver's model). */
  model: string;
  reportHitTurnLimit: boolean;
  stopped: boolean;
  error?: LlmError;
}

export async function runResearch(d: ResearchDeps): Promise<ResearchOutcome> {
  const started = Date.now();
  const usage: Usage = { tokensIn: 0, tokensOut: 0 };
  const add = (u: Usage) => {
    usage.tokensIn += u.tokensIn;
    usage.tokensOut += u.tokensOut;
  };
  const maxSteps = d.limits?.maxSteps ?? researchMaxSteps();
  const timeoutMs = d.limits?.timeoutMs ?? researchTimeoutMs();
  const maxTurns = d.limits?.maxTurnsPerStep ?? STEP_MAX_TURNS;
  const steps: ResearchStep[] = [];
  const result = (extra: Partial<ResearchOutcome>): ResearchOutcome => ({
    steps,
    durationMs: Date.now() - started,
    usage,
    model: d.driver.model,
    reportHitTurnLimit: false,
    stopped: d.signal.aborted,
    ...extra,
  });
  const emitStep = (s: ResearchStep) => d.emit({ type: "step", step: { ...s, sourceNs: [...s.sourceNs] } });

  // ── Plan ──────────────────────────────────────────────────────────────────
  d.emit({ type: "status", message: "Planning the research", code: "research.plan" });
  let plan: PlannedStep[];
  try {
    const planned = await planResearch({
      driver: d.driver,
      question: d.question,
      available: d.available,
      availableData: d.availableData,
      maxSteps,
      signal: d.signal,
    });
    add(planned.usage);
    plan = planned.steps;
  } catch (err) {
    const e = toLlmError(err, d.signal);
    return result({ stopped: e.code === "ABORTED", error: e.code === "ABORTED" ? undefined : e });
  }

  plan.forEach((p, i) => {
    const step: ResearchStep = {
      id: `s${i + 1}`,
      title: p.title,
      status: "pending",
      detail: null,
      sourceNs: [],
      startedAt: null,
      finishedAt: null,
    };
    steps.push(step);
    emitStep(step);
  });

  // ── Steps ─────────────────────────────────────────────────────────────────
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), timeoutMs);
  (timer as any).unref?.();
  const stepSignal = AbortSignal.any([d.signal, deadline.signal]);
  const notes: Array<{ title: string; status: string; notes: string }> = [];
  let fatal: LlmError | undefined;

  try {
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const step = steps[i];
      if (d.signal.aborted || fatal) break;
      if (deadline.signal.aborted) {
        step.status = "skipped";
        step.detail = "Skipped: the research time limit was reached.";
        emitStep(step);
        continue;
      }

      step.status = "running";
      step.startedAt = new Date().toISOString();
      emitStep(step);
      const firstNewSource = d.sources.size + 1;
      let text = "";
      try {
        let docContext = "";
        if (p.use.includes("docs")) {
          const chunks = await d.retrieve(p.question, stepSignal).catch(() => [] as RetrievedChunk[]);
          if (chunks.length > 0) {
            const nums = d.sources.registerChunks(chunks);
            docContext = buildRagContext(chunks, nums);
          }
        }
        const tools = toolsForUse(d.tools, p.use);
        const allowed = tools.map((t) => t.name);
        const loop = await d.driver.runToolLoop({
          system: [d.system[0], `${d.system[1]}\n\n${STEP_INSTRUCTIONS}`],
          history: [],
          prompt: stepPrompt({
            question: d.question,
            stepTitle: p.title,
            stepQuestion: p.question,
            index: i,
            total: plan.length,
            previousNotes: notes.map((n) => `${n.title}: ${n.notes}`).join("\n"),
            docContext,
          }),
          tools,
          executeTool: (name, args) => d.runner.execute(name, args, allowed),
          maxTurns,
          signal: stepSignal,
          onText: (t) => {
            text += t;
          },
        });
        add(loop.usage);
        const cleaned = cleanNotes(text);
        step.status = "done";
        step.detail = cleaned ? stepDetail(cleaned) : "No findings for this step.";
        notes.push({ title: p.title, status: "done", notes: cleaned });
      } catch (err) {
        const e = toLlmError(err, stepSignal);
        const timedOut = !d.signal.aborted && deadline.signal.aborted;
        step.status = "error";
        step.detail = d.signal.aborted ? "Stopped." : timedOut ? "Ran out of time." : stepDetail(e.message);
        const partial = cleanNotes(text);
        notes.push({ title: p.title, status: "error", notes: partial });
        if (e.code === "PROVIDER_AUTH") fatal = e;
        else if (!d.signal.aborted && !timedOut) log().warn("research step failed", { code: e.code, message: e.message });
      }
      const cited = d.sources.citedIn(notes[notes.length - 1]?.notes ?? "");
      const gathered = Array.from({ length: d.sources.size - firstNewSource + 1 }, (_, k) => firstNewSource + k);
      step.sourceNs = [...new Set([...gathered, ...cited])].sort((a, b) => a - b);
      step.finishedAt = new Date().toISOString();
      emitStep(step);
    }
  } finally {
    clearTimeout(timer);
  }

  // Steps that never ran (stop or fatal error) are reported as skipped.
  for (const s of steps) {
    if (s.status === "pending") {
      s.status = "skipped";
      emitStep(s);
    }
  }
  if (d.signal.aborted) return result({ stopped: true });
  if (fatal) return result({ error: fatal });

  // ── Report ────────────────────────────────────────────────────────────────
  d.emit({ type: "status", message: "Writing the report", code: "research.report" });
  try {
    const report = await d.driver.runToolLoop({
      system: [d.system[0], `${d.system[1]}\n\n${REPORT_INSTRUCTIONS}`],
      history: [],
      prompt: reportPrompt(d.question, notes, d.sources.snapshot()),
      tools: [],
      executeTool: async () => ({ success: false, error: "Tools are not available while writing the report." }),
      maxTurns: 1,
      signal: d.signal,
      onText: d.onReportText,
    });
    add(report.usage);
    return result({ model: report.model, reportHitTurnLimit: report.hitTurnLimit });
  } catch (err) {
    const e = toLlmError(err, d.signal);
    if (e.code === "ABORTED") return result({ stopped: true });
    return result({ error: e });
  }
}

