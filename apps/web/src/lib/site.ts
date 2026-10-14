/**
 * Site-wide constants and verified product facts.
 *
 * Every number in FACTS is checked against the bridge code in
 * packages/brain/src/bridges/mongo/{tools,guard,redact}.ts. If the code
 * changes, update FACTS so marketing copy never drifts from reality.
 */

export const SITE = {
  name: "wuup",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://wuup.in").replace(/\/+$/, ""),
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  locale: "en_IN",
  email: "abhigyan23018@iiitd.ac.in",
  founder: "Abhigyan Raj",
  country: "IN",
  sameAs: [] as string[],
} as const;

/** Absolute URL for a site path. "/" maps to the bare origin (no trailing slash). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (path === "/" || path === "") return SITE.url;
  return `${SITE.url}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** App entry points. Marketing CTAs link here. */
export const APP_HOME = "/chat";
export const LOGIN = "/login";
export const SIGNUP = "/login?mode=signup";

/** Launch priorities that are rendered. All published priorities ship. */
export const LAUNCH_PRIORITIES = ["P0", "P1", "P2"] as const;
export type LaunchPriority = (typeof LAUNCH_PRIORITIES)[number];

/**
 * Feature flags for copy. Pages that describe a feature declare
 * `requires: "<flag>"` and stay out of the sitemap until the flag is true.
 */
export const shipped = {
  researchMode: false,
  sandbox: false,
  exports: false,
  stopRegenerate: false,
  chatSearch: false,
  customInstructions: false,
  mdCsvUploads: false,
  byokKeyEncrypted: false,
} as const;

export type ShippedFlagName = keyof typeof shipped;

export const PRICING = {
  free: {
    name: "Free",
    price: 0,
    currency: "INR",
    questions: 50,
    model: "Gemini",
    summary: "50 questions on Gemini, no card needed",
  },
  byok: {
    name: "Bring your own key",
    price: 0,
    currency: "INR",
    providers: ["OpenAI", "Anthropic", "OpenRouter", "Gemini", "Groq"],
    summary: "Unlimited questions. You pay your AI provider directly.",
  },
} as const;

/** Verified product facts. Use these in copy instead of hard-coding numbers. */
export const FACTS = {
  /** tools.ts MAX_LIMIT: hard cap on rows per find/aggregate. */
  maxRowsPerQuery: 100,
  /** tools.ts DEFAULT_LIMIT: rows returned when the model does not ask for a limit. */
  defaultRowsPerQuery: 20,
  /** tools.ts MAX_RESULT_BYTES = 50 * 1024. */
  maxResultKb: 50,
  /** tools.ts QUERY_TIMEOUT_MS = 10000 (maxTimeMS on every query). */
  queryTimeoutS: 10,
  /** apps/api freeTierLimit. */
  freeQuestions: 50,
  /** guard.ts BLOCKED_OPERATORS. */
  blockedOperators: [
    "$out",
    "$merge",
    "$function",
    "$accumulator",
    "$where",
    "$currentOp",
    "$listSessions",
    "$listLocalSessions",
  ],
  /** guard.ts SYSTEM_DBS: never queryable, plus any "system.*" collection. */
  systemDatabases: ["admin", "local", "config"],
  /** guard.ts CROSS_COLLECTION_STAGES: must target an in-scope collection in the same db. */
  crossCollectionStages: ["$lookup", "$graphLookup", "$unionWith"],
  /** tools.ts aggregate(): allowDiskUse false. */
  allowDiskUse: false,
  /**
   * redact.ts SENSITIVE_FIELD_RE, case-insensitive, matched on the leaf field
   * name at any depth. Binary fields (e.g. embeddings) are hidden too.
   */
  redactedFieldPatterns: [
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "jwt",
    "api_key",
    "apikey",
    "private_key",
    "ssn",
    "cvv",
    "otp",
    "salt",
    "hash",
    "card_number",
    "credit_card",
  ],
  redactsBinaryFields: true,
  byokProviders: ["OpenAI", "Anthropic", "OpenRouter", "Gemini", "Groq"],
  sources: ["MongoDB", "Google Sheets", "PDF", "TXT"],
} as const;
