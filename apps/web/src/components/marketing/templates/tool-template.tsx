import { Ban, Lock } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { ToolExamples } from "@/components/marketing/tool-examples";
import { JsonLd } from "@/components/seo/JsonLd";
import { ExplainTool } from "@/components/tools/explain-tool";
import { QueryTool, type ClientExample, type ClientSample } from "@/components/tools/query-tool";
import { SchemaTool, type ClientDataset } from "@/components/tools/schema-tool";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { mongoStages } from "@/content/data/mongo-stages";
import { sampleDatasets } from "@/content/data/sample-datasets";
import { tools, type ToolPageFull } from "@/content/data/tools";
import { breadcrumbList, graph, webApplication } from "@/lib/jsonld";

import { SIGNUP } from "@/lib/site";
import { formatDocument, literal, type Json } from "@/lib/tools/mongo-format";
import { LimitsCard, LinkColumns, liveLinks, NumberedSteps, ProseSplit, crumbsFor } from "./shared";

const API_TOOL: Record<ToolPageFull["mode"], string> = {
  query: "Gemini writes it, the read-only guard checks it",
  aggregation: "Gemini writes it, the read-only guard checks it",
  explain: "Stage cards in your browser, narrative on request",
  sql: "Gemini translates it, the read-only guard checks it",
  schema: "100% in your browser, nothing uploaded",
};

const TOOL_GLOSSARY: Record<ToolPageFull["mode"], string[]> = {
  query: ["/glossary/text-to-sql", "/glossary/aggregation-pipeline"],
  aggregation: ["/glossary/aggregation-pipeline", "/glossary/lookup"],
  explain: ["/glossary/aggregation-pipeline", "/glossary/lookup"],
  sql: ["/glossary/text-to-sql", "/glossary/lookup"],
  schema: ["/glossary/aggregation-pipeline", "/glossary/text-to-sql"],
};

function clientExamples(page: ToolPageFull): ClientExample[] {
  return page.examples.map((e) => ({
    id: e.id,
    title: e.title,
    dataset: e.dataset,
    question: e.question,
    sql: e.sql,
    query: e.query,
    explanation: e.explanation,
    resultPreview: e.resultPreview,
  }));
}

function clientSamples(): ClientSample[] {
  return sampleDatasets.map((d) => ({ id: d.id, name: d.name, collection: d.collection, doc: formatDocument(d.sample[0] as Json) }));
}

function clientDatasets(): ClientDataset[] {
  return sampleDatasets.map((d) => ({ id: d.id, name: d.name, collection: d.collection, docs: literal(d.sample as Json, "js-shell") }));
}

