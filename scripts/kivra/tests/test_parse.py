"""
Unit tests for scripts/kivra/parse.py, run against redacted fixtures derived
from real ICA receipts (see docs/probe.md for the first one). Fixtures keep
only content.header/content.items/sender/key — the storeInformation and
customer sections (a masked personnummer) were stripped since parse.py
doesn't need them. paymentInformation is now read (get_card_last4_digits),
but its real content isn't fixture-worthy (a real masked card number, even
if partially masked already); test_get_card_last4_digits below uses a
synthetic example matching the real format instead.

No pytest config exists anywhere in this repo (checked), and upstream's own
test_qr_refresh.py is a plain assert-based script run directly — this file
follows that convention rather than introducing a new one.

Run with:
    uv run python -m scripts.kivra.tests.test_parse
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from scripts.kivra.parse import (
    ParseError,
    get_card_last4_digits,
    get_sender_name,
    parse_money,
    parse_receipt,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
FIXTURE_PATH = FIXTURES_DIR / "receipt_product_only.json"
DISCOUNT_FIXTURE_PATH = FIXTURES_DIR / "receipt_with_discounts.json"


def test_parse_money():
    assert parse_money("265,46 kr") == Decimal("265.46")
    assert parse_money("72,37 kr") == Decimal("72.37")
    assert parse_money("1 234,56 kr") == Decimal("1234.56")
    assert parse_money("-72,37 kr") == Decimal("-72.37")
    # Discount amounts use the Unicode MINUS SIGN (U+2212), not ASCII hyphen.
    assert parse_money("−63,72 kr") == Decimal("-63.72")
    try:
        parse_money("not money")
    except ParseError:
        pass
    else:
        raise AssertionError("expected ParseError for unrecognized format")
    try:
        parse_money(None)
    except ParseError:
        pass
    else:
        raise AssertionError("expected ParseError for empty value")


def test_parse_receipt_against_real_fixture():
    detail = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    assert get_sender_name(detail) == "ICA"

    parsed = parse_receipt(detail)

    assert parsed.kivra_id == "26096d0781faaa123f4bb715132551c30a49366f5163"
    # Falls back to content.header.text[0] since no store_hint was given.
    assert parsed.store == "ICA Nära Bergshamra"
    assert parsed.total == Decimal("265.46")
    assert str(parsed.purchased_at) == "2026-09-11 17:37:55+00:00"

    # No unhandled item types, no non-empty deposits/costModifiers, no
    # noBonusItems/returnedItems in this receipt — nothing should warn.
    assert parsed.warnings == [], parsed.warnings

    # 11 product rows in the fixture.
    assert len(parsed.lines) == 11
    assert parsed.line_total_sum == parsed.total

    # Weight-based item: "0,175 kg * 29,90 kr/kg" -> quantity 0.175, line_total 5.23.
    weight_line = next(l for l in parsed.lines if l.raw_name == "Lök röd")
    assert weight_line.quantity == Decimal("0.175")
    assert weight_line.line_total == Decimal("5.23")

    # Ordinary countable item: no quantity captured (schema allows NULL).
    plain_line = next(l for l in parsed.lines if l.raw_name == "Blandfärs 70/30")
    assert plain_line.quantity is None
    assert plain_line.line_total == Decimal("72.37")

    # Duplicate raw_name across two lines (handoff §9: same item scanned
    # twice) — two rows, not merged into one.
    soap_lines = [l for l in parsed.lines if l.raw_name == "HAND SOAP ORIG. SV"]
    assert len(soap_lines) == 2
    assert [l.line_no for l in soap_lines] == sorted(l.line_no for l in soap_lines)


def test_store_hint_overrides_header_text():
    detail = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    parsed = parse_receipt(detail, store_hint="ICA Nara Bergshamra")
    assert parsed.store == "ICA Nara Bergshamra"


def test_unrecognized_item_type_warns_and_is_excluded():
    detail = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    detail["data"]["receiptV2"]["content"]["items"]["allItems"]["items"].append(
        {
            "type": "discount",
            "name": None,
            "money": {"formatted": "-10,00 kr"},
        }
    )
    # A real receipt with this discount would show a lower printed total —
    # simulate that so the mismatch below reflects real behavior, not just
    # an untouched header.
    detail["data"]["receiptV2"]["content"]["header"]["totalPurchaseAmount"] = "255,46 kr"

    parsed = parse_receipt(detail)
    assert len(parsed.warnings) == 1
    assert "discount" in parsed.warnings[0]
    # The unhandled line's money is excluded from `lines`, so the caller's
    # reconciliation check would now visibly flag this receipt rather than
    # silently absorbing the discount — that's the point (handoff §7.8).
    assert parsed.line_total_sum == Decimal("265.46")
    assert parsed.total == Decimal("255.46")
    assert parsed.line_total_sum != parsed.total


def test_parse_receipt_with_discounts():
    detail = json.loads(DISCOUNT_FIXTURE_PATH.read_text(encoding="utf-8"))

    parsed = parse_receipt(detail)

    assert parsed.total == Decimal("327.04")
    assert parsed.warnings == [], parsed.warnings
    # 9 products + 3 cost-modifier discount lines.
    assert len(parsed.lines) == 12
    assert parsed.line_total_sum == parsed.total

    chicken = next(l for l in parsed.lines if l.raw_name == "*Kycklingfärs")
    assert chicken.quantity == Decimal("4")  # "4 st * 55,93 kr/st"
    assert chicken.line_total == Decimal("223.72")
    assert chicken.applies_to_line_no is None

    discount = next(l for l in parsed.lines if l.raw_name == "Kycklingfär 40kr/st")
    assert discount.line_total == Decimal("-63.72")
    assert discount.applies_to_line_no == chicken.line_no

    # Sum of all discount lines should match the receipt's printed
    # "Totalrabatt 91,34 kr".
    discount_lines = [l for l in parsed.lines if l.applies_to_line_no is not None]
    assert len(discount_lines) == 3
    assert -sum((l.line_total for l in discount_lines), Decimal("0")) == Decimal("91.34")


def test_parse_receipt_with_deposit():
    # Synthetic (a real "Coca-Cola" + "Pant" example confirmed this shape
    # against a real receipt, but its data isn't fixture-worthy on its own).
    # A deposit is a POSITIVE additional charge, not a discount: no minus
    # sign, isRefund false — unlike a costModifier.
    detail = {
        "data": {
            "receiptV2": {
                "key": "test-deposit",
                "content": {
                    "header": {
                        "totalPurchaseAmount": "26,90 kr",
                        "isoDate": "2026-01-01T12:00:00Z",
                        "text": ["Test Store"],
                    },
                    "items": {
                        "allItems": {
                            "items": [
                                {
                                    "type": "product",
                                    "name": "Coca-Cola",
                                    "money": {"formatted": "24,90 kr"},
                                    "quantityCost": None,
                                    "deposits": [
                                        {
                                            "description": "Pant",
                                            "money": {"formatted": "2,00 kr"},
                                            "isRefund": False,
                                        }
                                    ],
                                    "costModifiers": [],
                                }
                            ]
                        },
                        "noBonusItems": {"items": []},
                        "returnedItems": {"items": []},
                    },
                },
                "sender": {"name": "ICA"},
            }
        }
    }

    parsed = parse_receipt(detail)

    assert parsed.warnings == [], parsed.warnings
    assert parsed.line_total_sum == parsed.total == Decimal("26.90")
    assert len(parsed.lines) == 2

    cola = next(l for l in parsed.lines if l.raw_name == "Coca-Cola")
    pant = next(l for l in parsed.lines if l.raw_name == "Pant")
    assert cola.line_total == Decimal("24.90")
    assert pant.line_total == Decimal("2.00")
    # Linked to its parent product, like a costModifier discount would be —
    # even though it's a positive charge, not a discount (see parse.py's
    # module docstring for why this diverges from the schema's own wording).
    assert pant.applies_to_line_no == cola.line_no


def test_parse_receipt_with_general_deposit():
    # Synthetic, matching a real confirmed example: a top-level pant RETURN
    # (GeneralDepositListItem), not nested under any product — the customer
    # returned empty bottles/cans for a refund. Negative money, isRefund
    # true, has `description` but no `name`, and is not linked to any
    # specific product line.
    detail = {
        "data": {
            "receiptV2": {
                "key": "test-general-deposit",
                "content": {
                    "header": {
                        "totalPurchaseAmount": "15,90 kr",
                        "isoDate": "2026-01-01T12:00:00Z",
                        "text": ["Test Store"],
                    },
                    "items": {
                        "allItems": {
                            "items": [
                                {
                                    "type": "product",
                                    "name": "Ostbågar",
                                    "money": {"formatted": "28,90 kr"},
                                    "quantityCost": None,
                                    "deposits": [],
                                    "costModifiers": [],
                                },
                                {
                                    "type": "general_deposit",
                                    "text": ["Pantretur, hög moms"],
                                    "description": "Pant",
                                    "money": {"formatted": "−13,00 kr"},
                                    "isRefund": True,
                                },
                            ]
                        },
                        "noBonusItems": {"items": []},
                        "returnedItems": {"items": []},
                    },
                },
                "sender": {"name": "ICA"},
            }
        }
    }

    parsed = parse_receipt(detail)

    assert parsed.warnings == [], parsed.warnings
    assert parsed.line_total_sum == parsed.total == Decimal("15.90")
    assert len(parsed.lines) == 2

    pant_return = next(l for l in parsed.lines if l.raw_name == "Pant")
    assert pant_return.line_total == Decimal("-13.00")
    assert pant_return.applies_to_line_no is None


def test_parse_receipt_with_general_discount():
    # Fully synthetic — UNCONFIRMED, no real example seen (see parse.py's
    # module docstring). A receipt-wide member/loyalty bonus, structurally
    # identical to general_deposit but using `text` instead of `description`
    # (per the query, GeneralDiscountListItem/GeneralModifierListItem have
    # no `description` field) and not linked to any product line.
    detail = {
        "data": {
            "receiptV2": {
                "key": "test-general-discount",
                "content": {
                    "header": {
                        "totalPurchaseAmount": "23,90 kr",
                        "isoDate": "2026-01-01T12:00:00Z",
                        "text": ["Test Store"],
                    },
                    "items": {
                        "allItems": {
                            "items": [
                                {
                                    "type": "product",
                                    "name": "Kaffe",
                                    "money": {"formatted": "29,90 kr"},
                                    "quantityCost": None,
                                    "deposits": [],
                                    "costModifiers": [],
                                },
                                {
                                    "type": "general_discount",
                                    "text": ["Stammisrabatt"],
                                    "money": {"formatted": "−6,00 kr"},
                                    "isRefund": True,
                                },
                            ]
                        },
                        "noBonusItems": {"items": []},
                        "returnedItems": {"items": []},
                    },
                },
                "sender": {"name": "ICA"},
            }
        }
    }

    parsed = parse_receipt(detail)

    assert parsed.warnings == [], parsed.warnings
    assert parsed.line_total_sum == parsed.total == Decimal("23.90")
    assert len(parsed.lines) == 2

    bonus = next(l for l in parsed.lines if l.raw_name == "Stammisrabatt")
    assert bonus.line_total == Decimal("-6.00")
    assert bonus.applies_to_line_no is None


def test_unrecognized_general_type_still_warns():
    # If the guessed type string ("general_discount"/"general_modifier")
    # turns out wrong for whatever Kivra actually sends, an unrecognized
    # general_* type should still fall through to the generic warning
    # rather than crashing or being silently dropped without a trace.
    detail = {
        "data": {
            "receiptV2": {
                "key": "test-unknown-general-type",
                "content": {
                    "header": {
                        "totalPurchaseAmount": "10,00 kr",
                        "isoDate": "2026-01-01T12:00:00Z",
                        "text": ["Test Store"],
                    },
                    "items": {
                        "allItems": {
                            "items": [
                                {
                                    "type": "general_something_else",
                                    "text": ["Mystery adjustment"],
                                    "money": {"formatted": "10,00 kr"},
                                }
                            ]
                        },
                        "noBonusItems": {"items": []},
                        "returnedItems": {"items": []},
                    },
                },
                "sender": {"name": "ICA"},
            }
        }
    }

    parsed = parse_receipt(detail)

    assert len(parsed.lines) == 0
    assert len(parsed.warnings) == 1
    assert "general_something_else" in parsed.warnings[0]


def test_get_card_last4_digits():
    # Synthetic, matching the real format (two representations of the same
    # card, both ending in the same 4 digits) — no real card data needed to
    # test the extraction regex.
    detail = {
        "data": {
            "receiptV2": {
                "content": {
                    "paymentInformation": {
                        "paymentMethods": {
                            "methods": [
                                {
                                    "type": "creditdebit",
                                    "information": {
                                        "subRows": [
                                            {"property": "Term:1234567890", "value": None},
                                            {
                                                "property": "DEBIT MASTERCARD     ************1234",
                                                "value": None,
                                            },
                                            {
                                                "property": "Bankidentifikation   000000******1234",
                                                "value": None,
                                            },
                                        ]
                                    },
                                }
                            ]
                        }
                    }
                }
            }
        }
    }
    assert get_card_last4_digits(detail) == {"1234"}
    assert get_card_last4_digits({"data": {}}) == set()


if __name__ == "__main__":
    test_parse_money()
    test_parse_receipt_against_real_fixture()
    test_store_hint_overrides_header_text()
    test_unrecognized_item_type_warns_and_is_excluded()
    test_parse_receipt_with_discounts()
    test_parse_receipt_with_deposit()
    test_parse_receipt_with_general_deposit()
    test_parse_receipt_with_general_discount()
    test_unrecognized_general_type_still_warns()
    test_get_card_last4_digits()
    print("All parse.py tests passed.")
