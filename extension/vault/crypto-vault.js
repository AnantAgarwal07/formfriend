/*
 * FormFriend client-side encryption prototype.
 *
 * This module is intentionally standalone so it can be tested in a normal
 * browser before being integrated into the extension.
 *
 * Design:
 * - DEK: random AES-256-GCM key encrypting the profile.
 * - KEK: AES-256-GCM key derived from passphrase + random salt using PBKDF2-HMAC-SHA256.
 * - The DEK is wrapped with the KEK; the raw DEK is NEVER uploaded.
 * - Profile encryption and DEK wrapping use separate IVs.
 * - Cognito `sub` is used as AES-GCM additional authenticated data (AAD).
 * - After recovery, the DEK is stored as a non-extractable CryptoKey in IndexedDB.
 */

const DB_NAME = 'formfriend-crypto-test';
const DB_VERSION = 1;
const KEY_STORE = 'keys';
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BITS = 256;

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB'));
  });
}

async function storeLocalDek(userId, dek) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put(dek, userId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Failed to store local key'));
  });
  db.close();
}

async function getLocalDek(userId) {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly');
    const request = tx.objectStore(KEY_STORE).get(userId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Failed to read local key'));
  });
  db.close();
  return value;
}

async function deleteLocalDek(userId) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).delete(userId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Failed to delete local key'));
  });
  db.close();
}

async function deriveKek(passphrase, salt) {
  if (!passphrase) throw new Error('Passphrase is required for key recovery.');

  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

async function generateDek() {
  // Must be extractable temporarily because WebCrypto wrapKey needs an
  // extractable key. It is immediately re-imported as non-extractable.
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: DEK_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

async function makeNonExtractableDek(dek) {
  const raw = await crypto.subtle.exportKey('raw', dek);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptProfile(profile, dek, userId) {
  const iv = randomBytes(IV_BYTES);
  const plaintext = enc.encode(JSON.stringify(profile));
  const aad = enc.encode(userId);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
      tagLength: 128
    },
    dek,
    plaintext
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv)
  };
}

async function decryptProfile(bundle, dek, userId) {
  const ciphertext = base64ToBytes(bundle.ciphertext);
  const iv = base64ToBytes(bundle.iv);
  const aad = enc.encode(userId);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
      tagLength: 128
    },
    dek,
    ciphertext
  );

  return JSON.parse(dec.decode(plaintext));
}

async function wrapDek(dekExtractable, kek, userId) {
  const wrapIv = randomBytes(IV_BYTES);
  const aad = enc.encode(userId);

  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    dekExtractable,
    kek,
    {
      name: 'AES-GCM',
      iv: wrapIv,
      additionalData: aad,
      tagLength: 128
    }
  );

  return {
    wrappedDek: bytesToBase64(new Uint8Array(wrapped)),
    wrapIv: bytesToBase64(wrapIv)
  };
}

async function unwrapDek(bundle, kek, userId) {
  const wrappedDek = base64ToBytes(bundle.wrappedDek);
  const wrapIv = base64ToBytes(bundle.wrapIv);
  const aad = enc.encode(userId);

  return crypto.subtle.unwrapKey(
    'raw',
    wrappedDek,
    kek,
    {
      name: 'AES-GCM',
      iv: wrapIv,
      additionalData: aad,
      tagLength: 128
    },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function createAndSaveProfile({ userId, profile, passphrase }) {
  const salt = randomBytes(SALT_BYTES);
  const dekExtractable = await generateDek();
  const kek = await deriveKek(passphrase, salt);
  const profileCipher = await encryptProfile(profile, dekExtractable, userId);
  const wrapped = await wrapDek(dekExtractable, kek, userId);
  const dekLocal = await makeNonExtractableDek(dekExtractable);

  await storeLocalDek(userId, dekLocal);

  const cloudBundle = {
    version: 1,
    userId,
    encryptedProfile: profileCipher,
    wrappedDek: wrapped.wrappedDek,
    wrapIv: wrapped.wrapIv,
    salt: bytesToBase64(salt),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS
    },
    encryption: {
      name: 'AES-GCM',
      keyBits: 256,
      ivBytes: IV_BYTES,
      aad: 'cognito-sub'
    },
    createdAt: new Date().toISOString()
  };

  return cloudBundle;
}

async function decryptWithLocalKey({ userId, cloudBundle }) {
  const dek = await getLocalDek(userId);
  if (!dek) throw new Error('No local DEK found for this user/device.');
  return decryptProfile(cloudBundle.encryptedProfile, dek, userId);
}

async function recoverOnNewDevice({ userId, cloudBundle, passphrase }) {
  if (cloudBundle.userId !== userId) {
    throw new Error('Bundle userId does not match the authenticated user.');
  }

  const salt = base64ToBytes(cloudBundle.salt);
  const kek = await deriveKek(passphrase, salt);
  const dek = await unwrapDek(cloudBundle, kek, userId);

  await storeLocalDek(userId, dek);

  return decryptProfile(cloudBundle.encryptedProfile, dek, userId);
}

async function clearDeviceKey(userId) {
  await deleteLocalDek(userId);
}

async function hasDeviceKey(userId) {
  return Boolean(await getLocalDek(userId));
}

window.FormFriendCrypto = {
  PBKDF2_ITERATIONS,
  createAndSaveProfile,
  decryptWithLocalKey,
  recoverOnNewDevice,
  clearDeviceKey,
  hasDeviceKey,
  getLocalDek
};
