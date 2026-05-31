/**
 * hash/Hasher.js
 * SHA-256, SHA-512, v.v. qua Web Crypto.
 * HasherFactory cho phép thêm bcrypt, argon2 phía sau.
 */

import { IHasher } from '../core/interfaces.js';
import { CryptoUtils } from '../core/utils.js';

export class SubtleCryptoHasher extends IHasher {
  constructor(algorithm = 'SHA-256') {
    super();
    this.algorithm = algorithm; // 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
  }

  /**
   * Hash dữ liệu, trả về hex string.
   * @param {string|ArrayBuffer} data
   * @returns {Promise<string>}
   */
  async hash(data) {
    const buf = typeof data === 'string' ? CryptoUtils.encode(data) : data;
    const digest = await crypto.subtle.digest(this.algorithm, buf);
    return CryptoUtils.toHex(digest);
  }

  /** Tiện ích: hash rồi trả về base64 */
  async hashBase64(data) {
    const buf = typeof data === 'string' ? CryptoUtils.encode(data) : data;
    const digest = await crypto.subtle.digest(this.algorithm, buf);
    return CryptoUtils.toBase64(digest);
  }
}

/* ── HMAC ─────────────────────────────────────────────── */
export class HmacHasher {
  constructor(algorithm = 'SHA-256') {
    this.algorithm = algorithm;
  }

  async generateKey() {
    return await crypto.subtle.generateKey(
      { name: 'HMAC', hash: this.algorithm },
      true, ['sign', 'verify'],
    );
  }

  async sign(key, data) {
    const buf = typeof data === 'string' ? CryptoUtils.encode(data) : data;
    const sig = await crypto.subtle.sign('HMAC', key, buf);
    return CryptoUtils.toHex(sig);
  }

  async verify(key, data, signature) {
    const buf = typeof data === 'string' ? CryptoUtils.encode(data) : data;
    const sigBuf = CryptoUtils.fromHex(signature);
    return await crypto.subtle.verify('HMAC', key, sigBuf, buf);
  }
}

/* ── Factory ───────────────────────────────────────────── */
export class HasherFactory {
  static #registry = new Map([
    ['SHA-256', () => new SubtleCryptoHasher('SHA-256')],
    ['SHA-512', () => new SubtleCryptoHasher('SHA-512')],
    ['SHA-384', () => new SubtleCryptoHasher('SHA-384')],
    // ['ARGON2', () => new Argon2Hasher()],   // thêm sau
  ]);

  static create(algorithm = 'SHA-256') {
    const factory = this.#registry.get(algorithm);
    if (!factory) throw new Error(`Unknown hash algorithm: ${algorithm}`);
    return factory();
  }

  static register(algorithm, factory) {
    this.#registry.set(algorithm, factory);
  }
}
