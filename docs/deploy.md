# Deployment Guide

The maintained deployment documentation is [`docs/deployment.md`](deployment.md).

Quick local start:

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173`; API health is available through both `http://localhost:5173/health` and `http://localhost:3000/health`. Other devices on the same network should open `http://<host-lan-ip>:5173`.

Before any non-local deployment, replace JWT defaults, configure Atlas/Gemini/Cloudinary as needed, and set an exact `CORS_ORIGIN` when the API is exposed directly. If the frontend nginx proxy serves the public entrypoint, `VITE_API_URL` can stay empty; set it only for a separate public API origin.
