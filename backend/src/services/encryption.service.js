/**
 * AES-256-GCM encryption/decryption service.
 *
 * Uses Node.js built-in `crypto` module.
 * Each encryption generates a unique 12-byte IV.
 * The encryption key is read from ENCRYPTION_KEY_B64 (Base64-encoded, 32 bytes).
 *
 * Encrypted envelope format:
 * {
 *   version: 1,
 *   algorithm: "aes-256-gcm",
 *   iv: "<base64>",
 *   authTag: "<base64>",
 *   ciphertext: "<base64>"
 * }
 */

const crypto = require('crypto');
const config = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const VERSION = 1;

/**
 * Derive the 32-byte encryption key from the Base64 env var.
 * Validated once at module load time.
 */
function getKey() {
  const key = Buffer.from(config.encryptionKeyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY_B64 must decode to exactly 32 bytes (got ${key.length}). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  return key;
}

const encryptionKey = getKey();

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The data to encrypt (typically JSON.stringify'd profile).
 * @returns {object} Encrypted envelope with version, algorithm, iv, authTag, and ciphertext.
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    version: VERSION,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext,
  };
}

/**
 * Decrypt an encrypted envelope back to plaintext.
 * @param {object} envelope - Object with { version, algorithm, iv, authTag, ciphertext }.
 * @returns {string} Decrypted plaintext string.
 */
function decrypt(envelope) {
  const { iv, authTag, ciphertext } = envelope;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

module.exports = { encrypt, decrypt };
