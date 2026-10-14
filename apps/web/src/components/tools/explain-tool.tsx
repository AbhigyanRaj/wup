"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Gauge, Layers, Lightbulb } from "lucide-react";
import { cn } from "@/lib/cn";
import { callPublicTool, CREDENTIALS_MESSAGE, looksLikeCredential, type ExplainToolResult, type ToolError } from "@/lib/tools/api";
import { formatQuery, literal, type Json } from "@/lib/tools/mongo-format";
import { parsePipeline } from "@/lib/tools/relaxed-json";
import type { ClientExample } from "./query-tool";
import { highlight } from "./code-tokens";
import { Bezel, PreviewTable, RealDbCta, ResultNotes, RunButton, ToolErrorNote, useExampleListener } from "./tool-ui";
import { useTurnstile } from "./use-turnstile";

export interface ClientStage {
  name: string;
  summary: string;
  allowed: boolean;
  note?: string;
  docsUrl: string;
}

interface Narrative {
  summary?: string;
  plain: Record<number, string>;
  performanceNotes: string[];
  warnings: string[];
  source: "api" | "example";
  cached?: boolean;
}

const TILES = [
  "bg-[linear-gradient(135deg,#8fb0ff,#2563eb)]",
  "bg-[linear-gradient(135deg,#a5d8fb,#0284c7)]",
  "bg-[linear-gradient(135deg,#c4b5fd,#556adc)]",
  "bg-[linear-gradient(135deg,#bfdbfe,#1e3a8a)]",
];

