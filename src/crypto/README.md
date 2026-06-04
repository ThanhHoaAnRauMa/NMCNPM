
# SecureChat Crypto Modules

Nguoi phu trach: Vo Nhat Anh.

Thu muc nay cung cap cac module ma frontend/backend can import de tich hop ma hoa dau cuoi, key exchange, forensic log, KYC va evidence export.

## Yeu cau runtime

- Browser hien dai ho tro WebCrypto.
- Node.js 24+ de chay demo bang terminal.
- Tat ca key/signature/ciphertext trong API cong khai duoc dong goi bang `base64` hoac JSON de gui qua REST/WebSocket.

## Cai dat va chay demo

```powershell
cd src\crypto
npm run demo:all
```

Chay tung dich vu:

```powershell
npm run demo:crypto
npm run demo:key-exchange
npm run demo:forensic-log
npm run demo:kyc
npm run demo:evidence
npm run demo:security
```

## 1. Crypto wrapper

File: `src/crypto/crypto.js`

```js
import {
  generateKeypair,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
} from './crypto.js';
```

### `generateKeypair()`

Input: khong co.

Output:

```js
{
  publicKey: string,          // Ed25519 public key, base64
  privateKey: string,         // Ed25519 private key pkcs8, base64
  signingPublicKey: string,
  signingPrivateKey: string,
  exchangePublicKey: string,  // X25519 public key, base64
  exchangePrivateKey: string, // X25519 private key pkcs8, base64
  algorithms: object
}
```

Luu y: chi upload `publicKey` hoac `exchangePublicKey` len server. Khong gui private key qua network.

### `encryptMessage(plaintext, sharedKey)`

Input:

- `plaintext`: `string | Uint8Array | ArrayBuffer`
- `sharedKey`: `CryptoKey | base64 raw AES key`

Output:

```js
{
  algorithm: 'AES-GCM',
  iv: string,
  ciphertext: string
}
```

### `decryptMessage(payload, sharedKey)`

Input:

- `payload`: object tra ve tu `encryptMessage`
- `sharedKey`: cung key da ma hoa

Output: plaintext `string`.

### `signMessage(msg, privateKey)`

Input:

- `msg`: `string | Uint8Array | ArrayBuffer`
- `privateKey`: Ed25519 pkcs8 base64

Output: signature base64.

### `verifySignature(msg, sig, publicKey)`

Input:

- `msg`: noi dung goc
- `sig`: signature base64
- `publicKey`: Ed25519 raw public key base64

Output: `boolean`.

## 2. Key Exchange

File: `src/crypto/keyExchange.js`

```js
import { generateExchangeKeypair, initKeyExchange, fetchPublicKey } from './keyExchange.js';
```

### `generateExchangeKeypair()`

Output:

```js
{
  publicKey: string,
  privateKey: string,
  algorithm: 'X25519'
}
```

### `initKeyExchange(myPrivKey, theirPubKey)`

Input:

- `myPrivKey`: X25519 private key pkcs8 base64
- `theirPubKey`: X25519 public key raw base64

Output:

```js
{
  sharedSecret: string, // base64
  sharedKey: CryptoKey, // AES-GCM key dung cho encryptMessage/decryptMessage
  algorithm: 'X25519',
  keyUsage: 'AES-GCM'
}
```

### `fetchPublicKey(userId, options)`

Goi backend `GET /users/:id/pubkey`.

```js
const theirPubKey = await fetchPublicKey('userB', { apiBaseUrl: VITE_API_URL });
```

## 3. Forensic Log

File: `src/crypto/forensicLog.js`

```js
import { appendLog, getLogs, clearSession } from './forensicLog.js';
```

### `appendLog(entry)`

Input:

```js
{
  conversationId: string,
  messageId: string,
  timestamp?: string,
  encryptedContent: string,
  signature: string
}
```

Output: entry da luu. Browser dung IndexedDB, Node demo dung in-memory store.

### `getLogs(conversationId, dateRange)`

Input:

```js
getLogs('conversation-1', { from: '2026-06-01', to: '2026-06-04' })
```

Output: mang log da sap xep theo thoi gian.

### `clearSession(conversationId)`

Xoa log cua conversation, dung khi Privacy Mode ket thuc.

## 4. KYC Flow

File: `src/crypto/kyc.js`

```js
import { hashDocument, signHash, uploadKYCRecord, checkKYCStatus } from './kyc.js';
```

### `hashDocument(file)`

Input: `File | Blob | string | Uint8Array | ArrayBuffer`.

Output: SHA-256 hex string.

### `signHash(hash, privateKey)`

Input:

- `hash`: SHA-256 hex
- `privateKey`: Ed25519 private key base64

Output: signature base64.

### `uploadKYCRecord(hash, sig, pubkey, options)`

Goi backend `POST /kyc/submit` voi body:

```js
{ hash, signature: sig, pubkey }
```

Output: JSON backend, vi du:

```js
{ userId: '...', kycStatus: 'verified', timestamp: '...' }
```

### `checkKYCStatus(userId, options)`

Goi backend `GET /users/:id/kyc-status`.

## 5. Evidence Export

File: `src/crypto/evidenceExport.js`

```js
import { exportEvidence } from './evidenceExport.js';
```

### `exportEvidence(conversationId, dateRange, options)`

Doc local forensic log, goi blockchain API, roi tra JSON package:

```js
{
  version: '1.0',
  exportedAt: string,
  conversationId: string,
  dateRange: object,
  messages: [
    { messageId, encryptedContent, signature, timestamp }
  ],
  merkleProof: string[],
  rootHash: string,
  txHash: string,
  etherscanUrl: string
}
```

Backend/Blockchain API can co:

- `GET /merkle/verify/:conversationId/:leafIndex`
- `GET /forensics/:conversationId`

## 6. Security Middleware

File: `src/backend/middleware/security.js`

```js
import { createSecurityMiddleware } from '../src/backend/middleware/security.js';

const security = createSecurityMiddleware();
app.use(security.securityHeaders);
app.use(security.rateLimit);
app.use(security.sanitizeInput);
app.post('/auth/login', security.loginRateLimit, security.validateAuthPayload, loginHandler);
```

Module nay cung cap:

- `rateLimit`: mac dinh 100 req/15 phut/IP.
- `loginRateLimit`: mac dinh 10 req/15 phut/IP.
- `securityHeaders`: CSP, no-sniff, deny iframe.
- `sanitizeInput`: sanitize body/query/params co ban.
- `validateAuthPayload`: validate email, password, username cho auth route.

## Luu y bao mat

- Private key khong bao gio duoc serialize len server.
- Moi message dung AES-GCM IV ngau nhien 12 byte.
- Frontend can verify signature truoc khi render message da giai ma.
- Backend can chong replay bang `messageId` va `timestamp`.
- Production rate limit nen dung Redis/shared store thay vi memory store.
