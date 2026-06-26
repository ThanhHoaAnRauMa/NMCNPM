# Project Context

## Purpose

Secure Chat Forensics is an educational secure messaging platform that combines client-side encrypted chat, MongoDB metadata persistence, opt-in AI summaries, and browser-generated forensic evidence packages.

Code is the source of truth. Requirement documents describe planned scope and must not be treated as implemented behavior.

## Current State

| Area | State | Primary Location |
| --- | --- | --- |
| Frontend | Implemented React/Vite/Tailwind app | `frontend/` |
| Backend | One canonical Express/Socket.IO runtime | `src/index.js` |
| Feature APIs | Auth, users, chat, groups, files, KYC | `src/backend/src/` |
| Database/Search | Mongoose models, indexes, TTL search snippets | `src/db/` |
| AI | Gemini moderation and opt-in summary | `src/routes/ai.js`, `src/services/` |
| Crypto | Browser Web Crypto plus standalone Node module | `frontend/src/lib/crypto.js`, `src/crypto/` |
| Contracts | Foundry contract retained for tests/reference; frontend forensic demo is local evidence only | `src/ForensisChat.sol`, `script/`, `test/` |
| DevOps | Backend/frontend images, Compose, CI, Render production services | `Dockerfile`, `frontend/Dockerfile`, `.github/` |

## Runtime Summary

```mermaid
flowchart LR
  Browser[React client] -->|JWT REST| API[Express API]
  Browser -->|JWT Socket.IO| Socket[Chat socket]
  Browser -->|Web Crypto| Keys[(IndexedDB device keys)]
  API --> Mongo[(MongoDB)]
  API --> Gemini[Google Gemini]
  API --> Cloudinary[Encrypted file blobs]
  Socket --> Mongo
```

The browser creates RSA-OAEP and ECDSA P-256 keys. Message/file content is AES-GCM encrypted with a rotating per-conversation session key; the current AES key is RSA-OAEP-SHA256 wrapped for each conversation member in the signed envelope. Only public key bundles are uploaded. The client detects local/server key mismatch and the backend rejects stale signatures. KYC and Privacy modes persist ciphertext plus a sender-key snapshot; Privacy mode also queues per-recipient ciphertext for offline delivery.

## Implemented User Flows

| Flow | Status |
| --- | --- |
| Register with password confirmation, case-insensitive username/email login, refresh, logout, temporary account lock | Implemented |
| Local device identity and public-key publication | Implemented |
| User search, profile update, block/unblock | Implemented with direct-chat send/upload enforcement |
| Mode-specific direct conversations and group administration | Implemented |
| Realtime conversation sidebar listing | HTTP canonical list plus invited/member message Socket.IO refresh signals, unread badges, sound, and new-message notifications |
| JWT-authenticated realtime encrypted chat | Implemented |
| Delivered/seen, typing, missed-message recovery | Implemented |
| Encrypted attachment upload/download | Implemented with Cloudinary or local private fallback storage |
| Conversation message search | Full persisted history is decrypted and substring-searched locally; sender/time/jump results implemented |
| Gemini moderation before encryption | Removed from normal sends so message plaintext does not leave the browser; AI summary remains explicit opt-in |
| Gemini conversation summary | Full KYC history is decrypted locally, bounded plaintext is explicitly submitted, human sender labels/versioned cache/truncated-response rejection implemented |
| Manual KYC review | Signed CCCD fields/images, private Cloudinary or local fallback upload, allowlisted review, resubmission, and KYC-mode enforcement implemented |
| KYC verified account badge | Implemented in profile, user search, conversation list, chat header, message sender labels, and local search results when `kycStatus` is `VERIFIED` |
| Device-key recovery | Password-encrypted local export/import implemented; no server key custody |
| Forensic evidence | Local transcript package, conversation Room ID, Merkle proof/signature verification implemented |

## Technical Constraints

| Constraint | Handling |
| --- | --- |
| Primary message plaintext must not reach MongoDB | `Message` stores encrypted envelopes and signatures only |
| Browser private keys must not reach backend | Stored in IndexedDB; API receives public bundle only |
| Search and AI need plaintext | Conversation search decrypts locally without uploading plaintext; legacy snippet API remains opt-in/24h; AI source plaintext is not stored |
| Feature models must use canonical DB connection | CommonJS models resolve the root Mongoose singleton through `utils/mongoose.js` |
| Existing database contracts must remain readable | Canonical models accept the existing collection names and preserve existing fields |
| Backend syntax CI must inspect owned source only | Checks `src/backend/server.js` and `src/backend/src`; dependency bundles are excluded |
| Render production is manually provisioned | API and static frontend deploy from `main`; secrets remain outside Git |

## Remaining Work / Blockers

| Area | Gap |
| --- | --- |
| KYC | Manual document review exists; OCR, liveness, government lookup, and external eKYC provider are not integrated |
| Forensics | No unattended periodic root worker; current UI does not perform on-chain room/root actions |
| Multi-device crypto | Local/server mismatch detection and encrypted manual recovery exist; no automatic trusted-device transfer, and legacy messages have no key snapshots |
| Privacy mode | Ciphertext history is persisted in `Message`; offline recipients receive an extra queued ciphertext copy from a TTL mailbox until ACK |
| Attachments | Production Cloudinary is configured; encrypted attachments and KYC documents have local private fallback storage for Docker/dev |
| Deployment | API, frontend, Atlas, Gemini, Cloudinary, KYC reviewer allowlist, and GitHub-to-Render deploy secrets are configured |
| Operations | No Atlas automation, secret rotation workflow, metrics, tracing, or centralized logs |

## Validation Entry Points

```bash
npm ci
npm ci --prefix src/backend
npm test
npm install --prefix frontend
npm --prefix frontend run check
docker compose config
docker compose build
forge test
```

## Future Session Startup

1. Read `AGENTS.md`.
2. Read this file, `docs/changelog.md`, and `docs/decisions.md`.
3. Read only task-relevant docs and source.
