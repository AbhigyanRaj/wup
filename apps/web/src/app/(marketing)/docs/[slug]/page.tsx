import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { DocsFeedback } from "@/components/docs/docs-feedback";
import { DocsLayout } from "@/components/docs/docs-layout";
import { docsSequence } from "@/components/docs/docs-nav";
import { DocsPager } from "@/components/docs/docs-pager";
import { PageActions } from "@/components/docs/page-actions";
import { crumbsFor } from "@/components/marketing/article-utils";
import { breadcrumbList, graph, techArticle } from "@/lib/jsonld";
import { getMdx, listMdx, toc } from "@/lib/mdx";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { SIGNUP } from "@/lib/site";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return listMdx("docs")
    .filter((d) => isLive(d.path))
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(`/docs/${slug}`);
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getMdx("docs", slug);
  if (!doc || !isLive(doc.path)) notFound();
  const { default: Content } = await import(`@/content/docs/${slug}.mdx`);
  const { meta } = doc;
  const title = (meta.h1 ?? meta.title).replace(/\n/g, " ");
  const group = meta.group ?? "Docs";

  const seq = docsSequence();
  const i = seq.findIndex((s) => s.path === doc.path);
  const prev = i > 0 ? seq[i - 1] : undefined;
  const next = i >= 0 && i < seq.length - 1 ? seq[i + 1] : undefined;
  const headings = toc(doc.raw).filter((h) => h.depth === 2 || h.depth === 3);

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbList(crumbsFor(doc.path)),
          techArticle({
            title: meta.title,
            description: meta.description,
            path: doc.path,
            date: meta.date,
            updated: meta.updated,
            author: meta.author,
            tags: meta.tags,
          }),
        )}
      />
      <DocsLayout
        currentPath={doc.path}
        title={title}
        section={group}
        crumbs={[{ name: "Docs", path: "/docs" }, { name: group }, { name: title }]}
        actions={<PageActions markdown={`# ${title}\n\n${doc.body.trim()}\n`} appHref={SIGNUP} />}
        toc={headings}
        footer={
          <>
            <DocsFeedback title={title} />
            <DocsPager prev={prev} next={next} />
          </>
        }
      >
        <Content />
      </DocsLayout>
      <PageSheetEnd />
    </>
  );
}
