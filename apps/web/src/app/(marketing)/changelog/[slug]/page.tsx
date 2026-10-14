import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArticleLayout } from "@/components/marketing/article-layout";
import { crumbsFor } from "@/components/marketing/article-utils";
import { blogPosting, breadcrumbList, graph } from "@/lib/jsonld";
import { getMdx, listMdx } from "@/lib/mdx";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return listMdx("changelog")
    .filter((d) => isLive(d.path))
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(`/changelog/${slug}`);
}

export default async function ChangelogEntryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getMdx("changelog", slug);
  if (!doc || !isLive(doc.path)) notFound();
  const { default: Content } = await import(`@/content/changelog/${slug}.mdx`);
  const { meta } = doc;
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbList(crumbsFor(doc.path)),
          blogPosting({
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
      <ArticleLayout doc={doc} variant="changelog">
        <Content />
      </ArticleLayout>
      <PageSheetEnd />
    </>
  );
}
