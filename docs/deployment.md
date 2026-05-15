# YAI-Excel — Deployment

This guide walks through the supported deployment paths, from local dev to a single-server production install.

---

## 1. Local development

Use this for iterating on the engine or the UI.

### Prerequisites

- Python **3.11+**
- Node.js **20+**
- (Optional) `tesseract-ocr` and `poppler-utils` on your PATH for OCR / PDF fallbacks

### Steps

```bash
git clone https://github.com/gaganchauhan1997/YAI-Excel.git
cd YAI-Excel
cp .env.example .env

# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## 2. Docker Compose (recommended)

This is the supported path for **single-server production**.

```bash
git clone https://github.com/gaganchauhan1997/YAI-Excel.git
cd YAI-Excel
cp .env.example .env             # fill in at least GEMINI_API_KEY
docker compose up --build -d
docker compose logs -f
```

Stop with `docker compose down`. Volumes:

- `./uploads` — incoming files (per-session subdirs)
- `./outputs` — generated `.xlsx` files

### TLS / public domain

Put NGINX or Caddy in front. Minimal Caddyfile:

```caddyfile
yai.example.com {
    reverse_proxy /api/* localhost:8000
    reverse_proxy /files/* localhost:8000
    reverse_proxy /* localhost:3000
}
```

Then in your `.env`:

```env
ALLOWED_ORIGINS=https://yai.example.com
NEXT_PUBLIC_API_URL=https://yai.example.com
```

---

## 3. Hosted PaaS

### Cloudflare Pages (frontend) — **recommended**

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=https://your-api.example.com npm run build
wrangler pages deploy out --project-name=yai-excel --branch=main
```

Or connect the repo via Cloudflare dashboard → **Workers & Pages → Create application → Pages → Connect to Git**. Pick `Next.js (Static HTML Export)`, build command `cd frontend && npm install && npm run build`, output `frontend/out`.

For the `yexcel.hackknow.com` specifically, follow [`deploy-yexcel.md`](deploy-yexcel.md) — it's the supported path.

### Fly.io (backend)

```bash
cd backend
fly launch --image-label python --dockerfile Dockerfile
fly secrets set GEMINI_API_KEY=...
fly deploy
```

### Render

- New **Web Service** from this repo
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set `GEMINI_API_KEY` and any other keys in the dashboard.

---

## 4. Environment variables

| Var | Required | Default | Description |
|-----|:--------:|---------|-------------|
| `GEMINI_API_KEY` | one-of | — | Vision-capable, free tier (recommended) |
| `GROQ_API_KEY`   | one-of | — | Fast text fallback |
| `OPENAI_API_KEY` | optional | — | GPT-4o-mini fallback |
| `ANTHROPIC_API_KEY` | optional | — | Claude Sonnet fallback |
| `VISION_MODEL` | ❌ | `gemini-2.5-flash` | Override vision model |
| `MAX_FILE_SIZE_MB` | ❌ | `500` | Upload cap |
| `MAX_VIDEO_DURATION_SEC` | ❌ | `300` | Video cap |
| `ALLOWED_ORIGINS` | ❌ | `http://localhost:3000` | CORS allow-list (comma-sep) |
| `STORAGE_PATH` | ❌ | `./uploads` | Upload directory |
| `OUTPUT_PATH` | ❌ | `./outputs` | Generated file directory |
| `LOG_LEVEL` | ❌ | `INFO` | `DEBUG / INFO / WARNING / ERROR` |
| `API_PORT` | ❌ | `8000` | Backend port |
| `FRONTEND_PORT` | ❌ | `3000` | Frontend port |
| `NEXT_PUBLIC_API_URL` | ❌ | `http://localhost:8000` | Where the browser calls the API |

At minimum, supply **one** AI provider key. Gemini is recommended (vision + free tier).

---

## 5. Sizing

| Workload | RAM | CPU | Disk |
|----------|----:|----:|-----:|
| Solo dev | 1 GB | 1 vCPU | 5 GB |
| Small team (≤ 10 builds/hr) | 2 GB | 2 vCPU | 20 GB |
| Heavy (videos, parallel builds) | 4 GB | 4 vCPU | 50 GB |

Video processing is the heaviest path — keep `MAX_VIDEO_DURATION_SEC` modest unless you need otherwise.

---

## 6. Backups

The only stateful directories are `uploads/` and `outputs/`. Either:

- Mount them on a persistent volume (Docker / Fly / Render) **or**
- Sync them to S3 / R2 on a cron (every output is also retrievable from the audit JSON, so this is optional).

---

## 7. Observability

- Health: `GET /healthz` → `{ "status": "ok" }`
- Structured logs via Loguru — pipe stdout to your preferred sink
- API metrics: add `prometheus-fastapi-instrumentator` if you want Prometheus scrape

---

## 8. Upgrade path

```bash
git pull
docker compose build
docker compose up -d
```

YAI-Excel keeps schema-compatibility for the master audit JSON across minor versions.
