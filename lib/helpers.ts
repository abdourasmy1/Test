import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';

/* ------------------------------------------------------------------ */
/* Base64 / Base64URL (dependency-free, deterministic)                 */
/* ------------------------------------------------------------------ */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_REV[B64[i]] = i;

export function base64Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function base64Decode(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, '');
  if (clean.length === 0 || clean.length % 4 !== 0) throw new Error('ترميز Base64 غير صالح');
  let pad = 0;
  if (clean.endsWith('==')) pad = 2;
  else if (clean.endsWith('=')) pad = 1;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_REV[clean[i]];
    const c1 = B64_REV[clean[i + 1]];
    const c2 = clean[i + 2] === '=' ? 0 : B64_REV[clean[i + 2]];
    const c3 = clean[i + 3] === '=' ? 0 : B64_REV[clean[i + 3]];
    if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined) {
      throw new Error('ترميز Base64 غير صالح');
    }
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(s: string): Uint8Array {
  let std = s.replace(/-/g, '+').replace(/_/g, '/');
  const rem = std.length % 4;
  if (rem === 1) throw new Error('ترميز Base64 غير صالح');
  if (rem === 2) std += '==';
  else if (rem === 3) std += '=';
  return base64Decode(std);
}

/* ------------------------------------------------------------------ */
/* Hex                                                               */
/* ------------------------------------------------------------------ */

const HEX = '0123456789abcdef';

export function hexEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[(bytes[i] >> 4) & 15] + HEX[bytes[i] & 15];
  }
  return out;
}

export function hexDecode(s: string): Uint8Array {
  const clean = s.trim().toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error('قيمة HEX غير صالحة');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* UTF-8 (manual implementation so Arabic text is handled identically */
/* on every platform)                                                 */
/* ------------------------------------------------------------------ */

export function utf8Encode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++];
      if (b1 === undefined || (b1 & 0xc0) !== 0x80) throw new Error('ترميز UTF-8 غير صالح');
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      if (b1 === undefined || b2 === undefined || (b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
        throw new Error('ترميز UTF-8 غير صالح');
      }
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else if ((b0 & 0xf8) === 0xf0) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      if (
        b1 === undefined || b2 === undefined || b3 === undefined ||
        (b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80
      ) {
        throw new Error('ترميز UTF-8 غير صالح');
      }
      let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      throw new Error('ترميز UTF-8 غير صالح');
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Secure randomness                                                 */
/* ------------------------------------------------------------------ */

let prngSeeded = false;

/** Route tweetnacl's randomness through the platform CSPRNG (expo-crypto). */
export function ensureSecurePRNG(): void {
  if (prngSeeded) return;
  try {
    nacl.setPRNG((out: Uint8Array, n: number) => {
      const rnd = Crypto.getRandomBytes(n);
      for (let i = 0; i < n; i++) out[i] = rnd[i];
    });
    prngSeeded = true;
  } catch {
    // Keep tweetnacl's default PRNG as a last resort.
  }
}

export function secureRandomBytes(n: number): Uint8Array {
  if (n <= 0 || n > 1024) throw new Error('عدد البايتات العشوائية غير صالح');
  try {
    return Crypto.getRandomBytes(n);
  } catch {
    ensureSecurePRNG();
    return nacl.randomBytes(n);
  }
}

export function randomHex(bytes: number): string {
  return hexEncode(secureRandomBytes(bytes));
}

/** First 32 bytes of SHA-512, hex-encoded (64 chars). Used for key fingerprints. */
export function fingerprintOf(publicKeyBytes: Uint8Array): string {
  return hexEncode(nacl.hash(publicKeyBytes).slice(0, 32));
}

/* ------------------------------------------------------------------ */
/* Dates (manual Arabic formatting - identical on all platforms)       */
/* ------------------------------------------------------------------ */

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function formatDateAr(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTimeAr(ts: number): string {
  const d = new Date(ts);
  return `${formatDateAr(ts)} - ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function daysUntil(ts: number, now: number = Date.now()): number {
  return Math.ceil((ts - now) / 86400000);
}

export function addDays(ts: number, days: number): number {
  return ts + days * 86400000;
}

/* ------------------------------------------------------------------ */
/* Text utilities                                                    */
/* ------------------------------------------------------------------ */

export function chunkString(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

export function truncateMiddle(s: string, head = 10, tail = 8): string {
  if (s.length <= head + tail + 3) return s;
  return s.slice(0, head) + '...' + s.slice(s.length - tail);
}

export function groupFingerprint(fp: string): string {
  return chunkString(fp, 8).join(' ');
}
