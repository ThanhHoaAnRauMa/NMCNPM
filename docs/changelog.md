# Changelog

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
