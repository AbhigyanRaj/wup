import { ArrowRight, Building2, KeyRound, MessageSquareText, Receipt } from "lucide-react";
import Link from "next/link";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCentered } from "@/components/marketing/hero-centered";
import { IncludedTable } from "@/components/marketing/included-table";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { PlanCards, type PlanCard } from "@/components/marketing/plan-cards";
import { JsonLd } from "@/components/seo/JsonLd";
import { SectionHead } from "@/components/ui/section";
import { includedGroups, pricing } from "@/content/data/pricing";
import { breadcrumbList, graph, softwareApplication } from "@/lib/jsonld";
import { breadcrumbsFor, getPage } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS } from "@/lib/site";

const PATH = "/pricing";
export const metadata = pageMetadata(PATH);

const IMAGES: Record<PlanCard["id"], PlanCard["image"]> = {
  free: { src: "/images/pricing/plan-free.webp", alt: "" },
  byok: { src: "/images/pricing/plan-byok.webp", alt: "" },
};

const plans: PlanCard[] = pricing.tiers.map((t) => ({
  ...t,
  image: IMAGES[t.id],
  note: t.id === "free" ? "No card needed" : undefined,
}));

const FLOW = [
  {
    icon: <MessageSquareText />,
    title: "You ask a question",
    body: "wuup reads the schema, writes a read-only query and runs it against your data.",
  },
  {
    icon: <KeyRound />,
    title: "wuup calls your provider",
    body: `The request to ${FACTS.byokProviders.join(", ")} is made with your key, on your account.`,
  },
  {
    icon: <Receipt />,
    title: "Your provider bills you",
    body: "You pay for the tokens at your provider's own rates. Their dashboard shows every call.",
  },
];

export default function PricingPage() {
  const h1 = getPage(PATH)?.h1 ?? "Free to start.\nYour key to scale.";
  return (
    <>
      <JsonLd data={graph(breadcrumbList(breadcrumbsFor(PATH)), softwareApplication())} />
      <InnerSheet>
        <div className="flex flex-col gap-12 md:gap-16">
          <HeroCentered title={h1} lead={pricing.lead} />
          <div className="container">
            <PlanCards plans={plans} />
          </div>
        </div>

        <section className="container section" aria-label="What is included">
          <SectionHead
            title={"Everything included,\nside by side"}
            intro="Both plans get the same sources, the same read-only guard and the same limits. Open a group to compare."
          />
          <IncludedTable groups={includedGroups} className="w-full" />
        </section>

        <section className="container section" aria-label="How billing works with your key">
          <SectionHead
            title={"Where the money goes"}
            intro="With your own key there is no wuup bill at all. Here is the whole path of a question."
          />
          <div className="mx-auto w-full md:w-9/12">
            <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-2">
              {FLOW.map((step, i) => (
                <li key={step.title} className="contents">
                  {i > 0 ? (
                    <span aria-hidden="true" className="hidden place-items-center text-indigo-400 md:grid">
                      <ArrowRight className="size-5" strokeWidth={1.5} />
                    </span>
                  ) : null}
                  <div className="flex flex-col gap-4 rounded-card border border-st-secondary bg-sf-white p-6">
                    <span className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-800 shadow-[inset_0_0_0_1px_var(--indigo-100)] [&_svg]:size-5 [&_svg]:stroke-[1.5]">
                        {step.icon}
                      </span>
                      <span className="font-mono text-label text-tx-muted">0{i + 1}</span>
                    </span>
                    <span className="text-body-lg font-medium leading-[1.35] text-tx">{step.title}</span>
                    <span className="text-caption leading-[1.6] text-tx-tertiary">{step.body}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-col items-start justify-between gap-4 rounded-card border border-indigo-200 bg-[linear-gradient(100deg,var(--indigo-50),#fff_60%)] px-6 py-5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-3">
                <Building2 className="size-5 shrink-0 text-indigo-700" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-body text-tx-secondary">
                  What wuup charges for a question on your key:{" "}
                  <span className="font-display text-[22px] tracking-[-0.02em] text-indigo-900">nothing</span>
                </span>
              </span>
              <Link href="/byok" className="link-arrow text-caption">
                How bring your own key works <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <FaqSection title={"Pricing questions,\nanswered"} items={pricing.faqs} />

        <CtaBand
          title={"Free to start.\nYours to scale."}
          secondary={{ label: "Set up your key", href: "/docs/byok-setup" }}
        />
      </InnerSheet>
      <PageSheetEnd className="md:-mt-12" />
    </>
  );
}
