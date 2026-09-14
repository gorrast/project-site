-- ============================================================
-- Ad-hoc SQL for the ICA importer. Not views (docs/ica-schema.sql is
-- deliberately three tables and nothing derived) — copy-paste these into
-- the Supabase SQL editor as needed.
-- ============================================================

-- ------------------------------------------------------------
-- Review queue: unclassified raw product strings, ordered by how much
-- money and how many receipt lines they represent, so the most impactful
-- ones to classify show up first.
-- ------------------------------------------------------------
select
  p.raw_name,
  count(rl.id)                as line_count,
  coalesce(sum(rl.line_total), 0) as total_amount,
  min(r.purchased_at)         as first_seen,
  max(r.purchased_at)         as last_seen
from ica.products p
left join ica.receipt_lines rl on rl.raw_name = p.raw_name
left join ica.receipts r on r.id = rl.receipt_id
where p.display_name is null
group by p.raw_name
order by total_amount desc;

-- ------------------------------------------------------------
-- Reconciliation audit: receipts where the stored line totals don't sum to
-- the stored receipt total, within 0.01. The importer computes this check
-- once at import time from in-memory Decimal values (handoff §7.8) and
-- prints it — this query re-derives the same check from what actually
-- landed in the database, useful for auditing after the fact (e.g. after a
-- parser bug fix, to see which already-imported receipts are affected).
-- ------------------------------------------------------------
select
  r.id,
  r.kivra_id,
  r.purchased_at,
  r.store,
  r.total,
  coalesce(sum(rl.line_total), 0) as line_total_sum,
  r.total - coalesce(sum(rl.line_total), 0) as diff
from ica.receipts r
left join ica.receipt_lines rl on rl.receipt_id = r.id
group by r.id, r.kivra_id, r.purchased_at, r.store, r.total
having abs(r.total - coalesce(sum(rl.line_total), 0)) > 0.01
order by r.purchased_at desc;

-- ------------------------------------------------------------
-- Consumer drift: discount/deposit lines whose consumer no longer matches
-- their parent article's consumer. The importer sets these to match at
-- import time (supabase_io._resolve_consumers), but nothing in the database
-- stops a later hand-edit (e.g. via the SQL editor, since there's no UI yet)
-- from setting one without the other — this surfaces that rather than
-- silently letting a discount's split diverge from the item it discounts.
-- Whichever frontend eventually handles consumer assignment should cascade
-- an edit on an article line to its linked lines; until then, run this
-- after any manual `consumer` edit involving a line that has (or is) a
-- discount/deposit.
-- ------------------------------------------------------------
select
  child.id           as line_id,
  child.raw_name     as line_raw_name,
  child.consumer     as line_consumer,
  parent.id          as parent_line_id,
  parent.raw_name    as parent_raw_name,
  parent.consumer    as parent_consumer,
  child.receipt_id
from ica.receipt_lines child
join ica.receipt_lines parent on parent.id = child.applies_to_line_id
where child.consumer is distinct from parent.consumer
order by child.receipt_id, child.line_no;

-- Fix: sync every drifted child to match its parent's current consumer (the
-- article is the source of truth — a discount/deposit shouldn't have its
-- own independent classification). Review the detection query above first;
-- this applies to *every* mismatch found, with no per-row confirmation.
update ica.receipt_lines child
set consumer = parent.consumer
from ica.receipt_lines parent
where parent.id = child.applies_to_line_id
  and child.consumer is distinct from parent.consumer;
