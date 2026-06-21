# Decisions

This file records decisions that can be inferred from the current implementation. No prior ADR directory was found.

## 2026-06-04 Documentation System

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Repository had scattered design documents and implementation docs, but no consistent documentation entry point. |
| Rationale | A small fixed set of docs gives future AI sessions enough context without reading the whole repository. |
| Alternatives Considered | Keep scattered docs only; generate docs from code only. Both were rejected because they leave project memory incomplete. |
| Decision | Maintain `docs/project_context.md`, `docs/architecture.md`, `docs/database.md`, `docs/api.md`, `docs/deployment.md`, `docs/changelog.md`, and `docs/decisions.md`. |
| Consequences | Future work must update docs and changelog when implementation changes. |

## Repository Memory Startup Order

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | `AGENTS.md` defines documentation as long-term repository memory. |
| Rationale | Reading memory docs first reduces repeated repository-wide exploration and lowers the risk of inventing behavior. |
| Alternatives Considered | Read source first every session; read all repository files every session. Both waste context and can obscure the current implementation state. |
| Decision | Future sessions start with `AGENTS.md`, `docs/project_context.md`, `docs/changelog.md`, and `docs/decisions.md`, then read task-relevant docs/source. |
| Consequences | These docs must stay synchronized after each task. |

## Ciphertext-Only Message Storage

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Secure chat must avoid server-side plaintext storage for primary message records. |
| Rationale | Primary message persistence should preserve E2E privacy assumptions. |
| Alternatives Considered | Store plaintext for convenience; store decrypted search copies in `Message`. Both conflict with the privacy model. |
| Decision | `Message` stores `encryptedContent`, `signature`, hashes, and metadata, not plaintext content. |
| Consequences | Backend cannot perform full-text search on `Message.encryptedContent`. |

## Temporary Search Snippet Collection

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | MongoDB text search cannot operate on E2E ciphertext. |
| Rationale | A separate TTL collection limits retention while enabling a narrow search feature. |
| Alternatives Considered | Search ciphertext directly; store full plaintext history. Ciphertext search is not supported by MongoDB text indexes, and full plaintext history violates the privacy constraint. |
| Decision | Use `MessageSearch` for opt-in plaintext snippets with a 24-hour TTL and text index. |
| Consequences | Search can work only for snippets explicitly uploaded by clients. Authorization is still required before production use. |

## Opt-In Plaintext AI Processing

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | The primary `Message` collection stores ciphertext only, so the backend cannot summarize or moderate message content by reading MongoDB records. |
| Rationale | AI features need plaintext, but persisting plaintext would weaken the E2E privacy model. |
| Alternatives Considered | Backend decrypts messages; summarize `MessageSearch` snippets only; store plaintext history. Backend decryption is not possible without client keys, snippets are incomplete, and plaintext history conflicts with privacy requirements. |
| Decision | AI routes accept explicit client-supplied plaintext after local decrypt/before encrypt, call Gemini from the backend, and do not persist source plaintext. |
| Consequences | `/ai/summarize` verifies message ids against MongoDB metadata, caches only summary output for 1 hour, and requires frontend/user opt-in for plaintext disclosure. |

## Node.js 24 Runtime

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Backend package and CI target a modern maintained Node runtime. |
| Rationale | Aligning local, Docker, and CI runtimes reduces environment drift. |
| Alternatives Considered | Keep Node 18; leave runtime unspecified. Node 18 is not the current target in this repository and unspecified runtime caused CI/Docker ambiguity. |
| Decision | Use Node.js `>=24 <25`, `node:24-alpine`, and GitHub Actions Node 24. |
| Consequences | Developers need Node 24 locally or Docker. |

## CI Split Between Backend and Contracts

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Repository contains both Node backend and Foundry Solidity code. |
| Rationale | Separate jobs make failures easier to attribute to backend or contract work. |
| Alternatives Considered | Single combined job; backend-only CI. A combined job is harder to diagnose, and backend-only CI would miss contract regressions. |
| Decision | CI runs backend checks and contract checks as separate jobs. |
| Consequences | Contract formatting drift is advisory, but contract build/tests remain required. |

## Render Deploy Trigger

| Field | Decision |
| --- | --- |
| Status | Implemented |
| Context | Deployment target documented for backend is Render. |
| Rationale | Render deploy should happen only after CI passes and should not fail when secrets are absent in educational forks. |
| Alternatives Considered | Deploy on every push regardless of CI; fail when Render secrets are absent. Both are too fragile for this repository. |
| Decision | Trigger Render deploy after successful CI on `main` when secrets exist. |
| Consequences | Missing `RENDER_API_KEY` or `RENDER_SERVICE_ID` causes deploy job to skip rather than fail. |

