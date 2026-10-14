"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ChartColumn, Database, FileText } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatRow, StatRows } from "@/components/ui/stat-row";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/cn";
import { FACTS, PRICING } from "@/lib/site";
import type { UsageResponse } from "@/lib/types";
import { useUsage } from "@/hooks/data/useUsage";
import { PROVIDERS } from "./models-settings";
import { SettingsCard, SettingsHeader } from "./settings-ui";
import { UsageChart } from "./usage-chart";

/* ------------------------------------------------------------------ */
/* Plan cards (kit pricing pattern: image band, eyebrow, title, CTA,   */
/* divider, check list)                                                */
/* ------------------------------------------------------------------ */

function PlanCard({
  image,
  fallback,
  eyebrow,
  title,
  description,
  current,
  cta,
  benefits,
  testId,
}: {
  image: string;
  fallback: string;
  eyebrow: string;
  title: string;
  description: string;
  current: boolean;
  cta: React.ReactNode;
  benefits: string[];
  testId: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-sf-white",
        current ? "border-indigo-200 shadow-[0_0_0_3px_var(--indigo-50)]" : "border-st-secondary",
      )}
      data-testid={testId}
      aria-current={current ? "true" : undefined}
    >
      <div className="relative h-32 sm:h-36" style={{ background: fallback }}>
        <Image src={image} alt="" fill loading="eager" sizes="(min-width: 768px) 360px, 100vw" className="object-cover" />
        {current ? (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-sf-white/90 px-2.5 py-1 text-[12px] font-medium text-indigo-800 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur">
            <BadgeCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Current plan
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-[14px] font-medium text-tx-tertiary">{eyebrow}</p>
          <h3 className="text-[20px] font-medium leading-[1.3] tracking-[-0.02em] text-tx">{title}</h3>
          <p className="text-[14px] leading-[1.6] text-tx-secondary">{description}</p>
        </div>
        <div>{cta}</div>
        <ul className="mt-auto flex flex-col gap-2.5 border-t border-st-secondary pt-5">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-tx">
              <BadgeCheck className="mt-0.5 size-[18px] shrink-0 text-indigo-600" strokeWidth={1.5} aria-hidden="true" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function PlanCards({ usage }: { usage: UsageResponse | undefined }) {
  const tier = usage?.plan.tier ?? "free";
  const byok = tier === "byok";
  const provider = usage?.apiKey?.provider;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PlanCard
        testId="plan-free"
        image="/images/pricing/plan-free.webp"
        fallback="var(--gradient-blue-light)"
        eyebrow={PRICING.free.name}
        title={`${FACTS.freeQuestions} answers with ${PRICING.free.model}`}
        description="Try wuup on your own data. No card, no key."
        current={!byok}
        cta={
          !byok ? (
            <span className="inline-flex h-10 items-center text-[14px] text-tx-tertiary">
              {usage?.plan.remaining ?? FACTS.freeQuestions} answers left
            </span>
          ) : (
            <Link href="/settings/models" className={buttonClassName({ variant: "soft", size: "sm" })}>
              <span>Switch back</span>
            </Link>
          )
        }
        benefits={["Every data source and document", "Charts, tables and citations", "Read-only by design"]}
      />
      <PlanCard
        testId="plan-byok"
        image="/images/pricing/plan-byok.webp"
        fallback="var(--gradient-cta-dark)"
        eyebrow={PRICING.byok.name}
        title="Unlimited answers"
        description="You pay your provider. wuup adds no charge."
        current={byok}
        cta={
          <Link href="/settings/models" className={buttonClassName({ variant: "ink", size: "sm" })}>
            <span>{byok ? `Manage ${provider ? PROVIDERS[provider].name : ""} key` : "Add your key"}</span>
          </Link>
        }
        benefits={[`Works with ${PRICING.byok.providers.slice(0, -1).join(", ")} or ${PRICING.byok.providers.at(-1)}`, "Pick the model per chat", "No limit from wuup"]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Limits (kit rate-table accordion)                                  */
/* ------------------------------------------------------------------ */

function LimitsTable({ usage }: { usage: UsageResponse | undefined }) {
  const l = usage?.limits;
  const rowsPerQuery = l?.maxRowsPerQuery ?? FACTS.maxRowsPerQuery;
  const timeoutS = l ? Math.round(l.queryTimeoutMs / 1000) : FACTS.queryTimeoutS;
  const groups: { id: string; title: string; subtitle: string; icon: React.ReactNode; rows: [string, string, string][] }[] = [
    {
      id: "answers",
      title: "Answers",
      subtitle: "Questions you can ask",
      icon: <ChartColumn />,
      rows: [
        ["Answers", `${usage?.plan.limit ?? FACTS.freeQuestions} in total`, "Unlimited"],
        ["Research run", `${usage?.plan.researchCost ?? 3} answers each`, "No limit from wuup"],
        ["Models", PRICING.free.model, "Your provider's models"],
      ],
    },
    {
      id: "data",
      title: "Database queries",
      subtitle: "Every query is read only",
      icon: <Database />,
      rows: [
        ["Rows per query", String(rowsPerQuery), String(rowsPerQuery)],
        ["Query timeout", `${timeoutS} seconds`, `${timeoutS} seconds`],
      ],
    },
    {
      id: "docs",
      title: "Documents",
      subtitle: "Your knowledge base",
      icon: <FileText />,
      rows: [
        ["File size", `${l?.maxUploadMb ?? 20} MB`, `${l?.maxUploadMb ?? 20} MB`],
        ["Documents", String(l?.maxSources ?? 50), String(l?.maxSources ?? 50)],
        ["Indexed chunks", (l?.maxChunks ?? 5000).toLocaleString("en-US"), (l?.maxChunks ?? 5000).toLocaleString("en-US")],
      ],
    },
  ];

  return (
    <Accordion variant="compact" type="single" collapsible defaultValue="answers" data-testid="limits-table">
      {groups.map((g) => (
        <AccordionItem key={g.id} value={g.id}>
          <AccordionTrigger icon={g.icon} subtitle={g.subtitle} as="h4">
            {g.title}
          </AccordionTrigger>
          <AccordionContent className="px-0! py-0! md:px-0!">
            <div role="table" aria-label={`${g.title} limits`} className="text-[15px]">
              <div
                role="row"
                className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-6 border-b border-st-secondary px-6 py-2.5 sm:grid md:px-8"
              >
                {["Limit", "Free", "Your key"].map((h) => (
                  <span key={h} role="columnheader" className="text-[12px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">
                    {h}
                  </span>
                ))}
              </div>
              {g.rows.map(([name, free, own]) => (
                <div
                  key={name}
                  role="row"
                  className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b border-st-secondary px-6 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-6 md:px-8"
                >
                  <span role="rowheader" className="font-medium text-tx">
                    {name}
                  </span>
                  <span role="cell" className="text-right tabular-nums text-tx sm:text-left">
                    <span className="sr-only">Free: </span>
                    {free}
                  </span>
                  <span role="cell" className="col-span-2 text-[14px] text-tx-tertiary sm:col-span-1 sm:text-[15px]">
                    <span className="sm:hidden">With your key: </span>
                    <span className="sr-only max-sm:hidden">Your key: </span>
                    {own}
                  </span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/* ------------------------------------------------------------------ */

export function UsageSettings() {
  const usage = useUsage();
  const u = usage.data;
  const free = u?.plan.tier !== "byok";
  const used = u?.plan.used ?? 0;
  const limit = u?.plan.limit ?? FACTS.freeQuestions;

  return (
    <div data-testid="settings-usage">
      <SettingsHeader title="Usage and plan" description="Your plan, what you've used and the limits that apply." />
      <div className="flex flex-col gap-4">
        <PlanCards usage={u} />

        <SettingsCard title="This month" description="Answers and storage across your account.">
          {usage.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {free ? (
                <Progress
                  value={used}
                  max={limit}
                  label={`${used} of ${limit} free answers used`}
                  showValue
                  tone={used / limit > 0.85 ? "red" : "blue"}
                />
              ) : null}
              <StatRows data-testid="usage-stats">
                <StatRow label="Answers used" value={free ? `${used} of ${limit}` : (u?.totals.messages ?? used).toLocaleString("en-US")} />
                <StatRow
                  label="Documents"
                  value={`${u?.counts.documents ?? 0}${u?.limits.maxSources ? ` of ${u.limits.maxSources}` : ""}`}
                />
                <StatRow
                  label="Indexed chunks"
                  value={`${(u?.limits.chunksUsed ?? 0).toLocaleString("en-US")} of ${(u?.limits.maxChunks ?? 0).toLocaleString("en-US")}`}
                />
                <StatRow label="Data sources" value={(u?.counts.bridges ?? 0).toLocaleString("en-US")} />
              </StatRows>
            </div>
          )}
        </SettingsCard>

        <SettingsCard title="Daily answers" description="The last 30 days.">
          {usage.isPending ? <Skeleton shape="block" className="h-40 w-full" /> : <UsageChart days={u?.daily ?? []} />}
        </SettingsCard>

        <section aria-labelledby="limits-title" className="flex flex-col gap-3">
          <div className="px-1 pt-4">
            <h3 id="limits-title" className="text-[18px] font-medium tracking-[-0.015em] text-tx">
              Limits
            </h3>
            <p className="mt-1 text-[14px] text-tx-tertiary">Open a group to compare the free tier with your own key.</p>
          </div>
          <LimitsTable usage={u} />
        </section>
      </div>
    </div>
  );
}
