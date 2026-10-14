/**
 * Tracks models that are rate limited or out of quota, per API key.
 *
 * Entries are keyed by `${keyId}:${model}`, so one user's exhausted key never
 * hides a model from another user (or from the server key).
 *
 *   - A daily quota error (a "PerDay" quota id in the error details) cools the
 *     model down until the next midnight in America/Los_Angeles, which is when
 *     Google resets daily quotas.
 *   - Anything else uses the provider's retryDelay hint (default 60s, capped at 5min).
 */

export const DEFAULT_COOLDOWN_MS = 60_000;
export const MAX_COOLDOWN_MS = 5 * 60_000;

const QUOTA_TZ = "America/Los_Angeles";

interface ErrorLike {
  message?: string;
  errorDetails?: Array<Record<string, unknown>>;
  retryAfterMs?: number;
}

/** UTC offset (ms) of the quota timezone at the given instant. */
function tzOffsetMs(at: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: QUOTA_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(at / 1000) * 1000;
}

/** The next midnight in America/Los_Angeles after `now`, as epoch ms. */
export function nextQuotaReset(now: number): number {
  const offset = tzOffsetMs(now);
  const wall = new Date(now + offset);
  const nextWallMidnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1);
  // Midnight may fall on the other side of a DST change, so use the offset at that instant.
  const guess = nextWallMidnight - offset;
  return nextWallMidnight - tzOffsetMs(guess);
}

/** Parses "37s" / "1.5s" style retry delays from Google RetryInfo. */
function parseRetryDelay(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Math.round(parseFloat(m[1]) * 1000) : undefined;
}

export function isDailyQuotaError(err: ErrorLike | undefined): boolean {
  if (!err) return false;
  try {
    return JSON.stringify(err.errorDetails ?? "").includes("PerDay") || /PerDay/.test(err.message ?? "");
  } catch {
    return false;
  }
}

export class ModelHealth {
  private until = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  private key(keyId: string, model: string) {
    return `${keyId}:${model}`;
  }

  /** Records a quota/rate-limit error and returns when the model is usable again. */
  markExhausted(keyId: string, model: string, err?: ErrorLike): number {
    const now = this.now();
    let until: number;
    if (isDailyQuotaError(err)) {
      until = nextQuotaReset(now);
    } else {
      const retry = err?.errorDetails?.find((d) => typeof d?.["@type"] === "string" && String(d["@type"]).endsWith("RetryInfo"));
      const hinted = parseRetryDelay(retry?.retryDelay) ?? err?.retryAfterMs;
      const delay = Math.min(Math.max(hinted ?? DEFAULT_COOLDOWN_MS, 1000), MAX_COOLDOWN_MS);
      until = now + delay;
    }
    const k = this.key(keyId, model);
    this.until.set(k, Math.max(until, this.until.get(k) ?? 0));
    return this.until.get(k)!;
  }

  /** Epoch ms when the model frees up, or null when it is available now. */
  cooldownUntil(keyId: string, model: string): number | null {
    const k = this.key(keyId, model);
    const t = this.until.get(k);
    if (t === undefined) return null;
    if (t <= this.now()) {
      this.until.delete(k);
      return null;
    }
    return t;
  }

  isAvailable(keyId: string, model: string): boolean {
    return this.cooldownUntil(keyId, model) === null;
  }

  /** Models currently cooling down for this key. */
  exhausted(keyId: string): string[] {
    const prefix = `${keyId}:`;
    const out: string[] = [];
    for (const k of [...this.until.keys()]) {
      if (!k.startsWith(prefix)) continue;
      const model = k.slice(prefix.length);
      if (!this.isAvailable(keyId, model)) out.push(model);
    }
    return out;
  }

  /** Test helper. */
  clear() {
    this.until.clear();
  }
}

/** Process-wide model health (in-memory; resets on restart). */
export const modelHealth = new ModelHealth();
