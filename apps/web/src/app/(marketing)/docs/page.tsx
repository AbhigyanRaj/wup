import Link from "next/link";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { DocsLayout } from "@/components/docs/docs-layout";
import { getDocsNav } from "@/components/docs/docs-nav";
import { crumbsFor } from "@/components/marketing/article-utils";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { getPage } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS } from "@/lib/site";

/*
 * Docs hub: the docs shell with link cards per group (docs.md 2.4):
 * white, radius 16, #f0f0f0 hairline, 24px padding, 16px/600 title and a
 * muted description; incomplete rows stay left-aligned.
 */

const PATH = "/docs";
const FALLBACK = {
  title: "Docs: connect MongoDB, Sheets and documents",
  description:
    "How to set up wuup: connect MongoDB read-only, choose scopes and hidden fields, share a Google Sheet, upload PDFs, add your own AI key and fix common errors.",
};

export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

const GROUP_INTRO: Record<string, string> = {
  "Get started": "Create an account, ask a first question and learn what wuup can and cannot do.",
  "Connect data": "Bring in MongoDB, Google Sheets and documents, and decide exactly what the AI may read.",
  Models: "Use the free tier or bring your own key from a model provider.",
  Features: "Longer, multi-step answers.",
  Help: "Fixes for the errors people hit most often.",
};

export default function DocsHub() {
  const groups = getDocsNav();
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(PATH)))} />
      <DocsLayout
        bare
        currentPath={PATH}
        title="wuup documentation"
        crumbs={[{ name: "Docs", path: PATH }, { name: "Overview" }]}
        lede={
          <p>
            wuup answers questions about your MongoDB, Google Sheets and documents in plain English. It runs read-only
            queries (at most {FACTS.maxRowsPerQuery} rows and {FACTS.queryTimeoutS} seconds each), shows the query it ran,
            and builds charts from the rows that came back. These pages cover setup, privacy controls and fixes.
          </p>
        }
      >
        <div className="flex flex-col gap-12">
          {groups.map((g) => (
            <section key={g.label} aria-labelledby={`group-${g.label.replace(/\s+/g, "-").toLowerCase()}`}>
              <h2 id={`group-${g.label.replace(/\s+/g, "-").toLowerCase()}`} className="mb-1 text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] text-tx md:text-heading-3">
                {g.label}
              </h2>
              {GROUP_INTRO[g.label] ? <p className="mb-5 text-body leading-[1.65] text-tx-tertiary">{GROUP_INTRO[g.label]}</p> : null}
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {g.items.map((item) => (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className="flex h-full flex-col gap-1 rounded-card border border-st-secondary bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-300 ease-standard hover:border-st hover:shadow-card-hover"
                    >
                      <span className="text-body leading-6 font-semibold text-tx">{item.label}</span>
                      <span className="line-clamp-3 text-caption leading-[1.6] text-tx-tertiary">{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DocsLayout>
      <PageSheetEnd />
    </>
  );
}
