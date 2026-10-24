/**
 * Developer signing-key management.
 *
 * - The Ed25519 key pair is generated once with a CSPRNG (expo-crypto).
 * - The 64-byte secret key is stored ONLY in expo-secure-store
 *   (Android Keystore / iOS Keychain backed; AES-GCM encrypted prefs on web).
 * - The 32-byte public key is stored alongside for display + verification,
 *   and can be exported for embedding in the customer app.
 * - Encrypted key backup: the secret key is sealed with NaCl secretbox
 *   (XSalsa20-Poly1305) under a key derived from the developer's backup
 *   password via iterated SHA-512 (100k rounds). Wrong password (or any
 *   tampering) fails authentication — nothing is restored.
 * - Every load validates the secret key and re-derives the public key; a
 *   corrupted key blocks issuance with a clear error.
 */
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import {
  base64Encode,
  base64Decode,
  base64UrlEncode,
  base64UrlDecode,
  utf8Encode,
  utf8Decode,
  hexEncode,
  fingerprintOf,
  secureRandomBytes,
  ensureSecurePRNG,
} from './helpers';
import { LicenseError } from './errors';

ensureSecurePRNG();

const SECRET_KEY_ITEM = 'pm_dev_secret_key_b64';
const PUBLIC_KEY_ITEM = 'pm_dev_public_key_b64';
const META_ITEM = 'pm_dev_key_meta_v1';

const BACKUP_PREFIX = 'PMKB1';
const KDF_ROUNDS = 100000;

export interface KeyMeta {
  createdAt: number;
  fingerprint: string;
}

export interface KeyInfo {
  publicKey: Uint8Array;
  publicKeyBase64: string;
  publicKeyHex: string;
  fingerprint: string;
  fingerprintGrouped: string;
  createdAt: number;
}

export interface KeyPairMaterial {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } catch (e) {
    throw new LicenseError(
      'STORAGE_ERROR',
      'تعذر الوصول إلى التخزين الآمن. على الويب تأكد من السماح بالتخزين المحلي.'
    );
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // best effort
  }
}

/** True only when a VALID 64-byte secret key exists in secure storage. */
export async function hasValidSigningKey(): Promise<boolean> {
  try {
    await loadKeyMaterial();
    return true;
  } catch {
    return false;
  }
}

export async function keyExists(): Promise<boolean> {
  const v = await secureGet(SECRET_KEY_ITEM);
  return v !== null && v.length > 0;
}

