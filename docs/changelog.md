# Changelog

## 2026-06-19

Added:

* React/Vite/Tailwind frontend with responsive auth, chat, profile/KYC, search, AI summary, and forensic verification views.
* IndexedDB device-key storage and browser RSA-OAEP/AES-GCM/ECDSA message and file envelopes.
* Canonical JWT-authenticated auth/user/chat/group/file/KYC routes and Socket.IO integration.
* Conversation-list API, feature API integration tests, frontend unit test, frontend Docker image, and frontend CI job.

Changed:

* Consolidated runtime startup under `src/index.js`; `src/backend/server.js` is now a compatibility launcher.
* Protected search and AI routes with JWT middleware.
* Changed KYC submissions to `PENDING` instead of trusting clients as automatically verified.
* Changed attachments to require an encrypted file envelope and encrypted blob.
* Expanded `Message` with chat status, file, reply, local-delete, timestamp, and idempotency fields.
* Added frontend service and authentication/file configuration to Docker Compose.

Fixed:

* Limited backend CI syntax checks to repository source files so vendored browser bundles in `node_modules` are not parsed as Node.js entry points.
* Resolved the PR #18/main merge while preserving the authenticated compatibility conversation-list endpoint from PR #17.
* Removed raw HTML rendering from frontend message-search highlights to prevent stored XSS through indexed snippets.
* Removed duplicated merge fragments that made feature backend files fail to parse.
* Prevented Socket.IO identity spoofing through `user_online` and added membership checks.
* Prevented unauthorized conversation history/file access and unsafe regex user search.
* Forced feature models to share the root Mongoose connection.

Removed:

* Not Found.

## 2026-06-06

Added:

* Week 3-4 AI usage documentation for Nguyen Ngoc Tuan in `docs/requirements/AI_usage.md`.

Changed:

* Not Found.

Fixed:

* Not Found.

Removed:

* Not Found.

## 2026-06-05

Added:

* Database/DevOps/AI testing documentation for Nguyễn Ngọc Tuân:
  * `doc/tuan-database-devops-ai-test-case.md`
* Week 4 deployment and integration-test deliverables:
  * `GET /health` production health endpoint with `{ status, uptime, timestamp }`.
  * MongoDB Memory Server integration tests for User, Conversation, Message, pagination, search, and MerkleCommit.
  * `test:integration` npm script.

Changed:

* Docker and Compose health checks now use `GET /health`; `GET /healthz` remains available.
* Replaced deprecated Mongoose `new` option with `returnDocument: "after"` in owned routes/tests.

Fixed:

* Fixed `Message` model pre-save middleware for Mongoose 9 so `contentHash` is generated during real MongoDB writes.

Removed:

* Not Found.

## 2026-06-04

Added:

* Week 3 AI deliverables:
  * `POST /ai/summarize` for Gemini-backed summaries of opt-in decrypted plaintext.
  * `POST /ai/moderate` for pre-encryption content moderation.
  * `AISummaryCache` MongoDB TTL cache for 1-hour summary reuse.
  * Gemini REST client, AI prompt helpers, moderation middleware factory, and backend tests.
* Documentation system entry files:
  * `docs/project_context.md`
  * `docs/architecture.md`
  * `docs/api.md`
  * `docs/deployment.md`
  * `docs/changelog.md`
  * `docs/decisions.md`
* Implementation-accurate documentation for current backend, database, API, deployment, and known gaps.

Changed:

* Mounted `/ai` routes in the root Express backend.
* Increased configurable JSON body limit via `JSON_BODY_LIMIT` for AI summary payloads.
* Updated API, database, architecture, deployment, and decision docs for AI integration.
* Updated `docs/database.md` to reflect current Mongoose schemas and indexes.
* Synchronized repository memory docs with updated `AGENTS.md` instructions:
  * future sessions read `docs/decisions.md` before source code
  * significant decisions include rationale, alternatives, and consequences

Fixed:

* Not Found.

Removed:

* Not Found.

## 2026-06-01

Added:

* Database and DevOps Week 1-2 deliverables were merged into `main`.
* Mongoose models for users, conversations, messages, temporary message search, Merkle commits, and KYC records.
* Backend tests for models, message query helpers, and message routes.
* Docker, Docker Compose, CI, and Render deploy trigger workflow.

Changed:

* Backend now has a Node.js package manifest and lockfile.

Fixed:

* GitHub Actions dependency install failure caused by missing root lockfile.

Removed:

* Not Found.
