# Handoff: Kivra receipt importer

## 0. Read this first

This document was written by someone who has read **only the kivra-sync README**, not its
source code. Every claim about which files exist, what they contain, or how the vendored
code is structured is a **hypothesis to verify**, not a fact. Where this document and the
actual code disagree, the code wins — but say so in your report rather than silently
diverging.

The upstream project is `felixandersen/kivra-sync` (MIT), already cloned into
`scripts/kivra-sync/` in this repo at tag `v1.1.2`, commit
`bcbcc0366bae96dd2273c25975773cdffd71d47a`. That has been verified — take it as given rather
than re-deriving it.

---

## 1. What this project is

Two roommates share an ICA Banken account. Both deposit an equal amount each month, and
groceries are bought from it. They want to see, per person and per time period, what the
money actually went to at the article level — and specifically to distinguish groceries
they share from groceries only one of them consumes.

ICA sends itemised digital receipts to each person's Kivra inbox (triggered by scanning
their own Stammis card at checkout). Kivra offers no export and no consumer API, so the
data has to be pulled with a community tool.

## 2. Scope of this task

**In scope:**

1. Copy the needed parts of `scripts/kivra-sync/` into `scripts/kivra/`, then delete
   `scripts/kivra-sync/` once a real run is confirmed working.
2. Fetch ICA receipts from Kivra using the vendored auth + API code.
3. Parse the structured receipt payload into products, receipts, and receipt lines.
4. Write the result idempotently into a Supabase Postgres schema named `ica`.
5. A CLI to run all of this locally.

**Explicitly out of scope** — do not build, scaffold, or stub these:

- Any UI. No Next.js pages, components, API routes, or server actions.
- The review queue interface. Its query lives in `queries.sql` as ad-hoc SQL for now.
- Any scheduling, cron, GitHub Action, or background worker.
- Any Docker or deployment configuration for the Python code.

## 3. Hard constraints

These are not preferences. Violating any of them means the work has to be redone.

**3.1 Authentication is interactive and cannot be automated.** kivra-sync authenticates by
displaying a BankID QR code that a human scans with their phone, on every run. There are no
storable credentials. Do not design around a service account, a refresh token, or a cached
session unless you find hard evidence in the code that Kivra issues a long-lived token — and
if you do find that, report it rather than relying on it.

**3.2 One run covers one person.** Each roommate can only fetch their own inbox, with their
own BankID. There is no combined fetch. The CLI takes a personal identity number and
produces rows attributed to that one person.

**3.3 Do not parse PDFs.** Upstream installs `weasyprint`, an HTML-to-PDF renderer, which
strongly implies Kivra returns structured receipt data that upstream *renders* to PDF for
archival. Parsing that generated PDF back into line items would be pointless information
loss. Take the line items from the API response. See §5 — this is the first thing to verify.

**3.4 The Python code must never be deployed.** It holds the Supabase `service_role` key and
personal identity numbers. It shares this repo with the Next.js app for convenience only.
Before writing any code, confirm that `.venv` and the env file are in `.gitignore`, and add
the Python directory and env file to `.vercelignore` so a deploy never bundles them.

**3.5 Preserve the MIT licence.** Keep upstream's `LICENSE` inside the vendored directory and
add a `NOTICE.md` recording the upstream repo URL, the release tag, and the exact commit SHA
you copied from. That SHA is the only upgrade path: when Kivra changes its API and upstream
fixes it, the SHA is what lets a future diff show precisely what changed.

## 4. Repo integration

Two directories matter, and the distinction is the core of this task.

**`scripts/kivra-sync/` — the full upstream repo, already cloned, temporary.** Read-only as far
as you are concerned. Nothing in here is the deliverable. It gets deleted at the end (§6.4).

**`scripts/kivra/` — the deliverable.** Everything the importer actually needs lives here, and
only here. When `scripts/kivra-sync/` is gone, `scripts/kivra/` must still work.

```
scripts/kivra/
  vendor/              # files copied from scripts/kivra-sync/, minimally modified
    kivra/
    utils/
    interaction/
  NOTICE.md            # upstream URL, tag, commit SHA, local modifications
  LICENSE              # upstream MIT, verbatim
  __init__.py
  cli.py               # our code from here down
  parse.py
  supabase_io.py
  config.py
  queries.sql          # ad-hoc SQL: review queue, reconciliation audit
```

This slots into the uv project that already exists in this repo. **Do not create a second
one.** Read the existing `pyproject.toml`, `uv.lock`, and `.python-version` first and follow
whatever conventions are already there — entry-point style, lint config, formatter settings.

Rules for the integration:

