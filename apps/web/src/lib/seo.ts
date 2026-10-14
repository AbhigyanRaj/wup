/**
 * Metadata helpers.
 *
 * - rootMetadata / rootViewport: export from src/app/layout.tsx. No canonical
 *   here: a root canonical would leak to every page that forgets its own.
 * - pageMetadata(path): export from every marketing page (or its
 *   generateMetadata). Title, description and OG come from the registry.
 * - noindexMetadata: export from app routes (/chat, /login, /settings, ...).
 *
 * openGraph is shallow-replaced by child segments, so pageMetadata always
 * re-spreads the base fields. It never sets openGraph.images: file-based
 * opengraph-image.tsx routes supply them and take precedence.
 */

import type { Metadata, Viewport } from "next";
import { getPage } from "@/lib/registry";
import { getAuthor } from "@/content/authors";
import { SITE, absoluteUrl } from "@/lib/site";

export { absoluteUrl };

export const TITLE_SUFFIX = " | wuup";
export const DEFAULT_TITLE = "wuup: AI Data Analyst for MongoDB, Google Sheets and PDFs";
export const DEFAULT_DESCRIPTION =
  "wuup is an AI data analyst for MongoDB, Google Sheets and PDFs. Ask in plain English, get cited answers with charts and the exact queries used.";

const BASE_OPEN_GRAPH = {
  siteName: SITE.name,
  locale: SITE.locale,
  type: "website",
} as const;

const BASE_TWITTER = {
  card: "summary_large_image",
} as const;

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: DEFAULT_TITLE,
    template: `%s${TITLE_SUFFIX}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE.name,
  authors: [{ name: SITE.founder, url: absoluteUrl("/about") }],
  creator: SITE.founder,
  publisher: SITE.name,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    ...BASE_TWITTER,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const rootViewport: Viewport = {
  themeColor: "#fcfcfc",
  colorScheme: "light",
};

/** For app routes. Pair with the X-Robots-Tag header set in next.config.ts. */
export const noindexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

export interface PageMetadataOverrides extends Metadata {
  /** Plain-string title override (the "%s" part). */
  title?: string;
  description?: string;
}

const ARTICLE_SECTIONS = new Set(["guide", "docs", "changelog"]);
const warnedPaths = new Set<string>();

/**
 * Metadata for a registered page. Lookup is by exact path.
 * Overrides are applied last; an openGraph override is merged, not replaced.
 */
export function pageMetadata(path: string, overrides: PageMetadataOverrides = {}): Metadata {
  const page = getPage(path);
  const { title: titleOverride, description: descOverride, openGraph: ogOverride, ...rest } = overrides;

  const title = titleOverride ?? page?.title ?? DEFAULT_TITLE;
  const description = descOverride ?? page?.description ?? DEFAULT_DESCRIPTION;
  const isHome = path === "/";
  const fullTitle = isHome ? title : `${title}${TITLE_SUFFIX}`;

  if (process.env.NODE_ENV !== "production" && !warnedPaths.has(path)) {
    warnedPaths.add(path);
    if (!page) console.warn(`[seo] ${path} is not in the registry`);
    if (fullTitle.length > 60) console.warn(`[seo] ${path}: title "${fullTitle}" is ${fullTitle.length} chars (max 60)`);
    if (description.length < 110 || description.length > 160)
      console.warn(`[seo] ${path}: description is ${description.length} chars (want 110 to 160)`);
  }

  const isArticle = !!page && ARTICLE_SECTIONS.has(page.section) && !!page.date;
  const openGraph: Metadata["openGraph"] = isArticle
    ? {
        ...BASE_OPEN_GRAPH,
        type: "article",
        title,
        description,
        url: path,
        publishedTime: page!.date,
        modifiedTime: page!.updated,
        authors: [absoluteUrl(getAuthor(page!.author).url)],
        ...(page!.tags?.length ? { tags: page!.tags } : {}),
        ...(ogOverride as object),
      }
    : {
        ...BASE_OPEN_GRAPH,
        title: isHome ? fullTitle : title,
        description,
        url: path,
        ...(ogOverride as object),
      };

  return {
    title: isHome ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph,
    twitter: {
      ...BASE_TWITTER,
      title: isHome ? fullTitle : title,
      description,
    },
    ...rest,
  };
}
