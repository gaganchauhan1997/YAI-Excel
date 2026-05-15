<div align="center">

# YAI-Excel

### *Give us anything. Get a dashboard.*

**Universal AI-powered Excel dashboard generator. Any input → enterprise-grade workbook.**

[![License: MIT](https://img.shields.io/badge/License-MIT-FFD300.svg?style=flat-square)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%2B%20FastAPI-0A0A0A.svg?style=flat-square)]()
[![Free Tier](https://img.shields.io/badge/APIs-Free%20Tier%20First-FF6BCB.svg?style=flat-square)]()
[![Hindi · हिं](https://img.shields.io/badge/UI-EN%20%C2%B7%20%E0%A4%B9%E0%A4%BF%E0%A4%82-4F7DF3.svg?style=flat-square)]()
[![INR · ₹](https://img.shields.io/badge/Indian%20%E2%82%B9-Lakhs%20%C2%B7%20Crores-5EE49B.svg?style=flat-square)]()
[![Built with](https://img.shields.io/badge/Built%20with-YAHAVIS%20AI-7C3AED.svg?style=flat-square)](https://github.com/gaganchauhan1997/YahavisAI)

[**Live**](https://yexcel.hackknow.com) · [**Quick start**](#-quick-start) · [**Deploy to yexcel.hackknow.com**](docs/deploy-yexcel.md) · [**API docs**](docs/api.md) · [**Curl walkthrough**](docs/curl-walkthrough.md)

</div>

---

## What is YAI-Excel?

YAI-Excel is a **universal dashboard intelligence system**. It is *not* a template filler.

Give it **anything**:

- 📷 a screenshot, photo, scanned page, or whiteboard pic
- 🎬 a screen recording of someone scrolling through a dashboard
- 📄 a PDF report or scanned financial statement
- 📊 an existing .xlsx / .xls / .xlsm workbook
- 📋 raw CSV / TSV / JSON / XML data
- 🔗 a Google Sheets link
- 💾 a paste of SQL query output
- 💬 a natural-language description
- 🧮 a calculation description ("Revenue 50000, Cost 32000, 5 months, MoM growth")
- 🌀 any mix of the above

…and it returns a fully **interactive, formula-complete, theme-perfect Excel workbook**, in seconds.

> **Core philosophy:** no matter how bad, incomplete, or unusual the input — the output is always enterprise grade.

This project is part of the **YAHAVIS AI** ecosystem and adheres to its core principle: **free intelligence, infinite capability.** YAI-Excel ships with a **rotating free-tier API pool** (Gemini → Groq → OpenAI → Anthropic) so you can run it at zero financial overhead.

---

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#-quick-start)
- [Free-tier API setup](#free-tier-api-setup)
- [Input modes](#input-modes)
- [Build pipeline](#build-pipeline)
- [Chart engine](#chart-engine--20-types)
- [Theme gallery](#theme-gallery--10-themes)
- [Quality gates](#quality-gates)
- [Repo layout](#repo-layout)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

---

## Demo

```text
$ docker compose up

→ frontend ready on http://localhost:3000
→ backend  ready on http://localhost:8000
```

Open `http://localhost:3000`, drop **any** input, choose a theme, hit **Generate**. The `.xlsx` lands in `outputs/`.

---

## What's new in v1.1

- 🪙 **Indian Rupee formatting** — full lakhs/crores grouping (`₹1,23,45,678`) and smart short form (`₹1.23 Cr`) baked into every KPI when you toggle the Indian switch.
- 🇮🇳 **Bilingual UI (EN · हिं)** — entire frontend translates between English and Hindi with one click.
- 🧱 **Neo-brutalist redesign** — thick black borders, hard shadows, chunky display type. LibreChat-grade three-pane layout with collapsible sidebar, chat-style audit stream, and a fused universal input bar.
- 📐 **Real SUMIFS pivots** — `PivotEngine` now reads the actual source range, computes unique row labels, and emits true `SUMIFS / COUNTIFS / AVERAGEIFS` formulas (24+ live cells on the sample). No more placeholders.
- 🎙️ **YAHAVIS module** — drop-in adapter (`backend/yahavis_module.py`) so the YAHAVIS voice core can mount YAI-Excel and respond to "Yahavi, dashboard banao".
- 🚀 **Production-ready deploy** — `vercel.json` + `fly.toml` + a dedicated guide to ship at `yexcel.hackknow.com` in under 10 minutes.

## Features

### 🎯 Universal input
- 10 input modes — image, video, PDF, Excel, CSV, TSV, JSON, XML, Sheets URL, pasted text, plain-language prompt, or any mix.
- **Even bad inputs work**: blurry photos, rotated scans, tilted screens, partial data — all enhanced before audit.

### 🧠 AI audit system
- Vision-first pipeline (Gemini / GPT-4o / Claude).
- Master audit prompt produces a structured JSON describing every detected chart, KPI, pivot, formula, conditional format, slicer, named range, layout band, and interactive control.
- **Multi-frame merging** for videos & multi-page PDFs: per-frame audits are deduped & combined into one master audit.

### 🔧 Recreation engine
- 18-step build pipeline driven 100% by the audit JSON. No hardcoding.
- If the AI found 20 charts → 20 charts get built. If it found 5 pivots → 5 pivots get built.
- Auto-enhance: dashboards always ship with KPIs, charts, interactivity, conditional formats, and formula completeness — even if the source had none.

### 🎨 10 first-class themes
`midnight` · `emerald` · `crimson` · `slate` · `amber` · `ocean` · `violet` · `rose` · `carbon` · `arctic`

### 📊 20+ chart types
bar · stacked_bar · grouped_bar · line · smooth_line · area · pie · donut · nested_donut · scatter · radar · bubble · combo · cylinder · gauge · bullet · waterfall · funnel · timeline · lollipop · progress_bar

### ⚡ Interactivity baked in
- Period dropdown (`B1`) drives every KPI and chart.
- Region / category filters via data-validation lists.
- Tab navigation inside sections (`CHOOSE` driven).
- Dynamic chart titles linked to formulas.
- Trend arrows on KPIs with conditional colors.

### 🛡️ Quality gates
Every output passes 15+ checks before delivery — no `#REF!`, no orphaned controls, no empty charts, frozen panes set, print area set, gridlines hidden on the Dashboard sheet only.

### 💰 Free-tier first
Built on the YAHAVIS rotating API pool. Never pay until you choose to. Falls back gracefully if a provider is rate-limited.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│        Next.js 14  ·  Tailwind  ·  Framer Motion             │
│   Landing  +  Dashboard studio  +  Theme selector             │
└──────────────────────────────────────────────────────────────┘
                            │
                       REST / JSON
                            │
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│            FastAPI  ·  Python 3.11+  ·  Pydantic             │
│  /api/upload   /api/generate   /api/enhance   /api/themes    │
└──────┬────────────────────────────┬──────────────────────────┘
       │                            │
   ┌───▼───┐  detector + parsers  ┌─▼─────────┐
   │ image │  ┌─────────────────┐ │  AI Router │
   │ video │  │  cv2 frame ext. │ │  Gemini→…  │
   │ pdf   │  │  PIL enhance    │ │  Groq      │
   │ excel │  │  Camelot table  │ │  GPT-4o    │
   │ csv   │  └─────────────────┘ │  Claude    │
   │ text  │                      └─────┬──────┘
   └───┬───┘                            │
       │             VisionReader ──────┤
       │             AuditMerger ───────┤
       │             DataAnalyzer ──────┤
       │             FormulaEngine ─────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                      EXCEL BUILDER                            │
│   openpyxl  ·  xlsxwriter  ·  pandas  ·  numpy               │
│  18-step pipeline → audit JSON in, .xlsx out                  │
│                                                                │
│  ChartEngine · KPIEngine · TableEngine · PivotEngine          │
│  InteractivityEngine · FormatEngine · FormulaWriter           │
│  EnhancementEngine · ThemeEngine (10 themes)                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/gaganchauhan1997/YAI-Excel.git
cd YAI-Excel
cp .env.example .env          # fill in at least GEMINI_API_KEY
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:8000
- API docs → http://localhost:8000/docs

### Option B — Local dev

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

### Option C — Pure CLI

```python
from backend.excel import YAIExcelBuilder

audit = {...}  # your audit JSON
b = YAIExcelBuilder(theme_name="midnight", audit=audit)
b.save_to_path("out.xlsx")
```

---

## Free-tier API setup

YAI-Excel rotates through providers in this order, using the first available:

| Provider | Vision | Free tier | Get key |
|----------|:------:|:---------:|---------|
| **Gemini 2.5 Flash** | ✅ | Generous | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq** (Llama 3.1 70B) | ❌ | Generous | [console.groq.com/keys](https://console.groq.com/keys) |
| **OpenAI GPT-4o-mini** | ✅ | Paid | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic Claude Sonnet** | ✅ | Paid | [console.anthropic.com](https://console.anthropic.com/) |

You only need **one** key to run YAI-Excel. Gemini is recommended (vision-capable and free).

---

## Input modes

| # | Mode | Examples | Notes |
|---|------|----------|-------|
| 1 | Image | jpg / png / webp / heic | Auto-rotated, contrast-enhanced, sharpened, upscaled |
| 2 | Video | mp4 / mov / avi / webm | 1 frame / 2s + first/mid/last, dedupe via phash, drop blurry |
| 3 | PDF | any .pdf | Pages → images + table extraction via Camelot |
| 4 | Excel | .xlsx / .xls / .xlsm | 3 modes: rebrand / enhance / redesign |
| 5 | CSV / TSV / JSON / XML | any structured data | Schema auto-detected |
| 6 | Google Sheets URL | docs.google.com/spreadsheets/… | Pulled via API |
| 7 | DB query result | pasted text | Auto-parsed as CSV/TSV |
| 8 | Natural-language prompt | "Build a quarterly sales dashboard…" | AI designs schema + seed data |
| 9 | Calculation description | "Revenue 50000, Cost 32000, 5 months" | AI writes formulas + builds dashboard |
| 10 | Mixed | image + extra data + description | Inputs intelligently merged |

---

## Build pipeline

The builder runs 18 deterministic steps, all driven by the audit JSON:

```
01 create_all_sheets()          → Dashboard / Data / Formulas / Calcs
02 write_raw_data()
03 build_named_ranges()
04 build_all_interactive_controls()
05 build_all_pivots()           → PivotEngine
06 build_all_charts()           → ChartEngine
07 build_all_kpi_cards()        → KPIEngine
08 build_all_data_tables()      → TableEngine
09 apply_all_cond_formats()     → FormatEngine
10 build_all_slicers()
11 apply_data_validation()
12 link_all_interactivity()     → InteractivityEngine
13 apply_theme()                → ThemeEngine
14 apply_enhancements()         → EnhancementEngine
15 set_sheet_properties()
16 run_quality_gates()
17 generate_preview_png()
18 save_to_bytes()
```

If the audit JSON says 20 charts — 20 get built. Nothing is hardcoded.

---

## Chart engine — 20+ types

| Standard | Advanced |
|----------|----------|
| bar | gauge / speedometer |
| stacked_bar | bullet |
| grouped_bar | cylinder / barrel |
| line | nested_donut |
| smooth_line | waterfall |
| area | funnel |
| pie | timeline / gantt |
| donut | lollipop |
| scatter | progress_bar |
| combo | bubble |
| radar / spider | smooth multi-line |

All charts are positioned, colored, and titled per the audit JSON. Titles are formula-driven (`="Revenue — "&TEXT($B$1,"MMM YYYY")`) so they update with the interactive controls.

---

## Theme gallery — 10 themes

| Theme | Primary | Accent | Vibe |
|-------|---------|--------|------|
| `midnight` | `#1E3A5F` | `#FFC000` | Corporate confidence |
| `emerald` | `#1A3C2E` | `#70AD47` | Growth, finance |
| `crimson` | `#7B0000` | `#FFFFFF` | High drama, urgency |
| `slate` | `#2D3748` | `#63B3ED` | Cool, modern, neutral |
| `amber` | `#3D1F00` | `#F59E0B` | Warm, premium |
| `ocean` | `#0F4C5C` | `#22D3EE` | Fresh, energetic |
| `violet` | `#2D1B69` | `#A78BFA` | Creative, bold |
| `rose` | `#7C3048` | `#FBCFE8` | Refined, editorial |
| `carbon` | `#0A0A0A` | `#00FF41` | Hacker / terminal |
| `arctic` | `#FFFFFF` | `#BFDBFE` | Minimalist, clean |

---

## Quality gates

Every workbook must pass these checks before being saved:

- ✅ All interactive controls linked to cells
- ✅ All chart titles are formula-driven
- ✅ All KPIs update when the period dropdown changes
- ✅ Zero `#REF!` / `#VALUE!` / `#NAME?` errors
- ✅ All conditional formatting rules active
- ✅ All named ranges resolve
- ✅ Theme applied consistently
- ✅ Print area set (A4 landscape)
- ✅ Zoom set to show the full dashboard
- ✅ Gridlines hidden on Dashboard sheet only
- ✅ Frozen panes on header
- ✅ Tab order: Dashboard → Data → Formulas → Calcs
- ✅ No empty charts
- ✅ File opens cleanly in Excel + LibreOffice

---

## Repo layout

```
YAI-Excel/
├── README.md
├── LICENSE
├── .env.example
├── docker-compose.yml
├── package.json
│
├── frontend/                      Next.js 14
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               Landing page
│   │   └── dashboard/page.tsx     Main tool UI
│   ├── components/
│   │   ├── upload/                UniversalDropzone, Video, Image, Prompt
│   │   ├── preview/               DashboardPreview, AuditReport, FormulaList
│   │   └── editor/                ThemeSelector, EnhanceOptions
│   ├── lib/api.ts
│   └── styles/globals.css
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── api/routes/                upload.py · generate.py · enhance.py
│   ├── ai/                        ai_router · vision_reader · audit_merger
│   │                              data_analyzer · formula_engine · audit_prompts
│   ├── parsers/                   image · video · pdf · excel · csv · text · detector
│   └── excel/                     builder · chart · kpi · table · pivot · formatter
│       │                          formula_writer · interactivity · enhancer
│       └── themes/                10 theme modules
│
└── docs/                          api.md · deployment.md
```

---

## Development

### Backend tests (smoke)

```bash
cd backend
python -c "from excel import YAIExcelBuilder; YAIExcelBuilder(theme_name='midnight', audit={}).save_to_path('test.xlsx')"
```

### Frontend lint

```bash
cd frontend
npm run lint
```

### Hot reload

```bash
# terminal 1
cd backend && uvicorn main:app --reload --port 8000
# terminal 2
cd frontend && npm run dev
```

---

## Roadmap

- [ ] Live PNG preview (1920×1080) baked into `/api/generate`
- [ ] Real native pivot tables (openpyxl + pivotCache stitching)
- [ ] Slicer XML emission for advanced layouts
- [ ] Form-control buttons (Excel ActiveX wrappers) for true button groups
- [ ] Google Sheets push-back (write the generated layout into the user's own Sheet)
- [ ] PowerPoint export of the same audit JSON
- [ ] Hindi + regional-language UI mode (Hackknow India focus)
- [ ] CLI (`yai-excel build input.csv --theme=midnight --out report.xlsx`)
- [ ] PWA + Electron desktop build (shared with YAHAVIS AI shell)

---

## Contributing

Pull requests welcome. Open an issue first for anything bigger than a typo.

```bash
git clone https://github.com/gaganchauhan1997/YAI-Excel.git
cd YAI-Excel
git checkout -b feat/your-feature
# …
git commit -m "feat: add lollipop axis tweak"
git push origin feat/your-feature
```

---

## License

[MIT](LICENSE) — do anything, no warranty.

---

## Credits

Built by **[Gagan Chauhan](https://github.com/gaganchauhan1997)** at **[Hackknow](https://hackknow.com)** as part of the **[YAHAVIS AI](https://github.com/gaganchauhan1997/YahavisAI)** ecosystem.

Powered by free-tier intelligence: Gemini · Groq · OpenAI · Anthropic.
Built on the shoulders of: FastAPI · Next.js · openpyxl · pandas · OpenCV · Pillow · Tesseract · Camelot · Pydantic · Framer Motion · Tailwind CSS.

> *Free intelligence, infinite capability.* — Hackknow
