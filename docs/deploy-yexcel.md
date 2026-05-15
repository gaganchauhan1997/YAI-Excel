# Deploy YAI-Excel to `yexcel.hackknow.com`

This guide takes you from cloned repo → live on **https://yexcel.hackknow.com** in under 10 minutes.

We use the free path:
- **Frontend** → Vercel (free hobby tier, custom domains supported)
- **Backend**  → Fly.io (free `shared-cpu-1x` 256-1024MB, BOM region)
- **DNS**      → your Hackknow.com nameserver (Cloudflare / Namecheap / GoDaddy)

> Total cost: ₹0 / month for low traffic.

---

## 0. Pre-flight

```bash
# Install Vercel + Fly CLIs (one time)
npm i -g vercel
brew install flyctl                  # or: curl -L https://fly.io/install.sh | sh

vercel login
fly auth login
```

You'll need:
- GitHub access to `gaganchauhan1997/YAI-Excel`
- At least one AI key (Gemini recommended — free at https://aistudio.google.com/apikey)
- DNS access for `hackknow.com`

---

## 1. Deploy the backend to Fly (Mumbai region)

```bash
cd backend

# First-time deploy
fly launch --copy-config --name yai-excel-api --region bom --no-deploy
fly volumes create yai_excel_data --region bom --size 1
fly secrets set \
  GEMINI_API_KEY=YOUR_GEMINI_KEY \
  GROQ_API_KEY=YOUR_GROQ_KEY \
  ALLOWED_ORIGINS="https://yexcel.hackknow.com,http://localhost:3000"
fly deploy --remote-only
```

Verify:

```bash
curl https://yai-excel-api.fly.dev/healthz       # → {"status":"ok"}
curl https://yai-excel-api.fly.dev/api/themes    # → {"themes":[…10 themes…]}
```

---

## 2. Deploy the frontend to Vercel

```bash
cd ../frontend

# First-time deploy
vercel link --yes --project yai-excel
vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://yai-excel-api.fly.dev

vercel --prod
```

You'll get a URL like `yai-excel-xyz.vercel.app`. Open it — full site should load.

---

## 3. Wire the custom domain

### 3a — in Vercel

```bash
vercel domains add yexcel.hackknow.com
```

Vercel will print a target hostname (something like `cname.vercel-dns.com`) and ask you to add it as a DNS record. Keep that page open.

### 3b — in your DNS provider (Cloudflare / Namecheap / Hostinger)

Add **one** CNAME record on `hackknow.com`:

| Type  | Name (host) | Value                | TTL  | Proxy |
|-------|-------------|----------------------|------|-------|
| CNAME | `yexcel`    | `cname.vercel-dns.com` | Auto | OFF (DNS only) |

> If you're on Cloudflare: keep proxy **OFF (grey cloud)** so Vercel can issue the cert. After it's live you can switch the cloud to orange.

Wait 30s – 5min for DNS propagation, then in Vercel:

```bash
vercel certs add yexcel.hackknow.com
```

Vercel auto-provisions a Let's Encrypt cert. Done.

### 3c — confirm

```bash
curl -I https://yexcel.hackknow.com    # → HTTP/2 200
```

---

## 4. (Optional) Custom backend domain

If you'd like the API on `api.yexcel.hackknow.com` instead of `*.fly.dev`:

```bash
cd backend
fly certs add api.yexcel.hackknow.com
fly certs show api.yexcel.hackknow.com
```

Fly will print two records to add. In your DNS:

| Type   | Name                       | Value                              |
|--------|----------------------------|------------------------------------|
| CNAME  | `api.yexcel`               | `yai-excel-api.fly.dev`            |
| TXT    | `_acme-challenge.api.yexcel` | (the value Fly gives you)        |

Then update `frontend/vercel.json` to point all `/api/*` rewrites at `https://api.yexcel.hackknow.com` and redeploy.

---

## 5. Smoke test the live site

```bash
# Upload a CSV from this repo
TOKEN=$(curl -s -F "file=@examples/sample_sales.csv" \
  https://yexcel.hackknow.com/api/upload | jq -r .token)

# Build it
curl -s -X POST https://yexcel.hackknow.com/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"theme\":\"midnight\"}" | jq

# Download
curl -O "https://yexcel.hackknow.com/files/YAI-Excel_${TOKEN:0:8}_midnight.xlsx"
```

If all three work — you're shipping.

---

## 6. Update workflow

After every push to `main`:

```bash
# Backend
cd backend && fly deploy --remote-only

# Frontend (or just push to GitHub — Vercel auto-deploys on push to main)
cd ../frontend && vercel --prod
```

Enable Vercel's Git integration once and you can skip the manual frontend deploy:

```bash
vercel git connect
```

---

## 7. Costs / scaling notes

- Fly free tier covers ~3 shared-cpu-1x machines, 160GB outbound/month
- Vercel hobby covers 100GB bandwidth, unlimited static
- Vision API calls use **your** Gemini quota (60 req/min on the free tier — plenty for personal use, swap to Groq/OpenAI on rate limit)
- For Hackknow-scale traffic, upgrade Fly to `shared-cpu-2x 2GB` (~$5/mo) — the engine fits comfortably

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 502 from Vercel | Backend Fly machine asleep | First request wakes it — retry in 10s; or set `min_machines_running = 1` in `fly.toml` |
| CORS error | `ALLOWED_ORIGINS` missing your domain | `fly secrets set ALLOWED_ORIGINS="https://yexcel.hackknow.com,…"` and redeploy |
| `Vision unsupported` in logs | No vision-capable key | Add `GEMINI_API_KEY` (free) |
| DNS doesn't resolve | TTL not expired | Wait 5min, then `dig yexcel.hackknow.com +short` should return Vercel IPs |
| Vercel cert pending | Cloudflare proxy on | Set the record to DNS-only (grey cloud), wait 60s, retry |

---

**You're done, Boss.** 🚀

Open https://yexcel.hackknow.com and drop a CSV.
