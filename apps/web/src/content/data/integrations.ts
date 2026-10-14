import type { IntegrationPage } from "../types";
import { FACTS } from "../../lib/site";

/**
 * Bring-your-own-key model providers: /integrations/<provider>.
 * Providers match LLM_PROVIDERS in packages/contracts/src/user.ts.
 */

export interface IntegrationPageFull extends IntegrationPage {
  provider: "openai" | "anthropic" | "openrouter" | "gemini" | "groq";
  /** Where to create a key. */
  keyUrl: string;
  /** The provider's own price list (we link to prices rather than copy them). */
  pricingUrl: string;
  /** Short card summary for the index. */
  summary: string;
  /** Metadata card rows. */
  meta: Array<{ label: string; value: string }>;
  /** Tint for the tile banner. */
  tint: "indigo" | "sky" | "blue" | "periwinkle";
}

const UPDATED = "2026-10-14";

const sharedSteps = (provider: string, where: string): IntegrationPage["steps"] => [
  { title: `Create a ${provider} API key`, body: `Sign in to ${where} and create a new secret key. Give it a name like "wuup" so you can revoke it later.` },
  { title: "Open Settings, then API key", body: "In wuup, open Settings and choose the API key section." },
  { title: `Choose ${provider} and paste the key`, body: "wuup checks the key with the provider before saving it, and shows it masked from then on." },
  { title: "Pick a model and ask", body: "Choose a model from the list for your provider. Questions are no longer counted against the free tier." },
];

const sharedSections = (provider: string): IntegrationPage["sections"] => [
  {
    heading: "What changes when you use your own key",
    body: [
      `Your questions are answered by ${provider} models you choose, billed by ${provider} to your account at their API prices. wuup adds no charge and no markup, and the ${FACTS.freeQuestions}-question free tier limit no longer applies.`,
      "Everything else stays the same: the same read-only guard on MongoDB, the same citations for documents, the same charts built from real rows and the same queries-used panel.",
    ],
  },
  {
    heading: "What is sent to the provider",
    body: [
      "To answer a question, wuup sends the provider your question, the recent chat context, a schema summary of the sources in the chat (with sensitive fields redacted), and the rows or passages a query returned. Your connection strings and the key itself are never sent in a prompt.",
      `Check ${provider}'s API data policy for how they handle API traffic. You can remove your key in Settings at any time to return to the free tier.`,
    ],
  },
];

