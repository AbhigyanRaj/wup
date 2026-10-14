import { FACTS, PRICING, SIGNUP, shipped } from "@/lib/site";
import type { PricingContent } from "../types";

/**
 * Document upload limits. These mirror the API defaults in
 * apps/api/src/config/env.ts (MAX_UPLOAD_SIZE_MB, UPLOAD_RATE_LIMIT_PER_HOUR).
 * TODO: move into FACTS in src/lib/site.ts.
 */
export const UPLOAD_LIMITS = { maxFileMb: 20, uploadsPerHour: 10 } as const;

const fileTypes = shipped.mdCsvUploads ? "PDF, TXT, MD, CSV" : "PDF, TXT";
const sources = `MongoDB, Google Sheets, ${fileTypes}`;
const exportsValue = shipped.exports ? "Markdown" : "Coming soon";

/** Rows of the "what is included" table on /pricing: Free vs Your key. */
export interface IncludedRow {
  label: string;
  free: string;
  byok: string;
  note?: string;
}

export interface IncludedGroup {
  id: "answers" | "data" | "uploads" | "extras";
  title: string;
  subtitle: string;
  rows: IncludedRow[];
}

export const includedGroups: IncludedGroup[] = [
  {
    id: "answers",
    title: "Answers and models",
    subtitle: "How many questions, and which models answer them",
    rows: [
      { label: "Answers", free: `${FACTS.freeQuestions} questions`, byok: "Unlimited", note: "billed by your provider" },
      { label: "Models", free: "Gemini", byok: "The model you pick" },
      { label: "Providers", free: "Gemini", byok: FACTS.byokProviders.join(", ") },
      { label: "Price from wuup", free: "Free", byok: "Free" },
    ],
  },
  {
    id: "data",
    title: "Data sources and queries",
    subtitle: "The same read-only guard on every plan",
    rows: [
      { label: "Data sources", free: sources, byok: sources },
      { label: "Rows per query", free: `Up to ${FACTS.maxRowsPerQuery}`, byok: `Up to ${FACTS.maxRowsPerQuery}` },
      { label: "Query timeout", free: `${FACTS.queryTimeoutS} seconds`, byok: `${FACTS.queryTimeoutS} seconds` },
      { label: "Result sent to the model", free: `Up to ${FACTS.maxResultKb} KB`, byok: `Up to ${FACTS.maxResultKb} KB` },
    ],
  },
  {
    id: "uploads",
    title: "Document uploads",
    subtitle: "Your private knowledge base",
    rows: [
      { label: "Uploads", free: `${UPLOAD_LIMITS.uploadsPerHour} per hour`, byok: `${UPLOAD_LIMITS.uploadsPerHour} per hour` },
      { label: "File size", free: `${UPLOAD_LIMITS.maxFileMb} MB per file`, byok: `${UPLOAD_LIMITS.maxFileMb} MB per file` },
      { label: "File types", free: fileTypes, byok: fileTypes },
    ],
  },
  {
    id: "extras",
    title: "Web search and exports",
    subtitle: "Extras that work the same on both plans",
    rows: [
      { label: "Web search", free: "Optional, per question", byok: "Optional, per question" },
      { label: "Exports", free: exportsValue, byok: exportsValue },
    ],
  },
];

export const pricing: PricingContent = {
  lead: `Your first ${FACTS.freeQuestions} questions run on Gemini at no cost. After that, add your own AI key and keep asking. wuup adds no fee on top.`,
  tiers: [
    {
      id: "free",
      name: PRICING.free.name,
      price: `${FACTS.freeQuestions} questions on Gemini`,
      summary: "See how wuup handles your own data before you decide anything. No card and no key needed.",
      features: [
        `${FACTS.freeQuestions} questions on Gemini`,
        "MongoDB, Google Sheets and documents",
        "Charts, tables and Queries used",
        "Try the demo before you sign up",
      ],
      cta: { label: "Start free", href: SIGNUP },
    },
    {
      id: "byok",
      name: PRICING.byok.name,
      price: "Unlimited questions",
      summary: "Add an API key from your AI provider. You pick the model and pay the provider directly. wuup charges nothing.",
      features: [
        "Unlimited questions",
        FACTS.byokProviders.join(", "),
        "Pick the model you trust",
        "Key masked in the app, removable any time",
      ],
      cta: { label: "Set up your key", href: "/byok" },
    },
  ],
  faqs: [
    {
      q: `What happens after my ${FACTS.freeQuestions} free questions?`,
      a: "Add your own AI key in Settings and keep going. Your connections, chats and documents stay exactly where they are.",
    },
    {
      q: "Does wuup charge anything when I use my own key?",
      a: "No. Requests go to your provider with your key, and your provider bills you for them. wuup adds no markup and no subscription.",
    },
    {
      q: "Which providers can I use?",
      a: `${FACTS.byokProviders.join(", ")}. OpenRouter gives you access to many more models through a single key.`,
    },
    {
      q: "Are the query limits different on the free plan?",
      a: `No. Every account gets the same read-only guard, up to ${FACTS.maxRowsPerQuery} rows per query and a ${FACTS.queryTimeoutS} second timeout.`,
    },
    {
      q: "Do I need a card to start?",
      a: "No. Sign up with an email and password and start asking. There is nothing to pay wuup on either plan.",
    },
    {
      q: "Can I remove my key later?",
      a: "Yes. Remove it in Settings at any time and wuup stops using it right away. You can also switch to a key from another provider.",
    },
  ],
};
