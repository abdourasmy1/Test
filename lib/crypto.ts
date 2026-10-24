/**
 * Real Ed25519 licensing cryptography (tweetnacl).
 *
 * Protocol documentation (v1) — mirror this in the customer app:
 *
 * ACTIVATION REQUEST (produced by the customer app, pasted here):
 *   PMAR1.<base64url(JSON without whitespace)>
 *   JSON: { "v": 1, "installationId": string, "devicePublicKey": base64url(32B), "issuedAt": epochMs }
 *   - installationId: 8..64 chars, [A-Za-z0-9_-]
 *   - devicePublicKey: the customer's 32-byte Ed25519 device key (Keystore-backed)
 *   - fingerprint = hex( SHA-512(devicePublicKey)[0..32] ), 64 lowercase hex chars
 *
 * LICENSE CODE (produced here, verified by the customer app):
 *   PML1.<base64url(canonicalPayloadUTF8)>.<base64url(signature64B)>
 *   canonicalPayload = strict JSON of the LicensePayload with FIXED key order:
 *     productId, licenseFormatVersion, licenseId, customerName, customerNumber,
 *     installationId, devicePublicKeyFingerprint, licenseType, issuedAt, expiresAt,
 *     signatureAlgorithm
 *   - signature = Ed25519_sign(canonicalPayloadUTF8, developerPrivateKey)
 *   - expiresAt is `null` for permanent licenses (JSON null, not omitted)
 *   - All strings are NFC-normalized, trimmed, length-capped before signing.
 *
 * Verification (customer app):
 *   1. Split on '.', require 3 parts and header "PML1".
 *   2. Decode canonical bytes, parse JSON, re-canonicalize with fixed key order.
 *   3. Ed25519 detached-verify over the re-canonicalized bytes with the
 *      embedded developer public key.
 *   4. productId must equal "poultry-manager-app".
 *   5. installationId + fingerprint must match this device.
 *   6. temporary licenses require now <= expiresAt (honest-clock assumption).
 */
import nacl from 'tweetnacl';
import {
  base64UrlEncode,
  base64UrlDecode,
  base64Encode,
  base64Decode,
  hexEncode,
  utf8Encode,
  utf8Decode,
  fingerprintOf,
  ensureSecurePRNG,
  randomHex,
} from './helpers';
import { LicenseError } from './errors';
import type {
  ActivationRequestInfo,
  LicensePayload,
  LicenseType,
  SignedLicense,
} from './types';

ensureSecurePRNG();

export const PRODUCT_ID = 'poultry-manager-app';
export const LICENSE_FORMAT_VERSION = 1;
export const SIGNATURE_ALGORITHM = 'Ed25519';
export const LICENSE_CODE_PREFIX = 'PML1';
export const ACTIVATION_REQUEST_PREFIX = 'PMAR1';

const INSTALLATION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const CUSTOMER_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

const MAX_CUSTOMER_NAME = 120;
const MAX_CUSTOMER_NUMBER = 32;

export function normalizeText(s: string): string {
  try {
    return s.normalize('NFC');
  } catch {
    return s;
  }
}

/* ------------------------------------------------------------------ */
/* License IDs                                                       */
/* ------------------------------------------------------------------ */

