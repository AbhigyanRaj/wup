import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, Mail, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { CtaBand } from "@/components/marketing/cta-band";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { breadcrumbsFor, getPage } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { GlyphField } from "./_components/glyph-field";

const PATH = "/contact";
export const metadata = pageMetadata(PATH);

const TILES: Array<{ href: string; label: string; icon: ReactNode; external?: boolean }> = [
  { href: "/docs", label: "Read the docs", icon: <BookOpen /> },
  { href: "/security", label: "Security", icon: <ShieldCheck /> },
  { href: `mailto:${SITE.email}`, label: "Email us", icon: <Mail />, external: true },
];

function Tiles({ translucent = false }: { translucent?: boolean }) {
  return (
    <ul className="m-0 grid list-none grid-cols-3 gap-2.5 p-0">
      {TILES.map((t) => {
        const Comp = t.external ? "a" : Link;
        return (
        <li key={t.label}>
          <Comp
            href={t.href}
            className={
              "flex h-full min-h-[118px] flex-col justify-between gap-8 rounded-2xl border p-4 shadow-[inset_0_-1px_0_rgba(0,0,0,.05),inset_0_-3px_6px_rgba(0,0,0,.06)] transition-colors duration-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 " +
              (translucent ? "border-st/50 bg-sf/50 text-tx-secondary" : "border-st bg-sf-tertiary text-tx")
            }
          >
            <span aria-hidden="true" className="text-indigo-900 [&_svg]:size-5 [&_svg]:stroke-[1.5]">
              {t.icon}
            </span>
            <span className="flex items-start justify-between gap-1 text-caption font-medium leading-[1.25]">
              {t.label}
              <ArrowUpRight className="size-3 shrink-0 text-tx-tertiary" aria-hidden="true" />
            </span>
          </Comp>
        </li>
        );
      })}
    </ul>
  );
}

export default function ContactPage() {
  const h1 = getPage(PATH)?.h1 ?? "Talk to us";
  return (
    <>
      <JsonLd data={graph(breadcrumbList(breadcrumbsFor(PATH)))} />
      <InnerSheet>
        <section className="container pt-24 md:pt-32" aria-labelledby="contact-title">
          <div className="flex flex-col overflow-hidden rounded-[24px] border border-st bg-bg shadow-[0_30px_80px_-40px_rgba(17,17,91,.25)] lg:h-[min(780px,calc(100dvh-160px))] lg:min-h-[640px] lg:flex-row">
            {/* Left: dark glyph panel */}
            <div className="relative flex shrink-0 flex-col justify-between gap-5 overflow-hidden bg-[#0a0d2e] p-8 lg:w-[40%] lg:p-12">
              <GlyphField className="absolute inset-0" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/45" />
              <div className="relative z-10 flex flex-col gap-4">
                <h1 id="contact-title" className="font-display text-[32px] font-normal leading-[1.15] tracking-[-0.9px] text-white xl:text-[36px]">
                  {h1}
                </h1>
                <p className="max-w-[340px] text-caption leading-[1.6] text-white/70 lg:text-body">
                  A question, a bug or a data source you need. A person reads every message and replies by email.
                </p>
              </div>
              <div className="relative z-10 hidden flex-col gap-6 lg:flex">
                <a
                  href={`mailto:${SITE.email}`}
                  className="group flex w-fit flex-col gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300"
                >
                  <span className="text-label font-medium uppercase tracking-[0.17em] text-white/55">Or write directly</span>
                  <span className="text-body text-white underline decoration-white/30 underline-offset-4 group-hover:decoration-white">
                    {SITE.email}
                  </span>
                </a>
                <Tiles />
              </div>
            </div>

            {/* Right: the stepped form */}
            <div className="flex min-h-[640px] flex-1 flex-col border-st lg:min-h-0 lg:border-l">
              <ContactForm />
            </div>

            {/* Mobile: quick links band */}
            <div className="relative overflow-hidden bg-[#0a0d2e] p-8 lg:hidden">
              <GlyphField className="absolute inset-0" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
              <div className="relative z-10 flex flex-col gap-4">
                <p className="text-label font-medium uppercase tracking-[0.17em] text-white/60">Looking for something else?</p>
                <a href={`mailto:${SITE.email}`} className="break-all text-body text-white underline decoration-white/30 underline-offset-4">
                  {SITE.email}
                </a>
                <Tiles translucent />
              </div>
            </div>
          </div>
        </section>

        <CtaBand title={"Rather see it first?\nTry wuup free."} secondary={{ label: "Read the docs", href: "/docs" }} />
      </InnerSheet>
      <PageSheetEnd className="md:-mt-12" />
    </>
  );
}
