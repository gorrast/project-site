# CLAUDE.md

Project-specific conventions for working in this repo.

## Python API structure on Vercel

This repo deploys its backend as Python serverless functions on Vercel. There is exactly **one** Vercel Python function: `api/index.py`, which defines the single `FastAPI` `app` instance. Keep it that way.

**Why one function, not one per feature**: each top-level file under `api/` that defines its own `app = FastAPI()` becomes an independent Vercel serverless function — separate cold start, separate dependency install, separate `vercel.json` rewrite rule, and no shared exception handlers/middleware unless duplicated. That's real, unwanted complexity. A single shared `app` avoids all of it.

**How to add a new feature's routes without turning `api/index.py` into a monolith**: put them in their own module as a `fastapi.APIRouter`, and `include_router()` it into the single `app`. This gives file-level separation (nothing blended together) with zero deployment cost — it's still one function.

```python
# api/<feature>.py
from fastapi import APIRouter
router = APIRouter(prefix="/api/<feature>")

@router.get("/thing")
def get_thing():
    ...
```

```python
# api/index.py, near the bottom (see import-order note below)
from .<feature> import router as <feature>_router
app.include_router(<feature>_router)
```

Then add a matching rewrite in `vercel.json`:
```json
{ "source": "/api/<feature>/:path*", "destination": "/api/index" }
```

**Shared helpers (Supabase clients, etc.) live in `api/clients.py`**, not in `api/index.py`. Feature route modules and `api/index.py` both import from `api/clients.py`. Do not duplicate `anon_client()`/`admin_client()` into a new feature module, and do not import them from `api/index.py` or from the `api` package's `__init__.py` — import directly from `api.clients`.

**Why the clients live in their own module, not in `index.py`**: `api/__init__.py` re-exports `admin_client`/`anon_client` (so standalone scripts can do `from api import anon_client`). If those names were defined in `api/index.py` instead, importing any feature router module from `index.py` creates a circular import — `api/__init__.py` → `api/index.py` → feature module → (if it imports back from `api` or `api.index`) → `api/index.py` again, partially initialized. This bit us once already (Vercel's Python module loader surfaced it as `ImportError: cannot import name 'admin_client' from 'api.index'`; a plain local `python -c "from api.index import app"` did *not* reproduce it — only `vercel dev`'s actual loader did, so don't trust a passing local import alone as proof this class of bug is absent). Routing all Supabase client access through `api/clients.py`, which nothing else in `api/` depends on, removes the cycle entirely rather than just reordering imports around it.

**Standalone scripts** (e.g. `scripts/*.py`) that need Supabase access should do `from api import anon_client, admin_client` — this stays lightweight (just `api/clients.py`) and does not pull in FastAPI or route registration, as long as `api/__init__.py` keeps re-exporting from `.clients` rather than `.index`.

This pattern generalizes beyond this repo: for any Vercel Python deployment, prefer one shared `app` + per-feature `APIRouter` modules over multiple `api/*.py` files each with their own `app`. Reach for genuinely separate Vercel functions only when you need independent scaling, timeout, or runtime config per route group — not a default choice.
