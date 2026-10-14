/**
 * Content model for the public marketing site.
 *
 * Every indexable page is described by data (src/content/data/*.ts) or by an
 * MDX file (src/content/<dir>/*.mdx). The registry (src/lib/registry.ts)
 * flattens both into PageEntry rows, which drive metadata, the sitemap,
 * llms.txt, navigation, breadcrumbs and related links.
 *
 * Length rules (checked in dev by src/lib/seo.ts and src/lib/registry.ts):
 *   - title: the "%s" part of "%s | wuup", at most 52 characters
 *   - description: 110 to 160 characters
 */

import type { LaunchPriority, ShippedFlagName } from "@/lib/site";

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** draft: work in progress. review: written, awaiting fact check. published: live. */
export type Status = "draft" | "review" | "published";
export type Priority = LaunchPriority;
/** A key of `shipped` in src/lib/site.ts. */
export type ShippedFlag = ShippedFlagName;

export type OgTemplate =
  | "default"
  | "connector"
  | "tool"
  | "guide"
  | "docs"
  | "compare"
  | "use-case"
  | "glossary"
  | "feature"
  | "legal";

export interface OgSpec {
  template: OgTemplate;
  /** Short uppercase label above the title, e.g. "Free tool". */
  eyebrow: string;
  /** Defaults to the page h1 (or title) when omitted. */
  title?: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Step {
  title: string;
  body: string;
}

export interface Fact {
  /** The number or short claim, e.g. "100 rows". */
  value: string;
  label: string;
}

export interface LinkRef {
  label: string;
  url: string;
}

export interface PageBase {
  /** Absolute site path, no trailing slash, e.g. "/chat-with-mongodb". */
  path: string;
  /** The "%s" part of the title template. At most 52 characters. */
  title: string;
  /** Meta description, 110 to 160 characters. */
  description: string;
  /** Visible h1. Use "\n" to force a line break. */
  h1: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  status: Status;
  priority: Priority;
  /** ISO date (YYYY-MM-DD) of the last meaningful edit. */
  updated: string;
  /** Hide the page until this feature ships. */
  requires?: ShippedFlag;
  og: OgSpec;
  /** Paths of related pages, most relevant first. */
  related: string[];
  /** Visible FAQs. Rendered as HTML only: no FAQPage schema. */
  faqs?: Faq[];
  /** Short label used in nav menus and breadcrumbs. */
  navLabel?: string;
}

/** Screenshot or illustration. `src` is under /public. */
export interface Shot {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}

export type Accent = "blue" | "sky" | "indigo" | "periwinkle" | "navy";

export interface TourItem {
  title: string;
  body: string;
  shot?: Shot;
  accent?: Accent;
}

export interface ProseSection {
  heading: string;
  /** Paragraphs. Plain text; the renderer decides styling. */
  body: string[];
}

/* ------------------------------------------------------------------ */
/* Core pages (home, pricing, security, about, index pages)            */
/* ------------------------------------------------------------------ */

export interface CorePage extends PageBase {
  kind: "core";
}

/* ------------------------------------------------------------------ */
/* Connectors: /chat-with-mongodb, /chat-with-google-sheets, /chat-with-pdf */
/* ------------------------------------------------------------------ */

export type ConnectorSource = "mongodb" | "google-sheets" | "pdf";

export interface ConnectorPage extends PageBase {
  kind: "connector";
  source: ConnectorSource;
  /** Small label next to the h1, e.g. "Read-only". */
  badge: string;
  lead: string;
  steps: Step[];
  /** Exactly three verified facts. Prefer values from FACTS in src/lib/site.ts. */
  facts: [Fact, Fact, Fact];
  /** Eight example questions. */
  exampleQuestions: string[];
  tour: TourItem[];
  trust: Step[];
  /** Honest limits of the connector. */
  limits: string[];
}

/* ------------------------------------------------------------------ */
/* Free tools: /tools/<id>                                             */
/* ------------------------------------------------------------------ */

export interface ToolExample {
  id: string;
  title: string;
  /** Key into sample-datasets.ts. */
  dataset: string;
  question: string;
  output: {
    kind: "find" | "aggregate";
    code: string;
  };
  explanation: string[];
  resultPreview?: {
    columns: string[];
    rows: Array<Array<string | number | boolean | null>>;
  };
}

export interface ToolPage extends PageBase {
  kind: "tool";
  /** Stable id used by the tool UI, e.g. "mongodb-query-generator". */
  tool: string;
  lead: string;
  /** At least ten examples. */
  examples: ToolExample[];
  howItWorks: Step[];
  wontDo: string[];
  /** Paths of guides to link. */
  guides: string[];
  /** Path of the matching connector page. */
  connector: string;
}

/* ------------------------------------------------------------------ */
/* Comparisons: /compare/<slug>                                        */
/* ------------------------------------------------------------------ */

export interface CompareCell {
  status: "yes" | "no" | "partial" | "unknown";
  /** Short qualifier shown next to the icon. */
  text?: string;
  note?: string;
}

export interface CompareRow {
  label: string;
  wuup: CompareCell;
  them: CompareCell;
}

export interface CompareGroup {
  title: string;
  rows: CompareRow[];
}

export interface ComparePage extends PageBase {
  kind: "compare";
  competitor: {
    name: string;
    url: string;
    summary: string;
  };
  /** ISO date the competitor facts were last checked. */
  verifiedOn: string;
  verdict: {
    chooseWuup: string[];
    chooseThem: string[];
  };
  groups: CompareGroup[];
  sections: ProseSection[];
  sources: LinkRef[];
}

export interface AlternativePick {
  name: string;
  url: string;
  bestFor: string;
  summary: string;
  /** Path of a /compare page when one exists. */
  comparePath?: string;
}

export interface AlternativesPage extends PageBase {
  kind: "alternatives";
  target: {
    name: string;
    url: string;
  };
  lead: string;
  verifiedOn: string;
  criteria: string[];
  picks: AlternativePick[];
  sections: ProseSection[];
  sources: LinkRef[];
}

/* ------------------------------------------------------------------ */
/* Use cases, features, integrations, glossary                         */
/* ------------------------------------------------------------------ */

export interface UseCasePage extends PageBase {
  kind: "use-case";
  persona: string;
  lead: string;
  problems: string[];
  workflow: Step[];
  exampleQuestions: string[];
  /** Connector paths that fit this use case. */
  connectors: string[];
  tour?: TourItem[];
  outcomes: string[];
}

export interface FeaturePage extends PageBase {
  kind: "feature";
  lead: string;
  points: TourItem[];
  howItWorks?: Step[];
  limits?: string[];
}

export interface IntegrationPage extends PageBase {
  kind: "integration";
  partner: {
    name: string;
    url: string;
  };
  lead: string;
  steps: Step[];
  /** Path of the matching connector page. */
  connector: string;
  sections: ProseSection[];
}

export interface GlossaryTerm extends PageBase {
  kind: "glossary";
  term: string;
  /** One-sentence definition, shown first and in llms.txt. */
  short: string;
  body: string[];
  example?: {
    language: string;
    code: string;
  };
  seeAlso: string[];
}

export type DataPage =
  | CorePage
  | ConnectorPage
  | ToolPage
  | ComparePage
  | AlternativesPage
  | UseCasePage
  | FeaturePage
  | IntegrationPage
  | GlossaryTerm;

/* ------------------------------------------------------------------ */
/* Supporting data (not pages on their own)                            */
/* ------------------------------------------------------------------ */

export interface FaqGroup {
  id: string;
  title: string;
  items: Faq[];
}

export interface HomeContent {
  eyebrow: string;
  lead: string;
  tour: TourItem[];
  exampleQuestions: string[];
  faqs: Faq[];
}

export interface PricingTier {
  id: "free" | "byok";
  name: string;
  price: string;
  summary: string;
  features: string[];
  cta: { label: string; href: string };
}

export interface PricingContent {
  lead: string;
  tiers: PricingTier[];
  faqs: Faq[];
}

export interface SampleDataset {
  id: string;
  name: string;
  collection: string;
  description: string;
  /** A few representative documents, as JSON-compatible values. */
  sample: Array<Record<string, unknown>>;
}

export interface MongoStage {
  /** e.g. "$group". */
  name: string;
  summary: string;
  example: string;
  /** Whether the wuup guard allows it. */
  allowed: boolean;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* MDX content: guides, docs, changelog, legal                         */
/* ------------------------------------------------------------------ */

export type MdxDir = "guides" | "docs" | "changelog" | "legal";

/**
 * Declared in each .mdx file as `export const metadata = { ... }`.
 * Must be a plain object literal (strings, numbers, booleans, arrays,
 * objects). It is parsed with JSON5, so no expressions or imports.
 */
export interface MdxMeta {
  title: string;
  description: string;
  h1?: string;
  /** ISO publish date. */
  date: string;
  /** ISO date of the last meaningful edit. */
  updated?: string;
  /** Key into src/content/authors.ts. */
  author: string;
  tags: string[];
  cover?: string;
  primaryKeyword: string;
  status: Status;
  priority: Priority;
  /** Sort order within a docs group. */
  order?: number;
  /** Docs sidebar group. */
  group?: string;
  related?: string[];
  requires?: ShippedFlag;
  og?: Partial<OgSpec>;
  navLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export type Section =
  | "core"
  | "feature"
  | "connector"
  | "tool"
  | "guide"
  | "docs"
  | "changelog"
  | "legal"
  | "compare"
  | "alternatives"
  | "use-case"
  | "glossary"
  | "integration";

export interface PageEntry {
  path: string;
  title: string;
  description: string;
  section: Section;
  status: Status;
  priority: Priority;
  /** ISO date. */
  updated: string;
  og: OgSpec;
  related: string[];
  navLabel?: string;
  h1?: string;
  requires?: ShippedFlag;
  primaryKeyword?: string;
  /** ISO publish date (MDX content). */
  date?: string;
  /** Author key (MDX content). */
  author?: string;
  tags?: string[];
  /** MDX source file, relative to src/content. */
  source?: string;
}

export interface Author {
  name: string;
  url: string;
  sameAs: string[];
  jobTitle?: string;
}

export interface NavLink {
  path: string;
  /** Overrides the registry navLabel/title. */
  label?: string;
  description?: string;
}

export interface NavMenu {
  label: string;
  links: NavLink[];
}

export interface FooterColumn {
  label: string;
  links: NavLink[];
}
