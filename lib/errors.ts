/** Typed errors with Arabic user-facing messages. */

export type LicenseErrorCode =
  | 'INVALID_ACTIVATION_REQUEST'
  | 'KEY_UNAVAILABLE'
  | 'KEY_CORRUPTED'
  | 'KEY_EXISTS'
  | 'INVALID_DURATION'
  | 'MISSING_FIELD'
  | 'INVALID_LICENSE_CODE'
  | 'SIGNATURE_INVALID'
  | 'PRODUCT_MISMATCH'
  | 'DEVICE_MISMATCH'
  | 'LICENSE_EXPIRED'
  | 'BACKUP_INVALID'
  | 'BACKUP_PASSWORD'
  | 'STORAGE_ERROR'
  | 'UNKNOWN';

export class LicenseError extends Error {
  code: LicenseErrorCode;
  constructor(code: LicenseErrorCode, message: string) {
    super(message);
    this.name = 'LicenseError';
    this.code = code;
  }
}

export function userMessage(err: unknown): string {
  if (err instanceof LicenseError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
}
