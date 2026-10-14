import type { AlternativesPage } from "../types";
import { FACTS } from "../../lib/site";

/**
 * Alternatives pages: /alternatives/<slug>.
 * Third-party facts checked on 2026-10-14 against `sources`. Prices are only
 * quoted where the vendor's own pricing page showed them to us.
 */

const VERIFIED = "2026-10-14";
const UPDATED = "2026-10-14";

const base = {
  kind: "alternatives" as const,
  status: "published" as const,
  updated: UPDATED,
  verifiedOn: VERIFIED,
};

const wuupPick = (bestFor: string, summary: string, comparePath?: string) => ({
  name: "wuup",
  url: "https://wuup.in",
  bestFor,
  summary,
  ...(comparePath ? { comparePath } : {}),
});

export const alternatives: AlternativesPage[] = [
  {
    ...base,
    path: "/alternatives/julius-ai",
    priority: "P1",
    title: "Julius AI alternatives for data questions",
    description:
      "Looking for a Julius AI alternative? Compare wuup, ChatGPT data analysis, Hex and MongoDB Compass by data sources, MongoDB support, citations and pricing.",
    h1: "Julius AI alternatives",
    navLabel: "Julius AI alternatives",
    primaryKeyword: "julius ai alternatives",
    secondaryKeywords: ["tools like julius ai", "julius ai competitor", "ai data analyst alternatives"],
    og: { template: "compare", eyebrow: "Alternatives", title: "Julius AI alternatives" },
    related: ["/compare/wuup-vs-julius-ai", "/compare/wuup-vs-chatgpt-data-analysis", "/chat-with-mongodb"],
    target: { name: "Julius AI", url: "https://julius.ai/" },
    lead:
      "Julius AI analyses files and SQL warehouses by writing and running Python. The right alternative depends on where your data lives: MongoDB, spreadsheets you already use in ChatGPT, a SQL warehouse for a data team, or a developer GUI.",
    criteria: [
      "Which data sources it connects to, especially MongoDB",
      "Whether it shows the code or query behind an answer",
      "Whether answers cite their sources",
      "How it is priced",
    ],
    picks: [
      wuupPick(
        "Teams whose data is in MongoDB, Google Sheets and documents",
        `Read-only, schema-aware MongoDB querying, live Google Sheets and cited PDF answers in one chat. ${FACTS.freeQuestions} free questions, then your own model key at no charge.`,
        "/compare/wuup-vs-julius-ai"
      ),
      {
        name: "ChatGPT data analysis",
        url: "https://chatgpt.com/",
        bestFor: "Ad-hoc analysis of exported files",
        summary: "Writes and runs Python on files you upload and shows the code. Databases need custom connectors on some plans.",
        comparePath: "/compare/wuup-vs-chatgpt-data-analysis",
      },
      {
        name: "Hex",
        url: "https://hex.tech/",
        bestFor: "Data teams on SQL warehouses",
        summary:
          "Collaborative SQL and Python notebooks with an AI agent on paid plans. Its pricing page lists a free Community plan, Professional at $36 per editor per month and Team at $75. MongoDB is not among its native connections.",
      },
      {
        name: "MongoDB Compass",
        url: "https://www.mongodb.com/products/tools/compass",
        bestFor: "Developers who query MongoDB by hand",
        summary: "MongoDB's free desktop GUI with a visual pipeline builder and opt-in natural-language query generation.",
        comparePath: "/compare/wuup-vs-mongodb-compass",
      },
    ],
    sections: [
      {
        heading: "How to choose",
        body: [
          "Start from your data. If it is in MongoDB, Julius's documented connectors don't include it, so pick a tool that queries MongoDB directly: wuup for plain-English answers, Compass for hand-written queries. If it is in Postgres, Snowflake or BigQuery, Julius and Hex are both strong. If it is a one-off CSV, ChatGPT's data analysis is often enough.",
          "Then decide how much you need to verify. Tools that show the query or code behind each answer, and cite document passages, make it easy to trust a number before it goes into a report.",
        ],
      },
    ],
    sources: [
      { label: "Julius: data connectors", url: "https://julius.ai/docs/data-connectors/overview" },
      { label: "Hex: pricing", url: "https://hex.tech/pricing/" },
      { label: "Hex: data connections", url: "https://learn.hex.tech/docs/connect-to-data/data-connections/data-connections-introduction" },
      { label: "MongoDB Compass", url: "https://www.mongodb.com/products/tools/compass" },
      { label: "OpenAI: data analysis with ChatGPT", url: "https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt" },
    ],
    faqs: [
      { q: "What is the best Julius AI alternative for MongoDB?", a: "For plain-English answers, wuup, which queries MongoDB read-only and shows the query. For writing queries yourself, MongoDB Compass, which is free." },
      { q: "Is there a free alternative to Julius AI?", a: `wuup has ${FACTS.freeQuestions} free questions and no charge with your own key; Hex has a free Community plan; Compass is free.` },
    ],
  },
  {
    ...base,
    path: "/alternatives/chatpdf",
    priority: "P1",
    title: "ChatPDF alternatives with cited answers",
    description:
      "Compare ChatPDF alternatives: wuup, NotebookLM, Humata and ChatGPT, by file types, citations, working across many documents and data, and pricing.",
    h1: "ChatPDF alternatives",
    navLabel: "ChatPDF alternatives",
    primaryKeyword: "chatpdf alternatives",
    secondaryKeywords: ["tools like chatpdf", "chat with pdf alternatives", "pdf ai with citations"],
    og: { template: "compare", eyebrow: "Alternatives", title: "ChatPDF alternatives" },
    related: ["/chat-with-pdf", "/compare/wuup-vs-notebooklm", "/glossary/rag"],
    target: { name: "ChatPDF", url: "https://www.chatpdf.com/" },
    lead:
      "ChatPDF is a quick way to ask questions of a document, with clickable citations and a free daily allowance. Alternatives make sense when you need many documents at once, research across slides and videos, or answers that combine documents with live data.",
    criteria: [
      "Citations you can click back to",
      "How many documents one question can cover",
      "File types beyond PDF",
      "Whether it can also answer from data (databases, spreadsheets)",
    ],
    picks: [
      wuupPick(
        "Documents and live data in one chat",
        "PDF and TXT in a private knowledge base with numbered citations, plus read-only MongoDB and live Google Sheets in the same conversation.",
        "/compare/wuup-vs-notebooklm"
      ),
      {
        name: "NotebookLM",
        url: "https://notebooklm.google/",
        bestFor: "Research across many document types",
        summary: "Answers from the sources you add (PDFs, Docs, Slides, web pages, YouTube) with inline citations, plus Audio Overviews. Free tier with limits.",
        comparePath: "/compare/wuup-vs-notebooklm",
      },
      {
        name: "Humata",
        url: "https://www.humata.ai/",
        bestFor: "Page-based plans for document Q&A",
        summary: "Document Q&A that cites relevant sections. Its pricing page lists a free plan of 60 pages a month and Expert at $9.99 a month for 500 pages.",
      },
      {
        name: "ChatGPT",
        url: "https://chatgpt.com/",
        bestFor: "Documents alongside general assistant work",
        summary: "Upload PDFs and other files to ask about them within a general-purpose assistant.",
        comparePath: "/compare/wuup-vs-chatgpt-data-analysis",
      },
    ],
    sections: [
      {
        heading: "What ChatPDF does well",
        body: [
          "ChatPDF supports PDFs, Word, PowerPoint, Markdown and text files, YouTube videos and websites, and its built-in citations scroll to the referenced passage. The free plan covers 2 documents a day.",
        ],
      },
      {
        heading: "When to look elsewhere",
        body: [
          "If your question spans a whole folder of contracts or reports, choose a tool built around a knowledge base or notebook. If your question mixes documents with numbers from a database or spreadsheet, choose a tool that can query the data directly and cite both, which is what wuup is for.",
        ],
      },
    ],
    sources: [
      { label: "ChatPDF", url: "https://www.chatpdf.com/" },
      { label: "NotebookLM: supported sources", url: "https://support.google.com/notebooklm/answer/16215270" },
      { label: "Humata: pricing", url: "https://www.humata.ai/pricing" },
    ],
    faqs: [
      { q: "Which ChatPDF alternative cites sources?", a: "wuup, NotebookLM and Humata all cite passages from your documents; ChatPDF does too." },
      { q: "Can any of these read scanned PDFs?", a: "wuup cannot; it reads the PDF's text layer and does not run OCR. Check each tool's documentation for scanned-document support." },
    ],
  },
  {
    ...base,
    path: "/alternatives/ai2sql",
    priority: "P2",
    title: "AI2sql alternatives for MongoDB and SQL",
    description:
      "Compare AI2sql alternatives for turning plain English into queries: wuup, MongoDB Compass, ChatGPT and free generators. Which ones run the query for you.",
    h1: "AI2sql alternatives",
    navLabel: "AI2sql alternatives",
    primaryKeyword: "ai2sql alternatives",
    secondaryKeywords: ["text to sql tools", "ai query generator", "ai2sql mongodb"],
    og: { template: "compare", eyebrow: "Alternatives", title: "AI2sql alternatives" },
    related: ["/tools/mongodb-query-generator", "/tools/sql-to-mongodb-converter", "/glossary/text-to-sql"],
    target: { name: "AI2sql", url: "https://ai2sql.io/" },
    lead:
      "AI2sql turns plain English into SQL, and its site lists MongoDB among its supported databases. Alternatives split into two kinds: generators that write a query for you to run, and assistants that run it and give you the answer.",
    criteria: ["MongoDB support", "Whether it runs the query or only writes it", "Safety on live databases", "Pricing"],
    picks: [
      wuupPick(
        "Answers from MongoDB, not just queries",
        "Connect MongoDB read-only and get the answer as a chart or table with the query shown. The free MongoDB query generator and SQL converter need no account."
      ),
      {
        name: "MongoDB Compass",
        url: "https://www.mongodb.com/products/tools/compass",
        bestFor: "Free natural-language queries inside a MongoDB GUI",
        summary: "Opt-in AI turns a prompt into a filter or pipeline for you to review and run. Free desktop app.",
        comparePath: "/compare/wuup-vs-mongodb-compass",
      },
      {
        name: "ChatGPT",
        url: "https://chatgpt.com/",
        bestFor: "Occasional queries in a general assistant",
        summary: "Writes SQL or MongoDB queries on request; you paste in your schema and run the result yourself.",
        comparePath: "/compare/wuup-vs-chatgpt-data-analysis",
      },
      {
        name: "wuup free tools",
        url: "https://wuup.in/tools",
        bestFor: "Free MongoDB query, aggregation and SQL conversion",
        summary: "No signup. Each tool returns mongosh, Node.js and Python code and checks the output against a read-only guard.",
      },
    ],
    sections: [
      {
        heading: "About AI2sql",
        body: [
          "AI2sql generates queries for many SQL engines and lists MongoDB among supported databases. Its pricing page shows a free plan of 3 queries a day on a demo database, Start at $9 a month, Pro at $19 a month and Team at $39 a month, with live database connections on Pro and Team.",
        ],
      },
      {
        heading: "Generator or assistant?",
        body: [
          "A generator is enough when you are comfortable running and checking queries yourself. An assistant saves the copy and paste and turns results into answers, but it touches your database, so look for read-only access, query checks, limits and the query shown with every answer.",
        ],
      },
    ],
    sources: [
      { label: "AI2sql", url: "https://ai2sql.io/" },
      { label: "AI2sql: pricing", url: "https://ai2sql.io/pricing" },
      { label: "MongoDB Compass: natural-language queries", url: "https://www.mongodb.com/docs/compass/query-with-natural-language/prompt-natural-language-query/" },
    ],
    faqs: [
      { q: "Is there a free AI2sql alternative for MongoDB?", a: "Yes: wuup's free MongoDB query generator and SQL to MongoDB converter, and MongoDB Compass's opt-in AI query feature." },
      { q: "Can wuup write SQL for PostgreSQL?", a: "No. wuup is focused on MongoDB, Google Sheets and documents today; PostgreSQL is on the roadmap." },
    ],
  },
];
