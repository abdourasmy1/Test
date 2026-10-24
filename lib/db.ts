/**
 * Local administrative database (AsyncStorage JSON document).
 * Stores every issued license + customer profiles. Never auto-modifies or
 * auto-transfers a license: reissues always create new auditable records.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import nacl from 'tweetnacl';
import { LicenseError } from './errors';
import type { Customer, DbSchema, DbStats, LicenseRecord } from './types';
import {
  base64UrlEncode,
  base64UrlDecode,
  utf8Encode,
  utf8Decode,
  secureRandomBytes,
  ensureSecurePRNG,
} from './helpers';
import { validateBackupPassword } from './keystore';

ensureSecurePRNG();

const DB_KEY = 'pm_admin_db_v1';
const DB_BACKUP_PREFIX = 'PMDB1';
const DB_KDF_ROUNDS = 60000;

function emptyDb(): DbSchema {
  return { version: 1, licenses: [], customers: [], updatedAt: Date.now() };
}

function sanitizeDb(raw: any): DbSchema {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.licenses) || !Array.isArray(raw.customers)) {
    throw new LicenseError('BACKUP_INVALID', 'بيانات قاعدة البيانات غير صالحة.');
  }
  const licenses: LicenseRecord[] = [];
  for (const r of raw.licenses) {
    if (!r || typeof r.id !== 'string' || typeof r.code !== 'string' || !r.payload) continue;
    licenses.push({
      id: r.id,
      code: r.code,
      payload: r.payload,
      signature: typeof r.signature === 'string' ? r.signature : '',
      customerName: String(r.customerName ?? ''),
      customerNumber: String(r.customerNumber ?? ''),
      installationId: String(r.installationId ?? ''),
      fingerprint: String(r.fingerprint ?? ''),
      type: r.type === 'temporary' ? 'temporary' : 'permanent',
      durationDays: typeof r.durationDays === 'number' ? r.durationDays : null,
      issuedAt: Number(r.issuedAt) || 0,
      expiresAt: r.expiresAt === null || r.expiresAt === undefined ? null : Number(r.expiresAt),
      notes: String(r.notes ?? ''),
      revoked: r.revoked === true,
      revokedReason: typeof r.revokedReason === 'string' ? r.revokedReason : null,
      revokedAt: typeof r.revokedAt === 'number' ? r.revokedAt : null,
      reissueOf: typeof r.reissueOf === 'string' ? r.reissueOf : null,
      reissueReason: typeof r.reissueReason === 'string' ? r.reissueReason : null,
      createdAt: Number(r.createdAt) || 0,
    });
  }
  const customers: Customer[] = [];
  for (const c of raw.customers) {
    if (!c || typeof c.customerNumber !== 'string') continue;
    customers.push({
      customerNumber: c.customerNumber,
      customerName: String(c.customerName ?? ''),
      notes: String(c.notes ?? ''),
      licenseIds: Array.isArray(c.licenseIds) ? c.licenseIds.filter((x: unknown) => typeof x === 'string') : [],
      createdAt: Number(c.createdAt) || 0,
      updatedAt: Number(c.updatedAt) || 0,
    });
  }
  return { version: 1, licenses, customers, updatedAt: Date.now() };
}

export async function loadDb(): Promise<DbSchema> {
  try {
    const raw = await AsyncStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    try {
      return sanitizeDb(JSON.parse(raw));
    } catch (e) {
      if (e instanceof LicenseError) return emptyDb();
      throw e;
    }
  } catch (e) {
    if (e instanceof LicenseError) throw e;
    throw new LicenseError('STORAGE_ERROR', 'تعذر قراءة قاعدة البيانات المحلية.');
  }
}

export async function saveDb(db: DbSchema): Promise<void> {
  try {
    db.updatedAt = Date.now();
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    throw new LicenseError('STORAGE_ERROR', 'تعذر حفظ قاعدة البيانات المحلية.');
  }
}

export function isExpired(r: LicenseRecord, now: number = Date.now()): boolean {
  return r.type === 'temporary' && r.expiresAt !== null && now > r.expiresAt;
}

export function getStats(db: DbSchema, now: number = Date.now()): DbStats {
  let permanent = 0;
  let temporary = 0;
  let expired = 0;
  let revoked = 0;
  for (const r of db.licenses) {
    if (r.revoked) revoked++;
    else if (r.type === 'permanent') permanent++;
    else {
      temporary++;
      if (isExpired(r, now)) expired++;
    }
  }
  return {
    total: db.licenses.length,
    permanent,
    temporary,
    expired,
    revoked,
    customers: db.customers.length,
  };
}

export function getLicense(db: DbSchema, id: string): LicenseRecord | undefined {
  return db.licenses.find((r) => r.id === id);
}

export function getCustomer(db: DbSchema, customerNumber: string): Customer | undefined {
  return db.customers.find((c) => c.customerNumber === customerNumber);
}

/** Insert a license record and upsert the matching customer profile. */
export async function insertLicense(
  db: DbSchema,
  record: LicenseRecord
): Promise<DbSchema> {
  const next: DbSchema = {
    ...db,
    licenses: [record, ...db.licenses.filter((r) => r.id !== record.id)],
    customers: [...db.customers],
  };
  const idx = next.customers.findIndex((c) => c.customerNumber === record.customerNumber);
  const now = Date.now();
  if (idx >= 0) {
    const c = next.customers[idx];
    const licenseIds = c.licenseIds.includes(record.id) ? c.licenseIds : [...c.licenseIds, record.id];
    next.customers[idx] = {
      ...c,
      customerName: record.customerName || c.customerName,
      licenseIds,
      updatedAt: now,
    };
  } else {
    next.customers.unshift({
      customerNumber: record.customerNumber,
      customerName: record.customerName,
      notes: '',
      licenseIds: [record.id],
      createdAt: now,
      updatedAt: now,
    });
  }
  await saveDb(next);
  return next;
}

