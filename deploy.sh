#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# YAI-Excel — one-shot installer for yexcel.hackknow.com
# ──────────────────────────────────────────────────────────────────────
# Walks you through:
#   1. Backend deploy to Fly.io (Mumbai region)
#   2. Frontend deploy to Cloudflare Pages (via wrangler login OAuth)
#   3. DNS check on yexcel.hackknow.com + api.yexcel.hackknow.com
#
# Safety:
#   - Never logs, echoes, or prints any secret value
#   - Uses `read -s` for sensitive prompts (no terminal echo)
#   - Stores secrets only in Fly secrets / Cloudflare Pages env
#   - No state cached on disk — every run is idempotent
#
# Run with:  bash deploy.sh
# Or:        chmod +x deploy.sh && ./deploy.sh
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── colors ────────────────────────────────────────────────────────────
BOLD=$'\033[1m'
DIM=$'\033[2m'
YELLOW=$'\033[33m'
GREEN=$'\033[32m'
RED=$'\033[31m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

step() { printf "\n${BOLD}${YELLOW}▸ %s${RESET}\n" "$1"; }
ok()   { printf "${GREEN}  ✓ %s${RESET}\n" "$1"; }
warn() { printf "${YELLOW}  ! %s${RESET}\n" "$1"; }
fail() { printf "${RED}  ✗ %s${RESET}\n" "$1"; exit 1; }
ask()  { printf "${CYAN}  ? %s${RESET}" "$1"; }

# Ensure we are at the repo root
[[ -f docker-compose.yml && -d backend && -d frontend ]] \
  || fail "Run this script from the YAI-Excel repo root."

# ── 0. Tooling check ──────────────────────────────────────────────────
step "0/4 · Checking required CLIs"

need() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing: $1. Install: $2"
}
need git     "https://git-scm.com/downloads"
need curl    "your package manager"
need node    "https://nodejs.org"
need npm     "ships with node"
need flyctl  "curl -L https://fly.io/install.sh | sh"
need wrangler "npm install -g wrangler"
ok "all CLIs present"

# ── 1. Backend → Fly.io ───────────────────────────────────────────────
step "1/4 · Deploy backend to Fly.io (Mumbai region)"

flyctl auth whoami >/dev/null 2>&1 || flyctl auth login

cd backend

if flyctl status --app yai-excel-api >/dev/null 2>&1; then
  ok "fly app 'yai-excel-api' already exists — redeploying"
else
  ok "creating fly app 'yai-excel-api' in BOM (Mumbai)"
  flyctl launch --copy-config --name yai-excel-api --region bom --no-deploy --yes
  flyctl volumes create yai_excel_data --region bom --size 1 --yes || true
fi

# Prompt for secrets WITHOUT echoing them
ask "Gemini API key (free at aistudio.google.com/apikey) — paste then Enter (input hidden): "
read -rs GEMINI
echo
ask "Groq API key (optional, Enter to skip): "
read -rs GROQ
echo

# Push to Fly. The values never touch the terminal log or local disk.
set +x
SECRETS=()
[[ -n "${GEMINI:-}" ]] && SECRETS+=("GEMINI_API_KEY=$GEMINI")
[[ -n "${GROQ:-}"   ]] && SECRETS+=("GROQ_API_KEY=$GROQ")
SECRETS+=("ALLOWED_ORIGINS=https://yexcel.hackknow.com,http://localhost:3000")
SECRETS+=("APP_ENV=production")
flyctl secrets set --app yai-excel-api "${SECRETS[@]}" >/dev/null
unset GEMINI GROQ SECRETS
ok "secrets pushed to Fly (never written to disk)"

flyctl deploy --remote-only --app yai-excel-api
ok "backend deployed"

# Custom domain
flyctl certs add api.yexcel.hackknow.com --app yai-excel-api 2>/dev/null || true
warn "After DNS step you may need to run: flyctl certs show api.yexcel.hackknow.com"

cd ..

# ── 2. Frontend → Cloudflare Pages ────────────────────────────────────
step "2/4 · Deploy frontend to Cloudflare Pages"

cd frontend

wrangler whoami >/dev/null 2>&1 || wrangler login

ok "installing npm deps"
npm install --no-audit --no-fund --silent

ok "building static export"
NEXT_PUBLIC_API_URL="https://api.yexcel.hackknow.com" NEXT_TELEMETRY_DISABLED=1 \
  npm run build --silent

# Create pages project if it doesn't already exist
if ! wrangler pages project list 2>/dev/null | grep -q "yai-excel"; then
  ok "creating Cloudflare Pages project 'yai-excel'"
  wrangler pages project create yai-excel \
    --production-branch=main \
    --compatibility-date=2026-05-01 >/dev/null
fi

ok "uploading build to Cloudflare Pages"
wrangler pages deploy out --project-name=yai-excel --branch=main --commit-dirty=true

cd ..

# ── 3. DNS check ──────────────────────────────────────────────────────
step "3/4 · DNS check"

cat <<EOF

  Add these records in your Cloudflare DNS zone for ${BOLD}hackknow.com${RESET}:

    ${BOLD}Type    Name        Target                     Proxy${RESET}
    CNAME   yexcel      yai-excel.pages.dev        🟠 Proxied
    CNAME   api.yexcel  yai-excel-api.fly.dev      ⚪ DNS-only

  Then in Cloudflare → Workers & Pages → yai-excel → Custom domains:
    add ${BOLD}yexcel.hackknow.com${RESET}.

  Press Enter after both CNAMEs are in place (or Ctrl+C to skip the check)…
EOF
read -r

if command -v dig >/dev/null 2>&1; then
  YEX=$(dig +short yexcel.hackknow.com | head -1)
  API=$(dig +short api.yexcel.hackknow.com | head -1)
  [[ -n "$YEX" ]] && ok "yexcel.hackknow.com → $YEX" || warn "yexcel.hackknow.com not resolving yet (TTL up to 5 min)"
  [[ -n "$API" ]] && ok "api.yexcel.hackknow.com → $API" || warn "api.yexcel.hackknow.com not resolving yet"
fi

# ── 4. End-to-end smoke ───────────────────────────────────────────────
step "4/4 · Live smoke test"

if curl -sf "https://api.yexcel.hackknow.com/healthz" | grep -q '"ok"'; then
  ok "backend live"
else
  warn "backend not yet responding — give it 30s and retry: curl https://api.yexcel.hackknow.com/healthz"
fi

if curl -sIL "https://yexcel.hackknow.com" | grep -q "HTTP/2 200"; then
  ok "frontend live"
else
  warn "frontend not yet responding — Cloudflare cert may still be propagating (1–2 min)"
fi

cat <<EOF

${GREEN}${BOLD}DONE.${RESET}

  Frontend  →  https://yexcel.hackknow.com
  API       →  https://api.yexcel.hackknow.com
  Repo      →  https://github.com/gaganchauhan1997/YAI-Excel

  ${DIM}Every future push to 'main' auto-deploys both sides.${RESET}
EOF
