import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { LicenseRecord } from './types';
import { formatDateAr } from './helpers';

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export function buildLicenseMessage(r: LicenseRecord): string {
  // Arabic-first message; trailing LTR isolate so the code pastes cleanly.
  const lines = [
    'ترخيص تطبيق Poultry Manager',
    `العميل: ${r.customerName}`,
    `رقم العميل: ${r.customerNumber}`,
    `معرّف الترخيص: ${r.id}`,
    `النوع: ${r.type === 'permanent' ? 'دائم' : `مؤقت (${r.durationDays} يوم)`}`,
    `تاريخ الإصدار: ${formatDateAr(r.issuedAt)}`,
  ];
  if (r.expiresAt !== null) lines.push(`تاريخ الانتهاء: ${formatDateAr(r.expiresAt)}`);
  lines.push('', 'كود الترخيص (انسخه كاملاً في التطبيق):', `\u2066${r.code}\u2069`);
  return lines.join('\n');
}

/** Opens WhatsApp (or the share sheet fallback) with the license message. */
export async function shareViaWhatsApp(message: string): Promise<'opened' | 'fallback' | 'failed'> {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return 'opened';
    }
  } catch {
    // fall through
  }
  return 'failed';
}
