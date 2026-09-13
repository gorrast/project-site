"""
CLI for importing ICA grocery receipts from Kivra into the `ica` Supabase
schema (docs/ica-schema.sql). See docs/verify.md for how to run and check
this end to end, and docs/ica-kivra-importer-handoff.md for the full spec.

Every invocation, including --dry-run, authenticates fresh via BankID —
Kivra has no long-lived session, so there is nothing to cache.

Every receipt in the Kivra inbox is imported, regardless of store — there is
no longer a sender/store filter (deliberate change from the original spec's
"ICA sender only" design; see the DEPARTURES note in NOTICE.md). Instead,
receipts.excluded is set automatically based on config.get_ica_card_last4()
(env var ICA_CARD_LAST4) — a best-effort scan of the receipt's payment
terminal dump, since Kivra exposes no clean card field — so whether a
purchase counts toward the shared account is decided by which card paid for
it, not which store it was at. Nothing is silently dropped; excluded stays
human-editable afterward like any other import. Since parse.py was only
validated against ICA's receipt shape, expect more [warn]/[reconcile] lines
from other stores until their shapes are seen and confirmed too.

Usage (from the repo root):

    uv run python -m scripts.kivra.cli --person Hugo [options]

    --person {Hugo,Benjamin}   required; selects the pnr and sets buyer
    --max-receipts N           default 0 (unlimited); stop after N imported
    --since YYYY-MM-DD         stop at receipts purchased before this date;
                                defaults to config.get_import_cutoff_date()
                                (env var ICA_IMPORT_CUTOFF_DATE) when omitted
    --dry-run                  fetch and parse, print summary, write nothing
    --dump-raw DIR             also write each fetched receipt's raw JSON to DIR

Both --since and its config default assume the receipt list comes back
newest-first (true in every run observed so far, but not something the
GraphQL query guarantees) — once a receipt older than the cutoff is hit, the
scan stops entirely rather than skipping past it, since everything after it
is expected to be older still. A log line always announces this so it's
never a silent assumption.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import threading
import time
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from tqdm import tqdm

from . import config, parse, supabase_io
from .vendor.interaction.web import WebInteractionProvider
from .vendor.kivra.api import KivraApiClient
from .vendor.kivra.auth import KivraAuth
from .vendor.kivra.models import RECEIPT_DETAILS_QUERY, RECEIPTS_QUERY

RECONCILIATION_TOLERANCE = Decimal("0.01")


def _postfix(stats: dict) -> dict:
    """Trimmed live counters for the progress bar's postfix — the full
    stats dict is still printed in the final report."""
    return {
        "imported": stats["imported"],
        "dup": stats["skipped_duplicate"],
        "excluded": stats["excluded"],
    }


def _wait_for_server(provider: WebInteractionProvider, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while provider.server is None:
        if time.monotonic() > deadline:
            sys.exit("Web interaction server did not start in time")
        time.sleep(0.05)


def _authenticate(pnr: str, temp_dir: str) -> tuple[KivraApiClient, WebInteractionProvider]:
    """
    Authenticates via BankID using the vendored WebInteractionProvider, whose
    browser-based QR display auto-refreshes (BankID's QR rotates every
    second; upstream's `local` provider doesn't support this — see
    scripts/kivra/NOTICE.md).

    WebInteractionProvider.listen() only calls its callback in response to a
    browser POST to /trigger — i.e. someone clicking a button on the page.
    We don't want the CLI to depend on that click happening: instead we
    start its HTTP server in a background thread purely so the QR/progress
    can optionally be watched in a browser, and drive the actual
    authentication synchronously from the main thread ourselves. The
    `callback` passed to `listen()` is therefore never actually invoked.
    """
    provider = WebInteractionProvider()

    def _unused_trigger_callback() -> None:
        pass  # never invoked; see docstring above

    server_thread = threading.Thread(
        target=provider.listen,
        args=(_unused_trigger_callback,),
        kwargs={"temp_dir": temp_dir},
        daemon=True,
    )
    server_thread.start()
    _wait_for_server(provider)

    print(f"\nOpen http://127.0.0.1:{provider.port} in a browser to watch the QR code.")
    print("Waiting for BankID authentication...")

    auth = KivraAuth(temp_dir, provider)
    try:
        token_info = auth.authenticate(pnr)
    finally:
        # auth.authenticate() already removes its own qr_temp_path once
        # authentication completes, but WebInteractionProvider.display_qr_code
        # copies each refreshed frame to a second path (provider.qr_path) for
        # the browser to fetch, which it never cleans up itself. Both files
        # live inside `temp_dir` and would be deleted anyway once the CLI's
        # `with tempfile.TemporaryDirectory()` block exits, but there's no
        # reason to keep the QR image on disk for the rest of the run once
        # we're done with it — remove it now, success or failure.
        if provider.qr_path:
            try:
                os.remove(provider.qr_path)
            except OSError:
                pass

    return KivraApiClient(token_info["access_token"], token_info["actor_key"]), provider


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Import ICA receipts from Kivra into Supabase.")
    p.add_argument("--person", required=True, choices=sorted(config.PERSON_PNR_ENV))
    p.add_argument("--max-receipts", type=int, default=0, help="0 = unlimited")
    p.add_argument("--since", type=str, default=None, metavar="YYYY-MM-DD")
    p.add_argument("--dry-run", action="store_true", help="fetch and parse only, write nothing")
    p.add_argument("--dump-raw", type=Path, default=None, metavar="DIR")
    return p


def main(argv: list[str] | None = None) -> None:
    args = build_arg_parser().parse_args(argv)
    pnr, buyer = config.get_person_config(args.person)

    since: date | None
    if args.since:
        since = datetime.strptime(args.since, "%Y-%m-%d").date()
    else:
        since = config.get_import_cutoff_date()

    client = config.get_client()
    allowed_cards = config.get_ica_card_last4()

    stats = {
        "seen": 0,
        "skipped_duplicate": 0,
        "skipped_before_since": 0,
        "imported": 0,
        "excluded": 0,
        "lines_imported": 0,
        "new_products": 0,
        "reconciliation_failures": 0,
    }

    with tempfile.TemporaryDirectory(prefix="kivra-cli-") as temp_dir:
        api_client, provider = _authenticate(pnr, temp_dir)

        print("\nFetching receipt list...")
        list_response = api_client.graphql_query(
            "Receipts", RECEIPTS_QUERY, {"limit": 20000, "offset": 0, "search": None}
        )
        receipt_list = list_response.get("data", {}).get("receiptsV2", {}).get("list", [])
        print(f"Found {len(receipt_list)} receipts across all senders.")

        total = len(receipt_list)
        if args.max_receipts:
            total = min(total, args.max_receipts)

        with tqdm(total=total, desc="Receipts", unit="receipt") as pbar:
            log = pbar.write  # clears the bar, prints the line, redraws — never garbles it

            for entry in receipt_list:
                if args.max_receipts and stats["seen"] >= args.max_receipts:
                    break

                stats["seen"] += 1
                pbar.update(1)
                kivra_id = entry["key"]

                if supabase_io.receipt_exists(client, kivra_id):
                    stats["skipped_duplicate"] += 1
                    pbar.set_postfix(_postfix(stats), refresh=False)
                    continue

                detail = api_client.graphql_query(
                    "ReceiptDetails", RECEIPT_DETAILS_QUERY, {"key": kivra_id}
                )

                if args.dump_raw:
                    args.dump_raw.mkdir(parents=True, exist_ok=True)
                    (args.dump_raw / f"{kivra_id}.json").write_text(
                        json.dumps(detail, indent=2, ensure_ascii=False), encoding="utf-8"
                    )

                store_hint = (entry.get("store") or {}).get("name")
                parsed = parse.parse_receipt(detail, store_hint=store_hint)

                if since and parsed.purchased_at.date() < since:
                    stats["skipped_before_since"] += 1
                    log(
                        f"Receipt {kivra_id} was purchased {parsed.purchased_at.date()}, "
                        f"before the cutoff {since} — stopping here (assumes the receipt "
                        "list is newest-first; anything after this point is expected to "
                        "be older still)."
                    )
                    break

                for warning in parsed.warnings:
                    log(f"  [warn] receipt {kivra_id}: {warning}")

                diff = abs(parsed.line_total_sum - parsed.total)
                if diff > RECONCILIATION_TOLERANCE:
                    stats["reconciliation_failures"] += 1
                    log(
                        f"  [reconcile] receipt {kivra_id}: lines sum to "
                        f"{parsed.line_total_sum}, receipt total is {parsed.total} "
                        f"(diff {diff})"
                    )

                card_digits = parse.get_card_last4_digits(detail)
                excluded = not (card_digits & allowed_cards)
                if not card_digits:
                    log(
                        f"  [warn] receipt {kivra_id}: could not detect any card number "
                        "in payment info — defaulting excluded=true"
                    )
                elif excluded:
                    log(
                        f"  [card] receipt {kivra_id}: card(s) ending {sorted(card_digits)} "
                        "not in ICA_CARD_LAST4 — excluded=true"
                    )

                if args.dry_run:
                    log(
                        f"\n[dry-run] receipt {kivra_id} ({parsed.store}, "
                        f"{parsed.purchased_at}), total {parsed.total}, excluded={excluded}:"
                    )
                    for line in parsed.lines:
                        qty = f" x{line.quantity}" if line.quantity is not None else ""
                        log(f"    {line.line_no:>3}  {line.raw_name:<40} {line.line_total:>10}{qty}")
                    pbar.set_postfix(_postfix(stats), refresh=False)
                    continue

                result = supabase_io.import_receipt(client, parsed, buyer, excluded=excluded)
                stats["imported"] += 1
                if excluded:
                    stats["excluded"] += 1
                stats["lines_imported"] += result["lines"]
                stats["new_products"] += result["new_products"]
                pbar.set_postfix(_postfix(stats), refresh=False)

        provider.server.shutdown()

    print("\n--- Report ---")
    for key, value in stats.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
