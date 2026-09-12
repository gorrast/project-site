# Verify — ICA Kivra importer

Everything here that touches Kivra or the database needs a human with BankID; none of it has
been run. Static checks (imports, dependencies, the vendoring independence test) have already
been verified and are listed at the end for completeness.

## Prerequisites

1. Run `docs/ica-schema.sql` in the Supabase SQL editor (find-replace `person_a`/`person_b`
   with `Hugo`/`Benjamin` first if you haven't already — check the CHECK constraints).
2. `KIVRA_HUGO_PNR` and `KIVRA_BENJAMIN_PNR` are already set in `.env.local`.
   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already present and reused
   as-is.
3. `ICA_CARD_LAST4` in `.env.local` currently has only one card's last 4 digits (`9683`) — the
   second is still a placeholder. Any receipt paid with an unrecognized card still imports, but
   gets `receipts.excluded = true` automatically. See §7 below for what to do once the second
   card is known.
4. Every invocation below authenticates fresh via BankID — have the app open and ready before
   running.

Invocation form: `uv run python -m scripts.kivra.cli --person {Hugo,Benjamin} [options]`, run
from the repo root.

## Checklist

### 1. First import, dry-run (handoff §12 item 9)

```bash
uv run python -m scripts.kivra.cli --person Hugo --max-receipts 1 --dry-run
```

Expect: BankID QR flow, then one parsed receipt printed (store, date, total, each line), then
the final report with `imported: 0`. No database writes.

Check:
```sql
select count(*) from ica.receipts;
```
Should be unchanged from before the run.

### 2. Same run for real (item 10)

```bash
uv run python -m scripts.kivra.cli --person Hugo --max-receipts 1
```

Expect: same flow, `imported: 1` in the final report.

Check:
```sql
select
  r.id, r.kivra_id, r.total,
  (select count(*) from ica.receipt_lines l where l.receipt_id = r.id) as line_count,
  (select coalesce(sum(line_total), 0) from ica.receipt_lines l where l.receipt_id = r.id) as line_sum
from ica.receipts r
order by imported_at desc
limit 1;
```
`line_sum` should equal `total`, within 0.01.

### 3. Re-run is a no-op (item 11)

```bash
uv run python -m scripts.kivra.cli --person Hugo --max-receipts 1
```

Expect: `skipped_duplicate: 1`, `imported: 0` in the final report.

Check:
```sql
select count(*) from ica.receipts;
```
Unchanged from step 2.

### 4. Full run (item 12)

```bash
uv run python -m scripts.kivra.cli --person Hugo
```

Expect: completes, and the final report's `reconciliation_failures` count is printed (there is
deliberately no SQL view for this — the check is computed in Python from the parsed totals at
import time; `scripts/kivra/queries.sql`'s reconciliation audit query re-derives the same check
from what's actually stored, useful afterward but not the primary signal).

### 5. Manual `consumer` edit survives a re-run (item 13)

Pick a line id from a receipt already imported:
```sql
select id, raw_name, consumer from ica.receipt_lines where receipt_id = '<a receipt id>' limit 5;
```

Edit it:
```sql
update ica.receipt_lines set consumer = 'Hugo' where id = <the id you picked>;
```

Re-run the importer for the same person, then check the edit held:
```sql
select consumer from ica.receipt_lines where id = <the same id>;
```
Should still read `'Hugo'`.

### 6. Changing `default_consumer` doesn't touch history (item 14)

Pick a `raw_name` that already has imported rows:
```sql
select raw_name from ica.receipt_lines limit 1;
```

Change its default:
```sql
update ica.products set default_consumer = 'shared' where raw_name = '<that raw_name>';
```

Re-run the importer (ideally against a receipt not yet imported, so a genuinely new row is
written), then:
```sql
select id, receipt_id, consumer, imported_at
from ica.receipt_lines rl
join ica.receipts r on r.id = rl.receipt_id
where rl.raw_name = '<that raw_name>'
order by r.imported_at;
```
Rows from before the `update` should keep their original `consumer` value; only rows from a
receipt imported *after* the `update` should show `'shared'`.

### 7. Adding the second card later

`excluded` is set once, at import time, from `ICA_CARD_LAST4` — like `consumer`, an import never
touches it again on a receipt that's already in the database. So once the second card's last-4
digits are known:

1. Add it to `ICA_CARD_LAST4` in `.env.local` (comma-separated, e.g. `9683,4321`).
2. Any receipt imported *after* that change is handled correctly automatically.
3. Anything imported *before* that change, using the now-newly-recognized card, is stuck with
   whatever `excluded` value it got at the time — fix it by hand:
   ```sql
   -- Find candidates: receipts currently marked excluded, to eyeball which ones
   -- should flip now that the second card is configured.
   select id, kivra_id, purchased_at, store, total
   from ica.receipts
   where excluded = true
   order by purchased_at desc;
   ```
   ```sql
   -- Once you've identified the ones that should now be included:
   update ica.receipts set excluded = false where id in ('<id1>', '<id2>', ...);
   ```
   There's no way to re-derive this automatically after the fact — `paymentInformation` is
   preserved in `raw_payload` (jsonb) if you ever need to double-check which card a given
   receipt actually used.

## Already verified (no BankID needed)

- `uv sync` succeeds; single `pyproject.toml` and `.venv` at repo root; `weasyprint` absent from
  `uv.lock`.
- `uv run python -m scripts.kivra.cli --help` works with no network or credentials.
- `grep -ri "service_role" --include="*.ts" --include="*.tsx" .` returns nothing.
- `scripts/kivra/vendor/` (kivra/api.py, kivra/auth.py, kivra/models.py, kivra/__init__.py,
  utils/helpers.py, interaction/base.py, interaction/web.py, interaction/web_static/) is present;
  `scripts/kivra/NOTICE.md` records the upstream URL, tag `v1.1.2`, commit
  `bcbcc0366bae96dd2273c25975773cdffd71d47a`, and every local modification.
  `scripts/kivra/LICENSE` is present (kept at this level per the handoff's own §4 tree — note
  its §12 item 6 says `vendor/` should contain `LICENSE`, which contradicts §4; flagging rather
  than silently picking one).
- Independence test (§6.3) passes: with `scripts/kivra-sync/` renamed away,
  `uv run python -m scripts.kivra.cli --help` still works.
- `scripts/kivra-sync/` is in `.gitignore` and `git ls-files -s scripts/kivra-sync` returns
  nothing (never committed).
- `parse.py` reconciles exactly (line sum == receipt total, no warnings) against two real
  receipts (a plain one, and one with per-item discounts/multi-quantity), and
  `get_card_last4_digits` is unit-tested against a synthetic payload matching the real format.
  Run with `uv run python -m scripts.kivra.tests.test_parse`.
