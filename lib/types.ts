/** Shared domain types for the Poultry Manager License Manager. */

export type LicenseType = 'permanent' | 'temporary';

export type RecordStatus = 'active' | 'expired' | 'revoked';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Canonical license payload (the exact data covered by the signature). */
export interface LicensePayload {
  productId: string;
  licenseFormatVersion: number;
  licenseId: string;
  customerName: string;
  customerNumber: string;
  installationId: string;
  devicePublicKeyFingerprint: string;
  licenseType: LicenseType;
  issuedAt: number; // epoch ms
  expiresAt: number | null; // epoch ms, null for permanent
  signatureAlgorithm: string;
}

/** Signed envelope embedded in the license code. */
export interface SignedLicense {
  payload: LicensePayload;
  signature: string; // base64 Ed25519 signature over canonical payload
}

/** Parsed customer activation request. */
export interface ActivationRequestInfo {
  installationId: string;
  devicePublicKey: Uint8Array;
  devicePublicKeyBase64Url: string;
  fingerprint: string; // hex, 64 chars
  issuedAt: number;
}

/** A license record stored in the local administrative database. */
export interface LicenseRecord {
  id: string; // licenseId
  code: string; // full signed license code given to the customer
  payload: LicensePayload;
  signature: string;
  customerName: string;
  customerNumber: string;
  installationId: string;
  fingerprint: string;
  type: LicenseType;
  durationDays: number | null;
  issuedAt: number;
  expiresAt: number | null;
  notes: string;
  revoked: boolean;
  revokedReason: string | null;
  revokedAt: number | null;
  reissueOf: string | null;
  reissueReason: string | null;
  createdAt: number;
}

/** Customer profile in the local database. */
export interface Customer {
  customerNumber: string;
  customerName: string;
  notes: string;
  licenseIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** On-disk database schema (AsyncStorage JSON document). */
export interface DbSchema {
  version: 1;
  licenses: LicenseRecord[];
  customers: Customer[];
  updatedAt: number;
}

/** Individual verification check shown in the UI. */
export interface CheckItem {
  key: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  detail?: string;
}

export interface VerifyOutcome {
  valid: boolean;
  checks: CheckItem[];
  payload: LicensePayload | null;
}

export interface DbStats {
  total: number;
  permanent: number;
  temporary: number;
  expired: number;
  revoked: number;
  customers: number;
}

export interface AppSettings {
  themeMode: ThemeMode;
  setupComplete: boolean;
}

export interface SelfTestCaseResult {
  id: number;
  title: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

export interface SelfTestReport {
  ranAt: number;
  passed: number;
  failed: number;
  results: SelfTestCaseResult[];
}
