declare module 'tweetnacl' {
  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }
  export interface SignKeyPairFn {
    (): SignKeyPair;
    fromSecretKey(secretKey: Uint8Array): SignKeyPair;
    fromSeed(seed: Uint8Array): SignKeyPair;
  }
  export interface DetachedFn {
    (message: Uint8Array, secretKey: Uint8Array): Uint8Array;
    verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
  }
  export const sign: {
    (message: Uint8Array, secretKey: Uint8Array): Uint8Array;
    open(signedMessage: Uint8Array, publicKey: Uint8Array): Uint8Array | null;
    keyPair: SignKeyPairFn;
    detached: DetachedFn;
    readonly publicKeyLength: number;
    readonly secretKeyLength: number;
    readonly seedLength: number;
    readonly signatureLength: number;
  };
  export const secretbox: {
    (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    readonly keyLength: number;
    readonly nonceLength: number;
  };
  export function hash(message: Uint8Array): Uint8Array;
  export function randomBytes(n: number): Uint8Array;
  export function verify(x: Uint8Array, y: Uint8Array): boolean;
  export function setPRNG(fn: (out: Uint8Array, n: number) => void): void;
  const nacl: {
    sign: typeof sign;
    secretbox: typeof secretbox;
    hash: typeof hash;
    randomBytes: typeof randomBytes;
    verify: typeof verify;
    setPRNG: typeof setPRNG;
  };
  export default nacl;
}
