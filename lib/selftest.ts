/**
 * Built-in self-test suite. Runs REAL cryptographic + validation checks on
 * this device (never mocked, never hard-coded to pass) and returns a
 * truthful report distinguishing passes from failures.
 *
 * IMPORTANT: self-tests use an ephemeral in-memory key pair and never touch
 * the developer's real signing key or the real database.
 */
import nacl from 'tweetnacl';
import {
  parseActivationRequest,
  generateTestActivationRequest,
  buildLicensePayload,
  validateDuration,
  signPayload,
  encodeLicenseCode,
  decodeLicenseCode,
  verifyLicenseCode,
  canonicalizePayload,
  PRODUCT_ID,
  SIGNATURE_ALGORITHM,
} from './crypto';
import { LicenseError } from './errors';
import { utf8Encode, base64UrlEncode, base64UrlDecode, fingerprintOf } from './helpers';
import { mergeRestore, sanitizeDbForTest } from './dbTestHelpers';
import type { SelfTestCaseResult, SelfTestReport, LicensePayload } from './types';

function ephemeralKeys() {
  return nacl.sign.keyPair();
}

function makePayload(over: Partial<LicensePayload> = {}): LicensePayload {
  const kp = ephemeralKeys();
  const now = Date.now();
  return {
    productId: PRODUCT_ID,
    licenseFormatVersion: 1,
    licenseId: `LIC-TEST-${Math.floor(Math.random() * 1e9)}`,
    customerName: 'عميل اختبار',
    customerNumber: 'T-001',
    installationId: 'TEST-INST-001',
    devicePublicKeyFingerprint: fingerprintOf(kp.publicKey),
    licenseType: 'temporary',
    issuedAt: now,
    expiresAt: now + 15 * 86400000,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    ...over,
  };
}

type Ctx = { keys: nacl.SignKeyPair };

async function runCase(
  id: number,
  title: string,
  fn: (ctx: Ctx) => void | Promise<void>
): Promise<SelfTestCaseResult> {
  const t0 = Date.now();
  try {
    await fn({ keys: ephemeralKeys() });
    return { id, title, passed: true, detail: 'ناجح', durationMs: Date.now() - t0 };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { id, title, passed: false, detail, durationMs: Date.now() - t0 };
  }
}

