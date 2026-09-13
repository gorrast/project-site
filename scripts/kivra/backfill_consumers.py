"""
One-time backfill: fills every currently-NULL `ica.receipt_lines.consumer`
with what it currently *resolves to* under the old read-time chain
(`products.default_consumer` for that raw_name, else the receipt's buyer),
then freezes that as a literal value. This is the migration companion to the
importer change in supabase_io.py (`_resolve_consumers` now always fills
`consumer` at write time) and the removal of the live resolution chain from
api/ica_tracking.py — after this runs, `receipt_lines.consumer` is the sole
source of truth for a line's consumer; nothing computes a fallback at read
time anymore.

Article lines: default_consumer for that raw_name if set, else the parent
receipt's buyer. Discount lines (applies_to_line_id set): always inherit
their parent article's *newly computed* value (never their own raw_name's
default) — same rule `_resolve_consumers`/the old `resolve_line` used.

Only rows where `consumer IS NULL` are touched. Anything already set (either
hand-corrected on the site, or already frozen by a past import) is left
exactly as-is.

Usage (from the repo root):
    uv run python -m scripts.kivra.backfill_consumers            # dry run, writes nothing
    uv run python -m scripts.kivra.backfill_consumers --apply    # actually writes

Uses the service_role client (bypasses RLS) via `scripts.kivra.config.get_client()`
— the same helper cli.py uses — rather than importing `admin_client` from `api`
directly, since importing `config` is also what loads `.env.local` (see
config.py's module-level `load_env_file` call); skipping it here would leave
NEXT_PUBLIC_SUPABASE_URL etc. unset when this file is run standalone.
"""

from __future__ import annotations

import argparse
from collections import Counter
from typing import Callable

from . import config

SCHEMA = "ica"
PAGE_SIZE = 1000
WRITE_BATCH_SIZE = 300  # ids per .in_() update — keeps request URLs comfortably small


def _fetch_all(build_query: Callable[[], object], page_size: int = PAGE_SIZE) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        page = build_query().range(offset, offset + page_size - 1).execute().data
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def _chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def compute_backfill(client) -> dict[int, str]:
    """Returns {receipt_line_id: consumer} for every currently-NULL row."""
    # Ordered by each table's actual primary key (unique) so pagination gets
    # a stable total order — never by a non-unique column like line_no,
    # which repeats across receipts and let a first run of this script
    # silently skip rows past the first ~1000-row page (see
    # scripts/kivra/NOTICE.md).
    receipts = _fetch_all(
        lambda: client.schema(SCHEMA).table("receipts").select("id,buyer").order("id")
    )
    lines = _fetch_all(
        lambda: client.schema(SCHEMA)
        .table("receipt_lines")
        .select("id,receipt_id,raw_name,consumer,applies_to_line_id")
        .order("id")
    )
    products = _fetch_all(
        lambda: client.schema(SCHEMA).table("products").select("raw_name,default_consumer").order("raw_name")
    )

    buyer_by_receipt = {r["id"]: r["buyer"] for r in receipts}
    default_by_raw = {p["raw_name"]: p["default_consumer"] for p in products}
    lines_by_id = {l["id"]: l for l in lines}

    updates: dict[int, str] = {}

    # Article lines first — discounts below need their parent's value, which
    # may itself be a freshly-computed update rather than an existing one.
    for line in lines:
        if line["applies_to_line_id"] is not None:
            continue
        if line["consumer"] is not None:
            continue
        buyer = buyer_by_receipt[line["receipt_id"]]
        updates[line["id"]] = default_by_raw.get(line["raw_name"]) or buyer

    for line in lines:
        if line["applies_to_line_id"] is None:
            continue
        if line["consumer"] is not None:
            continue
        parent = lines_by_id.get(line["applies_to_line_id"])
        if parent is None:
            # Orphaned reference — shouldn't happen (FK-enforced), but don't
            # guess; fall back to the receipt's buyer like an article line
            # would if it had no default.
            updates[line["id"]] = buyer_by_receipt[line["receipt_id"]]
            continue
        parent_value = updates.get(parent["id"], parent["consumer"])
        updates[line["id"]] = parent_value

    return updates


def apply_backfill(client, updates: dict[int, str]) -> None:
    by_value: dict[str, list[int]] = {}
    for line_id, consumer in updates.items():
        by_value.setdefault(consumer, []).append(line_id)

    for consumer, ids in by_value.items():
        for chunk in _chunks(ids, WRITE_BATCH_SIZE):
            client.schema(SCHEMA).table("receipt_lines").update({"consumer": consumer}).in_(
                "id", chunk
            ).execute()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="actually write; default is a dry run")
    args = parser.parse_args(argv)

    client = config.get_client()
    updates = compute_backfill(client)

    counts = Counter(updates.values())
    print(f"{len(updates)} receipt_lines rows currently have consumer = NULL.")
    for consumer, n in sorted(counts.items()):
        print(f"  {consumer:<10} {n}")

    if not args.apply:
        print("\nDry run only — nothing written. Re-run with --apply to write these values.")
        return

    print("\nWriting...")
    apply_backfill(client, updates)
    print(f"Done — {len(updates)} rows updated.")


if __name__ == "__main__":
    main()
