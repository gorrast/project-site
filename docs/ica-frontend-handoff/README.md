# Handoff: Food expense tracker (ICA receipts, Hugo & Benjamin)

## Overview

A private Next.js view over an existing Supabase schema (`ica`) holding grocery receipts imported from Kivra inboxes. Two roommates share one account; the site answers who consumed how much, on what, per month, and lets them correct the consumer attribution per line item and per product.

It is a reporting and marking tool, not a settle-up tool. There is deliberately **no debt tracking** — no "X owes Y" anywhere. Spending is reported in three buckets: shared, Hugo, Benjamin.

## About the design files

`Food Expenses.dc.html` in this bundle is a **design reference created in HTML** — a working prototype showing intended layout, behavior, and exact visual values. It is not production code to copy. It runs on a small in-house streaming-template runtime (`support.js`, also bundled so the file opens in a browser); that runtime is irrelevant to the implementation.

The task is to **recreate this design inside `gorrast/project-site`** using its existing environment: Next.js App Router, TypeScript, Tailwind, shadcn/ui primitives in `components/ui/`, and recharts for charts. All data in the prototype is generated mock data in the logic class — replace it entirely with Supabase queries.

Mock-data specifics you should NOT port: the `build()` method, the seeded RNG, the Swedish product list, and the deterministic "every third receipt gets a receipt-level discount" seeding. They exist only to make all states visible in the prototype.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and interaction behavior are final and were aligned to the repo's own conventions. Recreate it closely, but prefer the repo's primitives over the prototype's hand-rolled equivalents wherever they collide — `components/ui/button.tsx`, `components/ui/table.tsx`, `components/ui/input.tsx`, `ChartContainer`, and the chart patterns in `components/bluebaycup/ClusteredColumnChart.tsx` and `MultiPlayerLineChart.tsx`. The prototype's buttons, inputs, tables, and tooltips were written to match those files; use the real components.

## Data model

Existing schema, already populated by the Kivra import. Relevant columns only:

**`ica.receipts`** — `id`, `kivra_id`, `buyer` ('Hugo' | 'Benjamin'), `store`, `purchased_at` (timestamptz), `total` (numeric), `excluded` (boolean, default false)

**`ica.receipt_lines`** — `id`, `receipt_id`, `line_no`, `raw_name`, `quantity` (numeric, nullable), `line_total` (numeric, signed), `consumer` ('shared' | 'Hugo' | 'Benjamin', **nullable**), `applies_to_line_id` (nullable FK to `ica.receipt_lines.id`)

**`ica.products`** — `raw_name` (PK), `display_name` (nullable), `category` (nullable), `default_consumer` ('shared' | 'Hugo' | 'Benjamin', nullable)

Only three columns are ever written by this UI: `receipt_lines.consumer`, `receipts.excluded`, `products.default_consumer`.

### The consumer resolution chain — retired; see amendment below

> **Amended after real usage.** This section describes the *original* design: a live, read-time
> fallback chain. In practice it meant editing a product's default on the Products tab silently
> re-colored every past receipt riding on that fallback — surprising once enough products had
> been classified after the fact. This has been replaced: `receipt_lines.consumer` is now always
> populated at write time (by the importer, falling back to the receipt's buyer when a product has
> no default yet, or by the one-time `scripts/kivra/backfill_consumers.py` migration for
> already-imported rows) and is the sole source of truth from then on — nothing computes a
> fallback at read time anymore. A product's `default_consumer` now only affects raw_names not yet
> seen in a *future* Kivra import; it has no effect on anything already on the site. Correcting a
> misclassified product on past receipts means editing the affected lines directly in the Receipts
> tab. See `scripts/kivra/NOTICE.md`'s "Departures from the original handoff spec" for the full
> writeup. Everything below this point (the resolution steps, the outlined-vs-filled S/H/B
> rendering, the "N inherited" Receipts badge, the `⌫` "revert to inherited" keyboard shortcut) is
> historical and no longer reflects the shipped app.

