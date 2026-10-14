"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Accent } from "@/content/types";
import { cn } from "@/lib/cn";

/*
 * Scroll-spy feature tour (kit product page §3.6). Desktop: a sticky nav
 * (vertically centred) on the left, and on the right one card per feature,
 * each sticky at 112px inside an 80vh slot so the cards slide over each other
 * as you scroll. The active nav item takes the card's accent. Each card: a 24px
 * title, body, a media frame (grainy mat + white product inset) and three
 * accent check bullets. Mobile: no nav, cards stack normally.
 */

export interface TourCard {
  id: string;
  nav: string;
  title: string;
  body: string;
  bullets: readonly string[];
  accent: Accent;
  icon: ReactNode;
  /** The coded product mock shown inside the media frame. */
  media: ReactNode;
}

const ACCENT: Record<Accent, { text: string; mat: string; check: string }> = {
  blue: { text: "text-blue-700", mat: "/images/mats/blue.webp", check: "text-blue-600" },
  indigo: { text: "text-indigo-800", mat: "/images/mats/indigo.webp", check: "text-indigo-700" },
  periwinkle: { text: "text-indigo-600", mat: "/images/mats/periwinkle.webp", check: "text-indigo-500" },
  sky: { text: "text-sky-700", mat: "/images/mats/sky.webp", check: "text-sky-600" },
  navy: { text: "text-blue-900", mat: "/images/mats/indigo.webp", check: "text-blue-800" },
};

function VerifiedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1-3-1-3 2.8-1.6.9-3.1 3.2.3z"
      />
      <path d="M8.2 12.3l2.5 2.4 5-5.2" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FeatureTour({ cards, label, className }: { cards: TourCard[]; label: string; className?: string }) {
  const [active, setActive] = useState(cards[0]?.id ?? "");
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const els = [...refs.current.values()];
    if (!els.length) return;
    // A card is "current" once its top passes the upper third of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const go = (id: string) => {
    const el = refs.current.get(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(id);
  };

  return (
    <div className={cn("w-full lg:grid lg:grid-cols-[20%_1fr] lg:gap-x-12 lg:pb-16 xl:gap-x-16", className)}>
      <aside className="hidden lg:block">
        <nav aria-label={label} className="sticky top-[calc(50vh-164px)] flex flex-col gap-2">
          {cards.map((c) => {
            const on = c.id === active;
            return (
              <a
                key={c.id}
                href={`#${c.id}`}
                aria-current={on ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(c.id);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-3 text-body font-medium transition-[background-color,border-color,color] duration-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                  on ? cn("border-st-secondary bg-sf-secondary", ACCENT[c.accent].text) : "border-transparent text-tx hover:bg-sf-secondary/60",
                )}
              >
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center [&_svg]:size-5 [&_svg]:stroke-[1.75]">
                  {c.icon}
                </span>
                {c.nav}
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-col gap-4 lg:gap-0">
        {cards.map((c) => {
          const a = ACCENT[c.accent];
          return (
            <article
              key={c.id}
              id={c.id}
              ref={(el) => {
                if (el) refs.current.set(c.id, el);
                else refs.current.delete(c.id);
              }}
              className="scroll-mt-28 lg:min-h-[80vh]"
            >
              <div className="overflow-hidden rounded-xl border border-st-secondary bg-sf-white lg:sticky lg:top-28">
                <div className="flex flex-col gap-8 px-6 py-7 md:gap-10 md:px-10 md:py-10">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-heading-card font-medium leading-[1.25] text-tx md:text-heading-3">{c.title}</h3>
                    <p className="max-w-[62ch] text-body leading-relaxed text-tx-secondary">{c.body}</p>
                  </div>

                  <div className="relative h-[340px] overflow-hidden rounded-lg border border-st md:h-[390px]">
                    <Image src={a.mat} alt="" fill sizes="(min-width: 1024px) 820px, 88vw" className="object-cover" />
                    <div className="absolute inset-x-3 bottom-0 top-5 overflow-hidden rounded-t-xl border border-white/70 bg-sf-white shadow-[0_0_0_6px_rgba(255,255,255,.28)] md:inset-x-14 md:top-8 md:rounded-t-2xl">
                      {c.media}
                      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                    </div>
                  </div>

                  <ul className="m-0 flex list-none flex-col gap-x-6 gap-y-3 p-0 sm:flex-row">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex flex-1 items-start gap-3 text-body leading-[1.5] text-tx">
                        <VerifiedIcon className={cn("mt-0.5 size-[18px] shrink-0", a.check)} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
