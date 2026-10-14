import { Database, FileText, Globe, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { IncludedGroup } from "@/content/data/pricing";
import { cn } from "@/lib/cn";

/*
 * "What is included" rate table (kit pricing.md 2.4): one bordered 900px card,
 * each group a collapsible 80px row (indigo title + chevron when open) whose
 * panel holds a 3-column table: item, Free, Your key. Every row is in the
 * server HTML (the accordion force-mounts its content), so the table is
 * readable and indexable with JavaScript off. First group open by default.
 * Mobile: the column header hides and each row stacks the label over both values.
 */

const ICONS: Record<IncludedGroup["id"], ReactNode> = {
  answers: <MessageSquareText />,
  data: <Database />,
  uploads: <FileText />,
  extras: <Globe />,
};

const GRID = "md:grid-cols-[minmax(0,1.25fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] md:gap-6";

export function IncludedTable({ groups, className }: { groups: IncludedGroup[]; className?: string }) {
  return (
    <Accordion
      variant="compact"
      type="multiple"
      defaultValue={[groups[0]?.id ?? ""]}
      className={cn("mx-auto md:w-9/12", className)}
    >
      {groups.map((group) => (
        <AccordionItem key={group.id} value={group.id}>
          <AccordionTrigger icon={ICONS[group.id]} subtitle={group.subtitle}>
            {group.title}
          </AccordionTrigger>
          <AccordionContent className="!px-0 !py-0 md:!px-0">
            <div role="table" aria-label={group.title}>
              <div role="rowgroup">
                <div
                  role="row"
                  className={cn(
                    "sr-only md:not-sr-only md:grid md:border-b md:border-st-secondary md:px-8 md:py-2.5",
                    GRID,
                  )}
                >
                  {["Included", "Free", "Your key"].map((h) => (
                    <span
                      key={h}
                      role="columnheader"
                      className="text-label font-medium uppercase tracking-[0.08em] text-tx-tertiary"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <div role="rowgroup" className="divide-y divide-st-secondary">
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    role="row"
                    className={cn("grid grid-cols-2 gap-x-4 gap-y-1 px-6 py-3 md:items-baseline md:px-8", GRID)}
                  >
                    <span role="rowheader" className="col-span-2 text-body font-medium text-tx md:col-span-1">
                      {row.label}
                    </span>
                    <span role="cell" className="text-caption text-tx-secondary tabular-nums md:text-body">
                      <span className="mr-1.5 text-label uppercase tracking-[0.08em] text-tx-tertiary md:hidden">Free</span>
                      {row.free}
                    </span>
                    <span role="cell" className="text-caption font-medium text-tx tabular-nums md:text-body">
                      <span className="mr-1.5 text-label font-normal uppercase tracking-[0.08em] text-tx-tertiary md:hidden">
                        Key
                      </span>
                      {row.byok}
                      {row.note ? (
                        <span className="block text-label font-normal leading-4 text-tx-tertiary md:mt-0.5 md:text-caption">
                          {row.note}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
