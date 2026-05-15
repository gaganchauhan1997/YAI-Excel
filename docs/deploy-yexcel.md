# Deploy YAI-Excel to `yexcel.hackknow.com`

End-to-end deploy on **Cloudflare Pages + Fly.io + Cloudflare DNS**. From `git clone` → live URL in **under 10 minutes**, ₹0/mo.

```
yexcel.hackknow.com         → Cloudflare Pages   (static Next.js export)
api.yexcel.hackknow.com     → Fly.io (Mumbai)    (FastAPI + Excel engine)
hackknow.com nameservers    → Cloudflare DNS     (you already manage it here)
```

> **Why this split?** Cloudflare Pages free-tier caps each request at 100MB and CPU at 30s — enough for the static frontend but tight for video uploads. Putting the API on its own subdomain lets it bypass the edge entirely, lifts the file-size cap to Fly's defaults, and gives the frontend a clean CORS-only setup with no proxy in the middle.

---

## 0. Pre-flight

```bash
# CLIs (one time)
npm install -g wrangler            # Cloudflare Pages / DNS
curl -L https://fly.io/install.sh | sh    # Fly.io

wrangler login                     # opens browser
fly auth login                     # opens browser
```

You'll need:
- GitHub access to `gaganchauhan1997/YAI-Excel`
- A Cloudflare account with `hackknow.com` on it (free plan is fine)
- A Fly.io account (free tier)
- At least one AI key — Gemini recommended (free: <https://aistudio.google.com/apikey>)

---

## 1. Deploy the backend to Fly.io

```bash
cd backend

# First-time launch — uses fly.toml (already in the repo)
fly launch --copy-config --name yai-excel-api --region bom --no-deploy

# Persistent storage for uploads + outputs
fly volumes create yai_excel_data --region bom --size 1

# Secrets — at minimum, set GEMINI_API_KEY
fly secrets set \
  GEMINI_API_KEY=YOUR_GEMINI_KEY \
  GROQ_API_KEY=YOUR_GROQ_KEY \
  ALLOWED_ORIGINS="https://yexcel.hackknow.com,http://localhost:3000"

fly deploy --remote-only
```

Verify:

```bash
curl https://yai-excel-api.fly.dev/healthz      # → {"status":"ok"}
curl https://yai-excel-api.fly.dev/api/themes   # → {"themes":[ … 10 themes …]}
```

### 1a. Bind `api.yexcel.hackknow.com` to Fly

```bash
fly certs add api.yexcel.hackknow.com
fly certs show api.yexcel.hackknow.com
```

Fly prints two records. You'll add them in step 3 below.

---

## 2. Deploy the frontend to Cloudflare Pages

### Option A — Wrangler CLI (one shot)

```bash
cd frontend

# Install deps + build the static export
npm install
NEXT_PUBLIC_API_URL=https://api.yexcel.hackknow.com npm run build

# Create the Pages project (one time)
wrangler pages project create yai-excel \
  --production-branch=main \
  --compatibility-date=2026-05-01

# Deploy
wrangler pages deploy out --project-name=yai-excel --branch=main
```

### Option B — Git integration (recommended for ongoing work)

In the **Cloudflare dashboard** → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**:

1. Pick `gaganchauhan1997/YAI-Excel`
2. **Production branch:** `main`
3. **Framework preset:** `Next.js (Static HTML Export)`
4. **Build command:** `cd frontend && npm install && npm run build`
5. **Build output directory:** `frontend/out`
6. **Environment variables** (Production):
   - `NEXT_PUBLIC_API_URL` = `https://api.yexcel.hackknow.com`
   - `NODE_VERSION` = `20`

Save. Cloudflare builds the site and assigns a `yai-excel.pages.dev` URL. Open it — full app loads, calls backend cleanly.

After this every `git push origin main` re-deploys automatically. No further commands.

---

## 3. Wire `yexcel.hackknow.com` + `api.yexcel.hackknow.com`

In the **Cloudflare dashboard** → **hackknow.com zone** → **DNS** → **Records**:

### 3a. Add the frontend record

| Type | Name | Target | Proxy status |
|------|------|--------|--------------|
| **CNAME** | `yexcel` | `yai-excel.pages.dev` | **Proxied (orange cloud)** |

### 3b. Add the API record

| Type | Name | Target | Proxy status |
|------|------|--------|--------------|
| **CNAME** | `api.yexcel` | `yai-excel-api.fly.dev` | **DNS only (grey cloud)** |
| **TXT** | `_acme-challenge.api.yexcel` | *(value from `fly certs show`)* | DNS only |

> Keep the API record **DNS-only** (grey cloud). If you proxy it through Cloudflare, you'll hit the 100MB request limit on free plans, and Fly's TLS cert won't issue.

### 3c. Hook up the Pages custom domain

In Cloudflare dashboard → **Workers & Pages** → `yai-excel` → **Custom domains** → **Set up a custom domain** → type `yexcel.hackknow.com` → **Continue**. Cloudflare validates DNS instantly (you're on the same account) and issues the certificate in ~30 seconds.

### 3d. Confirm

```bash
dig +short yexcel.hackknow.com         # → Cloudflare anycast IPs
dig +short api.yexcel.hackknow.com     # → Fly.io edge IP

curl -I https://yexcel.hackknow.com         # → HTTP/2 200
curl    https://api.yexcel.hackknow.com/healthz   # → {"status":"ok"}
```

---

## 4. Smoke test end-to-end

```bash
# Upload the sample CSV (under examples/ in the repo)
TOKEN=$(curl -s -F "file=@examples/sample_sales.csv" \
  https://api.yexcel.hackknow.com/api/upload | jq -r .token)

# Build
curl -s -X POST https://api.yexcel.hackknow.com/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"theme\":\"midnight\"}" | jq

# Download
curl -O "https://api.yexcel.hackknow.com/files/YAI-Excel_${TOKEN:0:8}_midnight.xlsx"
```

Open `https://yexcel.hackknow.com` in the browser, drop the same CSV, hit **Generate** — same workbook.

---

## 5. Update workflow (after step 2 Option B)

You're done. Every push to `main`:

- **Frontend** → Cloudflare auto-builds & deploys (≈ 45s).
- **Backend** → `cd backend && fly deploy --remote-only` (still manual, or add the Action in section 6).

---

## 6. (Optional) Auto-deploy the backend too

Add a GitHub Action so backend deploys on every push:

```yaml
# .github/workflows/deploy-backend.yml
name: deploy-backend
on:
  push:
    branches: [main]
    paths: ["backend/**", ".github/workflows/deploy-backend.yml"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --config backend/fly.toml
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Generate the token with `fly auth token`, paste it into the repo's **Settings → Secrets and variables → Actions** as `FLY_API_TOKEN`. Done.

---

## 7. Free-tier limits (worth knowing)

| Resource | Free quota | Likely impact |
|---|---|---|
| Cloudflare Pages | Unlimited bandwidth, 500 builds/mo, 100MB file upload to functions | Frontend handles it; uploads bypass via `api.` subdomain |
| Fly.io | 3 shared-cpu-1x VMs, 160GB egress/mo | Plenty for personal / small-team |
| Gemini 2.5 Flash | 60 RPM, 1500 RPD | Rotate to Groq/OpenAI on burst — already built into AIRouter |
| Cloudflare DNS | Unlimited records | n/a |

For Hackknow-scale traffic, scale Fly to `shared-cpu-2x 2GB` for ~$5/mo.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend 522 / 521 | Backend Fly machine asleep | Hit `https://api.yexcel.hackknow.com/healthz` once to wake it (first request takes ~3s). Set `min_machines_running = 1` in `fly.toml` to keep it warm. |
| Frontend 404 on `/dashboard` | Trailing slash mismatch | We export with `trailingSlash: true`. Browse to `/dashboard/` (with trailing /). Cloudflare auto-handles this for typed URLs. |
| CORS error in browser console | `ALLOWED_ORIGINS` missing | `fly secrets set ALLOWED_ORIGINS="https://yexcel.hackknow.com,http://localhost:3000"` then redeploy |
| Cert pending on `api.yexcel` | DNS still proxied | Toggle the orange cloud OFF (DNS-only) on the API record. Run `fly certs show api.yexcel.hackknow.com` — wait until both checks ✓. |
| `Vision unsupported` in logs | No vision-capable key set | `fly secrets set GEMINI_API_KEY=…` |
| File > 100MB rejected | Hit Cloudflare proxy limit | Make sure API record is DNS-only (grey cloud). If it's proxied, even legit uploads to `api.yexcel.hackknow.com` get capped. |
| Build fails on Cloudflare with `output: "export"` related error | Old cached Next.js workers | In Pages settings → **Settings → Functions → Compatibility flags**, ensure no Node compat is forced. We don't need it. |

---

**That's the whole map, Boss.** Run section 1, set up section 2 Option B once, drop two CNAMEs in section 3, and `yexcel.hackknow.com` is live for as long as Cloudflare and Fly are. 🚀
