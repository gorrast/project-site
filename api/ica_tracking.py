"""Food expense tracker for the `ica` Supabase schema (see docs/ica-schema.sql
and docs/ica-frontend-handoff/). Originally ported from the design
prototype's resolve()/tally()/csv() logic (Food Expenses.dc.html); the
consumer-resolution chain that prototype computed at read time has since been
retired (see scripts/kivra/NOTICE.md) — `receipt_lines.consumer` is now
always populated at write time (by the importer or the one-time
scripts/kivra/backfill_consumers.py backfill), so this module just reads it
directly instead of recomputing a fallback on every request.
"""

from datetime import datetime, timezone
from typing import Callable, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from .admin_auth import LoginBody, authenticate_admin, require_admin_cookie, set_admin_cookie
from .clients import admin_client

router = APIRouter(prefix="/api/ica-tracking")

ICA_ADMIN_COOKIE = "ica_admin_session"
require_ica_admin = require_admin_cookie(ICA_ADMIN_COOKIE)

LOCAL_TZ = ZoneInfo("Europe/Stockholm")
Consumer = Literal["shared", "Hugo", "Benjamin"]

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@router.post("/admin/login")
def ica_admin_login(body: LoginBody):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    if not authenticate_admin(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    response = JSONResponse({"success": True})
    set_admin_cookie(response, ICA_ADMIN_COOKIE, body.username)
    return response


@router.get("/admin/check")
def ica_admin_check(username: str = Depends(require_ica_admin)):
    return {"authenticated": True, "username": username}


@router.post("/admin/logout")
def ica_admin_logout():
    response = JSONResponse({"success": True})
    response.delete_cookie(ICA_ADMIN_COOKIE, path="/")
    return response


# ---------------------------------------------------------------------------
# Pure resolution/aggregation core — ported from Food Expenses.dc.html's
# resolve()/tally()/meta()/displayName(). Operates on plain dicts as loaded
# from Supabase; no framework dependencies, so this stays easy to reason
# about even without unit tests.
# ---------------------------------------------------------------------------


def is_receipt_discount(line: dict) -> bool:
    return line["applies_to_line_id"] is None and line["line_total"] < 0


def add_quantity(bucket: dict, line: dict) -> None:
    """Accumulates one article line's quantity into `bucket` (a dict with
    "kg" and "st" float keys), split by an inferred unit — the schema has no
    unit column, only a bare `numeric(10,3)`, so a whole-number quantity is
    treated as a count ("st") and a fractional one as a weight ("kg"), same
    heuristic the Receipts tab uses to format a single line's own quantity.
    Kept as two separate running sums rather than one blended number: a
    product bought both as fixed packages and by weight (or two raw_names
    sharing a display_name with different units) would otherwise produce a
    meaningless total. Discount lines and lines with no quantity contribute
    nothing — callers only pass article lines here."""
    q = line["quantity"]
    if q is None:
        return
    if q == int(q):
        bucket["st"] += q
    else:
        bucket["kg"] += q


def product_meta(raw_name: str, products_by_raw: dict) -> dict:
    return products_by_raw.get(raw_name) or {
        "raw_name": raw_name,
        "display_name": None,
        "category": None,
        "default_consumer": None,
    }


def display_name(raw_name: str, products_by_raw: dict) -> str:
    return product_meta(raw_name, products_by_raw)["display_name"] or raw_name


def line_consumer(line: dict, receipt: dict) -> str:
    """The line's consumer. `receipt_lines.consumer` is always populated by
    the time a line reaches here (see module docstring); the `or buyer` here
    is a defensive guard against a not-yet-backfilled row, not a live
    feature — there's no product-default lookup and no discount-inherits-
    parent recursion anymore. Discount lines carry their own literal
    consumer, kept in sync with their parent's at write time (see
    set_line_consumer's cascade below) rather than computed on every read."""
    return line["consumer"] or receipt["buyer"]


def empty_tally() -> dict:
    return {
        "Hugo": 0.0, "Benjamin": 0.0, "shared": 0.0, "total": 0.0,
        "discount": 0.0, "byCat": {}, "byProd": {},
    }


def tally(receipts: list[dict], lines_by_receipt: dict, products_by_raw: dict) -> dict:
    t = empty_tally()
    for r in receipts:
        if r["excluded"]:
            continue
        lines = lines_by_receipt.get(r["id"], [])
        for line in lines:
            consumer = line_consumer(line, r)
            t[consumer] += line["line_total"]
            t["total"] += line["line_total"]
            receipt_wide = is_receipt_discount(line)
            if line["applies_to_line_id"] is not None or receipt_wide:
                t["discount"] += -line["line_total"]
            if receipt_wide:
                continue
            cat = product_meta(line["raw_name"], products_by_raw)["category"] or "Övrigt"
            cat_row = t["byCat"].setdefault(
                cat, {"name": cat, "Hugo": 0.0, "Benjamin": 0.0, "shared": 0.0, "total": 0.0}
            )
            cat_row[consumer] += line["line_total"]
            cat_row["total"] += line["line_total"]
            key = display_name(line["raw_name"], products_by_raw)
            prod_row = t["byProd"].setdefault(key, {
                "name": key, "count": 0, "total": 0.0,
                "Hugo": 0.0, "Benjamin": 0.0, "shared": 0.0,
                "count_Hugo": 0, "count_Benjamin": 0, "count_shared": 0,
                "quantity": {"kg": 0.0, "st": 0.0},
                "quantity_Hugo": {"kg": 0.0, "st": 0.0},
                "quantity_Benjamin": {"kg": 0.0, "st": 0.0},
                "quantity_shared": {"kg": 0.0, "st": 0.0},
            })
            prod_row["total"] += line["line_total"]
            prod_row[consumer] += line["line_total"]
            if line["applies_to_line_id"] is None:
                prod_row["count"] += 1
                prod_row[f"count_{consumer}"] += 1
                add_quantity(prod_row["quantity"], line)
                add_quantity(prod_row[f"quantity_{consumer}"], line)
    return t


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def _fetch_all(build_query: Callable[[], object], page_size: int = 1000) -> list[dict]:
    """PostgREST caps unfiltered selects around ~1000 rows; page through with
    .range() until a short page signals the end."""
    rows: list[dict] = []
    offset = 0
    while True:
        page = build_query().range(offset, offset + page_size - 1).execute().data
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def load_all() -> tuple[list[dict], dict, dict]:
    # Every paginated query below orders by its table's actual primary key
    # (unique, so pagination gets a stable total order) — never by a
    # non-unique column like line_no (which repeats across receipts) or
    # purchased_at (not guaranteed unique either). Offset-based pagination
    # over a non-unique sort key lets Postgres return ties inconsistently
    # between the separate paginated requests, silently dropping rows once a
    # table crosses the page size — this bit the receipt_lines fetch for
    # real once it passed 1000 rows (see scripts/kivra/NOTICE.md).
    client = admin_client()
    receipts = _fetch_all(
        lambda: client.schema("ica")
        .table("receipts")
        .select("id,kivra_id,purchased_at,buyer,store,total,excluded")
        .order("id")
    )
    lines = _fetch_all(
        lambda: client.schema("ica")
        .table("receipt_lines")
        .select("id,receipt_id,line_no,raw_name,quantity,line_total,consumer,applies_to_line_id")
        .order("id")
    )
    products = _fetch_all(
        lambda: client.schema("ica")
        .table("products")
        .select("raw_name,display_name,category,default_consumer")
        .order("raw_name")
    )
    lines_by_receipt: dict[str, list[dict]] = {}
    for line in lines:
        lines_by_receipt.setdefault(line["receipt_id"], []).append(line)
    products_by_raw = {p["raw_name"]: p for p in products}
    return receipts, lines_by_receipt, products_by_raw


# ---------------------------------------------------------------------------
# Month bucketing — bucket by Europe/Stockholm local date, not UTC, since the
# frontend displays dates in local time and a receipt just after local
# midnight must land in the same month a human would expect.
# ---------------------------------------------------------------------------


def local_dt(iso: str) -> datetime:
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ)


