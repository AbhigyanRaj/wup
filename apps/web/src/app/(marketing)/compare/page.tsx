import { Scale } from "lucide-react";
import { HubTemplate, type HubItem } from "@/components/marketing/templates/hub-template";
import { alternatives } from "@/content/data/alternatives";
import { comparisons } from "@/content/data/compare";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

const PATH = "/compare";
const FALLBACK = {
  title: "wuup compared: Julius AI, Compass, NotebookLM",
  description:
    "Neutral comparisons of wuup with Julius AI, MongoDB Compass, NotebookLM and ChatGPT data analysis, plus alternatives pages, with sources and verification dates.",
};
export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

export default function CompareHub() {
  const compareItems: HubItem[] = comparisons
    .filter((c) => isLive(c.path))
    .map((c, i) => ({
      path: c.path,
      title: c.h1,
      description: c.summary,
      chips: ["Comparison", `Verified ${c.verifiedOn}`],
      tint: (["indigo", "sky", "violet", "blue"] as const)[i % 4],
      icon: <Scale />,
    }));
  const altItems: HubItem[] = alternatives
    .filter((a) => isLive(a.path))
    .map((a, i) => ({
      path: a.path,
      title: a.h1,
      description: a.lead,
      chips: ["Alternatives", `${a.picks.length} picks`],
      tint: (["sky", "violet", "blue"] as const)[i % 3],
      icon: <Scale />,
    }));
  return (
    <HubTemplate
      path={PATH}
      eyebrow="Compare"
      title={"How wuup compares,\nhonestly"}
      lead="Side-by-side comparisons with tools people often consider instead, and when each one is the better choice. Competitor facts come from their own pages, with a verification date on every page."
      groups={[
        { items: compareItems },
        { title: "Looking for alternatives?", intro: "Shortlists chosen by job, not by who paid for placement.", items: altItems },
      ]}
      cta={{ title: "See for yourself.\nIt's free to start.", secondary: { label: "See pricing", href: "/pricing" } }}
    />
  );
}
