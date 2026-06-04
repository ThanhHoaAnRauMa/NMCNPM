# Deployment

## Runtime Requirements

| Component | Version/Tool |
| --- | --- |
| Node.js | `>=24 <25` |
| Package manager | npm with `package-lock.json` |
| Database | MongoDB, local or Atlas |
| Container runtime | Docker |
| Smart contract toolchain | Foundry |

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
npm start
```

The server starts only after Mongoose connects to `MONGO_URI`.

## Local Docker Compose

```bash
docker compose up --build
```

Services:

| Service | Image/Build | Healthcheck |
| --- | --- | --- |
| `app` | Builds from `Dockerfile` | `GET /healthz` |
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
| Healthcheck | `GET /healthz` |

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
| Frontend deployment | Not Implemented; frontend app not in repository |
| Secret rotation procedure | Not Found |
| Monitoring/log aggregation | Not Found |