def month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def month_label(key: str, short: bool = False) -> str:
    year, month = key.split("-")
    name = MONTH_NAMES[int(month) - 1]
    return f"{name[:3]} {year}" if short else f"{name} {year}"


def next_month_key(key: str) -> str:
    year, month = (int(x) for x in key.split("-"))
    return f"{year + 1:04d}-01" if month == 12 else f"{year:04d}-{month + 1:02d}"


def all_month_keys(receipts: list[dict]) -> list[str]:
    now_local = datetime.now(LOCAL_TZ)
    current_key = month_key(now_local)
    if not receipts:
        return [current_key]
    earliest = min(local_dt(r["purchased_at"]) for r in receipts)
    keys = [month_key(earliest)]
    while keys[-1] < current_key:
        keys.append(next_month_key(keys[-1]))
    return keys


def group_receipts_by_month(receipts: list[dict]) -> dict[str, list[dict]]:
    by_month: dict[str, list[dict]] = {}
    for r in receipts:
        key = month_key(local_dt(r["purchased_at"]))
        by_month.setdefault(key, []).append(r)
    return by_month


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class LineConsumerBody(BaseModel):
    consumer: Consumer


class ReceiptExcludedBody(BaseModel):
    excluded: bool


class ProductDefaultBody(BaseModel):
    rawName: str
    defaultConsumer: Optional[Consumer] = None


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def serialize_tally(t: dict, receipts: list[dict]) -> dict:
    counted = sum(1 for r in receipts if not r["excluded"])
    return {
        "Hugo": t["Hugo"], "Benjamin": t["Benjamin"], "shared": t["shared"],
        "total": t["total"], "discount": t["discount"],
        "receiptCount": len(receipts), "countedReceiptCount": counted,
    }


