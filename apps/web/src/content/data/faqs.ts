import { FACTS } from "@/lib/site";
import type { FaqGroup } from "../types";

/** FAQ groups for the core pages (security, byok). Home and pricing FAQs live in home.ts and pricing.ts. */
export const faqGroups: FaqGroup[] = [
  {
    id: "security",
    title: "Security questions",
    items: [
      {
        q: "Can wuup write to my database?",
        a: `No. The query guard rejects any pipeline that uses ${FACTS.blockedOperators.join(", ")}. wuup only calls find and aggregate. A read-only database user adds a second lock that does not depend on wuup.`,
      },
      {
        q: "Which fields are hidden from the model?",
        a: `Any field whose name matches ${FACTS.redactedFieldPatterns.slice(0, 8).join(", ")} and similar patterns is removed at every depth before results reach the model. Binary fields, such as embeddings, are hidden too.`,
      },
      {
        q: "How is my connection string stored?",
        a: "Connection details are encrypted with AES-256-GCM before they are written to the database, and decrypted only when a query runs.",
      },
      {
        q: "Can wuup read collections I did not pick?",
        a: `No. Queries can only target the collections you scope. Stages that reach other collections, such as ${FACTS.crossCollectionStages.join(", ")}, must point at an in-scope collection in the same database. The ${FACTS.systemDatabases.join(", ")} databases are never queryable.`,
      },
    ],
  },
  {
    id: "byok",
    title: "Bring your own key",
    items: [
      {
        q: "Where do I get an API key?",
        a: "From your provider's console: OpenAI, Anthropic, OpenRouter, Google AI Studio for Gemini, or the GroqCloud console for Groq. Create a key, then paste it into wuup under Settings.",
      },
      {
        q: "Who pays for the questions?",
        a: "Your provider bills you directly for the tokens your questions use. wuup does not charge for using your own key.",
      },
      {
        q: "Can other people see my key?",
        a: "No. After you save it, the app only shows a masked version, and the key is used only for your own questions.",
      },
      {
        q: "Can I switch providers?",
        a: "Yes. Replace the key with one from another provider, or remove it to go back to the free questions you have left.",
      },
    ],
  },
];

export const getFaqGroup = (id: string) => faqGroups.find((g) => g.id === id);
