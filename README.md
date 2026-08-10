# project-site

Hugo Wigh's personal site — a small collection of side projects and tools. The live site is at **[wigh.nu](https://wigh.nu)**.

## Pages

- **`/`** — Home: an overview of the projects hosted here.
- **`/bluebaycup`** — Blue Bay Cup: a tracker for a private Fantasy Premier League mini-league. Fetches gameweek data from the FPL API and shows season standings, overall multi-season rankings, prize money splits, and a luck-factor stat. Includes an admin panel at `/bluebaycup/admin` for entering gameweek results and managing seasons/players.
- **`/playpilot`** — PlayPilot Compare: looks up and compares ratings data from PlayPilot profiles.

## Stack

- **Frontend:** Next.js (App Router), React, Tailwind — deployed on Vercel.
- **Backend:** split by runtime needs —
  - `/api/playpilot/*` is a Next.js (TypeScript) Edge route. It needs the Edge runtime specifically to rotate through regions when scraping PlayPilot, since non-edge requests get rejected; it also streams live retry progress to the client over SSE.
  - `/api/bluebaycup/*` and `/api/todos` are served by a Python FastAPI app (`api/index.py`), routed there via `vercel.json` rewrites.
- **Database:** Supabase (Postgres).

## Development

Frontend-only, fast iteration — but note that `/api/bluebaycup/*` and `/api/todos` will 404 here, since those routes live in the Python function and plain `next dev` doesn't apply `vercel.json` rewrites:

```bash
npm run dev
```

Full stack, matching production routing (Next.js + the Python function + rewrites, all on one port):

```bash
npm run dev:vercel
```

First run needs the project linked to a Vercel account: `npx vercel login`, then `npm run dev:vercel` (it will prompt to link/create the project).

### Python backend setup

Dependencies are managed with [uv](https://docs.astral.sh/uv/):

```bash
uv sync
```

This creates `.venv` and installs everything from `uv.lock`. Run scripts with `uv run`, e.g. `uv run scripts/bluebaycup_update.py`.

Point your editor's Python interpreter at `.venv/bin/python` (VS Code users: already configured via `.vscode/settings.json`).

## Database (Supabase)

Schema (see `lib/supabase/database_schema.png` for a diagram):

- `players` — `player_id`, `name`
- `seasons` — `season_id`, `year`, `prize_pool`, `high_score_prize`
- `teams` — `team_id`, `player_id` (FK), `season_id` (FK), `team_name`
- `team_stats` — `team_id` (FK), `gameweek`, `rank`, `total_points`, `wins`, `draws`, `losses`, `points_for`, `points_against`
- `admin_credentials` — `username`, `password_hash`, `salt` (BlueBayCup admin panel login)

Required environment variables (`.env`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — used by admin routes; bypasses RLS
- `ADMIN_SESSION_SECRET` — HMAC secret for signing admin session cookies

To seed an admin login, run `node scripts/create-admin-credentials.mjs <username> <password>` and execute the printed SQL in the Supabase SQL editor.

---

For the live version of this site, visit **[wigh.nu](https://wigh.nu)**.
