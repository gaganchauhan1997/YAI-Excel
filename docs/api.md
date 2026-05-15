# YAI-Excel — API Reference

All endpoints live under `http://localhost:8000/api/*`. Interactive Swagger UI is available at `http://localhost:8000/docs`.

---

## Authentication

The current version is **anonymous**. Tokens returned by `/api/upload` are session-scoped and unguessable (UUID4), so they double as access controls for the upload session.

If you deploy publicly, place YAI-Excel behind your own auth layer (NGINX + JWT, Cloudflare Access, etc).

---

## Endpoints

### `POST /api/upload`

Accept any input and prepare a session.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | File | ❌ | Image / video / PDF / Excel / CSV / TSV / JSON / XML / text file |
| `text` | string | ❌ | Natural-language prompt or pasted DB output |
| `url`  | string | ❌ | Google Sheets / remote URL |

At least one of `file`, `text`, or `url` must be provided.

**Response 200**

```json
{
  "token": "9f4a1d…",
  "type": "image",
  "summary": "📷 Image received — running visual audit",
  "file": "input.jpg",
  "url": null,
  "text_preview": ""
}
```

`type` is one of: `image · video · pdf · excel · csv · tsv · json · xml · text · prompt · sheets_url`.

---

### `POST /api/generate`

Run the full pipeline against an uploaded session.

**Content-Type:** `application/json`

```json
{
  "token": "9f4a1d…",
  "theme": "midnight",
  "mode": "enhance",
  "user_prompt": "Focus on profit margin and MoM growth."
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | — | Token from `/api/upload` |
| `theme` | enum | `"midnight"` | Any of the 10 built-in themes |
| `mode`  | enum | `"enhance"` | `rebrand` / `enhance` / `redesign` (Excel only) |
| `user_prompt` | string | `null` | Optional extra direction merged into the audit |

**Response 200**

```json
{
  "token": "9f4a1d…",
  "type": "image",
  "theme": "midnight",
  "filename": "YAI-Excel_9f4a1d_midnight.xlsx",
  "download_url": "/files/YAI-Excel_9f4a1d_midnight.xlsx",
  "audit": {
    "domain": "sales",
    "counts": { "charts": 4, "kpis": 6, "pivots": 1, "formulas": 14 },
    "confidence": 0.86,
    "enhancement_suggestions": [
      { "description": "Add MoM growth column", "priority": "high" }
    ]
  }
}
```

The workbook is also written to `outputs/<filename>` on disk and served via the static `/files/*` mount.

---

### `POST /api/enhance`

Run the EnhancementEngine against any audit JSON without uploading a file.
Useful for inspecting what would be added before generation.

```json
{
  "audit": { /* partial audit */ },
  "theme": "midnight"
}
```

**Response 200**

```json
{
  "audit": { /* fully-enhanced audit JSON */ },
  "counts": { "charts": 6, "kpis": 4, "formulas": 12 },
  "available_themes": ["midnight", "emerald", "..."]
}
```

---

### `GET /api/themes`

Returns the list of built-in themes.

```json
{ "themes": ["midnight", "emerald", "crimson", "slate", "amber", "ocean", "violet", "rose", "carbon", "arctic"] }
```

---

### `GET /healthz`

Liveness probe. Always returns:

```json
{ "status": "ok" }
```

---

## Audit JSON schema

`/api/generate` and `/api/enhance` both consume and emit the master audit schema.
See the full schema in [`backend/ai/audit_prompts.py`](../backend/ai/audit_prompts.py) — it covers:

`confidence` · `detected_domain` · `meta` · `interactive_controls` · `kpi_strip` · `charts` ·
`pivot_tables` · `data_tables` · `conditional_formatting` · `formulas` · `slicers` ·
`named_ranges` · `data_validation` · `layout_bands` · `enhancement_suggestions` ·
`missing_elements` · `counts`.

---

## Error responses

```json
{ "detail": "Provide a file, text, or url." }   // 400
{ "detail": "Unknown token — call /api/upload first." }   // 404
{ "detail": "Internal server error" }   // 500
```

Errors during a build step do **not** abort the response — they are logged and the engine continues, leaving a usable workbook with whatever steps did succeed. Inspect `quality_gates` in the build log (`backend.log`) for a per-step trace.

---

## cURL examples

```bash
# 1) upload a CSV
token=$(curl -s -F "file=@sales.csv" http://localhost:8000/api/upload | jq -r .token)

# 2) generate with the ocean theme
curl -s -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$token\",\"theme\":\"ocean\"}" | jq

# 3) download the workbook
curl -O http://localhost:8000/files/YAI-Excel_${token:0:8}_ocean.xlsx
```

```bash
# Pure-prompt mode
token=$(curl -s -F 'text=Build a quarterly logistics dashboard with 8 regions' \
  http://localhost:8000/api/upload | jq -r .token)

curl -s -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$token\",\"theme\":\"emerald\"}"
```
