# project-site

Hugo Wigh's personal site — a small collection of side projects and tools. The live site is at **[wigh.nu](https://wigh.nu)**.

## Shared stack

- **Frontend:** Next.js (App Router), React, Tailwind, shadcn/ui components (`components/ui/`), Recharts for charts. Deployed on Vercel.
- **Backend:** one Python FastAPI app (`api/index.py`) running as a single Vercel function. Each project's routes live in their own module and are routed there via `vercel.json` rewrites.
- **Database:** Supabase (Postgres). Client helpers: `api/clients.py` (Python) and `lib/supabase/` (TypeScript).
- **Scheduled jobs:** GitHub Actions (`.github/workflows/`) running Python scripts with uv.

Each page lives in `app/<project>/` and is a thin wrapper around its component folder in `components/<project>/`.

## Projects

### Blue Bay Cup — `/bluebaycup`

A tracker for a private Fantasy Premier League mini-league: season standings, multi-season rankings, head-to-head records, prize money splits and a luck-factor stat. An admin panel at `/bluebaycup/admin` handles gameweek results, seasons and players.

- **Stack:** Next.js frontend, FastAPI backend, Supabase, daily GitHub Actions sync from the FPL API.
- **Frontend:** `components/bluebaycup/`, `app/bluebaycup/` (incl. `admin/`)
- **API:** `/api/bluebaycup/*` in `api/index.py`; admin login in `api/admin_auth.py`
- **Data sync:** `scripts/bluebaycup_update.py`, run by `.github/workflows/bluebaycup-update.yml`
- **Schema:** `lib/supabase/database_schema.png`

### FPL Predictions — `/fpl-pred`

Predicted Fantasy Premier League points per player, shown on a pitch view and in a sortable table, with league team rosters and availability.

- **Stack:** LightGBM model trained on FPL stats and bookmaker odds (pandas, scikit-learn), FastAPI backend, Supabase, Next.js frontend.
- **Frontend:** `components/fpl-pred/`, `lib/fpl/config.ts`
- **API:** `/api/fpl/*` in `api/fpl.py`
- **Pipeline:** `pipeline/` — season sync, odds sync, feature computation, then `train_and_predict.py`. Runs daily via `.github/workflows/fpl-scheduled-update.yml`; one-off backfills have their own `fpl-backfill-*.yml` workflows. Pipeline libraries are in the `pipeline` uv dependency group so they stay out of the Vercel function.
- **Schema & design notes:** `docs/schemas/fpl-schema.sql`, `docs/handoffs/fpl-*.md`

### PlayPilot Compare — `/playpilot`

Looks up and compares movie and TV ratings between PlayPilot profiles.

- **Stack:** Next.js only — a TypeScript route handler, no Python or database.
- **Frontend:** `components/playpilot/`
- **API:** `app/api/playpilot/ratings/route.ts`, with scraping logic in `lib/playpilot/`. It runs on the Edge runtime so it can rotate through regions (non-edge requests get rejected by PlayPilot), and streams retry progress to the client over SSE.

### Food Expenses — `/ica-tracking`

Tracks shared grocery spending from ICA receipts: monthly breakdowns, per-person budget shares, product trends and reports. Behind a login.

- **Stack:** Next.js frontend, FastAPI backend, Supabase (`ica` schema), local Python importer.
- **Frontend:** `components/ica-tracking/` (data hooks in `hooks/`)
- **API:** `/api/ica-tracking/*` in `api/ica_tracking.py`
- **Importer:** `scripts/kivra/` pulls receipts from Kivra via BankID. It runs locally only and is excluded from deploys (`.vercelignore`).
- **Schema & design notes:** `docs/schemas/ica-schema.sql`, `docs/handoffs/ica-kivra-importer-handoff.md`, `docs/verify.md`
