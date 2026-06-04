# Project Context

## Purpose

Secure Chat Forensics is an educational secure messaging project that aims to combine encrypted messaging metadata, MongoDB persistence, and blockchain-backed forensic verification.

The current repository is not a complete application. It contains:

| Area | Current State |
| --- | --- |
| Backend | Minimal Express and Socket.IO server |
| Database | Mongoose schemas and message search support |
| Blockchain | Foundry-based Solidity contract and tests |
| Crypto | Standalone JavaScript crypto module |
| DevOps | Docker, Docker Compose, GitHub Actions, Render trigger workflow |
| Frontend | Not Implemented in this repository |
| AI | Gemini summary and moderation routes implemented for opt-in plaintext |

Code remains the source of truth. Planned features from requirement documents must not be treated as implemented unless source code exists.

## Current Architecture Summary

```mermaid
flowchart LR
  Client[Client or API consumer] --> Express[Express server]
  Express --> Messages[/messages routes]
  Express --> AI[/ai routes]
  Express --> SocketIO[Socket.IO join/leave rooms]
  Express --> Mongo[(MongoDB via Mongoose)]
  Messages --> MessageSearch[(MessageSearch collection)]
  AI --> AISummaryCache[(AISummaryCache collection)]
  AI --> Gemini[Google Gemini API]
  Foundry[Foundry tests/scripts] --> Contract[ForensisChat.sol]
```

## Implemented Backend Surface

| Component | Status | Notes |
| --- | --- | --- |
| `GET /healthz` | Implemented | Returns `{ ok: true, env }` |
| `POST /messages/search` | Implemented | Searches opt-in ephemeral snippets |
| `POST /messages/index-snippet` | Implemented | Upserts one temporary snippet per message |
| `POST /ai/summarize` | Implemented | Summarizes client-supplied decrypted plaintext and caches summary for 1 hour |
| `POST /ai/moderate` | Implemented | Moderates plaintext before encryption; allows with `is_moderated: false` on Gemini failure |
| Socket.IO `join` / `leave` | Implemented | Joins/leaves rooms by `conversationId` |
| Authentication routes | Not Implemented | No `/auth/*` route files found |
| User public-key routes | Not Implemented | No `/users/*` route files found |
| KYC submission API | Not Implemented | Model exists only |
| Merkle REST API | Not Implemented | Contract and model exist, no backend REST layer |
| AI forensic analysis API | Not Implemented | Future AI endpoints beyond summarize/moderate |

## Completed Milestones

| Milestone | Evidence |
| --- | --- |
| Database schema v1 | `src/db/models/*.js` |
| Message search API | `src/routes/messages.js` |
| Cursor query helper | `src/db/queries/messages.js` |
| AI summary and moderation API | `src/routes/ai.js`, `src/services/` |
| Docker and Compose | `Dockerfile`, `docker-compose.yml` |
| CI and deploy workflows | `.github/workflows/test.yml`, `.github/workflows/deploy.yml` |
| Backend tests | `test/backend/*.test.js` |
| Solidity contract tests | `test/ForensisChat.t.sol` |

## Pending Milestones

| Area | Missing Implementation |
| --- | --- |
| Auth | Register, login, logout, refresh, JWT middleware |
| Authorization | Route-level user/conversation access checks |
| Chat Service | Message persistence and real-time send/deliver/seen flows |
| KYC | `/kyc/submit` API and review workflow |
| Blockchain backend | REST endpoints for commit, verify, dispute, forensics |
| AI | Future forensic analysis endpoints beyond summary/moderation |
| Frontend | React/Vite app is not present |
| API docs | Swagger/OpenAPI files are not present |

## Active Technical Constraints

| Constraint | Current Handling |
| --- | --- |
| Do not store message plaintext in `Message` | `Message` stores `encryptedContent`, `signature`, hashes, and metadata |
| Server-side search cannot search ciphertext | `MessageSearch` stores opt-in snippets with 24h TTL |
| Server-side AI cannot read ciphertext | `/ai/summarize` and `/ai/moderate` require explicit client-supplied plaintext and do not persist it |
| Secrets must not be committed | `.env` ignored; `.env.example` contains placeholders |
| MongoDB compatibility | Mongoose models use ObjectId references and indexes |
| Blockchain compatibility | Database has `MerkleCommit`; backend REST integration is missing |

## Known Issues

| Issue | Status |
| --- | --- |
| `forge fmt --check` reports formatting drift in Solidity files | Known; CI treats it as advisory |
| `AGENTS.md` may be untracked locally | Observed during documentation task; not modified |
| `lib/*` submodules may show local state changes after Foundry commands | Observed locally; not part of documentation changes |
| Some older docs under `doc/` and `docs/requirements/` are design/spec material, not implementation truth | Documented here to avoid confusion |

## Startup Procedure for Future AI Sessions

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/changelog.md`.
4. Read `docs/decisions.md`.
5. Read the specific docs file for the task area.
6. Read source code only where docs are insufficient.
