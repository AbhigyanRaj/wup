"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/*
 * "On this page" table of contents with a scroll-spy rail (docs.md 2.5):
 * 14px label in #666, items 14px/20px muted with 14px left padding against a
 * 1px #e6e6e6 rail; the active item turns #1f1f1f with a 2px segment on the
 * rail. Nested (h3) items indent another 12px. A "Scroll to top" link follows.
 */

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export function Toc({
  items,
  label = "On this page",
  className,
  showTop = true,
}: {
  items: TocEntry[];
  label?: string;
  className?: string;
  showTop?: boolean;
}) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = 140;
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top - offset <= 0) current = el.id;
        else break;
      }
      // At the very bottom, highlight the last heading.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = els[els.length - 1].id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  if (!items.length) return null;

  return (
    <nav aria-label={label} className={cn("text-caption", className)}>
      <p className="mb-5 font-medium text-tx-tertiary">{label}</p>
      <ul className="flex flex-col border-l border-st">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="relative">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block py-1 leading-5 transition-colors duration-150 ease-standard",
                  item.depth === 3 ? "pl-[26px]" : "pl-3.5",
                  isActive ? "text-tx" : "text-tx-tertiary hover:text-tx-secondary",
                )}
              >
                {isActive ? (
                  <span aria-hidden="true" className="absolute top-0 bottom-0 -left-px w-0.5 rounded-full bg-tx" />
                ) : null}
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
      {showTop ? (
        <>
          <hr className="my-4 border-st" />
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
            }}
            className="inline-flex items-center gap-1.5 text-tx-tertiary transition-colors duration-150 hover:text-tx"
          >
            Scroll to top
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </a>
        </>
      ) : null}
    </nav>
  );
}
