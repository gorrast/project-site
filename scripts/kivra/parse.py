"""
Parses a Kivra RECEIPT_DETAILS_QUERY response (see
scripts/kivra/vendor/kivra/models.py) into ParsedReceipt/ParsedLine objects
ready for scripts/kivra/supabase_io.py to write.

Field mapping was derived from real ICA receipts captured while testing
against the actual Kivra API — see docs/probe.md for the first one. Several
things about the real payload were not what
docs/ica-kivra-importer-handoff.md assumed:

- `money.formatted` / `totalPurchaseAmount` / `quantityCost.formatted` are
  Swedish-formatted display STRINGS (e.g. "265,46 kr", "0,175 kg * 29,90
  kr/kg", "4 st * 55,93 kr/st"), not raw numeric fields. `parse_money`/
  `_parse_quantity` below parse these into Decimal. Negative amounts (e.g.
  per-item discounts) use the Unicode MINUS SIGN (U+2212, "−"), not an
  ASCII hyphen — `parse_money` accepts both.
- A product's `costModifiers` array holds per-item discounts explicitly
  linked to that product (confirmed against a real receipt: each product's
  `money.formatted` is its pre-discount line price; each costModifier's
  negative amount is a discount against that specific line; the sum of
  every costModifier on a receipt matched its printed "Totalrabatt" exactly).
  Each costModifier becomes its own ParsedLine with `applies_to_line_no`
  pointing at its parent product — this is the better "explicit link" case
  handoff §7.6 hoped for, not the positional-adjacency fallback.
- A product's `deposits` array (e.g. bottle/can pant) holds a POSITIVE
  additional charge, not a discount (confirmed against a real receipt: a
  Coca-Cola line had `money: "24,90 kr"` plus a deposit
  `{description: "Pant", money: "2,00 kr", isRefund: false}` — no minus
  sign, `isRefund` false, unlike a costModifier discount). Each deposit
  becomes its own ParsedLine, linked to its parent product via
  `applies_to_line_no` just like a costModifier — a direct decision to keep
  the pant charge tied to its product, even though the schema's own column
  comment describes `applies_to_line_id` as meaning "this line is a
  discount" and lists `line_total` as negative for such rows
  (docs/ica-schema.sql, handoff §8). Nothing in the schema enforces that
  sign convention (no CHECK constraint ties it to `applies_to_line_id`), so
  this is safe at the database level — just a deliberate divergence from
  that documentation's wording, not an oversight.
- Top-level `general_deposit` items (`GeneralDepositListItem`, not nested
  under a product) are handled: confirmed against a real receipt as a pant
  *return* (`{description: "Pant", money: "−13,00 kr", isRefund: true}`,
  no `name`) — a receipt-level adjustment, not linked via `applies_to_line_no`
  since it isn't attached to a specific article (handoff §9).
- Top-level `general_discount`/`general_modifier` items (`GeneralDiscountListItem`/
  `GeneralModifierListItem` — e.g. a receipt-wide member/loyalty bonus, as
  opposed to a per-item `costModifiers` discount) are also handled, using
  `text[0]` as the name (these two have no `description` field in the
  query, unlike `general_deposit`) and, same as `general_deposit`, not
  linked via `applies_to_line_no`. UNCONFIRMED: no real example of either
  has been seen — the field shape comes straight from the query, but the
  `type` string values ("general_discount"/"general_modifier") are inferred
  by analogy with the confirmed "general_deposit", not observed. If that
  guess is wrong for whichever string Kivra actually sends, the item simply
  falls through to the generic "unhandled item type" warning below instead
  — never a silent wrong total either way.
- The query (scripts/kivra/vendor/kivra/models.py) documents further shapes
  no real receipt has exercised yet: a separate `noBonusItems` list, and a
  separate `returnedItems` list (whose entries carry a
  `connectedReceipt.receiptKey` back to another receipt). Any item type
  other than plain "product"/"general_deposit"/"general_discount"/
  "general_modifier", and any non-empty `noBonusItems`/`returnedItems`, is
  recorded as a warning rather than silently dropped or guessed — its money
  is left out of `lines`, so the caller's line-sum-vs-total reconciliation
  check (handoff §7.8) will visibly flag the receipt for a manual look at
  its `raw_payload` rather
  than silently mis-totaling it. Extend `parse_receipt` once a real example
  of one of these remaining shapes turns up.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

_MINUS = "[-−]"
_MONEY_RE = re.compile(r"^(" + _MINUS + r"?)([\d\s\xa0]+)(?:,(\d+))?\s*kr$")
_QUANTITY_RE = re.compile(
    r"^(" + _MINUS + r"?[\d,]+)\s*(?:kg|st)\s*\*\s*" + _MINUS + r"?[\d,]+\s*kr/(?:kg|st)$"
)


class ParseError(Exception):
    """A receipt could not be parsed at all (distinct from an unrecognized line)."""


@dataclass
class ParsedLine:
    line_no: int
    raw_name: str
    line_total: Decimal
    quantity: Decimal | None = None
    # Local line_no (not a DB id) this line is a discount against, if any.
    # Set for costModifier-derived discount lines; resolved to a real
    # receipt_lines.id by supabase_io after the article lines are inserted.
    applies_to_line_no: int | None = None


@dataclass
class ParsedReceipt:
    kivra_id: str
    purchased_at: datetime
    store: str | None
    total: Decimal
    raw_payload: dict
    lines: list[ParsedLine] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def line_total_sum(self) -> Decimal:
        return sum((l.line_total for l in self.lines), Decimal("0"))


def parse_money(formatted: str | None) -> Decimal:
    """Parses a Kivra-formatted Swedish krona string, e.g. '265,46 kr' or
    a discount like '−63,72 kr' (Unicode minus sign, not ASCII hyphen),
    into a Decimal. Never use float for money (handoff §13)."""
    if not formatted:
        raise ParseError("empty money value")
    m = _MONEY_RE.match(formatted.strip())
    if not m:
        raise ParseError(f"unrecognized money format: {formatted!r}")
    sign, whole, frac = m.groups()
    whole = whole.replace(" ", "").replace("\xa0", "")
    value = Decimal(f"{whole}.{frac or '00'}")
    return -value if sign else value


def _parse_quantity(quantity_cost: dict | None) -> Decimal | None:
    """Handles both weight-based ('0,175 kg * 29,90 kr/kg') and countable
    multi-quantity ('4 st * 55,93 kr/st') formats. Returns None for a plain
    single-unit item (quantityCost is null) or an unrecognized format."""
    if not quantity_cost or not quantity_cost.get("formatted"):
        return None
    m = _QUANTITY_RE.match(quantity_cost["formatted"].strip())
    if not m:
        return None
    return Decimal(m.group(1).replace(",", "."))


def get_sender_name(detail_response: dict) -> str | None:
    """Used by the CLI to filter to ICA receipts only (handoff §7.1: filter
    on sender, never on payment method)."""
    return (
        detail_response.get("data", {})
        .get("receiptV2", {})
        .get("sender", {})
        .get("name")
    )


_CARD_LAST4_RE = re.compile(r"\*{4,}(\d{4})$")


def get_card_last4_digits(detail_response: dict) -> set[str]:
    """
    Best-effort extraction of masked card last-4 digits from the receipt's
    payment terminal dump (content.paymentInformation.paymentMethods.methods[]
    .information.subRows[].property). There is no clean card field — Kivra
    only exposes this as unstructured POS terminal output (one real example
    had both "DEBIT MASTERCARD ************9683" and a second line
    "Bankidentifikation 534243******9683" for the same card), so this scans
    every subRow property for a run of 4+ asterisks immediately followed by
    exactly 4 digits at the end of the string, and returns whatever it finds
    (usually one value, but may be more than one if a receipt used split
    payment). Returns an empty set if nothing matches — e.g. a non-card
    payment method, or a terminal dump format this hasn't seen yet.
    """
    digits: set[str] = set()
    methods = (
        detail_response.get("data", {})
        .get("receiptV2", {})
        .get("content", {})
        .get("paymentInformation", {})
        .get("paymentMethods", {})
        .get("methods", [])
    )
    for method in methods:
        sub_rows = (method.get("information") or {}).get("subRows") or []
        for row in sub_rows:
            prop = row.get("property")
            if not prop:
                continue
            m = _CARD_LAST4_RE.search(prop.strip())
            if m:
                digits.add(m.group(1))
    return digits


def parse_receipt(detail_response: dict, *, store_hint: str | None = None) -> ParsedReceipt:
    """
    Parses one RECEIPT_DETAILS_QUERY response (the raw dict returned by
    KivraApiClient.graphql_query) into a ParsedReceipt.

    `store_hint` should be the `store.name` field from the cheaper
    RECEIPTS_QUERY list entry, if available — a clean structured field,
    preferred over parsing the store name out of this response's free-text
    header address block (`content.header.text[0]`), which is used only as
    a fallback.
    """
    receipt = detail_response.get("data", {}).get("receiptV2")
    if receipt is None:
        raise ParseError("response has no data.receiptV2")

    kivra_id = receipt["key"]
    content = receipt["content"]
    header = content["header"]

    total = parse_money(header.get("totalPurchaseAmount"))
    purchased_at = datetime.fromisoformat(header["isoDate"].replace("Z", "+00:00"))

    store = store_hint
    if not store and header.get("text"):
        store = header["text"][0]

    warnings: list[str] = []
    lines: list[ParsedLine] = []
    line_no = 0

    items = content.get("items", {})

    for item in items.get("allItems", {}).get("items", []):
        item_type = item.get("type")
        name = item.get("name")

        if item_type == "general_deposit":
            # A GeneralDepositListItem: a receipt-level pant charge/return,
            # not nested under any product (unlike a product's own deposits
            # array). Confirmed against a real receipt: a pant *return*
            # ("Pantretur, hög moms"), negative money, isRefund true, with a
            # `description` field ("Pant") but no `name`. Not linked via
            # applies_to_line_no — it isn't attached to a specific article
            # (handoff §9: "receipt-level discounts not attached to any
            # article — allowed: applies_to_line_id NULL").
            description = item.get("description")
            if not description:
                warnings.append(
                    "unhandled general_deposit item with no description — "
                    "not imported, see raw_payload"
                )
                continue
            line_no += 1
            lines.append(
                ParsedLine(
                    line_no=line_no,
                    raw_name=description,
                    line_total=parse_money(item.get("money", {}).get("formatted")),
                )
            )
            continue

        if item_type in ("general_discount", "general_modifier"):
            # GeneralDiscountListItem / GeneralModifierListItem: receipt-wide
            # adjustments not tied to any product — e.g. a member/loyalty
            # bonus applied to the whole purchase, rather than a per-item
            # costModifier. NOT yet confirmed against a real receipt: the
            # query (models.py) documents the field shape (money, isRefund,
            # text — no `description` field for these two, unlike
            # general_deposit), but the exact `type` string values here are
            # inferred by analogy with "general_deposit", not observed. If
            # that guess is wrong, this branch simply never matches and the
            # item falls through to the generic "unhandled item type"
            # warning below — no silent wrong total either way. Not linked
            # via applies_to_line_no, same reasoning as general_deposit.
            text = item.get("text") or []
            label = text[0] if text else None
            if not label:
                warnings.append(
                    f"unhandled {item_type!r} item with no text — not imported, "
                    "see raw_payload"
                )
                continue
            line_no += 1
            lines.append(
                ParsedLine(
                    line_no=line_no,
                    raw_name=label,
                    line_total=parse_money(item.get("money", {}).get("formatted")),
                )
            )
            continue

        if item_type != "product":
            warnings.append(
                f"unhandled item type {item_type!r} (name={name!r}) — not imported as a line"
            )
            continue

        quantity_cost = item.get("quantityCost")
        quantity = _parse_quantity(quantity_cost)
        if quantity_cost and quantity_cost.get("formatted") and quantity is None:
            warnings.append(
                f"product {name!r} has an unrecognized quantityCost format: "
                f"{quantity_cost['formatted']!r} — quantity left NULL"
            )

        line_no += 1
        product_line_no = line_no
        lines.append(
            ParsedLine(
                line_no=product_line_no,
                raw_name=name,
                line_total=parse_money(item.get("money", {}).get("formatted")),
                quantity=quantity,
            )
        )

        for modifier in item.get("costModifiers") or []:
            description = modifier.get("description")
            if not description:
                warnings.append(
                    f"product {name!r} has a cost modifier with no description — "
                    "not imported, see raw_payload"
                )
                continue
            line_no += 1
            lines.append(
                ParsedLine(
                    line_no=line_no,
                    raw_name=description,
                    line_total=parse_money(modifier.get("money", {}).get("formatted")),
                    applies_to_line_no=product_line_no,
                )
            )

        for deposit in item.get("deposits") or []:
            description = deposit.get("description")
            if not description:
                warnings.append(
                    f"product {name!r} has a deposit with no description — "
                    "not imported, see raw_payload"
                )
                continue
            line_no += 1
            # Linked to its parent product via applies_to_line_no, same as a
            # costModifier discount — deliberately, per a direct decision:
            # the schema's own column comment describes applies_to_line_id as
            # meaning "this line is a discount" and lists line_total as
            # negative for such rows (docs/ica-schema.sql, handoff §8). A
            # deposit is a positive charge, not a discount, so this reading
            # links it to its product anyway without following that specific
            # negative-amount convention. Nothing in the schema enforces the
            # sign (no CHECK constraint ties it to applies_to_line_id), so
            # this is safe at the database level — just worth knowing if you
            # go looking for why a linked line here doesn't match that text.
            lines.append(
                ParsedLine(
                    line_no=line_no,
                    raw_name=description,
                    line_total=parse_money(deposit.get("money", {}).get("formatted")),
                    applies_to_line_no=product_line_no,
                )
            )

    no_bonus_items = items.get("noBonusItems", {}).get("items", [])
    if no_bonus_items:
        warnings.append(
            f"receipt has {len(no_bonus_items)} noBonusItems entries — not yet "
            "imported (unclear whether these duplicate allItems or are additional "
            "lines) — see raw_payload"
        )

    returned_items = items.get("returnedItems", {}).get("items", [])
    if returned_items:
        warnings.append(
            f"receipt has {len(returned_items)} returnedItems entries — not yet "
            "imported — see raw_payload"
        )

    return ParsedReceipt(
        kivra_id=kivra_id,
        purchased_at=purchased_at,
        store=store,
        total=total,
        raw_payload=detail_response,
        lines=lines,
        warnings=warnings,
    )
