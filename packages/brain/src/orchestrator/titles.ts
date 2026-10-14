import { createDriver, type DriverFactory } from "../ai/driver";
import { LIGHT_MODELS } from "../ai/providers";
import { AUTO_MODEL, type LlmCredentials } from "../ai/common";

export const MAX_TITLE_CHARS = 60;
export const TITLE_TIMEOUT_MS = 3000;

/** A cheap model per provider for titles and suggestions. */
export function lightModel(llm: LlmCredentials): string {
  return llm.provider === "gemini" ? AUTO_MODEL : LIGHT_MODELS[llm.provider];
}

/** Cleans a title: one line, collapsed whitespace, no quotes or trailing punctuation, at most 60 chars on a word boundary. */
export function tidyTitle(raw: string): string {
  let t = (raw ?? "").split(/\r?\n/).find((l) => l.trim()) ?? "";
  t = t
    .replace(/^\s*(title|chat title)\s*:\s*/i, "")
    .replace(/[*_#`]/g, "")
    .replace(/\s*[\u2014\u2013]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .trim();
  if (t.length > MAX_TITLE_CHARS) {
    const cut = t.slice(0, MAX_TITLE_CHARS + 1);
    const space = cut.lastIndexOf(" ");
    t = space >= 20 ? cut.slice(0, space) : t.slice(0, MAX_TITLE_CHARS);
  }
  return t.replace(/[\s.,;:!?\-]+$/g, "").trim();
}

/** Title from the prompt itself: first line, whitespace collapsed, at most 60 chars on a word boundary. */
export function heuristicTitle(prompt: string): string {
  const firstLine = (prompt ?? "").split(/\r?\n/).find((l) => l.trim()) ?? "";
  const t = tidyTitle(firstLine);
  return t || "New chat";
}

/** Asks the user's provider for a short title (3s budget); falls back to the heuristic. */
export async function generateTitle(
  prompt: string,
  llm: LlmCredentials,
  signal?: AbortSignal,
  factory: DriverFactory = createDriver
): Promise<string> {
  const fallback = heuristicTitle(prompt);
  try {
    const timeout = AbortSignal.timeout(TITLE_TIMEOUT_MS);
    const s = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const driver = factory(llm, lightModel(llm), { connectMs: TITLE_TIMEOUT_MS, idleMs: TITLE_TIMEOUT_MS });
    const { text } = await driver.complete({
      system:
        "You name chat conversations. Reply with a title of 2 to 6 words for the user's message. No quotes, no punctuation at the end, no emoji.",
      prompt: prompt.slice(0, 2000),
      maxTokens: 30,
      signal: s,
    });
    const title = tidyTitle(text);
    return title.length >= 2 ? title : fallback;
  } catch {
    return fallback;
  }
}