- **One virtualenv, one lockfile.** Add dependencies with `uv add` at the project root. Do not
  create a nested `.venv`, a second `pyproject.toml`, a `requirements.txt`, or a
  `.python-version` under `scripts/`.
- **Resolve importability explicitly.** A directory under `scripts/` is not part of the
  project's package path by default. Decide how the code gets imported — `__init__.py` files
  plus `python -m scripts.kivra.cli` from the repo root is the least invasive option, and
  adding it to the build config is also fine if that matches the existing project's style.
  Whatever you pick, state it in `docs/verify.md`. **No `sys.path` manipulation.**
- **Do not add `weasyprint`.** It needs native libraries uv cannot install, and §3.3 means we
  never render PDFs. Reconcile upstream's `requirements.txt` against the existing project
  dependencies and add only what the code paths we keep actually import.
- **Watch for version conflicts.** Upstream may pin a version of `requests`, `httpx`, or
  similar that clashes with something already in the project. If `uv add` reports a resolution
  conflict, stop and report it — do not loosen an existing pin to make it resolve.
- Keep our code and vendored code in separate directories, so that when upstream changes the
  diff stays confined to `vendor/`.
- Upstream may use absolute imports like `from kivra import api`. Rewriting those to relative
  imports is an acceptable local modification; record it in `NOTICE.md`.
- If the existing project has a config or secrets pattern already, extend it rather than
  introducing a parallel one. §10 describes what the importer needs, not how it must be stored.

## 5. Phase 0 — build a probe the human runs

**This is a blocking step. Stop and hand back to the human before starting Phase 1.**

The entire design rests on Kivra returning receipt line items as data rather than as
render-ready HTML. This has to be confirmed against a real receipt before a parser is worth
writing.

**You cannot run this yourself.** Kivra authenticates with a BankID QR code that a human
scans on their phone, and the QR expires quickly. There is no headless path, no test account,
and no fixture to work from. Your job in this phase is to read the code and produce a probe
that the human runs once, plus instructions clear enough to follow without reading the source.

**5.1 Read the upstream code and capture its provenance.**

1. **Before anything else**, write `scripts/kivra/NOTICE.md` with the upstream URL
   (`https://github.com/felixandersen/kivra-sync`), tag `v1.1.2`, and commit
   `bcbcc0366bae96dd2273c25975773cdffd71d47a`. These are already verified; just record them.
   Do this now, not later — `scripts/kivra-sync/` gets deleted in §6.4 and this file becomes
   the only record of what the vendored code came from. It is the sole upgrade path when Kivra
   changes its API.
2. Read `scripts/kivra-sync/kivra_sync.py` to learn the correct call order: auth → list →
   fetch contents.
3. Read `scripts/kivra-sync/kivra/` to find the exact function that returns one receipt's
   contents, and note what type it returns (dict, str, response object).
4. Note where `weasyprint` is imported. If it's imported at module load on a path we need,
   move the import inside the rendering function so the fetch path works without it.

**5.2 Write the probe.** A single throwaway command that authenticates, fetches **one**
receipt, writes the untouched response to a file, and writes nothing to the database. It must:

- print the QR code to the terminal and wait for the scan, using upstream's `local`
  interaction provider
- stop after one receipt
- dump with `json.dumps(..., indent=2, ensure_ascii=False)` if the response is JSON, or write
  bytes verbatim if it's HTML — do not normalise, prettify, or strip anything
- print the absolute path of the dumped file when it finishes

Do not reuse upstream's `--dry-run`: it only skips storage, still authenticates and fetches,
and prints nothing useful.

The probe may run against `scripts/kivra-sync/` directly at this stage — copying into
`scripts/kivra/` is Phase 1's job, and the probe exists to find out what to copy.

**5.3 Write instructions for the human.** Put them in `docs/probe.md`, in this order, and
assume the reader will not open any Python:

- the exact command to run, copy-pasteable, with the identity number as a placeholder
- what appears on screen, in sequence, and roughly how long each step takes
- that the BankID app should be open and ready *before* running, because the QR expires
- where the dump file lands
- what to do if it fails: the two or three most likely errors, what each means, and whether
  rerunning is safe
- a one-line reminder that the dump holds real purchase data and must not be committed

Add the dump path to `.gitignore` as part of this phase, not after.

**5.4 What the human reports back.** Ask for the shape of one receipt — amounts and store can
be redacted — and specifically whether it contains:

- individual article rows with a name and an amount
- quantity, and whether weight-based items are expressed differently from countable ones
- discount rows, and whether they are linked to the article they apply to or only positionally
  adjacent
