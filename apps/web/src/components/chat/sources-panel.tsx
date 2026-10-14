"use client";

import * as React from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { MessageDTO, Source } from "@/lib/types";
import { domainOf, safeHref, unifySources } from "@/lib/sources";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/cn";
import { SourceKindIcon } from "./citation";
import { toolLabel } from "./messages/queries-used";

/*
 * Sources of one answer, numbered like the [n] pills. A 380px aside from
 * 1280px up, a right drawer below that.
 */

export const SOURCES_PANEL_QUERY = "(min-width: 1280px)";

const KIND_LABEL: Record<Source["kind"], string> = { doc: "Document", web: "Web", data: "Data" };

/** Escapes a string for use in a RegExp. */
function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlights the longest words of `query` inside `text` (doc snippets). */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(esc).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        // Split parts are positional and the text is static.
        i % 2 === 1 ? (
          <mark key={`m${i}`} className="mark rounded-[3px] bg-yellow-50 px-0.5 text-tx">
            {p}
          </mark>
        ) : (
          <React.Fragment key={`t${i}`}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

function keyTerms(question: string | undefined): string[] {
  if (!question) return [];
  const stop = new Set(["what", "which", "where", "when", "does", "with", "from", "that", "this", "have", "about", "show", "many", "much", "were", "there", "their"]);
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !stop.has(w)),
    ),
  ).slice(0, 6);
}

function SourceItem({
  source,
  active,
  terms,
  message,
}: {
  source: Source;
  active: boolean;
  terms: string[];
  message: MessageDTO | null;
}) {
  const ref = React.useRef<HTMLLIElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const href = source.kind === "web" ? safeHref(source.url) : null;
  const query = source.kind === "data" ? message?.queries?.[source.queryIndex] : undefined;

  return (
    <li
      ref={ref}
      id={`source-${source.n}`}
      className={cn(
        "rounded-xl border p-3.5 transition-[background-color,border-color] duration-300 ease-standard",
        active ? "border-indigo-200 bg-indigo-50/60" : "border-st-secondary bg-sf-white",
      )}
    >
      <div className="flex items-center gap-2 text-[12px] text-tx-tertiary">
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-[5px] text-[11px] font-medium tabular-nums text-indigo-800">
          {source.n}
        </span>
        <SourceKindIcon kind={source.kind} className="size-3.5" />
        <span>{KIND_LABEL[source.kind]}</span>
        {source.kind === "web" ? <span className="truncate">· {domainOf(source.url)}</span> : null}
        {source.kind === "doc" && source.page ? <span>· page {source.page}</span> : null}
        {!source.cited ? <span className="ml-auto text-tx-muted">Not cited</span> : null}
      </div>

      {source.kind === "web" && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-start gap-1 text-[14px] font-medium leading-[1.45] text-indigo-700 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <span className="line-clamp-2">{source.title}</span>
          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        </a>
      ) : (
        <p className="mt-1.5 break-words text-[14px] font-medium leading-[1.45] text-tx">
          {source.kind === "data" ? (
            <>
              {source.connectionName}
              <span className="text-tx-muted"> · </span>
              <span className="font-mono text-[13px]">
                {source.db}.{source.collection}
              </span>
            </>
          ) : (
            source.title
          )}
        </p>
      )}

      {source.kind === "doc" && source.snippet ? (
        <p className="mt-2 border-l-2 border-indigo-100 pl-3 text-[13px] leading-[1.6] text-tx-tertiary">
          <Highlighted text={source.snippet} terms={terms} />
        </p>
      ) : null}
      {source.kind === "web" && source.snippet ? (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-[1.6] text-tx-tertiary">{source.snippet}</p>
      ) : null}
      {source.kind === "data" ? (
        query ? (
          <details className="group/q mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full text-[13px] text-indigo-700 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 [&::-webkit-details-marker]:hidden">
              <span className="group-open/q:hidden">Show query</span>
              <span className="hidden group-open/q:inline">Hide query</span>
            </summary>
            <div className="mt-2 rounded-lg border border-st-secondary bg-bg p-2.5">
              <p className="mb-1.5 text-[12px] text-tx-tertiary">
                <span className="font-mono">{toolLabel(query.tool)}</span> · {query.rowCount} rows · {query.durationMs}ms
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] text-tx">
                {query.query}
              </pre>
            </div>
          </details>
        ) : null
      ) : null}
    </li>
  );
}

function SourcesList({
  sources,
  activeN,
  message,
  question,
}: {
  sources: Source[];
  activeN: number | null;
  message: MessageDTO | null;
  question?: string;
}) {
  const terms = React.useMemo(() => keyTerms(question), [question]);
  if (!sources.length) {
    return <p className="text-[14px] text-tx-tertiary">This answer has no sources.</p>;
  }
  return (
    <ol className="flex flex-col gap-2.5" aria-label="Sources">
      {sources.map((s) => (
        <SourceItem key={`${s.kind}-${s.n}`} source={s} active={s.n === activeN} terms={terms} message={message} />
      ))}
    </ol>
  );
}

export function SourcesPanel({
  open,
  message,
  liveSources,
  activeN,
  question,
  onClose,
}: {
  open: boolean;
  message: MessageDTO | null;
  /** Sources of an answer still streaming (no saved message yet). */
  liveSources?: Source[];
  activeN: number | null;
  question?: string;
  onClose: () => void;
}) {
  const docked = useMediaQuery(SOURCES_PANEL_QUERY, true);
  const sources = React.useMemo(() => (message ? unifySources(message) : liveSources ?? []), [message, liveSources]);
  const cited = sources.filter((s) => s.cited).length;
  const subtitle = sources.length
    ? `${sources.length} ${sources.length === 1 ? "source" : "sources"}${cited && cited < sources.length ? `, ${cited} cited` : ""}`
    : undefined;

  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (open && docked) closeRef.current?.focus({ preventScroll: true });
  }, [open, docked]);

  if (!docked) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()} title="Sources" description={subtitle} side="right" width={420}>
        <SourcesList sources={sources} activeN={activeN} message={message} question={question} />
      </Drawer>
    );
  }

  if (!open) return null;
  return (
    <aside
      aria-label="Sources"
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-st-secondary bg-sf-white"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-st-secondary px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium text-tx">Sources</h2>
          {subtitle ? <p className="text-[12px] text-tx-tertiary">{subtitle}</p> : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close sources"
          onClick={onClose}
          className="inline-flex size-9 items-center justify-center rounded-full text-tx-tertiary transition-colors duration-200 hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <SourcesList sources={sources} activeN={activeN} message={message} question={question} />
      </div>
    </aside>
  );
}
