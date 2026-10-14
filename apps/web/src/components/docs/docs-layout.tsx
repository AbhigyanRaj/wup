import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/marketing/breadcrumbs";
import { cn } from "@/lib/cn";
import { getDocsNav } from "./docs-nav";
import { DocsMobileNav } from "./docs-mobile-nav";
import { DocsNavTree } from "./docs-sidebar";
import { Toc, type TocEntry } from "./toc";
import "@/styles/prose.css";

/*
 * Docs shell (kit pages/docs.md): a 288px sticky sidebar with a hairline
 * right border | a 640px reading column (breadcrumb, 40px display H1, page
 * actions, hairline, body) | a 240px "On this page" rail with scroll-spy.
 * The sidebar becomes a drawer below 1024px and the TOC hides below 1280px.
 * Sits under the fixed 68px marketing header.
 */

export interface DocsLayoutProps {
  currentPath: string;
  title: string;
  lede?: ReactNode;
  crumbs: BreadcrumbItem[];
  /** Group name for the mobile switcher subtitle. */
  section?: string;
  actions?: ReactNode;
  toc?: TocEntry[];
  /** Article body (MDX or custom). */
  children: ReactNode;
  /** Feedback row, pager, etc. */
  footer?: ReactNode;
  proseClassName?: string;
  /** Render children without the prose wrapper (hub pages). */
  bare?: boolean;
}

export function DocsLayout({
  currentPath,
  title,
  lede,
  crumbs,
  section = "Documentation",
  actions,
  toc = [],
  children,
  footer,
  proseClassName,
  bare = false,
}: DocsLayoutProps) {
  const groups = getDocsNav();
  const current = groups.flatMap((g) => g.items).find((i) => i.path === currentPath);
  const showToc = toc.length > 0;

  return (
    <div id="top" className="pt-[68px]">
      <div className="sticky top-[68px] z-20 lg:hidden">
        <DocsMobileNav title={current?.label ?? "Overview"} subtitle={section}>
          <DocsNavTree groups={groups} currentPath={currentPath} />
        </DocsMobileNav>
      </div>

      <div
        className={cn(
          "mx-auto grid max-w-[1536px] grid-cols-1 border-t border-st lg:grid-cols-[288px_minmax(0,1fr)]",
          showToc && "xl:grid-cols-[288px_minmax(0,1fr)_272px]",
        )}
      >
        <aside className="hidden border-r border-st lg:block">
          <div className="sticky top-[68px] max-h-[calc(100dvh-68px)] overflow-y-auto py-10 pr-5 pl-6">
            <DocsNavTree groups={groups} currentPath={currentPath} />
          </div>
        </aside>

        <div className="min-w-0 px-[6%] pt-8 pb-20 md:px-12 lg:pt-12">
          <article className="mx-auto w-full max-w-[640px]">
            <header>
              <Breadcrumbs items={crumbs} includeCurrent={false} className="mb-2 [&_ol]:font-medium" />
              <h1 className="font-display text-[34px] leading-[1.15] font-medium tracking-heading text-balance text-tx md:text-heading-2">
                {title}
              </h1>
              {actions ? <div className="mt-5 -ml-2">{actions}</div> : null}
              <hr className="mt-5 mb-8 border-st" />
              {lede ? <div className="mb-8 text-body-lg leading-[1.7] text-tx-secondary">{lede}</div> : null}
            </header>
            {bare ? children : <div className={cn("prose prose--docs", proseClassName)}>{children}</div>}
            {footer ? <footer className="mt-20 flex flex-col gap-10">{footer}</footer> : null}
          </article>
        </div>

        {showToc ? (
          <aside className="hidden xl:block">
            <div className="sticky top-[68px] max-h-[calc(100dvh-68px)] overflow-y-auto py-12 pr-8 pl-4">
              <Toc items={toc} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
