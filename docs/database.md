# Database Design

## Scope

MongoDB stores account metadata, encrypted transport payloads, KYC hashes, and
Merkle commit metadata. It must never store message plaintext, private keys, raw
KYC documents, or raw identity photos.

## Collections

### User

Stores `username`, normalized `email`, a bcrypt-compatible password hash,
optional public key, KYC status, and timestamps. `username` and `email` are
unique.

### Conversation

Stores unique `members`, `type` (`direct` or `group`), optional group metadata,
admins, creator, privacy mode, and timestamps. The optional group fields allow
the Backend owner to integrate group chat without a schema migration.

### Message

Stores `senderId`, `conversationId`, `encryptedContent`, signature, timestamp,
SHA-256 `contentHash`, and optional idempotency key `clientMessageId`.
`encryptedContent` is ciphertext produced by the client.

### MerkleCommit

Stores conversation reference, Merkle root, optional Sepolia transaction hash,
on-chain status metadata, and timestamp. `txHash` is unique when present.

### KYCRecord

Stores only document hash, signature, optional public-key snapshot, review
status, and timestamps. Raw documents belong outside MongoDB.

### MessageSearch

MongoDB cannot full-text-search E2E ciphertext. Search therefore uses a separate,
opt-in collection of small decrypted snippets. Snippets have a MongoDB text
index and expire automatically after 24 hours. Upload authorization must be
connected to the Auth Service before production use.

## Indexes

| Collection | Index | Purpose |
| --- | --- | --- |
| `Message` | `{ conversationId: 1, timestamp: -1, _id: -1 }` | Chat history |
| `Message` | `{ senderId: 1, timestamp: -1, _id: -1 }` | Sender history |
| `Message` | `{ conversationId: 1, senderId: 1, timestamp: -1, _id: -1 }` | Filtered history |
| `MessageSearch` | `{ snippet: "text" }` | Keyword search |
| `MessageSearch` | `{ createdAt: 1 }`, TTL 24h | Privacy retention |
| `MerkleCommit` | `{ conversationId: 1, timestamp: -1, _id: -1 }` | Commit history |
| `KYCRecord` | `{ userId: 1, createdAt: -1 }` | KYC audit history |

## Search API

`POST /messages/search` accepts `keyword`, optional `dateFrom`, `dateTo`,
`senderId`, `conversationId`, and `limit`. The maximum result count is `100`.

Clients explicitly opt into temporary indexing with
`POST /messages/index-snippet`. A message has at most one temporary snippet;
re-indexing refreshes its TTL.

## Atlas Setup

1. Create a MongoDB Atlas cluster and database user with access limited to the
   application database.
2. Restrict network access to Render egress addresses where the hosting plan
   permits it.
3. Set `MONGO_URI` as a Render secret. Require TLS through the Atlas connection
   string.
4. Keep automatic index creation enabled for development. For production,
   create the documented indexes during deployment review.
