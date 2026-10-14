import crypto from "crypto";

/**
 * Robust AES-256-GCM encryption for securing database credentials.
 * This ensures secrets are never stored in plain text.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;

export class EncryptionService {
  private readonly key: Buffer;

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error("Encryption Secret Key is required");
    }
    // Fixed key derivation to ensure 32 bytes for AES-256
    this.key = crypto.scryptSync(secretKey, "wup-salt-2026", 32);
  }

  /**
   * Encrypts a plain text string into an encoded format
   * Result format: iv:tag:content
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypts an encoded string back to plain text
   */
  decrypt(encoded: string): string {
    const [ivHex, tagHex, encryptedText] = encoded.split(":");
    
    if (!ivHex || !tagHex || !encryptedText) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

// Legacy development fallback. Never acceptable in production.
const LEGACY_DEFAULT_KEY = "wup_internal_default_secret_2026_do_not_use_in_prod";

/**
 * Resolves the encryption key. In production a missing key, or the legacy
 * default key, is a fatal misconfiguration (fail fast at module load) because
 * it would mean every stored credential is encrypted with a public key.
 */
export function resolveEncryptionKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.ENCRYPTION_KEY;
  if (env.NODE_ENV === "production") {
    if (!key || key === LEGACY_DEFAULT_KEY) {
      throw new Error(
        "ENCRYPTION_KEY must be set to a non-default value in production"
      );
    }
    return key;
  }
  if (!key) {
    console.warn(
      "[WUP Crypto] ENCRYPTION_KEY is not set; using the insecure development default."
    );
    return LEGACY_DEFAULT_KEY;
  }
  return key;
}

// Singleton instance (initialized from env)
export const cryptoService = new EncryptionService(resolveEncryptionKey());
