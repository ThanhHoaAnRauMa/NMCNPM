import { bytesToHex, toBytes } from './encoding.js';
import { signMessage } from './crypto.js';

async function readDocumentBytes(file) {
  if (file instanceof ArrayBuffer || file instanceof Uint8Array || typeof file === 'string') {
    return toBytes(file);
  }
  if (file && typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  throw new TypeError('file must be File, Blob, string, Uint8Array, or ArrayBuffer.');
}

export async function hashDocument(file) {
  const digest = await crypto.subtle.digest('SHA-256', await readDocumentBytes(file));
  return bytesToHex(digest);
}

export async function signHash(hash, privateKey) {
  return signMessage(hash, privateKey);
}

export async function uploadKYCRecord(
  hash,
  sig,
  pubkey,
  { apiBaseUrl, fetchImpl = fetch } = {},
) {
  if (!apiBaseUrl) throw new TypeError('apiBaseUrl is required.');
  const response = await fetchImpl(`${apiBaseUrl}/kyc/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash, signature: sig, pubkey }),
  });
  if (!response.ok) throw new Error(`KYC upload failed: HTTP ${response.status}`);
  return response.json();
}

export async function checkKYCStatus(userId, { apiBaseUrl, fetchImpl = fetch } = {}) {
  if (!apiBaseUrl) throw new TypeError('apiBaseUrl is required.');
  const response = await fetchImpl(`${apiBaseUrl}/users/${encodeURIComponent(userId)}/kyc-status`);
  if (!response.ok) throw new Error(`Cannot check KYC status: HTTP ${response.status}`);
  return response.json();
}
