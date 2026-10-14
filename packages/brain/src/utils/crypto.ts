import crypto from "crypto";
import { brainLog } from "./logger";

/**
 * AES-256-GCM encryption for stored secrets (bridge configs, BYOK keys).
 *
 * Ciphertext formats:
 *   v1:      v1.<kid>.<ivHex>.<tagHex>.<ctHex>   (written by encrypt)
 *   legacy:  <ivHex>:<tagHex>:<ctHex>            (still decrypted)
 *
 * Keys are derived with scrypt(secret, "wup-salt-2026", 32). `kid` is the first
 * 8 hex chars of sha256(derivedKey), so a ciphertext names the key it needs.
 *
 * Keyring: ENCRYPTION_KEY (primary, used for new ciphertext) followed by
 * ENCRYPTION_KEY_PREVIOUS (comma-separated, decrypt only). To rotate: move the
 * old key into ENCRYPTION_KEY_PREVIOUS, set a new ENCRYPTION_KEY, deploy, then
 * run apps/api/src/scripts/rotate-encryption.ts.
 *
 * `cryptoService` is lazy: the keyring is read from process.env on first use,
 * so importing this module never depends on env load order.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_SALT = "wup-salt-2026";
const V1_PREFIX = "v1";

// Legacy development fallback. Never acceptable in production.
const LEGACY_DEFAULT_KEY = "wup_internal_default_secret_2026_do_not_use_in_prod";

interface KeyEntry {
  kid: string;
  key: Buffer;
}

function deriveKey(secret: string): KeyEntry {
  const key = crypto.scryptSync(secret, KEY_SALT, 32);
  const kid = crypto.createHash("sha256").update(key).digest("hex").slice(0, 8);
  return { kid, key };
}

function isHex(s: string): boolean {
  return s.length > 0 && s.length % 2 === 0 && /^[0-9a-f]+$/i.test(s);
}

export class EncryptionService {
  private readonly keys: KeyEntry[];

  /**
   * @param secretKey the primary secret, or [primary, ...previous] secrets
   * @param previousKeys extra decrypt-only secrets
   */
  constructor(secretKey: string | string[], previousKeys: string[] = []) {
    const secrets = (Array.isArray(secretKey) ? secretKey : [secretKey, ...previousKeys]).filter(
      (s) => typeof s === "string" && s.length > 0
    );
    const primary = Array.isArray(secretKey) ? secretKey[0] : secretKey;
    if (!primary) {
      throw new Error("Encryption Secret Key is required");
    }
    const seen = new Set<string>();
    this.keys = [];
    for (const s of secrets) {
      const entry = deriveKey(s);
      if (seen.has(entry.kid)) continue;
      seen.add(entry.kid);
      this.keys.push(entry);
    }
  }

  /** Key id of the primary key. */
  get primaryKid(): string {
    return this.keys[0].kid;
  }

  /** Encrypts plain text into the v1 format with the primary key. */
  encrypt(text: string): string {
    const { kid, key } = this.keys[0];
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();
    return `${V1_PREFIX}.${kid}.${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
  }

  /** Decrypts v1 or legacy ciphertext. Throws if no key can authenticate it. */
  decrypt(encoded: string): string {
    if (typeof encoded !== "string" || !encoded) {
      throw new Error("Invalid encrypted format");
    }

    if (encoded.startsWith(`${V1_PREFIX}.`)) {
      const parts = encoded.split(".");
      if (parts.length !== 5) throw new Error("Invalid encrypted format");
      const [, kid, ivHex, tagHex, ctHex] = parts;
      if (!isHex(ivHex) || !isHex(tagHex) || (ctHex.length > 0 && !isHex(ctHex))) {
        throw new Error("Invalid encrypted format");
      }
      const entry = this.keys.find((k) => k.kid === kid);
      if (!entry) throw new Error("Unknown encryption key id");
      return this.decryptWith(entry.key, ivHex, tagHex, ctHex);
    }

    const [ivHex, tagHex, encryptedText] = encoded.split(":");
    if (!ivHex || !tagHex || !encryptedText) {
      throw new Error("Invalid encrypted format");
    }
    let lastErr: unknown;
    for (const { key } of this.keys) {
      try {
        return this.decryptWith(key, ivHex, tagHex, encryptedText);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Unable to decrypt");
  }

  /**
   * True when `encoded` should be re-encrypted: legacy format, or v1 under a
   * key that is not the primary one.
   */
  needsRotation(encoded: string): boolean {
    if (typeof encoded !== "string" || !encoded) return false;
    if (!encoded.startsWith(`${V1_PREFIX}.`)) return encoded.split(":").length === 3;
    const kid = encoded.split(".")[1];
    return kid !== this.primaryKid;
  }

  private decryptWith(key: Buffer, ivHex: string, tagHex: string, ctHex: string): string {
    // Exact lengths: GCM would otherwise accept a truncated (forgeable) tag.
    if (ivHex.length !== IV_LENGTH * 2 || tagHex.length !== TAG_LENGTH * 2 || !isHex(ivHex) || !isHex(tagHex)) {
      throw new Error("Invalid encrypted format");
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(ctHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

/**
 * Resolves the primary encryption key. In production a missing key, or the
 * legacy default key, is a fatal misconfiguration because it would mean every
 * stored credential is encrypted with a public key.
 */
export function resolveEncryptionKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.ENCRYPTION_KEY;
  if (env.NODE_ENV === "production") {
    if (!key || key === LEGACY_DEFAULT_KEY) {
      throw new Error("ENCRYPTION_KEY must be set to a non-default value in production");
    }
    return key;
  }
  if (!key) {
    brainLog.warn("ENCRYPTION_KEY is not set; using the insecure development default.");
    return LEGACY_DEFAULT_KEY;
  }
  return key;
}

/** Primary key followed by ENCRYPTION_KEY_PREVIOUS entries. */
export function resolveKeyring(env: NodeJS.ProcessEnv = process.env): string[] {
  const primary = resolveEncryptionKey(env);
  const previous = (env.ENCRYPTION_KEY_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [primary, ...previous];
}

let instance: EncryptionService | null = null;

/** The process-wide service, built from env on first call. Throws on bad prod config. */
export function getCryptoService(): EncryptionService {
  if (!instance) instance = new EncryptionService(resolveKeyring());
  return instance;
}

/** Drops the cached service so the next use re-reads env (tests, key rotation). */
export function resetCryptoService(): void {
  instance = null;
}

/** Lazy singleton facade: the keyring is resolved on first use, not at import. */
export const cryptoService = {
  encrypt: (text: string): string => getCryptoService().encrypt(text),
  decrypt: (encoded: string): string => getCryptoService().decrypt(encoded),
  needsRotation: (encoded: string): boolean => getCryptoService().needsRotation(encoded),
};

/** Module-level helper: whether a stored ciphertext should be re-encrypted. */
export function needsRotation(encoded: string): boolean {
  return getCryptoService().needsRotation(encoded);
}