- a stable per-receipt identifier
- a timestamp, and whether it includes the time of day or only the date
- the store name
- anything indicating which card was used

Put this as a short checklist at the end of `docs/probe.md` so it can be answered by scanning
the dump.

**5.5 Stop.** Do not write `parse.py` against a guessed structure. If the payload turns out to
be render-ready HTML with no line-item data, the design changes materially and needs a human
decision.

## 6. Phase 1 — vendoring from `scripts/kivra-sync/` into `scripts/kivra/`

The full upstream repo is already at `scripts/kivra-sync/`. The job is to move only what's
needed into `scripts/kivra/vendor/`, then delete the original. Work in that direction: **copy
generously, then prune** — copy a file if you're unsure, and remove it once you've proven
nothing imports it. Pruning before you understand the call graph costs more time than it saves.

**6.1 What to copy.** Hypotheses to test, not instructions to follow blindly. Paths are
relative to `scripts/kivra-sync/`.

| Path | Expectation | Note |
|---|---|---|
| `kivra/` | **Copy** | auth, API client, models. The core value. |
| `utils/` | **Copy what's imported** | check actual imports before pruning |
| `interaction/local` | **Copy** | terminal QR rendering — needed for BankID |
| `interaction/web`, `interaction/ntfy` | Leave | headless triggering we don't want |
| `storage/` | Leave | replaced entirely by `scripts/kivra/supabase_io.py` |
| `Dockerfile`, `docker-compose.yml` | Leave | see §3.4 |
| `flake.nix`, `flake.lock` | Leave | we use uv |
| `.github/workflows/` | Leave | |
| `requirements.txt` | Read, leave | source for `uv add` decisions; never copied in |
| `package.json`, `package-lock.json` | **Investigate first** | JS in a Python tool is odd. Likely QR rendering for the web interaction provider. If so, leave. If the terminal QR path depends on it, that's a finding worth reporting. |
| `test_qr_refresh.py` | Read, leave | may document the auth polling loop |
| `kivra_sync.py` | Read, leave | the upstream CLI; our `cli.py` replaces it |
| `CHANGELOG.md`, `VERSION`, `__version__.py` | Leave | version goes in `NOTICE.md` |
| `LICENSE` | **Copy** | required by §3.5 |

**6.2 Modify as little as possible.** Prefer a thin adapter in `scripts/kivra/` over editing
`vendor/`. Where you must edit — import rewrites, moving the weasyprint import — keep it small
and log it in `NOTICE.md` under a "Local modifications" heading.

**6.3 Prove independence.** Before the deletion gate, `scripts/kivra/` must run with
`scripts/kivra-sync/` renamed out of the way. Test it:

```bash
mv scripts/kivra-sync scripts/.kivra-sync-hidden
uv run python -m scripts.kivra.cli --help
```

If that fails, something still resolves against the original tree — most likely an absolute
import that happens to work only because both directories are reachable. Fix it, then restore
the directory for the human's verification run.

**6.4 The deletion gate.** `scripts/kivra-sync/` is deleted **only after** the human confirms
a real end-to-end run works (§12, items 9 and 10). Do not delete it yourself as part of Phase 1
or Phase 2. Until then it's the reference you diff against when something behaves unexpectedly.

Preconditions for deletion, all of which must hold:

- `NOTICE.md` records the URL, tag, and commit SHA (§5.1 step 1).
- `LICENSE` is present in `scripts/kivra/vendor/`.
- §6.3 passes.
- The human has confirmed a successful import of at least one real receipt.

Then `rm -rf scripts/kivra-sync/`. It carries its own nested `.git` (confirmed), which means
`git add -A` would create a mode `160000` gitlink rather than committing the files — a broken
submodule reference, not a bloated repo. It is currently untracked and must stay that way: add
`scripts/kivra-sync/` to `.gitignore` in Phase 1, and if `git ls-files -s scripts/kivra-sync`
ever returns anything, run `git rm --cached scripts/kivra-sync` before committing.

## 7. Phase 2 — the import pipeline

Run `schema.sql` in Supabase before this phase. Semantics of each field are in §8.

**7.1 Fetch and filter.** Authenticate, list receipts, keep only those from ICA. Filter on
sender, not on payment method — the receipt does not know which card was used, so ICA
purchases made with a private card *will* enter the dataset. This is accepted: they get
excluded by hand later via `receipts.excluded`. Do not try to guess.

**7.2 Idempotency.** Before fetching a receipt's contents, check whether its `kivra_id`
already exists in `ica.receipts`. If so, skip it entirely. Never update an existing receipt
row — its lines may carry human edits. Re-running the importer must be a no-op for anything
already imported.