export const integrations: IntegrationPageFull[] = [
  {
    kind: "integration",
    provider: "openai",
    path: "/integrations/openai",
    title: "Use your OpenAI API key with wuup",
    description:
      "Bring your own OpenAI API key to wuup to ask MongoDB, Google Sheets and PDFs with OpenAI models. Unlimited questions, billed by OpenAI, no wuup markup.",
    h1: "Use your OpenAI key\nwith wuup",
    navLabel: "OpenAI",
    primaryKeyword: "openai api key data analyst",
    secondaryKeywords: ["byok openai", "chat with mongodb openai", "use own openai key"],
    status: "published",
    priority: "P2",
    updated: UPDATED,
    og: { template: "default", eyebrow: "Integration", title: "Use your OpenAI key with wuup" },
    related: ["/integrations/anthropic", "/integrations/groq", "/integrations/openrouter", "/chat-with-mongodb"],
    partner: { name: "OpenAI", url: "https://platform.openai.com/" },
    keyUrl: "https://platform.openai.com/api-keys",
    pricingUrl: "https://openai.com/api/pricing/",
    tint: "indigo",
    summary: "Run wuup on OpenAI models with your own API key, billed by OpenAI.",
    lead:
      "Paste an OpenAI API key into wuup and every question runs on the OpenAI model you pick, billed directly to your OpenAI account. wuup doesn't charge for it, and the free-tier limit goes away.",
    steps: sharedSteps("OpenAI", "the OpenAI platform"),
    connector: "/chat-with-mongodb",
    sections: sharedSections("OpenAI"),
    meta: [
      { label: "Provider", value: "OpenAI" },
      { label: "Type", value: "Model provider (BYOK)" },
      { label: "Billing", value: "Paid to OpenAI" },
      { label: "wuup fee", value: "None" },
      { label: "Works with", value: "MongoDB, Sheets, PDF, TXT" },
    ],
    faqs: [
      { q: "Which OpenAI models can I use?", a: "When you save the key, wuup asks OpenAI which models it can use and shows them in the model menu. Pick one there." },
      { q: "Will wuup charge me when I use my key?", a: "No. You pay OpenAI for API usage; wuup adds nothing on top." },
      { q: "Can I switch back to the free tier?", a: "Yes. Remove the key in Settings and you return to the free Gemini questions you have left." },
    ],
  },
  {
    kind: "integration",
    provider: "anthropic",
    path: "/integrations/anthropic",
    title: "Use your Anthropic (Claude) API key with wuup",
    description:
      "Bring your own Anthropic API key to wuup and ask MongoDB, Google Sheets and PDFs with Claude models. Billed by Anthropic, with no wuup markup or question cap.",
    h1: "Use Claude in wuup\nwith your Anthropic key",
    navLabel: "Anthropic",
    primaryKeyword: "claude api key data analyst",
    secondaryKeywords: ["byok anthropic", "claude for mongodb", "use own claude key"],
    status: "published",
    priority: "P2",
    updated: UPDATED,
    og: { template: "default", eyebrow: "Integration", title: "Use Claude in wuup with your Anthropic key" },
    related: ["/integrations/openai", "/integrations/openrouter", "/chat-with-pdf"],
    partner: { name: "Anthropic", url: "https://www.anthropic.com/" },
    keyUrl: "https://console.anthropic.com/",
    pricingUrl: "https://www.anthropic.com/pricing",
    tint: "periwinkle",
    summary: "Ask your data with Claude models using your own Anthropic key.",
    lead:
      "Add an Anthropic API key and wuup answers with the Claude model you choose, for your databases, sheets and documents alike. Anthropic bills you directly; wuup adds no fee and no question limit.",
    steps: sharedSteps("Anthropic", "the Anthropic Console"),
    connector: "/chat-with-pdf",
    sections: sharedSections("Anthropic"),
    meta: [
      { label: "Provider", value: "Anthropic" },
      { label: "Models", value: "Claude" },
      { label: "Billing", value: "Paid to Anthropic" },
      { label: "wuup fee", value: "None" },
      { label: "Works with", value: "MongoDB, Sheets, PDF, TXT" },
    ],
    faqs: [
      { q: "Which Claude models are available?", a: "When you save the key, wuup asks Anthropic which models it can use and lists them in the model menu." },
      { q: "Is my Anthropic key shared with anyone?", a: "No. It is used only to call Anthropic for your questions and is shown masked in the app." },
      { q: "Do citations still work with Claude?", a: "Yes. Citations, charts and the queries-used panel are produced by wuup and work the same with every provider." },
    ],
  },
  {
    kind: "integration",
    provider: "openrouter",
    path: "/integrations/openrouter",
    title: "Use your OpenRouter key with wuup",
    description:
      "Connect an OpenRouter API key to wuup to choose from many model providers with one key. Ask MongoDB, Sheets and PDFs, billed by OpenRouter, no wuup markup.",
    h1: "Many models, one key:\nOpenRouter in wuup",
    navLabel: "OpenRouter",
    primaryKeyword: "openrouter data analyst",
    secondaryKeywords: ["byok openrouter", "openrouter mongodb", "openrouter api key"],
    status: "published",
    priority: "P2",
    updated: UPDATED,
    og: { template: "default", eyebrow: "Integration", title: "Many models, one key: OpenRouter in wuup" },
    related: ["/integrations/openai", "/integrations/groq", "/integrations/gemini", "/chat-with-google-sheets"],
    partner: { name: "OpenRouter", url: "https://openrouter.ai/" },
    keyUrl: "https://openrouter.ai/keys",
    pricingUrl: "https://openrouter.ai/models",
    tint: "sky",
    summary: "One OpenRouter key gives wuup access to models from many providers.",
    lead:
      "OpenRouter routes one API key to models from many providers. Add your OpenRouter key to wuup to try different models on the same questions, with usage billed by OpenRouter and nothing added by wuup.",
    steps: sharedSteps("OpenRouter", "OpenRouter"),
    connector: "/chat-with-google-sheets",
    sections: sharedSections("OpenRouter"),
    meta: [
      { label: "Provider", value: "OpenRouter" },
      { label: "Models", value: "Many providers" },
      { label: "Billing", value: "Paid to OpenRouter" },
      { label: "wuup fee", value: "None" },
      { label: "Works with", value: "MongoDB, Sheets, PDF, TXT" },
    ],
    faqs: [
      { q: "Can I use any model on OpenRouter?", a: "wuup reads the model list from OpenRouter when you save the key. wuup relies on tool calling, so choose a model that supports tools for the best results." },
      { q: "Why use OpenRouter instead of a direct key?", a: "One key and one bill across providers, which makes it easy to compare models on your own questions." },
      { q: "Does wuup charge for OpenRouter usage?", a: "No. You pay OpenRouter; wuup adds nothing." },
    ],
  },
  {
    kind: "integration",
    provider: "gemini",
    path: "/integrations/gemini",
    title: "Use your Google Gemini API key with wuup",
    description:
      "Use your own Gemini API key with wuup for unlimited questions over MongoDB, Google Sheets and PDFs. Billed by Google, with no markup from wuup.",
    h1: "Keep Gemini, lose the cap:\nyour own Gemini key",
    navLabel: "Gemini",
    primaryKeyword: "gemini api key data analyst",
    secondaryKeywords: ["byok gemini", "gemini mongodb", "google ai studio key"],
    status: "published",
    priority: "P2",
    updated: UPDATED,
    og: { template: "default", eyebrow: "Integration", title: "Use your own Gemini key with wuup" },
    related: ["/integrations/openrouter", "/integrations/groq", "/integrations/openai", "/chat-with-mongodb"],
    partner: { name: "Google Gemini", url: "https://ai.google.dev/" },
    keyUrl: "https://aistudio.google.com/apikey",
    pricingUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    tint: "blue",
    summary: "The free tier runs on Gemini; your own Gemini key removes the question cap.",
    lead: `wuup's free tier gives you ${FACTS.freeQuestions} questions on Gemini. Add your own Gemini API key from Google AI Studio and you keep the same models with no question cap, billed by Google at their API rates.`,
    steps: sharedSteps("Gemini", "Google AI Studio"),
    connector: "/chat-with-mongodb",
    sections: sharedSections("Google"),
    meta: [
      { label: "Provider", value: "Google" },
      { label: "Models", value: "Gemini" },
      { label: "Billing", value: "Paid to Google" },
      { label: "wuup fee", value: "None" },
      { label: "Works with", value: "MongoDB, Sheets, PDF, TXT" },
    ],
    faqs: [
      { q: "Is this different from the free tier?", a: `The free tier uses wuup's own Gemini access and is limited to ${FACTS.freeQuestions} questions. With your key there is no wuup limit; your Google quota applies instead.` },
      { q: "Where do I get a Gemini key?", a: "Create one in Google AI Studio, then paste it into wuup's Settings under API key." },
      { q: "Does wuup charge for it?", a: "No. Google bills your usage; wuup adds nothing." },
    ],
  },
  {
    kind: "integration",
    provider: "groq",
    path: "/integrations/groq",
    title: "Use your Groq API key with wuup",
    description:
      "Bring your own Groq API key to wuup for very fast answers over MongoDB, Google Sheets and PDFs with open models. Billed by Groq, no wuup markup.",
    h1: "Very fast answers:\nyour Groq key in wuup",
    navLabel: "Groq",
    primaryKeyword: "groq api key data analyst",
    secondaryKeywords: ["byok groq", "groq mongodb", "groq llama tool calling"],
    status: "published",
    priority: "P2",
    updated: "2026-10-15",
    og: { template: "default", eyebrow: "Integration", title: "Very fast answers: your Groq key in wuup" },
    related: ["/integrations/openrouter", "/integrations/openai", "/chat-with-mongodb"],
    partner: { name: "Groq", url: "https://groq.com/" },
    keyUrl: "https://console.groq.com/keys",
    pricingUrl: "https://groq.com/pricing",
    tint: "indigo",
    summary: "Very fast open models, like Llama and GPT-OSS, on your own Groq key.",
    lead:
      "Add a Groq API key and wuup answers with open models such as Llama and GPT-OSS, running on Groq's fast inference hardware, so answers stream back quickly. Groq bills you directly; wuup adds no fee and no question limit.",
    steps: sharedSteps("Groq", "the GroqCloud console"),
    connector: "/chat-with-mongodb",
    sections: [
      ...sharedSections("Groq"),
      {
        heading: "Which model Auto picks on Groq",
        body: [
          "When you save the key, wuup asks Groq for its model list and keeps the chat models. Speech, text to speech and safety models are left out, because they can't answer questions about your data.",
          "Auto uses the strongest tool-calling model your key can see, and a small, fast model for chat titles. If Groq rate limits a model, Auto moves on to the next one, and the model menu shows when the limited model is free again.",
        ],
      },
    ],
    meta: [
      { label: "Provider", value: "Groq" },
      { label: "Models", value: "Open models (Llama, GPT-OSS and more)" },
      { label: "Billing", value: "Paid to Groq" },
      { label: "wuup fee", value: "None" },
      { label: "Works with", value: "MongoDB, Sheets, PDF, TXT" },
    ],
    faqs: [
      { q: "Which Groq models can I use?", a: "The chat models your key can see. wuup reads them from Groq when you save the key and lists them in the model menu, with Auto picking the best one for tool calling." },
      { q: "Why is Groq so fast?", a: "Groq runs models on its own inference hardware built for fast token generation, so answers start and finish quickly. Speed varies with the model and with Groq's load." },
      { q: "How much does Groq cost?", a: "Groq bills by tokens at the rates on groq.com/pricing, and its free plan has rate limits. wuup adds nothing on top." },
    ],
  },
];

export function getIntegration(path: string): IntegrationPageFull | undefined {
  return integrations.find((i) => i.path === path);
}
