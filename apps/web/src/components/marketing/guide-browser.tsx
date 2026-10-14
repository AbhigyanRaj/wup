"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PostCard } from "./post-card";

/*
 * Blog index filter bar + grid (kit blogs 2.3 / 2.4): category pills with a
 * single sliding #f5f5f5 highlight (300ms ease-out), 16px labels, active 525.
 * Below, a 4-column grid of post cards (40px gaps). Every card is in the
 * server HTML; filtering only hides cards on the client.
 */

export interface GuideItem {
  href: string;
  title: string;
  coverLabel: string;
  cover: string | null;
  tag: string;
  meta: string[];
}

export function GuideBrowser({ items, tags }: { items: GuideItem[]; tags: string[] }) {
  const [active, setActive] = useState("All");
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number; top: number } | null>(null);
  const all = ["All", ...tags];
  const shown = active === "All" ? items : items.filter((i) => i.tag === active);

  useLayoutEffect(() => {
    const list = listRef.current;
    const btn = list?.querySelector<HTMLButtonElement>(`[data-tag="${CSS.escape(active)}"]`);
    if (!list || !btn) return;
    const measure = () => setPill({ left: btn.offsetLeft, width: btn.offsetWidth, top: btn.offsetTop });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active]);

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div ref={listRef} role="group" aria-label="Filter guides by topic" className="relative flex flex-wrap gap-1">
          {pill ? (
            <span
              aria-hidden="true"
              className="absolute h-10 rounded-full bg-sf-secondary transition-all duration-300 ease-out motion-reduce:transition-none"
              style={{ left: pill.left, width: pill.width, top: pill.top }}
            />
          ) : null}
          {all.map((tag) => {
            const isActive = tag === active;
            const count = tag === "All" ? items.length : items.filter((i) => i.tag === tag).length;
            return (
              <button
                key={tag}
                type="button"
                data-tag={tag}
                aria-pressed={isActive}
                onClick={() => setActive(tag)}
                className={cn(
                  "relative z-[1] h-10 rounded-full px-4 text-caption transition-colors duration-200 md:text-body",
                  isActive ? "font-medium text-tx" : "text-tx-tertiary hover:text-tx-secondary",
                  !pill && isActive && "bg-sf-secondary",
                )}
              >
                {tag}
                <span className="sr-only">, {count} guides</span>
              </button>
            );
          })}
        </div>
        <p className="text-caption text-tx-tertiary" aria-live="polite">
          {shown.length} {shown.length === 1 ? "guide" : "guides"}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-10 lg:grid-cols-4">
        {items.map((item) => {
          const visible = active === "All" || item.tag === active;
          return (
            <li key={item.href} hidden={!visible}>
              <PostCard
                href={item.href}
                title={item.title}
                coverLabel={item.coverLabel}
                cover={item.cover}
                meta={item.meta}
                headingLevel="h3"
                sizes="(min-width: 1024px) 270px, (min-width: 640px) 44vw, 88vw"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