**7.3 Store the raw payload.** Write the unmodified response into `receipts.raw_payload`
(jsonb) in the same transaction as the parsed rows. The parser will be wrong in the first
weeks; this is what lets it be re-run without redoing BankID.

**7.4 Product upsert.** For each article row, upsert `ica.products` on `raw_name`. On
conflict, **do nothing**. `display_name`, `category`, and `default_consumer` are
human-curated and must never be overwritten by an import. New raw strings arrive with those
three columns NULL, which is what puts them in the review queue.

**7.5 Freeze the consumer.** Set `receipt_lines.consumer` once, at import, by copying
`products.default_consumer` for that `raw_name`. If the product has no default, leave it
NULL — NULL means "not yet reviewed" and is deliberately distinct from "not shared".
Changing a product's default later must **not** alter existing rows. Historical totals do not
move.

**7.6 Discounts.** A line with `applies_to_line_id` set *is* a discount; there is no line-type
column. Discount amounts are stored negative. Link a discount to the article it applies to if
the payload expresses that relationship. If it only expresses adjacency, link to the nearest
preceding article line and note in your report that this is heuristic. Deposits (pant), bags,
and rounding are ordinary article rows with their own category.

**7.7 Transaction boundaries.** One receipt = one transaction: the receipt row, its lines, and
its product upserts commit together or not at all. A crash mid-run must leave no partial
receipt. Because of §7.2, re-running resumes cleanly.

**7.8 Report at the end.** Print: receipts seen, skipped as duplicates, imported; lines
imported; new products created; and any receipt where line totals don't sum to the receipt
total. Compute that last check in Python, comparing the parsed line sum against the receipt
total while both are still in memory — there is no database view for it, by design. That
number is your parser's error rate, so surface it loudly rather than burying it.

## 8. Data model semantics

`ica.products` — one row per **raw receipt string**, not per real-world product. Deliberate:
it keeps the schema to three tables at the cost of `display_name = 'Mjölk'` appearing on
several rows. NULL `display_name` means unreviewed.

`ica.receipts` — one row per receipt. `buyer` is set by the importer from the identity number
the CLI was invoked with, not read from the payload. `excluded` is set by a human and must
never be touched by an import.

`ica.receipt_lines` — one row per receipt line, articles and discounts alike. `line_no`
preserves receipt order, which is semantic. `quantity` is nullable and may be fractional for
weight-based items. `consumer` is nullable; see §7.5.

**Invariants the importer must uphold:**

- `sum(line_total) = receipts.total` per receipt, within 0.01. Log violations, don't crash.
- No `receipt_lines` row without a `receipt_id`.
- `applies_to_line_id` only ever points to a line on the same receipt.
- `line_total` is negative for discount rows.

## 9. Edge cases to handle explicitly

- Weight items (`0,734 kg à 89,90`) — fractional quantity, not quantity 1.
- Multi-quantity items (`3 × 12,90`) — one row, quantity 3.
- Receipt-level discounts not attached to any article — allowed: `applies_to_line_id` NULL and
  a category marking them as a discount. Note this case in your report.
- Returns and credited items — negative amounts on an otherwise normal article row.
- Öresavrundning — a line, not a rounding error to swallow.
- Non-grocery items on ICA receipts (tobacco, flowers, Systembolaget-forwarded goods,
  pharmacy) — import them normally, categorisation happens later.
- Two receipts on the same day from the same store — `kivra_id` disambiguates, not the date.
- Duplicate `raw_name` within a single receipt (same item scanned twice on separate lines) —
  two rows, one product.

## 10. Configuration

If the existing project already loads environment variables somehow, extend that mechanism.
Otherwise a git-ignored `.env` at the project root with a committed `.env.example`. Either way
these are the values the importer needs:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
KIVRA_PERSON_A_PNR=
KIVRA_PERSON_B_PNR=
BUYER_PERSON_A=person_a
BUYER_PERSON_B=person_b
```

Map identity number to `buyer` value via config; never hardcode. The identity number must
never be written to the database or to logs.

## 11. CLI

Run from the project root against the shared virtualenv, using whichever import mechanism you
settled on in §4. Add a `[project.scripts]` entry if the existing project uses them:

```
uv run python -m scripts.kivra.cli --person person_a [options]

