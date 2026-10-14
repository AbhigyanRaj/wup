import { Check, ChevronDown, CircleHelp, Minus, X } from "lucide-react";
import type { CompareCell, CompareGroup } from "@/content/types";
import { cn } from "@/lib/cn";

/*
 * Kit pricing "accordion of tables" (pricing.md 2.4), used for comparisons.
 * Server-rendered with native <details>, so every row is in the HTML and it
 * works without JavaScript. First group open. Columns: feature, wuup, them.
 * Cells get an icon (yes / partial / no / unknown) and a short qualifier.
 */

const ICON = {
  yes: { el: <Check className="size-3.5" strokeWidth={2.4} />, cls: "bg-green-50 text-green-700 border-green-200", label: "Yes" },
  partial: { el: <Minus className="size-3.5" strokeWidth={2.4} />, cls: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Partly" },
  no: { el: <X className="size-3.5" strokeWidth={2.4} />, cls: "bg-red-50 text-red-400 border-red-100", label: "No" },
  unknown: { el: <CircleHelp className="size-3.5" strokeWidth={2} />, cls: "bg-sf-secondary text-tx-tertiary border-st", label: "Not documented" },
} as const;

function Cell({ cell, who }: { cell: CompareCell; who: string }) {
  const icon = ICON[cell.status];
  return (
    <span className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border", icon.cls)} aria-hidden="true">
        {icon.el}
      </span>
      <span className="flex flex-col">
        <span className="sr-only">
          {who}: {icon.label}.
        </span>
        <span className="text-[15px] leading-[1.45] text-tx">{cell.text ?? icon.label}</span>
        {cell.note ? <span className="text-caption text-tx-tertiary">{cell.note}</span> : null}
      </span>
    </span>
  );
}

export function CompareTable({
  groups,
  them,
  verifiedOn,
  className,
}: {
  groups: CompareGroup[];
  them: string;
  verifiedOn: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[960px]", className)}>
      <div className="overflow-hidden rounded-2xl border border-st-secondary bg-sf-white md:rounded-[20px]">
        {groups.map((g, gi) => (
          <details key={g.title} open={gi === 0} className="group/acc border-b border-st-secondary last:border-0">
            <summary
              className={cn(
                "flex min-h-16 cursor-pointer list-none items-center gap-4 px-6 py-3.5 transition-colors duration-200 md:min-h-20 md:px-8",
                "hover:bg-sf-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400 [&::-webkit-details-marker]:hidden",
              )}
            >
              <span className="flex-1 text-[18px] font-medium tracking-[-0.02em] text-tx group-open/acc:text-indigo-800 md:text-[20px]">{g.title}</span>
              <span className="text-caption text-tx-tertiary">{g.rows.length} rows</span>
              <ChevronDown className="size-4 text-tx-secondary transition-transform duration-200 group-open/acc:rotate-180 group-open/acc:text-indigo-800" aria-hidden="true" />
            </summary>
            <div className="border-t border-st-secondary bg-sf-secondary/40">
              <table className="w-full border-collapse">
                <caption className="sr-only">
                  {g.title}: wuup compared with {them}
                </caption>
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-st-secondary">
                    {["Feature", "wuup", them].map((h) => (
                      <th key={h} scope="col" className="px-8 py-2.5 text-left text-label font-medium uppercase tracking-[0.08em] text-tx-tertiary">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-st-secondary">
                  {g.rows.map((r) => (
                    <tr key={r.label} className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-4 md:table-row md:p-0">
                      <th scope="row" className="col-span-2 text-left text-body font-medium text-tx md:w-[36%] md:px-8 md:py-3.5">
                        {r.label}
                      </th>
                      <td className="md:w-[32%] md:px-8 md:py-3.5">
                        <span className="mb-1 block text-label uppercase tracking-[0.08em] text-tx-tertiary md:hidden">wuup</span>
                        <Cell cell={r.wuup} who="wuup" />
                      </td>
                      <td className="md:w-[32%] md:px-8 md:py-3.5">
                        <span className="mb-1 block text-label uppercase tracking-[0.08em] text-tx-tertiary md:hidden">{them}</span>
                        <Cell cell={r.them} who={them} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
      <p className="mt-3 text-center text-label text-tx-tertiary">
        Last verified {new Date(`${verifiedOn}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} against the sources below. &quot;Not documented&quot; means we couldn&apos;t confirm it from {them}&apos;s own pages.
      </p>
    </div>
  );
}
