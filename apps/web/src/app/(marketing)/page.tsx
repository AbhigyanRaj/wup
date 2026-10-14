import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChartColumn, Code2, Database, FileSearch, FileText, GitBranch, Layers, Sheet, ShieldCheck, Table2 } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink, ArrowIcon } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Reveal } from "@/components/ui/reveal";
import { SectionHead } from "@/components/ui/section";
import { ChartsAnswer, DocsAnswer, MockWindow, MongoAnswer, QueriesAnswer, SheetsAnswer, SourceChip } from "@/components/marketing/answer-mock";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroAsk } from "@/components/marketing/hero-ask";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ModelsSection } from "@/components/marketing/models-section";
import { OptionCards } from "@/components/marketing/option-cards";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { PillarColumns } from "@/components/marketing/pillar-columns";
import { ShowcaseFrame, type ShowcaseTab } from "@/components/marketing/showcase-frame";
import { StarListSplit } from "@/components/marketing/star-list-split";
import { StatementSplit } from "@/components/marketing/statement-split";
import { ToolsShowcase } from "@/components/marketing/tools-showcase";
import { home } from "@/content/data/home";
import { UPLOAD_LIMITS } from "@/content/data/pricing";
import { graph, organization, softwareApplication, website } from "@/lib/jsonld";
import { listMdx } from "@/lib/mdx";
import { getPage, isPublished } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS, SIGNUP } from "@/lib/site";

export const metadata = pageMetadata("/");

/* ------------------------------------------------------------------ */
/* Showcase panels                                                     */
/* ------------------------------------------------------------------ */

function Panel({
  questions,
  window,
  explore,
}: {
  questions: string[];
  window: React.ReactNode;
  explore: { label: string; href: string };
}) {
  return (
    <div className="relative flex w-full flex-col items-center gap-6 md:gap-8">
      <div className="chips" aria-label="Example questions">
        {questions.map((q, i) => (
          <Chip key={q} active={i === 0} tabIndex={-1} aria-hidden="true" className="pointer-events-none">
            {q}
          </Chip>
        ))}
      </div>
      <div className="w-full max-w-[1000px]">{window}</div>
      <Link href={explore.href} className="btn btn--outline">
        <span>
          {explore.label}
          <ArrowIcon />
        </span>
      </Link>
    </div>
  );
}

