# Database

## Overview

MongoDB is accessed through Mongoose. The implemented models live in `src/db/models/`.

The database stores account metadata, encrypted message payloads, KYC hashes, Merkle commit metadata, and temporary search snippets. It must not store message plaintext in the `Message` collection.

## Collections

| Mongoose Model | File | Collection Purpose |
| --- | --- | --- |
| `User` | `src/db/models/user.js` | User identity metadata and password hash |
| `Conversation` | `src/db/models/conversation.js` | Direct/group conversation metadata |
| `Message` | `src/db/models/message.js` | Encrypted message payloads and integrity metadata |
| `MessageSearch` | `src/db/models/messageSearch.js` | Opt-in temporary plaintext snippets for search |
| `MerkleCommit` | `src/db/models/merkleCommit.js` | Merkle root and on-chain transaction metadata |
| `KYCRecord` | `src/db/models/kycRecord.js` | KYC document hash/signature metadata |

## User

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `username` | String | Yes | Unique, trimmed, 3-64 chars |
| `email` | String | Yes | Unique, lowercase, email regex |
| `password` | String | Yes | Hashed before save, `select: false` |
| `publicKey` | String | No | Max 8192 chars |
| `kycStatus` | String enum | No | `unverified`, `pending`, `verified`, `rejected` |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `username` unique | Login/account lookup |
| `email` unique | Login/account lookup |
| `kycStatus` | KYC filtering |

## Conversation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `members` | ObjectId[] -> `User` | Yes | Must contain at least one unique user |
| `type` | String enum | No | `direct`, `group`; default `direct` |
| `name` | String | No | Max 128 chars |
| `admins` | ObjectId[] -> `User` | No | Group admin metadata |
| `createdBy` | ObjectId -> `User` | No | Creator metadata |
| `mode` | String enum | No | `Standard`, `Privacy`; default `Standard` |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ members: 1 }` | Membership lookup |
| `{ updatedAt: -1 }` | Recent conversation ordering |

## Message

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `senderId` | ObjectId -> `User` | Yes | Sender reference |
| `conversationId` | ObjectId -> `Conversation` | Yes | Conversation reference |
| `encryptedContent` | String | Yes | Ciphertext only |
| `signature` | String | Yes | Sender signature metadata |
| `timestamp` | Date | Yes | Defaults to `Date.now` |
| `contentHash` | String | No | SHA-256 hex; auto-derived from `encryptedContent` if missing |
| `clientMessageId` | String | No | Idempotency key |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ conversationId: 1, timestamp: -1, _id: -1 }` | Chat history |
| `{ senderId: 1, timestamp: -1, _id: -1 }` | Sender history |
| `{ conversationId: 1, senderId: 1, timestamp: -1, _id: -1 }` | Filtered chat history |
| `{ senderId: 1, clientMessageId: 1 }` unique partial | Duplicate-send protection |

## MessageSearch

`MessageSearch` exists because MongoDB text indexes cannot search encrypted `Message.encryptedContent`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `messageId` | ObjectId -> `Message` | Yes | Unique |
| `conversationId` | ObjectId -> `Conversation` | Yes | Search filter |
| `senderId` | ObjectId -> `User` | Yes | Search filter |
| `snippet` | String | Yes | Opt-in plaintext snippet, max 2000 chars |
| `createdAt` | Date | Yes | TTL source |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ snippet: "text" }` | Keyword search |
| `{ createdAt: 1 }` TTL 24h | Privacy retention |
| `{ messageId: 1 }` unique | One snippet per message |
| `{ conversationId: 1, createdAt: -1 }` | Filtered search |
| `{ senderId: 1, createdAt: -1 }` | Sender-filtered search |

Security note: Upload authorization is Not Implemented. The route currently validates shape only.

## MerkleCommit

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `conversationId` | ObjectId -> `Conversation` | Yes | Related conversation |
| `rootHash` | String | Yes | SHA-256 hex, optional `0x` prefix |
| `txHash` | String | No | Ethereum transaction hash |
| `status` | String enum | No | `proposed`, `confirmed`, `disputed`, `failed` |
| `blockNumber` | Number | No | On-chain block metadata |
| `leafCount` | Number | No | Merkle tree size metadata |
| `committedBy` | ObjectId -> `User` | No | Backend user reference |
| `timestamp` | Date | Yes | Defaults to `Date.now` |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ conversationId: 1, timestamp: -1, _id: -1 }` | Commit history |
| `{ txHash: 1 }` unique partial | On-chain transaction uniqueness |

## KYCRecord

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `userId` | ObjectId -> `User` | Yes | User reference |
| `hash` | String | Yes | SHA-256 hex, optional `0x` prefix |
| `signature` | String | Yes | Signature metadata |
| `publicKey` | String | No | Public-key snapshot |
| `status` | String enum | No | `pending`, `verified`, `rejected` |
| `verifiedAt` | Date | No | Verification timestamp |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ userId: 1, createdAt: -1 }` | KYC audit history |
| `{ hash: 1 }` | Hash lookup |

## Query Helpers

`getMessagesByCursor` in `src/db/queries/messages.js` supports cursor pagination by:

| Cursor Mode | Notes |
| --- | --- |
| `timestamp` | Encodes `timestamp` plus `_id` to avoid skipping messages with equal timestamps |
| `_id` | Uses ObjectId ordering |

Maximum page size is 100.

## Not Implemented

| Area | Status |
| --- | --- |
| Database migrations | Not Found |
| Seed scripts | Not Found |
| Production index migration scripts | Not Found |
| MongoDB Atlas project automation | Not Found |
