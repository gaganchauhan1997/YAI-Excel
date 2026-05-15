# YAI-Excel — End-to-end cURL walkthrough

Three real workflows, every line copy-pastable. Backend assumed at `http://localhost:8000`.

---

## 1. CSV → dashboard

Use the sample CSV checked into the repo at `examples/sample_sales.csv`.

```bash
# 1. Upload
TOKEN=$(curl -s -F "file=@examples/sample_sales.csv" \
  http://localhost:8000/api/upload | jq -r .token)

echo "Session: $TOKEN"

# 2. Generate (midnight theme + INR formatting)
curl -s -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"theme\":\"midnight\",\"mode\":\"enhance\"}" \
  | jq

# 3. Download the workbook
curl -O "http://localhost:8000/files/YAI-Excel_${TOKEN:0:8}_midnight.xlsx"
open YAI-Excel_${TOKEN:0:8}_midnight.xlsx     # macOS
# xdg-open YAI-Excel_${TOKEN:0:8}_midnight.xlsx   # Linux
```

Output:

```json
{
  "token": "9f4a1d…",
  "type": "csv",
  "theme": "midnight",
  "filename": "YAI-Excel_9f4a1d_midnight.xlsx",
  "download_url": "/files/YAI-Excel_9f4a1d_midnight.xlsx",
  "audit": {
    "domain": "sales",
    "confidence": 0.6,
    "counts": {
      "charts": 1, "kpis": 4, "pivots": 0, "formulas": 2,
      "interactive_controls": 1, "conditional_formats": 1
    },
    "enhancement_suggestions": []
  }
}
```

---

## 2. Pure-prompt mode

No file — just describe the dashboard you want.

```bash
TOKEN=$(curl -s \
  -F 'text=Build a quarterly sales dashboard for a logistics company with 8 regions, showing revenue, costs, delivery rate, and staff performance in INR.' \
  http://localhost:8000/api/upload | jq -r .token)

curl -s -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"theme\":\"emerald\"}" | jq
```

The text parser sends your description to the AI router, gets back an audit JSON, then the build pipeline materialises it.

---

## 3. Direct audit-JSON build (no upload)

Skip detection entirely — hand YAI-Excel a pre-built audit JSON and just get the workbook. The sample lives at `examples/sample_audit.json`.

```bash
# Audit JSON in, enhanced audit out (preview only — no .xlsx yet)
curl -s -X POST http://localhost:8000/api/enhance \
  -H "Content-Type: application/json" \
  -d "{\"audit\":$(cat examples/sample_audit.json),\"theme\":\"crimson\"}" \
  | jq .counts
```

For a full build from this JSON, use the Python entry directly (Docker-attached):

```bash
docker compose exec backend python -c '
import json
from excel import YAIExcelBuilder
audit = json.load(open("examples/sample_audit.json"))
builder = YAIExcelBuilder(theme_name="crimson", audit=audit)
out = builder.save_to_path("outputs/from_sample_audit.xlsx")
print("Saved:", out)
'
```

---

## 4. List available themes

```bash
curl -s http://localhost:8000/api/themes | jq
```

```json
{ "themes": ["midnight","emerald","crimson","slate","amber","ocean","violet","rose","carbon","arctic"] }
```

---

## 5. Health probe

```bash
curl -s http://localhost:8000/healthz
# → {"status":"ok"}
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Provide a file, text, or url.` | Add `-F "file=@…"` or `-F "text=…"` |
| `Unknown token — call /api/upload first.` | The token has expired or the storage volume was wiped — re-upload |
| Empty `download_url` | Check backend logs for the failing step (likely missing API key for vision-heavy inputs) |
| Vision failing on bad photos | Auto-enhance is already on; for tricky scans, set `VISION_MODEL=gemini-2.5-pro` in `.env` |
