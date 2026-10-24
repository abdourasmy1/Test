/**
 * License issuance pipeline — the REAL work behind the «توليد الترخيص» button.
 *
 * Steps (each validated, failures abort with a clear Arabic error):
 *  1. Validate customer fields + activation request.
 *  2. Load + validate the developer signing key (blocks if missing/corrupt).
 *  3. Build the canonical payload (unique license ID, expiry math).
 *  4. Sign with Ed25519.
 *  5. Self-verify the signature before reporting success.
 *  6. Persist the record + customer profile, then return the signed code.
 */
import {
  parseActivationRequest,
  buildLicensePayload,
  signPayload,
  encodeLicenseCode,
  selfCheckSignVerify,
  PRODUCT_ID,
} from './crypto';
import { loadKeyMaterial } from './keystore';
import { insertLicense, loadDb } from './db';
import { base64Encode } from './helpers';
import { LicenseError } from './errors';
import type { LicenseRecord, LicenseType } from './types';

export interface IssueLicenseInput {
  customerName: string;
  customerNumber: string;
  activationRequest: string;
  licenseType: LicenseType;
  durationDays: string; // raw input, validated here
  notes: string;
  reissueOf?: string | null;
  reissueReason?: string | null;
}

export interface IssueProgress {
  step: number;
  total: number;
  label: string;
}

const STEPS = [
  'التحقق من بيانات العميل',
  'تحليل طلب التفعيل',
  'فحص مفتاح التوقيع',
  'بناء بيانات الترخيص',
  'التوقيع الرقمي',
  'التحقق الذاتي من التوقيع',
  'الحفظ في السجل',
];

export async function issueLicense(
  input: IssueLicenseInput,
  onProgress?: (p: IssueProgress) => void
): Promise<{ record: LicenseRecord; dbVersion: number }> {
  const total = STEPS.length;
  const tick = (step: number) => onProgress?.({ step, total, label: STEPS[step - 1] });

  tick(1);
  const customerName = input.customerName.trim();
  const customerNumber = input.customerNumber.trim();
  const notes = input.notes.trim();
  if (!customerName) throw new LicenseError('MISSING_FIELD', 'اسم العميل / المنشأة مطلوب.');
  if (!customerNumber) throw new LicenseError('MISSING_FIELD', 'رقم العميل مطلوب.');
  if (!input.activationRequest.trim()) {
    throw new LicenseError('INVALID_ACTIVATION_REQUEST', 'طلب التفعيل مطلوب. الصق الطلب المرسل من تطبيق العميل.');
  }
  if (input.activationRequest.trim().length > 4000) {
    throw new LicenseError('INVALID_ACTIVATION_REQUEST', 'طلب التفعيل أطول من المتوقع — تأكد من نسخه بشكل صحيح.');
  }

  tick(2);
  const ar = parseActivationRequest(input.activationRequest);

  tick(3);
  const keyMat = await loadKeyMaterial(); // throws KEY_UNAVAILABLE / KEY_CORRUPTED

  tick(4);
  const { payload, durationDays } = buildLicensePayload({
    customerName,
    customerNumber,
    installationId: ar.installationId,
    fingerprint: ar.fingerprint,
    licenseType: input.licenseType,
    durationDays: input.licenseType === 'temporary' ? input.durationDays : null,
  });
  if (payload.productId !== PRODUCT_ID) {
    throw new LicenseError('PRODUCT_MISMATCH', 'خطأ داخلي: معرّف المنتج غير متطابق.');
  }

  tick(5);
  const signature = signPayload(payload, keyMat.secretKey);

  tick(6);
  const ok = selfCheckSignVerify(payload, keyMat.secretKey, keyMat.publicKey);
  if (!ok) {
    throw new LicenseError('SIGNATURE_INVALID', 'فشل التحقق الذاتي من التوقيع. لم يتم إصدار الترخيص.');
  }
  const code = encodeLicenseCode(payload, signature);

  tick(7);
  const record: LicenseRecord = {
    id: payload.licenseId,
    code,
    payload,
    signature: base64Encode(signature),
    customerName: payload.customerName,
    customerNumber: payload.customerNumber,
    installationId: payload.installationId,
    fingerprint: payload.devicePublicKeyFingerprint,
    type: payload.licenseType,
    durationDays,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    notes,
    revoked: false,
    revokedReason: null,
    revokedAt: null,
    reissueOf: input.reissueOf ?? null,
    reissueReason: input.reissueReason ?? null,
    createdAt: Date.now(),
  };
  const db = await loadDb();
  const saved = await insertLicense(db, record);

  return { record, dbVersion: saved.updatedAt };
}