--person {person_a,person_b}   required; selects pnr and sets buyer
--max-receipts N               default 0 (unlimited); N for testing
--since YYYY-MM-DD             optional; skip older receipts
--dry-run                      fetch and parse, print summary, write nothing
--dump-raw DIR                 write raw payloads to disk for parser debugging
```

`--dry-run` here must mean *no database writes at all*, unlike upstream's version.

Every invocation, including `--dry-run`, blocks on a BankID scan. Keep the terminal output
quiet until the QR is displayed, and print a clear line when the scan is being waited on —
the human has a short window and should not be hunting for the prompt in a wall of log lines.

## 12. Acceptance criteria

Nothing that touches Kivra can be verified without a human at a phone. Split the list and be
explicit about which half you have actually checked.

**You can verify these on your own:**

1. `uv sync` succeeds, no nested virtualenv or second `pyproject.toml` exists, and
   `weasyprint` is absent from the lockfile.
2. The CLI imports cleanly and `--help` works without network or credentials.
3. `parse.py` is unit-testable against a saved payload fixture, and passes on the dump from
   Phase 0. Write the fixture from the real dump, not from an invented example.
4. Parser unit tests cover every case in §9 that the real payload turns out to contain.
5. `grep -ri "service_role" --include="*.ts" --include="*.tsx" .` returns nothing.
6. `scripts/kivra/vendor/` contains `LICENSE`, and `NOTICE.md` records the upstream URL, tag
   `v1.1.2`, commit `bcbcc0366bae96dd2273c25975773cdffd71d47a`, and every local modification
   you made.
7. The §6.3 independence test passes: with `scripts/kivra-sync/` renamed away,
   `uv run python -m scripts.kivra.cli --help` still works.
8. `scripts/kivra-sync/` is in `.gitignore` and was never committed.

**The human verifies these, and you write the steps for them in `docs/verify.md`:**

9. A `--max-receipts 1 --dry-run` run authenticates, fetches one receipt, prints the parsed
   lines, and writes nothing to the database.
10. The same run without `--dry-run` writes exactly one receipt with its lines, and the line
    totals reconcile against the receipt total.
11. Running it a third time imports nothing and reports one duplicate skipped.
12. A full run with `--max-receipts 0` completes and reports its reconciliation failure count.
13. Editing a `consumer` value by hand, then re-running, leaves the edit intact.
14. Changing a product's `default_consumer`, then re-running, leaves historical `consumer`
    values unchanged.

Write `docs/verify.md` as a checklist with the exact command per step and the exact SQL to
check the result. Steps 13 and 14 need the SQL spelled out — do not assume the human will
write their own queries.

Only after items 9 and 10 pass may `scripts/kivra-sync/` be deleted (§6.4).

## 13. Do not

- Build any UI, or add Next.js files of any kind.
- Create a second uv project, a nested virtualenv, a `requirements.txt`, or a separate
  `.python-version`. One project, one lockfile.
- Add `weasyprint`, or loosen an existing dependency pin to resolve a conflict with upstream's.
- Claim a step is verified when it required a BankID scan. Say it is untested and awaiting the
  human instead.
- Add a scheduler, cron entry, or CI workflow that runs the importer.
- Store or log personal identity numbers.
- Overwrite `display_name`, `category`, `default_consumer`, `excluded`, or an existing
  `consumer` from an import.
- Add tables, columns, enums, or views to the schema without flagging it first. The schema is
  three tables and nothing derived; that is a decision, not an oversight. If the payload turns
  out to need a field that isn't there, say so and stop — one of us should decide.
- Use `float` for money anywhere.

## 14. Known weaknesses — do not try to fix, just don't be surprised

- **Alias drift.** With the raw string as the key, any ICA string change creates a new
  unclassified product. Mitigation is fuzzy-match suggestions in the review UI, which is out
  of scope.
- **Category lives on the raw name.** Rows sharing a `display_name` can disagree on category.
  The future UI must update them together.
- **Single upstream maintainer.** If Kivra changes its API, imports stop until upstream
  catches up or you patch `vendor/` yourself.
- **Scripted access likely violates Kivra's terms.** The project states it is not affiliated
  with Kivra. The realistic risk is an account block, not data loss.

## 15. Report back

There are two handoff points. Stop at both.

**After Phase 0**, hand back with the probe command, `docs/probe.md`, what the probe does and
does not touch, and the checklist the human should answer from the dump. Then wait — do not
start Phase 1 on a guessed payload structure.

**After Phase 2**, hand back with:

- Which vendored files you kept, which you removed, and which surprised you.
- Any place this document contradicted the actual code. The document was written from the
  README alone, so contradictions are expected rather than errors on your part.
- Dependency changes made to the shared project, and any resolution conflicts you hit.
- Which §12 criteria you verified and which are waiting on a BankID scan, stated plainly.
- Anything you had to guess at that a human should decide.