# Contributing to YAI-Excel

Thanks for wanting to contribute! Here's how the project runs.

## Ground rules

1. **Free-tier first.** Every change must work without paid services. Proposing a paid dependency requires a free alternative path documented alongside it.
2. **The audit JSON is the contract.** Any new feature should be addressable as an audit JSON field consumed by the build pipeline.
3. **Output must always be enterprise-grade.** No matter how poor the input, the workbook must pass the 6 quality gates.
4. **Indian-market awareness.** UI strings need EN + हिं. Financial formatting respects `_indian_format` when set.

## Local setup

```bash
git clone https://github.com/gaganchauhan1997/YAI-Excel.git
cd YAI-Excel
cp .env.example .env  # add at minimum GEMINI_API_KEY

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new shell)
cd ../frontend
npm install
npm run dev
```

## Branching

- `main` is always deployable. Cloudflare Pages + Fly auto-deploy from it.
- Feature branches: `feat/<short-name>`
- Fixes: `fix/<short-name>`
- Refactors: `chore/<short-name>`

## Commits

Conventional commits:
- `feat: add nested-donut chart smoothing`
- `fix: pivot engine ignores null source_range`
- `docs: explain the SUMIFS pivot fallback`
- `chore: bump openpyxl to 3.1.6`

## Tests

```bash
# Backend
cd backend && pytest -q

# Frontend type check + build
cd frontend && npm run build
```

A PR is mergeable only if both pass.

## Skill submissions

If you're adding a new input parser or chart type:

1. Drop the file in the right package (`parsers/`, `excel/`).
2. Wire it into the dispatcher (`detector.py` for parsers; `chart_engine.py._dispatch` for charts).
3. Add a test in `backend/tests/`.
4. Update the README + `docs/api.md`.

## Reviewing

PRs need:
- Green CI (build + tests)
- One review from a maintainer
- Updated docs if behaviour changed
