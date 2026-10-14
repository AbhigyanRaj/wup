/**
 * Migration 003-lowercase-emails
 *
 * Normalises User.email to NFKC, trimmed, lowercase.
 *
 * For every User whose email differs from its normalised form:
 *   - if no other user owns the normalised address, update it in place
 *     (guarded on the old value);
 *   - otherwise it is a case-only duplicate: never merge or delete. Log both
 *     ids (not the emails) and leave the row untouched for manual review.
 * Idempotent: a second run finds only the logged collisions, which it skips again.
 * Once this has run in every environment, `lowercase: true` can be added to the
 * User email path.
 */
import { User } from "@wup/models";
import { normalizeEmail } from "../services/password";

export const id = "003-lowercase-emails";

type Ctx = { log?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void } } | undefined;

export async function up(ctx?: unknown): Promise<void> {
  const log = (ctx as Ctx)?.log ?? console;
  let updated = 0;
  let collisions = 0;

  // Candidates: anything with an uppercase letter, surrounding whitespace or non-ASCII.
  const cursor = User.find({ email: { $regex: /[A-Z]|^\s|\s$|[^\x00-\x7F]/ } })
    .select({ _id: 1, email: 1 })
    .lean()
    .cursor({ batchSize: 500 });

  for await (const u of cursor as AsyncIterable<any>) {
    if (typeof u.email !== "string") continue;
    const target = normalizeEmail(u.email);
    if (!target || target === u.email) continue;

    const owner: any = await User.findOne({ email: target, _id: { $ne: u._id } }).select({ _id: 1 }).lean();
    if (owner) {
      collisions++;
      log.warn?.(`[${id}] case-only duplicate, left for manual review: ${String(u._id)} vs ${String(owner._id)}`);
      continue;
    }
    try {
      const r = await User.updateOne({ _id: u._id, email: u.email }, { $set: { email: target } });
      if (r.modifiedCount) updated++;
    } catch (err: any) {
      if (err?.code === 11000) {
        // Another row took the address between our check and the update.
        collisions++;
        log.warn?.(`[${id}] case-only duplicate, left for manual review: ${String(u._id)}`);
        continue;
      }
      throw err;
    }
  }

  log.info?.(`[${id}] lowercased ${updated} email(s); ${collisions} collision(s) need manual review`);
}

export default { id, up };