export function ExplainTool({ tool, examples, stages }: { tool: string; examples: ClientExample[]; stages: ClientStage[] }) {
  const ids = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { getToken, slot } = useTurnstile();
  const first = examples[0];
  const [text, setText] = useState(first ? formatQuery(first.query, "mongosh") : "");
  const [debounced, setDebounced] = useState(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [activeExample, setActiveExample] = useState<string | null>(first?.id ?? null);
  const [preview, setPreview] = useState<ClientExample["resultPreview"]>(first?.resultPreview);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const parsed = useMemo(() => parsePipeline(debounced), [debounced]);
  const byName = useMemo(() => new Map(stages.map((s) => [s.name, s])), [stages]);

  const loadExample = (id: string, scroll = true) => {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    const code = formatQuery(ex.query, "mongosh");
    setText(code);
    setDebounced(code);
    setActiveExample(id);
    setError(null);
    setInputError(null);
    setPreview(ex.resultPreview);
    setNarrative({
      summary: ex.question,
      plain: Object.fromEntries(ex.explanation.map((e, i) => [i, e])),
      performanceNotes: [],
      warnings: [],
      source: "example",
    });
    if (scroll) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  useExampleListener(tool, (id) => loadExample(id));

  async function explain() {
    setError(null);
    setInputError(null);
    const p = parsePipeline(text);
    if (!p.ok) {
      setInputError(p.error);
      return;
    }
    if (looksLikeCredential(text)) {
      setInputError(CREDENTIALS_MESSAGE);
      return;
    }
    setBusy(true);
    setActiveExample(null);
    setPreview(undefined);
    try {
      const res = await callPublicTool<ExplainToolResult>("aggregation-explain", {
        pipeline: JSON.stringify(p.value.pipeline),
        turnstileToken: await getToken(),
      });
      if (!res.ok) {
        setError(res.error);
        setNarrative(null);
      } else {
        setNarrative({
          summary: res.data.summary,
          plain: Object.fromEntries((res.data.stages ?? []).map((s) => [s.index, s.plain])),
          performanceNotes: res.data.performanceNotes ?? [],
          warnings: res.data.warnings ?? [],
          source: "api",
          cached: res.data.cached,
        });
      }
    } catch {
      setError({ status: 0, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const textId = `${ids}-pipeline`;
  const pipeline = parsed.ok ? parsed.value.pipeline : [];

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <Bezel>
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_1px_360px]">
          <div className="flex min-w-0 flex-col gap-4 p-5 md:p-8 lg:p-10">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={textId} className="text-caption font-medium text-tx-secondary">
                Paste a pipeline (JSON, relaxed JSON or db.collection.aggregate([...]))
              </label>
              <span className="text-caption text-tx-tertiary tabular-nums">{text.length.toLocaleString("en-IN")}/20,000</span>
            </div>
            <textarea
              id={textId}
              value={text}
              maxLength={20000}
              onChange={(e) => {
                setText(e.target.value);
                setActiveExample(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  explain();
                }
              }}
              rows={13}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-st-secondary bg-sf-white px-4 py-3 font-mono text-[13px] leading-[1.65] text-tx outline-none focus-visible:border-indigo-300 focus-visible:shadow-focus"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-tx-tertiary">
                {parsed.ok
                  ? `${pipeline.length} stage${pipeline.length === 1 ? "" : "s"}${parsed.value.collection ? ` on ${parsed.value.collection}` : ""}. Stage cards update as you type.`
                  : debounced.trim()
                    ? parsed.error
                    : "Paste a pipeline to see its stages."}
              </p>
              <RunButton busy={busy} label="Explain in plain English" onClick={explain} />
            </div>
            {inputError ? (
              <p role="alert" className="text-caption text-red-500">
                {inputError}
              </p>
            ) : null}
            {slot}
          </div>

          <div aria-hidden="true" className="hidden bg-st-secondary lg:block" />

          <aside className="flex flex-col gap-4 border-t border-st-secondary p-5 md:p-8 lg:border-t-0" aria-label="Example pipelines">
            <div className="flex items-baseline justify-between">
              <p className="text-heading-4 font-medium text-tx">Pipelines</p>
              <a href="#examples" className="text-caption text-tx-tertiary underline decoration-tx-tertiary/40 underline-offset-4 hover:text-tx">
                All {examples.length}
              </a>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {examples.slice(0, 6).map((ex, i) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => loadExample(ex.id, false)}
                    aria-pressed={activeExample === ex.id}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-2xl border px-2 py-2 text-left transition-colors duration-200",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                      activeExample === ex.id ? "border-indigo-100 bg-indigo-50" : "border-transparent hover:bg-sf-secondary",
                    )}
                  >
                    <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-white", TILES[i % TILES.length])}>
                      <Layers className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium text-tx">{ex.title}</span>
                      <span className="truncate text-[12.5px] text-tx-tertiary">{ex.question}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="flex flex-col gap-5 border-t border-st-secondary bg-sf-white/60 p-5 md:p-8 lg:p-10" aria-live="polite">
          {narrative?.summary || error ? (
            <div className="flex flex-col gap-3">
              {error ? <ToolErrorNote error={error} /> : null}
              {narrative?.summary && !error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-indigo-700" strokeWidth={1.75} aria-hidden="true" />
                  <div>
                    <p className="text-caption font-medium text-indigo-900">{narrative.source === "example" ? "What this pipeline answers" : "Summary"}</p>
                    <p className="mt-1 text-body leading-[1.6] text-tx">{narrative.summary}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {pipeline.length ? (
            <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2" aria-label="Stages">
              {pipeline.map((stage, i) => {
                const name = Object.keys(stage)[0] ?? "?";
                const info = byName.get(name);
                const risky = info ? !info.allowed : true;
                const body = literal(stage as Json, "js-shell");
                return (
                  <li key={i} className={cn("flex flex-col gap-3 rounded-2xl border bg-sf-white p-5", risky ? "border-red-100" : "border-st-secondary")}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sf-secondary font-mono text-[12px] text-tx-secondary tabular-nums">{i + 1}</span>
                      <span className="font-mono text-[15px] font-medium text-indigo-800">{name}</span>
                      <span
                        className={cn(
                          "ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          !info ? "bg-yellow-50 text-yellow-700" : info.allowed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500",
                        )}
                      >
                        {!info ? "Not on the read-only list" : info.allowed ? "Read-only" : info.note ?? "Blocked by wuup"}
                      </span>
                    </div>
                    <p className="text-[15px] leading-[1.55] text-tx-secondary">
                      {narrative?.plain[i] ?? info?.summary ?? "This stage is not in wuup's reference. Check the MongoDB documentation."}
                    </p>
                    <pre className="max-h-40 overflow-auto rounded-xl border border-st-secondary bg-[#fafafa] px-3.5 py-2.5 font-mono text-[12px] leading-[1.6] text-tx">
                      <code>{highlight(body)}</code>
                    </pre>
                    {info ? (
                      <a
                        href={info.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 self-start text-caption text-indigo-700 hover:text-indigo-900"
                      >
                        {name} in the MongoDB docs <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}

          {narrative && (narrative.performanceNotes.length || narrative.warnings.length) ? (
            <ResultNotes assumptions={narrative.performanceNotes} assumptionsTitle="Performance notes" warnings={narrative.warnings} explanation={[]} />
          ) : null}

          {preview ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-caption font-medium text-tx-secondary">
                <Gauge className="size-4 text-tx-tertiary" strokeWidth={1.75} aria-hidden="true" />
                Result on the sample data
              </p>
              <PreviewTable columns={preview.columns} rows={preview.rows} caption="Result on the sample data" />
            </div>
          ) : null}
          <RealDbCta compact />
        </div>
      </Bezel>
    </div>
  );
}
