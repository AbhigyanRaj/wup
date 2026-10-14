/**
 * Header mega menus and footer columns, as paths.
 *
 * Labels and descriptions come from the registry (navLabel, then title), so
 * renaming a page updates the nav. resolveNav() drops links to pages that are
 * not published yet, so this file can list pages before they exist.
 */

import { getPage, getPublishedPages } from "@/lib/registry";
import type { NavLink, NavMenu, FooterColumn, Section } from "./types";

interface NavGroup {
  label: string;
  links: NavLink[];
  /** Append any other published pages of this section after the listed ones. */
  auto?: Section;
}

export const headerNav: NavGroup[] = [
  {
    label: "Product",
    links: [
      { path: "/features" },
      { path: "/security" },
      { path: "/pricing" },
      { path: "/byok" },
      { path: "/changelog" },
      { path: "/chat-with-mongodb" },
      { path: "/chat-with-google-sheets" },
      { path: "/chat-with-pdf" },
    ],
  },
  {
    label: "Use cases",
    links: [
      { path: "/use-cases/product-analytics-mongodb" },
      { path: "/use-cases/ecommerce-orders-mongodb" },
      { path: "/use-cases/support-tickets-mongodb" },
      { path: "/use-cases/finance-reporting-google-sheets" },
      { path: "/use-cases/sales-pipeline-google-sheets" },
      { path: "/use-cases/research-pdfs-and-spreadsheets" },
    ],
    auto: "use-case",
  },
  {
    label: "Resources",
    links: [
      { path: "/docs" },
      { path: "/guides" },
      { path: "/tools" },
      { path: "/compare" },
      { path: "/glossary" },
    ],
  },
];

export const footerNav: NavGroup[] = [
  {
    label: "Product",
    links: [
      { path: "/features" },
      { path: "/security" },
      { path: "/pricing" },
      { path: "/byok" },
      { path: "/changelog" },
    ],
  },
  {
    label: "Connect",
    links: [
      { path: "/chat-with-mongodb" },
      { path: "/chat-with-google-sheets" },
      { path: "/chat-with-pdf" },
    ],
    auto: "integration",
  },
  {
    label: "Free tools",
    links: [{ path: "/tools", label: "All free tools" }],
    auto: "tool",
  },
  {
    label: "Learn",
    links: [
      { path: "/guides" },
      { path: "/docs" },
      { path: "/glossary" },
      { path: "/compare" },
      { path: "/use-cases" },
    ],
  },
  {
    label: "Company",
    links: [
      { path: "/about" },
      { path: "/contact" },
      { path: "/privacy" },
      { path: "/terms" },
    ],
  },
];

export interface ResolvedNavLink {
  path: string;
  label: string;
  description: string;
}

export interface ResolvedNav {
  header: Array<NavMenu & { links: ResolvedNavLink[] }>;
  footer: Array<FooterColumn & { links: ResolvedNavLink[] }>;
}

const warned = new Set<string>();

function resolveGroup(group: NavGroup, published: Set<string>): NavMenu & { links: ResolvedNavLink[] } {
  const links: ResolvedNavLink[] = [];
  const seen = new Set<string>();

  const push = (link: NavLink) => {
    if (seen.has(link.path)) return;
    seen.add(link.path);
    if (!published.has(link.path)) {
      if (process.env.NODE_ENV !== "production" && !warned.has(link.path)) {
        warned.add(link.path);
        console.warn(`[nav] "${group.label}" links to ${link.path}, which is not published. Hidden.`);
      }
      return;
    }
    const page = getPage(link.path);
    links.push({
      path: link.path,
      label: link.label ?? page?.navLabel ?? page?.title ?? link.path,
      description: link.description ?? page?.description ?? "",
    });
  };

  group.links.forEach(push);
  if (group.auto) {
    getPublishedPages()
      .filter((p) => p.section === group.auto)
      .forEach((p) => push({ path: p.path }));
  }
  return { label: group.label, links };
}

/** Nav with unpublished links removed and labels filled from the registry. Never throws. */
export function resolveNav(): ResolvedNav {
  const published = new Set(getPublishedPages().map((p) => p.path));
  return {
    header: headerNav.map((g) => resolveGroup(g, published)),
    footer: footerNav.map((g) => resolveGroup(g, published)),
  };
}
