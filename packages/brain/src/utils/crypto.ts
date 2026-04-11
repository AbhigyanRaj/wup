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

// Singleton instance with default check (should be initialized via env)
const DEFAULT_KEY = process.env.ENCRYPTION_KEY || "wup_internal_default_secret_2026_do_not_use_in_prod";
export const cryptoService = new EncryptionService(DEFAULT_KEY);
