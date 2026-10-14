import type { ConnectorPage } from "../types";
import { FACTS } from "../../lib/site";

/**
 * Connector landing pages: /chat-with-mongodb, /chat-with-google-sheets,
 * /chat-with-pdf. Every fact here is checked against the code:
 *   - MongoDB limits: packages/brain/src/bridges/mongo/{tools,guard,redact}.ts (via FACTS)
 *   - Sheets: packages/brain/src/bridges/sheets/{auth,client,tools}.ts
 *     (spreadsheets.readonly scope, 500 rows and 50 KB per read, 50 tabs, 50 header columns)
 *   - Documents: packages/ingestor (PDF and TXT parsed as text; no OCR)
 *   - Stored connection configs: AES-256-GCM (packages/brain/src/utils/crypto.ts)
 */

/** A coded product mock: one wuup answer, rendered as real UI on the page. */
export interface AnswerMock {
  question: string;
  /** Answer text. [n] marks a citation to sources[n-1]. */
  answer: string;
  visual: "bar" | "table";
  columns: string[];
  rows: Array<Array<string | number>>;
  /** "Queries used" panel. */
  query?: { label: string; code: string };
  sources?: Array<{ n: number; title: string; detail: string; kind: "data" | "doc" }>;
  followUps: string[];
}

export interface ConnectorPageFull extends ConnectorPage {
  /** Short source name, e.g. "MongoDB". */
  sourceName: string;
  mock: AnswerMock;
  /** Free tools to link (paths). */
  tools: string[];
  guides: string[];
  compare: string[];
  /** Trust card: key/value rows. */
  trustRows: Array<{ label: string; value: string }>;
}

const UPDATED = "2026-10-14";

