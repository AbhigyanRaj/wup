import type { ComparePage } from "../types";
import { FACTS } from "../../lib/site";

/**
 * Comparison pages: /compare/wuup-vs-<slug>.
 *
 * Competitor facts were checked on 2026-10-14 against the URLs in `sources`.
 * Anything we could not verify from an official page is left out rather than
 * guessed (for example competitor prices that their pricing page did not
 * show to us). Re-verify and bump verifiedOn when editing.
 */

const VERIFIED = "2026-10-14";
const UPDATED = "2026-10-14";

export interface ComparePageFull extends ComparePage {
  /** One-line summary for the index card. */
  summary: string;
}

const base = {
  kind: "compare" as const,
  status: "published" as const,
  updated: UPDATED,
  verifiedOn: VERIFIED,
};

const wuupMongo = { status: "yes" as const, text: "Read-only, schema-aware" };
const wuupSheets = { status: "yes" as const, text: "Live, via service account" };
const wuupDocs = { status: "yes" as const, text: "PDF and TXT" };
const wuupPricing = { status: "yes" as const, text: `${FACTS.freeQuestions} free questions, then your own key at no charge` };

export const comparisons: ComparePageFull[] = [
  {
    ...base,
    path: "/compare/wuup-vs-julius-ai",
    priority: "P1",
    title: "wuup vs Julius AI: which AI data analyst fits?",
    description:
      "wuup vs Julius AI compared: data sources, MongoDB support, how answers are shown and pricing model. A neutral look at when each one is the better choice.",
    h1: "wuup vs Julius AI",
    navLabel: "wuup vs Julius AI",
    summary: "MongoDB and cited documents vs file and SQL-warehouse analysis with Python.",
    primaryKeyword: "julius ai alternative",
    secondaryKeywords: ["wuup vs julius", "julius ai mongodb", "julius ai vs"],
    og: { template: "compare", eyebrow: "Compare", title: "wuup vs Julius AI" },
    related: ["/alternatives/julius-ai", "/chat-with-mongodb", "/compare/wuup-vs-chatgpt-data-analysis"],
    competitor: {
      name: "Julius AI",
      url: "https://julius.ai/",
      summary:
        "Julius is an AI data analyst that writes and runs Python and SQL on uploaded files and connected SQL warehouses to produce charts and analysis.",
    },
    verdict: {
      chooseWuup: [
        "Your data lives in MongoDB and you want answers without exporting it.",
        "You need answers from documents with numbered citations next to your data.",
        "You want a read-only guard and the exact query shown for every number.",
      ],
      chooseThem: [
        "Your data is in CSV or Excel files, or in Postgres, Snowflake or BigQuery.",
        "You want statistical analysis and to read or edit the generated Python.",
        "You need many file formats (Parquet, SPSS, JSON) in one place.",
      ],
    },
    groups: [
      {
        title: "Data sources",
        rows: [
          { label: "MongoDB", wuup: wuupMongo, them: { status: "no", text: "Not in Julius's connector list" } },
          { label: "PostgreSQL, MySQL, Snowflake, BigQuery", wuup: { status: "no", text: "PostgreSQL on the roadmap" }, them: { status: "yes", text: "Database connectors" } },
          { label: "Google Sheets", wuup: wuupSheets, them: { status: "yes", text: "Link or live connection" } },
          { label: "CSV and Excel uploads", wuup: { status: "partial", text: "CSV upload coming soon" }, them: { status: "yes" } },
          { label: "PDF documents", wuup: { status: "yes", text: "With numbered citations" }, them: { status: "yes", text: "Supported file type" } },
        ],
      },
      {
        title: "Answers",
        rows: [
          { label: "Shows the code or query used", wuup: { status: "yes", text: "Queries used, per answer" }, them: { status: "yes", text: "Python and SQL" } },
          { label: "Charts", wuup: { status: "yes", text: "From returned rows" }, them: { status: "yes" } },
          { label: "Runs Python for statistics", wuup: { status: "no" }, them: { status: "yes" } },
        ],
      },
      {
        title: "Pricing model",
        rows: [
          { label: "Free usage", wuup: wuupPricing, them: { status: "yes", text: "Free plan" } },
          { label: "Bring your own model key", wuup: { status: "yes", text: "OpenAI, Anthropic, OpenRouter, Gemini" }, them: { status: "unknown", text: "Not documented" } },
        ],
      },
    ],
    sections: [
      {
        heading: "The short version",
        body: [
          "Julius and wuup both answer data questions in plain English, but they start from different places. Julius is built around files and SQL warehouses and runs Python to analyse them. wuup is built around live MongoDB databases, Google Sheets and documents, and answers with read-only queries and cited passages.",
          "If your data is in MongoDB, Julius's documented connectors don't cover it, and you would export data first. If your data is in spreadsheets or a SQL warehouse and you want deep statistical analysis, Julius has the broader toolset.",
        ],
      },
      {
        heading: "How answers are produced",
        body: [
          "Julius writes code, runs it and shows you the result, and you can expand or edit the code. wuup writes a MongoDB query or reads a sheet range, runs it with row and time limits, and builds charts from the returned rows; the query appears under every answer.",
          "For documents, wuup retrieves passages and cites them by number, which suits contracts, policies and reports where you need to check the source.",
        ],
      },
      {
        heading: "Pricing",
        body: [
          `wuup gives ${FACTS.freeQuestions} free questions on Gemini, and with your own OpenAI, Anthropic, OpenRouter or Gemini key there is no wuup charge. Julius offers a free plan and paid subscriptions; see their pricing page for current prices, which we could not verify on ${VERIFIED}.`,
        ],
      },
    ],
    sources: [
      { label: "Julius: supported files", url: "https://julius.ai/docs/get-started/files" },
      { label: "Julius: data connectors", url: "https://julius.ai/docs/data-connectors/overview" },
      { label: "Julius: chat interface and code", url: "https://julius.ai/docs/get-started/understanding-the-chat-interface" },
      { label: "Julius: pricing", url: "https://julius.ai/pricing" },
    ],
    faqs: [
      { q: "Does Julius AI connect to MongoDB?", a: `MongoDB was not in Julius's documented connector list when we checked on ${VERIFIED}. Check their connectors page for updates.` },
      { q: "Can wuup analyse Excel files?", a: "Not directly today. Open the workbook in Google Sheets and connect it, or wait for CSV uploads, which are being added." },
      { q: "Which is better for a non-technical team?", a: "Both work in plain English. Choose by where the data lives: MongoDB and documents point to wuup; files and SQL warehouses point to Julius." },
    ],
  },
  {
    ...base,
    path: "/compare/wuup-vs-mongodb-compass",
    priority: "P1",
    title: "wuup vs MongoDB Compass for querying in English",
    description:
      "wuup vs MongoDB Compass: natural-language queries, aggregation building, read-only safety and who each is for. A neutral comparison with sources.",
    h1: "wuup vs MongoDB Compass",
    navLabel: "wuup vs MongoDB Compass",
    summary: "Plain-English answers for teams vs MongoDB's free desktop GUI for developers.",
    primaryKeyword: "mongodb compass natural language query",
    secondaryKeywords: ["mongodb compass ai", "compass alternative", "wuup vs compass"],
    og: { template: "compare", eyebrow: "Compare", title: "wuup vs MongoDB Compass" },
    related: ["/chat-with-mongodb", "/tools/mongodb-query-generator", "/compare/wuup-vs-julius-ai"],
    competitor: {
      name: "MongoDB Compass",
      url: "https://www.mongodb.com/products/tools/compass",
      summary:
        "Compass is MongoDB's free desktop GUI for exploring and editing data, with schema analysis, a visual aggregation pipeline builder and opt-in natural-language query generation.",
    },
    verdict: {
      chooseWuup: [
        "People who don't write MongoDB queries need answers, not a query to run.",
        "You want answers as charts and tables, with the query shown.",
        "You want MongoDB, Google Sheets and documents in one chat.",
      ],
      chooseThem: [
        "You are a developer or DBA working directly in MongoDB.",
        "You want a free tool to build and tune queries and pipelines by hand.",
        "You need to edit documents, manage indexes or inspect performance.",
      ],
    },
    groups: [
      {
        title: "Querying",
        rows: [
          { label: "Plain English to query", wuup: { status: "yes" }, them: { status: "yes", text: "Opt-in AI feature, Compass 1.40+" } },
          { label: "Runs the query and answers", wuup: { status: "yes", text: "Answer, chart or table" }, them: { status: "partial", text: "You review the query, then run it" } },
          { label: "Visual aggregation builder", wuup: { status: "no" }, them: { status: "yes", text: "Stage-by-stage preview" } },
          { label: "Schema analysis", wuup: { status: "yes", text: "Automatic on connect" }, them: { status: "yes", text: "Schema tab" } },
        ],
      },
      {
        title: "Safety",
        rows: [
          { label: "Read-only by design", wuup: { status: "yes", text: "Guard blocks writes" }, them: { status: "no", text: "Full editing GUI" } },
          { label: "Sensitive fields redacted from the AI", wuup: { status: "yes" }, them: { status: "partial", text: "Sample values off by default" } },
        ],
      },
      {
        title: "Beyond MongoDB",
        rows: [
          { label: "Google Sheets", wuup: wuupSheets, them: { status: "no" } },
          { label: "PDF documents with citations", wuup: wuupDocs, them: { status: "no" } },
        ],
      },
      {
        title: "Access and price",
        rows: [
          { label: "Where it runs", wuup: { status: "yes", text: "Browser" }, them: { status: "yes", text: "Desktop app" } },
          { label: "Price", wuup: wuupPricing, them: { status: "yes", text: "Free" } },
        ],
      },
    ],
    sections: [
      {
        heading: "Different jobs",
        body: [
          "Compass is a developer tool. It lets you browse collections, edit documents, build aggregation pipelines with a preview at each stage, analyse schema and manage indexes, and it is free. Its natural-language feature turns a prompt into a filter or pipeline that you review and then run yourself.",
          "wuup is an analyst for people who want the answer. It writes the query, runs it read-only with limits, and returns a chart or table, with the query shown so developers can check it.",
        ],
      },
      {
        heading: "AI and your data",
        body: [
          "Compass's natural-language querying is opt-in, labelled experimental in MongoDB's docs, and sends your prompt and schema details to its AI provider; sending sample field values is off by default. wuup sends the model a schema summary with sensitive field names redacted, plus the rows a query returns, and never the connection string.",
        ],
      },
      {
        heading: "Using both",
        body: [
          "Many teams will use both: Compass for development and administration, wuup for questions from the rest of the company. A query wuup shows can be pasted into Compass or mongosh to refine it.",
        ],
      },
    ],
    sources: [
      { label: "MongoDB Compass product page", url: "https://www.mongodb.com/products/tools/compass" },
      { label: "Compass: prompt a natural-language query", url: "https://www.mongodb.com/docs/compass/query-with-natural-language/prompt-natural-language-query/" },
      { label: "Compass: enable natural-language querying", url: "https://www.mongodb.com/docs/compass/query-with-natural-language/enable-natural-language-querying/" },
    ],
    faqs: [
      { q: "Is MongoDB Compass free?", a: "Yes. MongoDB describes Compass as a free GUI, distributed as a desktop application." },
      { q: "Does Compass have AI query generation?", a: "Yes, as an opt-in feature in Compass 1.40 and later: describe what you want and it generates a filter or pipeline for you to review and run." },
      { q: "Can wuup edit my documents like Compass?", a: "No. wuup is read-only on purpose; use Compass or mongosh to change data." },
    ],
  },
  {
    ...base,
    path: "/compare/wuup-vs-notebooklm",
    priority: "P1",
    title: "wuup vs NotebookLM: cited answers compared",
    description:
      "wuup vs Google NotebookLM: both cite sources, but they cover different data. Compare document types, databases, Google Sheets and pricing, with sources.",
    h1: "wuup vs NotebookLM",
    navLabel: "wuup vs NotebookLM",
    summary: "Cited answers over documents and live data vs a research notebook over many document types.",
    primaryKeyword: "notebooklm alternative",
    secondaryKeywords: ["wuup vs notebooklm", "notebooklm for data", "notebooklm database"],
    og: { template: "compare", eyebrow: "Compare", title: "wuup vs NotebookLM" },
    related: ["/chat-with-pdf", "/alternatives/chatpdf", "/use-cases/research-pdfs-and-spreadsheets"],
    competitor: {
      name: "NotebookLM",
      url: "https://notebooklm.google/",
      summary:
        "NotebookLM is Google's source-grounded research notebook: it answers from the documents, slides, videos and pages you add, with inline citations, and can create Audio Overviews.",
    },
    verdict: {
      chooseWuup: [
        "Your questions involve a live MongoDB database or Google Sheets you keep updating.",
        "You want charts and tables computed from real rows.",
        "You want documents and data answered together in one chat.",
      ],
      chooseThem: [
        "You are researching across many documents, slides, web pages or YouTube videos.",
        "You want Audio Overviews and study tools.",
        "You want a generous free tier for document research.",
      ],
    },
    groups: [
      {
        title: "Sources",
        rows: [
          { label: "PDF and text documents", wuup: wuupDocs, them: { status: "yes", text: "PDF, docx, txt, md and more" } },
          { label: "Slides, web URLs, YouTube, audio", wuup: { status: "no" }, them: { status: "yes" } },
          { label: "Google Sheets", wuup: { status: "yes", text: "Live reads of shared sheets" }, them: { status: "yes", text: "Imported as a source" } },
          { label: "MongoDB database", wuup: wuupMongo, them: { status: "no" } },
        ],
      },
      {
        title: "Answers",
        rows: [
          { label: "Citations to passages", wuup: { status: "yes", text: "Numbered" }, them: { status: "yes", text: "Inline, jump to source" } },
          { label: "Charts from data", wuup: { status: "yes", text: "From returned rows" }, them: { status: "no" } },
          { label: "Shows the query used", wuup: { status: "yes" }, them: { status: "no", text: "Not applicable" } },
          { label: "Audio Overviews", wuup: { status: "no" }, them: { status: "yes" } },
        ],
      },
      {
        title: "Pricing model",
        rows: [
          { label: "Free usage", wuup: wuupPricing, them: { status: "yes", text: "Free tier with notebook and source limits" } },
          { label: "Paid plans", wuup: { status: "yes", text: "None needed: bring your own key" }, them: { status: "yes", text: "Through Google AI plans" } },
        ],
      },
    ],
    sections: [
      {
        heading: "Both cite their sources",
        body: [
          "NotebookLM and wuup share an important idea: answers should point back to the source. NotebookLM shows inline citations you can hover and click to see the quoted passage. wuup numbers its citations and lists the document and passage for each.",
        ],
      },
      {
        heading: "Where they differ",
        body: [
          "NotebookLM is broader on documents: slides, web pages, YouTube videos and audio, plus Audio Overviews. wuup is broader on data: it queries a live MongoDB database read-only and reads Google Sheets you share, then builds charts from the rows it gets back, with the query shown.",
          "If your question is \"what do these reports say\", NotebookLM is an excellent fit. If it is \"what do these reports say, and do our numbers agree\", wuup can answer both halves in one place.",
        ],
      },
      {
        heading: "A note on naming",
        body: ["Google's help center now refers to NotebookLM as Gemini Notebook in places, and notebooklm.google redirects to notebook.google. The product described here is the same."],
      },
    ],
    sources: [
      { label: "NotebookLM: supported sources", url: "https://support.google.com/notebooklm/answer/16215270" },
      { label: "NotebookLM: plans and limits", url: "https://support.google.com/notebooklm/answer/16213268" },
      { label: "NotebookLM: citations", url: "https://support.google.com/notebooklm/answer/16179559" },
      { label: "NotebookLM: citations in answers", url: "https://support.google.com/notebooklm/answer/16269187" },
    ],
    faqs: [
      { q: "Can NotebookLM connect to a database?", a: "Not to a live database such as MongoDB. It works from sources you add, including Google Sheets, documents, web pages and videos." },
      { q: "Is NotebookLM free?", a: "There is a free tier with limits on notebooks and sources per notebook, and higher limits through Google AI plans." },
      { q: "Does wuup support Google Slides or YouTube?", a: "No. wuup supports MongoDB, Google Sheets, PDF and TXT today." },
    ],
  },
  {
    ...base,
    path: "/compare/wuup-vs-chatgpt-data-analysis",
    priority: "P1",
    title: "wuup vs ChatGPT data analysis",
    description:
      "wuup vs ChatGPT data analysis: live MongoDB and Sheets vs uploaded files, read-only safety, citations and how answers are checked. A neutral comparison.",
    h1: "wuup vs ChatGPT data analysis",
    navLabel: "wuup vs ChatGPT",
    summary: "Live, read-only queries with citations vs a general assistant that analyses uploaded files.",
    primaryKeyword: "chatgpt data analysis alternative",
    secondaryKeywords: ["chatgpt mongodb", "chatgpt vs wuup", "chatgpt advanced data analysis alternative"],
    og: { template: "compare", eyebrow: "Compare", title: "wuup vs ChatGPT data analysis" },
    related: ["/chat-with-mongodb", "/compare/wuup-vs-julius-ai", "/integrations/openai"],
    competitor: {
      name: "ChatGPT data analysis",
      url: "https://chatgpt.com/",
      summary:
        "ChatGPT's data analysis (formerly Advanced Data Analysis) writes and runs Python in a sandbox to analyse files you upload, and can reach other systems through connectors on some plans.",
    },
    verdict: {
      chooseWuup: [
        "You want to ask a live MongoDB database without exporting files.",
        "You want a read-only guard and the exact query for every number.",
        "You want cited answers across documents and data together.",
      ],
      chooseThem: [
        "You already use ChatGPT and want to analyse exported files ad hoc.",
        "You want Python-based statistics, cleaning and charts on spreadsheets.",
        "You want analysis inside the same assistant you use for writing and other work.",
      ],
    },
    groups: [
      {
        title: "Data",
        rows: [
          { label: "Uploaded spreadsheets (CSV, Excel)", wuup: { status: "partial", text: "CSV upload coming soon" }, them: { status: "yes" } },
          { label: "Live MongoDB", wuup: wuupMongo, them: { status: "partial", text: "Only via a custom connector" } },
          { label: "Live Google Sheets", wuup: wuupSheets, them: { status: "partial", text: "Export or connector" } },
          { label: "PDF documents", wuup: { status: "yes", text: "With numbered citations" }, them: { status: "yes", text: "Upload" } },
        ],
      },
      {
        title: "Answers",
        rows: [
          { label: "Shows code or query", wuup: { status: "yes", text: "Queries used" }, them: { status: "yes", text: "Python" } },
          { label: "Read-only guard on databases", wuup: { status: "yes" }, them: { status: "unknown", text: "Depends on the connector" } },
          { label: "General writing and other tasks", wuup: { status: "no", text: "Focused on your data" }, them: { status: "yes" } },
        ],
      },
      {
        title: "Pricing model",
        rows: [
          { label: "Free usage", wuup: wuupPricing, them: { status: "yes", text: "Free plan with stricter limits" } },
          { label: "Use your own API key", wuup: { status: "yes", text: "Including OpenAI" }, them: { status: "no", text: "Subscription plans" } },
        ],
      },
    ],
    sections: [
      {
        heading: "Files vs live sources",
        body: [
          "ChatGPT's data analysis works on files you upload: it writes Python, runs it in a sandbox without network access and shows the code and results. That is ideal for a spreadsheet export or a one-off dataset.",
          "wuup connects to the source instead: a MongoDB database through a read-only user, Google Sheets through a service account, and documents in a private knowledge base. Questions always run against current data, with the query or range shown.",
        ],
      },
      {
        heading: "Connecting ChatGPT to a database",
        body: [
          "On some plans ChatGPT supports custom connectors built on MCP, which can reach databases. MongoDB is not among OpenAI's built-in connectors, so you would set up and secure a connector yourself. wuup provides MongoDB access with the read-only guard, scoping and redaction built in.",
        ],
      },
      {
        heading: "Use OpenAI models in wuup",
        body: ["If you prefer OpenAI models, add your OpenAI API key to wuup and its questions run on the model you pick, billed by OpenAI, with no wuup charge."],
      },
    ],
    sources: [
      { label: "OpenAI: data analysis with ChatGPT", url: "https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt" },
      { label: "OpenAI: file uploads", url: "https://help.openai.com/en/articles/8555545" },
      { label: "OpenAI: connectors in ChatGPT", url: "https://help.openai.com/en/articles/11487775-connectors-in-chatgpt" },
      { label: "ChatGPT pricing", url: "https://chatgpt.com/pricing" },
    ],
    faqs: [
      { q: "Can ChatGPT query MongoDB directly?", a: "Not out of the box. It can reach databases through custom connectors on some plans, which you build and secure yourself." },
      { q: "Can I use GPT models in wuup?", a: "Yes. Add an OpenAI API key in wuup's settings and pick a model; OpenAI bills you and wuup adds nothing." },
      { q: "Which is better for a quick CSV?", a: "ChatGPT today: wuup's CSV upload is still being added." },
    ],
  },
];

export function getComparison(path: string): ComparePageFull | undefined {
  return comparisons.find((c) => c.path === path);
}