export function generateKeyPair(): KeyPairMaterial {
  const kp = nacl.sign.keyPair();
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

/** Generate + persist a new key pair. Refuses to overwrite an existing key. */
export async function createAndStoreKeyPair(): Promise<KeyInfo> {
  if (await keyExists()) {
    throw new LicenseError(
      'KEY_EXISTS',
      'يوجد مفتاح توقيع بالفعل. احذف المفتاح الحالي أولاً إذا كنت متأكداً (سيُبطل التراخيص السابقة).'
    );
  }
  const kp = generateKeyPair();
  await secureSet(SECRET_KEY_ITEM, base64Encode(kp.secretKey));
  await secureSet(PUBLIC_KEY_ITEM, base64Encode(kp.publicKey));
  const meta: KeyMeta = { createdAt: Date.now(), fingerprint: fingerprintOf(kp.publicKey) };
  await secureSet(META_ITEM, JSON.stringify(meta));
  // Read back to confirm the key round-trips correctly.
  await loadKeyMaterial();
  return keyInfoFromPublicKey(kp.publicKey, meta.createdAt);
}

export async function loadKeyMaterial(): Promise<KeyPairMaterial & { createdAt: number }> {
  const secretB64 = await secureGet(SECRET_KEY_ITEM);
  if (!secretB64) {
    throw new LicenseError(
      'KEY_UNAVAILABLE',
      'مفتاح التوقيع غير موجود. أنشئ مفتاح التوقيع من شاشة الإعداد أولاً.'
    );
  }
  let secretKey: Uint8Array;
  try {
    secretKey = base64Decode(secretB64);
  } catch {
    throw new LicenseError(
      'KEY_CORRUPTED',
      'مفتاح التوقيع تالف ولا يمكن استخدامه. استعد نسخة احتياطية أو أنشئ مفتاحاً جديداً.'
    );
  }
  if (secretKey.length !== 64) {
    throw new LicenseError(
      'KEY_CORRUPTED',
      'مفتاح التوقيع تالف (الطول غير صحيح). استعد نسخة احتياطية أو أنشئ مفتاحاً جديداً.'
    );
  }
  // Re-derive the public key from the secret key — authoritative source.
  let derived: Uint8Array;
  try {
    derived = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey;
  } catch {
    throw new LicenseError('KEY_CORRUPTED', 'مفتاح التوقيع تالف. استعد نسخة احتياطية.');
  }
  // Cross-check the stored public key if present.
  const storedPub = await secureGet(PUBLIC_KEY_ITEM);
  if (storedPub) {
    try {
      const pubBytes = base64Decode(storedPub);
      if (pubBytes.length === 32 && !nacl.verify(derived, pubBytes)) {
        throw new LicenseError(
          'KEY_CORRUPTED',
          'المفتاح العام المخزن لا يطابق مفتاح التوقيع. استعد نسخة احتياطية.'
        );
      }
    } catch (e) {
      if (e instanceof LicenseError) throw e;
      // undecodable stored public key — fall through and repair it
      await secureSet(PUBLIC_KEY_ITEM, base64Encode(derived));
    }
  } else {
    await secureSet(PUBLIC_KEY_ITEM, base64Encode(derived));
  }
  let createdAt = 0;
  const metaRaw = await secureGet(META_ITEM);
  if (metaRaw) {
    try {
      createdAt = (JSON.parse(metaRaw) as KeyMeta).createdAt || 0;
    } catch {
      createdAt = 0;
    }
  }
  return { secretKey, publicKey: derived, createdAt };
}

export function keyInfoFromPublicKey(publicKey: Uint8Array, createdAt: number): KeyInfo {
  const fp = fingerprintOf(publicKey);
  return {
    publicKey,
    publicKeyBase64: base64Encode(publicKey),
    publicKeyHex: hexEncode(publicKey),
    fingerprint: fp,
    fingerprintGrouped: fp.replace(/(.{8})/g, '$1 ').trim(),
    createdAt,
  };
}

export async function getPublicKeyInfo(): Promise<KeyInfo | null> {
  try {
    const mat = await loadKeyMaterial();
    return keyInfoFromPublicKey(mat.publicKey, mat.createdAt);
  } catch {
    return null;
  }
}

export async function deleteSigningKey(): Promise<void> {
  await secureDelete(SECRET_KEY_ITEM);
  await secureDelete(PUBLIC_KEY_ITEM);
  await secureDelete(META_ITEM);
}

/* ------------------------------------------------------------------ */
/* Encrypted backup / restore of the secret key                        */
/*                                                                     */
/* PMKB1.<base64url( salt 16B || nonce 24B || secretbox(secretKey) )>  */
/* box key = SHA-512^100000( "PM-KEY-BACKUP-v1" || salt || password )  */
/* ------------------------------------------------------------------ */

function sha512Sync(data: Uint8Array): Uint8Array {
  return nacl.hash(data);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function deriveBackupKey(password: string, salt: Uint8Array): Uint8Array {
  const domain = utf8Encode('PM-KEY-BACKUP-v1');
  const pw = utf8Encode(password);
  let h = sha512Sync(concat(domain, salt, pw));
  for (let i = 1; i < KDF_ROUNDS; i++) {
    h = sha512Sync(concat(h, pw));
  }
  const key = h.slice(0, 32);
  h.fill(0);
  return key;
}

export function validateBackupPassword(pw: string): void {
  if (!pw || pw.length < 8) {
    throw new LicenseError('BACKUP_PASSWORD', 'كلمة مرور النسخة الاحتياطية يجب أن تكون 8 أحرف على الأقل.');
  }
}

export async function exportEncryptedKeyBackup(password: string): Promise<string> {
  validateBackupPassword(password);
  const mat = await loadKeyMaterial(); // throws KEY_UNAVAILABLE / KEY_CORRUPTED
  const salt = secureRandomBytes(16);
  const nonce = secureRandomBytes(24);
  const key = deriveBackupKey(password, salt);
  const box = nacl.secretbox(mat.secretKey, nonce, key);
  key.fill(0);
  const blob = concat(salt, nonce, box);
  return `${BACKUP_PREFIX}.${base64UrlEncode(blob)}`;
}

export async function importEncryptedKeyBackup(backup: string, password: string): Promise<KeyInfo> {
  const text = backup.trim().replace(/\s+/g, '');
  if (!text) {
    throw new LicenseError('BACKUP_INVALID', 'نص النسخة الاحتياطية فارغ.');
  }
  if (await keyExists()) {
    throw new LicenseError(
      'KEY_EXISTS',
      'يوجد مفتاح توقيع بالفعل. احذفه أولاً قبل استعادة نسخة احتياطية.'
    );
  }
  const parts = text.split('.');
  if (parts.length !== 2 || parts[0] !== BACKUP_PREFIX) {
    throw new LicenseError('BACKUP_INVALID', 'صيغة النسخة الاحتياطية غير صحيحة (يجب أن تبدأ بـ PMKB1).');
  }
  let blob: Uint8Array;
  try {
    blob = base64UrlDecode(parts[1]);
  } catch {
    throw new LicenseError('BACKUP_INVALID', 'تعذر فك ترميز النسخة الاحتياطية.');
  }
  // 16 salt + 24 nonce + (64 msg + 16 mac)
  if (blob.length !== 16 + 24 + 80) {
    throw new LicenseError('BACKUP_INVALID', 'حجم النسخة الاحتياطية غير صحيح — قد تكون ناقصة أو معدّلة.');
  }
  const salt = blob.slice(0, 16);
  const nonce = blob.slice(16, 40);
  const box = blob.slice(40);
  const key = deriveBackupKey(password, salt);
  const opened = nacl.secretbox.open(box, nonce, key);
  key.fill(0);
  if (!opened || opened.length !== 64) {
    throw new LicenseError(
      'BACKUP_PASSWORD',
      'فشلت الاستعادة: كلمة المرور غير صحيحة أو النسخة تالفة/معدّلة.'
    );
  }
  let publicKey: Uint8Array;
  try {
    publicKey = nacl.sign.keyPair.fromSecretKey(opened).publicKey;
  } catch {
    opened.fill(0);
    throw new LicenseError('BACKUP_INVALID', 'محتوى النسخة الاحتياطية تالف.');
  }
  await secureSet(SECRET_KEY_ITEM, base64Encode(opened));
  await secureSet(PUBLIC_KEY_ITEM, base64Encode(publicKey));
  opened.fill(0);
  const meta: KeyMeta = { createdAt: Date.now(), fingerprint: fingerprintOf(publicKey) };
  await secureSet(META_ITEM, JSON.stringify(meta));
  await loadKeyMaterial(); // confirm round-trip
  return keyInfoFromPublicKey(publicKey, meta.createdAt);
}

/** Export block the developer pastes into the customer app source. */
export function customerAppPublicKeySnippet(info: KeyInfo): string {
  return (
    `// Poultry Manager - developer verification key (public only - safe to embed)\n` +
    `// Fingerprint: ${info.fingerprint}\n` +
    `const DEVELOPER_PUBLIC_KEY_BASE64 = \"${info.publicKeyBase64}\";\n` +
    `const DEVELOPER_PUBLIC_KEY_HEX = \"${info.publicKeyHex}\";\n`
  );
}
