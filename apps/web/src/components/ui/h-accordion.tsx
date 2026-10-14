"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/*
  Kit horizontal accordion (.h-accordion). One panel is always open.
  Desktop (md+): collapsed panels are 86px columns with a vertical label; the
  open panel grows via a 600ms flex-basis transition. Below 768px the panels
  stack as rows (num + label + plus) and the open one expands in place.
  Every panel's title/body is in the server HTML; closed ones are visually hidden.
*/

export interface HAccordionItem {
  id: string;
  label: string;
  title: React.ReactNode;
  body: React.ReactNode;
  /** Gradient art colours (radial glow from bottom-left). */
  art?: { a: string; b: string };
  /** Mock / screenshot shown in the white frame at the bottom right. */
  media?: React.ReactNode;
}

export interface HAccordionProps {
  items: HAccordionItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Desktop height in px (kit: 680). */
  height?: number;
  className?: string;
}

const COLLAPSED = 86;
const DEFAULT_ART = { a: "#a7c0f1", b: "#e8effc" };

export function HAccordion({
  items,
  value,
  defaultValue,
  onValueChange,
  height = 680,
  className,
}: HAccordionProps) {
  const baseId = React.useId();
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.id);
  const active = value ?? inner;
  const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
  const n = items.length;

  function select(id: string) {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (e.key in keys) next = (i + keys[e.key] + n) % n;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = n - 1;
    if (next !== null) {
      e.preventDefault();
      buttons.current[next]?.focus();
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border border-st bg-sf-white md:h-(--hacc-h) md:flex-row",
        className,
      )}
      style={
        {
          "--hacc-h": `${height}px`,
          "--hacc-open": `calc(100% - ${(n - 1) * COLLAPSED}px + ${n - 1}px)`,
        } as React.CSSProperties
      }
    >
      {items.map((item, i) => {
        const open = item.id === active;
        const num = String(i + 1).padStart(2, "0");
        const btnId = `${baseId}-btn-${i}`;
        const panelId = `${baseId}-panel-${i}`;
        const art = item.art ?? DEFAULT_ART;
        return (
          <div
            key={item.id}
            data-state={open ? "open" : "closed"}
            className={cn(
              "group/hacc relative overflow-hidden bg-sf-white",
              "border-t border-st first:border-t-0",
              "md:shrink-0 md:grow-0 md:-ml-px md:rounded-3xl md:border-t-0 md:border-l md:first:ml-0 md:first:border-l-0",
              "md:transition-[flex-basis] md:duration-[600ms] md:ease-standard motion-reduce:transition-none",
              open ? "md:basis-(--hacc-open) max-md:min-h-[520px]" : "md:basis-[86px]",
            )}
          >
            <button
              ref={(el) => {
                buttons.current[i] = el;
              }}
              id={btnId}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative z-[2] flex w-full items-center gap-3 p-5 text-left",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400 md:rounded-3xl",
                open
                  ? "cursor-default md:px-[30px] md:pt-7 md:pb-0"
                  : "md:absolute md:inset-0 md:flex-col md:items-start md:px-[30px] md:py-7 md:hover:bg-sf-secondary/60 md:transition-colors md:duration-200",
              )}
            >
              <span className="text-[13px] tabular-nums text-tx-secondary">{num}</span>
              <span
                className={cn(
                  "flex-1 text-[16px] text-tx",
                  "md:mt-auto md:flex-none md:rotate-180 md:[writing-mode:vertical-rl]",
                  open && "md:sr-only",
                )}
              >
                {item.label}
              </span>
              <Plus
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn(
                  "size-5 shrink-0 text-tx-secondary md:mt-4",
                  open && "hidden",
                )}
              />
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className={cn(
                "transition-[opacity,visibility] ease-standard",
                open
                  ? "visible opacity-100 duration-500 md:delay-150"
                  : "invisible opacity-0 duration-150 max-md:hidden",
              )}
            >
              <div className="relative z-[1] px-5 pb-6 md:w-[min(520px,100%)] md:min-w-[440px] md:px-[30px]">
                <h3 className="text-[22px] font-normal leading-[1.2] text-tx md:mt-3 md:text-[26px]">
                  {item.title}
                </h3>
                <div className="mt-3 max-w-[420px] text-[16px] leading-[1.35] text-tx-tertiary md:text-[18px]">
                  {item.body}
                </div>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%]"
                style={{
                  background: `radial-gradient(120% 90% at 0% 100%, ${art.a} 0%, ${art.b} 35%, transparent 70%)`,
                }}
              />
              {item.media ? (
                <div
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 left-[12%] top-[55%] overflow-hidden rounded-tl-xl bg-sf-white md:left-[22%] md:top-[46%]",
                    "shadow-[0_0_0_8px_rgba(255,255,255,0.5),0_0_40px_0_#0000000f]",
                    "transition-[opacity,translate] duration-[600ms] ease-standard",
                    open ? "translate-y-0 opacity-100 md:delay-150" : "translate-y-6 opacity-0",
                  )}
                >
                  {item.media}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
