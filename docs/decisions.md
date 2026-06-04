# Decisions

This file records decisions that can be inferred from the current implementation. No prior ADR directory was found.

## 2026-06-04 Documentation System

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Repository had scattered design documents and implementation docs, but no consistent documentation entry point. |
| Decision | Maintain `docs/project_context.md`, `docs/architecture.md`, `docs/database.md`, `docs/api.md`, `docs/deployment.md`, `docs/changelog.md`, and `docs/decisions.md`. |
| Consequences | Future work must update docs and changelog when implementation changes. |

## Ciphertext-Only Message Storage

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Secure chat must avoid server-side plaintext storage for primary message records. |
| Decision | `Message` stores `encryptedContent`, `signature`, hashes, and metadata, not plaintext content. |
| Consequences | Backend cannot perform full-text search on `Message.encryptedContent`. |

## Temporary Search Snippet Collection

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | MongoDB text search cannot operate on E2E ciphertext. |
| Decision | Use `MessageSearch` for opt-in plaintext snippets with a 24-hour TTL and text index. |
| Consequences | Search can work only for snippets explicitly uploaded by clients. Authorization is still required before production use. |

## Node.js 24 Runtime

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Backend package and CI target a modern maintained Node runtime. |
| Decision | Use Node.js `>=24 <25`, `node:24-alpine`, and GitHub Actions Node 24. |
| Consequences | Developers need Node 24 locally or Docker. |

## CI Split Between Backend and Contracts

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Repository contains both Node backend and Foundry Solidity code. |
| Decision | CI runs backend checks and contract checks as separate jobs. |
| Consequences | Contract formatting drift is advisory, but contract build/tests remain required. |

## Render Deploy Trigger

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Deployment target documented for backend is Render. |
| Decision | Trigger Render deploy after successful CI on `main` when secrets exist. |
| Consequences | Missing `RENDER_API_KEY` or `RENDER_SERVICE_ID` causes deploy job to skip rather than fail. |
