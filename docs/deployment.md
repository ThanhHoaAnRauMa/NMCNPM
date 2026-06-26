# Deployment

## Requirements

| Component | Requirement |
| --- | --- |
| Node.js | `>=24 <25` |
| Database | MongoDB 8 local or MongoDB Atlas |
| Containers | Docker + Compose |
| Contracts | Foundry for build/test/reference contract work |
| External services | Gmail SMTP for registration OTP; Gemini for AI; Cloudinary for production encrypted attachments and authenticated KYC document images |

## Local Development

```bash
npm ci
npm ci --prefix src/backend
npm ci --prefix frontend
npm test
npm --prefix frontend run check
npm start
npm --prefix frontend run dev
```

The API listens on `3000`; Vite listens on `5173`. The feature package is installed separately because its CommonJS routes retain their own dependencies. All models still share the root Mongoose connection.

## Docker Compose

```bash
docker compose up --build
```

| Service | Port | Health |
| --- | --- | --- |
| `frontend` | `${FRONTEND_PORT:-5173}` -> Nginx 80 | `/health` |
| `app` | `${PORT:-3000}` | `/health` |
| `mongo` | `${MONGO_PORT:-27017}` | Mongo ping |

The frontend image is a Vite build served by Nginx. `VITE_*` values are build-time values; changing them requires rebuilding the image.

By default the Docker frontend uses the same origin that served the page for API and Socket.IO traffic. Nginx proxies `/auth`, `/users`, `/chat`, `/groups`, `/files`, `/kyc`, `/messages`, `/ai`, `/health`, `/healthz`, and `/socket.io` to the backend container. This means the same image works from `http://localhost:5173`, a LAN address such as `http://192.168.1.10:5173`, or a public domain that forwards to the frontend port. Set `VITE_API_URL` only when the API is intentionally hosted on a different public origin.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Yes outside Compose | MongoDB connection |
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | Production | API runtime and allowed frontend origin |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Yes | Use different random secrets, at least 32 chars |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | No | Defaults `15m`, `7d` |
| `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM_NAME`, `EMAIL_FROM` | For registration | Gmail sender account, Google App Password, display name, and optional verified sender alias |
| `REGISTRATION_OTP_EXPIRES_MINUTES`, `REGISTRATION_OTP_MAX_ATTEMPTS` | No | Defaults `10`, `5` |
| `PRIVACY_DELIVERY_TTL_HOURS` | No | Hours to retain undelivered Privacy-mode ciphertext, default `24` |
| `KYC_REVIEWER_EMAILS` | For KYC review | Comma-separated reviewer account emails; keep empty to deny all reviewers |
| `GEMINI_API_KEY` | For AI | Google AI Studio / Gemini API key used only by the backend; required for `/ai/summarize` |
| `GEMINI_MODEL`, `GEMINI_*_TIMEOUT_MS`, `GEMINI_RETRIES`, `AI_MAX_*` | No | AI model, limits, retry count, and timeouts; moderation defaults to 5 seconds and is capped at 10 seconds |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Production files | Encrypted attachment blob storage; when present, also stores KYC documents |
| `KYC_LOCAL_STORAGE_DIR`, `KYC_DOCUMENT_TOKEN_EXPIRES_IN` | No | Local/dev fallback directory for KYC documents and signed document-link lifetime; Compose persists it in `kyc-documents` |
| `FILE_LOCAL_STORAGE_DIR`, `FILE_TOKEN_EXPIRES_IN` | No | Local/dev fallback directory for encrypted attachments and signed blob-link lifetime; Compose persists it in `encrypted-files` |
| `MAX_FILE_SIZE_MB` | No | Default 10 MB |
| `VITE_API_URL` | Frontend build | Optional public API/Socket.IO URL; leave empty in Compose to use same-origin nginx proxy |

## Images

Backend `Dockerfile` installs root production dependencies and `src/backend` production dependencies, then runs the canonical `src/index.js` as the unprivileged `node` user.

Frontend `frontend/Dockerfile` builds static assets with Node 24 and serves them from `nginx:1.27-alpine` with SPA fallback.
Both frontend CI and the image build install the committed lockfile with `npm ci`.

## CI

The backend syntax step checks `src/backend/server.js` and JavaScript under `src/backend/src/`. Installed dependencies are excluded because browser-targeted bundles are not valid standalone Node.js entry points and are already validated by their package publishers.

`.github/workflows/test.yml` runs three jobs:

| Job | Required Checks |
| --- | --- |
| Backend | Root/nested installs, syntax checks, Node tests, Compose config, backend image build |
| Frontend | Install, Vitest, Vite production build, frontend image build |
| Contracts | Foundry build and tests; formatting remains advisory |

## Production

| Component | URL | Platform | Status |
| --- | --- | --- | --- |
| API and Socket.IO | `https://secure-chat-forensics-api.onrender.com` | Render web service | Deployed from `main` |
| React application | `https://secure-chat-forensics-web.onrender.com` | Render static site | Deployed from `main` |
| Database | MongoDB Atlas | Atlas | Connected; credentials are external secrets |
| Forensic contract | Foundry source in repo | Optional/reference | Not required by current frontend forensic UI |

The deploy workflow conditionally triggers the Render backend after successful CI on `main` using `RENDER_API_KEY` and `RENDER_SERVICE_ID`. Render also watches `main` for automatic deploys. The frontend is built with `VITE_API_URL` set to the production API, and the API allows the production frontend through `CORS_ORIGIN`.

Gemini and Cloudinary are configured on the production backend and have authenticated production smoke coverage. Locally, set `GEMINI_API_KEY` in `.env`, then run `docker compose up --build -d`; `GET /ai/status` should report `"configured": true`. The current frontend forensic flow generates local evidence packages with conversation Room IDs and does not require a public contract address. A production KYC reviewer is allowlisted, and the GitHub `RENDER_API_KEY`/`RENDER_SERVICE_ID` secrets have been validated through a successful manual deploy workflow.

## Operational Gaps

* No Atlas provisioning/migration automation.
* No secret rotation, metrics, tracing, or central log sink.
* Render services are provisioned manually; infrastructure-as-code is not implemented.
