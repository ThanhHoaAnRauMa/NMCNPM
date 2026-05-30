/**
 * examples/demo.js
 * Minh họa cách sử dụng CryptoService trong thực tế.
 * Chạy trong browser hoặc Node 20+ (với node --experimental-vm-modules).
 */

import { cryptoService } from '../CryptoService.js'

async function demoRsa() {
  console.group('── RSA ──────────────────────────────────────');

  // Sinh cặp khóa
  const { publicKey, privateKey } = await cryptoService.rsa.generateKeyPair();
  console.log('KeyPair generated:', publicKey.type, privateKey.type);

  // Mã hóa
  const plaintext = 'Hello RSA-OAEP!';
  const cipherBuf = await cryptoService.rsa.encrypt(publicKey, plaintext);
  console.log('Ciphertext length:', cipherBuf.byteLength, 'bytes');

  // Giải mã
  const decrypted = await cryptoService.rsa.decryptText(privateKey, cipherBuf);
  console.log('Decrypted:', decrypted);

  console.groupEnd();
}

async function demoAes() {
  console.group('── AES-GCM ──────────────────────────────────');

  const key = await cryptoService.aes.generateKey();
  console.log('Session key algorithm:', key.algorithm.name, key.algorithm.length, 'bit');

  // Mã hóa → base64 (tiện gửi qua mạng / lưu DB)
  const b64 = await cryptoService.aes.encryptToBase64(key, 'Test AES');
  console.log('Encrypted (base64):', b64.slice(0, 40) + '...');

  // Giải mã từ base64
  const plain = await cryptoService.aes.decryptFromBase64(key, b64);
  console.log('Decrypted:', plain);

  // Export key để lưu trữ / gửi kèm RSA
  const rawKey = await cryptoService.aes.exportKey(key);
  console.log('Exported key bytes:', rawKey.byteLength);

  // Import lại
  const key2 = await cryptoService.aes.importKey(rawKey);
  const plain2 = await cryptoService.aes.decryptFromBase64(key2, b64);
  console.log('Decrypted with re-imported key:', plain2);

  console.groupEnd();
}

async function demoHash() {
  console.group('── Hash ─────────────────────────────────────');

  const data = 'Test hash';
  const h256 = await cryptoService.hash.sha256(data);
  const h512 = await cryptoService.hash.sha512(data);
  console.log('SHA-256:', h256);
  console.log('SHA-512:', h512);

  // HMAC
  const hmacKey = await cryptoService.hash.generateHmacKey();
  const sig = await cryptoService.hash.hmacSign(hmacKey, data);
  const valid = await cryptoService.hash.hmacVerify(hmacKey, data, sig);
  console.log('HMAC-SHA256:', sig.slice(0, 16) + '...');
  console.log('HMAC verify:', valid);

  console.groupEnd();
}

async function demoOtp() {
  console.group('── OTP ──────────────────────────────────────');

  // OTP ngẫu nhiên 6 số (dùng cho email OTP)
  const numOtp = cryptoService.otp.numeric(6);
  console.log('Numeric OTP:', numOtp);

  // TOTP (dùng cho authenticator app như Google Auth)
  const secret = 'JBSWY3DPEHPK3PXP'; // base32 secret
  const totpCode = await cryptoService.otp.totp(secret);
  console.log('TOTP code:', totpCode);

  const verified = await cryptoService.otp.verifyTotp(secret, totpCode);
  console.log('TOTP verified:', verified);

  // HOTP (dùng cho YubiKey, hardware token)
  const hotpCode = await cryptoService.otp.hotp(secret, 42);
  console.log('HOTP (counter=42):', hotpCode);

  console.groupEnd();
}

async function demoHybridEncryption() {
  console.group('── Hybrid Encryption (RSA + AES) ────────────');
  // Pattern thực tế: mã hóa session key AES bằng RSA public key,
  // sau đó mã hóa data lớn bằng AES.

  const { publicKey, privateKey } = await cryptoService.rsa.generateKeyPair();
  const aesKey = await cryptoService.aes.generateKey();

  // 1. Encrypt session key bằng RSA
  const rawAesKey = await cryptoService.aes.exportKey(aesKey);
  const encryptedKey = await cryptoService.rsa.encrypt(publicKey, rawAesKey);

  // 2. Encrypt payload bằng AES
  const payload = 'Dữ liệu lớn cần bảo vệ...';
  const encData = await cryptoService.aes.encryptToBase64(aesKey, payload);

  console.log('Encrypted AES key bytes:', encryptedKey.byteLength);
  console.log('Encrypted data (base64):', encData.slice(0, 40) + '...');

  // ─── Receiver side ───
  // 1. Decrypt session key bằng RSA private key
  const decKeyBuf = await cryptoService.rsa.decrypt(privateKey, encryptedKey);
  const decAesKey = await cryptoService.aes.importKey(decKeyBuf);

  // 2. Decrypt payload
  const decPayload = await cryptoService.aes.decryptFromBase64(decAesKey, encData);
  console.log('Decrypted payload:', decPayload);

  console.groupEnd();
}

// ── Run all demos ────────────────────────────────────────
(async () => {
  try {
    await demoRsa();
    await demoAes();
    await demoHash();
    await demoOtp();
    await demoHybridEncryption();
  } catch (e) {
    console.error('Demo error:', e);
  }
})();
