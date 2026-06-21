# API

## Conventions

Local base URL: `http://localhost:3000`.

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

Feature responses generally use `{ "success": true, ... }`. Search/AI routes keep their earlier response contracts. Errors include `message` or `error`; clients must use HTTP status as the primary signal.

Auth endpoints, search, and AI use in-memory per-instance rate limits and return `429` with `Retry-After` when exceeded.

## Health

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| GET | `/health` | No | `{ status, uptime, timestamp }` |
| GET | `/healthz` | No | `{ ok, env }` |

## Authentication

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | No | `{ username, email, password }`; password 8-72 chars |
| POST | `/auth/login` | No | `{ email, password }`; locks for 15 minutes after 5 failed attempts |
| POST | `/auth/refresh` | No | `{ refreshToken }`; returns a new access/refresh pair |
| POST | `/auth/logout` | JWT | Marks account offline; server-side token revocation is not implemented |

Successful register/login response:

```json
{
  "success": true,
  "user": { "id": "...", "username": "alice", "email": "alice@example.com", "kycStatus": "NONE" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

## Users and Conversations

| Method | Path | Body / Query | Purpose |
| --- | --- | --- | --- |
| GET | `/users/me` | None | Current profile |
| PUT | `/users/profile` | `{ displayName?, avatarUrl? }` | Update public profile |
| GET | `/users/search?q=...` | Query length 2-80 | Search username/email/display name |
| POST | `/users/pubkey` | `{ publicKey }` | Store browser public-key bundle |
| GET | `/users/:id/pubkey` | None | Read a member public-key bundle |
| POST | `/users/:id/block` | None | Block user |
| POST | `/users/:id/unblock` | None | Unblock user |
| POST | `/users/:id/conversation` | `{ mode: "KYC" | "PRIVACY" }` | Find or create direct conversation |
| GET | `/chat/conversations` | None | List member conversations with members and last message |
| GET | `/chat/:conversationId/messages?before=&limit=&includeHidden=` | Limit 1-100 | Cursor history; membership required; `includeHidden=true` restores sender-hidden records for evidence export |
| DELETE | `/chat/messages/:messageId` | None | Sender-only local-hide flag; does not delete forensic record |

## Groups

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| POST | `/groups` | `{ name, memberIds, mode? }` | Create group; creator becomes admin |
| GET | `/groups` | None | List current user's groups |
| GET | `/groups/all` | None | Compatibility conversation list with display metadata |
| PATCH | `/groups/:id` | `{ name?, avatarUrl? }` | Admin updates group metadata |
| POST | `/groups/:id/members` | `{ userId }` | Admin adds member |
| DELETE | `/groups/:id/members/:userId` | None | Admin removes member or member leaves |
| POST | `/groups/:id/admins` | `{ userId }` | Promote existing member |

## Encrypted Files

`POST /files/upload` uses `multipart/form-data` and requires membership.

| Field | Required | Notes |
| --- | --- | --- |
| `file` | Yes | AES-GCM encrypted blob; maximum configured by `MAX_FILE_SIZE_MB` |
| `conversationId` | Yes | Target conversation |
| `encryptedContent` | Yes | Signed JSON file envelope with version, IV, and wrapped keys |
| `signature` | Yes | Sender ECDSA signature over envelope |
| `originalName`, `originalMime` | No | Display metadata only |
| `tempId` | No | Client idempotency identifier |

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/files/:conversationId?type=&before=&limit=` | List encrypted attachment messages |
| GET | `/files/:conversationId/jump/:messageId` | Resolve attachment to source message metadata |

Cloudinary stores ciphertext. The browser downloads and decrypts it locally.

## KYC

| Method | Path | Body / Result |
| --- | --- | --- |
| POST | `/kyc/submit` | `{ hash, signature, pubkey }`; creates `PENDING`, never auto-verifies |
| GET | `/kyc/status` | Current user's status |
| GET | `/kyc/status/:userId` | Authenticated status lookup |
| GET | `/kyc/reviews?status=&limit=` | Reviewer allowlist | Review queue; status defaults to `PENDING`, limit max 100 |
| PATCH | `/kyc/reviews/:recordId` | Reviewer allowlist | `{ status: "VERIFIED" | "REJECTED", rejectionReason? }` |

Reviewer access is controlled by `KYC_REVIEWER_USER_IDS`. Reviewers cannot decide their own submission. A rejected user may submit a replacement proof; external document-provider verification remains **Not Implemented**.

## Temporary Message Search

### `POST /messages/index-snippet`

Opt-in body: `{ messageId, conversationId, senderId, snippet }`. Snippet max is 2000 characters and expires after 24 hours. Response `201`: `{ "id": "..." }`.

### `POST /messages/search`

| Field | Required | Notes |
| --- | --- | --- |
| `keyword` | Yes | 1-200 chars |
| `conversationId`, `senderId` | No | ObjectId filters |
| `dateFrom`, `dateTo` | No | Valid date range |
| `limit` | No | Default 20, max 100 |

Response: `{ "results": [{ messageId, conversationId, senderId, snippet, score, createdAt, highlightedSnippet }] }`. Highlight HTML is escaped before `<em>` tags are inserted.

## AI

### `POST /ai/moderate`

Body: `{ "text": "plaintext before encryption" }`, max 4000 chars.

* `200`: allowed or provider-unavailable fallback.
* `422`: `{ error: "message_blocked", moderation }`.
* Provider failure allows the message with `is_moderated: false`; this policy is explicit, not a successful moderation result.

### `POST /ai/summarize`

Body:

```json
{
  "conversationId": "...",
  "messageIds": ["..."],
  "messages": [{ "messageId": "...", "text": "client-decrypted plaintext" }]
}
```

The backend verifies every message belongs to the conversation, sends explicit plaintext to Gemini, and caches only the summary for one hour. Maximums are controlled by `AI_MAX_*` variables. Privacy-mode messages are not persisted and cannot use this endpoint.

## Realtime

Connect Socket.IO with `auth: { token: accessToken }`. Main client events are `join_conversation`, `leave_conversation`, `send_message`, `send_private_message`, `ack_private_message`, `mark_seen`, `typing`, `stop_typing`, and `get_missed_messages`. See `docs/websocket-events.md` for payloads and errors.

## Not Implemented

| API | Status |
| --- | --- |
| Merkle commit/proof-generation/dispute REST API | Not Implemented |
| Evidence transcript export REST API | Not Implemented by design; the browser exports and verifies packages locally |
| Refresh-token revocation/session inventory | Not Implemented |
| OpenAPI/Swagger specification | Not Found; `docs/api/auth.json` is a small Postman collection only |
