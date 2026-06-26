# WebSocket Events

## Connection

```javascript
const socket = io(import.meta.env.VITE_API_URL, {
  auth: { token: accessToken }
})
```

The handshake JWT determines `socket.userId`. Emitting `user_online` cannot change identity. Invalid or expired tokens fail with connection error data `{ code: "SOCKET_UNAUTHORIZED" }`.

## Client to Server

| Event | Payload | Behavior |
| --- | --- | --- |
| `join_conversation` / `join` | `{ conversationId }` | Membership check, then join room |
| `leave_conversation` / `leave` | `{ conversationId }` | Leave room |
| `send_message` | `{ conversationId, encryptedContent, signature, msgType?, replyTo?, tempId? }` | Validate membership/current sender key/KYC eligibility/direct-contact block state, join room, then persist and broadcast KYC-mode ciphertext |
| `send_private_message` | `{ conversationId, encryptedContent, signature, tempId }` | Validate the current sender key/direct-contact block state, persist Privacy-mode ciphertext, then relay/queue it |
| `ack_private_message` | `{ tempId }` | Clear this recipient's queued Privacy ciphertext after local receipt/decryption attempt |
| `mark_seen` | `{ messageId, conversationId }` | Member-only seen update |
| `typing` / `stop_typing` | `{ conversationId }` | Relay only after authorized room join |
| `get_missed_messages` | `{ conversationId, since }` | Return up to 100 persisted messages after timestamp |
| `user_online` | None needed | Compatibility status echo only; does not authenticate |

`encryptedContent` is capped at 100,000 characters. `tempId` participates in sender-side duplicate protection for persisted messages.

After membership validation, `send_message` ensures the sender socket has joined the conversation room before broadcasting `new_message`. This keeps an immediately sent first message visible to the creator even when the earlier `join_conversation` handler is still completing.

After a persisted message or encrypted file is stored, the server also emits `conversation_updated` to every member's authenticated `user:<id>` room. Clients use this as a refresh signal for the canonical HTTP conversation list, so invited members see new group activity even before they manually open and join that conversation room. The payload includes the sender and message type so clients can avoid self-notifications and show a useful new-message prompt.

## Server to Client

| Event | Important Fields |
| --- | --- |
| `new_message` | `_id`, `conversationId`, `senderId`, encrypted payload/signature, `senderPublicKey`, type/status/timestamps, `tempId` |
| `new_private_message` | `_id`, `tempId`, conversation/sender ids, encrypted payload/signature, `senderPublicKey`, `createdAt` |
| `private_message_sent` | `tempId`, `messageId`, `conversationId`, server `createdAt` |
| `message_status` | `messageId`, `SENT | DELIVERED | SEEN`, `seenBy?` |
| `user_typing` / `user_stop_typing` | `userId`, `conversationId` |
| `user_status` | `userId`, `isOnline`, `lastSeen?`, `reason?` |
| `user_key_updated` | `userId`; tells conversation participants to refresh member public keys |
| `conversation_created` | `conversationId`, `type`, `mode`, `createdBy`; tells invited online members to refresh their authenticated conversation list |
| `conversation_updated` | `conversationId`, `lastMessageId`, `senderId`, `msgType`, `updatedAt`; tells all members to refresh their authenticated conversation list |
| `missed_messages` | `conversationId`, `messages`, `count` |
| `socket_error` | `event`, `code`, `message`, optional `tempId` |

## Error Codes

| Code | Meaning |
| --- | --- |
| `SOCKET_UNAUTHORIZED` | Handshake JWT invalid/missing |
| `MISSING_CONVERSATION_ID`, `MISSING_REQUIRED_FIELDS` | Invalid payload |
| `NOT_A_MEMBER` | Conversation missing or access denied |
| `USE_PRIVATE_EVENT`, `INVALID_PRIVACY_CONVERSATION` | Wrong mode/event |
| `BLOCKED_BY_YOU`, `BLOCKED_BY_RECEIVER` | Direct sender has blocked the recipient, or recipient has blocked sender |
| `MESSAGE_TOO_LARGE` | Encrypted envelope exceeds limit |
| `SIGNATURE_TOO_LARGE` | Signature exceeds 16 KiB |
| `KEY_MISMATCH` | Signature does not match the account's current public key; restore or explicitly synchronize the device identity |
| `DUPLICATE_MESSAGE` | Reused sender/temp id |
| `MESSAGE_NOT_FOUND` | Seen target missing |
| `INVALID_REQUEST`, `SERVER_ERROR` | Invalid recovery request or internal failure |

## Persistence Rules

* KYC mode: ciphertext/signature are stored and available through HTTP history/recovery.
* Privacy mode: ciphertext/signature are stored in `Message` history, then relayed live and queued per recipient while offline or unopened. The delivery queue is deleted on `ack_private_message` or by `PRIVACY_DELIVERY_TTL_HOURS`; AI summary remains unavailable.
* Attachments use authenticated HTTP upload, direct-contact block validation, then the server emits `new_message` to the room and `conversation_updated` to member user rooms.

## REST Companion

Use `GET /chat/conversations` for the canonical member conversation list, including derived `unreadCount` values. `conversation_created` and `conversation_updated` are refresh signals only; clients still fetch this authenticated endpoint and also refresh after reconnect to recover events missed while offline. `POST /chat/conversations/:conversationId/read` clears the current user's unread count when a conversation is opened. `GET /groups/all` remains available as a compatibility endpoint returning display-oriented conversation metadata. Opening a conversation still requires `join_conversation` followed by `GET /chat/:conversationId/messages`.
