# Changelog

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
