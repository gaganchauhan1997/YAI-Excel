# YAI-Excel — Python Reference Implementation

These Python scripts mirror the Cloudflare Worker pipeline so you can:

- **Generate a dashboard locally** without touching the web app
- **Read the algorithm** in 400 lines of Python instead of 1000+ lines of JavaScript
- **Extend the engine** (add a new chart, KPI rule, filter) by editing Python first, then porting back to `worker.js`

## Architecture (70/30 split)

The Worker and these Python scripts apply the same trade-off:

| Layer | What it does | Where the work lives |
|---|---|---|
| **70% deterministic** | CSV parsing, numeric/categorical detection, SUM/AVG/MIN/MAX/GROUP-BY, KPI ranking by impact, chart dim/metric selection, XLSX generation with embedded charts | Pure Python (`yexcel_offline.py`) — no network calls, no AI tokens |
| **30% AI** | Title generation, friendly KPI labels, smart chart titles | One Groq / Gemini call (≤ 1024 tokens). Returns plain JSON. Falls back gracefully when no key is provided. |

This is why your free Groq/Gemini quota stretches far: 95% of CPU work is local, and only the final "polish" call hits an API.

## Files

| File | Purpose |
|---|---|
| `yexcel_offline.py` | Single-file generator. CSV in → XLSX out. Uses `openpyxl`. |
| `requirements.txt` | `openpyxl>=3.1` |

## Quick Start

```bash
pip install -r requirements.txt
python yexcel_offline.py my_data.csv midnight
# → my_data.xlsx
```

Themes: `midnight emerald crimson slate amber ocean violet rose carbon arctic`

## What the Output Contains

1. **Dashboard sheet** — title banner, tab strip, 5 KPI cards with currency / compact / percent formatting, 4 charts (horizontal bar, doughnut, pie, stacked column), left/right filter panels
2. **Data sheet** — raw CSV rows, numeric columns typed as numbers
3. **Excel Tutor sheet** — 6+ lessons that use *your* columns to teach SUM, SUMIFS, XLOOKUP, INDEX/MATCH, UNIQUE, SORT, FILTER, KPI formatting, and keyboard shortcuts

## Why Python AND JavaScript?

The production deployment runs on Cloudflare Workers, which only supports JavaScript. The Python version is identical in logic — same column classification, same KPI ranking, same chart picks — but easier to read, modify, and extend before porting changes back to `worker.js`.

If you fork this project, the recommended workflow is:

1. Sketch the change in `yexcel_offline.py`
2. Run it on a sample CSV until the output looks right
3. Port the logic to `worker.js` (the function names and structure match)
4. Deploy the Worker

## Roadmap

- [ ] `yexcel_analyze_image.py` — Gemini Vision to extract dashboard structure from a screenshot, then generate Excel that matches
- [ ] `yexcel_pivot.py` — generate native PivotTables in the XLSX (openpyxl doesn't support them yet)
- [ ] `yexcel_advanced_charts.py` — combo charts (bar + line), waterfall, funnel
