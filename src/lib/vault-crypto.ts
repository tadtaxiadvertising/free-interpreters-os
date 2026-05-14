import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Derives a consistent encryption key from the APP_SECRET env variable.
 */
function getKey() {
  const secret = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing APP_SECRET or NEXTAUTH_SECRET for Vault encryption.");
  }
  // Use a fixed salt to ensure key is deterministic across restarts
  return crypto.scryptSync(secret, 'vault_salt_v1', 32);
}

/**
 * Encrypts a plaintext password using AES-256-GCM.
 * Returns a payload containing iv, tag, and the ciphertext.
 */
export function encryptPassword(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to plaintext.
 */
export function decryptPassword(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:tag:ciphertext');
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = getKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
