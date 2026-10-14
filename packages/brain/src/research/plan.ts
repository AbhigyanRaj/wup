import { z } from "zod";
import type { LlmDriver, Usage } from "../ai/common";
import { toLlmError } from "../ai/common";
import { extractJsonObject } from "../orchestrator/meta";
import { PLAN_SYSTEM, planPrompt } from "./prompts";

export type SourceUse = "data" | "docs" | "web";

export interface PlannedStep {
  title: string;
  question: string;
  use: SourceUse[];
}

export function researchMaxSteps(): number {
  const v = Number(process.env.RESEARCH_MAX_STEPS);
  return Number.isInteger(v) && v >= 1 && v <= 10 ? v : 5;
}

const PlanSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        question: z.string().trim().min(1),
        use: z.array(z.string()).optional().default([]),
      })
    )
    .min(1),
});

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max).trimEnd() : s);

/**
 * Validates a plan: 1..maxSteps steps (extra steps are dropped), `use` limited
 * to available sources (a step with none left uses every available source).
 * Returns null when the text has no valid plan.
 */
export function parsePlan(text: string, available: SourceUse[], maxSteps: number): PlannedStep[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    raw = extractJsonObject(text);
  }
  if (Array.isArray(raw)) raw = { steps: raw };
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.steps.slice(0, maxSteps).map((s) => {
    const use = [...new Set(s.use.filter((u): u is SourceUse => (available as string[]).includes(u)))];
    return {
      title: clip(s.title.replace(/\s+/g, " "), 80),
      question: clip(s.question.replace(/\s+/g, " "), 500),
      use: use.length > 0 ? use : [...available],
    };
  });
}

export function fallbackPlan(question: string, available: SourceUse[]): PlannedStep[] {
  return [{ title: "Research the question", question: clip(question, 500), use: [...available] }];
}

/** Asks the model for a plan; any failure other than auth or abort falls back to one step. */
export async function planResearch(opts: {
  driver: LlmDriver;
  question: string;
  available: SourceUse[];
  availableData: string;
  maxSteps: number;
  signal: AbortSignal;
}): Promise<{ steps: PlannedStep[]; usage: Usage; fallback: boolean }> {
  const usage = { tokensIn: 0, tokensOut: 0 };
  try {
    const res = await opts.driver.complete({
      system: PLAN_SYSTEM,
      prompt: planPrompt(opts.question, opts.available, opts.maxSteps, opts.availableData),
      maxTokens: 1200,
      json: true,
      signal: opts.signal,
    });
    usage.tokensIn += res.usage.tokensIn;
    usage.tokensOut += res.usage.tokensOut;
    const steps = parsePlan(res.text, opts.available, opts.maxSteps);
    if (steps) return { steps, usage, fallback: false };
  } catch (err) {
    const e = toLlmError(err, opts.signal);
    if (e.code === "ABORTED" || e.code === "PROVIDER_AUTH") throw e;
  }
  return { steps: fallbackPlan(opts.question, opts.available), usage, fallback: true };
}
