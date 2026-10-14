import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  EncryptionService,
  cryptoService,
  getCryptoService,
  needsRotation,
  resetCryptoService,
  resolveKeyring,
} from "../src/utils/crypto";

const KEY_A = "test-key-a-0123456789abcdef0123456789abcdef";
const KEY_B = "test-key-b-fedcba9876543210fedcba9876543210";

/** Produces legacy `iv:tag:ct` ciphertext exactly as the pre-v1 service did. */
function legacyEncrypt(secret: string, text: string): string {
  const key = crypto.scryptSync(secret, "wup-salt-2026", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc}`;
}

test("v1 round-trip and format", () => {
  const svc = new EncryptionService(KEY_A);
  const ct = svc.encrypt("mongodb+srv://user:pass@host/db");
  const parts = ct.split(".");
  assert.equal(parts.length, 5);
  assert.equal(parts[0], "v1");
  assert.match(parts[1], /^[0-9a-f]{8}$/);
  assert.equal(parts[1], svc.primaryKid);
  assert.equal(svc.decrypt(ct), "mongodb+srv://user:pass@host/db");
  assert.equal(svc.decrypt(svc.encrypt("")), "");
  assert.equal(svc.decrypt(svc.encrypt("unicode ✓ ünï")), "unicode ✓ ünï");
  assert.equal(svc.needsRotation(ct), false);
});

test("legacy iv:tag:ct ciphertext still decrypts, with any key in the ring", () => {
  const legacyA = legacyEncrypt(KEY_A, "secret-a");
  const legacyB = legacyEncrypt(KEY_B, "secret-b");
  const svc = new EncryptionService(KEY_B, [KEY_A]);
  assert.equal(svc.decrypt(legacyA), "secret-a");
  assert.equal(svc.decrypt(legacyB), "secret-b");
  assert.equal(svc.needsRotation(legacyA), true);
  assert.equal(svc.needsRotation(legacyB), true);
});

test("rotation: old v1 ciphertext decrypts via ENCRYPTION_KEY_PREVIOUS and needs rotation", () => {
  const oldSvc = new EncryptionService(KEY_A);
  const oldCt = oldSvc.encrypt("payload");

  const rotated = new EncryptionService([KEY_B, KEY_A]);
  assert.equal(rotated.decrypt(oldCt), "payload");
  assert.equal(rotated.needsRotation(oldCt), true);

  const newCt = rotated.encrypt(rotated.decrypt(oldCt));
  assert.equal(rotated.needsRotation(newCt), false);
  assert.notEqual(newCt.split(".")[1], oldCt.split(".")[1]);

  // Without the previous key the old ciphertext is unreadable
  assert.throws(() => new EncryptionService(KEY_B).decrypt(oldCt), /Unknown encryption key id/);
});

test("tampered tag, ciphertext or truncated tag fails", () => {
  const svc = new EncryptionService(KEY_A);
  const ct = svc.encrypt("hello world");
  const [v, kid, iv, tag, body] = ct.split(".");
  const flip = (hex: string) => (hex[0] === "0" ? "1" : "0") + hex.slice(1);
  assert.throws(() => svc.decrypt([v, kid, iv, flip(tag), body].join(".")));
  assert.throws(() => svc.decrypt([v, kid, iv, tag, flip(body)].join(".")));
  assert.throws(() => svc.decrypt([v, kid, iv, tag.slice(0, 8), body].join(".")), /Invalid encrypted format/);
  assert.throws(() => svc.decrypt("garbage"), /Invalid encrypted format/);

  const legacy = legacyEncrypt(KEY_A, "hello");
  const [liv, ltag, lct] = legacy.split(":");
  assert.throws(() => svc.decrypt(`${liv}:${flip(ltag)}:${lct}`));
});

test("lazy singleton reads env on first use; prod rejects missing or legacy keys", () => {
  const saved = { ...process.env };
  try {
    process.env.ENCRYPTION_KEY = KEY_A;
    process.env.ENCRYPTION_KEY_PREVIOUS = ` ${KEY_B} , `;
    resetCryptoService();
    const ct = cryptoService.encrypt("x");
    assert.equal(cryptoService.decrypt(ct), "x");
    assert.equal(getCryptoService().primaryKid, new EncryptionService(KEY_A).primaryKid);
    assert.equal(needsRotation(new EncryptionService(KEY_B).encrypt("y")), true);

    assert.deepEqual(resolveKeyring({ ENCRYPTION_KEY: "k", ENCRYPTION_KEY_PREVIOUS: "a, b" } as any), ["k", "a", "b"]);
    assert.throws(() => resolveKeyring({ NODE_ENV: "production" } as any), /ENCRYPTION_KEY/);
    assert.throws(
      () =>
        resolveKeyring({
          NODE_ENV: "production",
          ENCRYPTION_KEY: "wup_internal_default_secret_2026_do_not_use_in_prod",
        } as any),
      /ENCRYPTION_KEY/
    );
  } finally {
    process.env = saved;
    resetCryptoService();
  }
});
