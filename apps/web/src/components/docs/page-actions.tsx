"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Docs page actions row (docs.md 2.3): 28px ghost buttons, 14px muted text
 * with 16px icons, hover tint. "Copy as Markdown" copies the page source.
 */
export function PageActions({ markdown, appHref }: { markdown: string; appHref?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const btn =
    "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-caption text-tx-tertiary transition-colors duration-150 ease-standard hover:bg-indigo-50 hover:text-tx";

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1" role="group" aria-label="Page actions">
      <button type="button" onClick={copy} className={btn}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
        <span aria-live="polite">{copied ? "Copied" : "Copy as Markdown"}</span>
      </button>
      {appHref ? (
        <>
          <span aria-hidden="true" className="mx-1 h-3.5 w-px bg-st" />
          <a href={appHref} className={btn}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
            </svg>
            Try it in wuup
          </a>
        </>
      ) : null}
    </div>
  );
}