export const connectors: ConnectorPageFull[] = [
  {
    kind: "connector",
    source: "mongodb",
    sourceName: "MongoDB",
    path: "/chat-with-mongodb",
    title: "Chat with MongoDB in plain English, read-only",
    description:
      "Ask MongoDB questions in plain English. wuup writes read-only queries from your real schema and answers with charts, tables and the exact query it ran.",
    h1: "Chat with your MongoDB\nin plain English",
    navLabel: "Chat with MongoDB",
    primaryKeyword: "chat with mongodb",
    secondaryKeywords: ["ask mongodb questions in plain english", "mongodb ai assistant", "natural language mongodb", "ai for mongodb"],
    status: "published",
    priority: "P0",
    updated: UPDATED,
    og: { template: "connector", eyebrow: "MongoDB", title: "Chat with your MongoDB in plain English" },
    related: ["/tools/mongodb-query-generator", "/use-cases/ecommerce-orders-mongodb", "/compare/wuup-vs-mongodb-compass"],
    badge: "Read-only",
    lead:
      "Connect a MongoDB database with a read-only user and ask questions the way you'd ask an analyst. wuup reads your schema, writes the query, runs it with a guard that blocks every write, and answers with a chart or table built from the rows it got back.",
    steps: [
      { title: "Create a read-only user", body: "Give wuup a MongoDB user with the read role on one database. It never needs more." },
      { title: "Paste the connection string", body: "Choose which collections wuup may query. Anything outside that scope is refused." },
      { title: "wuup scans the schema", body: "Field names and types are sampled automatically, and sensitive fields like passwords and tokens are redacted." },
      { title: "Ask in plain English", body: "Get a streamed answer, a chart or table from real rows, and the exact query behind it." },
    ],
    facts: [
      { value: `${FACTS.maxRowsPerQuery} rows`, label: "maximum returned by any one query, so answers stay fast" },
      { value: `${FACTS.queryTimeoutS} s`, label: "time limit on every query wuup runs" },
      { value: `${FACTS.blockedOperators.length} operators`, label: "that write data or run server-side code, always blocked" },
    ],
    exampleQuestions: [
      "What was revenue by month this year, excluding cancelled orders?",
      "Which 10 customers spent the most in the last 90 days?",
      "How many orders are stuck in pending for more than 3 days?",
      "What's our average order value by payment method?",
      "Which products sold out last week and are still listed?",
      "Show daily signups for the last 30 days as a chart",
      "Which support tickets have waited longest for a first reply?",
      "Compare this month's order count with last month's",
    ],
    mock: {
      question: "Revenue by month this year, without cancelled orders",
      answer:
        "September was the strongest month at ₹47,095 across 2 orders, up from ₹12,999 in August. October so far has ₹32,496 from 1 pending order.",
      visual: "bar",
      columns: ["Month", "Revenue (₹)"],
      rows: [
        ["Aug", 12999],
        ["Sep", 47095],
        ["Oct", 32496],
      ],
      query: {
        label: "orders.aggregate",
        code: '[{ $match: { status: { $ne: "cancelled" } } },\n { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$total" } } },\n { $sort: { _id: 1 } }]',
      },
      sources: [{ n: 1, title: "shop.orders", detail: "3 rows returned", kind: "data" }],
      followUps: ["Break September down by city", "Which products drove September?"],
    },
    tour: [
      {
        title: "Answers grounded in your real schema",
        body: "wuup samples each collection in scope and learns field names, types and nested shapes before it writes a query, so it uses createdAt, not a guessed created_at, and compares ObjectIds as ObjectIds.",
        accent: "blue",
      },
      {
        title: "Every query shown in full",
        body: "Each answer lists the queries used. Open one to read the exact filter or pipeline, copy it into mongosh, or check how a number was produced.",
        accent: "indigo",
      },
      {
        title: "Charts and tables from returned rows",
        body: "Visuals are drawn from the documents MongoDB actually returned, never from numbers the model wrote. If the result was capped, the answer says so.",
        accent: "sky",
      },
      {
        title: "Follow-ups and clarifying questions",
        body: "Ambiguous questions get a short clarifying question first. Every answer ends with follow-up suggestions so you can drill down without retyping context.",
        accent: "periwinkle",
      },
    ],
    trust: [
      { title: "Read-only by design", body: "Every query passes a guard that allows only read stages and refuses $out, $merge, $where and $function before anything reaches your database." },
      { title: "Scoped to what you choose", body: "Only the collections you enable are queried. admin, local, config and system collections are never reachable." },
      { title: "Sensitive fields hidden", body: "Fields named like password, token, secret, api_key or card_number are redacted from what the model sees, at any depth." },
    ],
    trustRows: [
      { label: "Database access", value: "Read-only user" },
      { label: "Writes and server JS", value: "Blocked" },
      { label: "Sensitive fields", value: "Redacted" },
      { label: "Connection string", value: "Encrypted at rest" },
      { label: "Rows per query", value: `Up to ${FACTS.maxRowsPerQuery}` },
    ],
    limits: [
      `Each query returns at most ${FACTS.maxRowsPerQuery} rows and ${FACTS.maxResultKb} KB, so wuup aggregates in the database rather than pulling raw data.`,
      `Queries time out after ${FACTS.queryTimeoutS} seconds and run without allowDiskUse, so a huge unindexed $group or $sort can fail. Add an index or narrow the question.`,
      "Your database must be reachable from the internet (for example MongoDB Atlas with wuup allowed in Network Access). Private and local addresses are refused.",
      "$lookup, $graphLookup and $unionWith only work between collections you enabled in the same database.",
      "wuup answers questions; it does not modify data, create indexes or run admin commands.",
    ],
    tools: ["/tools/mongodb-query-generator", "/tools/mongodb-aggregation-generator", "/tools/sql-to-mongodb-converter", "/tools/mongodb-schema-from-json"],
    guides: [
      "/guides/mongodb-read-only-user",
      "/guides/query-mongodb-in-plain-english",
      "/guides/is-it-safe-to-connect-database-to-ai",
      "/guides/connect-mongodb-to-chatgpt-or-claude",
      "/guides/text-to-sql-vs-text-to-mongodb",
    ],
    compare: ["/compare/wuup-vs-mongodb-compass", "/compare/wuup-vs-julius-ai", "/compare/wuup-vs-chatgpt-data-analysis"],
    faqs: [
      {
        q: "Can wuup change or delete my data?",
        a: "No. Connect with a read-only MongoDB user, and on top of that every query passes wuup's guard, which only allows read stages and blocks $out, $merge, $where, $function and similar operators.",
      },
      {
        q: "Does it work with MongoDB Atlas?",
        a: "Yes. Use a mongodb+srv connection string for a read-only Atlas database user, and make sure Atlas Network Access allows connections from wuup.",
      },
      {
        q: "What does the AI model see?",
        a: "The schema summary of the collections you enabled (with sensitive fields redacted) and the rows a query returns, up to the row and size limits. It never sees your connection string.",
      },
      {
        q: "How accurate are the answers?",
        a: "Numbers come from rows MongoDB returned, and every answer shows the query used, so you can check it. If a question is ambiguous wuup asks before guessing.",
      },
      {
        q: "Which AI model is used?",
        a: `The free tier gives ${FACTS.freeQuestions} questions on Gemini. With your own key you can use OpenAI, Anthropic, OpenRouter, Gemini or Groq models, and wuup charges nothing extra.`,
      },
      {
        q: "Can I query several databases at once?",
        a: "You can connect several databases and choose which ones a chat uses. Joins only happen within one database, between collections you enabled.",
      },
      {
        q: "Is PostgreSQL support on the roadmap?",
        a: "Yes. MongoDB, Google Sheets and documents are supported today, and PostgreSQL is on the roadmap.",
      },
    ],
  },
  {
    kind: "connector",
    source: "google-sheets",
    sourceName: "Google Sheets",
    path: "/chat-with-google-sheets",
    title: "Chat with Google Sheets: ask your spreadsheets",
    description:
      "Ask questions about your Google Sheets in plain English. wuup reads your tabs read-only and answers with tables, charts and the exact range it used.",
    h1: "Ask your Google Sheets\nanything",
    navLabel: "Chat with Google Sheets",
    primaryKeyword: "chat with google sheets",
    secondaryKeywords: ["ai for google sheets", "ask questions about spreadsheet", "google sheets ai analyst", "analyze google sheets with ai"],
    status: "published",
    priority: "P0",
    updated: UPDATED,
    og: { template: "connector", eyebrow: "Google Sheets", title: "Ask your Google Sheets anything" },
    related: ["/use-cases/sales-pipeline-google-sheets", "/use-cases/finance-reporting-google-sheets", "/compare/wuup-vs-julius-ai"],
    badge: "Read-only",
    lead:
      "Share a spreadsheet with wuup's service account as a viewer, paste its link, and ask questions across your tabs in plain English. wuup reads the headers, pulls the rows it needs and answers with a table or chart, showing exactly which range it read.",
    steps: [
      { title: "Share with wuup", body: "Add wuup's service account email to the sheet as a Viewer, the same way you'd share with a colleague." },
      { title: "Paste the sheet link", body: "wuup lists the tabs and reads each header row to learn your columns." },
      { title: "Ask a question", body: "wuup picks the tab and range, reads the rows and works out the answer." },
      { title: "Check the source", body: "Every answer shows the tab and range it read, so you can open the sheet and verify." },
    ],
    facts: [
      { value: `${FACTS.maxResultKb} KB`, label: "of rows read per request, so answers stay quick" },
      { value: `${FACTS.freeQuestions}`, label: "free questions to start, no card needed" },
      { value: `${FACTS.byokProviders.length} providers`, label: "for your own key: OpenAI, Anthropic, OpenRouter, Gemini, Groq" },
    ],
    exampleQuestions: [
      "Which sales rep closed the most revenue this quarter?",
      "What's the total of open deals by stage?",
      "Which expense categories grew the most month over month?",
      "List deals over ₹5 lakh with no activity in 30 days",
      "Compare budget vs actual for each department",
      "Which customers appear in the Invoices tab but not in Payments?",
      "Chart monthly revenue from the Summary tab",
      "What's the average deal size by region?",
    ],
    mock: {
      question: "Open pipeline value by stage",
      answer: "₹1.42 Cr is open across 4 stages. Proposal holds the most at ₹58.0 L over 9 deals [1].",
      visual: "table",
      columns: ["Stage", "Deals", "Value (₹ L)"],
      rows: [
        ["Discovery", 14, 22.5],
        ["Demo", 11, 34.2],
        ["Proposal", 9, 58.0],
        ["Negotiation", 4, 27.3],
      ],
      query: { label: "Sheets read", code: "Pipeline!A1:H39  (38 rows)" },
      sources: [{ n: 1, title: "Q3 Sales Pipeline", detail: "Tab: Pipeline, A1:H39", kind: "data" }],
      followUps: ["Which of these deals are overdue?", "Show it by owner"],
    },
    tour: [
      {
        title: "Questions across tabs",
        body: "wuup knows every tab and its headers, so it can read the Invoices tab and the Payments tab and compare them in one answer.",
        accent: "sky",
      },
      {
        title: "The range is always shown",
        body: "Each answer names the tab and A1 range it read. Open the sheet and you're looking at the same cells.",
        accent: "blue",
      },
      {
        title: "Tables and charts from your rows",
        body: "Visuals are built from the values read from the sheet, so a chart matches the cells exactly.",
        accent: "indigo",
      },
      {
        title: "Mix with MongoDB and documents",
        body: "Keep targets in a sheet and actuals in MongoDB, or a budget sheet next to a PDF report, and ask about both in the same chat.",
        accent: "periwinkle",
      },
    ],
    trust: [
      { title: "Read-only access", body: "wuup's service account uses Google's spreadsheets.readonly scope. It can read sheets shared with it and can't edit them." },
      { title: "You control sharing", body: "Only sheets you share with the service account are reachable. Remove it from the sheet to revoke access at any time." },
      { title: "Bounded reads", body: `Each read is capped at 500 rows and ${FACTS.maxResultKb} KB, and the answer says when a result was capped.` },
    ],
    trustRows: [
      { label: "Google scope", value: "spreadsheets.readonly" },
      { label: "Access", value: "Sheets you share" },
      { label: "Edits", value: "Never" },
      { label: "Rows per read", value: "Up to 500" },
      { label: "Revoke", value: "Unshare any time" },
    ],
    limits: [
      "The sheet must be shared with wuup's service account. Sign-in with your own Google account is not supported yet.",
      `Each read covers up to 500 data rows and ${FACTS.maxResultKb} KB. Larger tabs are read in parts or summarised, and the answer says when it was capped.`,
      "wuup expects the first row of each tab to be headers. Merged headers or several tables on one tab make answers less reliable.",
      "The first 50 tabs and 50 header columns of a spreadsheet are indexed.",
      "wuup reads values; it doesn't write back, edit formulas or create charts inside the sheet.",
    ],
    tools: ["/tools/sql-to-mongodb-converter", "/tools/mongodb-schema-from-json"],
    guides: ["/guides/chat-with-google-sheets-methods", "/guides/ask-questions-across-pdfs-and-spreadsheets", "/guides/why-ai-data-answers-hallucinate"],
    compare: ["/compare/wuup-vs-julius-ai", "/compare/wuup-vs-chatgpt-data-analysis"],
    faqs: [
      {
        q: "Does wuup need edit access to my sheet?",
        a: "No. Share it as a Viewer. wuup's service account only has Google's read-only Sheets scope, so it couldn't edit even with more access.",
      },
      {
        q: "Can I connect a sheet that isn't public?",
        a: "Yes. Keep it private and share it only with wuup's service account email, which wuup shows you when you connect.",
      },
      {
        q: "How big can a sheet be?",
        a: `wuup reads up to 500 rows and ${FACTS.maxResultKb} KB per request. For large tabs it reads the columns and ranges it needs; the answer tells you when data was capped.`,
      },
      {
        q: "Does it understand formulas?",
        a: "wuup reads the values the cells show. It doesn't evaluate or rewrite formulas.",
      },
      {
        q: "Can I ask about several sheets at once?",
        a: "Yes. Connect several spreadsheets, and add MongoDB or documents to the same chat if you need them together.",
      },
      {
        q: "Does it work with Excel files?",
        a: "Upload is for PDF and TXT today. To ask about an Excel workbook, open it in Google Sheets and connect that sheet.",
      },
    ],
  },
  {
    kind: "connector",
    source: "pdf",
    sourceName: "PDFs",
    path: "/chat-with-pdf",
    title: "Chat with PDF: answers with numbered citations",
    description:
      "Upload PDF and TXT files to a private knowledge base and ask questions in plain English. Every answer cites the exact passages it used, numbered.",
    h1: "Chat with your PDFs,\nwith citations",
    navLabel: "Chat with PDF",
    primaryKeyword: "chat with pdf",
    secondaryKeywords: ["ask questions about a pdf", "pdf ai with citations", "chat with multiple pdfs", "ai document q&a"],
    status: "published",
    priority: "P0",
    updated: UPDATED,
    og: { template: "connector", eyebrow: "Documents", title: "Chat with your PDFs, with citations" },
    related: ["/use-cases/research-pdfs-and-spreadsheets", "/compare/wuup-vs-notebooklm", "/alternatives/chatpdf"],
    badge: "Cited answers",
    lead:
      "Upload PDF or TXT files to your private knowledge base and ask questions across them. wuup finds the relevant passages and answers with numbered citations, so every claim points back to the page it came from.",
    steps: [
      { title: "Upload files", body: "Add PDF or TXT files. They go into your own knowledge base, not anyone else's." },
      { title: "wuup reads and indexes them", body: "Text is extracted, split into passages and embedded so it can be searched by meaning." },
      { title: "Ask across documents", body: "Ask about one file or all of them; wuup retrieves the passages that answer it." },
      { title: "Follow the citations", body: "Numbered citations show which document and passage each statement came from." },
    ],
    facts: [
      { value: `${FACTS.sources.slice(2).join(" + ")}`, label: "file types today; Markdown, CSV and DOCX are being added" },
      { value: `${FACTS.freeQuestions}`, label: "free questions to start, no card needed" },
      { value: `${FACTS.byokProviders.length} providers`, label: "for your own key: OpenAI, Anthropic, OpenRouter, Gemini, Groq" },
    ],
    exampleQuestions: [
      "What are the termination clauses in this contract?",
      "Summarise the key risks in the annual report, with page references",
      "What did the three vendor proposals quote for implementation?",
      "Which policies mention data retention, and for how long?",
      "Compare revenue guidance across these two earnings call transcripts",
      "List every deadline mentioned in the tender document",
      "What does the paper say about its limitations?",
      "Does our handbook allow remote work from another country?",
    ],
    mock: {
      question: "What notice period do the vendor contracts require?",
      answer:
        "Both contracts require written notice: Northwind requires 60 days before renewal [1], while Acme Logistics allows termination with 30 days' notice at any time after the first year [2].",
      visual: "table",
      columns: ["Contract", "Notice", "Applies"],
      rows: [
        ["Northwind MSA", "60 days", "Before renewal"],
        ["Acme Logistics", "30 days", "After year one"],
      ],
      sources: [
        { n: 1, title: "Northwind-MSA-2026.pdf", detail: "Section 11.2, Term and renewal", kind: "doc" },
        { n: 2, title: "Acme-Logistics-Agreement.pdf", detail: "Clause 14, Termination", kind: "doc" },
      ],
      followUps: ["What penalties apply for early termination?", "When does each contract renew?"],
    },
    tour: [
      {
        title: "Numbered citations on every answer",
        body: "Each statement carries a number that points to the document and passage it came from, so you can check it in seconds.",
        accent: "indigo",
      },
      {
        title: "Ask across many files",
        body: "Questions search your whole knowledge base by meaning, not just keywords, so comparisons across contracts or reports work.",
        accent: "blue",
      },
      {
        title: "Combine documents with data",
        body: "Ask about a PDF report and your MongoDB or Google Sheets numbers in one chat, with each source cited separately.",
        accent: "sky",
      },
      {
        title: "Follow-ups that keep context",
        body: "Each answer suggests follow-up questions, and the chat remembers which documents you were asking about, so you can drill into a clause without repeating yourself.",
        accent: "periwinkle",
      },
    ],
    trust: [
      { title: "Private knowledge base", body: "Uploaded files belong to your account and are only searched for your questions." },
      { title: "Citations you can check", body: "Answers cite the passages they use, so every claim can be traced back to its page." },
      { title: "Delete any time", body: "Remove a document and its passages are removed from your knowledge base." },
    ],
    trustRows: [
      { label: "Knowledge base", value: "Private to you" },
      { label: "Citations", value: "Numbered, per passage" },
      { label: "File types", value: "PDF, TXT" },
      { label: "Scanned PDFs", value: "Not supported" },
      { label: "Deletion", value: "Any time" },
    ],
    limits: [
      "PDFs must contain selectable text. Scanned or image-only PDFs have no text to read; wuup does not run OCR.",
      "Password-protected PDFs can't be read. Remove the password before uploading.",
      "Tables and multi-column layouts are read as text, so complex table structure can be lost.",
      "Only PDF and TXT are supported today. Markdown, CSV and DOCX are being added.",
      "Answers use the most relevant passages, so \"summarise every page\" questions on very long documents work better split into sections.",
    ],
    tools: ["/tools/mongodb-schema-from-json"],
    guides: ["/guides/ask-questions-across-pdfs-and-spreadsheets", "/guides/why-ai-data-answers-hallucinate"],
    compare: ["/compare/wuup-vs-notebooklm", "/alternatives/chatpdf", "/compare/wuup-vs-chatgpt-data-analysis"],
    faqs: [
      {
        q: "Can I chat with several PDFs at once?",
        a: "Yes. Every file you upload goes into your knowledge base, and questions search across all of them unless you narrow it down.",
      },
      {
        q: "Does wuup show where an answer came from?",
        a: "Yes. Answers carry numbered citations to the document and passage each statement is based on.",
      },
      {
        q: "Does it read scanned PDFs?",
        a: "No. wuup reads the text layer of a PDF and does not run OCR, so scanned or photographed pages come through empty. Run OCR first, or upload a text version.",
      },
      {
        q: "Is my document used to train models?",
        a: "wuup doesn't train models on your files. Passages are sent to the model you choose to answer your question; check your AI provider's data policy if you bring your own key.",
      },
      {
        q: "What file types are supported?",
        a: "PDF and TXT today. Markdown, CSV and DOCX uploads are being added.",
      },
      {
        q: "How is this different from ChatPDF or NotebookLM?",
        a: "wuup also connects MongoDB and Google Sheets, so you can ask one question across documents and live data, with each kind of source cited.",
      },
    ],
  },
];

export function getConnector(path: string): ConnectorPageFull | undefined {
  return connectors.find((c) => c.path === path);
}
