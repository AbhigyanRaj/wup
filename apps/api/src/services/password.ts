import bcrypt from "bcryptjs";

/** bcrypt work factor for new hashes. Older cost-10 hashes are upgraded on login. */
export const BCRYPT_COST = 12;

/**
 * A real cost-12 hash of a random string nobody knows. Compared against when
 * the account does not exist, so an unknown email costs the same time as a
 * wrong password.
 */
const DUMMY_HASH = "$2a$12$hlU/Sbwi6.sQynZeB8MkKeMKZE/tgD19B8IGU2yoNbkmD/D/9dBiW";

export function normalizeEmail(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Compares a password with a stored hash. With no hash (unknown user, demo
 * user) it still runs a full bcrypt compare against a dummy hash and returns false.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash || typeof hash !== "string" || !hash.startsWith("$2")) {
    await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** True when a stored hash should be re-hashed at the current cost. */
export function needsRehash(hash: string | null | undefined): boolean {
  if (!hash) return false;
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST;
  } catch {
    return false;
  }
}

/**
 * New passwords must not contain the email's local part (case-insensitive).
 * Very short local parts (1-2 chars) are ignored, they would ban most passwords.
 */
export function passwordContainsEmail(password: string, email: string): boolean {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  if (local.length < 3) return false;
  return password.normalize("NFKC").toLowerCase().includes(local);
}
