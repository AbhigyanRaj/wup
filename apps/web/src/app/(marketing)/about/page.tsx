import Image from "next/image";
import { Mail } from "lucide-react";
import { MongoAnswer, MockWindow, SourceChip } from "@/components/marketing/answer-mock";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { withLineBreaks } from "@/components/ui/section";
import { Mark } from "@/components/ui/wordmark";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { breadcrumbsFor, getPage } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS, SITE } from "@/lib/site";

const PATH = "/about";
export const metadata = pageMetadata(PATH);

const PRINCIPLES = [
  {
    title: "Grounded numbers",
    body: "A language model is good with words and unreliable with figures it cannot see. So in wuup the numbers come from the rows your query returned, and charts are drawn from those rows. The model explains. It never types the figures.",
  },
  {
    title: "Read-only by default",
    body: `Connecting a database to AI should not mean handing over the keys. wuup only reads. Writes and server-side JavaScript are blocked, every query returns at most ${FACTS.maxRowsPerQuery} rows, sensitive fields are hidden, and you choose exactly which collections it may touch.`,
  },
  {
    title: "Your key, your choice",
    body: `Start with ${FACTS.freeQuestions} free questions on Gemini. When you want more, bring a key from ${FACTS.byokProviders.join(", ")} and pay your provider directly. We do not mark up your usage or lock you into one model.`,
  },
];

const WORKS_WITH = [
  { logo: "/logos/mongodb.svg", name: "MongoDB" },
  { logo: "/logos/google-sheets.svg", name: "Google Sheets" },
  { logo: "/logos/pdf.svg", name: "PDF and TXT" },
];

function CornerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
      <path d="M4 44V12a8 8 0 0 1 8-8h32" />
      <path d="M12 44V20a8 8 0 0 1 8-8h24" opacity=".55" />
      <circle cx="20" cy="20" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Orbits() {
  return (
    <svg viewBox="0 0 414 500" className="h-full w-full" fill="none" aria-hidden="true">
      <ellipse cx="330" cy="250" rx="250" ry="120" transform="rotate(-24 330 250)" stroke="#e6e6e6" />
      <ellipse cx="340" cy="260" rx="190" ry="210" stroke="#e6e6e6" />
      <ellipse cx="350" cy="240" rx="280" ry="90" transform="rotate(32 350 240)" stroke="#e6e6e6" />
      <circle cx="342" cy="250" r="64" stroke="#e6e6e6" />
      <circle cx="122" cy="196" r="5" fill="#9a9a9a" />
      <circle cx="252" cy="52" r="5" fill="#9a9a9a" />
      <circle cx="160" cy="388" r="5" fill="#9a9a9a" />
      <circle cx="342" cy="250" r="6" fill="var(--indigo-600)" />
    </svg>
  );
}

