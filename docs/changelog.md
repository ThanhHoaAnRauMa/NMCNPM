# Changelog

## 2026-06-23

Added:

* KYC verified account badge in profile, user search, direct conversation titles, chat headers, message sender labels, and local message-search results.
* Submitter email, username, display name, and current KYC status in the reviewer queue cards.

Changed:

* Message and file history sender payloads now include `kycStatus` so clients can render verified-account indicators consistently.
* KYC reviewer authorization now uses `KYC_REVIEWER_EMAILS` instead of MongoDB user ids.

Fixed:

* Used persisted MongoDB ObjectId ordering before timestamp fallback so KYC chat history renders consistently across participants.
* Kept the AI summary button clickable in Privacy mode and showed an explicit local-policy explanation instead of a disabled control.
* Kept chat message order stable with an id tie-breaker and server-confirmed Privacy timestamps.
* Updated the active conversation preview immediately from received/sent messages so the sidebar no longer stays at "Chưa có tin nhắn" while the message is visible in the chat.
* Refreshed member conversation lists after persisted message/file sends by emitting `conversation_updated` to each member's user room, including members who have not opened the new group room yet.
* Preserved hydrated chat messages in browser memory when switching conversations or leaving and returning from the profile/forensics tabs.
* Allowed login when a username contains `@` or is entered as `@username` by resolving both username and email candidates before password verification.
* Increased the frontend authentication timeout to 60 seconds so a Render cold start cannot leave login appearing permanently pending.
* Kept the KYC submit button clickable when the device key is not ready so users receive actionable create/restore/sync guidance instead of a silent disabled cursor.
* Added an inline KYC submission status message and state-specific submit button text after users send a KYC profile.

## 2026-06-22

Added:

* Document-backed manual KYC with basic CCCD fields, front/back authenticated image upload, signed image-integrity proof, and reviewer UI.
* Realtime `conversation_created` notifications for invited direct and group members, with reconnect list recovery.
* Required password confirmation in the registration UI and API.
* Render production API and static frontend deployment records.
* Production Cloudinary configuration for encrypted attachment storage.
* Sepolia deployment of the `ForensisChat` implementation and ERC1967 proxy, with committed Foundry broadcast records.
* Production KYC reviewer allowlist and GitHub-to-Render deployment secrets.
* Local/server device-key state detection and verified sender public-key snapshots for new messages.
* Local full-history conversation search with sender, timestamp, substring highlighting, result counts, and jump-to-message navigation.
* Login by either exact username or normalized email while retaining the legacy email request contract.

Changed:

* KYC-mode direct/group membership now requires every participant to be `VERIFIED`; registration and Privacy mode remain available without KYC.
* Increased Gemini moderation timeout from 2 seconds to a production-tolerant 5-second default with a 10-second configuration cap.
* Updated deployment and project context documentation to reflect the live Render, Atlas, and Gemini configuration.
* Configured the production frontend to use the deployed Sepolia proxy address.
* Validated the GitHub Render deploy workflow and authenticated KYC review queue against production.
* Replaced the frontend's opt-in TTL-snippet search dependency with browser-side decryption and case-insensitive substring matching; the existing search API remains compatible.

Fixed:

* Made username login case-insensitive and password-aware for legacy case-colliding accounts, blocked new case-only username duplicates, and bounded frontend authentication requests with a timeout.
* Prevented healthy Gemini requests from unnecessarily entering the allow-on-provider-failure fallback under normal production network latency.
* Deferred Cloudinary SDK configuration until request time so runtime environment variables are available before upload or deletion.
* Replaced serif heading fallbacks with a cross-platform sans-serif stack that renders Vietnamese diacritics consistently.
* Ensured a direct-conversation creator receives the first persisted message even when sending before the asynchronous room join completes.
* Blocked stale device identities from storing or relaying messages/files with invalid signatures, with explicit restore and synchronization recovery actions.
* Prevented Gemini thinking tokens and database-ID-heavy prompts from producing truncated, low-value conversation summaries; partial responses are no longer cached.
* Allowed the same user pair to maintain separate KYC and Privacy direct conversations while reusing an existing conversation of the selected mode.
* Stabilized the parallel backend test suite by allowing MongoDB Memory Server sufficient startup time and guarding failed-start cleanup.

Removed:

* Not Found.

## 2026-06-21

Added:

* Allowlisted KYC review queue and approve/reject API with reviewer audit metadata and rejected-proof resubmission.
* Password-encrypted device-key backup and same-account restore using PBKDF2-SHA-256 and AES-256-GCM.
* Browser-owned evidence package generation, Merkle proofs, signature checks, and wallet-driven contract room/root actions.
* Backend integration and frontend unit tests for the new security and forensic flows.
* Committed frontend dependency lockfile.

Changed:

* Aligned the canonical and feature KYC schemas on field names, uppercase statuses, queue index, and audit fields.
* Updated architecture, API, database, deployment, decisions, and project context documentation.
* Switched frontend CI and container builds to reproducible `npm ci` installs and enabled lockfile-aware CI caching.

Fixed:

* Replaced the permanently pending KYC state with a least-privilege manual decision path.
* Added a recovery path for locally stored device keys without introducing backend private-key custody.
* Ensured evidence export includes persisted records previously hidden only from the sender's normal chat view.
* Updated root and nested backend lockfiles to patched `multer`, `engine.io`, `socket.io-adapter`, and `ws` releases, clearing production audit findings.

Removed:

* Not Found.

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
