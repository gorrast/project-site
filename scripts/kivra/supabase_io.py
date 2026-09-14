"""
Supabase persistence for the ICA Kivra importer. Talks to the `ica` schema
(docs/ica-schema.sql) via the existing admin_client() (service_role key,
bypasses RLS).

Approximates handoff §7.7's "one receipt = one transaction" at the
application level, since supabase-py/PostgREST has no multi-table
transaction primitive: the receipt row is inserted first, then its lines; on
any failure after the receipt row exists, the receipt row is deleted (its
`on delete cascade` FK cleans up any lines already inserted) before
re-raising. This leaves one narrow gap — a hard process kill between the
line insert and the compensating delete could leave a partial receipt that
the next run's idempotency check (`receipt_exists`) would then skip as a
false duplicate — accepted as a known limitation rather than adding a
Postgres RPC function for true atomicity, since the schema is deliberately
kept to three tables and nothing derived (handoff §13).
"""

from __future__ import annotations

from .parse import ParsedLine, ParsedReceipt

SCHEMA = "ica"


def _resolve_consumers(
    lines: list[ParsedLine], default_consumers: dict[str, str | None], buyer: str
) -> dict[int, str]:
    """
    Resolves each line's consumer, keyed by its local line_no. Every line
    gets a real value now — never NULL — since the app no longer computes a
    live fallback chain at read time (see api/ica_tracking.py's
    `line_consumer()`); `receipt_lines.consumer` is the sole source of truth
    for a line's consumer from the moment it's written.

    An article line resolves to `products.default_consumer` for its
    raw_name if one is set, otherwise the receipt's buyer.

    A discount/deposit line (applies_to_line_no set) always inherits its
    parent product line's *resolved* consumer, rather than an independent
    lookup against its own raw_name — a discount belongs to whoever the
    product it discounts belongs to, not to whatever default_consumer
    happens to be set on that discount's own (often one-off) raw_name.
    `applies_to_line_no` only ever points to a plain article line (never
    chains through another discount), so this is a single-level lookup, not
    recursive.
    """
    resolved: dict[int, str] = {}
    for line in lines:
        if line.applies_to_line_no is None:
            resolved[line.line_no] = default_consumers.get(line.raw_name) or buyer
    for line in lines:
        if line.applies_to_line_no is not None:
            resolved[line.line_no] = resolved[line.applies_to_line_no]
    return resolved


def receipt_exists(client, kivra_id: str) -> bool:
    resp = (
        client.schema(SCHEMA)
        .table("receipts")
        .select("id")
        .eq("kivra_id", kivra_id)
        .limit(1)
        .execute()
    )
    return len(resp.data) > 0


def upsert_products(client, raw_names: set[str]) -> None:
    """Inserts rows for raw_names not yet in ica.products. On conflict, does
    nothing — display_name/category/default_consumer are human-curated and
    must never be overwritten by an import (handoff §7.4)."""
    if not raw_names:
        return
    rows = [{"raw_name": name} for name in sorted(raw_names)]
    client.schema(SCHEMA).table("products").upsert(
        rows, on_conflict="raw_name", ignore_duplicates=True
    ).execute()


def get_default_consumers(client, raw_names: set[str]) -> dict[str, str | None]:
    """Returns {raw_name: default_consumer} only for raw_names that already
    exist in ica.products. Absent keys mean the product doesn't exist yet."""
    if not raw_names:
        return {}
    resp = (
        client.schema(SCHEMA)
        .table("products")
        .select("raw_name,default_consumer")
        .in_("raw_name", sorted(raw_names))
        .execute()
    )
    return {row["raw_name"]: row["default_consumer"] for row in resp.data}


def import_receipt(client, parsed: ParsedReceipt, buyer: str, *, excluded: bool = False) -> dict:
    """
    Writes one receipt, its products, and its lines.

    - `excluded` is set once, here, at import time — typically from an
      automatic card-number check in cli.py (see config.get_ica_card_last4)
      — and is never touched again by a later import of the same receipt
      (receipts are only ever inserted once; see handoff §7.2). It stays
      human-editable afterward in Supabase like any other `excluded` value.
    - Freezes `consumer` on each article line from `products.default_consumer`
      at import time, falling back to `buyer` when no default is set yet —
      every line gets a real value, never NULL (handoff §7.5, as amended: see
      scripts/kivra/NOTICE.md). A discount/deposit line inherits its parent
      article's resolved consumer instead of its own independent lookup (see
      _resolve_consumers).
    - Article lines are inserted first, then discount lines, with
      `applies_to_line_id` resolved from the article insert's generated ids
      via each line's local `line_no` (handoff §7.6).

    Returns {"lines": int, "new_products": int}.
    """
    raw_names = {line.raw_name for line in parsed.lines}
    existing_consumers = get_default_consumers(client, raw_names)
    new_names = raw_names - set(existing_consumers)
    if new_names:
        upsert_products(client, new_names)
    default_consumers = {**{name: None for name in new_names}, **existing_consumers}
    line_consumers = _resolve_consumers(parsed.lines, default_consumers, buyer)

    receipt_resp = (
        client.schema(SCHEMA)
        .table("receipts")
        .insert(
            {
                "kivra_id": parsed.kivra_id,
                "purchased_at": parsed.purchased_at.isoformat(),
                "buyer": buyer,
                "store": parsed.store,
                "total": str(parsed.total),
                "excluded": excluded,
                "raw_payload": parsed.raw_payload,
            }
        )
        .execute()
    )
    receipt_id = receipt_resp.data[0]["id"]

    try:
        article_lines = [l for l in parsed.lines if l.applies_to_line_no is None]
        discount_lines = [l for l in parsed.lines if l.applies_to_line_no is not None]

        def _row(line):
            return {
                "receipt_id": receipt_id,
                "line_no": line.line_no,
                "raw_name": line.raw_name,
                "quantity": str(line.quantity) if line.quantity is not None else None,
                "line_total": str(line.line_total),
                "consumer": line_consumers.get(line.line_no),
            }

        inserted_articles = []
        if article_lines:
            inserted_articles = (
                client.schema(SCHEMA)
                .table("receipt_lines")
                .insert([_row(l) for l in article_lines])
                .execute()
                .data
            )

        if discount_lines:
            line_no_to_id = {row["line_no"]: row["id"] for row in inserted_articles}
            discount_rows = []
            for line in discount_lines:
                row = _row(line)
                row["applies_to_line_id"] = line_no_to_id.get(line.applies_to_line_no)
                discount_rows.append(row)
            client.schema(SCHEMA).table("receipt_lines").insert(discount_rows).execute()

        return {
            "lines": len(article_lines) + len(discount_lines),
            "new_products": len(new_names),
        }

    except Exception:
        client.schema(SCHEMA).table("receipts").delete().eq("id", receipt_id).execute()
        raise
