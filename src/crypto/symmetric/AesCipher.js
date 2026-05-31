/**
 * symmetric/AesCipher.js
 * Sinh session key AES-GCM, mã hóa / giải mã.
 * SymmetricCipherFactory hỗ trợ mở rộng sang ChaCha20, AES-CBC, v.v.
 */

import { ISessionKeyGenerator, ISymmetricCipher } from '../core/interfaces.js';
import { CryptoUtils } from '../core/utils.js';

/* ── Session Key Generator ─────────────────────────────── */
export class AesSessionKeyGenerator extends ISessionKeyGenerator {
  constructor({ length = 256, mode = 'AES-GCM' } = {}) {
    super();
    this.length = length; // 128 | 192 | 256
    this.mode = mode;
  }

  async generate() {
    return await crypto.subtle.generateKey(
      { name: this.mode, length: this.length },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  async export(key) {
    return await crypto.subtle.exportKey('raw', key);
  }

  async import(raw) {
    return await crypto.subtle.importKey(
      'raw', raw,
      { name: this.mode, length: this.length },
      true,
      ['encrypt', 'decrypt'],
    );
  }
}

/* ── AES-GCM Cipher ────────────────────────────────────── */
export class AesGcmCipher extends ISymmetricCipher {
  /** IV length = 12 bytes (96 bit) cho GCM */
  static IV_LENGTH = 12;

  /**
   * Mã hóa.
   * @param {CryptoKey} key
   * @param {string|ArrayBuffer} data
   * @param {Uint8Array} [iv] - tự sinh nếu không truyền
   * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array, tag?: string}>}
   */
  async encrypt(key, data, iv) {
    iv = iv ?? CryptoUtils.randomBytes(AesGcmCipher.IV_LENGTH);
    const buf = typeof data === 'string' ? CryptoUtils.encode(data) : data;
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      buf,
    );
    return { ciphertext, iv };
  }

  /**
   * Giải mã.
   * @returns {Promise<ArrayBuffer>}
   */
  async decrypt(key, ciphertext, iv) {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
  }

  /**
   * Mã hóa rồi đóng gói thành base64 payload: base64(iv + ciphertext)
   */
  async encryptToBase64(key, data) {
    const { ciphertext, iv } = await this.encrypt(key, data);
    const packed = CryptoUtils.concat(iv, new Uint8Array(ciphertext));
    return CryptoUtils.toBase64(packed);
  }

  /**
   * Giải gói base64 payload rồi giải mã.
   */
  async decryptFromBase64(key, b64) {
    const packed = CryptoUtils.fromBase64(b64);
    const iv = packed.slice(0, AesGcmCipher.IV_LENGTH);
    const ciphertext = packed.slice(AesGcmCipher.IV_LENGTH);
    const plain = await this.decrypt(key, ciphertext, iv);
    return CryptoUtils.decode(plain);
  }
}

/* ── Factory ───────────────────────────────────────────── */
export class SymmetricCipherFactory {
  static #registry = new Map([
    ['AES-GCM',  () => new AesGcmCipher()],
    // ['AES-CBC',  () => new AesCbcCipher()],
    // ['CHACHA20', () => new ChaCha20Cipher()],
  ]);

  static create(algorithm = 'AES-GCM') {
    const factory = this.#registry.get(algorithm);
    if (!factory) throw new Error(`Unknown symmetric algorithm: ${algorithm}`);
    return factory();
  }

  static register(algorithm, factory) {
    this.#registry.set(algorithm, factory);
  }
}