Every line resolved to exactly one consumer, in this order:

1. `receipt_lines.consumer` if non-null → source `line`
2. else `products.default_consumer` for that `raw_name` if non-null → source `default`
3. else `receipts.buyer` of the parent receipt → source `buyer`

Nothing was ever unattributed; there was no "unknown" bucket. Most lines arrived with `consumer` null, so the fallbacks did the bulk of the work.

Two consequences the UI had to respect:

- **Provenance is always visible.** An inherited value must never look like a decision someone made. Every line states which step it came from, and the S/H/B control renders filled for `line` and outlined for `default`/`buyer`.
- **Changing a product default moves every line that has no value of its own**, retroactively, across all months — because resolution is computed at read time, not copied at import time. Lines set by hand are unaffected. This was an explicit product decision; do not "fix" it by backfilling `receipt_lines.consumer` on default change.

Clearing a line (⌫ or clicking its active chip) sets `consumer` back to NULL, which reverts it to inherited — it does not clear it to nothing.

### Discount lines — two kinds

**Product-level:** `applies_to_line_id` points at another line. It inherits its parent's resolved consumer (never its own), and in the UI it does **not** get its own row — it folds into the parent article's row. Tally it into the person buckets and the discounts-saved figure normally.

**Receipt-level:** `applies_to_line_id` is null **and** `line_total < 0` (e.g. a loyalty coupon or a `PANT RETUR` line). This is the detection rule the prototype uses; if your import marks these differently, switch to that. These get their own row, sorted last in the item list, are independently markable, and follow the normal resolution chain. They are **excluded** from the by-category and top-product reports (they belong to no product) but **included** in the person totals, the month total, and discounts saved.

Discount `raw_name`s must be kept out of `ica.products` — they are not purchasable articles. The prototype keeps a separate `discountNames` lookup for their display names and a tolerant accessor that returns a null-ish stub for unknown `raw_name`s.

## Screens / Views

Four tabs. The split exists because mixing month-scoped and all-time data in one view was confusing. **Only "This month" and "Receipts" show the month stepper in the header** — the other two are not month-dependent and must not show it.

Page shell: `max-width: 1180px`, centered, `padding: 26px 18px 90px`, vertical stack with `gap: 18px`, page background `#f9fafb`.

Header: eyebrow `ICA · HUGO & BENJAMIN` (Geist Mono 11px, `0.1em` tracking, uppercase, `#6b7280`) over `h1` "Food expenses" (Space Grotesk 700, 34px, `-0.02em`, `line-height: 1.05`). Right side, when month-scoped: `‹` / month label / `›` (34px square outline buttons, 8px radius, `#e5e7eb` border, hover `#9ca3af`) plus an "Export CSV" button. Month label is Space Grotesk 500 15px, `min-width: 150px`, centered.

Tab bar: `border-bottom: 1px solid #e5e7eb`, each tab `padding: 10px 14px`, Space Grotesk 500 14px, active `#111827` with a 2px `#111827` bottom border pulled onto the divider (`margin-bottom: -1px`), inactive `#6b7280`. The Receipts tab carries a count badge of inherited (not hand-set) lines across all months: Geist Mono 10px, `#fff7ed` fill, `#fed7aa` border, `#c2410c` text, 9px radius.

### 1. This month

Month-scoped summary. Contains, top to bottom:

**Bucket cards** — responsive grid, `repeat(auto-fit, minmax(172px, 1fr))`, `gap: 12px`. Each card: white, `1px solid #f3f4f6`, 16px radius, `padding: 16px 18px`, `box-shadow: 0 1px 3px rgba(17,24,39,0.06)`. Inside: an 8px color dot + Geist Mono 10.5px uppercase `0.08em` label in `#6b7280`; the amount in Space Grotesk 700 26px `-0.02em`; a 12px `#6b7280` sub-line. Five cards: month total (dot `#111827`, sub "5 of 7 receipts counted"), Hugo, Benjamin, shared (each sub "NN% of month"), discounts (dot `#059669`, sub "saved this month").