export default function AboutPage() {
  const h1 = getPage(PATH)?.h1 ?? "Built in India\nfor honest answers";
  return (
    <>
      <JsonLd data={graph(breadcrumbList(breadcrumbsFor(PATH)))} />
      <div className="flex flex-col gap-24">
      {/* Manifesto card on the blue gradient field (kit about.md 2.1) */}
      <section className="relative isolate flex flex-col items-center py-28 md:py-52">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 [background:linear-gradient(to_bottom,#fafafa_0%,#dfe6fd_9%,#c4b5fd_22%,#7dd3fc_37%,#1f63ff_50%,#7dd3fc_63%,#c4b5fd_78%,#e8ecfd_90%,#fcfcfc_100%)]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-50 mix-blend-soft-light [background-image:var(--noise-url)] [background-size:512px]" />
        <div className="relative w-[88%] rounded-[24px] border-2 border-black/5 bg-sf-secondary px-6 py-20 md:w-10/12 md:rounded-[32px] md:p-32 md:pb-36 lg:p-40 lg:pb-44">
          {["left-6 top-6 md:left-12 md:top-12", "right-6 top-6 rotate-90 md:right-12 md:top-12", "bottom-6 right-6 rotate-180 md:bottom-12 md:right-12", "bottom-6 left-6 -rotate-90 md:bottom-12 md:left-12"].map(
            (pos) => (
              <CornerMark key={pos} className={`absolute size-8 text-[#c8c8c8] md:size-12 ${pos}`} />
            ),
          )}
          <div className="mx-auto flex max-w-[880px] flex-col items-center gap-14 text-center md:gap-20">
            <Mark size={64} tone="light" className="shadow-[0_8px_30px_-8px_rgba(17,17,91,.25)]" />
            <div className="flex flex-col items-center gap-4 md:gap-5">
              <h1 className="text-balance font-display text-[32px] font-normal leading-[1.25] tracking-[-0.02em] text-tx md:text-[44px]">
                {withLineBreaks(h1)}
              </h1>
              <p className="text-justify text-body leading-[1.625] text-tx-secondary md:text-center md:text-body-lg">
                wuup is an AI data analyst, built in India. It answers questions about your MongoDB, Google Sheets and documents in plain
                English, and it shows its work: the rows behind every chart, the passages behind every citation and the exact query that ran.
                Our mission is simple. Answers about your data should be ones you can check.
              </p>
            </div>
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="flex flex-col items-center gap-4 md:gap-5">
                <h2 className="font-display text-[24px] font-normal leading-relaxed text-tx md:text-[34px]">{p.title}</h2>
                <p className="text-justify text-body leading-[1.625] text-tx-secondary md:text-center md:text-body-lg">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder panel (kit about.md 2.2) */}
      <section className="container -mt-12 flex flex-col items-center gap-8 md:-mt-20 md:gap-12" aria-labelledby="founder-title">
        <div className="flex max-w-[704px] flex-col items-center gap-3 text-center">
          <h2 id="founder-title" className="font-display text-[28px] font-normal leading-relaxed text-tx md:text-[36px]">
            The person behind wuup
          </h2>
          <p className="text-body leading-[1.625] text-tx-secondary md:text-body-lg">
            wuup is built by {SITE.founder} in India, around one idea: an answer about your data is only useful if you can check it. He
            reads every message sent through the contact page and answers it by email.
          </p>
        </div>
        <div className="relative w-full overflow-hidden rounded-[24px] bg-sf-secondary shadow-[inset_0_0_128px_0_#BED2FF] md:h-[500px] md:rounded-[44px]">
          <p className="absolute left-[8.333%] top-1/2 hidden font-display text-[18px] text-tx-secondary md:block">{SITE.founder}, founder</p>
          <p className="absolute right-[8.333%] top-1/4 hidden font-display text-[18px] text-tx-secondary md:block">Built in India</p>
          <div className="flex flex-col items-center gap-5 px-5 pt-10 md:absolute md:inset-x-0 md:top-12 md:px-0 md:pt-0">
            <div className="flex items-center gap-3 rounded-full border border-white bg-white/80 py-1.5 pl-1.5 pr-5 shadow-[0_10px_30px_-12px_rgba(17,17,91,.25)] backdrop-blur-sm">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full font-display text-[16px] text-white [background:var(--gradient-blue-vivid)]">
                AR
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-caption font-medium text-tx">{SITE.founder}</span>
                <span className="text-label text-tx-tertiary">Founder, wuup</span>
              </span>
            </div>
          </div>
          <div aria-hidden="true" className="mx-auto mt-8 w-[92%] translate-y-6 md:absolute md:bottom-0 md:left-1/2 md:mt-0 md:w-[640px] md:-translate-x-1/2 md:translate-y-[38%]">
            <MockWindow
              title="Revenue by month, 2026"
              sidebar={false}
              source={<SourceChip logo="/logos/mongodb.svg">shop-prod</SourceChip>}
            >
              <MongoAnswer compact />
            </MockWindow>
          </div>
        </div>
      </section>

      {/* "Works with" row (kit about.md 2.3) */}
      <section className="container flex flex-col gap-10 md:flex-row md:gap-16" aria-labelledby="works-title">
        <div className="flex flex-col items-center gap-3 text-center md:w-[320px] md:shrink-0 md:items-start md:text-left">
          <h2 id="works-title" className="font-display text-[24px] font-normal leading-tight text-tx md:text-[30px]">
            Built for the data you already have
          </h2>
          <p className="text-caption leading-[1.55] text-tx-tertiary md:text-body">
            Read-only MongoDB, Google Sheets and documents today. PostgreSQL and MySQL are on the roadmap.
          </p>
          <ButtonLink href="/features" variant="soft" size="sm" className="mt-3 w-fit">
            See every feature
          </ButtonLink>
        </div>
        <ul className="m-0 flex flex-1 list-none flex-col divide-y divide-st-secondary border-y border-st-secondary p-0 md:flex-row md:divide-x md:divide-y-0 md:border-x md:border-y-0">
          {WORKS_WITH.map((w) => (
            <li key={w.name} className="group flex flex-1 flex-row items-center gap-4 px-4 py-5 md:flex-col md:items-start md:px-12 md:py-6">
              <Image
                src={w.logo}
                alt=""
                width={48}
                height={48}
                className="size-10 rounded-sm grayscale transition-[filter] duration-300 group-hover:grayscale-0 md:size-12"
              />
              <span className="text-body-lg text-tx">{w.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Split CTA card (kit about.md 2.4) */}
      <section className="container" aria-labelledby="talk-title">
        <div className="relative overflow-hidden rounded-[24px] border border-st bg-sf-white md:h-[500px] md:rounded-[44px]">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[414px] md:block">
            <Orbits />
          </div>
          <div className="flex h-full flex-col justify-between gap-12 px-8 py-12 md:gap-20 md:px-20 md:py-12 md:pr-[500px]">
            <div className="flex flex-col gap-3">
              <h2 id="talk-title" className="font-display text-[28px] font-normal leading-relaxed text-tx md:text-[32px]">
                A source you need, or a bug to report?
              </h2>
              <p className="max-w-[500px] text-body leading-[1.625] text-tx-secondary md:text-body-lg">
                Tell us what you are trying to answer. Requests for new data sources shape what gets built next, and every message gets a
                reply from a person.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <ButtonLink href="/contact" variant="ink">
                Contact us
              </ButtonLink>
              <ButtonLink href={`mailto:${SITE.email}`} variant="soft" leadingIcon={<Mail className="size-4" aria-hidden="true" />}>
                Email the founder
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <CtaBand title={"Ask your data.\nCheck every answer."} secondary={{ label: "How security works", href: "/security" }} />
      </div>
      <PageSheetEnd className="md:-mt-12" />
    </>
  );
}
