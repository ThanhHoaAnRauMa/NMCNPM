# Deployment

## Requirements

| Component | Requirement |
| --- | --- |
| Node.js | `>=24 <25` |
| Database | MongoDB 8 local or MongoDB Atlas |
| Containers | Docker + Compose |
| Contracts | Foundry for build/test/reference contract work |
| External services | Gemini for AI; Cloudinary for encrypted attachments and authenticated KYC document images |

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

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Yes outside Compose | MongoDB connection |
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | Production | API runtime and allowed frontend origin |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Yes | Use different random secrets, at least 32 chars |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | No | Defaults `15m`, `7d` |
| `KYC_REVIEWER_EMAILS` | For KYC review | Comma-separated reviewer account emails; keep empty to deny all reviewers |
| `GEMINI_API_KEY` | For AI | Gemini API key |
| `GEMINI_MODEL`, `GEMINI_*_TIMEOUT_MS`, `AI_MAX_*` | No | AI model, limits, and timeouts; moderation defaults to 5 seconds and is capped at 10 seconds |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | For files | Encrypted blob storage |
| `MAX_FILE_SIZE_MB` | No | Default 10 MB |
| `VITE_API_URL` | Frontend build | Public API/Socket.IO URL |

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

Gemini and Cloudinary are configured on the production backend and have authenticated production smoke coverage. The current frontend forensic flow generates local evidence packages with conversation Room IDs and does not require a public contract address. A production KYC reviewer is allowlisted, and the GitHub `RENDER_API_KEY`/`RENDER_SERVICE_ID` secrets have been validated through a successful manual deploy workflow.

## Operational Gaps

* No Atlas provisioning/migration automation.
* No secret rotation, metrics, tracing, or central log sink.
* Render services are provisioned manually; infrastructure-as-code is not implemented.
