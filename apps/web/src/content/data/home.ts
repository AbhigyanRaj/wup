import { FACTS } from "@/lib/site";
import type { HomeContent } from "../types";

/** Home page copy that is data rather than layout: the hero lead, example questions and FAQs. */
export const home: HomeContent = {
  eyebrow: "Read-only AI analyst for MongoDB, Sheets and PDFs",
  lead: "Connect MongoDB, Google Sheets or your PDFs. Get answers with charts built from real rows, and the queries behind them.",
  tour: [],
  exampleQuestions: [
    "Revenue by month for 2026",
    "Top 10 customers by order value",
    "Which plans churned most last quarter?",
  ],
  faqs: [
    {
      q: "Which databases work?",
      a: "MongoDB and Google Sheets today, plus PDFs and text files. PostgreSQL and MySQL are on the roadmap.",
    },
    {
      q: "Can wuup change or delete my data?",
      a: `No. Every MongoDB query goes through a read-only guard that blocks writes and server-side JavaScript, including ${FACTS.blockedOperators.slice(0, 4).join(", ")} and more. For extra safety, connect with a database user that only has read access.`,
    },
    {
      q: "Where do the numbers in a chart come from?",
      a: "From the rows your query returned. wuup builds every chart and table from those rows, and the model only writes the explanation around them. Open Queries used to see exactly what ran.",
    },
    {
      q: "What does the AI model see?",
      a: `The question, a summary of your schema and the rows a query returns, capped at ${FACTS.maxRowsPerQuery} rows and ${FACTS.maxResultKb} KB. Fields that look sensitive, such as passwords, tokens and card numbers, are removed before anything reaches the model.`,
    },
    {
      q: "Is wuup free?",
      a: `Your first ${FACTS.freeQuestions} questions are free on Gemini, with no card. After that you can add your own OpenAI, Anthropic, OpenRouter or Gemini key and pay the provider directly. wuup does not charge for it.`,
    },
    {
      q: "Do I need to sign up to try it?",
      a: "No. Try the demo opens an isolated sandbox with sample data, so you can ask questions before you connect anything of your own.",
    },
  ],
};
