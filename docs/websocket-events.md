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
| `send_message` | `{ conversationId, encryptedContent, signature, msgType?, replyTo?, tempId? }` | Validate membership, join sender room, then persist and broadcast KYC-mode ciphertext |
| `send_private_message` | `{ conversationId, encryptedContent, signature, tempId }` | Relay Privacy-mode ciphertext without persistence |
| `ack_private_message` | `{ tempId }` | Clear relay tracking after two participant ACKs |
| `mark_seen` | `{ messageId, conversationId }` | Member-only seen update |
| `typing` / `stop_typing` | `{ conversationId }` | Relay only after authorized room join |
| `get_missed_messages` | `{ conversationId, since }` | Return up to 100 persisted messages after timestamp |
| `user_online` | None needed | Compatibility status echo only; does not authenticate |

`encryptedContent` is capped at 100,000 characters. `tempId` participates in sender-side duplicate protection for persisted messages.

After membership validation, `send_message` ensures the sender socket has joined the conversation room before broadcasting `new_message`. This keeps an immediately sent first message visible to the creator even when the earlier `join_conversation` handler is still completing.

## Server to Client

| Event | Important Fields |
| --- | --- |
| `new_message` | `_id`, `conversationId`, `senderId`, encrypted payload/signature, type/status/timestamps, `tempId` |
| `new_private_message` | `tempId`, conversation/sender ids, encrypted payload/signature, `createdAt` |
| `private_message_sent` | `tempId` |
| `message_status` | `messageId`, `SENT | DELIVERED | SEEN`, `seenBy?` |
| `user_typing` / `user_stop_typing` | `userId`, `conversationId` |
| `user_status` | `userId`, `isOnline`, `lastSeen?`, `reason?` |
| `missed_messages` | `conversationId`, `messages`, `count` |
| `socket_error` | `event`, `code`, `message`, optional `tempId` |

## Error Codes

| Code | Meaning |
| --- | --- |
| `SOCKET_UNAUTHORIZED` | Handshake JWT invalid/missing |
| `MISSING_CONVERSATION_ID`, `MISSING_REQUIRED_FIELDS` | Invalid payload |
| `NOT_A_MEMBER` | Conversation missing or access denied |
| `USE_PRIVATE_EVENT`, `INVALID_PRIVACY_CONVERSATION` | Wrong mode/event |
| `BLOCKED_BY_RECEIVER` | Recipient blocked sender |
| `MESSAGE_TOO_LARGE` | Encrypted envelope exceeds limit |
| `SIGNATURE_TOO_LARGE` | Signature exceeds 16 KiB |
| `DUPLICATE_MESSAGE` | Reused sender/temp id |
| `MESSAGE_NOT_FOUND` | Seen target missing |
| `INVALID_REQUEST`, `SERVER_ERROR` | Invalid recovery request or internal failure |

## Persistence Rules

* KYC mode: ciphertext/signature are stored and available through HTTP history/recovery.
* Privacy mode: payload is memory-relayed only; offline recovery and AI summary are unavailable.
* Attachments use authenticated HTTP upload, then the server emits `new_message` to the room.

## REST Companion

Use `GET /chat/conversations` for the canonical member conversation list. `GET /groups/all` remains available as a compatibility endpoint returning display-oriented conversation metadata. Opening a conversation still requires `join_conversation` followed by `GET /chat/:conversationId/messages`.
