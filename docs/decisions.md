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
