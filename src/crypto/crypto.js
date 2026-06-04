import {
  base64ToBytes,
  bytesToBase64,
  bytesToText,
  randomBytes,
  toBytes,
} from './encoding.js';

const SIGNING_ALGORITHM = 'Ed25519';
const EXCHANGE_ALGORITHM = 'X25519';
const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const AES_IV_LENGTH = 12;

async function exportBase64(format, key) {
  return bytesToBase64(await crypto.subtle.exportKey(format, key));
}

async function importSigningPrivateKey(privateKey) {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(privateKey),
    { name: SIGNING_ALGORITHM },
    true,
    ['sign'],
  );
}

async function importSigningPublicKey(publicKey) {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(publicKey),
    { name: SIGNING_ALGORITHM },
    true,
    ['verify'],
  );
}

export async function importAesKey(sharedKey) {
  if (sharedKey instanceof CryptoKey) return sharedKey;
  const raw = base64ToBytes(sharedKey);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateKeypair() {
  const signingKeys = await crypto.subtle.generateKey(
    { name: SIGNING_ALGORITHM },
    true,
    ['sign', 'verify'],
  );
  const exchangeKeys = await crypto.subtle.generateKey(
    { name: EXCHANGE_ALGORITHM },
    true,
    ['deriveBits'],
  );

  const publicKey = await exportBase64('raw', signingKeys.publicKey);
  const privateKey = await exportBase64('pkcs8', signingKeys.privateKey);

  return {
    publicKey,
    privateKey,
    signingPublicKey: publicKey,
    signingPrivateKey: privateKey,
    exchangePublicKey: await exportBase64('raw', exchangeKeys.publicKey),
    exchangePrivateKey: await exportBase64('pkcs8', exchangeKeys.privateKey),
    algorithms: {
      signing: SIGNING_ALGORITHM,
      keyExchange: EXCHANGE_ALGORITHM,
      messageCipher: AES_ALGORITHM,
    },
  };
}

export async function encryptMessage(plaintext, sharedKey) {
  const key = await importAesKey(sharedKey);
  const iv = randomBytes(AES_IV_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    key,
    toBytes(plaintext),
  );

  return {
    algorithm: AES_ALGORITHM,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export async function decryptMessage(payload, sharedKey) {
  const key = await importAesKey(sharedKey);
  const ciphertext = typeof payload === 'string' ? payload : payload.ciphertext;
  const iv = typeof payload === 'string' ? undefined : payload.iv;
  if (!iv) throw new TypeError('Encrypted payload must include iv.');

  const plaintext = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return bytesToText(plaintext);
}

export async function signMessage(msg, privateKey) {
  const key = await importSigningPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(SIGNING_ALGORITHM, key, toBytes(msg));
  return bytesToBase64(signature);
}

export async function verifySignature(msg, sig, publicKey) {
  const key = await importSigningPublicKey(publicKey);
  return crypto.subtle.verify(
    SIGNING_ALGORITHM,
    key,
    base64ToBytes(sig),
    toBytes(msg),
  );
}

export const cryptoModule = {
  generateKeypair,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
};
