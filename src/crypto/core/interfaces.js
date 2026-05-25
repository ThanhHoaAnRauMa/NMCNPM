/**
 * core/interfaces.js
 * Định nghĩa interface (contract) cho từng nhóm chức năng crypto.
 * Mọi implementation đều phải kế thừa và implement đầy đủ.
 */

export class IKeyPairGenerator {
  /** @returns {Promise<{publicKey, privateKey}>} */
  async generateKeyPair(_options) { throw new Error('Not implemented'); }
  async exportPublicKey(_key, _format = 'spki') { throw new Error('Not implemented'); }
  async exportPrivateKey(_key, _format = 'pkcs8') { throw new Error('Not implemented'); }
  async importPublicKey(_raw, _format = 'spki') { throw new Error('Not implemented'); }
  async importPrivateKey(_raw, _format = 'pkcs8') { throw new Error('Not implemented'); }
}

export class IAsymmetricCipher {
  /** @returns {Promise<ArrayBuffer>} */
  async encrypt(_publicKey, _data) { throw new Error('Not implemented'); }
  /** @returns {Promise<ArrayBuffer>} */
  async decrypt(_privateKey, _ciphertext) { throw new Error('Not implemented'); }
}

export class ISymmetricCipher {
  /** @returns {Promise<{key, iv, ciphertext}>} */
  async encrypt(_key, _data, _iv) { throw new Error('Not implemented'); }
  /** @returns {Promise<ArrayBuffer>} */
  async decrypt(_key, _ciphertext, _iv) { throw new Error('Not implemented'); }
}

export class ISessionKeyGenerator {
  /** @returns {Promise<CryptoKey>} */
  async generate(_options) { throw new Error('Not implemented'); }
  async export(_key) { throw new Error('Not implemented'); }
  async import(_raw) { throw new Error('Not implemented'); }
}

export class IHasher {
  /** @returns {Promise<string>} hex string */
  async hash(_data) { throw new Error('Not implemented'); }
}

export class IOTPGenerator {
  /** @returns {string} */
  generate(_options) { throw new Error('Not implemented'); }
  verify(_otp, _secret, _options) { throw new Error('Not implemented'); }
}
