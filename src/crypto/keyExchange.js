import { base64ToBytes, bytesToBase64 } from './encoding.js';

const EXCHANGE_ALGORITHM = 'X25519';
const AES_ALGORITHM = 'AES-GCM';

async function importPrivateKey(privateKey) {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(privateKey),
    { name: EXCHANGE_ALGORITHM },
    true,
    ['deriveBits'],
  );
}

async function importPublicKey(publicKey) {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(publicKey),
    { name: EXCHANGE_ALGORITHM },
    true,
    [],
  );
}

export async function generateExchangeKeypair() {
  const keys = await crypto.subtle.generateKey(
    { name: EXCHANGE_ALGORITHM },
    true,
    ['deriveBits'],
  );
  return {
    publicKey: bytesToBase64(await crypto.subtle.exportKey('raw', keys.publicKey)),
    privateKey: bytesToBase64(await crypto.subtle.exportKey('pkcs8', keys.privateKey)),
    algorithm: EXCHANGE_ALGORITHM,
  };
}

export async function initKeyExchange(myPrivKey, theirPubKey) {
  const privateKey = await importPrivateKey(myPrivKey);
  const publicKey = await importPublicKey(theirPubKey);
  const sharedSecretBytes = await crypto.subtle.deriveBits(
    { name: EXCHANGE_ALGORITHM, public: publicKey },
    privateKey,
    256,
  );
  const sharedKey = await crypto.subtle.importKey(
    'raw',
    sharedSecretBytes,
    { name: AES_ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return {
    sharedSecret: bytesToBase64(sharedSecretBytes),
    sharedKey,
    algorithm: EXCHANGE_ALGORITHM,
    keyUsage: AES_ALGORITHM,
  };
}

export async function fetchPublicKey(userId, { apiBaseUrl, fetchImpl = fetch } = {}) {
  if (!apiBaseUrl) throw new TypeError('apiBaseUrl is required.');
  const response = await fetchImpl(`${apiBaseUrl}/users/${encodeURIComponent(userId)}/pubkey`);
  if (!response.ok) throw new Error(`Cannot fetch public key: HTTP ${response.status}`);
  const data = await response.json();
  return data.publicKey ?? data.exchangePublicKey ?? data.pubkey;
}