**Budget bar** — white card, same chrome. Row: "Monthly target 6 000,00 kr" (Space Grotesk 500 14px) and a right-aligned Geist Mono 12.5px status, either "1 234,00 kr left" in `#111827` or "…over" in `#dc2626`. Below: an 8px track, `#f3f4f6`, 4px radius, fill capped at 100% in the same status color.

**Reports** — see §3; they render under both this tab and Trends.

### 2. Trends

No month stepper. The combo chart, then the product-over-time panel, then the reports scoped to all time by default.

**Month chart** — white card, `padding: 20px 18px 14px`, 16px radius, `box-shadow: 0 10px 15px -3px rgba(17,24,39,0.08), 0 4px 6px -4px rgba(17,24,39,0.05)`. Title inside the card: "Spending by month, against a 6 000,00 kr target", Space Grotesk 600 16px, `margin-bottom: 18px`.

Plot area 280px tall. 40px y-axis gutter, ticks Geist Mono/11px `#6b7280`, five labels from `scale` down to 0, each `translateY(-50%)`. Grid: dashed `1px #cccccc` at 0/25/50/75%, solid `#cccccc` baseline. Months run oldest → newest, left to right, one flex cell each.

Per month: three clustered columns in order **shared, Hugo, Benjamin** — `max-width: 16px`, `gap: 3px`, `border-radius: 2px 2px 0 0`, cell `padding: 0 5px`. Over them, the month **total** as a 2px `#111827` polyline with 6px dots at each month (SVG `viewBox="0 0 100 100"`, `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`, `z-index: 2`; dots are positioned divs at `z-index: 4`). The **budget** is a 2px dashed `#dc2626` horizontal reference line at `z-index: 3` with a small "budget" label pinned right, on a white chip so it stays legible.

Y scale: `Math.ceil(Math.max(budget, maxMonthTotal) * 1.12 / 500) * 500` — always includes the budget line, always headroom above the peak, rounded to 500.

Hover a month cell: cell tints `#f9fafb` and a tooltip appears anchored to the total dot — white, `1px solid #e5e7eb`, 8px radius, `padding: 7px 10px`, `box-shadow: 0 10px 15px -3px rgba(17,24,39,0.14)`, `min-width: 168px`, month name in 12px/500, then rows of `swatch · muted label · mono right-aligned value` for Total, Shared, Hugo, Benjamin, and vs budget. It flips below the dot when the total sits in the top 40% of the plot so it never covers the title. Clicking a month jumps to This month for that month.

Legend centered below the plot, `gap: 6px 16px`, 12px `#6b7280`: three 9px square swatches (shared, Hugo, Benjamin), a 2px `#111827` bar for Total, a 2px dashed `#dc2626` bar for Budget.

**Product over time** — pick a product, see its monthly spend as a column series with the same tooltip treatment.

### 3. Reports ("Where the money goes")

Rendered under both This month and Trends. Heading (Space Grotesk 700 19px `-0.01em`) with a segmented **Active month / All time** control on the right: `#f3f4f6` track, 8px radius, 2px padding; active segment white with `0 1px 2px rgba(17,24,39,0.10)` and `#111827` text, inactive `#6b7280`. Under it a 12px `#6b7280` caption naming the scope and its total, e.g. "All 8 months · 41 235,00 kr · net of discounts, excluded receipts omitted". The caption exists specifically so the reader is never guessing which scope they are reading.

Scope defaults to the month on This month and all time on Trends, and persists if changed by hand.

Two cards side by side, `repeat(auto-fit, minmax(290px, 1fr))`, `gap: 14px`, each white with `1px solid #f3f4f6`, 16px radius, section label in Geist Mono 10.5px uppercase `#6b7280`, rows separated by `1px solid #f3f4f6`.

