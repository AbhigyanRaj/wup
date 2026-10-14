/**
 * Migration 002-encrypt-byok
 *
 * Encrypts legacy plaintext BYOK keys.
 *
 * For every User with a non-empty `customApiKey`:
 *   1. customApiKeyEnc  = cryptoService.encrypt(customApiKey), verified by a decrypt round trip
 *   2. customApiKeyHint = first 4 + last 4 characters (see keyHint)
 *   3. $unset customApiKey in the SAME update, filtered on { _id, customApiKey: <old value> }
 *      so a concurrent key change is not clobbered.
 * A user that already has customApiKeyEnc (half-migrated, or the key was re-saved)
 * keeps its encrypted key; only the stale plaintext copy is removed.
 *
 * Deliberately NOT done: resetting customApiProvider to null for users without
 * a key. The schema default is "gemini" (new users get it too), the legacy
 * GET /user/usage contract types `provider` as an optional string (null would
 * break it), and every reader only consults the provider when a key exists.
 *
 * Idempotent: a second run finds no non-empty customApiKey. Never logs key material.
 */
import { User } from "@wup/models";
import { encryptApiKey } from "../services/llmCredentials";

export const id = "002-encrypt-byok";

type Ctx = { log?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void } } | undefined;

export async function up(ctx?: unknown): Promise<void> {
  const log = (ctx as Ctx)?.log ?? console;
  let migrated = 0;
  let cleaned = 0;
  let skipped = 0;
  let failed = 0;

  const cursor = User.find({ customApiKey: { $type: "string", $ne: "" } })
    .select({ _id: 1, customApiKey: 1, customApiKeyEnc: 1 })
    .lean()
    .cursor({ batchSize: 200 });

  for await (const u of cursor as AsyncIterable<any>) {
    const plaintext: string = u.customApiKey;
    try {
      if (u.customApiKeyEnc) {
        const r = await User.updateOne({ _id: u._id, customApiKey: plaintext }, { $unset: { customApiKey: 1 } });
        if (r.modifiedCount) cleaned++;
        else skipped++;
        continue;
      }
      const { enc, hint } = encryptApiKey(plaintext);
      const r = await User.updateOne(
        { _id: u._id, customApiKey: plaintext },
        { $set: { customApiKeyEnc: enc, customApiKeyHint: hint }, $unset: { customApiKey: 1 } }
      );
      if (r.modifiedCount) migrated++;
      else skipped++; // the key changed concurrently; the next run (or lazy migration) handles it
    } catch (err: any) {
      failed++;
      log.warn?.(`[${id}] user ${String(u._id)}: ${err?.message ?? "encryption failed"}`);
    }
  }

  log.info?.(`[${id}] encrypted ${migrated}, removed ${cleaned} stale plaintext copies, skipped ${skipped}, failed ${failed}`);
  // Failures are not fatal: resolveLlmCredentials migrates any remaining plaintext key lazily.
}

export default { id, up };
