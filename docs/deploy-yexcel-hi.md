# YAI-Excel · `yexcel.hackknow.com` Deploy Guide

**Hindi + English · पाँच मिनट में live · ₹0/mo**

---

## 🟢 शुरू करने से पहले / Pre-flight

| ज़रूरत / Need | कहाँ से / Where |
|---|---|
| Gemini API key (free) | <https://aistudio.google.com/apikey> |
| Cloudflare account (free) | <https://dash.cloudflare.com> |
| Fly.io account (free) | <https://fly.io/app/sign-up> |
| Node 20+ + Python 3.11+ | local machine |

```bash
# CLIs install (एक बार / one time)
npm install -g wrangler
curl -L https://fly.io/install.sh | sh
```

---

## ⚡ The Easy Way · One-Shot Installer

```bash
git clone https://github.com/gaganchauhan1997/YAI-Excel.git
cd YAI-Excel
bash deploy.sh
```

**हिंदी में step-by-step audio walkthrough**: see release notes for v1.2.0.

Script आपसे यह पूछेगा / The script will ask for:

1. **Gemini API key** — टाइप करते समय screen पर कुछ नहीं दिखेगा (`read -s` use हुआ है) / hidden input, never echoed
2. **Fly.io login** — browser खुलेगा / opens browser
3. **Cloudflare login** — browser खुलेगा / opens browser

बस ये करना है। कोई key chat में paste नहीं करनी। / That's it. No key ever leaves your terminal.

---

## 🔧 The Manual Way · अगर script fail हो / If script fails

### 1. Backend → Fly.io (Mumbai)

```bash
cd backend
fly auth login                                  # browser OAuth
fly launch --copy-config --name yai-excel-api --region bom --no-deploy
fly volumes create yai_excel_data --region bom --size 1
fly secrets set GEMINI_API_KEY=...              # paste your key — terminal only
fly secrets set ALLOWED_ORIGINS="https://yexcel.hackknow.com,http://localhost:3000"
fly deploy --remote-only
fly certs add api.yexcel.hackknow.com
```

Verify:
```bash
curl https://yai-excel-api.fly.dev/healthz       # {"status":"ok"}
curl https://yai-excel-api.fly.dev/version       # {"version":"1.2.0", ...}
```

### 2. Frontend → Cloudflare Pages

```bash
cd ../frontend
npm install
NEXT_PUBLIC_API_URL=https://api.yexcel.hackknow.com npm run build
wrangler login                                  # browser OAuth
wrangler pages project create yai-excel \
  --production-branch=main \
  --compatibility-date=2026-05-01
wrangler pages deploy out --project-name=yai-excel --branch=main
```

### 3. DNS — Cloudflare dashboard में

Cloudflare → `hackknow.com` zone → DNS → Add record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `yexcel` | `yai-excel.pages.dev` | 🟠 Proxied |
| CNAME | `api.yexcel` | `yai-excel-api.fly.dev` | ⚪ DNS only |
| TXT | `_acme-challenge.api.yexcel` | (Fly से मिलेगा) | DNS only |

फिर / then Cloudflare → Workers & Pages → `yai-excel` → Custom domains → add `yexcel.hackknow.com`.

---

## 🔄 Future · हर push पर auto-deploy

GitHub Secrets में ये तीन add करें / Add these 3 secrets in **github.com/gaganchauhan1997/YAI-Excel → Settings → Secrets and variables → Actions**:

| Name | Value | कहाँ से / Where |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | scoped token | Cloudflare → My Profile → API Tokens → Create Token → Account:Pages:Edit |
| `CLOUDFLARE_ACCOUNT_ID` | account ID | top-right of any Cloudflare zone page |
| `FLY_API_TOKEN` | Fly token | run `fly auth token` in terminal |

बाद में हर `git push origin main` automatic deploy हो जाएगा / After this, every push to `main` auto-deploys.

---

## 🆘 Troubleshooting

| समस्या / Symptom | Solution |
|---|---|
| Frontend `522` | Backend asleep → curl `/healthz` to wake it, then retry |
| CORS error in console | `fly secrets set ALLOWED_ORIGINS="https://yexcel.hackknow.com"` then redeploy |
| Cert pending on `api.yexcel` | Proxy must be **DNS-only** (grey cloud), not orange |
| `Vision unsupported` in logs | Add Gemini key: `fly secrets set GEMINI_API_KEY=...` |
| 100MB file upload rejected | Make sure `api.yexcel` is DNS-only — proxied has 100MB cap |
| Cloudflare cert pending | `dig +short yexcel.hackknow.com` should return CF IPs; toggle proxy OFF/ON if stuck |

---

## ✅ Smoke test जब live हो / Smoke test when live

```bash
# Upload sample CSV from repo
TOKEN=$(curl -s -F "file=@examples/sample_sales.csv" \
  https://api.yexcel.hackknow.com/api/upload | jq -r .token)

# Generate (midnight theme)
curl -s -X POST https://api.yexcel.hackknow.com/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"theme\":\"midnight\"}" | jq

# Download workbook
curl -O "https://api.yexcel.hackknow.com/files/YAI-Excel_${TOKEN:0:8}_midnight.xlsx"

# Open in browser
open https://yexcel.hackknow.com
```

---

## 🔐 Security · ज़रूरी / Important

- API keys कभी chat / GitHub / Slack में paste नहीं करनी
- Always rotate via the provider's dashboard (Cloudflare, Fly, Razorpay, etc.)
- GitHub Secrets और Fly secrets — encrypted, never readable again
- Reference: [`SECURITY.md`](../SECURITY.md)

---

**Free intelligence, infinite capability.** — Hackknow · YAHAVIS AI · MIT

Repo: <https://github.com/gaganchauhan1997/YAI-Excel>
