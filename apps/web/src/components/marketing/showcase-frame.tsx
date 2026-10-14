"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Kit "glass frame with tabs" (home.md §3). The frame, tab bar and panel
 * chrome are here; panel bodies are server-rendered and passed in, and every
 * panel stays in the HTML (inactive ones are `hidden`). Below 768px the tab
 * bar becomes a dropdown, as in the kit.
 */

export interface ShowcaseTab {
  id: string;
  label: string;
  icon?: ReactNode;
  panel: ReactNode;
}

export function ShowcaseFrame({ tabs, label }: { tabs: ShowcaseTab[]; label: string }) {
  const [active, setActive] = useState(0);
  const base = useId().replace(/:/g, "");
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="showcase__frame w-full">
      {/* Mobile: dropdown */}
      <div className="relative mb-[2px] md:hidden">
        <label htmlFor={`${base}-select`} className="sr-only">
          {label}
        </label>
        <select
          id={`${base}-select`}
          value={active}
          onChange={(e) => setActive(Number(e.target.value))}
          className="h-12 w-full appearance-none rounded-[16px_16px_2px_2px] bg-sf-white pl-4 pr-10 text-[15px] font-medium text-indigo-800 shadow-tab-active outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400"
        >
          {tabs.map((t, i) => (
            <option key={t.id} value={i}>
              {t.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-tx-tertiary" aria-hidden="true" />
      </div>

      {/* md+: equal tabs */}
      <div className="showcase__tabs hidden md:flex" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className="showcase__tab focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400 [&_svg]:size-5 [&_svg]:stroke-[1.5]"
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.icon ? <span aria-hidden="true">{t.icon}</span> : null}
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t, i) => (
        <div
          key={t.id}
          id={`${base}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className={cn("showcase__panel relative overflow-hidden !justify-start !p-4 md:!p-10 md:!pb-12", i === active && "animate-[fade-in_.4s_var(--ease-standard)]")}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
