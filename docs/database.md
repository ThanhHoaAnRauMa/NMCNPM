# Database

## Overview

MongoDB is accessed through one root Mongoose connection. Database/search/AI models live in `src/db/models/`; feature-route declarations live in `src/backend/src/models/` and resolve the root singleton through `src/backend/src/utils/mongoose.js`.

The database stores account metadata, encrypted message payloads, KYC hashes, Merkle commit metadata, and temporary search snippets. It must not store message plaintext in the `Message` collection.

## Collections

| Mongoose Model | File | Collection Purpose |
| --- | --- | --- |
| `User` | `src/backend/src/models/User.model.js` | Runtime account/profile/auth state and public key |
| `Conversation` | `src/backend/src/models/Conversation.model.js` | Runtime direct/group metadata and last message |
| `Message` | `src/db/models/message.js` | Canonical encrypted message, file, status, and integrity schema |
| `PrivacyDelivery` | `src/backend/src/models/PrivacyDelivery.model.js` | Per-recipient Privacy-mode ciphertext delivery mailbox with TTL |
| `MessageSearch` | `src/db/models/messageSearch.js` | Opt-in temporary plaintext snippets for search |
| `AISummaryCache` | `src/db/models/aiSummaryCache.js` | Cached Gemini summaries without storing source plaintext |
| `MerkleCommit` | `src/db/models/merkleCommit.js` | Merkle root and on-chain transaction metadata |
| `KYCRecord` | `src/backend/src/models/KYCRecord.model.js` | Runtime KYC proof submission |

Parallel schema files remain for Week 1 database tests/backward compatibility. The canonical server import order intentionally uses the runtime files listed above. New code must not create a separate Mongoose connection or redefine a registered model.

## User

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `username` | String | Yes | Unique, trimmed, 3-64 chars |
| `email` | String | Yes | Unique, lowercase, email regex |
| `password` | String | Yes | bcrypt hash, `select: false` |
| `publicKey` | String | No | Browser RSA/ECDSA public bundle, max 16384 chars |
| `kycStatus` | String enum | No | Runtime values `NONE`, `PENDING`, `VERIFIED`, `REJECTED`; legacy lowercase values accepted |
| `displayName`, `avatarUrl` | String | No | Public profile metadata |
| `isOnline`, `lastSeen` | Boolean, Date | No | Presence metadata |
| `blocklist` | ObjectId[] | No | Blocked users |
| `loginAttempts`, `lockUntil` | Number, Date | No | Temporary login lock state |
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
| `type` | String enum | Yes | Runtime values `DIRECT`, `GROUP` |
| `groupName`, `groupAvatar` | String | No | Group display metadata |
| `roomId` | String | No | Deterministic bytes32 conversation Room ID used in local evidence packages; old records can derive it from `_id` |
| `admins` | ObjectId[] -> `User` | No | Group admin metadata |
| `createdBy` | ObjectId -> `User` | No | Creator metadata |
| `mode` | String enum | No | `KYC`, `PRIVACY` |
| `lastMessage` | ObjectId -> `Message` | No | Sidebar ordering/preview reference |
| `readBy` | `{ userId, lastReadAt }[]` | No | Per-user read timestamp used to derive unread conversation counts |
| `archivedFor` | ObjectId[] -> `User` | No | Users who archived the conversation in their own list |
| `deletedFor` | ObjectId[] -> `User` | No | Users who hid/deleted the conversation from their own list; records remain |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ members: 1, updatedAt: -1 }` | Membership and recent ordering |
| `{ type: 1, members: 1 }` | Direct/group membership lookup |
| `{ type: 1, mode: 1, members: 1 }` | Mode-specific direct conversation lookup |
| `{ "readBy.userId": 1 }` | Read-receipt lookup for unread badges |
| `{ roomId: 1 }` unique sparse | Evidence package room lookup/display |

## Message

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `senderId` | ObjectId -> `User` | Yes | Sender reference |
| `conversationId` | ObjectId -> `Conversation` | Yes | Conversation reference |
| `encryptedContent` | String | Yes | Ciphertext only |
| `signature` | String | Yes | Sender signature metadata |
| `senderPublicKey` | String | No | Verified sender public-key snapshot for rotation-safe signature checks on new records |
| `timestamp` | Date | Yes | Defaults to `Date.now` |
| `contentHash` | String | No | SHA-256 hex; auto-derived from `encryptedContent` if missing |
| `clientMessageId` | String | No | Idempotency key |
| `msgType` | String enum | No | `TEXT`, `FILE`, `SYSTEM` |
| `status` | String enum | No | `SENT`, `DELIVERED`, `SEEN` |
| `fileUrl`, `fileName`, `fileMime`, `fileSizeBytes`, `filePublicId` | Mixed | No | Encrypted attachment blob and display metadata; `filePublicId` may be Cloudinary or `local:` fallback id |
| `replyTo` | ObjectId -> `Message` | No | Reply reference |
| `deletedForSender` | Boolean | No | Sender-only UI hide; record remains |
| timestamps | Date | Auto | `createdAt`, `updatedAt` plus forensic `timestamp` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ conversationId: 1, timestamp: -1, _id: -1 }` | Chat history |
| `{ senderId: 1, timestamp: -1, _id: -1 }` | Sender history |
| `{ conversationId: 1, senderId: 1, timestamp: -1, _id: -1 }` | Filtered chat history |
| `{ senderId: 1, clientMessageId: 1 }` unique partial | Duplicate-send protection |
| `{ conversationId: 1, msgType: 1, createdAt: -1, _id: -1 }` | Attachment history |

