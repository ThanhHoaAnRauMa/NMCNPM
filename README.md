# Secure Chat Forensics

Secure Chat Forensics is an educational full-stack messaging system that combines client-side encryption, MongoDB ciphertext persistence, Gemini-assisted moderation/summaries, and a Foundry/Sepolia Merkle verification contract.

## Implemented Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TailwindCSS, Socket.IO Client, ethers.js, Web Crypto, IndexedDB |
| Backend | Node.js 24, Express, Socket.IO, JWT |
| Database | MongoDB, Mongoose |
| AI | Google Gemini REST API |
| Files | Client-encrypted blobs stored through Cloudinary |
| Blockchain | Solidity, Foundry, OpenZeppelin UUPS, Sepolia |
| DevOps | Docker, Docker Compose, GitHub Actions, Render backend trigger |

## Security Model

* Message/file plaintext is encrypted in the browser with AES-256-GCM.
* AES keys are RSA-OAEP wrapped for conversation members.
* Encrypted envelopes are signed with ECDSA P-256.
* Browser private keys stay in IndexedDB; MongoDB stores public keys and ciphertext.
* KYC mode persists ciphertext. Privacy mode relays ciphertext without persistence.
* Search snippets and AI plaintext require explicit client actions; search snippets expire after 24 hours.

This is a portfolio/educational implementation, not an audited production messenger. See `docs/project_context.md` for current gaps.

## Quick Start

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

* Frontend: `http://localhost:5173`
* API health: `http://localhost:3000/health`

### Local Node.js

Node.js 24 and MongoDB are required.

```bash
npm ci
npm ci --prefix src/backend
npm install --prefix frontend
npm test
npm --prefix frontend run check
npm start
npm --prefix frontend run dev
```

Copy `.env.example` to `.env` and configure JWT secrets. Gemini and Cloudinary are optional for core text chat but required for AI and encrypted attachments.

## Contracts

```bash
forge build
forge test
```

Deployment script:

```bash
forge script script/DeployForensisChat.s.sol:DeployForensisChat \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Never expose `PRIVATE_KEY` through a `VITE_*` variable.

## Documentation

| Document | Purpose |
| --- | --- |
| `docs/project_context.md` | Concise current state and blockers |
| `docs/architecture.md` | Runtime/security architecture |
| `docs/database.md` | Collections and indexes |
| `docs/api.md` | HTTP contracts |
| `docs/websocket-events.md` | Socket.IO contracts |
| `docs/deployment.md` | Environment, containers, CI/deployment |
| `docs/decisions.md` | Engineering decisions and tradeoffs |
| `docs/changelog.md` | Completed changes |
