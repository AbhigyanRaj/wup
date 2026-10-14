import type { UseCasePage } from "../types";
import type { MongoQuery } from "../../lib/tools/mongo-format";

/**
 * Use-case pages: /use-cases/<slug>.
 * MongoDB queries here use the sample collections in sample-datasets.ts and
 * are executed by scripts/verify-tool-examples.mjs.
 */

export interface UseCaseQA {
  question: string;
  /** What wuup does to answer it, in one or two sentences. */
  does: string;
  /** The query wuup would run (MongoDB use cases). */
  query?: MongoQuery;
  /** A non-MongoDB "source read" line, e.g. a sheet range or passages. */
  read?: string;
}

export interface UseCasePageFull extends UseCasePage {
  /** Data sources shown as chips. */
  sources: string[];
  /** Cover under /public; the template falls back to a gradient if missing. */
  cover: string;
  qa: UseCaseQA[];
  /** One-line summary for the index card. */
  summary: string;
}

const UPDATED = "2026-10-14";
const date = (iso: string) => ({ $date: iso });

const base = {
  kind: "use-case" as const,
  status: "published" as const,
  updated: UPDATED,
};

export const useCases: UseCasePageFull[] = [
  {
    ...base,
    path: "/use-cases/product-analytics-mongodb",
    priority: "P1",
    title: "Product analytics on MongoDB events with AI",
    description:
      "Ask product questions of the event data in your MongoDB: active users, funnels, retention and feature adoption, answered with charts and the query used.",
    h1: "Product analytics,\nstraight from MongoDB",
    navLabel: "Product analytics",
    summary: "Active users, funnels and feature adoption from raw event documents.",
    primaryKeyword: "product analytics mongodb",
    secondaryKeywords: ["mongodb events analytics", "daily active users mongodb", "funnel analysis mongodb"],
    og: { template: "use-case", eyebrow: "Use case", title: "Product analytics, straight from MongoDB" },
    related: ["/chat-with-mongodb", "/tools/mongodb-aggregation-generator", "/use-cases/ecommerce-orders-mongodb"],
    persona: "Product managers and founders whose app writes events to MongoDB",
    lead:
      "If your app already writes events to MongoDB, you don't need a separate analytics tool to answer most product questions. Ask wuup for active users, funnels or adoption in plain English and get a chart built from the aggregation it ran on your events collection.",
    sources: ["MongoDB events collection", "MongoDB users collection"],
    cover: "/images/use-cases/product-analytics-mongodb.webp",
    problems: [
      "Every product question becomes a ticket for an engineer to write an aggregation.",
      "Analytics tools need extra tracking code and still miss the events you store yourself.",
      "Dashboards answer last quarter's questions, not today's.",
    ],
    workflow: [
      { title: "Connect read-only", body: "Point wuup at the database with your events and users collections." },
      { title: "Ask the product question", body: "\"How many users added to cart and then purchased this week?\"" },
      { title: "Check the pipeline", body: "Open the query used to see exactly how users were counted." },
    ],
    exampleQuestions: [
      "Daily active users for the last 30 days",
      "Funnel from page view to purchase this month",
      "Which features did new signups use in their first week?",
      "Mobile vs desktop share of sessions",
      "Signups by referrer last week",
      "Users who were active last month but not this month",
    ],
    qa: [
      {
        question: "How many daily active users did we have in October?",
        does: "Filters October events, collects distinct userIds per day and counts them.",
        query: {
          kind: "aggregate",
          collection: "events",
          pipeline: [
            { $match: { ts: { $gte: date("2026-10-01T00:00:00Z"), $lt: date("2026-11-01T00:00:00Z") } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } }, users: { $addToSet: "$userId" } } },
            { $project: { _id: 0, day: "$_id", activeUsers: { $size: "$users" } } },
            { $sort: { day: 1 } },
          ],
        },
      },
      {
        question: "What does the funnel from page view to purchase look like?",
        does: "Counts unique users at each funnel step and charts them as a funnel.",
        query: {
          kind: "aggregate",
          collection: "events",
          pipeline: [
            { $match: { event: { $in: ["page_view", "add_to_cart", "purchase"] } } },
            { $group: { _id: "$event", users: { $addToSet: "$userId" } } },
            { $project: { _id: 0, step: "$_id", users: { $size: "$users" } } },
            { $sort: { users: -1 } },
          ],
        },
      },
      {
        question: "Where do signups come from?",
        does: "Groups signup events by the referrer stored in event properties.",
        query: {
          kind: "aggregate",
          collection: "events",
          pipeline: [
            { $match: { event: "signup" } },
            { $group: { _id: "$properties.referrer", signups: { $sum: 1 } } },
            { $sort: { signups: -1 } },
          ],
        },
      },
      {
        question: "What share of sessions are on mobile?",
        does: "Counts distinct sessions per device, then wuup works out the percentages in the answer.",
        query: {
          kind: "aggregate",
          collection: "events",
          pipeline: [
            { $group: { _id: "$device", sessions: { $addToSet: "$sessionId" } } },
            { $project: { _id: 0, device: "$_id", sessions: { $size: "$sessions" } } },
          ],
        },
      },
      {
        question: "Which pages get the most views?",
        does: "Uses $sortByCount on page for page_view events and returns the top 10.",
        query: {
          kind: "aggregate",
          collection: "events",
          pipeline: [{ $match: { event: "page_view" } }, { $sortByCount: "$page" }, { $limit: 10 }],
        },
      },
      {
        question: "Which users were active in the last 7 days?",
        does: "Uses $$NOW for a rolling window and joins to customers for names.",
        query: {
          kind: "aggregate",
          collection: "events",
          pipeline: [
            { $match: { $expr: { $gte: ["$ts", { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 7 } }] } } },
            { $group: { _id: "$userId", events: { $sum: 1 } } },
            { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "user" } },
            { $project: { _id: 0, name: { $first: "$user.name" }, events: 1 } },
            { $sort: { events: -1 } },
          ],
        },
      },
    ],
    connectors: ["/chat-with-mongodb"],
    tour: [
      { title: "Charts from real rows", body: "Every DAU line or funnel bar comes from documents the aggregation returned.", accent: "blue" },
      { title: "The pipeline is right there", body: "Open \"queries used\" to see how a user or session was counted, and reuse it.", accent: "indigo" },
      { title: "Clarifies vague metrics", body: "\"Active\" can mean many things. wuup asks which event counts before it guesses.", accent: "sky" },
    ],
    outcomes: [
      "Answer product questions in minutes instead of waiting for an engineer.",
      "Keep one source of truth: the events you already store.",
      "Learn aggregation patterns by reading the pipelines wuup writes.",
    ],
    faqs: [
      {
        q: "Do I need to change how I store events?",
        a: "No. wuup reads your existing collections and learns their fields. Consistent event names and a timestamp field make answers more reliable.",
      },
      {
        q: "How much data can it analyse?",
        a: "Aggregations run inside MongoDB, so wuup can summarise large collections; each query returns at most 100 rows to the model, which is plenty for charts and summaries.",
      },
      {
        q: "Is this a replacement for a product analytics tool?",
        a: "For ad-hoc questions on data you already store, often yes. Purpose-built tools still win for session replay and autocapture.",
      },
    ],
  },
  {
    ...base,
    path: "/use-cases/ecommerce-orders-mongodb",
    priority: "P1",
    title: "E-commerce order analytics on MongoDB",
    description:
      "Ask your MongoDB orders collection about revenue, top products, payment methods and fulfilment delays in plain English, with charts and the exact queries used.",
    h1: "Ask your orders data\nanything",
    navLabel: "E-commerce orders",
    summary: "Revenue, top products and fulfilment delays from your orders collection.",
    primaryKeyword: "ecommerce analytics mongodb",
    secondaryKeywords: ["mongodb orders analytics", "revenue by month mongodb", "top selling products mongodb"],
    og: { template: "use-case", eyebrow: "Use case", title: "Ask your orders data anything" },
    related: ["/chat-with-mongodb", "/tools/mongodb-aggregation-generator", "/use-cases/support-tickets-mongodb"],
    persona: "D2C founders, ops leads and analysts running a store on MongoDB",
    lead:
      "Your orders collection already knows your revenue, best sellers and slow deliveries. Connect it read-only and ask wuup in plain English; it writes the aggregation, runs it safely and answers with a chart, a table and the query behind every number.",
    sources: ["MongoDB orders", "MongoDB customers", "MongoDB products"],
    cover: "/images/use-cases/ecommerce-orders-mongodb.webp",
    problems: [
      "Revenue questions need someone who can write $unwind and $group.",
      "Exports to spreadsheets go stale the day they're made.",
      "Line items live inside arrays, which generic BI tools handle badly.",
    ],
    workflow: [
      { title: "Connect orders, customers, products", body: "Scope wuup to just the collections it should read." },
      { title: "Ask like you'd ask an analyst", body: "\"Top 10 products by revenue last month, excluding cancelled orders.\"" },
      { title: "Drill down", body: "Use the follow-ups to split by city, payment method or customer." },
    ],
    exampleQuestions: [
      "Revenue by month this year",
      "Top products by units sold",
      "Average order value by payment method",
      "Orders pending for more than 3 days",
      "Repeat customer rate",
      "Revenue by shipping city",
    ],
    qa: [
      {
        question: "What was revenue by month, excluding cancelled orders?",
        does: "Matches non-cancelled orders, groups by month and charts the totals.",
        query: {
          kind: "aggregate",
          collection: "orders",
          pipeline: [
            { $match: { status: { $ne: "cancelled" } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$total" } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
      {
        question: "Which products sell the most units?",
        does: "Unwinds line items and sums quantity per SKU.",
        query: {
          kind: "aggregate",
          collection: "orders",
          pipeline: [
            { $match: { status: { $ne: "cancelled" } } },
            { $unwind: "$items" },
            { $group: { _id: "$items.sku", units: { $sum: "$items.qty" } } },
            { $sort: { units: -1 } },
            { $limit: 10 },
          ],
        },
      },
      {
        question: "Which orders have been pending for more than 3 days?",
        does: "Filters pending orders older than three days using $$NOW.",
        query: {
          kind: "find",
          collection: "orders",
          filter: {
            status: "pending",
            $expr: { $lt: ["$createdAt", { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 3 } }] },
          },
          projection: { _id: 0, orderNumber: 1, total: 1, createdAt: 1 },
          sort: { createdAt: 1 },
          limit: 50,
        },
      },
      {
        question: "What's the average order value by payment method?",
        does: "Groups non-cancelled orders by payment method and averages the total.",
        query: {
          kind: "aggregate",
          collection: "orders",
          pipeline: [
            { $match: { status: { $ne: "cancelled" } } },
            { $group: { _id: "$paymentMethod", avgOrderValue: { $avg: "$total" }, orders: { $sum: 1 } } },
            { $sort: { avgOrderValue: -1 } },
          ],
        },
      },
      {
        question: "How many customers ordered more than once?",
        does: "Counts orders per customer, then counts customers with two or more.",
        query: {
          kind: "aggregate",
          collection: "orders",
          pipeline: [
            { $group: { _id: "$customerId", orders: { $sum: 1 } } },
            { $group: { _id: { $gte: ["$orders", 2] }, customers: { $sum: 1 } } },
          ],
        },
      },
      {
        question: "Which cities bring in the most revenue?",
        does: "Groups by the embedded shipping city and ranks by revenue.",
        query: {
          kind: "aggregate",
          collection: "orders",
          pipeline: [
            { $match: { status: { $ne: "cancelled" } } },
            { $group: { _id: "$shipping.city", revenue: { $sum: "$total" } } },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ],
    connectors: ["/chat-with-mongodb", "/chat-with-google-sheets"],
    tour: [
      { title: "Handles line-item arrays", body: "wuup unwinds embedded items when a question is about products, and leaves orders whole when it's about orders.", accent: "blue" },
      { title: "Joins customers and products", body: "$lookup between the collections you enabled answers questions like \"top customers by spend\".", accent: "indigo" },
      { title: "Targets from a sheet", body: "Keep monthly targets in Google Sheets and ask for actual vs target in the same chat.", accent: "sky" },
    ],
    outcomes: [
      "Daily revenue and product questions answered without a BI project.",
      "Every number traceable to the query that produced it.",
      "No risk to production data: read-only user plus a write-blocking guard.",
    ],
    faqs: [
      {
        q: "Will it slow down my production database?",
        a: "Every query has a 10 second time limit and returns at most 100 rows. For heavy analysis, connect a secondary or analytics replica.",
      },
      {
        q: "Does it understand currencies?",
        a: "It uses the amounts as stored. Mention the currency field or the currency in your question if you store several.",
      },
      {
        q: "Can it see customer emails and phone numbers?",
        a: "Only for collections you enable. Fields with sensitive names like password or token are redacted automatically; leave out collections you don't want queried.",
      },
    ],
  },
  {
    ...base,
    path: "/use-cases/support-tickets-mongodb",
    priority: "P2",
    title: "Support ticket analytics on MongoDB",
    description:
      "Ask your support tickets in MongoDB about backlog, first response times, top issues and CSAT in plain English. Answers come with charts and the query used.",
    h1: "Support metrics without\nwaiting on a report",
    navLabel: "Support tickets",
    summary: "Backlog, response times, top issues and CSAT from a tickets collection.",
    primaryKeyword: "support ticket analytics",
    secondaryKeywords: ["first response time mongodb", "helpdesk analytics ai", "ticket backlog report"],
    og: { template: "use-case", eyebrow: "Use case", title: "Support metrics without waiting on a report" },
    related: ["/chat-with-mongodb", "/use-cases/ecommerce-orders-mongodb", "/tools/mongodb-query-generator"],
    persona: "Support leads and CX teams whose help desk data lives in MongoDB",
    lead:
      "Backlog by priority, first response time by channel, the issues behind most tickets: ask wuup in plain English and it queries your tickets collection read-only, then answers with a chart and the exact query, so you can trust the number you put in the weekly report.",
    sources: ["MongoDB tickets", "MongoDB customers", "Support playbook PDF"],
    cover: "/images/use-cases/support-tickets-mongodb.webp",
    problems: [
      "Help desk dashboards don't answer the question you have today.",
      "Response-time maths over timestamps is fiddly and easy to get wrong.",
      "Joining tickets to customer plans needs an engineer.",
    ],
    workflow: [
      { title: "Connect tickets and customers", body: "Read-only, scoped to the two collections." },
      { title: "Ask about the backlog", body: "\"Open urgent tickets older than a day, by assignee.\"" },
      { title: "Share the answer", body: "Copy the table or the query into your report." },
    ],
    exampleQuestions: [
      "Open tickets by priority",
      "Average first response time by channel",
      "Most common ticket tags this month",
      "Unassigned urgent tickets",
      "CSAT by assignee",
      "Tickets from business-plan customers",
    ],
    qa: [
      {
        question: "What's the open backlog by priority?",
        does: "Counts open and pending tickets for each priority.",
        query: {
          kind: "aggregate",
          collection: "tickets",
          pipeline: [{ $match: { status: { $in: ["open", "pending"] } } }, { $group: { _id: "$priority", tickets: { $sum: 1 } } }, { $sort: { tickets: -1 } }],
        },
      },
      {
        question: "What's our average first response time by channel?",
        does: "Uses $dateDiff between createdAt and firstResponseAt and averages it per channel.",
        query: {
          kind: "aggregate",
          collection: "tickets",
          pipeline: [
            { $match: { firstResponseAt: { $ne: null } } },
            { $group: { _id: "$channel", avgMinutes: { $avg: { $dateDiff: { startDate: "$createdAt", endDate: "$firstResponseAt", unit: "minute" } } } } },
            { $sort: { avgMinutes: -1 } },
          ],
        },
      },
      {
        question: "Which tags show up most?",
        does: "Unwinds tags and counts them.",
        query: { kind: "aggregate", collection: "tickets", pipeline: [{ $unwind: "$tags" }, { $sortByCount: "$tags" }, { $limit: 10 }] },
      },
      {
        question: "Which urgent tickets have no assignee?",
        does: "A simple find on priority and a null assignee.",
        query: {
          kind: "find",
          collection: "tickets",
          filter: { priority: "urgent", assignee: null, status: { $nin: ["resolved", "closed"] } },
          projection: { _id: 0, ticketNumber: 1, subject: 1, createdAt: 1 },
          sort: { createdAt: 1 },
          limit: 50,
        },
      },
      {
        question: "What's CSAT by assignee?",
        does: "Averages csat where it exists and counts rated tickets.",
        query: {
          kind: "aggregate",
          collection: "tickets",
          pipeline: [
            { $match: { csat: { $ne: null } } },
            { $group: { _id: "$assignee", csat: { $avg: "$csat" }, rated: { $sum: 1 } } },
            { $sort: { csat: -1 } },
          ],
        },
      },
      {
        question: "How many tickets come from each customer plan?",
        does: "Joins tickets to customers and groups by plan.",
        query: {
          kind: "aggregate",
          collection: "tickets",
          pipeline: [
            { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
            { $group: { _id: { $first: "$customer.plan" }, tickets: { $sum: 1 } } },
            { $sort: { tickets: -1 } },
          ],
        },
      },
    ],
    connectors: ["/chat-with-mongodb", "/chat-with-pdf"],
    tour: [
      { title: "Time maths done right", body: "Response and resolution times use $dateDiff on real timestamps, and tickets without a response are excluded, not counted as zero.", accent: "indigo" },
      { title: "Tickets plus customers", body: "Join to the customers collection to split metrics by plan or country.", accent: "blue" },
      { title: "Playbook in the same chat", body: "Upload your support playbook PDF and ask whether a ticket was handled by the book, with citations.", accent: "sky" },
    ],
    outcomes: [
      "Weekly support reports in minutes.",
      "Numbers your team can verify from the query.",
      "Questions answered across tickets, customers and policies.",
    ],
    faqs: [
      {
        q: "Does it work with Zendesk or Freshdesk directly?",
        a: "No. wuup connects to MongoDB, Google Sheets and documents. If your tickets are synced into MongoDB or exported to a sheet, wuup can answer questions about them.",
      },
      {
        q: "Can it read ticket messages?",
        a: "If the message text is in the collections you enable, yes. Consider leaving long free-text fields out of scope for faster, cheaper answers.",
      },
    ],
  },
  {
    ...base,
    path: "/use-cases/sales-pipeline-google-sheets",
    priority: "P1",
    title: "Sales pipeline analysis in Google Sheets with AI",
    description:
      "Ask your sales pipeline sheet about deals by stage, rep performance and stale opportunities. wuup reads Google Sheets read-only and shows the range used.",
    h1: "Your pipeline sheet,\nanswering back",
    navLabel: "Sales pipeline (Sheets)",
    summary: "Deals by stage, rep performance and stale opportunities from a pipeline sheet.",
    primaryKeyword: "sales pipeline google sheets ai",
    secondaryKeywords: ["analyze sales pipeline spreadsheet", "google sheets crm ai", "deals by stage report"],
    og: { template: "use-case", eyebrow: "Use case", title: "Your pipeline sheet, answering back" },
    related: ["/chat-with-google-sheets", "/use-cases/finance-reporting-google-sheets", "/compare/wuup-vs-julius-ai"],
    persona: "Founders and sales leads who run the pipeline in a Google Sheet",
    lead:
      "Plenty of teams run their pipeline in a Google Sheet long before they buy a CRM. Share it with wuup as a viewer and ask about deals by stage, rep performance or stale opportunities; wuup reads the rows and answers with a table and the exact range it used.",
    sources: ["Google Sheets: Pipeline tab", "Google Sheets: Targets tab"],
    cover: "/images/use-cases/sales-pipeline-google-sheets.webp",
    problems: [
      "Pivot tables break whenever someone adds a column.",
      "Stale deals hide in long tabs.",
      "Quarter-end numbers need a manual roll-up.",
    ],
    workflow: [
      { title: "Share the sheet as Viewer", body: "Add wuup's service account email; nothing else changes." },
      { title: "Ask about the pipeline", body: "\"Open value by stage, and how it compares with target.\"" },
      { title: "Check the range", body: "Every answer names the tab and range it read." },
    ],
    exampleQuestions: [
      "Open pipeline value by stage",
      "Which rep has the highest win rate?",
      "Deals with no update in 30 days",
      "Pipeline vs target by month",
      "Average deal size by region",
      "Deals expected to close this month",
    ],
    qa: [
      { question: "What's the open pipeline by stage?", does: "Reads the Pipeline tab, filters open deals and sums value per stage.", read: "Pipeline!A1:H120" },
      { question: "Which rep has the highest win rate?", does: "Counts won vs lost deals per owner and computes the rate.", read: "Pipeline!A1:H120 (Owner, Stage)" },
      { question: "Which deals have gone stale?", does: "Compares Last activity with today and lists deals older than 30 days.", read: "Pipeline!A1:H120 (Last activity)" },
      { question: "How does pipeline compare with target?", does: "Reads both tabs and lines up months.", read: "Pipeline!A1:H120 and Targets!A1:C13" },
      { question: "What's the average deal size by region?", does: "Groups deal value by region and averages it.", read: "Pipeline!A1:H120 (Region, Value)" },
      { question: "What should close this month?", does: "Filters expected close dates in the current month and totals them.", read: "Pipeline!A1:H120 (Expected close)" },
    ],
    connectors: ["/chat-with-google-sheets"],
    tour: [
      { title: "Reads headers, not cell addresses", body: "Ask about \"Owner\" and \"Stage\"; wuup maps them to columns from the header row.", accent: "sky" },
      { title: "Across tabs", body: "Pipeline in one tab, targets in another: one question covers both.", accent: "blue" },
      { title: "No edits, ever", body: "The service account has read-only Sheets access, so your pipeline stays exactly as you left it.", accent: "indigo" },
    ],
    outcomes: ["Pipeline reviews driven by questions, not pivot tables.", "Stale deals surfaced before they slip.", "No CRM migration needed to get answers."],
    faqs: [
      {
        q: "How big can the pipeline sheet be?",
        a: "wuup reads up to 500 rows and 50 KB per request and says when a result was capped. Most pipeline sheets fit comfortably.",
      },
      {
        q: "Will it change my sheet?",
        a: "No. wuup's service account only has read-only access to Google Sheets.",
      },
    ],
  },
  {
    ...base,
    path: "/use-cases/finance-reporting-google-sheets",
    priority: "P1",
    title: "Finance reporting from Google Sheets with AI",
    description:
      "Ask budget, expense and revenue sheets in plain English: budget vs actual, spend trends and variances, answered with tables and the exact range read.",
    h1: "Finance questions,\nanswered from your sheets",
    navLabel: "Finance reporting (Sheets)",
    summary: "Budget vs actual, spend trends and variances from finance sheets.",
    primaryKeyword: "finance reporting google sheets ai",
    secondaryKeywords: ["budget vs actual google sheets", "expense analysis ai", "ai for financial spreadsheets"],
    og: { template: "use-case", eyebrow: "Use case", title: "Finance questions, answered from your sheets" },
    related: ["/chat-with-google-sheets", "/use-cases/sales-pipeline-google-sheets", "/use-cases/research-pdfs-and-spreadsheets"],
    persona: "Finance leads, founders and accountants who report from Google Sheets",
    lead:
      "Budgets, expense logs and revenue roll-ups often live in Google Sheets. Share them with wuup as a viewer and ask for budget vs actual, the fastest-growing cost or a month's variance; answers come as tables that cite the tab and range they read.",
    sources: ["Google Sheets: Budget", "Google Sheets: Expenses", "PDF: board pack"],
    cover: "/images/use-cases/finance-reporting-google-sheets.webp",
    problems: [
      "Month-end questions mean rebuilding the same formulas.",
      "Variance explanations live in someone's head.",
      "Numbers in a board pack PDF can't be cross-checked quickly.",
    ],
    workflow: [
      { title: "Share the finance sheets", body: "Viewer access for wuup's service account." },
      { title: "Ask the month-end questions", body: "\"Budget vs actual by department for September.\"" },
      { title: "Cross-check the board pack", body: "Upload the PDF and ask whether its figures match the sheet." },
    ],
    exampleQuestions: [
      "Budget vs actual by department",
      "Top 5 expense categories this quarter",
      "Which costs grew fastest month over month?",
      "Total spend by vendor",
      "Revenue run rate from the Summary tab",
      "Does the board pack match the sheet for Q3?",
    ],
    qa: [
      { question: "What's budget vs actual by department?", does: "Reads both tabs, joins on department and computes the variance.", read: "Budget!A1:N40 and Actuals!A1:N40" },
      { question: "What are the top expense categories this quarter?", does: "Filters the quarter's rows and sums by category.", read: "Expenses!A1:F480 (Date, Category, Amount)" },
      { question: "Which costs grew fastest?", does: "Compares month totals per category and ranks the change.", read: "Expenses!A1:F480" },
      { question: "How much did we pay each vendor?", does: "Groups expense rows by vendor and totals them.", read: "Expenses!A1:F480 (Vendor, Amount)" },
      { question: "What's the revenue run rate?", does: "Reads the latest month from the Summary tab and annualises it.", read: "Summary!A1:D13" },
      { question: "Does the board pack match the sheet?", does: "Reads the figures cited in the PDF and compares them with the sheet, citing both.", read: "Board-pack-Q3.pdf passages + Summary!A1:D13" },
    ],
    connectors: ["/chat-with-google-sheets", "/chat-with-pdf"],
    tour: [
      { title: "Variance in one question", body: "wuup lines up budget and actual tabs by their headers and computes the difference.", accent: "blue" },
      { title: "Sheets and PDFs together", body: "Cite the board pack and the sheet in the same answer.", accent: "indigo" },
      { title: "Range on every answer", body: "Auditors and colleagues can open the exact cells behind a number.", accent: "sky" },
    ],
    outcomes: ["Month-end questions answered in minutes.", "Cross-checks between documents and sheets.", "A clear trail from every number to its cells."],
    faqs: [
      {
        q: "Is it safe to connect finance sheets?",
        a: "The service account has read-only access to the sheets you share, and you can unshare at any time. Don't connect sheets you aren't allowed to share with a third-party service.",
      },
      {
        q: "Does it do accounting?",
        a: "No. wuup answers questions about your numbers; it doesn't book entries or replace your accounting system.",
      },
    ],
  },
  {
    ...base,
    path: "/use-cases/research-pdfs-and-spreadsheets",
    priority: "P2",
    title: "Research across PDFs and spreadsheets with AI",
    description:
      "Ask one question across PDF reports, papers and Google Sheets data. wuup answers with numbered citations to passages and the ranges it read.",
    h1: "Research across documents\nand data, cited",
    navLabel: "Research: PDFs and sheets",
    summary: "One question across PDF reports and spreadsheet data, with citations.",
    primaryKeyword: "ai research pdfs and spreadsheets",
    secondaryKeywords: ["ask questions across pdfs", "cited ai answers documents", "analyze reports and data together"],
    og: { template: "use-case", eyebrow: "Use case", title: "Research across documents and data, cited" },
    related: ["/chat-with-pdf", "/chat-with-google-sheets", "/compare/wuup-vs-notebooklm"],
    persona: "Analysts, consultants and researchers working from reports and datasets",
    lead:
      "Research rarely lives in one place: a few PDF reports, a dataset in a sheet, maybe a database. wuup answers one question across all of them, citing the passages it read in your documents and the ranges or queries it used in your data.",
    sources: ["PDF reports and papers", "TXT notes", "Google Sheets datasets", "MongoDB (optional)"],
    cover: "/images/use-cases/research-pdfs-and-spreadsheets.webp",
    problems: [
      "Copying numbers from reports into a sheet by hand.",
      "Answers from AI tools that can't say where a claim came from.",
      "Documents and data analysed in separate tools.",
    ],
    workflow: [
      { title: "Upload the documents", body: "PDF and TXT files go into your private knowledge base." },
      { title: "Connect the data", body: "Share the sheet, or connect MongoDB read-only." },
      { title: "Ask and verify", body: "Follow each numbered citation to its passage or range." },
    ],
    exampleQuestions: [
      "What do these three reports say about market size?",
      "Does the dataset support the paper's main claim?",
      "List every figure for 2025 revenue across the documents",
      "Which sources disagree, and how?",
      "Summarise the methodology sections",
      "Compare the forecast in the PDF with our actuals sheet",
    ],
    qa: [
      { question: "What do the reports say about market size?", does: "Retrieves passages mentioning market size from each report and cites them.", read: "Passages from 3 PDFs" },
      { question: "Does the dataset support the paper's claim?", does: "Reads the claim from the PDF, then the relevant rows from the sheet, and compares.", read: "Paper.pdf passages + Data!A1:F200" },
      { question: "Which 2025 revenue figures appear in the documents?", does: "Searches every document for 2025 revenue and lists each figure with its citation.", read: "Passages across the knowledge base" },
      { question: "Where do the sources disagree?", does: "Puts conflicting statements side by side, each with its citation.", read: "Passages from all uploaded files" },
      { question: "How was each study done?", does: "Summarises the methodology sections with page-level citations.", read: "Methodology passages" },
      { question: "How does the forecast compare with actuals?", does: "Reads forecast numbers from the PDF and actuals from the sheet, citing both.", read: "Forecast.pdf + Actuals!A1:D13" },
    ],
    connectors: ["/chat-with-pdf", "/chat-with-google-sheets", "/chat-with-mongodb"],
    tour: [
      { title: "Citations for documents and data", body: "Passages get numbered citations; sheet ranges and database queries are shown with the answer.", accent: "indigo" },
      { title: "Compare, don't just summarise", body: "Ask where sources agree or disagree and see each side cited.", accent: "blue" },
      { title: "Optional web search", body: "Turn on web search when you want public context next to your own sources.", accent: "sky" },
    ],
    outcomes: ["Faster literature and report reviews.", "Claims you can trace to a page or a cell.", "One workspace for documents and data."],
    faqs: [
      {
        q: "Can it read scanned papers?",
        a: "No. wuup reads the text layer of a PDF and does not run OCR, so scanned pages need OCR before upload.",
      },
      {
        q: "Does it search the web?",
        a: "Only if you turn web search on for a question. Otherwise it answers from your documents and data.",
      },
    ],
  },
];

export function getUseCase(path: string): UseCasePageFull | undefined {
  return useCases.find((u) => u.path === path);
}
