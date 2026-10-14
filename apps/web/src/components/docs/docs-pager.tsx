import Link from "next/link";
import type { DocsNavItem } from "./docs-nav";

/*
 * Previous / next cards (docs.md 2.6): full column width, ≈64px tall,
 * radius 12, 1px border with a 4px #f2f2f2 outer ring. Title 16-18px / 525.
 */
function PagerCard({ item, dir }: { item: DocsNavItem; dir: "prev" | "next" }) {
  const next = dir === "next";
  return (
    <Link
      href={item.path}
      rel={next ? "next" : "prev"}
      className={`group flex min-h-16 flex-1 items-center gap-3 rounded-xl border border-st bg-white px-5 py-3 shadow-[0_0_0_4px_#f2f2f2] transition-colors duration-150 hover:border-[#cfcfcf] ${next ? "justify-end text-right" : ""}`}
    >
      {!next ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-tx-tertiary transition-transform duration-200 group-hover:-translate-x-0.5">
          <path d="m15 18-6-6 6-6" />
        </svg>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="text-label text-tx-tertiary">{next ? "Next" : "Previous"}</span>
        <span className="truncate text-body font-medium text-tx">{item.label}</span>
      </span>
      {next ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-tx-tertiary transition-transform duration-200 group-hover:translate-x-0.5">
          <path d="m9 18 6-6-6-6" />
        </svg>
      ) : null}
    </Link>
  );
}

export function DocsPager({ prev, next }: { prev?: DocsNavItem; next?: DocsNavItem }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Previous and next pages" className="flex flex-col gap-4 sm:flex-row">
      {prev ? <PagerCard item={prev} dir="prev" /> : <span className="hidden flex-1 sm:block" />}
      {next ? <PagerCard item={next} dir="next" /> : <span className="hidden flex-1 sm:block" />}
    </nav>
  );
}