**Top products** — grid `16px minmax(0,1fr) 56px 40px 82px`: rank (Geist Mono 10.5px `#9ca3af`), display name (13px, ellipsis), a 5px `#4b5563` bar scaled against the top product, `×N` count (Geist Mono 11px `#9ca3af`), amount (Geist Mono 12px, right). Top 9.

**By category** — grid `minmax(0,1fr) minmax(0,1.1fr) 82px`: category name, a 10px stacked bar of shared/Hugo/Benjamin proportions, amount. Sorted by total descending.

### 4. Receipts

Month-scoped, two panes, `repeat(auto-fit, minmax(290px, 1fr))`, `gap: 14px`. Above them, a keyboard-hint strip: Geist Mono 11px `#6b7280`, each hint a small white key cap (`1px solid #e5e7eb`, 5px radius) plus label — `↑ ↓` line, `← →` receipt, `S` shared, `H` Hugo, `B` Benjamin, `⌫` revert to inherited, `E` exclude receipt.

**Receipt list** — header row "7 receipts · September 2026" in Geist Mono 10.5px uppercase. Each row: grid `3px minmax(0,1fr) minmax(86px,auto)`, `gap: 11px`, `padding: 11px 16px 11px 13px`. A 3px × 30px rounded bar in the **buyer's** color at the left. Then store (13.5px/500, ellipsis) over meta (Geist Mono 10.5px `#6b7280`) reading `2026-09-05 13:48 · Hugo paid`. Right column, right-aligned: amount (Geist Mono 12.5px) over a flag (Geist Mono 9.5px uppercase `#9ca3af`) reading either "N inherited" or "all set by hand", or "excluded" in `#c2410c`. Selected row `#f3f4f6`, hover `#f9fafb`. Excluded rows render at `opacity: 0.45` with the amount struck through.

**Receipt detail** — header with store (Space Grotesk 700 15px) over meta `2026-09-05 13:48 · Hugo paid · kv_830104` (Geist Mono 10.5px), and an "Exclude receipt" / "Excluded — include again" toggle button on the right (outline; when excluded, `#fff7ed` fill, `#fed7aa` border, `#9a3412` text). When excluded, a `#fff7ed` banner below reads "Excluded from all totals and reports — paid privately, not from the shared account."

