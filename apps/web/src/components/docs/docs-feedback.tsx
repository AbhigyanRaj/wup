"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";

/*
 * "Was this page helpful?" (docs.md 2.6): 14px muted label and two 32px
 * outline buttons with thumb icons. A "No" offers a mail link so the reader
 * can say what was missing.
 */
export function DocsFeedback({ title }: { title: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-st bg-white px-3 text-caption text-tx-secondary transition-colors duration-150 ease-standard hover:border-[#cfcfcf] hover:text-tx";

  if (answer === "yes") return <p className="text-caption text-tx-tertiary" role="status">Thanks for letting us know.</p>;
  if (answer === "no")
    return (
      <p className="text-caption text-tx-tertiary" role="status">
        Sorry about that.{" "}
        <a
          className="prose-link"
          href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Docs feedback: ${title}`)}`}
        >
          Tell us what was missing
        </a>
        .
      </p>
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-caption text-tx-tertiary">Was this page helpful?</p>
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => setAnswer("yes")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" />
          </svg>
          Yes
        </button>
        <button type="button" className={btn} onClick={() => setAnswer("no")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 14V3h3v11zM17 14l-4 7a2 2 0 0 1-3-2l1-5H5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 6.4 3H17" />
          </svg>
          No
        </button>
      </div>
    </div>
  );
}
