# Deployment Guide

## Local Docker

Copy `.env.example` to `.env` and adjust local values. Start the backend and
MongoDB:

```bash
docker compose up --build
```

The backend is available on `http://localhost:3000`. Verify it with:

```bash
curl http://localhost:3000/healthz
```

Compose waits for MongoDB health before starting the backend and persists data
in the `mongo-data` volume.

## Local Node.js

Node.js 24 LTS is the supported runtime.

```bash
npm ci
npm test
npm start
```

For a local Node.js process, set `MONGO_URI=mongodb://localhost:27017/securechat`.

## Render

Create a Render web service from this repository with Docker deployment. Set:

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB Atlas TLS connection string |
| `NODE_ENV` | Yes | Use `production` |
| `CORS_ORIGIN` | Yes | Deployed frontend origin |
| `SALT_ROUNDS` | No | Defaults to `12` |

The container exposes port `3000` and provides `GET /healthz`.

## GitHub Actions

`CI` runs backend tests, Compose validation, Docker image build, Foundry build,
and Foundry tests. Existing Solidity formatting drift is reported as advisory
until the Blockchain owner formats contract files.

After a successful `CI` run on `main`, `Deploy Backend` triggers Render when
these repository secrets exist:

| Secret | Purpose |
| --- | --- |
| `RENDER_API_KEY` | Render API authorization |
| `RENDER_SERVICE_ID` | Target backend service |

Frontend deployment is intentionally excluded because this repository does not
currently contain the Vite frontend.
