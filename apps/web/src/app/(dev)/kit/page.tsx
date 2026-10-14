import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Copy,
  Database,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sheet,
  Telescope,
  Table2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { Card, MiniCard, OptionCard } from "@/components/ui/card";
import { Checklist, StarList } from "@/components/ui/checklist";
import { Chip, Chips } from "@/components/ui/chip";
import { CodeBlock } from "@/components/ui/code-block";
import { Container } from "@/components/ui/container";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { LinkRow, LinkRows } from "@/components/ui/link-row";
import { Ornament } from "@/components/ui/ornament";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { Eyebrow, Section, SectionHead } from "@/components/ui/section";
import { StatRows } from "@/components/ui/stat-row";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Mark, Wordmark } from "@/components/ui/wordmark";

export const metadata: Metadata = {
  title: "Design kit",
  robots: { index: false, follow: false },
};

/* ---------------------------------------------------------------------------
 * Visual QA gallery of the design-system foundation. Dev only: 404 in production.
 * Interactive primitives (dialog, menu, tabs ...) live at /kit/interactive.
 * ------------------------------------------------------------------------- */

const BUTTON_VARIANTS: ButtonVariant[] = [
  "ink",
  "soft",
  "outline",
  "ghost",
  "danger-soft",
  "auth",
  "auth-primary",
  "hero-primary",
  "hero-outline",
];

const PALETTES: { name: string; steps: string[] }[] = [
  { name: "indigo", steps: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] },
  { name: "blue", steps: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] },
  { name: "sky", steps: ["50", "100", "200", "300", "400", "500", "600", "700"] },
  { name: "green", steps: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] },
  { name: "red", steps: ["50", "100", "200", "300", "400", "500", "600", "700"] },
  { name: "yellow", steps: ["50", "100", "200", "300", "400", "500", "600", "700"] },
  { name: "pink", steps: ["50", "100", "200", "300", "400", "500", "600", "700"] },
  { name: "grey", steps: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] },
];

const ROLE_SWATCHES = [
  "--color-tx",
  "--color-tx-secondary",
  "--color-tx-tertiary",
  "--color-tx-muted",
  "--color-tx-accent",
  "--color-tx-brand",
  "--color-bg",
  "--color-sf-white",
  "--color-sf-secondary",
  "--color-sf-tertiary",
  "--color-sf-quaternary",
  "--color-st",
  "--color-st-secondary",
  "--color-ink",
  "--color-ink-deep",
  "--color-ink-auth",
];

const GRADIENTS = [
  "--gradient-blue-vivid",
  "--gradient-blue-soft",
  "--gradient-blue-pale",
  "--gradient-blue",
  "--gradient-blue-medium",
  "--gradient-blue-light",
  "--gradient-green-medium",
  "--gradient-pink-light",
  "--gradient-cta-dark",
  "--gradient-wordmark",
  "--gradient-btn-primary",
  "--gradient-band-indigo",
];

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-6 border-t border-st-secondary pt-10">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-heading-sub font-display-medium tracking-heading">{title}</h2>
        {note ? <p className="text-caption text-tx-tertiary">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-label uppercase text-tx-tertiary">{children}</p>;
}

function Swatch({ token, label }: { token: string; label?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="h-12 rounded-lg border border-st-secondary" style={{ background: `var(${token})` }} />
      <p className="truncate font-mono text-[11px] leading-tight text-tx-tertiary">{label ?? token}</p>
    </div>
  );
}

const PY_SAMPLE = (
  <>
    <span className="tok-kw">from</span> wuup <span className="tok-kw">import</span> Client{"\n\n"}
    client = Client(api_key=<span className="tok-str">&quot;YOUR_API_KEY&quot;</span>){"\n"}
    answer = client.<span className="tok-fn">ask</span>({"\n"}
    {"    "}source=<span className="tok-str">&quot;orders-db&quot;</span>,{"\n"}
    {"    "}question=<span className="tok-str">&quot;Revenue by region last quarter&quot;</span>,{"\n"}
    {"    "}limit=<span className="tok-const">50</span>,{"\n"}
    ){"\n"}
    <span className="tok-com"># answer.query holds the exact aggregation that ran</span>
  </>
);

