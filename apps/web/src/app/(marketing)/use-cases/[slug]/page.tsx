import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UseCaseTemplate } from "@/components/marketing/templates/use-case-template";
import { useCases } from "@/content/data/use-cases";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

const BASE = "/use-cases/";
const find = (slug: string) => useCases.find((p) => p.path === BASE + slug);

export function generateStaticParams() {
  return useCases.filter((p) => isLive(p.path)).map((p) => ({ slug: p.path.slice(BASE.length) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(BASE + slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = find(slug);
  if (!page || !isLive(page.path)) notFound();
  return <UseCaseTemplate page={page} />;
}
