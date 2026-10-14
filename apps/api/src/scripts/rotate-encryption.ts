/**
 * Re-encrypts stored secrets under the current primary ENCRYPTION_KEY.
 *
 * Rotates Connection.config and User.customApiKeyEnc values that are in the
 * legacy `iv:tag:ct` format or were written under a previous key.
 *
 * Steps for a key rotation:
 *   1. ENCRYPTION_KEY_PREVIOUS=<old key>, ENCRYPTION_KEY=<new key>; deploy.
 *   2. npx tsx src/scripts/rotate-encryption.ts            (dry run, prints counts)
 *   3. npx tsx src/scripts/rotate-encryption.ts --apply    (writes)
 *   4. Once a dry run reports 0 pending, ENCRYPTION_KEY_PREVIOUS can be removed.
 *
 * Each write is conditional on the old ciphertext, so a value changed
 * concurrently is left alone (re-run to pick it up). Secrets are never logged.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Connection, User } from "@wup/models";
import { getCryptoService } from "@wup/brain";
import { env } from "../config/env";

interface Stats {
  scanned: number;
  pending: number;
  rotated: number;
  failed: number;
  skippedConcurrent: number;
}

const newStats = (): Stats => ({ scanned: 0, pending: 0, rotated: 0, failed: 0, skippedConcurrent: 0 });

async function rotateField(
  model: mongoose.Model<any>,
  field: string,
  apply: boolean,
  label: string
): Promise<Stats> {
  const svc = getCryptoService();
  const stats = newStats();
  const cursor = model
    .find({ [field]: { $type: "string", $ne: "" } }, { [field]: 1 })
    .lean()
    .cursor();

  for await (const doc of cursor as AsyncIterable<any>) {
    stats.scanned++;
    const current: string = doc[field];
    if (!svc.needsRotation(current)) continue;
    stats.pending++;
    let plain: string;
    try {
      plain = svc.decrypt(current);
    } catch {
      stats.failed++;
      console.warn(`[rotate] ${label} ${doc._id}: cannot decrypt with any key in the keyring`);
      continue;
    }
    if (!apply) continue;
    const next = svc.encrypt(plain);
    const res = await model.updateOne({ _id: doc._id, [field]: current }, { $set: { [field]: next } });
    if (res.modifiedCount === 1) stats.rotated++;
    else stats.skippedConcurrent++;
  }
  return stats;
}

export async function rotateEncryption(apply: boolean) {
  const connections = await rotateField(Connection as any, "config", apply, "Connection");
  const users = await rotateField(User as any, "customApiKeyEnc", apply, "User");
  return { connections, users };
}

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  try {
    const result = await rotateEncryption(apply);
    console.log(`[rotate] mode: ${apply ? "APPLY" : "dry run (pass --apply to write)"}`);
    console.log(`[rotate] primary key id: ${getCryptoService().primaryKid}`);
    console.log("[rotate] Connection.config:", result.connections);
    console.log("[rotate] User.customApiKeyEnc:", result.users);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[rotate] failed:", err?.message ?? err);
    process.exit(1);
  });
}
