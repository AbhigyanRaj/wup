/**
 * Typed, validated environment for the API.
 *
 * Import this right after `dotenv/config` (server.ts does). Everything else in
 * the API should read configuration from `env`, not from `process.env`.
 *
 * Production (NODE_ENV === "production") rules:
 *   - MONGODB_URI, JWT_SECRET, ENCRYPTION_KEY and CORS_ORIGIN are required.
 *   - JWT_SECRET / ENCRYPTION_KEY equal to the legacy public defaults are fatal.
 *   - A JWT_SECRET shorter than 32 chars is only a warning (an existing deploy
 *     must keep booting).
 *   - localhost entries in CORS_ORIGIN are dropped with a warning.
 *   - BRIDGE_ALLOW_PRIVATE_HOSTS=true is fatal (it disables SSRF protection).
 *
 * Optional numeric or boolean values that fail to parse fall back to their
 * default with a warning instead of crashing the deploy.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";

export const LEGACY_DEFAULT_JWT_SECRET = "wup_super_secret_brain_key_2026";
export const LEGACY_DEFAULT_ENCRYPTION_KEY = "wup_internal_default_secret_2026_do_not_use_in_prod";
export const MIN_JWT_SECRET_LENGTH = 32;

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

function readPackageVersion(): string {
  // src/config/env.ts and dist/config/env.js both sit two levels below apps/api
  try {
    const raw = fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8");
    const version = JSON.parse(raw)?.version;
    return typeof version === "string" ? version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const isLocalhostOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** Builds the zod schema. `warn` collects soft problems found while parsing. */