export async function updateLicenseNotes(db: DbSchema, id: string, notes: string): Promise<DbSchema> {
  const next: DbSchema = {
    ...db,
    licenses: db.licenses.map((r) => (r.id === id ? { ...r, notes } : r)),
  };
  await saveDb(next);
  return next;
}

export async function revokeLicense(db: DbSchema, id: string, reason: string): Promise<DbSchema> {
  const rec = getLicense(db, id);
  if (!rec) throw new LicenseError('INVALID_LICENSE_CODE', 'سجل الترخيص غير موجود.');
  if (rec.revoked) throw new LicenseError('INVALID_LICENSE_CODE', 'هذا الترخيص ملغي بالفعل.');
  const next: DbSchema = {
    ...db,
    licenses: db.licenses.map((r) =>
      r.id === id ? { ...r, revoked: true, revokedReason: reason || 'بدون سبب مذكور', revokedAt: Date.now() } : r
    ),
  };
  await saveDb(next);
  return next;
}

export async function updateCustomerNotes(
  db: DbSchema,
  customerNumber: string,
  customerName: string,
  notes: string
): Promise<DbSchema> {
  const next: DbSchema = {
    ...db,
    customers: db.customers.map((c) =>
      c.customerNumber === customerNumber
        ? { ...c, customerName: customerName || c.customerName, notes, updatedAt: Date.now() }
        : c
    ),
  };
  await saveDb(next);
  return next;
}

/* ------------------------------------------------------------------ */
/* Encrypted database backup / restore                                 */
/* PMDB1.<base64url( salt 16B || nonce 24B || secretbox(dbJSON) )>     */
/* ------------------------------------------------------------------ */

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

function deriveDbKey(password: string, salt: Uint8Array): Uint8Array {
  const domain = utf8Encode('PM-DB-BACKUP-v1');
  const pw = utf8Encode(password);
  let h = nacl.hash(concat(domain, salt, pw));
  for (let i = 1; i < DB_KDF_ROUNDS; i++) {
    h = nacl.hash(concat(h, pw));
  }
  const key = h.slice(0, 32);
  h.fill(0);
  return key;
}

