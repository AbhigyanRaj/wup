import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IntegrationTemplate } from "@/components/marketing/templates/integration-template";
import { integrations } from "@/content/data/integrations";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

const BASE = "/integrations/";
const find = (slug: string) => integrations.find((p) => p.path === BASE + slug);

export function generateStaticParams() {
  return integrations.filter((p) => isLive(p.path)).map((p) => ({ slug: p.path.slice(BASE.length) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(BASE + slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = find(slug);
  if (!page || !isLive(page.path)) notFound();
  return <IntegrationTemplate page={page} />;
}
