import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { highlight } from "@/components/tools/code-tokens";
import { ButtonLink } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import type { GlossaryTerm } from "@/content/types";
import { breadcrumbList, graph, techArticle } from "@/lib/jsonld";

import { SIGNUP } from "@/lib/site";
import { liveLinks, crumbsFor } from "./shared";

/*
 * Glossary entry on the kit article template (blog-post.md): 680px reading
 * column, breadcrumb, display h1, a definition callout (3px rule, display
 * font), 16px / 1.65 body, a code example, then "see also" rows.
 */

export function GlossaryTemplate({ page }: { page: GlossaryTerm }) {
  const crumbs = crumbsFor(page.path);
  const seeAlso = liveLinks(page.seeAlso);
  const words = page.body.join(" ").split(/\s+/).length;
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbList(crumbs),
          techArticle({ title: page.title, description: page.description, path: page.path, date: page.updated, updated: page.updated, author: "abhigyan-raj" }),
        )}
      />
      <article className="mx-auto w-10/12 max-w-[680px] pb-8 pt-28 md:w-full md:pt-36">
        <Breadcrumbs items={crumbs.map((c) => ({ name: c.name, path: c.path }))} className="mb-6" />
        <h1 className="font-display text-[36px] font-medium leading-[1.2] tracking-[-0.01em] text-tx md:text-[42px]">{page.h1}</h1>
        <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-4">
          <span className="rounded-full bg-sf-secondary px-3 py-1 text-label text-tx-tertiary">Glossary</span>
          <ButtonLink href={SIGNUP} variant="ink" size="sm">
            Try it in wuup
          </ButtonLink>
        </div>
        <hr className="mb-6 border-st" />
        <p className="mb-10 flex gap-2.5 text-caption text-tx-tertiary">
          <span>Updated {new Date(`${page.updated}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <span aria-hidden="true">·</span>
          <span>{Math.max(1, Math.round(words / 220))} min read</span>
        </p>

        <blockquote className="m-0 border-l-[3px] border-indigo-300 pl-6 font-display text-[20px] leading-[1.65] text-tx">{page.short}</blockquote>

        <div className="mt-10 flex flex-col gap-5">
          {page.body.map((p, i) => (
            <p key={i} className="text-pretty text-body leading-[1.65] text-tx">
              {p}
            </p>
          ))}
        </div>

        {page.example ? (
          <figure className="mt-10 flex flex-col gap-3">
            <CodeBlock title={page.example.language === "javascript" ? "mongosh" : "Example"} code={page.example.code}>
              {highlight(page.example.code, page.example.language === "javascript" ? "js" : "sql")}
            </CodeBlock>
            <figcaption className="text-caption leading-relaxed text-tx-secondary">A worked example of {page.term}.</figcaption>
          </figure>
        ) : null}

        {seeAlso.length ? (
          <nav aria-label="See also" className="mt-12">
            <h2 className="mb-4 text-[24px] font-semibold leading-[1.25] text-tx md:text-[28px]">See also</h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {seeAlso.map((l) => (
                <li key={l.path} className="border-t border-st-secondary last:border-b">
                  <Link href={l.path} className="group flex items-center justify-between gap-4 py-4 text-body text-tx hover:text-indigo-800">
                    <span className="flex flex-col">
                      <span className="font-medium">{l.label}</span>
                      <span className="line-clamp-1 text-caption text-tx-tertiary">{l.description}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-tx-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li className="border-b border-st-secondary">
                <Link href="/glossary" className="group flex items-center justify-between gap-4 py-4 text-body text-tx hover:text-indigo-800">
                  <span className="font-medium">All glossary terms</span>
                  <ArrowRight className="size-4 shrink-0 text-tx-muted" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
      </article>
      <div className="flex flex-col gap-24 pt-16 md:gap-32">
        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <CtaBand title={"From definitions\nto answers."} secondary={{ label: "Free MongoDB tools", href: "/tools" }} />
      </div>
      <PageSheetEnd />
    </>
  );
}
