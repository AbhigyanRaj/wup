import { BookOpen } from "lucide-react";
import { HubTemplate, type HubItem } from "@/components/marketing/templates/hub-template";
import { glossary } from "@/content/data/glossary";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

const PATH = "/glossary";
const FALLBACK = {
  title: "Glossary: MongoDB, RAG and AI data terms",
  description:
    "Plain-English definitions of the terms behind AI data analysis: aggregation pipelines, $lookup, RAG, vector search and text-to-SQL, each with an example.",
};
export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

export default function GlossaryHub() {
  const items: HubItem[] = glossary
    .filter((g) => isLive(g.path))
    .map((g, i) => ({
      path: g.path,
      title: g.term,
      description: g.short,
      chips: ["Definition", "Example"],
      tint: (["indigo", "sky", "violet", "blue"] as const)[i % 4],
      icon: <BookOpen />,
    }));
  return (
    <HubTemplate
      path={PATH}
      eyebrow="Glossary"
      title={"The words behind\nAI data analysis"}
      lead="Short, accurate definitions of the ideas wuup is built on, each with a worked example you can run or read."
      groups={[{ items }]}
      cta={{ title: "From definitions\nto answers.", secondary: { label: "Free tools", href: "/tools" } }}
    />
  );
}
