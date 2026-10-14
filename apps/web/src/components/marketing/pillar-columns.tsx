import Image from "next/image";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { LinkRow, LinkRows } from "@/components/ui/link-row";
import { SectionHead } from "@/components/ui/section";
import { StatRow } from "@/components/ui/stat-row";

/*
 * Kit "3 columns with link rows / stats" (home.md §8): image card, 20px
 * title, 16px grey paragraph, then link rows (icon tints to the column
 * accent on hover) or stat rows. Centred ink button below.
 */

export interface Pillar {
  title: string;
  body: string;
  image: { src: string; alt: string };
  /** Link-row hover tint, e.g. "var(--icon-hover-indigo)". */
  accent: string;
  links?: Array<{ href: string; label: string; icon: ReactNode }>;
  stats?: Array<{ label: string; value: ReactNode }>;
}

export function PillarColumns({
  title,
  pillars,
  cta,
}: {
  title: string;
  pillars: Pillar[];
  cta?: { label: string; href: string };
}) {
  return (
    <section className="container section" aria-label={title.replace(/\n/g, " ")}>
      <SectionHead title={title} />
      <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
        {pillars.map((p) => (
          <div key={p.title} className="flex flex-col gap-6">
            <div className="relative aspect-[368/220] overflow-hidden rounded-lg border border-st-secondary">
              <Image src={p.image.src} alt={p.image.alt} fill sizes="(min-width: 1440px) 368px, (min-width: 768px) 28vw, 88vw" quality={80} className="object-cover" />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="h-card">{p.title}</h3>
              <p className="body-muted">{p.body}</p>
            </div>
            {p.links ? (
              <LinkRows>
                {p.links.map((l) => (
                  <LinkRow key={l.href} href={l.href} label={l.label} icon={l.icon} hoverColor={p.accent} />
                ))}
              </LinkRows>
            ) : null}
            {p.stats ? (
              <div>
                {p.stats.map((s) => (
                  <StatRow key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {cta ? (
        <ButtonLink href={cta.href} variant="ink">
          {cta.label}
        </ButtonLink>
      ) : null}
    </section>
  );
}
