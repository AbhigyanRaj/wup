"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Database, Layers, Play, TableProperties } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SIGNUP } from "@/lib/site";
import { callPublicTool, CREDENTIALS_MESSAGE, looksLikeCredential, type QueryToolResult, type ToolError } from "@/lib/tools/api";
import type { MongoQuery } from "@/lib/tools/mongo-format";
import { parseRelaxed } from "@/lib/tools/relaxed-json";
import {
  Bezel,
  FieldLabel,
  PreviewTable,
  QueryCode,
  RealDbCta,
  ResultMeta,
  ResultNotes,
  RunButton,
  ToolErrorNote,
  useExampleListener,
} from "./tool-ui";
import { useTurnstile } from "./use-turnstile";

export interface ClientExample {
  id: string;
  title: string;
  dataset: string;
  question: string;
  sql?: string;
  query: MongoQuery;
  explanation: string[];
  resultPreview?: { columns: string[]; rows: Array<Array<string | number | boolean | null>> };
}

export interface ClientSample {
  id: string;
  name: string;
  collection: string;
  /** First sample document, printed mongosh-style. */
  doc: string;
}

type Mode = "query" | "aggregation" | "sql";

interface Shown {
  query: MongoQuery;
  explanation: string[];
  assumptions: string[];
  warnings: string[];
  source: "api" | "example";
  cached?: boolean;
  preview?: ClientExample["resultPreview"];
}

const COPY: Record<Mode, { label: string; placeholder: string; run: string; api: "mongodb-query" | "mongodb-aggregation" | "sql-to-mongodb" }> = {
  query: {
    label: "Describe the documents you want",
    placeholder: "Delivered orders over 5,000 from the last 30 days, newest first",
    run: "Generate query",
    api: "mongodb-query",
  },
  aggregation: {
    label: "Describe the report you need",
    placeholder: "Revenue per month this year, excluding cancelled orders",
    run: "Generate pipeline",
    api: "mongodb-aggregation",
  },
  sql: {
    label: "SQL SELECT statement",
    placeholder: "SELECT status, SUM(total) AS revenue FROM orders GROUP BY status ORDER BY revenue DESC;",
    run: "Convert to MongoDB",
    api: "sql-to-mongodb",
  },
};

const TILES = [
  "bg-[linear-gradient(135deg,#8fb0ff,#2563eb)]",
  "bg-[linear-gradient(135deg,#a5d8fb,#0284c7)]",
  "bg-[linear-gradient(135deg,#c4b5fd,#556adc)]",
  "bg-[linear-gradient(135deg,#bfdbfe,#1e3a8a)]",
];

const MAX_PROMPT = 2000;
const MAX_SCHEMA = 20000;