## PrivacyDelivery

`PrivacyDelivery` stores a delivery copy of Privacy-mode ciphertext only long enough for offline or not-yet-open clients to receive it. Conversation history lives in `Message`; the delivery copy is deleted when the recipient sends `ack_private_message` and expires automatically by TTL.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `conversationId` | ObjectId -> `Conversation` | Yes | Privacy conversation |
| `recipientId` | ObjectId -> `User` | Yes | Only this user receives and can decrypt the envelope |
| `senderId` | ObjectId -> `User` | Yes | Sender reference |
| `messageId` | ObjectId -> `Message` | Yes | Persisted ciphertext history record |
| `tempId` | String | Yes | Client idempotency/delivery key |
| `encryptedContent` | String | Yes | Signed envelope containing ciphertext and recipient-wrapped AES key |
| `signature` | String | Yes | Sender ECDSA signature over `encryptedContent` |
| `senderPublicKey` | String | No | Sender key snapshot |
| `expiresAt` | Date | Yes | TTL expiry, default controlled by `PRIVACY_DELIVERY_TTL_HOURS` |
| timestamps | Date | Auto | Queue time |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ recipientId: 1, conversationId: 1, createdAt: 1 }` | Deliver queued ciphertext when the recipient joins |
| `{ recipientId: 1, tempId: 1 }` unique | Avoid duplicate queued deliveries |
| `{ expiresAt: 1 }` TTL 0 seconds | Delete undelivered Privacy ciphertext |

## MessageSearch

`MessageSearch` exists because MongoDB text indexes cannot search encrypted `Message.encryptedContent`.

The collection is retained for the opt-in API contract. The frontend conversation search instead decrypts persisted `Message` records locally and therefore can perform substring matching across all decryptable history without storing new plaintext snippets.

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

Security note: root mounting applies JWT authentication. Search is restricted to conversations containing the authenticated user; snippet indexing also verifies sender identity and the source message.

## AISummaryCache

`AISummaryCache` stores Gemini summary results for 1 hour. It does not store the plaintext prompt or source message text.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `conversationId` | ObjectId -> `Conversation` | Yes | Conversation summarized |
| `cacheKey` | String | Yes | SHA-256 key derived from conversation, message ids, plaintext request, and model |
| `messageIds` | ObjectId[] -> `Message` | Yes | Source messages verified by backend |
| `summary` | String | Yes | Gemini response, max 8000 chars |
| `model` | String | Yes | Gemini model name |
| `expiresAt` | Date | Yes | TTL expiry time |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ conversationId: 1, cacheKey: 1 }` unique | Reuse summaries and avoid repeated Gemini calls |
| `{ expiresAt: 1 }` TTL 0 seconds | Delete cached summaries after expiry |

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
| `docHash` | String | Yes | SHA-256 hex submitted by client |
| `signature` | String | Yes | Signature metadata |
| `pubkey` | String | Yes | Public-key snapshot |
| `fullName`, `citizenId`, `dateOfBirth`, `address` | Mixed | New submissions | Reviewer-visible identity fields; legacy records may be null |
| `documentFrontPublicId`, `documentBackPublicId` | String | New submissions | Authenticated Cloudinary asset ids or `local:` private fallback ids; never returned to ordinary users |
| `documentFrontFormat`, `documentBackFormat` | String | New submissions | Signed-delivery format metadata |
| `status` | String enum | No | `PENDING`, `VERIFIED`, `REJECTED`; submission creates `PENDING` only |
| `verifiedAt` | Date | No | Verification timestamp |
| `reviewedAt` | Date | No | Reviewer decision timestamp |
| `reviewedBy` | ObjectId -> `User` | No | Allowlisted reviewer audit reference |
| `rejectionReason` | String | No | Rejection explanation, max 500 chars |
| timestamps | Date | Auto | `createdAt`, `updatedAt` |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ userId: 1 }` unique | One active submission per user |
| `{ status: 1, createdAt: 1, _id: 1 }` | Ordered reviewer queue |
| `{ citizenId: 1 }` unique partial | Prevent one submitted CCCD number from backing multiple accounts |

CCCD images are not stored in MongoDB. New submissions bind the identity fields and both image hashes into `docHash`; private document IDs are exposed only through allowlisted review responses as signed URLs. Production uses authenticated Cloudinary assets, while local/dev can store files under `KYC_LOCAL_STORAGE_DIR` and serve them through short-lived `/kyc/documents/:token` URLs. Rejection removes the images and clears their IDs while retaining audit/hash metadata. Legacy hash-only records remain readable but cannot be approved through the current UI without images.

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
