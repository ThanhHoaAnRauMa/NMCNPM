/**
 * asymmetric/RsaKeyPairGenerator.js
 * Sinh cặp khóa RSA bằng Web Crypto API.
 * Sau này có thể thêm EcKeyPairGenerator, Ed25519KeyPairGenerator, v.v.
 */

import { IKeyPairGenerator } from '../core/interfaces.js';

const DEFAULTS = {
  modulusLength: 2048,        // 2048 | 4096
  publicExponent: new Uint8Array([1, 0, 1]), // 65537
  hash: 'SHA-256',
};

export class RsaKeyPairGenerator extends IKeyPairGenerator {
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULTS, ...options };
  }

  async generateKeyPair(overrides = {}) {
    const opts = { ...this.options, ...overrides };
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: opts.modulusLength,
        publicExponent: opts.publicExponent,
        hash: opts.hash,
      },
      true,   // extractable
      ['encrypt', 'decrypt'],
    );
    return keyPair; // { publicKey: CryptoKey, privateKey: CryptoKey }
  }

  async exportPublicKey(key, format = 'spki') {
    return await crypto.subtle.exportKey(format, key);
  }

  async exportPrivateKey(key, format = 'pkcs8') {
    return await crypto.subtle.exportKey(format, key);
  }

  async importPublicKey(raw, format = 'spki') {
    return await crypto.subtle.importKey(
      format, raw,
      { name: 'RSA-OAEP', hash: this.options.hash },
      true, ['encrypt'],
    );
  }

  async importPrivateKey(raw, format = 'pkcs8') {
    return await crypto.subtle.importKey(
      format, raw,
      { name: 'RSA-OAEP', hash: this.options.hash },
      true, ['decrypt'],
    );
  }
}

/* ---------- Mở rộng trong tương lai: ----------
export class EcKeyPairGenerator extends IKeyPairGenerator { ... }
export class Ed25519KeyPairGenerator extends IKeyPairGenerator { ... }
----------------------------------------------- */
