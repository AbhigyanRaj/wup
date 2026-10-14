import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup glossary";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return ogForPath(`/glossary/${slug}`);
}
