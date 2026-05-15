/**
 * VAULT ENCRYPTION ENGINE — AES-256-GCM
 * ───────────────────────────────────────
 * Server-only module. Uses Node.js native `crypto` for zero-cost encryption.
 * NEVER import this in middleware or edge-compatible code.
 *
 * Format: base64(iv:authTag:ciphertext)
 * IV = 12 bytes (96-bit, GCM standard)
 * Auth Tag = 16 bytes (128-bit, GCM default)
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENCODING: BufferEncoding = "base64";

/**
 * Derive the 32-byte key from the environment variable.
 * Supports both raw 32-byte hex keys (64 chars) and arbitrary passphrases
 * (hashed with SHA-256 to guarantee 32 bytes).
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "[VAULT_CRYPTO] ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // If it's a 64-char hex string, use it directly as 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Otherwise, hash the passphrase to get a deterministic 32-byte key
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a single base64 string containing IV + AuthTag + Ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: [IV (12)] [AuthTag (16)] [Ciphertext (N)]
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString(ENCODING);
}

/**
 * Decrypt a base64 blob produced by `encrypt()`.
 * Returns the original plaintext string.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const packed = Buffer.from(encryptedBase64, ENCODING);

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("[VAULT_CRYPTO] Encrypted data is too short or corrupted.");
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a string looks like it was encrypted by this module.
 * Useful for migrating existing plaintext credentials.
 */
export function isEncrypted(value: string): boolean {
  try {
    const packed = Buffer.from(value, ENCODING);
    return packed.length >= IV_LENGTH + TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
