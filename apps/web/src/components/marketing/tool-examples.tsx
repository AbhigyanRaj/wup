import { Database, Layers, Search } from "lucide-react";
import type { ToolExampleFull } from "@/content/data/tools";
import { highlight } from "@/components/tools/code-tokens";
import { TryExampleButton } from "@/components/tools/try-example-button";
import { cn } from "@/lib/cn";

/*
 * Worked-example card grid (kit blogs card grid density, integrations tile
 * craft). Every card is server-rendered with its full code and the result
 * preview MongoDB returned for the sample data; "Try this example" loads it
 * into the tool above through a CustomEvent.
 */

const BANDS = [
  "from-[#e8effc] to-white",
  "from-[#e0f2fe] to-white",
  "from-[#ede9fe] to-white",
  "from-[#dbeafe] to-white",
];

export function ToolExamples({ tool, examples, sqlInput = false }: { tool: string; examples: ToolExampleFull[]; sqlInput?: boolean }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3" aria-label="Worked examples">
      {examples.map((ex, i) => (
        <li key={ex.id} id={`example-${ex.id}`} className="scroll-mt-28">
          <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-st-secondary bg-sf-white transition-[border-color,box-shadow] duration-200 hover:border-st hover:shadow-card-hover">
            <div className={cn("flex flex-col gap-3 bg-gradient-to-br px-5 pb-4 pt-5", BANDS[i % BANDS.length])}>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[12px] font-medium leading-none text-indigo-800">
                  {ex.query.kind === "aggregate" ? <Layers className="size-3" aria-hidden="true" /> : <Search className="size-3" aria-hidden="true" />}
                  {ex.query.kind === "aggregate" ? "aggregate" : "find"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-st bg-sf-secondary px-2.5 py-1 font-mono text-[11.5px] leading-none text-tx-tertiary">
                  <Database className="size-3" aria-hidden="true" />
                  {ex.query.collection}
                </span>
                <span className="ml-auto font-mono text-[11px] text-tx-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="text-[18px] font-medium leading-[1.35] tracking-card text-tx">{ex.title}</h3>
              <p className={cn("text-caption leading-[1.55] text-tx-secondary", sqlInput && "font-mono text-[12px] leading-[1.6]")}>
                {sqlInput ? ex.sql : `“${ex.question}”`}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-1">
              <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-st-secondary bg-[#fafafa] px-3.5 py-3 font-mono text-[11.5px] leading-[1.65] text-tx">
                <code>{highlight(ex.output.code)}</code>
              </pre>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {ex.explanation.slice(0, 2).map((e) => (
                  <li key={e} className="flex gap-2 text-[13.5px] leading-[1.5] text-tx-tertiary">
                    <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-indigo-300" />
                    {e}
                  </li>
                ))}
              </ul>
              {ex.resultPreview ? (
                <div className="overflow-x-auto rounded-xl border border-st-secondary">
                  <table className="w-full border-collapse text-[12px]">
                    <caption className="sr-only">Result of {ex.title} on the sample data</caption>
                    <thead>
                      <tr className="bg-sf-secondary/50">
                        {ex.resultPreview.columns.map((c) => (
                          <th key={c} scope="col" className="whitespace-nowrap border-b border-st-secondary px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ex.resultPreview.rows.length === 0 ? (
                        <tr>
                          <td colSpan={ex.resultPreview.columns.length} className="px-2.5 py-2 text-tx-tertiary">
                            No documents match
                          </td>
                        </tr>
                      ) : (
                        ex.resultPreview.rows.slice(0, 4).map((r, ri) => (
                          <tr key={ri} className="border-b border-st-secondary last:border-0">
                            {r.map((cell, ci) => (
                              <td key={ci} className={cn("whitespace-nowrap px-2.5 py-1.5 text-tx-secondary", typeof cell === "number" && "text-right tabular-nums")}>
                                {cell === null ? "null" : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {ex.resultPreview.rows.length > 4 ? (
                    <p className="border-t border-st-secondary px-2.5 py-1.5 text-[11px] text-tx-muted">
                      + {ex.resultPreview.rows.length - 4} more rows
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[12px] text-tx-muted">Result depends on when it runs ($$NOW or $sample), so no fixed preview.</p>
              )}
              <div className="mt-auto pt-1">
                <TryExampleButton tool={tool} id={ex.id} title={ex.title} />
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
