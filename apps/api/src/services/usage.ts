import { UsageDaily } from "@wup/models";
import type { UsageDay } from "@wup/contracts";

export const MAX_USAGE_DAYS = 90;
export const DEFAULT_USAGE_DAYS = 30;

export interface UsageEvent {
  /** "research" counts toward research runs, anything else is a chat message. */
  mode?: "chat" | "research" | string;
  tokensIn?: number;
  tokensOut?: number;
  provider?: string | null;
}

/** "YYYY-MM-DD" for a date's UTC day. */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const nonNeg = (n: unknown) => {
  const v = Math.floor(Number(n) || 0);
  return v > 0 ? v : 0;
};

/** Provider names become object keys in byProvider; keep them to a safe charset. */
const providerKey = (p: unknown) => {
  const s = String(p ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return s.slice(0, 32) || "unknown";
};

/**
 * Records one completed request on the user's UTC-day row with a single
 * $inc upsert (the { userId, day } unique index is the upsert key).
 * Never throws: usage accounting must not fail a user request.
 */
export async function recordUsage(userId: unknown, event: UsageEvent = {}): Promise<void> {
  const isResearch = event.mode === "research";
  const tokensIn = nonNeg(event.tokensIn);
  const tokensOut = nonNeg(event.tokensOut);
  const inc: Record<string, number> = {
    messages: isResearch ? 0 : 1,
    research: isResearch ? 1 : 0,
    tokensIn,
    tokensOut,
  };
  if (event.provider) {
    const p = providerKey(event.provider);
    inc[`byProvider.${p}.messages`] = 1;
    inc[`byProvider.${p}.tokensIn`] = tokensIn;
    inc[`byProvider.${p}.tokensOut`] = tokensOut;
  }
  try {
    await UsageDaily.updateOne({ userId, day: utcDay() }, { $inc: inc }, { upsert: true, setDefaultsOnInsert: false });
  } catch (err: any) {
    // A duplicate key error on a racing first upsert of the day: retry once as a plain update.
    if (err?.code === 11000) {
      await UsageDaily.updateOne({ userId, day: utcDay() }, { $inc: inc }).catch(() => {});
      return;
    }
    console.error("[WUP API] recordUsage failed:", err?.message ?? err);
  }
}

export function clampDays(raw: unknown): number {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_USAGE_DAYS;
  return Math.min(n, MAX_USAGE_DAYS);
}

/** Daily usage for the last `days` UTC days (oldest first, zero-filled) plus totals. */
export async function getUsage(
  user: any,
  days: number = DEFAULT_USAGE_DAYS
): Promise<{ daily: UsageDay[]; totals: { messages: number; research: number; tokensIn: number; tokensOut: number } }> {
  const n = clampDays(days);
  const today = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    keys.push(utcDay(d));
  }

  const rows: any[] = await UsageDaily.find({ userId: user?._id ?? user, day: { $gte: keys[0], $lte: keys[keys.length - 1] } })
    .select({ day: 1, messages: 1, research: 1, tokensIn: 1, tokensOut: 1 })
    .lean();
  const byDay = new Map(rows.map((r) => [r.day, r]));

  const daily: UsageDay[] = keys.map((date) => {
    const r = byDay.get(date);
    return {
      date,
      messages: Number(r?.messages ?? 0),
      research: Number(r?.research ?? 0),
      tokensIn: Number(r?.tokensIn ?? 0),
      tokensOut: Number(r?.tokensOut ?? 0),
    };
  });

  const totals = daily.reduce(
    (t, d) => ({
      messages: t.messages + d.messages,
      research: t.research + d.research,
      tokensIn: t.tokensIn + d.tokensIn,
      tokensOut: t.tokensOut + d.tokensOut,
    }),
    { messages: 0, research: 0, tokensIn: 0, tokensOut: 0 }
  );

  return { daily, totals };
}
