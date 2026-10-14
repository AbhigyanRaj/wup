"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Braces, FileJson, Lock } from "lucide-react";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/cn";
import { literal, type Json } from "@/lib/tools/mongo-format";
import { parseDocuments } from "@/lib/tools/relaxed-json";
import { inferSchema, presence, toJsonSchema, toMongoose, toTypeScript, typeLabel, withSchema } from "@/lib/tools/schema-infer";
import type { ClientExample } from "./query-tool";
import { highlight } from "./code-tokens";
import { Bezel, PreviewTable, QueryCode, RealDbCta, ResultNotes, useExampleListener } from "./tool-ui";

export interface ClientDataset {
  id: string;
  name: string;
  collection: string;
  /** Every sample document, mongosh-style, as an array literal. */
  docs: string;
}

const TILES = [
  "bg-[linear-gradient(135deg,#8fb0ff,#2563eb)]",
  "bg-[linear-gradient(135deg,#a5d8fb,#0284c7)]",
  "bg-[linear-gradient(135deg,#c4b5fd,#556adc)]",
  "bg-[linear-gradient(135deg,#bfdbfe,#1e3a8a)]",
  "bg-[linear-gradient(135deg,#bae6fd,#0369a1)]",
];

export function SchemaTool({ tool, datasets, examples }: { tool: string; datasets: ClientDataset[]; examples: ClientExample[] }) {
  const ids = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [text, setText] = useState(datasets[0]?.docs ?? "");
  const [name, setName] = useState(datasets[0]?.collection ?? "documents");
  const [debounced, setDebounced] = useState(text);
  const [example, setExample] = useState<ClientExample | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 200);
    return () => clearTimeout(t);
  }, [text]);

  const parsed = useMemo(() => parseDocuments(debounced), [debounced]);
  const schema = useMemo(() => (parsed.ok ? inferSchema(parsed.value as Array<Record<string, Json>>) : null), [parsed]);
  const outputs = useMemo(() => {
    if (!schema) return null;
    const validator = toJsonSchema(schema);
    const collMod = `db.runCommand({\n  collMod: ${JSON.stringify(name || "documents")},\n  validator: ${literal(validator as Json, "js-shell", 1)},\n  validationLevel: "moderate",\n  validationAction: "warn"\n})`;
    return { collMod, ts: toTypeScript(schema, name || "Document"), mongoose: toMongoose(schema, name || "Document") };
  }, [schema, name]);
  const rows = useMemo(
    () => (schema ? withSchema(schema, () => schema.fields.map((f) => ({ f, label: typeLabel(f), pct: presence(f) }))) : []),
    [schema],
  );

  const pick = (id: string) => {
    const d = datasets.find((x) => x.id === id);
    if (!d) return;
    setDatasetId(id);
    setText(d.docs);
    setDebounced(d.docs);
    setName(d.collection);
  };

  useExampleListener(tool, (id) => {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    pick(ex.dataset);
    setExample(ex);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rootRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });

  const textId = `${ids}-docs`;
  const nameId = `${ids}-name`;
  const docsCount = parsed.ok ? parsed.value.length : 0;

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <Bezel>
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_1px_340px]">
          <div className="flex min-w-0 flex-col gap-4 p-5 md:p-8 lg:p-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <label htmlFor={textId} className="text-caption font-medium text-tx-secondary">
                Paste documents: a JSON array, one per line, or mongosh output
              </label>
              <span className="inline-flex items-center gap-1.5 text-caption text-tx-tertiary">
                <Lock className="size-3.5" aria-hidden="true" />
                Runs in your browser
              </span>
            </div>
            <textarea
              id={textId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-st-secondary bg-sf-white px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-tx outline-none focus-visible:border-indigo-300 focus-visible:shadow-focus"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <label htmlFor={nameId} className="text-caption font-medium text-tx-secondary">
                  Collection
                </label>
                <input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="h-10 w-44 rounded-full border border-st-secondary bg-sf-white px-4 text-caption text-tx outline-none focus-visible:border-indigo-300 focus-visible:shadow-focus"
                />
              </div>
              <p role={parsed.ok ? undefined : "alert"} className={cn("text-caption", parsed.ok ? "text-tx-tertiary" : "text-red-500")}>
                {parsed.ok ? `${docsCount} document${docsCount === 1 ? "" : "s"}, ${schema?.fields.length ?? 0} field paths` : parsed.error}
              </p>
            </div>
          </div>

          <div aria-hidden="true" className="hidden bg-st-secondary lg:block" />

          <aside className="flex flex-col gap-4 border-t border-st-secondary p-5 md:p-8 lg:border-t-0" aria-label="Sample collections">
            <p className="text-heading-4 font-medium text-tx">Sample collections</p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {datasets.map((d, i) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      pick(d.id);
                      setExample(null);
                    }}
                    aria-pressed={datasetId === d.id}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-2xl border px-2 py-2 text-left transition-colors duration-200",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                      datasetId === d.id ? "border-indigo-100 bg-indigo-50" : "border-transparent hover:bg-sf-secondary",
                    )}
                  >
                    <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-white", TILES[i % TILES.length])}>
                      <FileJson className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium text-tx">{d.name}</span>
                      <span className="font-mono text-[12px] text-tx-tertiary">{d.collection}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {schema && outputs ? (
          <div className="flex flex-col gap-6 border-t border-st-secondary bg-sf-white/60 p-5 md:p-8 lg:p-10">
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-heading-4 font-medium text-tx">
                <Braces className="size-5 text-indigo-700" strokeWidth={1.75} aria-hidden="true" />
                Inferred fields
              </p>
              <div className="overflow-x-auto rounded-2xl border border-st-secondary bg-sf-white">
                <table className="w-full border-collapse text-[13.5px]">
                  <caption className="sr-only">Fields inferred from {docsCount} documents</caption>
                  <thead>
                    <tr className="bg-sf-secondary/50">
                      {["Field", "Type", "Present in", "Example"].map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap border-b border-st-secondary px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ f, label, pct }) => (
                      <tr key={f.path} className="border-b border-st-secondary last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-[12.5px] text-tx" style={{ paddingLeft: 16 + f.depth * 16 }}>
                          {f.path.slice(f.path.lastIndexOf(".") + 1) === f.path ? f.path : f.path.slice(f.path.lastIndexOf(".") + 1)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[11.5px] text-indigo-800">{label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          {f.path.endsWith("[]") ? (
                            <span className="text-caption text-tx-tertiary">array elements</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-sf-tertiary" aria-hidden="true">
                                <span className={cn("block h-full rounded-full", pct === 100 ? "bg-blue-600" : "bg-sky-400")} style={{ width: `${pct}%` }} />
                              </span>
                              <span className="text-caption text-tx-secondary tabular-nums">{pct}%</span>
                            </span>
                          )}
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-2 font-mono text-[12px] text-tx-tertiary">{f.example ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <CodeBlock
              preClassName="max-h-[480px]"
              tabs={[
                { label: "$jsonSchema validator", code: outputs.collMod, content: highlight(outputs.collMod) },
                { label: "TypeScript", code: outputs.ts, content: highlight(outputs.ts, "ts") },
                { label: "Mongoose", code: outputs.mongoose, content: highlight(outputs.mongoose) },
              ]}
            />
            {example ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                <p className="text-body font-medium text-tx">Check it on the real collection: {example.title}</p>
                <QueryCode query={example.query} />
                <ResultNotes explanation={example.explanation} explanationTitle="Why it helps" />
                {example.resultPreview ? <PreviewTable columns={example.resultPreview.columns} rows={example.resultPreview.rows} /> : null}
              </div>
            ) : null}
            <RealDbCta compact />
          </div>
        ) : null}
      </Bezel>
    </div>
  );
}