Item rows: grid `minmax(0,1fr) auto`, `padding: 9px 16px`, `border-top: 1px solid #f3f4f6`. Left: display name (13px `#111827`), then a meta line in Geist Mono 10px `#9ca3af` reading `1 st · from product default` / `0.842 kg · set on this line` / `2 st · from buyer · Hugo`. Right: the S/H/B segmented control (`#f3f4f6` track, 10px radius, 2px padding; each button 32×24, 6px radius, Geist Mono 12px/500 — filled in the consumer's color with white text when source is `line`, transparent with a `1.5px` inset ring and colored text when inherited), then the amount (Geist Mono 12.5px, `min-width: 68px`, right).

Product-level discounts appear on their parent row as a chip next to the meta text: Geist Mono 9.5px, `#ecfdf5` fill, `1px solid #a7f3d0`, `#047857` text, 5px radius, reading `−12,34 kr`, with a title attribute naming it. The amount column then shows the **net** figure with a muted `was 49,90 kr` beneath it in Geist Mono 10px `#9ca3af`.

Receipt-level discounts get their own row, last in the list, on a faint `#fcfdfc` ground, with an uppercase `receipt` chip (same green treatment) before the name, meta "applies to whole receipt · from buyer · Hugo", and the amount in `#047857`.

Keyboard cursor: the active row gets `box-shadow: inset 3px 0 0 #111827` and a `#f9fafb` background.

Footer of the pane: split summary, grid `repeat(auto-fit, minmax(96px, 1fr))`, `padding: 14px 16px`, `#f9fafb`, `border-top: 1px solid #e5e7eb` — Hugo, Benjamin, shared, receipt total, each a Geist Mono 9.5px uppercase colored label over a Geist Mono 13.5px value.

### 5. Products

Not month-dependent; no month stepper. An explanatory paragraph (13px `#4b5563`, `max-width: 720px`): "Consumer resolves in order: the line's own value, then this product default, then the receipt's buyer. Changing a default here moves every line that has no value of its own; lines set by hand stay put. Not affected by the selected month."

Controls row: a search input (`flex: 1`, `min-width: 220px`, `1px solid #e5e7eb`, 8px radius, `padding: 9px 12px`, 13px, focus border `#9ca3af`) with placeholder "Search raw_name, display_name or category", filtering case-insensitively across all three fields; and a toggle button "Only without default" / "Showing: no default".

Table, six columns `minmax(0,1.4fr) minmax(0,1fr) 104px 38px 84px 114px`, `gap: 12px`. Header row in Geist Mono 9.5px uppercase `0.07em` `#9ca3af`: `raw_name`, `display_name`, `category`, `n`, `total`, `default`. Rows `padding: 9px 16px`, `border-top: 1px solid #f3f4f6`: raw_name in Geist Mono 11px `#374151`; display_name in 13px, or "not reviewed" in `#9ca3af` when null; category 11.5px `#6b7280`; count and lifetime total in Geist Mono, right-aligned; and the same S/H/B control (32×24) writing `products.default_consumer`, right-justified. Sorted by lifetime total descending. Counts and totals span all months and ignore excluded receipts.

## Interactions & behavior

- **Month stepper** — `‹` goes back, `›` forward, clamped to the available range. Changing month clears the selected receipt and resets the keyboard cursor.
- **Tab switching** — sets the report scope: entering Trends switches it to all time, entering This month switches it to the month; a manual scope choice afterwards sticks.
- **Chart column click** — selects that month and switches to This month.
- **Receipt row click** — selects it and resets the cursor to the first line.
- **S/H/B click** — writes `receipt_lines.consumer`. Clicking the currently active chip when the source is `line` clears it back to NULL (inherited); clicking it when the value is inherited promotes it to an explicit value. Marking a line moves the keyboard cursor to that row.
- **Keyboard, Receipts tab only** — `↑`/`↓` or `j`/`k` move the line cursor; `←`/`→` or `[`/`]` move between receipts; `S`/`H`/`B` assign the cursor line and advance; `⌫`/`Delete` revert it to inherited; `E` toggles exclusion on the selected receipt. Ignore when a modifier is held or focus is in an input or textarea, and `preventDefault()` on every handled key. Cursor order is product lines first, then receipt-level discount lines.
- **Export CSV** — downloads the selected month's lines as UTF-8 with BOM, filename `food-expenses-sep-2026.csv`. Columns: `purchased_at` (ISO), `store`, `buyer`, `kivra_id`, `excluded`, `line_no`, `raw_name`, `display_name`, `category`, `quantity`, `line_total`, `consumer_explicit`, `consumer_resolved`, `resolved_from`, `is_discount`. Quote any field containing `"`, `,`, `;` or a newline, doubling inner quotes.
- **Responsive** — every grid is `auto-fit`/`minmax` and reflows to one column on a phone; the site is used on both desktop and phone. Nothing is fixed-width except the page's `max-width`.

All amounts format as `sv-SE` with exactly two decimals plus ` kr`, and negatives use a true minus (`−`), not a hyphen. Dates render `sv-SE` (`YYYY-MM-DD`) plus `HH:MM`.

## Totals — the rules that must not drift

- Receipts with `excluded = true` are omitted from every total, chart, and report. They stay visible in the receipt list, dimmed and struck through.
- All figures are **net of discounts**, both kinds.
- The month total equals the sum of the three person buckets. There is no fourth bucket.
- Category and top-product reports exclude receipt-level discounts; person and month totals include them.
- Product counts (`×N`) count article lines only, never discount lines.

## State

Server state is the three writable columns. Client state in the prototype:

| State | Purpose |
| --- | --- |
| `monthIdx` | selected month |
| `tab` | `month` / `trends` / `receipts` / `products` |
| `scope` | `month` / `all` for the reports |
| `selId` | selected receipt, falling back to the newest in the month |
| `cursor` | keyboard row index within the selected receipt |
| `hoverIdx`, `prodHoverIdx`, `prodSel` | chart hover and product-over-time selection |
| `prodQuery`, `unrevOnly` | Products tab search and filter |

In the real app, put `monthIdx`/`tab`/`scope` in the URL so a view is linkable, and treat the marking writes as optimistic updates against Supabase — marking is a rapid keyboard loop, so it must not wait on a round trip. `selId` should fall back to the newest receipt of the month whenever the current selection isn't in it.

Queries needed: receipts + lines for the active month (Receipts, This month); per-month aggregates across all months (Trends); all-time aggregates (reports at all-time scope); the full product list with lifetime counts and totals (Products). The per-month and all-time aggregates are good candidates for SQL views or RPCs, since the resolution chain is expressible as `coalesce(rl.consumer, p.default_consumer, r.buyer)`.

## Design tokens

**Consumer colors — fixed in code, not themeable.** The legend must mean the same thing in every view.

| Token | Value |
| --- | --- |
| Hugo | `#2563eb` |
| Benjamin | `#16a34a` |
| shared | `#9333ea` |
| Total line / ink | `#111827` |
| Budget / over budget | `#dc2626` |
| Discount text | `#047857`, on `#ecfdf5` with `#a7f3d0` border |
| Discounts-saved dot | `#059669` |
| Page background | `#f9fafb` |
| Card | `#ffffff`, border `#f3f4f6` |
| Control border | `#e5e7eb`, hover `#9ca3af` |
| Muted text | `#6b7280`; faint `#9ca3af`; strong secondary `#374151` / `#4b5563` |
| Selected / track | `#f3f4f6` |
| Hover ground | `#f9fafb` |
| Warning ground | `#fff7ed`, border `#fed7aa`, text `#9a3412` / `#c2410c` |
| Chart grid | dashed `#cccccc` |

Radii: 16px cards, 8px controls and inputs, 10px segmented tracks, 6px segment buttons, 5px chips and key caps, 2px chart bars.

Shadows: cards `0 1px 3px rgba(17,24,39,0.06)`; chart card `0 10px 15px -3px rgba(17,24,39,0.08), 0 4px 6px -4px rgba(17,24,39,0.05)`; tooltips `0 10px 15px -3px rgba(17,24,39,0.14)`; buttons `0 1px 2px rgba(17,24,39,0.04)`.

Spacing: page stack 18px, section stack 28px, card grids 12–14px, card padding 16–20px, row padding 9–11px vertical / 16px horizontal.

Type: **Space Grotesk** 500/600/700 for headings, the month label, and bucket amounts; **IBM Plex Sans** 400/500 for body and row text; **Geist Mono** 400/500 for all numbers, metadata, and labels. Scale in use: 34px h1, 19px section, 16px card title, 15px selected-receipt name and month label, 13.5px row title, 13px body, 12.5px amounts, 11.5–12px meta, 10.5px mono labels, 9.5–10px uppercase micro-labels. These match the three families already loaded in `app/layout.tsx`.

The only intentionally tweakable value is the **monthly budget**, default `6000`, which should live as a constant in code (the user asked for hard-coded). It drives both the budget bar and the chart's reference line.

## Assets

None. No images, no icon set — the only glyphs are `‹ › ↑ ↓ ← → ⌫ ×` as text. Fonts come from the three families already in the repo.

## Files

- `Food Expenses.dc.html` — the full design: all four tabs, the resolution chain, both discount kinds, CSV export, and the keyboard loop, with mock data
- `support.js` — the prototype's runtime, bundled only so the HTML opens in a browser. Not to be ported.
- `github.md` — records which repo files the design was aligned to, per screen