const SHOWCASE: ShowcaseTab[] = [
  {
    id: "mongodb",
    label: "MongoDB",
    icon: <Database />,
    panel: (
      <Panel
        questions={["Revenue by month for 2026", "Top 10 customers by order value", "Orders stuck in pending for 7 days"]}
        explore={{ label: "Explore chat with MongoDB", href: "/chat-with-mongodb" }}
        window={
          <MockWindow
            title="Revenue by month, 2026"
            source={
              <>
                <SourceChip logo="/logos/mongodb.svg">shop-prod · orders</SourceChip>
                <span className="hidden rounded-full bg-sf-secondary px-2.5 py-1 text-[11.5px] text-tx-tertiary sm:inline">Gemini</span>
              </>
            }
          >
            <MongoAnswer />
          </MockWindow>
        }
      />
    ),
  },
  {
    id: "sheets",
    label: "Google Sheets",
    icon: <Sheet />,
    panel: (
      <Panel
        questions={["Lowest win rate by stage", "Pipeline value by rep", "Deals closing this month"]}
        explore={{ label: "Explore chat with Google Sheets", href: "/chat-with-google-sheets" }}
        window={
          <MockWindow title="Q3 pipeline win rates" activeChat={2} source={<SourceChip logo="/logos/google-sheets.svg">Q3 pipeline</SourceChip>}>
            <SheetsAnswer />
          </MockWindow>
        }
      />
    ),
  },
  {
    id: "documents",
    label: "Documents",
    icon: <FileText />,
    panel: (
      <Panel
        questions={["Refund window in the vendor agreement", "Every deadline in this contract", "Summarise the termination clause"]}
        explore={{ label: "Explore chat with PDF", href: "/chat-with-pdf" }}
        window={
          <MockWindow title="Vendor refund terms" activeChat={3} source={<SourceChip logo="/logos/pdf.svg">Contracts · 3 files</SourceChip>}>
            <DocsAnswer />
          </MockWindow>
        }
      />
    ),
  },
  {
    id: "charts",
    label: "Charts",
    icon: <ChartColumn />,
    panel: (
      <Panel
        questions={["Signups vs activations, weekly", "Refund rate by plan", "Average order value by city"]}
        explore={{ label: "See every feature", href: "/features" }}
        window={
          <MockWindow title="Signups vs activations" activeChat={1} source={<SourceChip logo="/logos/mongodb.svg">shop-prod · users</SourceChip>}>
            <ChartsAnswer />
          </MockWindow>
        }
      />
    ),
  },
  {
    id: "queries",
    label: "Queries used",
    icon: <Code2 />,
    panel: (
      <Panel
        questions={["Top 5 customers this year", "Which query made this chart?", "Copy the pipeline to mongosh"]}
        explore={{ label: "Read the security model", href: "/security" }}
        window={
          <MockWindow title="Top customers, 2026" activeChat={1} source={<SourceChip logo="/logos/mongodb.svg">shop-prod · orders</SourceChip>}>
            <QueriesAnswer />
          </MockWindow>
        }
      />
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Latest guides                                                       */
/* ------------------------------------------------------------------ */

function latestGuides() {
  try {
    return listMdx("guides")
      .filter((d) => !d.slug.startsWith("_"))
      .filter((d) => {
        const page = getPage(d.path);
        return page ? isPublished(page) : false;
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

function coverFor(slug: string, cover?: string) {
  if (cover) return cover;
  const src = `/images/guides/${slug}.webp`;
  return fs.existsSync(path.join(process.cwd(), "public", src)) ? src : null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const guides = latestGuides();

  return (
    <>
      <JsonLd data={graph(organization(), website(), softwareApplication())} />

      <HeroAsk />

      {/* 3. How it works */}
      <Reveal>
        <HowItWorks />
      </Reveal>

      {/* 3b. Showcase: the full app window (charts, queries used), below the live hero demo */}
      <Reveal as="section" variant="scale" className="showcase" aria-labelledby="showcase-title">
        <div className="showcase__band" aria-hidden="true" />
        <div className="container section relative">
          <div className="section__head">
            <h2 id="showcase-title" className="h-section">
              {"One question.\nEvery source."}
            </h2>
            <p className="intro">
              Ask once and wuup finds the answer in your collections, sheets or documents, then shows you exactly where it came from.
            </p>
          </div>
          <ShowcaseFrame tabs={SHOWCASE} label="Data sources" />
        </div>
      </Reveal>

      {/* 4. Tools */}
      <Reveal>
        <ToolsShowcase />
      </Reveal>

      {/* 5. Statement */}
      <Reveal>
        <StatementSplit />
      </Reveal>

      {/* 6. Star list */}
      <Reveal>
        <StarListSplit
          title={"Safe by default,\nnot by promise"}
          image={{
            src: "/images/home/split-security.webp",
            alt: "A shield above layered blue hills, the wuup read-only guard",
            width: 1080,
            height: 816,
          }}
          items={[
            {
              title: "Read-only, enforced",
              description: `writes, $where, $function and $merge are blocked before anything runs, along with ${FACTS.blockedOperators.length - 3} other risky operators.`,
            },
            {
              title: "Sensitive fields stay hidden",
              description: "passwords, tokens and card numbers are stripped from results, so they never reach the model.",
            },
            {
              title: "Only what you scope",
              description: `wuup reads the collections you pick and nothing else, capped at ${FACTS.maxRowsPerQuery} rows and ${FACTS.queryTimeoutS} seconds per query.`,
            },
          ]}
          cta={{ label: "Read the security model", href: "/security" }}
        />
      </Reveal>

      {/* 7. Pillars */}
      <Reveal>
        <PillarColumns
          title={"One analyst for\nevery kind of data"}
          cta={{ label: "Start free with wuup", href: SIGNUP }}
          pillars={[
            {
              title: "MongoDB",
              body: "Schema-aware, read-only answers from your collections, with every find and aggregate shown.",
              image: { src: "/images/home/pillar-mongodb.webp", alt: "A glass database stack on a deep blue field" },
              accent: "var(--icon-hover-indigo)",
              links: [
                { href: "/chat-with-mongodb", label: "Chat with MongoDB", icon: <Database strokeWidth={1.5} /> },
                { href: "/docs/connect-mongodb", label: "Connect MongoDB", icon: <BookOpen strokeWidth={1.5} /> },
                { href: "/guides/mongodb-aggregation-pipeline-examples", label: "Aggregation examples", icon: <GitBranch strokeWidth={1.5} /> },
                { href: "/guides/mongodb-read-only-user", label: "Create a read-only user", icon: <ShieldCheck strokeWidth={1.5} /> },
              ],
            },
            {
              title: "Google Sheets",
              body: "Share a Sheet with the wuup service account and ask across tabs as if they were tables.",
              image: { src: "/images/home/pillar-sheets.webp", alt: "A glass grid tile on a sky blue field" },
              accent: "var(--icon-hover-orange)",
              links: [
                { href: "/chat-with-google-sheets", label: "Chat with Google Sheets", icon: <Sheet strokeWidth={1.5} /> },
                { href: "/use-cases/finance-reporting-google-sheets", label: "Finance reporting", icon: <Table2 strokeWidth={1.5} /> },
                { href: "/use-cases/sales-pipeline-google-sheets", label: "Sales pipeline", icon: <Layers strokeWidth={1.5} /> },
                { href: "/guides/chat-with-google-sheets-methods", label: "Ways to chat with Sheets", icon: <BookOpen strokeWidth={1.5} /> },
              ],
            },
            {
              title: "Documents",
              body: "PDF and TXT files in a private knowledge base, answered with numbered citations to the page.",
              image: { src: "/images/home/pillar-docs.webp", alt: "A glass stack of documents on a periwinkle field" },
              accent: "var(--icon-hover-green)",
              stats: [
                { label: "file types", value: "PDF, TXT" },
                { label: "citations", value: "numbered" },
                { label: "max file size", value: `${UPLOAD_LIMITS.maxFileMb} MB` },
              ],
              links: [
                { href: "/chat-with-pdf", label: "Chat with PDF", icon: <FileText strokeWidth={1.5} /> },
                { href: "/use-cases/research-pdfs-and-spreadsheets", label: "Research across files", icon: <FileSearch strokeWidth={1.5} /> },
              ],
            },
          ]}
        />
      </Reveal>

      {/* 8. Models */}
      <Reveal>
        <ModelsSection />
      </Reveal>

      {/* 9. Options */}
      <Reveal>
        <OptionCards
          title={"Three ways\nto get started"}
          items={[
            {
              href: "/login?demo=1",
              title: "Try the demo",
              description: "A sandbox with sample data. No signup.",
              tile: "/images/home/tile-sandbox.webp",
            },
            {
              href: SIGNUP,
              title: "Connect MongoDB",
              description: "Paste a URI, pick collections, ask.",
              tile: "/images/home/tile-connect.webp",
            },
            {
              href: SIGNUP,
              title: "Upload a document",
              description: "Drop in a PDF and get cited answers.",
              tile: "/images/home/tile-upload.webp",
            },
          ]}
        />
      </Reveal>

      {/* 10. FAQ */}
      <Reveal>
        <FaqSection items={home.faqs} />
      </Reveal>

      {/* 11. Latest guides */}
      {guides.length ? (
        <Reveal>
          <section className="container section" aria-label="Latest guides">
            <SectionHead title="Latest guides" />
            <Reveal stagger className="post-grid">
              {guides.map((g) => {
                const cover = coverFor(g.slug, g.meta.cover);
                return (
                  <Link key={g.path} href={g.path} className="post-card">
                    <span className="post-card__media relative block bg-[image:var(--gradient-blue-light)]">
                      {cover ? (
                        <Image src={cover} alt="" fill sizes="(min-width: 1024px) 368px, (min-width: 768px) 45vw, 88vw" quality={80} />
                      ) : null}
                    </span>
                    <span>
                      <span className="meta">
                        {fmtDate(g.meta.date)} <span aria-hidden="true">·</span> Guide
                      </span>
                      <span className="post-card__title mt-2">{g.meta.title}</span>
                    </span>
                  </Link>
                );
              })}
            </Reveal>
            <ButtonLink href="/guides" variant="soft">
              View all guides
            </ButtonLink>
          </section>
        </Reveal>
      ) : null}

      {/* 12. CTA */}
      <CtaBand />
      <PageSheetEnd />
    </>
  );
}