export async function exportEncryptedDbBackup(db: DbSchema, password: string): Promise<string> {
  validateBackupPassword(password);
  const json = JSON.stringify({ version: 1, exportedAt: Date.now(), data: db });
  const salt = secureRandomBytes(16);
  const nonce = secureRandomBytes(24);
  const key = deriveDbKey(password, salt);
  const box = nacl.secretbox(utf8Encode(json), nonce, key);
  key.fill(0);
  return `${DB_BACKUP_PREFIX}.${base64UrlEncode(concat(salt, nonce, box))}`;
}

export interface RestorePreview {
  licenses: number;
  customers: number;
  exportedAt: number;
}

export async function decryptDbBackup(backup: string, password: string): Promise<{ db: DbSchema; preview: RestorePreview }> {
  const text = backup.trim().replace(/\s+/g, '');
  if (!text) throw new LicenseError('BACKUP_INVALID', 'نص النسخة الاحتياطية فارغ.');
  const parts = text.split('.');
  if (parts.length !== 2 || parts[0] !== DB_BACKUP_PREFIX) {
    throw new LicenseError('BACKUP_INVALID', 'صيغة نسخة قاعدة البيانات غير صحيحة (يجب أن تبدأ بـ PMDB1).');
  }
  let blob: Uint8Array;
  try {
    blob = base64UrlDecode(parts[1]);
  } catch {
    throw new LicenseError('BACKUP_INVALID', 'تعذر فك ترميز النسخة الاحتياطية.');
  }
  if (blob.length < 16 + 24 + 16 + 10) {
    throw new LicenseError('BACKUP_INVALID', 'حجم النسخة الاحتياطية غير صحيح.');
  }
  const salt = blob.slice(0, 16);
  const nonce = blob.slice(16, 40);
  const box = blob.slice(40);
  const key = deriveDbKey(password, salt);
  const opened = nacl.secretbox.open(box, nonce, key);
  key.fill(0);
  if (!opened) {
    throw new LicenseError('BACKUP_PASSWORD', 'فشلت الاستعادة: كلمة المرور غير صحيحة أو النسخة تالفة/معدّلة.');
  }
  let obj: any;
  try {
    obj = JSON.parse(utf8Decode(opened));
  } catch {
    throw new LicenseError('BACKUP_INVALID', 'محتوى النسخة الاحتياطية تالف.');
  }
  if (!obj || obj.version !== 1 || !obj.data) {
    throw new LicenseError('BACKUP_INVALID', 'إصدار النسخة الاحتياطية غير مدعوم.');
  }
  const db = sanitizeDb(obj.data);
  return {
    db,
    preview: {
      licenses: db.licenses.length,
      customers: db.customers.length,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
    },
  };
}

/** Merge-restore: keeps all existing records, adds missing ones from backup. */
export function mergeRestore(current: DbSchema, backup: DbSchema): DbSchema {
  const licIds = new Set(current.licenses.map((r) => r.id));
  const licenses = [...current.licenses];
  for (const r of backup.licenses) {
    if (!licIds.has(r.id)) {
      licenses.push(r);
      licIds.add(r.id);
    }
  }
  const custNums = new Set(current.customers.map((c) => c.customerNumber));
  const customers = [...current.customers];
  for (const c of backup.customers) {
    if (!custNums.has(c.customerNumber)) {
      customers.push(c);
      custNums.add(c.customerNumber);
    } else {
      const idx = customers.findIndex((x) => x.customerNumber === c.customerNumber);
      const merged = Array.from(new Set([...customers[idx].licenseIds, ...c.licenseIds]));
      customers[idx] = { ...customers[idx], licenseIds: merged };
    }
  }
  licenses.sort((a, b) => b.issuedAt - a.issuedAt);
  return { version: 1, licenses, customers, updatedAt: Date.now() };
}

export async function replaceDb(db: DbSchema): Promise<void> {
  await saveDb({ ...db, updatedAt: Date.now() });
}
