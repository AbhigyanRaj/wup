import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompareTemplate } from "@/components/marketing/templates/compare-template";
import { comparisons } from "@/content/data/compare";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

const BASE = "/compare/";
const find = (slug: string) => comparisons.find((p) => p.path === BASE + slug);

export function generateStaticParams() {
  return comparisons.filter((p) => isLive(p.path)).map((p) => ({ slug: p.path.slice(BASE.length) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(BASE + slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = find(slug);
  if (!page || !isLive(page.path)) notFound();
  return <CompareTemplate page={page} />;
}
