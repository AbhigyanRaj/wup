import type { ComponentType, SVGProps } from "react";
import {
  BookOpen,
  Braces,
  ChartColumn,
  Database,
  FileJson,
  FileSearch,
  FileText,
  GitCompare,
  GraduationCap,
  History,
  KeyRound,
  Layers,
  LibraryBig,
  LifeBuoy,
  ShieldCheck,
  ShoppingCart,
  Sheet,
  LayoutGrid,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * Header and drawer metadata per path: a 1.5px line icon and a short one-line
 * description (registry descriptions are 110 to 160 chars, too long for a menu).
 * Unknown paths fall back to a generic icon and a clipped registry description.
 */
const META: Record<string, { icon: Icon; short?: string }> = {
  "/features": { icon: LayoutGrid, short: "Everything wuup does, in one tour" },
  "/security": { icon: ShieldCheck, short: "Read-only guard, redaction, encryption" },
  "/pricing": { icon: Wallet, short: "Free to start, then your own key" },
  "/byok": { icon: KeyRound, short: "Use OpenAI, Anthropic, OpenRouter, Gemini or Groq" },
  "/changelog": { icon: History, short: "What shipped, week by week" },
  "/chat-with-mongodb": { icon: Database, short: "Read-only, schema-aware MongoDB answers" },
  "/chat-with-google-sheets": { icon: Sheet, short: "Ask across tabs like tables" },
  "/chat-with-pdf": { icon: FileText, short: "Cited answers from your documents" },
  "/use-cases/product-analytics-mongodb": { icon: TrendingUp, short: "Activation, retention and funnels" },
  "/use-cases/ecommerce-orders-mongodb": { icon: ShoppingCart, short: "Orders, revenue and repeat buyers" },
  "/use-cases/support-tickets-mongodb": { icon: LifeBuoy, short: "Volumes, response times, top issues" },
  "/use-cases/finance-reporting-google-sheets": { icon: ChartColumn, short: "Monthly reporting from your Sheets" },
  "/use-cases/sales-pipeline-google-sheets": { icon: Layers, short: "Pipeline, stages and win rates" },
  "/use-cases/research-pdfs-and-spreadsheets": { icon: FileSearch, short: "Reports and numbers side by side" },
  "/docs": { icon: BookOpen, short: "Set up sources, keys and scopes" },
  "/guides": { icon: GraduationCap, short: "MongoDB and AI analysis, explained" },
  "/tools": { icon: Wrench, short: "Free MongoDB query and pipeline tools" },
  "/compare": { icon: GitCompare, short: "How wuup stacks up, honestly" },
  "/glossary": { icon: LibraryBig, short: "Data and MongoDB terms, defined" },
  "/tools/mongodb-query-generator": { icon: Braces, short: "Plain English to a MongoDB query" },
  "/tools/mongodb-schema-from-json": { icon: FileJson, short: "Infer a schema from sample documents" },
};

export function navIcon(path: string): Icon {
  return META[path]?.icon ?? (path.startsWith("/tools") ? Braces : path.startsWith("/use-cases") ? TrendingUp : BookOpen);
}

export function navShort(path: string, fallback: string): string {
  const short = META[path]?.short;
  if (short) return short;
  const first = fallback.split(/(?<=[.:])\s/)[0] ?? fallback;
  return first.length > 64 ? `${first.slice(0, 61).trimEnd()}...` : first;
}
