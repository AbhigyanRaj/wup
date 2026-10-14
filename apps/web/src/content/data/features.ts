import { FACTS, shipped, type ShippedFlagName } from "@/lib/site";
import type { Accent, FeaturePage } from "../types";

/**
 * /features: the product overview. `howItWorks` drives the stepper band,
 * `featureTour` the scroll-spy tour and `limits` the honest-limits list.
 */

const documentTypes = shipped.mdCsvUploads ? "PDF, TXT, Markdown and CSV" : "PDF and TXT";

export interface FeatureTourItem {
  /** Anchor id, also the scroll-spy key. */
  id: string;
  /** Short label for the sticky nav. */
  nav: string;
  title: string;
  body: string;
  bullets: [string, string, string];
  accent: Accent;
  /** Hidden until this feature ships. */
  requires?: ShippedFlagName;
}

const tour: FeatureTourItem[] = [
  {
    id: "charts",
    nav: "Grounded charts",
    title: "Charts and tables built from your rows.",
    body: "When an answer needs a chart or a table, wuup builds it from the rows your query returned. The model writes the explanation around it. It never types the numbers.",
    bullets: ["Numbers come from rows, not the model", "Chart and table in one answer", `Up to ${FACTS.maxRowsPerQuery} rows per query`],
    accent: "blue",
  },
  {
    id: "queries",
    nav: "Queries used",
    title: "See every query that ran.",
    body: "Each answer lists the queries behind it: the collection, the filter and the pipeline. Copy one into mongosh and run it yourself, so a number is never a matter of trust.",
    bullets: ["Collection, filter and pipeline", "Copy and rerun it yourself", "Read-only find and aggregate"],
    accent: "indigo",
  },
  {
    id: "documents",
    nav: "Cited documents",
    title: "Document answers with numbered citations.",
    body: `Upload ${documentTypes} files to a private knowledge base. Answers quote the passages they used and number each source, so you can open the page and check.`,
    bullets: ["Numbered sources in every answer", `${documentTypes} files`, "Private to your account"],
    accent: "periwinkle",
  },
  {
    id: "clarify",
    nav: "Clarify and follow up",
    title: "It asks before it guesses.",
    body: "If a question could mean two things, wuup asks which one you meant and offers options to pick from. After each answer it suggests follow-ups, so the next question is one click away.",
    bullets: ["Pick an option or type your own", "Suggested follow-ups after answers", "Fewer wrong guesses on vague asks"],
    accent: "sky",
  },
  {
    id: "web",
    nav: "Web search",
    title: "Add outside context when you want it.",
    body: "Turn on web search for a question when your data needs context, such as a definition or a public figure. Web sources are cited like any other source, so you can tell them apart from your data.",
    bullets: ["Optional, per question", "Web sources cited and labelled", "Your data stays the ground truth"],
    accent: "navy",
  },
  {
    id: "research",
    nav: "Research mode",
    title: "Research mode for the bigger questions.",
    body: "For questions that need more than one query, research mode plans the steps, runs them against your sources and writes a cited report you can read top to bottom.",
    bullets: ["A visible step-by-step plan", "Runs across your sources", "Ends in a cited report"],
    accent: "indigo",
    requires: "researchMode",
  },
  {
    id: "byok",
    nav: "Bring your own key",
    title: "Your key, your model, your bill.",
    body: `Start with ${FACTS.freeQuestions} free questions on Gemini. Then add a key from ${FACTS.byokProviders.join(", ")}, pick the model you trust and pay your provider directly.`,
    bullets: [`${FACTS.byokProviders.length} providers supported`, "No fee from wuup on top", "Masked in the app, removable"],
    accent: "blue",
  },
];

/** Tour cards whose feature has shipped. */
export const featureTour: FeatureTourItem[] = tour.filter((t) => !t.requires || shipped[t.requires]);

export const features: FeaturePage[] = [
  {
    kind: "feature",
    path: "/features",
    title: "Features: Ask Your Data, See the Proof",
    description:
      "Every wuup feature in one place: read-only MongoDB, Google Sheets and PDF sources, streamed answers, charts from real rows, citations and the queries used.",
    h1: "An AI analyst that\nshows its work",
    primaryKeyword: "ai data analyst features",
    secondaryKeywords: ["chat with database", "natural language to mongodb", "ai charts from data"],
    status: "published",
    priority: "P0",
    updated: "2026-10-14",
    og: { template: "feature", eyebrow: "Features", title: "An AI analyst that shows its work" },
    related: ["/security", "/pricing", "/byok", "/chat-with-mongodb", "/chat-with-google-sheets"],
    navLabel: "Features",
    lead:
      "wuup is an AI data analyst. Connect MongoDB, Google Sheets or your documents, ask in plain English, and get an answer with a chart or table built from the rows your query returned, plus the query itself.",
    howItWorks: [
      { title: "Connect", body: "Paste a read-only MongoDB URI, share a Google Sheet or upload a document." },
      { title: "Scope", body: "Pick the collections wuup may read. Sensitive fields are hidden automatically." },
      { title: "Ask", body: "Type a question in plain English. The answer streams in as it is written." },
      { title: "Verify", body: "Open Queries used to see exactly what ran, then copy it and check." },
    ],
    points: tour.map((t) => ({ title: t.title, body: t.body, accent: t.accent })),
    faqs: [
      {
        q: "Does wuup make up numbers?",
        a: "Charts and tables are built from the rows your query returned, not typed by the model. The model writes the explanation, and Queries used shows what ran so you can check it.",
      },
      {
        q: "Which data sources can I connect?",
        a: `MongoDB (read-only), Google Sheets through a service account, and ${documentTypes} documents in a private knowledge base. PostgreSQL and MySQL are on the roadmap.`,
      },
      {
        q: "Can wuup change my data?",
        a: `No. wuup only runs find and aggregate, and the query guard blocks ${FACTS.blockedOperators.slice(0, 4).join(", ")} and other write or server-side JavaScript operators.`,
      },
      {
        q: "What happens when my question is vague?",
        a: "wuup asks a clarifying question with options to pick from, or you can type your own answer. It runs the query once the question is clear.",
      },
      {
        q: "Which AI model answers my questions?",
        a: `Your first ${FACTS.freeQuestions} questions run on Gemini. With your own key you can use ${FACTS.byokProviders.join(", ")} and pick the model.`,
      },
    ],
    limits: [
      "Read-only: wuup cannot insert, update or delete data.",
      `Up to ${FACTS.maxRowsPerQuery} rows per query, with a ${FACTS.queryTimeoutS} second timeout.`,
      "MongoDB and Google Sheets today. PostgreSQL and MySQL are on the roadmap.",
    ],
  },
];
