"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** Small ghost button that copies `value` and briefly shows a check. */
export function CopyButton({
  value,
  label = "Copy",
  showLabel = false,
  className,
}: {
  value: string | (() => string);
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        const ok = await copyText(typeof value === "function" ? value() : value);
        if (ok) setCopied(true);
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-tx-tertiary",
        "transition-colors duration-200 ease-standard hover:bg-sf-secondary hover:text-tx",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-green-600" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
      )}
      {showLabel ? <span>{copied ? "Copied" : label}</span> : null}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