function buildSchema(warn: (msg: string) => void) {
  const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

  const str = () => z.preprocess(empty, z.string().optional());

  const num = (name: string, def: number, opts: { min?: number; int?: boolean } = {}) =>
    z.preprocess((v) => {
      v = empty(v);
      if (v === undefined) return undefined;
      const n = Number(v);
      const bad =
        !Number.isFinite(n) ||
        (opts.int !== false && !Number.isInteger(n)) ||
        (opts.min !== undefined && n < opts.min);
      if (bad) {
        warn(`${name}="${String(v)}" is not valid; using the default ${def}.`);
        return undefined;
      }
      return n;
    }, z.number().default(def));

  const bool = (name: string, def: boolean) =>
    z.preprocess((v) => {
      v = empty(v);
      if (v === undefined) return undefined;
      const s = String(v).trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(s)) return true;
      if (["0", "false", "no", "off"].includes(s)) return false;
      warn(`${name}="${String(v)}" is not a boolean; using the default ${def}.`);
      return undefined;
    }, z.boolean().default(def));

  const list = () =>
    z.preprocess((v) => {
      v = empty(v);
      if (v === undefined) return [];
      return String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }, z.array(z.string()));

  // "1" -> 1 hop, "true"/"false" -> boolean, anything else (e.g. "loopback") passes as a string
  const trustProxy = z.preprocess((v) => {
    v = empty(v);
    if (v === undefined) return 1;
    const s = String(v).trim();
    if (/^\d+$/.test(s)) return Number(s);
    if (s.toLowerCase() === "true") return true;
    if (s.toLowerCase() === "false") return false;
    return s;
  }, z.union([z.number(), z.boolean(), z.string()]));

  const logLevel = z.preprocess((v) => {
    v = empty(v);
    if (v === undefined) return undefined;
    const s = String(v).trim().toLowerCase();
    if ((LOG_LEVELS as readonly string[]).includes(s)) return s;
    warn(`LOG_LEVEL="${String(v)}" is not valid; using "info".`);
    return undefined;
  }, z.enum(LOG_LEVELS).default("info"));

  return z.object({
    NODE_ENV: z.preprocess(empty, z.string().default("development")),

    // Server
    PORT: num("PORT", 4000, { min: 0 }),
    TRUST_PROXY: trustProxy,
    LOG_LEVEL: logLevel,
    APP_VERSION: str(),
    SESSION_TTL_DAYS: num("SESSION_TTL_DAYS", 7, { min: 1 }),
    COOKIE_DOMAIN: str(),
    LEGACY_AUTO_SIGNUP: bool("LEGACY_AUTO_SIGNUP", true),

    // Database and secrets
    MONGODB_URI: str(),
    JWT_SECRET: str(),
    ENCRYPTION_KEY: str(),
    ENCRYPTION_KEY_PREVIOUS: str(),
    CORS_ORIGIN: str(),

    // Models
    GEMINI_API_KEY: str(),
    SERVER_MODEL_ALLOWLIST: list(),

    // Chat limits
    FREE_TIER_LIMIT: num("FREE_TIER_LIMIT", 50, { min: 0 }),
    MAX_PROMPT_CHARS: num("MAX_PROMPT_CHARS", 8000, { min: 1 }),
    CHAT_RATE_LIMIT_PER_MIN: num("CHAT_RATE_LIMIT_PER_MIN", 20, { min: 1 }),

    // Web search and research
    WEB_SEARCH_ENABLED: bool("WEB_SEARCH_ENABLED", true),
    RESEARCH_ENABLED: bool("RESEARCH_ENABLED", true),
    RESEARCH_COST: num("RESEARCH_COST", 3, { min: 0 }),
    RESEARCH_MAX_STEPS: num("RESEARCH_MAX_STEPS", 5, { min: 1 }),
    RESEARCH_TIMEOUT_MS: num("RESEARCH_TIMEOUT_MS", 180000, { min: 1000 }),

    // Google Sheets
    GOOGLE_SERVICE_ACCOUNT_JSON: str(),
    GOOGLE_SERVICE_ACCOUNT_JSON_PATH: str(),

    // Sample bridge and demo
    SAMPLE_MONGODB_URI: str(),
    SAMPLE_MONGODB_SCOPE: str(),
    DEMO_ENABLED: bool("DEMO_ENABLED", true),
    DEMO_TTL_HOURS: num("DEMO_TTL_HOURS", 24, { min: 1 }),
    DEMO_MESSAGE_LIMIT: num("DEMO_MESSAGE_LIMIT", 15, { min: 0 }),
    DEMO_MAX_ACTIVE: num("DEMO_MAX_ACTIVE", 500, { min: 0 }),

    // Uploads and RAG
    MAX_UPLOAD_SIZE_MB: num("MAX_UPLOAD_SIZE_MB", 20, { min: 1 }),
    MAX_SOURCES_PER_USER: num("MAX_SOURCES_PER_USER", 20, { min: 0 }),
    MAX_CHUNKS_PER_USER: num("MAX_CHUNKS_PER_USER", 5000, { min: 0 }),
    MAX_CHUNKS_PER_FILE: num("MAX_CHUNKS_PER_FILE", 500, { min: 1 }),
    UPLOAD_RATE_LIMIT_PER_HOUR: num("UPLOAD_RATE_LIMIT_PER_HOUR", 10, { min: 1 }),
    INGEST_CONCURRENCY: num("INGEST_CONCURRENCY", 2, { min: 1 }),
    RAG_MIN_COSINE: num("RAG_MIN_COSINE", 0.5, { int: false }),
    RAG_TOP_K: num("RAG_TOP_K", 6, { min: 1 }),

    // Bridges
    BRIDGE_ALLOW_PRIVATE_HOSTS: bool("BRIDGE_ALLOW_PRIVATE_HOSTS", false),
    BRIDGE_SUGGESTIONS: bool("BRIDGE_SUGGESTIONS", true),

    // Public tools (marketing site)
    PUBLIC_TOOLS_ENABLED: bool("PUBLIC_TOOLS_ENABLED", true),
    PUBLIC_TOOLS_DAILY_CAP: num("PUBLIC_TOOLS_DAILY_CAP", 3000, { min: 0 }),
    PUBLIC_TOOLS_MODEL: str(),
    TURNSTILE_SECRET_KEY: str(),

    // Render sets this; used as a version fallback
    RENDER_GIT_COMMIT: str(),
  });
}

type RawEnv = z.infer<ReturnType<typeof buildSchema>>;

export type Env = Omit<RawEnv, "MONGODB_URI" | "JWT_SECRET" | "CORS_ORIGIN" | "APP_VERSION" | "ENCRYPTION_KEY_PREVIOUS"> & {
  IS_PRODUCTION: boolean;
  IS_TEST: boolean;
  APP_VERSION: string;
  MONGODB_URI: string;
  /** Resolved signing secret (legacy default only outside production). */
  JWT_SECRET: string;
  /** ENCRYPTION_KEY_PREVIOUS split on commas. */
  ENCRYPTION_KEY_PREVIOUS: string[];
  /** Raw CORS_ORIGIN value. */
  CORS_ORIGIN: string;
  /** Exact origins allowed for CORS and CSRF checks (normalised, localhost dropped in production). */
  CORS_ORIGINS: string[];
};

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "EnvError";
  }
}

