-- ============================================================
-- ICA receipt analysis — schema "ica"
-- Run in the Supabase SQL editor.
--
-- BEFORE RUNNING: find-replace 'person_a' and 'person_b' with
-- your actual identifiers. They appear in three CHECK
-- constraints below and must match the BUYER_* values in the
-- importer's .env.
-- ============================================================

create schema if not exists ica;

-- ------------------------------------------------------------
-- products
-- One row per RAW receipt string, not per real-world product.
-- display_name / category / default_consumer are curated by
-- hand and must never be overwritten by an import.
-- NULL display_name = not yet reviewed.
-- ------------------------------------------------------------
create table ica.products (
  raw_name          text primary key,
  display_name      text,
  category          text,
  default_consumer  text
    check (default_consumer in ('shared', 'Hugo', 'Benjamin')),
  created_at        timestamptz not null default now()
);

comment on table ica.products is
  'Keyed on the literal string as printed on the receipt. Several rows may share a display_name.';
comment on column ica.products.default_consumer is
  'Copied into receipt_lines.consumer at import time only. Changing it never affects existing rows.';

-- ------------------------------------------------------------
-- receipts
-- One row per receipt. buyer is set by the importer from the
-- identity number it was invoked with, not read from payload.
-- excluded is set by a human; imports must not touch it.
-- ------------------------------------------------------------
create table ica.receipts (
  id            uuid primary key default gen_random_uuid(),
  kivra_id      text not null unique,
  purchased_at  timestamptz not null,
  buyer         text not null
    check (buyer in ('Hugo', 'Benjamin')),
  store         text,
  total         numeric(10,2) not null,
  excluded      boolean not null default false,
  raw_payload   jsonb not null,
  imported_at   timestamptz not null default now()
);

comment on column ica.receipts.kivra_id is
  'Idempotency key. An existing kivra_id means the receipt is skipped entirely on re-import.';
comment on column ica.receipts.excluded is
  'Human flag for ICA purchases paid with a private card rather than the shared account.';
comment on column ica.receipts.raw_payload is
  'Unmodified Kivra response. Allows re-parsing without repeating BankID authentication.';

-- ------------------------------------------------------------
-- receipt_lines
-- Articles and discounts alike. A row with applies_to_line_id
-- set IS a discount; there is no line-type column.
-- consumer NULL = not yet reviewed (distinct from 'not shared').
-- ------------------------------------------------------------
create table ica.receipt_lines (
  id                  bigint generated always as identity primary key,
  receipt_id          uuid not null
                        references ica.receipts(id) on delete cascade,
  line_no             int not null,
  raw_name            text not null
                        references ica.products(raw_name),
  quantity            numeric(10,3),
  line_total          numeric(10,2) not null,
  consumer            text
                        check (consumer in ('shared', 'Hugo', 'Benjamin')),
  applies_to_line_id  bigint
                        references ica.receipt_lines(id) on delete cascade,
  constraint receipt_lines_unique_position unique (receipt_id, line_no),
  constraint receipt_lines_no_self_reference check (applies_to_line_id is distinct from id)
);

comment on column ica.receipt_lines.line_no is
  'Receipt order is semantic: discount rows follow the article they apply to.';
comment on column ica.receipt_lines.quantity is
  'Fractional for weight-based items (e.g. 0.734 kg). NULL when the receipt gives no quantity.';
comment on column ica.receipt_lines.applies_to_line_id is
  'Set = this line is a discount against that article line. Must point to a line on the same receipt.';

create index receipts_purchased_at_idx
  on ica.receipts (purchased_at desc);
create index receipts_buyer_idx
  on ica.receipts (buyer);
create index receipt_lines_receipt_idx
  on ica.receipt_lines (receipt_id);
create index receipt_lines_raw_name_idx
  on ica.receipt_lines (raw_name);
create index receipt_lines_unreviewed_idx
  on ica.receipt_lines (consumer)
  where consumer is null;

-- ------------------------------------------------------------
-- No views.
--
-- The reconciliation check (line totals must sum to the receipt
-- total) is done in Python at import time, where the numbers are
-- already in memory. The review-queue query belongs with the UI
-- and should be added when the UI exists and its shape is known.
-- Both are kept as ad-hoc SQL in scripts/kivra/queries.sql.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Row level security
-- Both roommates see all data, so the policies are open to any
-- authenticated user. RLS is still enabled: without it, the
-- anon key would expose every row publicly.
-- The importer uses the service_role key and bypasses RLS.
-- ------------------------------------------------------------
alter table ica.products      enable row level security;
alter table ica.receipts      enable row level security;
alter table ica.receipt_lines enable row level security;

create policy authenticated_all on ica.products
  for all to authenticated using (true) with check (true);
create policy authenticated_all on ica.receipts
  for all to authenticated using (true) with check (true);
create policy authenticated_all on ica.receipt_lines
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Grants
-- Needed because this is not the public schema. The anon role
-- gets usage only, so unauthenticated requests are rejected by
-- the policies above rather than by a missing grant.
-- ------------------------------------------------------------
grant usage on schema ica to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema ica to authenticated, service_role;
grant usage, select
  on all sequences in schema ica to authenticated, service_role;

alter default privileges in schema ica
  grant select, insert, update, delete on tables to authenticated, service_role;

-- ------------------------------------------------------------
-- FINAL STEP, not SQL:
-- Supabase only exposes the public schema over the Data API by
-- default. To query these tables from the client later, add
-- "ica" under Project Settings -> API -> Exposed schemas.
-- Not needed for the Python importer, which connects as
-- service_role.
-- ------------------------------------------------------------
