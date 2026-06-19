# Deployment Guide

The maintained deployment documentation is [`docs/deployment.md`](deployment.md).

Quick local start:

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173`; API health is `http://localhost:3000/health`.

Before any non-local deployment, replace JWT defaults, configure Atlas/Gemini/Cloudinary as needed, set an exact `CORS_ORIGIN`, and build the frontend with the public `VITE_API_URL`.
