import { getPublishedPages } from "@/lib/registry";
import { FACTS, PRICING, SITE, absoluteUrl } from "@/lib/site";
import type { PageEntry, Section } from "@/content/types";

export const dynamic = "force-static";

const GROUPS: Array<{ heading: string; sections: Section[] }> = [
  { heading: "Product", sections: ["core", "feature"] },
  { heading: "Connectors", sections: ["connector", "integration"] },
  { heading: "Use cases", sections: ["use-case"] },
  { heading: "Docs", sections: ["docs"] },
  { heading: "Guides", sections: ["guide"] },
  { heading: "Free tools", sections: ["tool"] },
  { heading: "Comparisons", sections: ["compare", "alternatives"] },
  { heading: "Glossary", sections: ["glossary"] },
  { heading: "Optional", sections: ["changelog", "legal"] },
];

const line = (p: PageEntry) => `- [${p.navLabel ?? p.title}](${absoluteUrl(p.path)}): ${p.description}`;

export function GET() {
  const pages = getPublishedPages();
  const out: string[] = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.name} is an AI data analyst. Connect MongoDB (read-only), Google Sheets or PDF and TXT documents, ask questions in plain English, and get answers with charts and tables built from the real query rows, numbered citations and the exact queries used.`,
    "",
    "Key facts:",
    `- Free tier: ${FACTS.freeQuestions} questions on Gemini. After that, bring your own key (${PRICING.byok.providers.join(", ")}); ${SITE.name} charges nothing and you pay your provider directly.`,
    `- MongoDB access is read-only. A schema-aware query guard blocks operators that write data, run server-side JavaScript or inspect the server (${FACTS.blockedOperators.join(", ")}), and system databases are never queried.`,
    `- Each query returns at most ${FACTS.maxRowsPerQuery} rows and ${FACTS.maxResultKb} KB, with a ${FACTS.queryTimeoutS} second timeout.`,
    `- Fields that look sensitive (password, token, api_key, ssn, card_number and similar) and binary fields are hidden from the AI automatically.`,
    `- Built in India by ${SITE.founder}. Contact: ${SITE.email}`,
  ];

  for (const group of GROUPS) {
    const items = pages
      .filter((p) => group.sections.includes(p.section))
      .sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)));
    if (!items.length) continue;
    out.push("", `## ${group.heading}`, "", ...items.map(line));
  }

  return new Response(out.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