export function QueryTool({
  tool,
  mode,
  examples,
  samples,
}: {
  tool: string;
  mode: Mode;
  examples: ClientExample[];
  samples: ClientSample[];
}) {
  const copy = COPY[mode];
  const ids = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const { getToken, slot } = useTurnstile();

  const [datasetId, setDatasetId] = useState(samples[0]?.id ?? "");
  const [text, setText] = useState("");
  const [sample, setSample] = useState(samples[0]?.doc ?? "");
  const [collection, setCollection] = useState(samples[0]?.collection ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [activeExample, setActiveExample] = useState<string | null>(null);

  const pickDataset = (id: string) => {
    const s = samples.find((x) => x.id === id);
    if (!s) return;
    setDatasetId(id);
    setSample(s.doc);
    setCollection(s.collection);
  };

  const loadExample = (id: string, scroll = true) => {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    const s = samples.find((x) => x.id === ex.dataset);
    if (s) {
      setDatasetId(s.id);
      setSample(s.doc);
      setCollection(s.collection);
    }
    setText(mode === "sql" ? (ex.sql ?? ex.question) : ex.question);
    setError(null);
    setInputError(null);
    setActiveExample(id);
    setShown({ query: ex.query, explanation: ex.explanation, assumptions: [], warnings: [], source: "example", preview: ex.resultPreview });
    if (scroll) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  useExampleListener(tool, (id) => loadExample(id));

  async function run() {
    setInputError(null);
    setError(null);
    if (!text.trim()) {
      setInputError(mode === "sql" ? "Paste a SELECT statement first." : "Describe what you want first.");
      return;
    }
    let schema: string | undefined;
    if (sample.trim()) {
      const parsed = parseRelaxed(sample);
      if (!parsed.ok) {
        setInputError(`Sample document: ${parsed.error}`);
        return;
      }
      schema = JSON.stringify(parsed.value);
    }
    if (looksLikeCredential(text, sample, collection)) {
      setInputError(CREDENTIALS_MESSAGE);
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setActiveExample(null);
    try {
      const turnstileToken = await getToken();
      const body: Record<string, unknown> =
        mode === "sql"
          ? { sql: text.trim(), schema, turnstileToken }
          : { prompt: text.trim(), collection: collection.trim() || undefined, schema, turnstileToken };
      const res = await callPublicTool<QueryToolResult>(copy.api, body, ctrl.signal);
      if (!res.ok) {
        setError(res.error);
        setShown(null);
      } else {
        const d = res.data;
        setShown({
          query: {
            kind: d.kind,
            collection: d.collection,
            filter: d.filter,
            projection: d.projection,
            sort: d.sort,
            limit: d.limit,
            pipeline: d.pipeline,
          },
          explanation: d.explanation ?? [],
          assumptions: d.assumptions ?? [],
          warnings: d.warnings ?? [],
          source: "api",
          cached: d.cached,
        });
      }
      requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setError({ status: 0, message: "Something went wrong. Please try again." });
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  }

  const textId = `${ids}-text`;
  const sampleId = `${ids}-sample`;
  const collId = `${ids}-coll`;
  const datasetIdSel = `${ids}-dataset`;
  const presets = examples.slice(0, 6);
  const isSql = mode === "sql";

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <Bezel>
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_1px_360px]">
          {/* Editor */}
          <form
            className="flex min-w-0 flex-col gap-5 p-5 md:p-8 lg:p-10"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <label htmlFor={datasetIdSel} className="sr-only">
                  Sample dataset
                </label>
                <select
                  id={datasetIdSel}
                  value={datasetId}
                  onChange={(e) => pickDataset(e.target.value)}
                  className="h-11 min-w-[200px] cursor-pointer appearance-none rounded-full border border-st-secondary bg-sf-white pl-5 pr-10 text-body text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sample: {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-tx-secondary" aria-hidden="true" />
              </div>
              <span className="text-caption text-tx-tertiary tabular-nums">
                {text.length}/{MAX_PROMPT}
                <span className="mx-1.5 text-tx-muted">·</span>
                {collection || "collection"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={textId} className="sr-only">
                {copy.label}
              </label>
              <textarea
                id={textId}
                value={text}
                maxLength={MAX_PROMPT}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    run();
                  }
                }}
                rows={isSql ? 4 : 3}
                placeholder={copy.placeholder}
                spellCheck={!isSql}
                className={cn(
                  "w-full resize-none rounded-xl border border-transparent bg-transparent p-0 text-tx outline-none placeholder:text-tx-muted focus-visible:border-transparent",
                  isSql ? "font-mono text-[16px] leading-[1.6] md:text-[17px]" : "text-[20px] leading-[1.5] md:text-[24px] md:leading-[1.6]",
                )}
              />
              <p className="text-caption text-tx-tertiary">{copy.label}. Press ⌘ + Enter to run.</p>
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor={sampleId} hint={`${sample.length.toLocaleString("en-IN")}/${MAX_SCHEMA.toLocaleString("en-IN")}`}>
                Sample document {isSql ? "(optional)" : ""}
              </FieldLabel>
              <textarea
                id={sampleId}
                value={sample}
                maxLength={MAX_SCHEMA}
                onChange={(e) => setSample(e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full resize-y rounded-xl border border-st-secondary bg-sf-white px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-tx-secondary outline-none focus-visible:border-indigo-300 focus-visible:shadow-focus"
              />
              <p className="text-label text-tx-tertiary">JSON or mongosh syntax. ObjectId(...) and ISODate(...) are fine. Replace real values; never paste credentials.</p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {!isSql ? (
                <div className="flex flex-1 flex-col gap-2">
                  <FieldLabel htmlFor={collId}>Collection (optional)</FieldLabel>
                  <input
                    id={collId}
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    maxLength={120}
                    placeholder="orders"
                    className="h-11 w-full rounded-full border border-st-secondary bg-sf-white px-5 text-body text-tx outline-none focus-visible:border-indigo-300 focus-visible:shadow-focus"
                  />
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <RunButton busy={busy} label={copy.run} onClick={run} />
            </div>
            {inputError ? (
              <p role="alert" className="text-caption text-red-500">
                {inputError}
              </p>
            ) : null}
            {slot}
          </form>

          <div aria-hidden="true" className="hidden bg-st-secondary lg:block" />

          {/* Presets */}
          <aside className="flex flex-col gap-4 border-t border-st-secondary p-5 md:p-8 lg:border-t-0 lg:p-8" aria-label="Worked examples">
            <div className="flex items-baseline justify-between">
              <p className="text-heading-4 font-medium text-tx">Examples</p>
              <a href="#examples" className="text-caption text-tx-tertiary underline decoration-tx-tertiary/40 underline-offset-4 hover:text-tx">
                All {examples.length} examples
              </a>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {presets.map((ex, i) => {
                const on = activeExample === ex.id;
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => loadExample(ex.id, false)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-3.5 rounded-2xl border px-2 py-2 text-left transition-colors duration-200",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                        on ? "border-indigo-100 bg-indigo-50" : "border-transparent hover:bg-sf-secondary",
                      )}
                    >
                      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)]", TILES[i % TILES.length])}>
                        {ex.query.kind === "aggregate" ? (
                          <Layers className="size-5" strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <Play className="size-4 fill-white" strokeWidth={1.5} aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-medium text-tx">{ex.title}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[12.5px] text-tx-tertiary">
                          <span className="rounded-full bg-indigo-100 px-2 py-px text-[11px] font-medium text-indigo-800">
                            {ex.query.kind === "aggregate" ? "aggregate" : "find"}
                          </span>
                          <Database className="size-3" aria-hidden="true" />
                          {ex.query.collection}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto hidden items-center justify-between gap-3 border-t border-st-secondary pt-4 lg:flex">
              <p className="text-caption text-tx-secondary">Want answers, not just queries?</p>
              <Link href={SIGNUP} className="btn btn--ink btn--sm">
                Try wuup
              </Link>
            </div>
          </aside>
        </div>

        {/* Result */}
        {busy || shown || error ? (
          <div
            ref={resultRef}
            tabIndex={-1}
            aria-live="polite"
            aria-busy={busy}
            className="flex flex-col gap-5 border-t border-st-secondary bg-sf-white/60 p-5 outline-none md:p-8 lg:p-10"
          >
            {busy ? (
              <div className="flex flex-col gap-3" aria-label="Generating">
                <div className="h-10 w-1/3 animate-pulse rounded-xl bg-sf-secondary motion-reduce:animate-none" />
                <div className="h-40 animate-pulse rounded-xl bg-sf-secondary motion-reduce:animate-none" />
                <div className="h-20 animate-pulse rounded-xl bg-sf-secondary motion-reduce:animate-none" />
              </div>
            ) : error ? (
              <ToolErrorNote error={error} />
            ) : shown ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-heading-4 font-medium text-tx">
                    {shown.query.kind === "aggregate" ? "Aggregation pipeline" : "find() query"}
                    <span className="rounded-full border border-st bg-sf-white px-2.5 py-0.5 font-mono text-[12px] font-normal text-tx-secondary">
                      {shown.query.collection}
                    </span>
                  </p>
                  <ResultMeta source={shown.source} cached={shown.cached} />
                </div>
                <QueryCode query={shown.query} />
                <ResultNotes explanation={shown.explanation} assumptions={shown.assumptions} warnings={shown.warnings} />
                {shown.preview ? (
                  <div className="flex flex-col gap-2">
                    <p className="flex items-center gap-2 text-caption font-medium text-tx-secondary">
                      <TableProperties className="size-4 text-tx-tertiary" strokeWidth={1.75} aria-hidden="true" />
                      Result on the sample data
                    </p>
                    <PreviewTable columns={shown.preview.columns} rows={shown.preview.rows} caption="Result on the sample data" />
                  </div>
                ) : null}
                <RealDbCta compact />
              </>
            ) : null}
          </div>
        ) : null}
      </Bezel>
    </div>
  );
}
