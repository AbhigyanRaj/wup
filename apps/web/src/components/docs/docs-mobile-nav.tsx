"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/*
 * Mobile docs navigation (docs.md 2.8): a switcher row under the header
 * (36px bordered tile, current section title, chevron) that opens the nav
 * tree in a left drawer. Uses the native <dialog> (focus trap, Esc to close),
 * so no animation library loads on marketing routes.
 */
export function DocsMobileNav({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-3 border-b border-st bg-bg/95 px-[6%] py-2.5 text-left backdrop-blur lg:hidden"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-st bg-white text-tx-secondary">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-semibold text-tx">{title}</span>
          <span className="truncate text-caption text-tx-tertiary">{subtitle}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-tx-tertiary">
          <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
        </svg>
        <span className="sr-only">Open documentation menu</span>
      </button>
      <dialog
        ref={ref}
        aria-label="Documentation menu"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
        className="docs-drawer m-0 h-dvh max-h-dvh w-[min(320px,calc(100vw-48px))] max-w-none border-r border-st bg-white p-0 backdrop:bg-black/30"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-st-secondary px-5 py-3">
            <span className="text-body font-semibold text-tx">Documentation</span>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="grid size-10 place-items-center rounded-full text-tx-tertiary transition-colors hover:bg-sf-secondary hover:text-tx"
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-6">{children}</div>
        </div>
      </dialog>
    </>
  );
}