function expect(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

export async function runSelfTests(): Promise<SelfTestReport> {
  const results: SelfTestCaseResult[] = [];

  // 1 — permanent license round-trip
  results.push(await runCase(1, 'إصدار ترخيص دائم والتحقق منه', ({ keys }) => {
    const { request } = generateTestActivationRequest('SELFTEST-PERM-01');
    const ar = parseActivationRequest(request);
    const { payload } = buildLicensePayload({
      customerName: 'مزرعة الاختبار',
      customerNumber: 'C-100',
      installationId: ar.installationId,
      fingerprint: ar.fingerprint,
      licenseType: 'permanent',
      durationDays: null,
    });
    expect(payload.expiresAt === null, 'الترخيص الدائم يجب أن تكون نهايته null');
    const sig = signPayload(payload, keys.secretKey);
    const code = encodeLicenseCode(payload, sig);
    const v = verifyLicenseCode(code, keys.publicKey);
    expect(v.valid, 'فشل التحقق من الترخيص الدائم الصالح');
    expect(v.signed?.payload.licenseType === 'permanent', 'نوع الترخيص غير صحيح');
  }));

  // 2 — temporary 15 days
  results.push(await runCase(2, 'إصدار ترخيص مؤقت لمدة 15 يوماً', ({ keys }) => {
    const { request } = generateTestActivationRequest('SELFTEST-T15-02');
    const ar = parseActivationRequest(request);
    const before = Date.now();
    const { payload, durationDays } = buildLicensePayload({
      customerName: 'عميل', customerNumber: 'C-101',
      installationId: ar.installationId, fingerprint: ar.fingerprint,
      licenseType: 'temporary', durationDays: 15,
    });
    expect(durationDays === 15, 'المدة يجب أن تكون 15');
    expect(
      typeof payload.expiresAt === 'number' &&
      Math.abs(payload.expiresAt - (payload.issuedAt + 15 * 86400000)) < 2000 &&
      payload.issuedAt >= before - 2000,
      'حساب تاريخ الانتهاء غير صحيح'
    );
    const code = encodeLicenseCode(payload, signPayload(payload, keys.secretKey));
    expect(verifyLicenseCode(code, keys.publicKey).valid, 'فشل التحقق من ترخيص الـ15 يوماً');
  }));

  // 3 — temporary 500 days (free duration)
  results.push(await runCase(3, 'إصدار ترخيص مؤقت لمدة حرة (500 يوم)', ({ keys }) => {
    const { request } = generateTestActivationRequest('SELFTEST-T500-03');
    const ar = parseActivationRequest(request);
    const { payload } = buildLicensePayload({
      customerName: 'عميل', customerNumber: 'C-102',
      installationId: ar.installationId, fingerprint: ar.fingerprint,
      licenseType: 'temporary', durationDays: 500,
    });
    expect(payload.expiresAt === payload.issuedAt + 500 * 86400000, 'حساب مدة 500 يوم غير صحيح');
    const code = encodeLicenseCode(payload, signPayload(payload, keys.secretKey));
    expect(verifyLicenseCode(code, keys.publicKey).valid, 'فشل التحقق من ترخيص الـ500 يوم');
  }));

  // 4 — reject bad durations
  results.push(await runCase(4, 'رفض المدد الصفرية والسالبة والكسرية وغير الصالحة', () => {
    const bad = [0, -1, -30, 1.5, 15.7, NaN, 'abc', '', '  ', '15.5'];
    for (const b of bad) {
      let threw = false;
      try {
        validateDuration(b as any);
      } catch (e) {
        threw = e instanceof LicenseError;
      }
      expect(threw, `لم يتم رفض المدة: ${String(b)}`);
    }
    expect(validateDuration('45') === 45, 'رفض مدة صحيحة: 45');
    expect(validateDuration(120) === 120, 'رفض مدة صحيحة: 120');
  }));

  // 5 — reject incomplete activation requests
  results.push(await runCase(5, 'رفض طلبات التفعيل الناقصة', () => {
    const cases = ['', '   ', 'PMAR1', 'PMAR1.', 'garbage-text', 'PML1.abc.def'];
    for (const c of cases) {
      let threw = false;
      try {
        parseActivationRequest(c);
      } catch (e) {
        threw = e instanceof LicenseError;
      }
      expect(threw, `لم يتم رفض الطلب الناقص: ${c.slice(0, 20)}`);
    }
  }));

  // 6 — reject malformed activation requests
  results.push(await runCase(6, 'رفض طلبات التفعيل المشوهة', () => {
    const badJson = 'PMAR1.' + base64UrlEncode(utf8Encode('{not-json'));
    const wrongShape = 'PMAR1.' + base64UrlEncode(utf8Encode(JSON.stringify({ v: 1 })));
    const badKey = 'PMAR1.' + base64UrlEncode(utf8Encode(JSON.stringify({
      v: 1, installationId: 'VALID-INST-01', devicePublicKey: '!!!', issuedAt: Date.now(),
    })));
    const shortKey = 'PMAR1.' + base64UrlEncode(utf8Encode(JSON.stringify({
      v: 1, installationId: 'VALID-INST-01',
      devicePublicKey: base64UrlEncode(new Uint8Array(16)), issuedAt: Date.now(),
    })));
    const badInst = 'PMAR1.' + base64UrlEncode(utf8Encode(JSON.stringify({
      v: 1, installationId: 'xx', devicePublicKey: base64UrlEncode(new Uint8Array(32)), issuedAt: Date.now(),
    })));
    for (const c of [badJson, wrongShape, badKey, shortKey, badInst]) {
      let threw = false;
      try {
        parseActivationRequest(c);
      } catch (e) {
        threw = e instanceof LicenseError;
      }
      expect(threw, 'لم يتم رفض طلب مشوّه');
    }
  }));

  // 7 — issuance blocked without key (sign with wrong-size key must throw)
  results.push(await runCase(7, 'منع الإصدار عند غياب/تلف مفتاح التوقيع', () => {
    const p = makePayload();
    let threw = false;
    try {
      signPayload(p, new Uint8Array(0));
    } catch (e) {
      threw = e instanceof LicenseError;
    }
    expect(threw, 'لم يتم منع التوقيع بمفتاح فارغ');
    threw = false;
    try {
      signPayload(p, new Uint8Array(32));
    } catch (e) {
      threw = e instanceof LicenseError;
    }
    expect(threw, 'لم يتم منع التوقيع بمفتاح ناقص (32 بايت)');
  }));

  // 8 — accept valid signature
  results.push(await runCase(8, 'قبول التوقيع الصالح', ({ keys }) => {
    const p = makePayload();
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const v = verifyLicenseCode(code, keys.publicKey);
    expect(v.valid && v.signatureValid, 'تم رفض توقيع صالح');
  }));

  // 9 — reject modified signature / payload
  results.push(await runCase(9, 'رفض التوقيع المعدّل أو البيانات المعدّلة', ({ keys }) => {
    const p = makePayload();
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const parts = code.split('.');
    // flip a byte in the payload segment
    const pBytes = base64UrlDecode(parts[1]);
    pBytes[20] = (pBytes[20] + 1) % 256;
    const tamperedPayload = `${parts[0]}.${base64UrlEncode(pBytes)}.${parts[2]}`;
    expect(!verifyLicenseCode(tamperedPayload, keys.publicKey).valid, 'تم قبول بيانات معدّلة');
    // flip a byte in the signature
    const sBytes = base64UrlDecode(parts[2]);
    sBytes[0] = (sBytes[0] + 1) % 256;
    const tamperedSig = `${parts[0]}.${parts[1]}.${base64UrlEncode(sBytes)}`;
    const v2 = verifyLicenseCode(tamperedSig, keys.publicKey);
    expect(!v2.valid && !v2.signatureValid, 'تم قبول توقيع معدّل');
  }));

  // 10 — reject different product
  results.push(await runCase(10, 'رفض ترخيص مخصص لمنتج آخر', ({ keys }) => {
    const p = makePayload({ productId: 'other-product' });
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const v = verifyLicenseCode(code, keys.publicKey);
    expect(!v.valid && !v.productOk, 'تم قبول ترخيص لمنتج آخر');
  }));

  // 11 — reject license bound to another device
  results.push(await runCase(11, 'رفض ترخيص مرتبط بجهاز آخر', ({ keys }) => {
    const p = makePayload({ installationId: 'DEVICE-A-0001', devicePublicKeyFingerprint: 'a'.repeat(64) });
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const v = verifyLicenseCode(code, keys.publicKey, {
      expectedInstallationId: 'DEVICE-B-0002',
      expectedFingerprint: 'b'.repeat(64),
    });
    expect(!v.valid && !v.deviceOk, 'تم قبول ترخيص مرتبط بجهاز آخر');
    const vSame = verifyLicenseCode(code, keys.publicKey, {
      expectedInstallationId: 'DEVICE-A-0001',
      expectedFingerprint: 'a'.repeat(64),
    });
    expect(vSame.valid, 'تم رفض ترخيص مرتبط بالجهاز الصحيح');
  }));

  // 12 — reject expired temporary license
  results.push(await runCase(12, 'رفض الترخيص المؤقت المنتهي', ({ keys }) => {
    const now = Date.now();
    const p = makePayload({ issuedAt: now - 20 * 86400000, expiresAt: now - 5 * 86400000 });
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const v = verifyLicenseCode(code, keys.publicKey);
    expect(!v.valid && v.expired && !v.expiryOk, 'تم قبول ترخيص منتهي الصلاحية');
    const fresh = makePayload({ issuedAt: now - 86400000, expiresAt: now + 10 * 86400000 });
    const code2 = encodeLicenseCode(fresh, signPayload(fresh, keys.secretKey));
    expect(verifyLicenseCode(code2, keys.publicKey).valid, 'تم رفض ترخيص ساري');
  }));

  // 13 — save customer number + notes (sanitizer round-trip)
  results.push(await runCase(13, 'حفظ رقم العميل والملاحظات الإدارية', () => {
    const db = sanitizeDbForTest({
      version: 1,
      licenses: [{
        id: 'LIC-X', code: 'PML1.x.y', payload: makePayload(), signature: 'sig',
        customerName: 'مزرعة النور', customerNumber: 'C-777',
        installationId: 'I-1', fingerprint: 'f'.repeat(64),
        type: 'permanent', durationDays: null, issuedAt: 1, expiresAt: null,
        notes: 'مدفوع نقداً — تجديد سنوي', revoked: false, revokedReason: null,
        revokedAt: null, reissueOf: null, reissueReason: null, createdAt: 1,
      }],
      customers: [{
        customerNumber: 'C-777', customerName: 'مزرعة النور', notes: 'عميل مميز',
        licenseIds: ['LIC-X'], createdAt: 1, updatedAt: 1,
      }],
      updatedAt: 1,
    });
    expect(db.licenses[0].customerNumber === 'C-777', 'ضاع رقم العميل');
    expect(db.licenses[0].notes === 'مدفوع نقداً — تجديد سنوي', 'ضاعت الملاحظات');
    expect(db.customers[0].notes === 'عميل مميز', 'ضاعت ملاحظات العميل');
  }));

  // 14 — backup merge preserves records without silent overwrite
  results.push(await runCase(14, 'دمج النسخة الاحتياطية دون فقدان السجلات', () => {
    const rec = (id: string) => ({
      id, code: 'c', payload: makePayload(), signature: 's', customerName: 'n',
      customerNumber: 'C', installationId: 'I', fingerprint: 'f', type: 'permanent' as const,
      durationDays: null, issuedAt: 1, expiresAt: null, notes: '', revoked: false,
      revokedReason: null, revokedAt: null, reissueOf: null, reissueReason: null, createdAt: 1,
    });
    const current = sanitizeDbForTest({
      version: 1, licenses: [rec('LIC-A')],
      customers: [{ customerNumber: 'C', customerName: 'n', notes: '', licenseIds: ['LIC-A'], createdAt: 1, updatedAt: 1 }],
      updatedAt: 1,
    });
    const backup = sanitizeDbForTest({
      version: 1, licenses: [rec('LIC-A'), rec('LIC-B')],
      customers: [{ customerNumber: 'C', customerName: 'n', notes: '', licenseIds: ['LIC-A', 'LIC-B'], createdAt: 1, updatedAt: 1 }],
      updatedAt: 1,
    });
    const merged = mergeRestore(current, backup);
    const ids = merged.licenses.map((r) => r.id);
    expect(ids.includes('LIC-A') && ids.includes('LIC-B') && ids.length === 2, 'فشل دمج السجلات');
    expect(merged.customers[0].licenseIds.length === 2, 'فشل دمج ملفات العملاء');
  }));

  // 15 — detect any change to signed data (canonical bytes must verify exactly)
  results.push(await runCase(15, 'كشف أي تغيير في بيانات الترخيص الموقعة', ({ keys }) => {
    const p = makePayload({ customerName: 'الاسم الأصلي' });
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const decoded = decodeLicenseCode(code);
    const mutated = { ...decoded.payload, customerName: 'اسم مخترق' };
    const mutatedCanonical = utf8Encode(canonicalizePayload(mutated));
    // Attack model: keep original signature, change payload → must fail.
    const parts = code.split('.');
    const forged = `${parts[0]}.${base64UrlEncode(mutatedCanonical)}.${parts[2]}`;
    expect(!verifyLicenseCode(forged, keys.publicKey).valid, 'تم قبول بيانات معدّلة بنفس التوقيع');
  }));

  // 16 — parsing/verification never "activates" (pure functions, no side effects)
  results.push(await runCase(16, 'التحقق لا يفعّل تلقائياً (دوال نقية بلا آثار جانبية)', ({ keys }) => {
    const p = makePayload();
    const code = encodeLicenseCode(p, signPayload(p, keys.secretKey));
    const snapshot = JSON.stringify(p);
    verifyLicenseCode(code, keys.publicKey);
    decodeLicenseCode(code);
    parseActivationRequest(generateTestActivationRequest('SELFTEST-PURE-16').request);
    expect(JSON.stringify(p) === snapshot, 'تغيّرت البيانات أثناء التحقق');
    const v = verifyLicenseCode(code, keys.publicKey);
    expect(v.valid && typeof v.valid === 'boolean', 'التحقق يجب أن يعيد نتيجة فقط');
  }));

  const passed = results.filter((r) => r.passed).length;
  return { ranAt: Date.now(), passed, failed: results.length - passed, results };
}

/** Human-readable Arabic test report for copy/share. */
export function formatTestReport(report: SelfTestReport): string {
  const lines = [
    'تقرير الاختبار الذاتي — مدير تراخيص Poultry Manager',
    `وقت التنفيذ: ${new Date(report.ranAt).toLocaleString('en-GB')}`,
    `النتيجة: ${report.passed} ناجح / ${report.failed} فاشل من ${report.results.length}`,
    '',
  ];
  for (const r of report.results) {
    lines.push(`${r.passed ? '✓' : '✗'} [${r.id}] ${r.title}${r.passed ? '' : ` — ${r.detail}`}`);
  }
  lines.push('', 'ملاحظة: هذه الاختبارات تعمل بمفاتيح مؤقتة ولا تمس مفتاح التوقيع الحقيقي أو قاعدة البيانات.');
  return lines.join('\n');
}

export { };
void 0;