export function ToolTemplate({ page }: { page: ToolPageFull }) {
  const crumbs = crumbsFor(page.path);
  const examples = clientExamples(page);
  const otherTools = tools.filter((t) => t.path !== page.path).map((t) => t.path);
  const datasetsUsed = [...new Set(page.examples.map((e) => e.dataset))];

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbList(crumbs),
          webApplication({ name: `${page.h1} by wuup`, path: page.path, description: page.description }),
        )}
      />
      <InnerSheet>
        <div className="flex flex-col">
          <HeroCompact
            eyebrow={page.usesModel ? "Free tool" : "Free tool · In your browser"}
            title={page.h1}
            lead={page.lead}
            actions={
              <>
                <ButtonLink href="#tool" variant="hero-primary">
                  Try it now
                </ButtonLink>
                <ButtonLink href={SIGNUP} variant="hero-outline">
                  Ask your real database
                </ButtonLink>
              </>
            }
          >
            <ul className="m-0 mt-2 flex list-none flex-wrap justify-center gap-x-5 gap-y-2 p-0 text-caption text-tx-tertiary">
              <li>No signup</li>
              <li aria-hidden="true" className="hidden sm:list-item">·</li>
              <li>{API_TOOL[page.mode]}</li>
              <li aria-hidden="true" className="hidden sm:list-item">·</li>
              <li>{page.examples.length} verified examples</li>
            </ul>
          </HeroCompact>
          <section id="tool" className="container -mt-12 scroll-mt-24 md:-mt-16" aria-label={page.h1}>
            {page.mode === "explain" ? (
              <ExplainTool
                tool={page.tool}
                examples={examples}
                stages={mongoStages.map((s) => ({ name: s.name, summary: s.summary, allowed: s.allowed, note: s.note, docsUrl: s.docsUrl }))}
              />
            ) : page.mode === "schema" ? (
              <SchemaTool tool={page.tool} datasets={clientDatasets()} examples={examples} />
            ) : (
              <QueryTool tool={page.tool} mode={page.mode} examples={examples} samples={clientSamples()} />
            )}
          </section>
        </div>

        <section id="examples" className="container section scroll-mt-24" aria-labelledby="examples-title">
          <SectionHead
            title={`${page.examples.length} worked examples,\nrun against real data`}
            intro={`Every example ran on the sample ${datasetsUsed.join(", ")} collections before it was published, and the table under it is what MongoDB returned. Load any of them into the tool above.`}
          >
            <span id="examples-title" className="sr-only">
              Worked examples
            </span>
          </SectionHead>
          <ToolExamples tool={page.tool} examples={page.examples} sqlInput={page.mode === "sql"} />
        </section>

        <section className="container section" aria-label="How it works">
          <SectionHead title={"How the tool works"} intro={page.usesModel ? "Four steps, and none of them touch your database." : "Four steps, all inside this browser tab."} />
          <NumberedSteps steps={page.howItWorks} />
          <div className="grid w-full gap-4 md:grid-cols-2">
            <LimitsCard title="What it won't do" intro="Honest limits, so you know what to expect." items={page.wontDo} icon={<Ban />} />
            <div className="flex flex-col gap-5 rounded-2xl border border-st bg-sf-white p-6 md:p-8">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-800">
                  <Lock className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-heading-4 font-medium text-tx">The same guard as the product</h3>
                  <p className="mt-1 text-caption leading-[1.6] text-tx-tertiary">
                    Generated queries pass the check wuup runs on every connected database: only read stages, no server-side JavaScript, at most 30 stages.
                  </p>
                </div>
              </div>
              <dl className="m-0 flex flex-col">
                {[
                  ["Writes ($out, $merge)", "Refused"],
                  ["Server JS ($where, $function)", "Refused"],
                  ["Stages", "Read-only allowlist"],
                  ["Your database", "Never contacted"],
                  ["Inputs", page.usesModel ? "Cached 7 days by hash" : "Never leave the page"],
                ].map(([k, v]) => (
                  <div key={k} className="flex min-h-[3.25rem] items-center justify-between gap-4 border-t border-st-secondary py-3">
                    <dt className="text-[15px] text-tx-secondary">{k}</dt>
                    <dd className="m-0 text-right text-caption font-medium text-indigo-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="container section" aria-label="Background">
          <SectionHead title={"The concepts\nbehind the output"} intro="A short explanation of what the tool produces and the mistakes it is built to avoid." />
          <ProseSplit sections={page.sections} />
        </section>

        <section className="container section" aria-label="Keep going">
          <SectionHead title={"Keep going"} intro="Guides that go deeper, the product that runs these queries for you, and the other free tools." />
          <LinkColumns
            columns={[
              { title: "Guides", links: liveLinks(page.guides) },
              { title: "Ask your data", links: liveLinks([page.connector, "/security", "/pricing"]) },
              { title: "Free tools", links: liveLinks(otherTools) },
              { title: "Glossary", links: liveLinks(TOOL_GLOSSARY[page.mode]) },
              { title: "Use cases", links: liveLinks(["/use-cases/product-analytics-mongodb", "/use-cases/ecommerce-orders-mongodb", "/use-cases/support-tickets-mongodb"]) },
            ]}
          />
        </section>

        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <CtaBand title={"Stop writing queries.\nStart asking wuup."} secondary={{ label: "All free tools", href: "/tools" }} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
