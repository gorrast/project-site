"""
Unit tests for scripts/kivra/supabase_io.py's pure logic. Everything else in
that module needs a live Supabase connection and isn't unit-tested here.

Run with:
    uv run python -m scripts.kivra.tests.test_supabase_io
"""

from __future__ import annotations

from decimal import Decimal

from scripts.kivra.parse import ParsedLine
from scripts.kivra.supabase_io import _resolve_consumers


def test_article_line_uses_its_own_default_consumer():
    lines = [ParsedLine(line_no=1, raw_name="Coca-Cola", line_total=Decimal("24.90"))]
    resolved = _resolve_consumers(lines, {"Coca-Cola": "shared"}, "Hugo")
    assert resolved == {1: "shared"}


def test_unreviewed_article_line_falls_back_to_buyer():
    lines = [ParsedLine(line_no=1, raw_name="Ny produkt", line_total=Decimal("10.00"))]
    resolved = _resolve_consumers(lines, {}, "Benjamin")
    assert resolved == {1: "Benjamin"}


def test_discount_inherits_parent_consumer_not_its_own():
    # The discount's own raw_name ("Kycklingfär 40kr/st") has a DIFFERENT
    # default_consumer than its parent product ("*Kycklingfärs") — the
    # discount must follow the parent, not its own row.
    lines = [
        ParsedLine(line_no=1, raw_name="*Kycklingfärs", line_total=Decimal("223.72")),
        ParsedLine(
            line_no=2,
            raw_name="Kycklingfär 40kr/st",
            line_total=Decimal("-63.72"),
            applies_to_line_no=1,
        ),
    ]
    default_consumers = {
        "*Kycklingfärs": "shared",
        "Kycklingfär 40kr/st": "Hugo",  # deliberately different — must be ignored
    }
    resolved = _resolve_consumers(lines, default_consumers, "Hugo")
    assert resolved == {1: "shared", 2: "shared"}


def test_discount_inherits_buyer_when_parent_unreviewed():
    lines = [
        ParsedLine(line_no=1, raw_name="Ny produkt", line_total=Decimal("30.00")),
        ParsedLine(line_no=2, raw_name="Rabatt text", line_total=Decimal("-5.00"), applies_to_line_no=1),
    ]
    # Parent has no default (absent from default_consumers), discount's own
    # raw_name happens to already be classified — must still inherit the
    # parent's resolved value (the buyer fallback), not its own default.
    resolved = _resolve_consumers(lines, {"Rabatt text": "shared"}, "Benjamin")
    assert resolved == {1: "Benjamin", 2: "Benjamin"}


def test_multiple_products_each_with_their_own_discount():
    lines = [
        ParsedLine(line_no=1, raw_name="Coca-Cola", line_total=Decimal("24.90")),
        ParsedLine(line_no=2, raw_name="Pant", line_total=Decimal("2.00"), applies_to_line_no=1),
        ParsedLine(line_no=3, raw_name="Bacon", line_total=Decimal("70.00")),
        ParsedLine(line_no=4, raw_name="Bacon 4f50kr", line_total=Decimal("-20.00"), applies_to_line_no=3),
    ]
    default_consumers = {"Coca-Cola": "shared", "Bacon": "Benjamin"}
    resolved = _resolve_consumers(lines, default_consumers, "Hugo")
    assert resolved == {1: "shared", 2: "shared", 3: "Benjamin", 4: "Benjamin"}


if __name__ == "__main__":
    test_article_line_uses_its_own_default_consumer()
    test_unreviewed_article_line_falls_back_to_buyer()
    test_discount_inherits_parent_consumer_not_its_own()
    test_discount_inherits_buyer_when_parent_unreviewed()
    test_multiple_products_each_with_their_own_discount()
    print("All supabase_io.py tests passed.")
