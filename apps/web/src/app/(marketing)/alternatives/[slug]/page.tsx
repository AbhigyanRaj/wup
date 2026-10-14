import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlternativesTemplate } from "@/components/marketing/templates/alternatives-template";
import { alternatives } from "@/content/data/alternatives";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

const BASE = "/alternatives/";
const find = (slug: string) => alternatives.find((p) => p.path === BASE + slug);

export function generateStaticParams() {
  return alternatives.filter((p) => isLive(p.path)).map((p) => ({ slug: p.path.slice(BASE.length) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(BASE + slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = find(slug);
  if (!page || !isLive(page.path)) notFound();
  return <AlternativesTemplate page={page} />;
}
