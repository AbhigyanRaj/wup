"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Kit "Share" text button (blog-post 2.1): 14px share icon + label, #666,
 * hover #1f1f1f, press scale .96. Uses the Web Share API when available,
 * otherwise copies the link.
 */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function share() {
    const href = typeof window !== "undefined" ? new URL(url, window.location.origin).toString() : url;
    if (typeof navigator !== "undefined" && "share" in navigator && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url: href });
        return;
      } catch {
        /* dismissed: fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-10 items-center gap-2 rounded-full px-1 text-caption text-tx-tertiary transition-[color,transform] duration-150 ease-standard hover:text-tx active:scale-[.96]"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
