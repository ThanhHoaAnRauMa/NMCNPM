import { generateKeypair } from '../crypto.js';
import { hashDocument, signHash, uploadKYCRecord, checkKYCStatus } from '../kyc.js';

const fetchImpl = async (url, options = {}) => {
  if (url.endsWith('/kyc/submit')) {
    return Response.json({
      userId: 'user-demo',
      kycStatus: 'verified',
      timestamp: new Date().toISOString(),
      received: JSON.parse(options.body),
    });
  }
  return Response.json({ userId: 'user-demo', kycStatus: 'verified' });
};

const keys = await generateKeypair();
const hash = await hashDocument('fake citizen id image bytes');
const signature = await signHash(hash, keys.privateKey);
const uploaded = await uploadKYCRecord(hash, signature, keys.publicKey, {
  apiBaseUrl: 'https://api.example.test',
  fetchImpl,
});
const status = await checkKYCStatus('user-demo', {
  apiBaseUrl: 'https://api.example.test',
  fetchImpl,
});

console.log({ hash, signature: signature.slice(0, 20) + '...', uploaded, status });
