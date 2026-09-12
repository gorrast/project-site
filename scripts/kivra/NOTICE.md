# NOTICE

The code under `scripts/kivra/vendor/` is vendored from:

- **Upstream repository**: https://github.com/felixandersen/kivra-sync
- **License**: MIT (see `scripts/kivra/LICENSE`, copied verbatim)
- **Tag**: `v1.1.2`
- **Commit**: `bcbcc0366bae96dd2273c25975773cdffd71d47a`

Everything outside `scripts/kivra/vendor/` (`cli.py`, `config.py`, `parse.py`,
`supabase_io.py`, `queries.sql`, this file) is original code written for this project, not
derived from upstream.

## What was copied

| Upstream path | Vendored as | Notes |
|---|---|---|
| `kivra/api.py` | `vendor/kivra/api.py` | Verbatim, no changes |
| `kivra/auth.py` | `vendor/kivra/auth.py` | Verbatim, no changes |
| `kivra/models.py` | `vendor/kivra/models.py` | Verbatim, no changes |
| `kivra/__init__.py` | `vendor/kivra/__init__.py` | Verbatim, empty |
| `utils/helpers.py` | `vendor/utils/helpers.py` | Verbatim, no changes |
| `interaction/base.py` | `vendor/interaction/base.py` | Verbatim, no changes |
| `interaction/web.py` | `vendor/interaction/web.py` | One import rewritten, see below |
| `interaction/web_static/*` | `vendor/interaction/web_static/*` | Verbatim |
| `LICENSE` | `scripts/kivra/LICENSE` | Verbatim |

## What was deliberately not copied, and why

- **`kivra/letters.py`** — Kivra "letters" (non-receipt documents) are out of scope for this
  project, which only imports ICA grocery receipts.
- **`kivra/receipts.py`** — tightly coupled to upstream's `storage.DocumentStoreProvider`
  abstraction (`report_listing`/`exists`/`store`/`report_metadata`), which we don't reuse since
  persistence goes to Supabase instead of upstream's filesystem/paperless-ngx storage backends.
  Its list-then-fetch-detail loop and GraphQL variables were read as a reference and
  reimplemented directly against `KivraApiClient.graphql_query` in `cli.py`.
- **`utils/pdf.py`** — only used by upstream's `storage/filesystem.py` and `storage/paperless.py`
  (neither vendored) to render Kivra letters from HTML to PDF via `weasyprint`. Receipts are
  fetched as structured JSON (`RECEIPT_DETAILS_QUERY`), not rendered PDFs, so this file and the
  `weasyprint` dependency are never needed. Note: importing this module also has a module-level
  side effect (opens `./weasyprint.log` via a `logging.FileHandler`) that we avoid entirely by
  not importing it.
- **`storage/*`** — replaced entirely by `scripts/kivra/supabase_io.py`.
- **`interaction/local.py`** — opens the BankID QR in the OS's default image viewer and does not
  support auto-refresh (BankID's animated QR rotates every second). `interaction/web.py` (a
  small stdlib-only local HTTP server + Server-Sent Events, no npm/node dependency) supports
  auto-refresh via a browser tab, so it was used instead for the shipped CLI.
- **`interaction/ntfy.py`** — headless/remote triggering via a push-notification service, out of
  scope (this project only runs the importer interactively, never on a schedule or trigger).
- **`Dockerfile`, `docker-compose.yml`, `flake.nix`, `flake.lock`, `.github/workflows/`** — the
  Python code here must never be deployed or containerized independently; it shares this repo's
  existing uv-managed virtualenv and is excluded from the Vercel deploy via `.vercelignore`.
- **`package.json`, `package-lock.json`** — confirmed to be unrelated `semantic-release`
  tooling for upstream's own CI versioning, not a runtime dependency of any vendored code.

## Local modifications

- `interaction/web.py`: `from interaction.base import InteractionProvider` was rewritten to
  `from .base import InteractionProvider` so the module resolves correctly when nested three
  levels deep under `scripts/kivra/vendor/interaction/` instead of living at upstream's
  repository root. No `sys.path` manipulation was used anywhere.

## Upgrade path

If Kivra changes its API and upstream fixes it, diff the relevant file(s) under
`scripts/kivra/vendor/` against the commit above in the upstream repository to see exactly what
changed, then re-apply the same local modifications listed here to the updated file.
