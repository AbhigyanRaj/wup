import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { breadcrumbsFor, getPage, isLive } from "@/lib/registry";
import { cn } from "@/lib/cn";

/*
 * Small pieces shared by the templated SEO pages (connector, tool, compare,
 * alternatives, use-case, integration, glossary). Internal links always go
 * through liveLinks(), so a link to a page that isn't published yet is
 * dropped instead of 404ing.
 */

export interface LiveLink {
  path: string;
  label: string;
  description: string;
}

/** Published pages among `paths`, in order, with labels from the registry. */
export function liveLinks(paths: readonly string[], fallbackLabels: Record<string, string> = {}): LiveLink[] {
  const seen = new Set<string>();
  const out: LiveLink[] = [];
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (!isLive(path)) continue;
    const page = getPage(path);
    out.push({
      path,
      label: fallbackLabels[path] ?? page?.navLabel ?? page?.title ?? path,
      description: page?.description ?? "",
    });
  }
  return out;
}

/** Columns of kit link rows ("Free tools", "Guides", ...). Empty columns are dropped. */
export function LinkColumns({ columns, className }: { columns: Array<{ title: string; links: LiveLink[] }>; className?: string }) {
  const cols = columns.filter((c) => c.links.length);
  if (!cols.length) return null;
  return (
    <div className={cn("grid w-full gap-4", cols.length >= 3 ? "md:grid-cols-3" : cols.length === 2 ? "md:grid-cols-2" : "", className)}>
      {cols.map((c) => (
        <div key={c.title} className="flex flex-col rounded-2xl border border-st-secondary bg-sf-white p-6">
          <p className="mb-3 font-mono text-label uppercase tracking-[0.12em] text-tx-tertiary">{c.title}</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {c.links.map((l) => (
              <li key={l.path} className="border-b border-st-secondary last:border-0">
                <Link
                  href={l.path}
                  className="group flex items-center justify-between gap-3 py-3 text-body text-tx-secondary transition-colors duration-200 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  <span>{l.label}</span>
                  <ArrowRight className="size-4 shrink-0 text-tx-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-700" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Kit "numbered step boxes" on an indigo-50 panel. */
export function NumberedSteps({ steps, className }: { steps: Array<{ title: string; body: string }>; className?: string }) {
  return (
    <ol
      className={cn(
        "m-0 grid w-full list-none gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 md:gap-4 md:p-4",
        steps.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : steps.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
    >
      {steps.map((s, i) => (
        <li key={s.title} className="flex flex-col gap-3 rounded-xl border border-indigo-200/70 bg-sf-white px-5 py-5 shadow-[0_1px_2px_rgba(17,17,91,0.04)]">
          <span className="grid size-7 place-items-center rounded-full bg-indigo-100 text-caption font-medium text-indigo-800 tabular-nums">{i + 1}</span>
          <p className="text-body font-medium leading-[1.35] text-tx">{s.title}</p>
          <p className="text-caption leading-[1.6] text-tx-tertiary">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Bulleted honest-limits card. */
export function LimitsCard({ title, intro, items, icon }: { title: string; intro?: string; items: string[]; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-st bg-sf-white p-6 md:p-8">
      <div className="flex items-start gap-3">
        {icon ? <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sf-secondary text-tx-secondary [&_svg]:size-5">{icon}</span> : null}
        <div>
          <h3 className="text-heading-4 font-medium text-tx">{title}</h3>
          {intro ? <p className="mt-1 text-caption leading-[1.6] text-tx-tertiary">{intro}</p> : null}
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((it) => (
          <li key={it} className="flex gap-3 border-t border-st-secondary pt-3 text-[15px] leading-[1.6] text-tx-secondary">
            <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-tx-muted" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kit checklist with indigo verified-badge icons. */
export function CheckItems({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-3 p-0", className)}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-body leading-[1.55] text-tx">
          <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-indigo-300 text-indigo-700">
            <Check className="size-3" strokeWidth={2.4} aria-hidden="true" />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** External source list with "Last verified" footnote. */
export function SourcesList({ sources, verifiedOn }: { sources: Array<{ label: string; url: string }>; verifiedOn?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-st-secondary bg-sf-white p-6">
      <p className="font-mono text-label uppercase tracking-[0.12em] text-tx-tertiary">Sources</p>
      <ul className="m-0 grid list-none gap-x-6 gap-y-2 p-0 md:grid-cols-2">
        {sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-caption text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600"
            >
              {s.label}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      {verifiedOn ? <p className="text-label text-tx-tertiary">Last verified {formatDate(verifiedOn)}. Products change; check each vendor&apos;s site for current details.</p> : null}
    </div>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Two-column prose: heading left, paragraphs right (kit statement split). */
export function ProseSplit({ sections }: { sections: Array<{ heading: string; body: string[] }> }) {
  return (
    <div className="flex w-full flex-col divide-y divide-st-secondary border-y border-st-secondary">
      {sections.map((s) => (
        <div key={s.heading} className="grid gap-4 py-8 md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] md:gap-12 md:py-10">
          <h3 className="text-heading-3 font-medium leading-[1.25] tracking-card text-tx">{s.heading}</h3>
          <div className="flex flex-col gap-4">
            {s.body.map((p) => (
              <p key={p.slice(0, 40)} className="text-body leading-[1.7] text-tx-secondary">
                {p}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const HUBS: Record<string, { name: string; path: string }> = {
  tools: { name: "Free tools", path: "/tools" },
  "use-cases": { name: "Use cases", path: "/use-cases" },
  compare: { name: "Compare", path: "/compare" },
  alternatives: { name: "Compare", path: "/compare" },
  integrations: { name: "Integrations", path: "/integrations" },
  glossary: { name: "Glossary", path: "/glossary" },
};

/**
 * breadcrumbsFor() plus the section hub when the hub page isn't in the
 * registry (the hubs are routes, registered by core-pages when added there).
 */
export function crumbsFor(path: string): Array<{ name: string; path: string }> {
  const crumbs = breadcrumbsFor(path);
  const hub = HUBS[path.split("/")[1] ?? ""];
  if (!hub || crumbs.some((c) => c.path === hub.path)) return crumbs;
  return [crumbs[0], hub, ...crumbs.slice(1)];
}
