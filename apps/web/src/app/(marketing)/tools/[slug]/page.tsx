import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolTemplate } from "@/components/marketing/templates/tool-template";
import { getTool, tools } from "@/content/data/tools";
import { isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return tools.filter((t) => isLive(t.path)).map((t) => ({ slug: t.tool }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(`/tools/${slug}`);
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getTool(slug);
  if (!page || !isLive(page.path)) notFound();
  return <ToolTemplate page={page} />;
}
