"""
Configuration and environment loading for the ICA Kivra importer.

Reuses this repo's existing Supabase client (api/clients.py, via api/__init__.py's
re-export) and .env.local loading convention (matching scripts/backfill_opponent_real.py)
rather than introducing a parallel mechanism. Requires being run from the repo root via
`uv run python -m scripts.kivra.cli` (see docs/verify.md) so that both `.env.local` and the
`api` package resolve without any sys.path manipulation.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

PERSON_PNR_ENV = {
    "Hugo": "KIVRA_HUGO_PNR",
    "Benjamin": "KIVRA_BENJAMIN_PNR",
}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(PROJECT_ROOT / ".env.local")


def get_person_config(person: str) -> tuple[str, str]:
    """Returns (pnr, buyer) for the given person ('Hugo' or 'Benjamin'). The
    identity number is read once here and must never be logged or stored — it's
    only ever passed to KivraAuth.authenticate()."""
    env_name = PERSON_PNR_ENV[person]
    pnr = os.environ.get(env_name)
    if not pnr:
        sys.exit(f"{env_name} is not set in .env.local")
    return pnr, person


def get_client():
    """The existing service_role Supabase client (bypasses RLS), from api/clients.py."""
    from api import admin_client

    return admin_client()


def get_ica_card_last4() -> set[str]:
    """
    Last-4 digits of the card(s) that count as "the shared ICA account", used
    to auto-set receipts.excluded (see parse.get_card_last4_digits — there's
    no clean card field, only a best-effort scan of free-text terminal-dump
    output). Comma-separated in ICA_CARD_LAST4; blank/missing entries (e.g. a
    not-yet-filled-in second card) are ignored.

    Note: excluded is frozen at import time and never touched by a re-import
    (same as consumer). Adding a card here only affects receipts imported
    *after* the change — anything already imported under an incomplete list
    needs a manual UPDATE (see docs/verify.md).
    """
    raw = os.environ.get("ICA_CARD_LAST4", "")
    return {part.strip() for part in raw.split(",") if part.strip()}
