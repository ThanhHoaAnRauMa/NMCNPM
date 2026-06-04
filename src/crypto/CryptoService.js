/**
 * CryptoService.js
 * Facade duy nhất cho toàn bộ layer crypto.
 * Consumer code chỉ cần import CryptoService, không cần biết cấu trúc bên trong.
 *
 * Usage:
 *   const cs = new CryptoService();
 *   const { publicKey, privateKey } = await cs.rsa.generateKeyPair();
 *   const cipher = await cs.rsa.encrypt(publicKey, 'hello');
 *   const plain  = await cs.rsa.decryptText(privateKey, cipher);
 *
 *   const aesKey = await cs.aes.generateKey();
 *   const b64    = await cs.aes.encryptToBase64(aesKey, 'secret data');
 *   const text   = await cs.aes.decryptFromBase64(aesKey, b64);
 *
 *   const hash   = await cs.hash.sha256('data');
 *   const otp    = await cs.otp.totp('BASE32SECRET');
 */

import { RsaKeyPairGenerator }   from './asymmetric/RsaKeyPairGenerator.js';
import { RsaCipher }             from './asymmetric/RsaCipher.js';
import { AesSessionKeyGenerator, AesGcmCipher } from './symmetric/AesCipher.js';
import { SubtleCryptoHasher, HmacHasher } from './hash/Hasher.js';
import { NumericOtpGenerator, TotpGenerator, HotpGenerator } from './otp/OtpGenerator.js';
import { CryptoUtils }           from './core/utils.js';

/* ═══════════════════════════════════════════════════════
   RSA Facade
═══════════════════════════════════════════════════════ */
class RsaFacade {
  #gen;
  #cipher;

  constructor(options = {}) {
    this.#gen    = new RsaKeyPairGenerator(options);
    this.#cipher = new RsaCipher();
  }

  /** Sinh cặp khóa RSA */
  generateKeyPair(overrides = {}) {
    return this.#gen.generateKeyPair(overrides);
  }

  /** Export public key → ArrayBuffer */
  exportPublicKey(key, format = 'spki') {
    return this.#gen.exportPublicKey(key, format);
  }

  /** Export private key → ArrayBuffer */
  exportPrivateKey(key, format = 'pkcs8') {
    return this.#gen.exportPrivateKey(key, format);
  }

  importPublicKey(raw, format = 'spki') {
    return this.#gen.importPublicKey(raw, format);
  }

  importPrivateKey(raw, format = 'pkcs8') {
    return this.#gen.importPrivateKey(raw, format);
  }

  /** Mã hóa, trả về ArrayBuffer */
  encrypt(publicKey, data) {
    return this.#cipher.encrypt(publicKey, data);
  }

  /** Giải mã, trả về ArrayBuffer */
  decrypt(privateKey, ciphertext) {
    return this.#cipher.decrypt(privateKey, ciphertext);
  }

  /** Giải mã, trả về string */
  async decryptText(privateKey, ciphertext) {
    const buf = await this.#cipher.decrypt(privateKey, ciphertext);
    return CryptoUtils.decode(buf);
  }
}

/* ═══════════════════════════════════════════════════════
   AES Facade
═══════════════════════════════════════════════════════ */
class AesFacade {
  #keyGen;
  #cipher;

  constructor(options = {}) {
    this.#keyGen = new AesSessionKeyGenerator(options);
    this.#cipher = new AesGcmCipher();
  }

  /** Sinh AES session key */
  generateKey() { return this.#keyGen.generate(); }

  /** Export AES key → ArrayBuffer (raw) */
  exportKey(key)  { return this.#keyGen.export(key); }

  /** Import AES key từ raw bytes */
  importKey(raw)  { return this.#keyGen.import(raw); }

  /** Mã hóa → { ciphertext: ArrayBuffer, iv: Uint8Array } */
  encrypt(key, data, iv) { return this.#cipher.encrypt(key, data, iv); }

  /** Giải mã → ArrayBuffer */
  decrypt(key, ciphertext, iv) { return this.#cipher.decrypt(key, ciphertext, iv); }

  /** Mã hóa → base64 string (iv + ciphertext đóng gói) */
  encryptToBase64(key, data) { return this.#cipher.encryptToBase64(key, data); }

  /** Giải mã từ base64 → string */
  decryptFromBase64(key, b64) { return this.#cipher.decryptFromBase64(key, b64); }
}

/* ═══════════════════════════════════════════════════════
   Hash Facade
═══════════════════════════════════════════════════════ */
class HashFacade {
  #sha256 = new SubtleCryptoHasher('SHA-256');
  #sha512 = new SubtleCryptoHasher('SHA-512');
  #sha384 = new SubtleCryptoHasher('SHA-384');
  #hmac   = new HmacHasher('SHA-256');

  sha256(data)  { return this.#sha256.hash(data); }
  sha512(data)  { return this.#sha512.hash(data); }
  sha384(data)  { return this.#sha384.hash(data); }

  sha256Base64(data) { return this.#sha256.hashBase64(data); }

  generateHmacKey()           { return this.#hmac.generateKey(); }
  hmacSign(key, data)         { return this.#hmac.sign(key, data); }
  hmacVerify(key, data, sig)  { return this.#hmac.verify(key, data, sig); }
}

/* ═══════════════════════════════════════════════════════
   OTP Facade
═══════════════════════════════════════════════════════ */
class OtpFacade {
  #numeric = new NumericOtpGenerator();
  #totp    = new TotpGenerator();
  #hotp    = new HotpGenerator();

  /** Sinh OTP ngẫu nhiên N chữ số */
  numeric(digits = 6) { return this.#numeric.generate({ digits }); }

  /** Sinh TOTP từ base32 secret */
  totp(secret) { return this.#totp.generate({ secret }); }

  /** Verify TOTP */
  verifyTotp(secret, otp, window = 1) { return this.#totp.verify({ secret, otp, window }); }

  /** Sinh HOTP từ secret + counter */
  hotp(secret, counter) { return this.#hotp.generate({ secret, counter }); }

  /** Verify HOTP */
  verifyHotp(secret, counter, otp, window = 1) {
    return this.#hotp.verify({ secret, counter, otp, window });
  }
}

/* ═══════════════════════════════════════════════════════
   CryptoService – entry point duy nhất
═══════════════════════════════════════════════════════ */
export class CryptoService {
  constructor({
    rsaOptions = {},
    aesOptions = {},
  } = {}) {
    this.rsa   = new RsaFacade(rsaOptions);
    this.aes   = new AesFacade(aesOptions);
    this.hash  = new HashFacade();
    this.otp   = new OtpFacade();
    this.utils = CryptoUtils;
  }
}

/* Singleton tiện dụng – dùng khi không cần cấu hình đặc biệt */
export const cryptoService = new CryptoService();
