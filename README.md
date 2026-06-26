# Secure Chat Forensics

Secure Chat Forensics is an educational full-stack messaging system that combines client-side encryption, MongoDB ciphertext persistence, opt-in Gemini summaries, and browser-generated Merkle evidence packages.

## Implemented Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TailwindCSS, Socket.IO Client, ethers.js, Web Crypto, IndexedDB |
| Backend | Node.js 24, Express, Socket.IO, JWT |
| Database | MongoDB, Mongoose |
| AI | Google Gemini REST API |
| Files | Client-encrypted blobs stored through Cloudinary in production or local private storage in Docker/dev |
| KYC documents | Authenticated Cloudinary storage in production; local private fallback for Docker/dev |
| Contracts | Solidity, Foundry, OpenZeppelin UUPS; retained for tests/reference, not required by the current frontend demo |
| DevOps | Docker, Docker Compose, GitHub Actions, Render backend trigger |

## Security Model

* Message/file plaintext is encrypted in the browser with AES-256-GCM.
* Per-conversation AES session keys rotate in the browser and are RSA-OAEP-SHA256 wrapped for conversation members.
* Encrypted envelopes are signed with ECDSA P-256.
* Browser private keys stay in IndexedDB; MongoDB stores public keys and ciphertext.
* KYC and Privacy modes persist ciphertext-only conversation history. Privacy mode also keeps per-recipient offline ciphertext in a TTL delivery mailbox until ACK/expiry.
* Search snippets and AI summary plaintext require explicit client actions; normal chat sends do not submit plaintext to the backend.

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

Registration sends a 6-digit OTP before creating the account. To send OTP email
through Gmail, set these values in `.env`:

```env
EMAIL_FROM_NAME=Secure Chat Forensics
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASSWORD=your_google_app_password
EMAIL_FROM=
```

Use a Google App Password for `EMAIL_PASSWORD`, not your normal Google account
password. Leave `EMAIL_FROM` empty unless you have a verified sender alias.

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

Copy `.env.example` to `.env` and configure JWT secrets. Gemini and Cloudinary are optional for core text chat. Encrypted attachments and KYC documents fall back to local private storage when Cloudinary credentials are empty.

## Optional Contracts

```bash
forge build
forge test
```

The current frontend forensic flow exports local evidence JSON and does not require a deployed contract address.

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
