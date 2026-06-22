# Architecture

## Components

| Component | Responsibility |
| --- | --- |
| `frontend/` | React UI, JWT session, IndexedDB key storage, Web Crypto, Socket.IO client, ethers proof verification |
| `src/index.js` | Canonical Express/HTTP/Socket.IO process and MongoDB connection |
| `src/backend/src/` | CommonJS auth, user, conversation, group, file, KYC, and realtime feature modules |
| `src/routes/` | ESM message-search and Gemini AI routes |
| `src/db/` | Canonical database/search/AI models and query helpers |
| `src/crypto/` | Standalone Node crypto library; not bundled into the browser app |
| `src/ForensisChat.sol` | UUPS forensic room and Merkle-root contract |

## Runtime

```mermaid
flowchart TD
  UI[React UI] --> Session[JWT session]
  UI --> Crypto[Web Crypto API]
  Crypto --> IDB[(IndexedDB private keys)]
  Session --> REST[Express routes]
  Session --> WS[Socket.IO]
  REST --> Models[Mongoose models]
  WS --> Models
  Models --> Mongo[(MongoDB)]
  REST --> Gemini[Gemini REST API]
  REST --> Cloudinary[Cloudinary encrypted blobs]
  UI --> Ethers[ethers.js]
  Ethers --> Contract[ForensisChat on Sepolia]
```

`src/index.js` is the only production entry point. `src/backend/server.js` is a compatibility launcher that dynamically imports it. Feature models use `src/backend/src/utils/mongoose.js` so nested dependencies cannot create a second disconnected Mongoose singleton.

## Message Security Flow

1. Each browser device creates an RSA-OAEP key pair and an ECDSA P-256 key pair.
2. Private JWKs are stored in IndexedDB; the public bundle is stored on `User.publicKey`. Users can export a password-encrypted PBKDF2/AES-GCM backup and restore it only to the same account.
3. Before sending text, the client explicitly calls AI moderation with plaintext.
4. The client creates a random AES-256-GCM key, encrypts content, and RSA-wraps that AES key for every member.
5. The client signs the serialized encrypted envelope and emits it through authenticated Socket.IO.
6. The backend verifies that signature against the account's current public key; stale devices receive `KEY_MISMATCH` before persistence or relay.
7. KYC-mode ciphertext and the verified sender public-key snapshot are stored in MongoDB. Privacy-mode ciphertext is relayed only.
8. Recipients unwrap/decrypt locally and verify against the message snapshot, falling back to the sender's current public key for legacy records.

At session startup, the frontend compares its IndexedDB public bundle with `/users/me.publicKey` and blocks signing/encryption when they differ. A public-key update notifies online conversation participants to refresh recipient keys. Changing a public key does not re-encrypt history. Password-encrypted backup provides manual multi-device recovery; automatic trusted-device synchronization is not implemented.

## Conversation Search Flow

1. The browser pages through all persisted messages in the selected KYC conversation.
2. It decrypts each text envelope locally in bounded batches.
3. It performs case-insensitive substring matching and displays sender, timestamp, highlighted content, and a jump-to-message action.
4. Undecryptable records are counted and excluded; plaintext is not uploaded for this UI flow.

Privacy conversations search only messages still present in the current browser session because their ciphertext is not persisted. The opt-in `MessageSearch` TTL API remains available for compatibility but is not used by the conversation search panel.

## AI Summary Flow

The browser explicitly submits locally decrypted plaintext and message IDs. The backend verifies conversation membership and message metadata, resolves sender IDs to display names/usernames, and builds a transcript prompt without database identifiers. Gemini thinking is disabled for this concise task so the configured output budget remains available for the visible answer. Responses that finish with `MAX_TOKENS` are rejected rather than cached as partial summaries; cache keys include the prompt version and sender labels.

## Forensic Flow

1. The authenticated browser pages through persisted KYC-mode ciphertext and decrypts readable transcript entries locally.
2. It commits deterministic message metadata, ciphertext, and signatures into sorted-pair Keccak-256 Merkle leaves compatible with OpenZeppelin `MerkleProof`.
3. The evidence JSON contains transcript text, signed ciphertext, sender public-key snapshots, leaves, proofs, and the root. Local verification recomputes every leaf/proof and verifies every ECDSA signature.
4. An EVM wallet creates the contract room and explicitly signs propose, dispute, confirm, or proof-verification actions. Wallet private keys do not reach Express.

Transcript plaintext in an exported package is for authorized human review; its integrity is tied indirectly to the included decryptable ciphertext. The package itself must be handled as sensitive evidence.

## HTTP Boundaries

| Prefix | Module | Authentication |
| --- | --- | --- |
| `/health`, `/healthz` | Root health | Public |
| `/auth` | Auth routes | Register/login/refresh public; logout JWT |
| `/users`, `/chat`, `/groups`, `/files`, `/kyc` | Feature routes | JWT |
| `/messages` | Temporary search snippets | JWT |
| `/ai` | Gemini moderation/summary | JWT |

## Realtime Boundaries

Socket authentication occurs during the handshake with `auth.token`. Each connection joins its authenticated `user:<id>` room so REST conversation creation can notify invited members to refresh the canonical conversation list immediately. Room join, send, seen, typing, and missed-message operations verify conversation membership. `user_online` no longer controls identity and cannot impersonate another user.

## Data Ownership

| Data | Owner / Storage |
| --- | --- |
| Password hash, account metadata | MongoDB |
| Public encryption/signing keys | MongoDB |
| Private encryption/signing keys | Browser IndexedDB |
| KYC-mode message ciphertext/signature | MongoDB |
| Privacy-mode ciphertext | In transit only |
| Search plaintext snippet | MongoDB TTL collection, opt-in, 24h |
| AI source plaintext | Request memory only |
| AI summary | MongoDB TTL cache, 1h |
| Encrypted attachment blob | Cloudinary |
| Merkle confirmed roots | Solidity contract |

## Known Architecture Gaps

* Root and feature directories still contain parallel schema declarations; the canonical runtime sharing rule is documented in `docs/database.md`.
* Root proposals require an explicit participant-wallet transaction; there is no unattended signer or periodic commit worker.
* Messages created before sender public-key snapshots were introduced can still fail signature verification after key rotation; no migration source exists for keys that were already overwritten.
* Refresh tokens are returned to JavaScript because cookie-based session rotation is not implemented.
