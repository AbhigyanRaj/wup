import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArticleLayout } from "@/components/marketing/article-layout";
import { crumbsFor, guideCover } from "@/components/marketing/article-utils";
import { blogPosting, breadcrumbList, graph } from "@/lib/jsonld";
import { getMdx, listMdx } from "@/lib/mdx";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return listMdx("guides")
    .filter((d) => isLive(d.path))
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(`/guides/${slug}`);
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getMdx("guides", slug);
  if (!doc || !isLive(doc.path)) notFound();
  const { default: Content } = await import(`@/content/guides/${slug}.mdx`);
  const { meta } = doc;
  const cover = guideCover(slug);

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
            ...(cover ? { image: cover } : {}),
          }),
        )}
      />
      <ArticleLayout doc={doc}>
        <Content />
      </ArticleLayout>
      <PageSheetEnd />
    </>
  );
}
