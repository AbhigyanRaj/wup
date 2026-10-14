import { HubTemplate, type HubItem } from "@/components/marketing/templates/hub-template";
import { publicAssetExists } from "@/components/marketing/templates/use-case-template";
import { useCases } from "@/content/data/use-cases";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

const PATH = "/use-cases";
const FALLBACK = {
  title: "Use cases: ask MongoDB, Sheets and PDFs",
  description:
    "How teams use wuup: product analytics and orders on MongoDB, pipelines and finance in Google Sheets, and research across PDFs, with the queries shown.",
};
export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

export default function UseCasesHub() {
  const items: HubItem[] = useCases
    .filter((u) => isLive(u.path))
    .map((u, i) => ({
      path: u.path,
      title: u.navLabel ?? u.title,
      description: u.summary,
      chips: [u.sources[0].split(":")[0].replace(/ (events|orders|tickets|collection).*$/i, ""), ...u.connectors.map((c) => c.replace("/chat-with-", "").replace("google-sheets", "Sheets").replace("mongodb", "MongoDB").replace("pdf", "PDF"))].slice(0, 3),
      tint: (["indigo", "sky", "violet"] as const)[i % 3],
      cover: publicAssetExists(u.cover) ? u.cover : undefined,
    }));
  return (
    <HubTemplate
      path={PATH}
      eyebrow="Use cases"
      title={"What teams ask\ntheir data"}
      lead="Six jobs wuup does well, each with the questions people ask and what happens behind every answer: the query, the range or the cited passage."
      groups={[{ items }]}
      cta={{ title: "Bring your data.\nAsk the first question.", secondary: { label: "Free tools", href: "/tools" } }}
    />
  );
}