export function generateLicenseId(): string {
  return `LIC-${Date.now().toString(36).toUpperCase()}-${randomHex(6).toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/* Canonical serialization (fixed key order, no whitespace)           */
/* ------------------------------------------------------------------ */

function escapeJsonString(s: string): string {
  return JSON.stringify(s);
}

export function canonicalizePayload(p: LicensePayload): string {
  return (
    '{"productId":' + escapeJsonString(p.productId) +
    ',"licenseFormatVersion":' + p.licenseFormatVersion +
    ',"licenseId":' + escapeJsonString(p.licenseId) +
    ',"customerName":' + escapeJsonString(p.customerName) +
    ',"customerNumber":' + escapeJsonString(p.customerNumber) +
    ',"installationId":' + escapeJsonString(p.installationId) +
    ',"devicePublicKeyFingerprint":' + escapeJsonString(p.devicePublicKeyFingerprint) +
    ',"licenseType":' + escapeJsonString(p.licenseType) +
    ',"issuedAt":' + p.issuedAt +
    ',"expiresAt":' + (p.expiresAt === null ? 'null' : p.expiresAt) +
    ',"signatureAlgorithm":' + escapeJsonString(p.signatureAlgorithm) +
    '}'
  );
}

/* ------------------------------------------------------------------ */
/* Activation request: parse + generate (test tool)                   */
/* ------------------------------------------------------------------ */

export function parseActivationRequest(raw: string): ActivationRequestInfo {
  const text = normalizeText(raw).trim().replace(/\s+/g, '');
  const fail = (message: string): never => {
    throw new LicenseError('INVALID_ACTIVATION_REQUEST', message);
  };
  if (!text) fail('طلب التفعيل فارغ. الصق طلب التفعيل الذي أرسله العميل.');
  const parts = text.split('.');
  if (parts.length !== 2 || parts[0] !== ACTIVATION_REQUEST_PREFIX) {
    fail('صيغة طلب التفعيل غير صحيحة. يجب أن يبدأ الطلب بـ PMAR1.');
  }
  let json: string;
  try {
    json = utf8Decode(base64UrlDecode(parts[1]));
  } catch {
    fail('تعذر فك ترميز طلب التفعيل. تأكد من نسخ الطلب كاملاً دون تعديل.');
  }
  let obj: any;
  try {
    obj = JSON.parse(json!);
  } catch {
    fail('محتوى طلب التفعيل ليس JSON صالحاً.');
  }
  if (!obj || typeof obj !== 'object' || obj.v !== 1) {
    fail('إصدار طلب التفعيل غير مدعوم.');
  }
  const { installationId, devicePublicKey, issuedAt } = obj;
  if (typeof installationId !== 'string' || !INSTALLATION_ID_RE.test(installationId)) {
    fail('معرّف التثبيت (Installation ID) في الطلب غير صالح.');
  }
  if (typeof devicePublicKey !== 'string' || devicePublicKey.length < 40 || devicePublicKey.length > 60) {
    fail('المفتاح العام للجهاز في الطلب غير صالح.');
  }
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64UrlDecode(devicePublicKey);
  } catch {
    fail('ترميز المفتاح العام للجهاز غير صالح.');
  }
  if (keyBytes!.length !== 32) {
    fail('طول المفتاح العام للجهاز غير صحيح (المتوقع 32 بايت).');
  }
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || issuedAt <= 0) {
    fail('الطابع الزمني في طلب التفعيل غير صالح.');
  }
  const now = Date.now();
  if (issuedAt > now + 5 * 60 * 1000) {
    fail('الطابع الزمني في الطلب في المستقبل. تحقق من ساعة جهاز العميل.');
  }
  if (issuedAt < now - 365 * 86400000 * 3) {
    fail('طلب التفعيل قديم جداً. اطلب من العميل إنشاء طلب جديد.');
  }
  const fingerprint = fingerprintOf(keyBytes!);
  return {
    installationId,
    devicePublicKey: keyBytes!,
    devicePublicKeyBase64Url: devicePublicKey,
    fingerprint,
    issuedAt,
  };
}

/**
 * Generates a syntactically valid activation request. FOR THE BUILT-IN TEST
 * TOOL ONLY — the real requests come from the customer app.
 */
export function generateTestActivationRequest(installationId?: string): {
  request: string;
  fingerprint: string;
  devicePublicKeyBase64Url: string;
} {
  const id =
    installationId && INSTALLATION_ID_RE.test(installationId)
      ? installationId
      : `TEST-${Date.now().toString(36).toUpperCase()}-${randomHex(3).toUpperCase()}`;
  const kp = nacl.sign.keyPair();
  const obj = {
    v: 1,
    installationId: id,
    devicePublicKey: base64UrlEncode(kp.publicKey),
    issuedAt: Date.now(),
  };
  const json = JSON.stringify(obj);
  const request = `${ACTIVATION_REQUEST_PREFIX}.${base64UrlEncode(utf8Encode(json))}`;
  return {
    request,
    fingerprint: fingerprintOf(kp.publicKey),
    devicePublicKeyBase64Url: obj.devicePublicKey,
  };
}

/* ------------------------------------------------------------------ */
/* Payload validation + construction                                 */
/* ------------------------------------------------------------------ */

export interface BuildPayloadInput {
  customerName: string;
  customerNumber: string;
  installationId: string;
  fingerprint: string;
  licenseType: LicenseType;
  durationDays: number | string | null;
  issuedAt?: number;
  licenseId?: string;
}

export function validateDuration(days: unknown): number | null {
  if (days === null || days === undefined || days === '') return null;
  const n = typeof days === 'number' ? days : Number(String(days).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new LicenseError(
      'INVALID_DURATION',
      'مدة الترخيص غير صالحة. أدخل عدداً صحيحاً موجباً من الأيام (مثال: 15 أو 500).'
    );
  }
  if (n > 36500) {
    throw new LicenseError('INVALID_DURATION', 'المدة طويلة جداً. الحد الأقصى 36500 يوم (100 سنة).');
  }
  return n;
}

export function buildLicensePayload(input: BuildPayloadInput): {
  payload: LicensePayload;
  durationDays: number | null;
} {
  const customerName = normalizeText(input.customerName).trim();
  const customerNumber = normalizeText(input.customerNumber).trim();
  if (!customerName) {
    throw new LicenseError('MISSING_FIELD', 'اسم العميل / المنشأة مطلوب.');
  }
  if (customerName.length > MAX_CUSTOMER_NAME) {
    throw new LicenseError('MISSING_FIELD', `اسم العميل طويل جداً (الحد ${MAX_CUSTOMER_NAME} حرفاً).`);
  }
  if (!customerNumber) {
    throw new LicenseError('MISSING_FIELD', 'رقم العميل مطلوب.');
  }
  if (customerNumber.length > MAX_CUSTOMER_NUMBER || !CUSTOMER_NUMBER_RE.test(customerNumber)) {
    throw new LicenseError(
      'MISSING_FIELD',
      'رقم العميل غير صالح. استخدم حروفاً أو أرقاماً (حتى 32 حرفاً).'
    );
  }
  if (!INSTALLATION_ID_RE.test(input.installationId)) {
    throw new LicenseError('MISSING_FIELD', 'معرّف التثبيت غير صالح.');
  }
  if (!HEX64_RE.test(input.fingerprint)) {
    throw new LicenseError('MISSING_FIELD', 'بصمة المفتاح العام للجهاز غير صالحة.');
  }
  let durationDays: number | null = null;
  let expiresAt: number | null = null;
  const issuedAt = input.issuedAt ?? Date.now();
  if (input.licenseType === 'temporary') {
    durationDays = validateDuration(input.durationDays);
    if (durationDays === null) {
      throw new LicenseError('INVALID_DURATION', 'الترخيص المؤقت يتطلب إدخال المدة بالأيام.');
    }
    expiresAt = issuedAt + durationDays * 86400000;
  } else if (input.licenseType !== 'permanent') {
    throw new LicenseError('MISSING_FIELD', 'نوع الترخيص غير معروف.');
  }
  const payload: LicensePayload = {
    productId: PRODUCT_ID,
    licenseFormatVersion: LICENSE_FORMAT_VERSION,
    licenseId: input.licenseId ?? generateLicenseId(),
    customerName,
    customerNumber,
    installationId: input.installationId,
    devicePublicKeyFingerprint: input.fingerprint,
    licenseType: input.licenseType,
    issuedAt,
    expiresAt,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
  };
  return { payload, durationDays };
}

/* ------------------------------------------------------------------ */
/* Sign / encode / decode / verify                                   */
/* ------------------------------------------------------------------ */

export function signPayload(payload: LicensePayload, secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 64) {
    throw new LicenseError('KEY_CORRUPTED', 'مفتاح التوقيع تالف (الطول غير صحيح).');
  }
  const canonical = canonicalizePayload(payload);
  return nacl.sign.detached(utf8Encode(canonical), secretKey);
}

export function encodeLicenseCode(payload: LicensePayload, signature: Uint8Array): string {
  return (
    `${LICENSE_CODE_PREFIX}.` +
    base64UrlEncode(utf8Encode(canonicalizePayload(payload))) +
    '.' +
    base64UrlEncode(signature)
  );
}

export function decodeLicenseCode(code: string): SignedLicense {
  const text = normalizeText(code).trim().replace(/\s+/g, '');
  if (!text) {
    throw new LicenseError('INVALID_LICENSE_CODE', 'كود الترخيص فارغ.');
  }
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_CODE_PREFIX) {
    throw new LicenseError('INVALID_LICENSE_CODE', 'صيغة كود الترخيص غير صحيحة (يجب أن تبدأ بـ PML1).');
  }
  let canonical: string;
  let signatureBytes: Uint8Array;
  try {
    canonical = utf8Decode(base64UrlDecode(parts[1]));
  } catch {
    throw new LicenseError('INVALID_LICENSE_CODE', 'تعذر فك ترميز بيانات الترخيص.');
  }
  try {
    signatureBytes = base64UrlDecode(parts[2]);
  } catch {
    throw new LicenseError('INVALID_LICENSE_CODE', 'تعذر فك ترميز التوقيع.');
  }
  if (signatureBytes.length !== 64) {
    throw new LicenseError('INVALID_LICENSE_CODE', 'طول التوقيع غير صحيح.');
  }
  let obj: any;
  try {
    obj = JSON.parse(canonical);
  } catch {
    throw new LicenseError('INVALID_LICENSE_CODE', 'بيانات الترخيص تالفة.');
  }
  const required = [
    'productId', 'licenseFormatVersion', 'licenseId', 'customerName', 'customerNumber',
    'installationId', 'devicePublicKeyFingerprint', 'licenseType', 'issuedAt',
    'expiresAt', 'signatureAlgorithm',
  ];
  for (const k of required) {
    if (!(k in obj)) {
      throw new LicenseError('INVALID_LICENSE_CODE', `حقل مفقود في الترخيص: ${k}.`);
    }
  }
  if (
    typeof obj.productId !== 'string' ||
    typeof obj.licenseFormatVersion !== 'number' ||
    typeof obj.licenseId !== 'string' ||
    typeof obj.customerName !== 'string' ||
    typeof obj.customerNumber !== 'string' ||
    typeof obj.installationId !== 'string' ||
    typeof obj.devicePublicKeyFingerprint !== 'string' ||
    (obj.licenseType !== 'permanent' && obj.licenseType !== 'temporary') ||
    typeof obj.issuedAt !== 'number' ||
    (obj.expiresAt !== null && typeof obj.expiresAt !== 'number') ||
    typeof obj.signatureAlgorithm !== 'string'
  ) {
    throw new LicenseError('INVALID_LICENSE_CODE', 'أنواع الحقول في الترخيص غير صالحة.');
  }
  return {
    payload: obj as LicensePayload,
    signature: base64Encode(signatureBytes),
  };
}

/**
 * Verifies a license exactly like the customer app would. Returns structured
 * check results instead of throwing, so the UI can show every detail.
 */
export function verifyLicenseCode(
  code: string,
  developerPublicKey: Uint8Array | null,
  options?: { expectedInstallationId?: string; expectedFingerprint?: string; now?: number }
): {
  valid: boolean;
  signed: SignedLicense | null;
  canonicalMatches: boolean;
  signatureValid: boolean;
  productOk: boolean;
  deviceOk: boolean;
  expiryOk: boolean;
  expired: boolean;
  error: string | null;
} {
  const fail = (error: string) => ({
    valid: false,
    signed: null,
    canonicalMatches: false,
    signatureValid: false,
    productOk: false,
    deviceOk: false,
    expiryOk: false,
    expired: false,
    error,
  });
  let signed: SignedLicense;
  try {
    signed = decodeLicenseCode(code);
  } catch (e) {
    return fail(e instanceof LicenseError ? e.message : 'كود الترخيص غير صالح.');
  }
  const p = signed.payload;
  if (p.signatureAlgorithm !== SIGNATURE_ALGORITHM || p.licenseFormatVersion !== LICENSE_FORMAT_VERSION) {
    return {
      valid: false, signed, canonicalMatches: false, signatureValid: false,
      productOk: false, deviceOk: false, expiryOk: false, expired: false,
      error: 'إصدار صيغة الترخيص أو خوارزمية التوقيع غير مدعومة.',
    };
  }
  const productOk = p.productId === PRODUCT_ID;
  // Re-canonicalize and verify signature over exactly those bytes.
  const canonicalBytes = utf8Encode(canonicalizePayload(p));
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64Decode(signed.signature);
  } catch {
    return {
      valid: false, signed, canonicalMatches: true, signatureValid: false,
      productOk, deviceOk: false, expiryOk: false, expired: false,
      error: 'التوقيع تالف.',
    };
  }
  const signatureValid =
    developerPublicKey !== null &&
    developerPublicKey.length === 32 &&
    nacl.sign.detached.verify(canonicalBytes, signatureBytes, developerPublicKey);
  const now = options?.now ?? Date.now();
  const expired = p.licenseType === 'temporary' && typeof p.expiresAt === 'number' && now > p.expiresAt;
  const expiryOk =
    p.licenseType === 'permanent'
      ? p.expiresAt === null
      : typeof p.expiresAt === 'number' && p.expiresAt > p.issuedAt && !expired;
  let deviceOk = true;
  if (options?.expectedInstallationId && p.installationId !== options.expectedInstallationId) {
    deviceOk = false;
  }
  if (options?.expectedFingerprint && p.devicePublicKeyFingerprint !== options.expectedFingerprint) {
    deviceOk = false;
  }
  const valid = signatureValid && productOk && deviceOk && expiryOk;
  return {
    valid,
    signed,
    canonicalMatches: true,
    signatureValid,
    productOk,
    deviceOk,
    expiryOk,
    expired,
    error: valid ? null : 'فشل التحقق من الترخيص.',
  };
}

/** Self-check: sign a payload then verify it immediately (used before reporting success). */
export function selfCheckSignVerify(
  payload: LicensePayload,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): boolean {
  const sig = signPayload(payload, secretKey);
  const code = encodeLicenseCode(payload, sig);
  const res = verifyLicenseCode(code, publicKey);
  return res.valid;
}