const JS_RAW = `import { Wuup } from "wuup";

const wuup = new Wuup({ apiKey: process.env.WUUP_KEY });
const answer = await wuup.ask({
  source: "orders-db",
  question: "Revenue by region last quarter",
});`;

const MONGO_RAW = `db.orders.aggregate([
  { $match: { createdAt: { $gte: ISODate("2026-07-01") } } },
  { $group: { _id: "$region", revenue: { $sum: "$total" } } },
  { $sort: { revenue: -1 } }
])`;

export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main>
      {/* ===== Hero sample: blue sunrise ===== */}
      <section className="hero hero--compact">
        <div className="hero__fade" />
        <div className="hero__gradient" aria-hidden="true" />
        <div className="container hero__content">
          <div className="hero__glow" />
          <Ornament className="hero__ornament" />
          <div className="hero-badge">
            <div className="hero-badge__rule" />
            <p className="hero-badge__text">wuup design kit, blue edition</p>
            <div className="hero-badge__rule" />
          </div>
          <h1 className="h-hero">
            Ask your database
            <br />
            in plain English
          </h1>
          <p className="lead">
            Every primitive in the foundation, rendered in all variants.
            <br className="hidden md:block" /> Compare against the kit screenshots before calling a screen done.
          </p>
          <div className="hero__actions">
            <Button variant="hero-primary">Start free</Button>
            <ButtonLink href="/kit/interactive" variant="hero-outline">
              Interactive kit
            </ButtonLink>
          </div>
        </div>
      </section>

      <Container className="flex flex-col gap-16">
        {/* ===== Colour ===== */}
        <Block id="colour" title="Colour" note="Kit roles, palettes (blue and sky replace orange), gradients and chart series.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {ROLE_SWATCHES.map((t) => (
              <Swatch key={t} token={t} label={t.replace("--color-", "")} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {PALETTES.map((p) => (
              <div key={p.name} className="grid grid-cols-[64px_1fr] items-center gap-3">
                <Label>{p.name}</Label>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${p.steps.length}, minmax(0, 1fr))` }}>
                  {p.steps.map((s) => (
                    <div key={s} className="flex min-w-0 flex-col gap-1">
                      <div className="h-9 rounded-md" style={{ background: `var(--${p.name}-${s})` }} />
                      <span className="hidden font-mono text-[10px] text-tx-tertiary sm:block">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {GRADIENTS.map((g) => (
              <Swatch key={g} token={g} label={g.replace("--gradient-", "")} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label>chart</Label>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="inline-flex items-center gap-2 text-caption text-tx-tertiary">
                <span className="size-3 rounded-full" style={{ background: `var(--chart-${n})` }} />
                chart-{n}
              </span>
            ))}
          </div>
        </Block>

        {/* ===== Type ===== */}
        <Block id="type" title="Typography" note="Newsreader display, Figtree 425 / 525 UI, DM Mono labels and code.">
          <div className="flex flex-col gap-6">
            <div>
              <Label>.h-hero (64 / 44, 380)</Label>
              <p className="h-hero mt-2">Ask your database</p>
            </div>
            <div>
              <Label>.h-section (36 / 28, 450)</Label>
              <p className="h-section mt-2">
                From question to <span className="text-indigo-600">cited answer</span>
              </p>
            </div>
            <div>
              <Label>.h-card (20, 525)</Label>
              <p className="h-card mt-2">Revenue by region, last quarter</p>
            </div>
            <div>
              <Label>.lead (20 / 16, #3d3d3d)</Label>
              <p className="lead mt-2">Connect MongoDB, Google Sheets or PDFs and ask in plain English.</p>
            </div>
            <div>
              <Label>.intro (18 / 16, #666)</Label>
              <p className="intro mt-2">Read-only connections, schema-aware answers and every query shown in full.</p>
            </div>
            <div>
              <Label>.body-muted / .meta / .eyebrow / .label-mono / .link-arrow</Label>
              <p className="body-muted mt-2">Body copy inside cards is #666 at 16px with a 1.6 line height.</p>
              <p className="meta mt-2">
                Oct 14, 2026 <span>·</span> Changelog
              </p>
              <Eyebrow className="mt-3">Teams ask wuup</Eyebrow>
              <p className="label-mono mt-3">Product</p>
              <a href="#type" className="link-arrow mt-3">
                Read the docs <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
            <div>
              <Label>Tailwind: font-display font-display-regular text-heading-hero tracking-hero</Label>
              <p className="mt-2 font-display text-heading-hero-sm font-display-regular tracking-hero md:text-heading-hero">
                Same, via utilities
              </p>
            </div>
          </div>
        </Block>

        {/* ===== Buttons ===== */}
        <Block id="buttons" title="Buttons" note="Pills, min-height 40px, press scale .96. Filled variants show the cursor glow.">
          <div className="flex flex-col gap-5">
            {BUTTON_VARIANTS.map((v) => (
              <div key={v} className="flex flex-wrap items-center gap-3">
                <span className="w-28 shrink-0 font-mono text-[11px] uppercase text-tx-tertiary">{v}</span>
                <Button variant={v} size="sm">
                  Small
                </Button>
                <Button variant={v}>Medium</Button>
                <Button variant={v} size="lg">
                  Large
                </Button>
                <Button variant={v} arrow>
                  With arrow
                </Button>
                <Button variant={v} disabled>
                  Disabled
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-28 shrink-0 font-mono text-[11px] uppercase text-tx-tertiary">icons</span>
              <Button leadingIcon={<Plus className="size-4" aria-hidden="true" />}>New chat</Button>
              <Button variant="soft" leadingIcon={<Database className="size-4" aria-hidden="true" />}>
                Connect source
              </Button>
              <Button variant="danger-soft" leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}>
                Delete source
              </Button>
              <ButtonLink href="#buttons" variant="outline" arrow>
                ButtonLink (next/link)
              </ButtonLink>
            </div>
            <div className="max-w-sm">
              <Button block arrow>
                Block button
              </Button>
            </div>
          </div>
        </Block>

        {/* ===== Icon buttons ===== */}
        <Block id="icon-buttons" title="Icon buttons" note="aria-label is required by the type.">
          <div className="flex flex-col gap-4">
            {(["ghost", "soft", "outline", "ink"] as const).map((v) => (
              <div key={v} className="flex items-center gap-3">
                <span className="w-28 shrink-0 font-mono text-[11px] uppercase text-tx-tertiary">{v}</span>
                <IconButton variant={v} size="sm" aria-label="Search">
                  <Search />
                </IconButton>
                <IconButton variant={v} aria-label="Settings">
                  <Settings />
                </IconButton>
                <IconButton variant={v} size="lg" aria-label="More">
                  <MoreHorizontal />
                </IconButton>
                <IconButton variant={v} aria-label="Copy" disabled>
                  <Copy />
                </IconButton>
              </div>
            ))}
          </div>
        </Block>

        {/* ===== Badges, pills, chips, kbd ===== */}
        <Block id="tags" title="Badges, pills, chips, keys">
          <div className="flex flex-wrap gap-2">
            <Badge tone="indigo">Read-only</Badge>
            <Badge tone="green">Encrypted at rest</Badge>
            <Badge tone="sky">Schema-aware</Badge>
            <Badge tone="pink">Cited answers</Badge>
            <Badge tone="yellow">Audit trail</Badge>
            <Badge tone="red">PII masked</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>Connected</Pill>
            <Pill tone="warning" dot>
              Syncing
            </Pill>
            <Pill tone="error" dot>
              Auth failed
            </Pill>
            <Pill tone="info">Selected</Pill>
            <Pill tone="blue">MongoDB</Pill>
            <Pill tone="neutral">Paused</Pill>
          </div>
          <Chips className="justify-start">
            <Chip active>Revenue</Chip>
            <Chip>Retention</Chip>
            <Chip>Inventory</Chip>
            <Chip>Support tickets</Chip>
          </Chips>
          <div className="flex flex-wrap items-center gap-4 text-caption text-tx-tertiary">
            <span className="inline-flex items-center gap-2">
              Command menu <KbdGroup keys={["⌘", "K"]} />
            </span>
            <span className="inline-flex items-center gap-2">
              Send <Kbd>Enter</Kbd>
            </span>
            <span>
              VisuallyHidden: <VisuallyHidden>this text is for screen readers only</VisuallyHidden>(hidden text here)
            </span>
          </div>
        </Block>

        {/* ===== Cards ===== */}
        <Block id="cards" title="Cards" note="Hairline white cards. Mosaics use an 8px gap.">
          <div className="grid-2">
            <Card>
              <h3 className="h-card">Card (md)</h3>
              <p className="body-muted mt-2.5">White, 1px #f0f0f0 border, radius 12px, padding 32 / 40px.</p>
              <Checklist
                items={["Read-only by default", "Every query shown in full", "Answers cite their rows"]}
              />
            </Card>
            <Card size="lg" hover>
              <h3 className="h-card">Card (lg, hover)</h3>
              <p className="body-muted mt-2.5">Radius 32px, #e6e6e6 border, shadow on hover.</p>
              <StatRows
                className="mt-6"
                items={[
                  { label: "sources connected", value: "3" },
                  { label: "median answer time", value: "4.2s" },
                  { label: "queries cited", value: "100%" },
                ]}
              />
            </Card>
          </div>
          <div className="grid-3">
            <MiniCard
              active
              icon={<Database />}
              title="MongoDB"
              description="Grounded, read-only queries over your collections."
              href="#cards"
            />
            <MiniCard icon={<Sheet />} title="Google Sheets" description="Ask across tabs as if they were one table." />
            <MiniCard icon={<FileText />} title="PDFs" description="Pull figures out of reports and invoices." />
          </div>
          <div className="grid-3 gap-6">
            <OptionCard tile="var(--gradient-blue-soft)" title="Cloud" description="Fully managed, fastest to value" />
            <OptionCard
              tile={<BarChart3 className="size-8 text-blue-700" aria-hidden="true" />}
              title="Dashboards"
              description="Pin any answer as a live chart"
            />
            <OptionCard tile="var(--gradient-green-medium)" title="Self-hosted" description="Your perimeter, your keys" />
          </div>
        </Block>

        {/* ===== Lists ===== */}
        <Block id="lists" title="Lists" note="Star list, link rows (icon tints on hover), stat rows, checklist.">
          <div className="split items-start">
            <StarList
              items={[
                { title: "Grounded in your schema", description: "wuup reads the shape of your data before it writes a query." },
                { title: "Read-only by design", description: "Connections never write, update or delete." },
                { title: "Answers you can audit", description: "Every number links back to the query and rows behind it." },
              ]}
            />
            <div className="flex flex-col gap-8">
              <LinkRows>
                <LinkRow href="#lists" icon={<Database />} label="Connect MongoDB" hoverColor="var(--icon-hover-orange)" />
                <LinkRow href="#lists" icon={<Table2 />} label="Import a Google Sheet" hoverColor="var(--icon-hover-green)" />
                <LinkRow href="#lists" icon={<FileText />} label="Upload PDFs" />
              </LinkRows>
              <StatRows
                items={[
                  { label: "rows scanned", value: "1.2M" },
                  { label: "p50 latency", value: "<4s" },
                ]}
              />
            </div>
          </div>
        </Block>

        {/* ===== Code ===== */}
        <Block id="code" title="Code block" note="Kit chrome: tabs, copy button, plain <pre> that takes pre-highlighted children.">
          <div className="grid-2">
            <CodeBlock
              tabs={[
                { label: "Python", content: PY_SAMPLE },
                { label: "JavaScript", code: JS_RAW },
                { label: "MongoDB", code: MONGO_RAW },
              ]}
            />
            <CodeBlock title="aggregation.js" code={MONGO_RAW} />
          </div>
        </Block>

        {/* ===== Brand ===== */}
        <Block id="brand" title="Wordmark and mark" note="Figtree 700, -0.035em. Swappable for the outlined SVGs later.">
          <div className="flex flex-wrap items-end gap-10">
            <Wordmark />
            <Wordmark size="footer" />
            <Wordmark size={64} />
            <div className="rounded-2xl bg-ink px-6 py-4">
              <Wordmark inverse size={32} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Mark size={24} />
            <Mark />
            <Mark size={48} label="wuup" />
            <Mark size={48} tone="light" />
            <Mark size={48} tone="plain" />
            <Ornament className="h-6 text-tx" />
            <Ornament className="h-8 text-indigo-600" />
          </div>
        </Block>

        {/* ===== Prompt mock ===== */}
        <Block id="prompt" title="Prompt and chips (kit .prompt)">
          <div className="flex flex-col items-center gap-6 rounded-3xl p-6 md:p-12" style={{ background: "linear-gradient(180deg, #f4f7ff 0%, #fff 60%)" }}>
            <Chips>
              <Chip active>Research</Chip>
              <Chip>Data analysis</Chip>
              <Chip>Charts</Chip>
            </Chips>
            <div className="prompt">
              <div className="prompt__inner">
                <p className="prompt__text">Which regions grew fastest last quarter, and why?</p>
                <div className="prompt__meta">
                  <Plus className="size-3.5" aria-hidden="true" /> Using <span className="prompt__tag">orders-db</span>
                  <span className="prompt__tag">Q3 forecast.pdf</span>
                </div>
              </div>
            </div>
            <Button variant="outline" arrow>
              Explore the workspace
            </Button>
          </div>
        </Block>

        {/* ===== Reveal ===== */}
        <Block id="reveal" title="Reveal" note="md+ only, threshold .15, 800ms. Reduced motion shows content at once.">
          <Reveal className="card">
            <h3 className="h-card">Fade up (default)</h3>
            <p className="body-muted mt-2">opacity 0 to 1, translateY 24px.</p>
          </Reveal>
          <Reveal variant="scale" className="card">
            <h3 className="h-card">Scale</h3>
            <p className="body-muted mt-2">scale .96 + 20px, 1s.</p>
          </Reveal>
          <Reveal stagger className="grid-3">
            {[Telescope, Filter, BarChart3].map((Icon, i) => (
              <MiniCard key={i} icon={<Icon />} title={`Stagger child ${i + 1}`} description="120ms apart." />
            ))}
          </Reveal>
        </Block>

        {/* ===== Section head ===== */}
        <Block id="section" title="Section and SectionHead">
          <Section container={false} className="rounded-3xl border border-st-secondary bg-sf-white py-16">
            <SectionHead
              eyebrow="How it works"
              title={"Built to answer\nthe questions you actually ask"}
              intro="Connect a source, ask in plain English, then check the query behind every number."
            >
              <div className="mt-2 flex gap-3">
                <Button>Start free</Button>
                <Button variant="soft">Book a demo</Button>
              </div>
            </SectionHead>
          </Section>
          <SectionHead align="left" title={"Left-aligned head\nfor app pages"} intro='align="left"' />
        </Block>
      </Container>

      {/* ===== CTA band ===== */}
      <section className="container mt-24">
        <div className="cta-band">
          <div className="cta-band__inner">
            <div className="cta-band__noise" />
            <div className="cta-band__rings" />
            <div className="cta-band__title">
              <p>Stop writing queries.</p>
              <p>Start asking wuup.</p>
            </div>
            <Ornament className="relative h-7 text-white opacity-85" />
            <Button className="relative">Sign up</Button>
          </div>
        </div>
      </section>

      <section className="mt-24 overflow-hidden">
        <p className="mb-8 text-center text-caption text-tx-tertiary">
          .footer-giant with the wordmark gradient fallback.{" "}
          <Link href="/" className="text-indigo-800 hover:text-indigo-900">
            Back home
          </Link>
        </p>
        <div className="container" style={{ width: "92%" }}>
          <div className="footer-giant" aria-hidden="true">
            wuup
          </div>
        </div>
      </section>
    </main>
  );
}
