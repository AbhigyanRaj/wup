import { ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { withLineBreaks } from "@/components/ui/section";
import { WORKS_WITH } from "@/components/marketing/logo-marquee";
import { home } from "@/content/data/home";
import { SIGNUP } from "@/lib/site";
import { HeroAskDemo } from "./hero-ask-demo";
import s from "./hero-ask.module.css";

/*
 * Home hero, "live ask box" direction: the product is the hero.
 * Server-rendered text layer (H1 is the LCP), then a small client island that
 * types a real question and streams a cited answer. The backdrop is a faint dot
 * grid plus a soft blue glow rising from below the ask box; no top band.
 */

export function HeroAsk() {
  return (
    <section className="relative isolate overflow-x-clip pt-[108px] md:pt-[132px]" aria-labelledby="hero-title">
      <div className={s.dots} aria-hidden="true" />

      <div className="container relative z-[1] flex flex-col items-center text-center">
        <Pill tone="info" dot className="items-center !px-3 !py-[3px] !text-[12.5px] leading-5">
          Read-only by design
        </Pill>
        <h1 id="hero-title" className="h-hero mt-5 max-w-[896px] md:mt-6">
          {withLineBreaks("Ask your database\nin plain English")}
        </h1>
        <p className="lead mt-2.5 max-w-[640px] text-balance md:mt-3.5">{home.lead}</p>
        <div className="hero__actions max-md:gap-2.5">
          <ButtonLink href={SIGNUP} variant="hero-primary" className="max-md:px-[18px]">
            Start free
          </ButtonLink>
          <ButtonLink href="/tools/mongodb-query-generator" variant="hero-outline" className="max-md:px-[18px]">
            Try the query generator
          </ButtonLink>
        </div>

        <div className="relative mt-12 w-full md:mt-16">
          <div className={s.glow} aria-hidden="true" />
          <HeroAskDemo />
        </div>
      </div>

      <QuietMarquee />
    </section>
  );
}

/* Smaller, quieter "Works with" strip than the kit marquee. */
function QuietMarquee() {
  const half = [...WORKS_WITH, ...WORKS_WITH];
  const row = (hidden?: boolean) => (
    <ul role="list" className="contents" aria-hidden={hidden || undefined}>
      {half.map((l, i) => (
        <li key={`${l.name}-${i}`} className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs */}
          <img src={l.src} alt="" width={18} height={18} className="size-[18px]" decoding="async" />
          <span className="text-[16px] font-medium tracking-[-0.01em] text-[#666]">{l.name}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee container relative z-[1] w-full !gap-4 pb-6 pt-14 md:pb-8 md:pt-20">
      <p className="eyebrow !text-tx-muted">Works with</p>
      <div className="marquee__track group max-w-[880px]" role="region" aria-label={`Works with ${WORKS_WITH.map((l) => l.name).join(", ")}`}>
        <div className={`marquee__row pr-11 group-hover:[animation-play-state:paused] motion-reduce:animate-none ${s.marqueeRow}`}>
          {row()}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
