# Architecture

## Current Repository Layout

| Path | Purpose | Status |
| --- | --- | --- |
| `src/index.js` | Express, HTTP server, Socket.IO setup, MongoDB connection | Implemented |
| `src/routes/messages.js` | Message search and snippet indexing routes | Implemented |
| `src/routes/ai.js` | Gemini-backed summary and moderation routes | Implemented |
| `src/services/` | Gemini client, AI prompts, moderation helper | Implemented |
| `src/db/models/` | Mongoose models | Implemented |
| `src/db/queries/messages.js` | Cursor-based message query helper | Implemented |
| `src/crypto/` | Standalone crypto utilities and demo | Implemented, not wired into backend routes |
| `src/ForensisChat.sol` | Solidity forensic room/root contract | Implemented |
| `script/DeployForensisChat.s.sol` | Foundry deployment script | Implemented |
| `test/backend/` | Node.js backend tests | Implemented |
| `test/ForensisChat.t.sol` | Foundry contract tests | Implemented |
| Frontend app | React/Vite frontend | Not Found |
| AI service routes | Gemini integration | Not Found |

## Runtime Architecture

```mermaid
flowchart TD
  API[HTTP Client] --> Express[Express App]
  SocketClient[Socket.IO Client] --> SocketServer[Socket.IO Server]
  Express --> Health[GET /healthz]
  Express --> MessagesRouter[/messages router]
  Express --> AIRouter[/ai router]
  MessagesRouter --> MessageSearch[(MessageSearch)]
  AIRouter --> AISummaryCache[(AISummaryCache)]
  AIRouter --> Gemini[Gemini API]
  Express --> Mongoose[Mongoose]
  Mongoose --> MongoDB[(MongoDB)]

  Foundry[Foundry CLI] --> Contract[ForensisChat.sol]
  DeployScript[DeployForensisChat.s.sol] --> Contract
```

## Backend Flow

1. `src/index.js` loads `.env`.
2. Express middleware is registered:
   - `helmet`
   - JSON parser with `10kb` limit
   - URL-encoded parser
   - CORS with `CORS_ORIGIN`
   - `morgan` in development
3. `GET /healthz` is registered.
4. `/messages` router is mounted.
5. `/ai` router is mounted.
6. Socket.IO is attached to the HTTP server.
7. Mongoose connects to `MONGO_URI`.
8. HTTP server starts after MongoDB connection succeeds.

## Socket.IO

| Event | Payload | Behavior |
| --- | --- | --- |
| `join` | `{ conversationId }` | Socket joins room named by `conversationId` |
| `leave` | `{ conversationId }` | Socket leaves room named by `conversationId` |
| `disconnect` | None | Logs disconnect |

Message send/receive events are Not Implemented.

## Blockchain Architecture

`ForensisChat.sol` manages on-chain forensic room state:

| Capability | Contract Function |
| --- | --- |
| Initialize upgradeable owner | `initialize` |
| Pause/unpause contract | `pause`, `unpause` |
| Create room | `createRoom` |
| Manage participants | `addParticipant`, `removeParticipant` |
| Transfer room master | `transferRoomOwnership` |
| Propose/veto/execute config | `proposeConfig`, `vetoConfig`, `executeConfig` |
| Propose/dispute/confirm Merkle root | `proposeRoot`, `disputeRoot`, `confirmRoot` |
| Verify Merkle proof | `verifyProof` |

Backend integration with this contract is Not Implemented.

## Crypto Module

The `src/crypto/` module exposes:

| Capability | Files |
| --- | --- |
| RSA-OAEP key generation and encryption | `asymmetric/` |
| AES-GCM encryption | `symmetric/` |
| SHA and HMAC hashing | `hash/` |
| OTP/TOTP/HOTP helpers | `otp/` |
| Facade exports | `CryptoService.js`, `index.js` |

This module is not imported by the current Express routes.

## AI Integration

| Capability | Status | Notes |
| --- | --- | --- |
| Conversation summary | Implemented | `POST /ai/summarize`; requires client-supplied decrypted plaintext |
| Summary cache | Implemented | MongoDB TTL cache in `AISummaryCache`, 1 hour |
| Content moderation | Implemented | `POST /ai/moderate` and middleware factory in `src/services/aiModeration.js` |
| Moderation fallback | Implemented | Allows message with `is_moderated: false` when Gemini is unavailable or times out |

The backend does not decrypt messages. AI routes are an explicit plaintext disclosure path and must not persist source plaintext.

## Non-Implemented Architecture Areas

| Area | Expected by project docs | Current Source Status |
| --- | --- | --- |
| Auth Service | `/auth/register`, `/auth/login`, JWT | Not Implemented |
| Chat Service | real-time encrypted messaging | Only room join/leave implemented |
| File upload | Multer/Cloudinary | Not Found |
| KYC API | `/kyc/submit` | Not Implemented |
| AI forensic analysis | Evidence analysis beyond summary/moderation | Not Implemented |
| Blockchain REST layer | `/merkle/*`, `/forensics/*` | Not Implemented |
| Frontend | React/Vite UI | Not Found |