def serialize_line(
    line: dict,
    receipt: dict,
    products_by_raw: dict,
    discount_children: list[dict],
) -> dict:
    meta = product_meta(line["raw_name"], products_by_raw)
    discount_total = sum(d["line_total"] for d in discount_children)
    return {
        "id": line["id"],
        "lineNo": line["line_no"],
        "rawName": line["raw_name"],
        "displayName": display_name(line["raw_name"], products_by_raw),
        "category": meta["category"],
        "quantity": line["quantity"],
        "consumer": line_consumer(line, receipt),
        "appliesToLineId": line["applies_to_line_id"],
        "isReceiptDiscount": is_receipt_discount(line),
        "grossTotal": line["line_total"],
        "discountTotal": discount_total,
        "netTotal": line["line_total"] + discount_total,
        "discountLines": [
            {"id": d["id"], "rawName": d["raw_name"], "lineTotal": d["line_total"]}
            for d in discount_children
        ],
    }


def serialize_receipt(receipt: dict, lines: list[dict], products_by_raw: dict) -> dict:
    discounts_for: dict[int, list[dict]] = {}
    for l in lines:
        if l["applies_to_line_id"] is not None:
            discounts_for.setdefault(l["applies_to_line_id"], []).append(l)

    article_lines = [l for l in lines if l["applies_to_line_id"] is None and not is_receipt_discount(l)]
    receipt_discounts = [l for l in lines if is_receipt_discount(l)]

    serialized = [
        serialize_line(l, receipt, products_by_raw, discounts_for.get(l["id"], []))
        for l in article_lines
    ] + [
        serialize_line(l, receipt, products_by_raw, [])
        for l in receipt_discounts
    ]

    return {
        "id": receipt["id"],
        "kivraId": receipt["kivra_id"],
        "purchasedAt": receipt["purchased_at"],
        "buyer": receipt["buyer"],
        "store": receipt["store"],
        "total": receipt["total"],
        "excluded": receipt["excluded"],
        "lines": serialized,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/months")
def get_months(username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    keys = all_month_keys(receipts)
    by_month = group_receipts_by_month(receipts)

    months = []
    for key in keys:
        month_receipts = by_month.get(key, [])
        counted = sum(1 for r in month_receipts if not r["excluded"])
        months.append({
            "key": key,
            "label": month_label(key),
            "short": month_label(key, short=True),
            "receiptCount": len(month_receipts),
            "countedReceiptCount": counted,
        })

    return {
        "months": months,
        "currentMonthKey": month_key(datetime.now(LOCAL_TZ)),
    }


@router.get("/month/{month_key}")
def get_month(month_key: str, username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    keys = all_month_keys(receipts)
    if month_key not in keys:
        raise HTTPException(status_code=404, detail="No such month")

    by_month = group_receipts_by_month(receipts)
    month_receipts = sorted(by_month.get(month_key, []), key=lambda r: r["purchased_at"], reverse=True)
    t = tally(month_receipts, lines_by_receipt, products_by_raw)

    idx = keys.index(month_key)
    prev_key = keys[idx - 1] if idx > 0 else None
    next_key = keys[idx + 1] if idx < len(keys) - 1 else None

    return {
        "monthKey": month_key,
        "label": month_label(month_key),
        "short": month_label(month_key, short=True),
        "prevKey": prev_key,
        "nextKey": next_key,
        "tally": serialize_tally(t, month_receipts),
        "receipts": [
            serialize_receipt(r, lines_by_receipt.get(r["id"], []), products_by_raw)
            for r in month_receipts
        ],
    }


CSV_COLUMNS = [
    "purchased_at", "store", "buyer", "kivra_id", "excluded", "line_no", "raw_name",
    "display_name", "category", "quantity", "line_total", "consumer", "is_discount",
]


def csv_field(value: object) -> str:
    s = "" if value is None else str(value)
    if any(ch in s for ch in '",;\n'):
        return '"' + s.replace('"', '""') + '"'
    return s


def month_csv_body(month_receipts: list[dict], lines_by_receipt: dict, products_by_raw: dict) -> str:
    """One row per raw receipt_lines row (article and both discount kinds
    alike) — deliberately not the folded-discounts-into-parent shape the
    /month/{key} JSON uses for the Receipts tab UI, since a spreadsheet
    export should be auditable against the raw imported data."""
    rows = [CSV_COLUMNS]
    for r in month_receipts:
        lines = lines_by_receipt.get(r["id"], [])
        for line in lines:
            meta = product_meta(line["raw_name"], products_by_raw)
            rows.append([
                r["purchased_at"], r["store"], r["buyer"], r["kivra_id"], r["excluded"],
                line["line_no"], line["raw_name"], meta["display_name"] or "", meta["category"] or "",
                line["quantity"] if line["quantity"] is not None else "", f"{line['line_total']:.2f}",
                line_consumer(line, r), bool(line["applies_to_line_id"]),
            ])
    return "\n".join(",".join(csv_field(c) for c in row) for row in rows)


@router.get("/month/{month_key}/csv")
def get_month_csv(month_key: str, username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    keys = all_month_keys(receipts)
    if month_key not in keys:
        raise HTTPException(status_code=404, detail="No such month")

    by_month = group_receipts_by_month(receipts)
    month_receipts = sorted(by_month.get(month_key, []), key=lambda r: r["purchased_at"], reverse=True)
    body = month_csv_body(month_receipts, lines_by_receipt, products_by_raw)

    short = month_label(month_key, short=True).replace(" ", "-").lower()
    filename = f"food-expenses-{short}.csv"
    return Response(
        content="﻿" + body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/trends")
def get_trends(username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    keys = all_month_keys(receipts)
    by_month = group_receipts_by_month(receipts)

    months = []
    for key in keys:
        month_receipts = by_month.get(key, [])
        t = tally(month_receipts, lines_by_receipt, products_by_raw)
        months.append({
            "key": key,
            "label": month_label(key),
            "short": month_label(key, short=True),
            **serialize_tally(t, month_receipts),
        })

    return {"months": months}


PersonFilter = Literal["total", "shared", "Hugo", "Benjamin"]


@router.get("/reports")
def get_reports(
    scope: Literal["month", "all"] = "month",
    month: Optional[str] = None,
    person: PersonFilter = "total",
    username: str = Depends(require_ica_admin),
):
    receipts, lines_by_receipt, products_by_raw = load_all()
    keys = all_month_keys(receipts)
    by_month = group_receipts_by_month(receipts)

    if scope == "all":
        scoped_receipts = receipts
        label = f"All {len(keys)} months"
    else:
        if not month or month not in keys:
            raise HTTPException(status_code=400, detail="A valid month is required for scope=month")
        scoped_receipts = by_month.get(month, [])
        label = month_label(month)

    t = tally(scoped_receipts, lines_by_receipt, products_by_raw)

    if person == "total":
        total = t["total"]
        prod_list = sorted(t["byProd"].values(), key=lambda p: p["total"], reverse=True)[:10]
        top_products = [
            {
                "rank": i + 1, "name": p["name"], "count": p["count"], "total": p["total"],
                "quantityKg": p["quantity"]["kg"], "quantitySt": p["quantity"]["st"],
            }
            for i, p in enumerate(prod_list)
        ]
        categories = sorted(t["byCat"].values(), key=lambda c: c["total"], reverse=True)
    else:
        total = t[person]
        candidates = [p for p in t["byProd"].values() if p[f"count_{person}"] > 0]
        prod_list = sorted(candidates, key=lambda p: p[person], reverse=True)[:10]
        top_products = [
            {
                "rank": i + 1, "name": p["name"], "count": p[f"count_{person}"], "total": p[person],
                "quantityKg": p[f"quantity_{person}"]["kg"], "quantitySt": p[f"quantity_{person}"]["st"],
            }
            for i, p in enumerate(prod_list)
        ]
        categories = sorted(t["byCat"].values(), key=lambda c: c[person], reverse=True)

    return {
        "scope": scope,
        "monthKey": month if scope == "month" else None,
        "person": person,
        "label": label,
        "total": total,
        "topProducts": top_products,
        "categories": categories,
    }


@router.get("/products")
def get_products(username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    t = tally(receipts, lines_by_receipt, products_by_raw)

    # byProd is keyed by display_name and skips receipt-level discounts; the
    # Products table needs one row per raw_name (ica.products' PK) with
    # lifetime count/total, so recompute directly per raw_name here instead.
    stats: dict[str, dict] = {}
    for r in receipts:
        if r["excluded"]:
            continue
        for line in lines_by_receipt.get(r["id"], []):
            if is_receipt_discount(line):
                continue
            row = stats.setdefault(
                line["raw_name"], {"count": 0, "total": 0.0, "quantity": {"kg": 0.0, "st": 0.0}}
            )
            row["total"] += line["line_total"]
            if line["applies_to_line_id"] is None:
                row["count"] += 1
                add_quantity(row["quantity"], line)

    rows = []
    for raw_name, p in products_by_raw.items():
        s = stats.get(raw_name, {"count": 0, "total": 0.0, "quantity": {"kg": 0.0, "st": 0.0}})
        rows.append({
            "rawName": raw_name,
            "displayName": p["display_name"],
            "category": p["category"],
            "count": s["count"],
            "total": s["total"],
            "quantityKg": s["quantity"]["kg"],
            "quantitySt": s["quantity"]["st"],
            "defaultConsumer": p["default_consumer"],
        })
    rows.sort(key=lambda r: r["total"], reverse=True)
    return {"products": rows}


@router.get("/products/options")
def get_product_options(username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    t = tally(receipts, lines_by_receipt, products_by_raw)
    options = sorted(
        ({"name": p["name"], "total": p["total"]} for p in t["byProd"].values()),
        key=lambda p: p["total"],
        reverse=True,
    )
    return {"options": options}


@router.get("/products/monthly")
def get_product_monthly(name: str, username: str = Depends(require_ica_admin)):
    receipts, lines_by_receipt, products_by_raw = load_all()
    keys = all_month_keys(receipts)
    by_month = group_receipts_by_month(receipts)

    months = []
    for key in keys:
        cell = {"Hugo": 0.0, "Benjamin": 0.0, "shared": 0.0, "total": 0.0, "count": 0}
        for r in by_month.get(key, []):
            if r["excluded"]:
                continue
            lines = lines_by_receipt.get(r["id"], [])
            for line in lines:
                if display_name(line["raw_name"], products_by_raw) != name:
                    continue
                consumer = line_consumer(line, r)
                cell[consumer] += line["line_total"]
                cell["total"] += line["line_total"]
                if line["applies_to_line_id"] is None:
                    cell["count"] += 1
        months.append({
            "key": key, "label": month_label(key), "short": month_label(key, short=True), **cell,
        })

    return {"name": name, "months": months}


@router.patch("/lines/{line_id}")
def set_line_consumer(line_id: int, body: LineConsumerBody, username: str = Depends(require_ica_admin)):
    client = admin_client()
    try:
        existing = (
            client.schema("ica")
            .table("receipt_lines")
            .select("id,applies_to_line_id")
            .eq("id", line_id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to look up line")
    if not existing.data:
        raise HTTPException(status_code=404, detail="Line not found")
    if existing.data[0]["applies_to_line_id"] is not None:
        raise HTTPException(
            status_code=400,
            detail="This line is a product-level discount and always follows its parent's consumer — edit the parent line instead.",
        )

    try:
        client.schema("ica").table("receipt_lines").update({"consumer": body.consumer}).eq("id", line_id).execute()
        # Cascade to any product-level discount children so their stored
        # consumer doesn't drift from the parent's — there's no more
        # read-time recursion to paper over that for us (see line_consumer).
        client.schema("ica").table("receipt_lines").update({"consumer": body.consumer}).eq(
            "applies_to_line_id", line_id
        ).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update line")
    return {"success": True}


@router.patch("/receipts/{receipt_id}")
def set_receipt_excluded(receipt_id: str, body: ReceiptExcludedBody, username: str = Depends(require_ica_admin)):
    client = admin_client()
    try:
        result = (
            client.schema("ica")
            .table("receipts")
            .update({"excluded": body.excluded})
            .eq("id", receipt_id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update receipt")
    if not result.data:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"success": True}


@router.patch("/products")
def set_product_default(body: ProductDefaultBody, username: str = Depends(require_ica_admin)):
    # rawName is a body field, not a path param — raw_name values contain
    # spaces/%/commas that are fragile to URL-encode/decode reliably.
    client = admin_client()
    try:
        result = (
            client.schema("ica")
            .table("products")
            .update({"default_consumer": body.defaultConsumer})
            .eq("raw_name", body.rawName)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update product")
    if not result.data:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}
