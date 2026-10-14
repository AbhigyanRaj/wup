import { Braces, FileJson, Layers, Repeat, Search } from "lucide-react";
import { HubTemplate, type HubItem } from "@/components/marketing/templates/hub-template";
import { tools } from "@/content/data/tools";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

const PATH = "/tools";
const FALLBACK = {
  title: "Free MongoDB tools: queries, pipelines, schema",
  description:
    "Free MongoDB tools from wuup: generate queries and aggregation pipelines from plain English, explain pipelines, convert SQL and infer schemas. No signup.",
};
export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

const ICONS: Record<string, React.ReactNode> = {
  "mongodb-query-generator": <Search />,
  "mongodb-aggregation-generator": <Layers />,
  "mongodb-aggregation-explainer": <Braces />,
  "sql-to-mongodb-converter": <Repeat />,
  "mongodb-schema-from-json": <FileJson />,
};
const TINTS = ["indigo", "sky", "violet", "blue", "indigo"] as const;

export default function ToolsHub() {
  const items: HubItem[] = tools
    .filter((t) => isLive(t.path))
    .map((t, i) => ({
      path: t.path,
      title: t.navLabel ?? t.h1,
      description: t.summary,
      chips: [t.usesModel ? "AI" : "In your browser", `${t.examples.length} examples`, "Free"],
      tint: TINTS[i % TINTS.length],
      icon: ICONS[t.tool],
    }));
  return (
    <HubTemplate
      path={PATH}
      eyebrow="Free tools"
      title={"Free MongoDB tools,\nno signup"}
      lead="Write queries and aggregation pipelines from plain English, read any pipeline stage by stage, convert SQL, and infer a schema from documents. Every output is read-only, and every example was run against real sample data."
      groups={[{ items }]}
      cta={{ title: "Want the answer,\nnot just the query?", secondary: { label: "Chat with MongoDB", href: "/chat-with-mongodb" } }}
    />
  );
}
