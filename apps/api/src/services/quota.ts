import { User } from "@wup/models";
import { HttpError } from "../lib/httpError";
import { hasOwnKey } from "../dto/user";

export interface QuotaReservation {
  userId: string;
  cost: number;
  /** False when nothing was charged (BYOK user, or a zero cost). */
  charged: boolean;
  /** Set once settleQuota has run, so a reservation is never refunded twice. */
  settled: boolean;
}

/**
 * Reserves `cost` free-tier messages for one request.
 *
 * BYOK users (a stored key, and not a demo account) are never charged.
 * Everyone else is charged with one atomic conditional update, so concurrent
 * requests can never push usage past the limit: the filter only matches while
 * freeTierUsage + cost <= freeTierLimit.
 *
 * Throws HttpError 429 FREE_LIMIT_REACHED when the reservation does not fit.
 */
export async function reserveQuota(user: any, cost = 1): Promise<QuotaReservation> {
  const userId = String(user?._id ?? user?.id ?? user);
  const n = Math.max(0, Math.floor(Number(cost) || 0));

  if ((hasOwnKey(user) && !user?.isDemo) || n === 0) {
    return { userId, cost: n, charged: false, settled: false };
  }

  const r = await User.updateOne(
    {
      _id: userId,
      $expr: { $lte: [{ $add: [{ $ifNull: ["$freeTierUsage", 0] }, n] }, { $ifNull: ["$freeTierLimit", 0] }] },
    },
    { $inc: { freeTierUsage: n } }
  );

  if (r.modifiedCount === 0) {
    throw new HttpError(
      429,
      "FREE_LIMIT_REACHED",
      "You have used all your free messages. Add your own API key in settings to keep going."
    );
  }
  return { userId, cost: n, charged: true, settled: false };
}

/**
 * Settles a reservation. When the request produced no output (provider error,
 * abort before the first token), the charge is refunded. Safe to call twice.
 */
export async function settleQuota(r: QuotaReservation, producedOutput: boolean): Promise<void> {
  if (!r || r.settled) return;
  r.settled = true;
  if (!r.charged || producedOutput || r.cost <= 0) return;
  // Guarded so a refund can never take usage below zero.
  await User.updateOne(
    { _id: r.userId, freeTierUsage: { $gte: r.cost } },
    { $inc: { freeTierUsage: -r.cost } }
  );
}
