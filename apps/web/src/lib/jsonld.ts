/**
 * Typed JSON-LD builders (schema-dts).
 *
 * Usage in a page:
 *   <JsonLd data={graph(breadcrumbList(breadcrumbsFor(path)), techArticle({...}))} />
 *
 * graph() always includes the site-wide Organization (#organization),
 * WebSite (#website) and SoftwareApplication (#app) nodes, so page nodes can
 * reference them by @id. Render one graph per page; do not also render it in
 * the root layout.
 *
 * Deliberately absent: FAQPage and HowTo (Google retired those rich results),
 * SearchAction (no site search) and aggregateRating (no verified reviews).
 */

import type {
  BlogPosting,
  BreadcrumbList,
  Graph,
  Offer,
  Organization,
  Person,
  SoftwareApplication,
  TechArticle,
  Thing,
  WebApplication,
  WebSite,
  WithContext,
} from "schema-dts";
import { getAuthor } from "@/content/authors";
import { FACTS, PRICING, SITE, absoluteUrl } from "@/lib/site";

export const IDS = {
  organization: `${SITE.url}/#organization`,
  website: `${SITE.url}/#website`,
  app: `${SITE.url}/#app`,
  founder: `${SITE.url}/#founder`,
} as const;

const ref = (id: string) => ({ "@id": id });

const APP_DESCRIPTION =
  "AI data analyst. Connect MongoDB (read-only), Google Sheets or PDF and TXT documents, ask questions in plain English, and get cited answers with charts, tables and the queries used.";

export function organization(): Organization {
  return {
    "@type": "Organization",
    "@id": IDS.organization,
    name: SITE.name,
    url: SITE.url,
    logo: {
      "@type": "ImageObject",
      url: `${SITE.url}/icon-512.png`,
      width: "512",
      height: "512",
    },
    email: SITE.email,
    founder: founder(),
    address: { "@type": "PostalAddress", addressCountry: SITE.country },
    ...(SITE.sameAs.length ? { sameAs: [...SITE.sameAs] } : {}),
  };
}

function founder(): Person {
  const author = getAuthor("abhigyan-raj");
  return {
    "@type": "Person",
    "@id": IDS.founder,
    name: SITE.founder,
    url: absoluteUrl(author.url),
    ...(author.jobTitle ? { jobTitle: author.jobTitle } : {}),
    ...(author.sameAs.length ? { sameAs: author.sameAs } : {}),
  };
}

export function website(): WebSite {
  return {
    "@type": "WebSite",
    "@id": IDS.website,
    name: SITE.name,
    alternateName: "wuup.in",
    url: SITE.url,
    inLanguage: "en-IN",
    publisher: ref(IDS.organization),
  };
}

function offers(): Offer[] {
  return [
    {
      "@type": "Offer",
      name: PRICING.free.name,
      price: "0",
      priceCurrency: "INR",
      description: `${FACTS.freeQuestions} questions on Gemini`,
    },
    {
      "@type": "Offer",
      name: PRICING.byok.name,
      price: "0",
      priceCurrency: "INR",
      description: "Pay your AI provider directly",
    },
  ];
}

export function softwareApplication(): SoftwareApplication {
  return {
    "@type": "SoftwareApplication",
    "@id": IDS.app,
    name: SITE.name,
    url: SITE.url,
    description: APP_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: offers(),
    publisher: ref(IDS.organization),
    isPartOf: ref(IDS.website),
  };
}

export interface ToolInput {
  name: string;
  path: string;
  description: string;
}

/** A free browser tool page, e.g. /tools/mongodb-query-generator. */
export function webApplication(tool: ToolInput): WebApplication {
  const url = absoluteUrl(tool.path);
  return {
    "@type": "WebApplication",
    "@id": `${url}#tool`,
    name: tool.name,
    url,
    description: tool.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    publisher: ref(IDS.organization),
    isPartOf: ref(IDS.website),
  };
}

export interface ArticleInput {
  title: string;
  description: string;
  path: string;
  /** ISO publish date. */
  date: string;
  /** ISO modified date. */
  updated?: string;
  /** Author key in src/content/authors.ts. */
  author?: string;
  tags?: string[];
  /** Absolute or site-relative image URL. Defaults to the route's opengraph-image. */
  image?: string;
}

function articleFields(meta: ArticleInput) {
  const url = absoluteUrl(meta.path);
  const author = getAuthor(meta.author);
  return {
    "@id": `${url}#article`,
    headline: meta.title,
    description: meta.description,
    url,
    mainEntityOfPage: url,
    datePublished: meta.date,
    dateModified: meta.updated ?? meta.date,
    inLanguage: "en-IN",
    image: absoluteUrl(meta.image ?? `${meta.path}/opengraph-image`),
    author: {
      "@type": "Person" as const,
      name: author.name,
      url: absoluteUrl(author.url),
      ...(author.sameAs.length ? { sameAs: author.sameAs } : {}),
    },
    publisher: ref(IDS.organization),
    isPartOf: ref(IDS.website),
    ...(meta.tags?.length ? { keywords: meta.tags.join(", ") } : {}),
  };
}

export function blogPosting(meta: ArticleInput): BlogPosting {
  return { "@type": "BlogPosting", ...articleFields(meta) };
}

export function techArticle(meta: ArticleInput): TechArticle {
  return { "@type": "TechArticle", ...articleFields(meta) };
}

export interface CrumbInput {
  name: string;
  path: string;
}

export function breadcrumbList(items: CrumbInput[]): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

const idOf = (node: Thing): string | undefined =>
  typeof node === "object" && node !== null && "@id" in node ? (node["@id"] as string) : undefined;

/**
 * One @graph with the site-wide nodes (#organization, #website, #app) plus
 * the given page nodes. A page node with the same @id replaces the default.
 */
export function graph(...nodes: Thing[]): Graph {
  const extraIds = new Set(nodes.map(idOf).filter(Boolean));
  const base = [organization(), website(), softwareApplication()].filter((n) => !extraIds.has(idOf(n)));
  return {
    "@context": "https://schema.org",
    "@graph": [...base, ...nodes],
  };
}

/** A single node with @context, for when a separate block is needed. */
export function withContext<T extends Thing & object>(node: T): WithContext<T> {
  return { "@context": "https://schema.org", ...node } as WithContext<T>;
}
