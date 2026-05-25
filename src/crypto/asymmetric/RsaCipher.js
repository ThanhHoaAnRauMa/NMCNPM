/**
 * asymmetric/RsaCipher.js
 * Mã hóa / giải mã RSA-OAEP.
 * Factory AsymmetricCipherFactory cho phép mở rộng sang ECIES, v.v.
 */

import { IAsymmetricCipher } from '../core/interfaces.js'

export class RsaCipher extends IAsymmetricCipher {
  async encrypt(publicKey, data) {
    const buf = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;
    return await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, buf);
  }

  async decrypt(privateKey, ciphertext) {
    return await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, ciphertext);
  }
}

/* ---------- Factory ---------- */
export class AsymmetricCipherFactory {
  static #registry = new Map([
    ['RSA-OAEP', () => new RsaCipher()],
    // ['ECIES',   () => new EciesCipher()],  // thêm sau
  ]);

  static create(algorithm = 'RSA-OAEP') {
    const factory = this.#registry.get(algorithm);
    if (!factory) throw new Error(`Unknown asymmetric algorithm: ${algorithm}`);
    return factory();
  }

  static register(algorithm, factory) {
    this.#registry.set(algorithm, factory);
  }
}
