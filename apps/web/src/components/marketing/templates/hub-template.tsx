import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CtaBand } from "@/components/marketing/cta-band";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { SectionHead } from "@/components/ui/section";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { cn } from "@/lib/cn";

/*
 * Section index pages (/tools, /use-cases, /compare, /integrations,
 * /glossary) on the kit integrations pattern: crest hero, then a centred
 * flex-wrap grid of tile cards (pastel banner, 18px title, 3-line
 * description, chip row pinned to the bottom).
 */

export interface HubItem {
  path: string;
  title: string;
  description: string;
  /** First chip is the coloured category chip. */
  chips: string[];
  tint?: "indigo" | "sky" | "violet" | "blue";
  icon?: ReactNode;
  logo?: string;
  cover?: string;
}

const TINT = {
  indigo: { banner: "from-[#e8effc]", chip: "bg-[#e8effc] text-[#3333cc]" },
  sky: { banner: "from-[#e0f2fe]", chip: "bg-sky-50 text-sky-700" },
  violet: { banner: "from-[#ede9fe]", chip: "bg-[#ede9fe] text-[#4c1d95]" },
  blue: { banner: "from-[#dbeafe]", chip: "bg-blue-50 text-blue-700" },
} as const;

export function HubTile({ item }: { item: HubItem }) {
  const t = TINT[item.tint ?? "indigo"];
  return (
    <Link
      href={item.path}
      className="group flex h-full flex-col justify-between gap-4 rounded-card border border-st-secondary bg-sf-white p-6 transition-[box-shadow,border-color,transform] duration-200 hover:border-grey-300 hover:shadow-card-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className={cn("relative grid h-36 place-items-center overflow-hidden rounded-card border border-st-secondary bg-gradient-to-br to-white md:h-40", t.banner)}>
        {item.cover ? (
          <Image src={item.cover} alt="" fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 88vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        ) : item.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- static monochrome logo
          <img src={item.logo} alt="" width={120} height={32} className="h-8 w-auto transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <span className="grid size-14 place-items-center rounded-2xl border border-white/80 bg-white/70 text-indigo-700 shadow-[0_8px_30px_-12px_rgba(37,99,235,0.5)] transition-transform duration-300 group-hover:scale-110 [&_svg]:size-6 [&_svg]:stroke-[1.6]">
            {item.icon}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-1">
        <h2 className="line-clamp-2 text-[18px] font-medium leading-[1.3] text-tx">{item.title}</h2>
        <p className="line-clamp-3 text-[13px] leading-[1.6] text-tx-secondary">{item.description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-1">
        {item.chips.map((c, i) => (
          <span
            key={c}
            className={cn(
              "rounded-full px-2.5 py-1 text-label leading-none",
              i === 0 ? cn("font-medium", t.chip) : "border border-st bg-sf-secondary text-tx-tertiary",
            )}
          >
            {c}
          </span>
        ))}
      </div>
    </Link>
  );
}

export function HubGrid({ items }: { items: HubItem[] }) {
  return (
    <ul className="m-0 flex w-full list-none flex-wrap justify-center gap-6 p-0">
      {items.map((it) => (
        <li key={it.path} className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
          <HubTile item={it} />
        </li>
      ))}
    </ul>
  );
}

export function HubTemplate({
  path,
  eyebrow,
  title,
  lead,
  groups,
  cta,
  children,
}: {
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  groups: Array<{ title?: string; intro?: string; items: HubItem[] }>;
  cta?: { title: string; secondary?: { label: string; href: string } };
  children?: ReactNode;
}) {
  const name = path.slice(1).replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return (
    <>
      <JsonLd data={graph(breadcrumbList([{ name: "Home", path: "/" }, { name, path }]))} />
      <InnerSheet>
        <HeroCompact eyebrow={eyebrow} title={title} lead={lead} />
        {groups
          .filter((g) => g.items.length)
          .map((g, i) => (
            <section key={g.title ?? i} className={cn("container section", i === 0 && "-mt-8 md:-mt-12")} aria-label={g.title ?? eyebrow}>
              {g.title ? <SectionHead title={g.title} intro={g.intro} /> : null}
              <HubGrid items={g.items} />
            </section>
          ))}
        {children}
        <CtaBand title={cta?.title} secondary={cta?.secondary} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
