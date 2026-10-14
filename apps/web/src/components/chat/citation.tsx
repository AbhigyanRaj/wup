"use client";

import * as React from "react";
import { FileText, Globe, Database } from "lucide-react";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "@/components/ui/tooltip";
import { findSource, sourceLabel, sourceSnippet, domainOf } from "@/lib/sources";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/cn";

/*
 * Inline citation pill. The markdown components map renders one for every
 * [n] marker; the sources of the current message come from context, so the
 * components map can live at module scope (no remounts).
 */

export interface CitationContextValue {
  sources: Source[];
  /** Opens the sources panel at source n. */
  openSource?: (n: number) => void;
}

export const CitationContext = React.createContext<CitationContextValue>({ sources: [] });

export function SourceKindIcon({ kind, className }: { kind: Source["kind"]; className?: string }) {
  const Icon = kind === "doc" ? FileText : kind === "web" ? Globe : Database;
  return <Icon className={cn("size-3.5 shrink-0", className)} strokeWidth={1.5} aria-hidden="true" />;
}

export function Citation({ n }: { n: number }) {
  const { sources, openSource } = React.useContext(CitationContext);
  const source = findSource(sources, n);
  const label = source ? `Source ${n}: ${sourceLabel(source)}` : `Source ${n}`;

  const pill = (
    <button
      type="button"
      aria-label={label}
      data-citation={n}
      onClick={() => openSource?.(n)}
      className={cn(
        "mx-[2px] inline-flex h-[18px] min-w-[18px] -translate-y-[1px] items-center justify-center rounded-full border px-[5px] align-middle",
        "font-sans text-[11px] font-medium leading-none tabular-nums",
        "border-indigo-200 bg-indigo-50 text-indigo-800",
        "transition-[background-color,border-color,color] duration-200 ease-standard",
        "hover:border-indigo-300 hover:bg-indigo-100",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-400",
        !openSource && "cursor-default",
      )}
    >
      {n}
    </button>
  );

  if (!source) return pill;
  const snippet = sourceSnippet(source);

  return (
    <TooltipRoot delayDuration={150}>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[12px] font-medium leading-4 text-white">
          <SourceKindIcon kind={source.kind} className="size-3 opacity-70" />
          <span className="truncate">
            {source.kind === "web" ? domainOf(source.url) : source.title}
          </span>
          {source.kind === "doc" && source.page ? (
            <span className="shrink-0 font-normal opacity-60">p. {source.page}</span>
          ) : null}
        </span>
        {snippet ? (
          <span className="mt-1 line-clamp-4 block text-[12px] font-normal leading-[1.5] text-white/75">
            {snippet}
          </span>
        ) : source.kind === "data" ? (
          <span className="mt-1 block font-mono text-[11px] leading-4 text-white/75">
            {source.db}.{source.collection}
          </span>
        ) : null}
      </TooltipContent>
    </TooltipRoot>
  );
}
