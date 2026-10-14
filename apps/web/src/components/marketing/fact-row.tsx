import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * 3-up big-number proof row (kit product page §3.3). Display numerals in an
 * indigo-950 to blue gradient, label under each, hairline rules between cells
 * (left rules on desktop, top rules when stacked on mobile). Values must come
 * from FACTS in src/lib/site.ts, never typed by hand.
 */

export interface FactItem {
  /** The number, e.g. "100". */
  value: ReactNode;
  /** Optional unit set smaller beside the number, e.g. "rows". */
  unit?: ReactNode;
  label: ReactNode;
}

export function FactRow({ items, className }: { items: FactItem[]; className?: string }) {
  return (
    <section className={cn("container", className)}>
      <dl className="grid grid-cols-1 md:grid-cols-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center px-6 py-8 text-center md:px-10 md:py-10",
              i > 0 && "border-t border-st-secondary md:border-l md:border-t-0",
            )}
          >
            <dt className="order-2 mt-3 max-w-[260px] text-caption leading-[1.55] text-tx-secondary md:text-body">
              {item.label}
            </dt>
            <dd className="order-1 m-0 flex items-baseline gap-2">
              <span className="bg-[linear-gradient(90deg,var(--indigo-950)_0%,var(--blue-600)_100%)] bg-clip-text font-display text-[56px] font-medium leading-none tracking-[-0.03em] text-transparent tabular-nums md:text-[60px]">
                {item.value}
              </span>
              {item.unit ? (
                <span className="font-display text-[24px] leading-none tracking-[-0.02em] text-indigo-800">{item.unit}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