/**
 * Parses and validates an environment. Pure: does not log, returns warnings.
 * Throws EnvError on fatal misconfiguration.
 */
export function parseEnv(raw: NodeJS.ProcessEnv = process.env): { env: Env; warnings: string[] } {
  const warnings: string[] = [];
  const parsed = buildSchema((m) => warnings.push(m)).safeParse(raw);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const p = parsed.data;
  const isProd = p.NODE_ENV === "production";
  const errors: string[] = [];

  // MONGODB_URI
  let mongoUri = p.MONGODB_URI;
  if (!mongoUri) {
    if (isProd) errors.push("MONGODB_URI is required in production.");
    mongoUri = "mongodb://localhost:27017/wup";
  }

  // JWT_SECRET (same semantics as the security hotfix, plus a length warning)
  let jwtSecret = p.JWT_SECRET;
  if (isProd) {
    if (!jwtSecret || jwtSecret === LEGACY_DEFAULT_JWT_SECRET) {
      errors.push("JWT_SECRET must be set to a non-default value in production.");
    } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      warnings.push(
        `JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters. Rotate it to a longer random value.`
      );
    }
  } else if (!jwtSecret) {
    warnings.push("JWT_SECRET is not set; using the insecure development default.");
    jwtSecret = LEGACY_DEFAULT_JWT_SECRET;
  }

  // ENCRYPTION_KEY (crypto in @wup/brain enforces the same rule lazily)
  if (isProd && (!p.ENCRYPTION_KEY || p.ENCRYPTION_KEY === LEGACY_DEFAULT_ENCRYPTION_KEY)) {
    errors.push("ENCRYPTION_KEY must be set to a non-default value in production.");
  }
  const previousKeys = (p.ENCRYPTION_KEY_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // CORS_ORIGIN
  let corsRaw = p.CORS_ORIGIN;
  if (!corsRaw) {
    if (isProd) errors.push("CORS_ORIGIN is required in production.");
    corsRaw = "http://localhost:3000";
  }
  let origins = Array.from(new Set(corsRaw.split(",").map(normalizeOrigin).filter(Boolean)));
  if (isProd) {
    const local = origins.filter(isLocalhostOrigin);
    if (local.length) {
      warnings.push(`Ignoring localhost entries in CORS_ORIGIN in production: ${local.join(", ")}`);
      origins = origins.filter((o) => !isLocalhostOrigin(o));
    }
    if (p.CORS_ORIGIN && origins.length === 0) {
      warnings.push("CORS_ORIGIN has no usable origins in production; browsers will be blocked.");
    }
  }

  // SSRF guard must stay on in production
  if (isProd && p.BRIDGE_ALLOW_PRIVATE_HOSTS) {
    errors.push("BRIDGE_ALLOW_PRIVATE_HOSTS=true is not allowed in production.");
  }

  if (errors.length) throw new EnvError(errors);

  const version =
    p.APP_VERSION ??
    (p.RENDER_GIT_COMMIT ? `${readPackageVersion()}+${p.RENDER_GIT_COMMIT.slice(0, 7)}` : readPackageVersion());

  const env: Env = {
    ...p,
    IS_PRODUCTION: isProd,
    IS_TEST: p.NODE_ENV === "test",
    APP_VERSION: version,
    MONGODB_URI: mongoUri,
    JWT_SECRET: jwtSecret!,
    ENCRYPTION_KEY_PREVIOUS: previousKeys,
    CORS_ORIGIN: corsRaw,
    CORS_ORIGINS: origins,
  };
  return { env, warnings };
}

const loaded = parseEnv(process.env);

/** The validated environment of this process. */
export const env: Env = loaded.env;
/** Soft problems found while parsing; server.ts logs them at boot. */
export const envWarnings: readonly string[] = loaded.warnings;

/** The JWT signing secret (kept as a named export for existing importers). */
export const JWT_SECRET = env.JWT_SECRET;

/**
 * Whether a browser Origin may call the API with credentials.
 * Exact allowlist from CORS_ORIGIN; any localhost origin is accepted outside production.
 */
export function isAllowedOrigin(origin: string | undefined | null, e: Env = env): boolean {
  if (!origin) return false;
  const o = normalizeOrigin(origin);
  if (e.CORS_ORIGINS.includes(o)) return true;
  if (!e.IS_PRODUCTION && isLocalhostOrigin(o)) return true;
  return false;
}