## 2026-06-19 Canonical Backend Runtime

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Root ESM routes and feature CommonJS routes previously started as separate servers; the feature server also contained merge corruption. |
| Rationale | One HTTP server, Socket.IO instance, MongoDB connection, port, and health endpoint prevents divergent behavior and disconnected model buffers. |
| Alternatives Considered | Run two APIs on different ports; convert all feature code to ESM immediately. Two APIs complicate frontend/deployment, while a full conversion is an unrelated rewrite. |
| Decision | `src/index.js` mounts all routes and sockets; `src/backend/server.js` only launches it. Feature models resolve root Mongoose through a bridge. |
| Consequences | Root and nested dependencies must both be installed; parallel schema files remain technical debt. |

## Browser-Owned Message Encryption

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Backend message storage must remain ciphertext-only, but users need direct/group chat and files. |
| Rationale | AES-GCM is efficient for content, RSA-OAEP can wrap one AES key per member, and ECDSA authenticates the serialized envelope. |
| Alternatives Considered | Server encryption; plaintext storage; reuse the Node-only crypto package in Vite. These expose plaintext or are not browser-compatible. |
| Decision | Generate device keys with Web Crypto, store private JWKs in IndexedDB, publish only a versioned public bundle, and encrypt/sign before REST or Socket.IO transport. |
| Consequences | Clearing browser data loses local decryption ability; key backup/rotation and multi-device transfer are not implemented. |

## KYC Submission Is Pending

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Existing code marked arbitrary client-supplied hashes as `VERIFIED`. |
| Rationale | A client cannot authoritatively verify its own identity. |
| Alternatives Considered | Preserve automatic verification for demo convenience. Rejected because it misrepresents trust and weakens security. |
| Decision | `/kyc/submit` creates `PENDING`; only a future reviewer/provider integration may set `VERIFIED`. |
| Consequences | No user can become newly verified until another owner implements the review workflow. |

## Frontend Deployment Target Deferred

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Frontend source/image now exists, but no approved Vercel/Render static-site project is configured. |
| Rationale | Repository rules forbid inventing or changing deployment targets without approval. |
| Alternatives Considered | Add an unconfigured Vercel action. Rejected because it creates a misleading deployment claim. |
| Decision | CI builds/tests the frontend and image; production frontend deployment remains explicitly unconfigured. |
| Consequences | A project owner must select hosting and add secrets/project identifiers. |

## Allowlisted Manual KYC Review

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | KYC submissions need an authority, but the repository has no trusted role bootstrap or external identity provider. |
| Rationale | A deployment-controlled ObjectId allowlist adds least-privilege review without allowing clients to assign themselves an admin role. |
| Alternatives Considered | Add a client-writable role field; auto-verify signed hashes. Both allow privilege or trust escalation. |
| Decision | Protect queue/decision routes with `KYC_REVIEWER_USER_IDS`, prohibit self-review, retain audit metadata, and allow replacement after rejection. |
| Consequences | Operators must configure reviewer IDs, and reviewers still need an out-of-band document validation process. |

## Password-Encrypted Device-Key Backup

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | IndexedDB loss made persisted ciphertext permanently unreadable on a replacement device. |
| Rationale | Client-side PBKDF2-SHA-256 and AES-256-GCM recovery preserves server blindness while enabling manual transfer. |
| Alternatives Considered | Upload raw keys; server-managed recovery. Both give the backend custody of decryption keys. |
| Decision | Export a versioned encrypted JSON backup bound to the account user ID and restore it locally before republishing only its public bundle. |
| Consequences | Users must protect both backup and password; there is no forgotten-password recovery for the key file. |

## Browser-Owned Evidence and Root Transactions

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Context | Evidence export needs plaintext and root commits need an EVM signer, neither of which the backend safely owns. |
| Rationale | Local package generation preserves E2EE, while explicit participant-wallet transactions avoid a custodial server key. |
| Alternatives Considered | Backend decryption; unattended backend signer. These expose plaintext or create a high-impact custody secret. |
| Decision | Build and verify evidence/Merkle proofs in the browser and use ethers for room, propose, dispute, confirm, and verification calls. |
| Consequences | Root commits are user-triggered rather than periodic, and contract participant wallets must be entered by users. |
