/** Test-only re-exports of pure DB helpers (no AsyncStorage access). */
import { mergeRestore } from './db';
import type { DbSchema } from './types';
import { LicenseError } from './errors';

// Local copy of sanitizeDb logic operating purely on the provided object,
// so self-tests never touch real storage.
export function sanitizeDbForTest(raw: any): DbSchema {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.licenses) || !Array.isArray(raw.customers)) {
    throw new LicenseError('BACKUP_INVALID', 'بيانات قاعدة البيانات غير صالحة.');
  }
  return {
    version: 1,
    licenses: raw.licenses.filter((r: any) => r && typeof r.id === 'string'),
    customers: raw.customers.filter((c: any) => c && typeof c.customerNumber === 'string'),
    updatedAt: Date.now(),
  };
}

export { mergeRestore };
