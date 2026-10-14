import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CreditCard, Database, LayoutGrid, Mail, ShieldCheck } from "lucide-react";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink } from "@/components/ui/button";
import { isLive } from "@/lib/registry";
import { noindexMetadata } from "@/lib/seo";

/*
 * A calm 404: the sunrise, one plain sentence and the pages people usually
 * want. Links that are not published yet are left out.
 */

export const metadata: Metadata = { ...noindexMetadata, title: "Page not found" };

const POPULAR = [
  { path: "/features", label: "Features", note: "What wuup does, end to end", icon: <LayoutGrid /> },
  { path: "/chat-with-mongodb", label: "Chat with MongoDB", note: "Read-only answers from your collections", icon: <Database /> },
  { path: "/security", label: "Security", note: "How every query is checked", icon: <ShieldCheck /> },
  { path: "/pricing", label: "Pricing", note: "Free to start, then your own key", icon: <CreditCard /> },
  { path: "/docs", label: "Docs", note: "Set up sources and keys", icon: <BookOpen /> },
  { path: "/contact", label: "Contact", note: "Ask a person", icon: <Mail /> },
];

export default function NotFound() {
  const links = POPULAR.filter((l) => isLive(l.path));
  return (
    <>
      <SiteHeader />
      <main id="main" className="page-sheet">
        <div className="flex flex-col gap-16 md:gap-20">
          <HeroCompact
            eyebrow="404"
            title={"This page is\nnot here"}
            lead="The link may be old, or the page has moved. Nothing is broken on your side. Here are the places people usually look for."
            actions={
              <>
                <ButtonLink href="/" variant="hero-primary">
                  Go to the home page
                </ButtonLink>
                <ButtonLink href="/docs" variant="hero-outline">
                  Browse the docs
                </ButtonLink>
              </>
            }
          />
          {links.length ? (
            <section className="container -mt-8 md:-mt-12" aria-labelledby="popular-title">
              <h2 id="popular-title" className="eyebrow mb-6 text-center">
                Popular pages
              </h2>
              <ul className="mx-auto my-0 grid max-w-[960px] list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((l) => (
                  <li key={l.path} className="min-w-0">
                    <Link
                      href={l.path}
                      className="group flex h-full items-center gap-4 rounded-card border border-st-secondary bg-sf-white p-4 transition-[border-color,box-shadow] duration-200 hover:border-indigo-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-11 shrink-0 place-items-center rounded-xl bg-sf-secondary text-tx-secondary transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-800 [&_svg]:size-5 [&_svg]:stroke-[1.5]"
                      >
                        {l.icon}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-body font-medium text-tx">{l.label}</span>
                        <span className="truncate text-caption text-tx-tertiary">{l.note}</span>
                      </span>
                      <ArrowRight
                        className="ml-auto size-4 shrink-0 text-st transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-tx-tertiary"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <PageSheetEnd />
      </main>
      <SiteFooter />
    </>
  );
}
