# Deployment

## Runtime Requirements

| Component | Version/Tool |
| --- | --- |
| Node.js | `>=24 <25` |
| Package manager | npm with `package-lock.json` |
| Database | MongoDB, local or Atlas |
| Container runtime | Docker |
| Smart contract toolchain | Foundry |
| Integration test database | `mongodb-memory-server` |

## Environment Variables

Defined in `.env.example`:

| Variable | Required | Used By | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | Backend | Defaults to `development` |
| `PORT` | No | Backend/Docker | Defaults to `3000` |
| `MONGO_URI` | Yes outside Compose | Backend | Defaults locally to `mongodb://localhost:27017/securechat` |
| `MONGO_DATABASE` | No | Docker Compose | Defaults to `securechat` |
| `MONGO_PORT` | No | Docker Compose | Defaults to `27017` |
| `CORS_ORIGIN` | No | Backend | Defaults to `*` in code/Compose |
| `SALT_ROUNDS` | No | User model | Defaults to `12` |
| `JSON_BODY_LIMIT` | No | Backend | Defaults to `128kb`; needed for AI summary payloads |
| `GEMINI_API_KEY` | Yes for AI | AI routes | Google Gemini API key; never commit real value |
| `GEMINI_MODEL` | No | AI routes | Defaults to `gemini-2.5-flash` |
| `GEMINI_TIMEOUT_MS` | No | AI summary | Defaults to `10000` |
| `GEMINI_MODERATION_TIMEOUT_MS` | No | AI moderation | Capped at `2000` by code |
| `AI_MAX_SUMMARY_MESSAGES` | No | AI summary | Defaults to `100` |
| `AI_MAX_MESSAGE_CHARS` | No | AI summary/moderation | Defaults to `4000` |
| `AI_MAX_TOTAL_CHARS` | No | AI summary | Defaults to `20000` |
| `SEPOLIA_RPC_URL` | Yes for contract deploy | Foundry script | Placeholder in `.env.example` |
| `PRIVATE_KEY` | Yes for contract deploy | Foundry script | Placeholder only; never commit real value |
| `ETHERSCAN_API_KEY` | No/Yes for verification | Foundry script command | Placeholder only |

Render workflow secrets:

| Secret | Required | Notes |
| --- | --- | --- |
| `RENDER_API_KEY` | Yes to deploy | If missing, deploy job skips |
| `RENDER_SERVICE_ID` | Yes to deploy | If missing, deploy job skips |

## Local Node.js

```bash
npm ci
npm test
npm run test:integration
npm start
```

`npm test` runs unit and integration tests. `npm run test:integration` runs only the MongoDB Memory Server integration suite. The server starts only after Mongoose connects to `MONGO_URI`.

## Local Docker Compose

```bash
docker compose up --build
```

Services:

| Service | Image/Build | Healthcheck |
| --- | --- | --- |
| `app` | Builds from `Dockerfile` | `GET /health` |
| `mongo` | `mongo:8.0` | `db.adminCommand('ping')` |

Compose stores MongoDB data in the `mongo-data` volume.

## Docker Image

`Dockerfile`:

| Property | Value |
| --- | --- |
| Base image | `node:24-alpine` |
| Dependency install | `npm ci --omit=dev` |
| Runtime user | `node` |
| Exposed port | `3000` |
| Healthcheck | `GET /health` |

Only `package*.json` and `src/` are copied into the image.

## GitHub Actions

### CI

File: `.github/workflows/test.yml`

Triggers:

| Trigger | Status |
| --- | --- |
| `push` | Enabled |
| `pull_request` | Enabled |
| `workflow_dispatch` | Enabled |

Jobs:

| Job | Steps |
| --- | --- |
| Backend database and API | checkout, setup Node 24, `npm ci`, `npm test`, `docker compose config`, `docker build .` |
| Foundry contracts | checkout submodules, install Foundry, `forge fmt --check` advisory, `forge build --sizes`, `forge test -vvv` |

Backend tests include MongoDB Memory Server integration coverage for User, Conversation, Message, cursor pagination, message search, and MerkleCommit persistence.

### Deploy Backend

File: `.github/workflows/deploy.yml`

Triggers:

| Trigger | Behavior |
| --- | --- |
| Successful `CI` workflow on `main` | Attempts Render deploy |
| Manual dispatch | Attempts Render deploy |

If Render secrets are missing, the deploy step exits successfully without deploying.

## Production Status

| Area | Status |
| --- | --- |
| Render service definition | Not Found |
| Atlas provisioning script | Not Found |
| Frontend deployment | Blocked; frontend app and Vercel config are not in this repository |
| Secret rotation procedure | Not Found |
| Monitoring/log aggregation | Not Found |

AI routes require `GEMINI_API_KEY` in Render before `/ai/summarize` or `/ai/moderate` can call Gemini. If moderation cannot reach Gemini within 2 seconds, the backend allows the message and returns `is_moderated: false`.
