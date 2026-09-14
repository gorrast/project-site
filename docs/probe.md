# Phase 0 probe — instructions

This is a one-time, throwaway step to confirm that Kivra's receipt data actually contains
structured line items (not just a rendered PDF/HTML blob) before a real parser gets written
against it. You don't need to read any of the Python code to run this.

## Before you start

- **Open the BankID app on your phone and have it ready.** The QR code that appears rotates
  every second and expires quickly — you want to be scanning within a few seconds of it
  appearing, not hunting for the app first.
- This uses whichever identity number (personnummer) you scan with — it fetches **that
  person's** Kivra inbox.

## The command

Run this from the repo root, replacing `<ssn>` with your personnummer in `YYYYMMDDXXXX` format
(no dashes):

```bash
PYTHONPATH=scripts/kivra-sync uv run python scripts/kivra_probe.py <ssn>
```

## What happens, in order

1. A line printed: `Authenticating with Kivra via BankID...`
2. A QR code image pops open in your system's default image viewer (roughly instant).
3. A line printed: `QR-kod visas nu. Skanna den med BankID-appen.` — scan it now with the BankID
   app. Since this uses the "local" display method (not a browser), the QR code shown **will
   not auto-refresh** — if you don't scan it within its rotation window you'll likely see a
   BankID error (see below), and the fix is simply to rerun the command for a fresh QR.
4. Dots print (`.....`) while it polls for your BankID confirmation — this takes as long as
   BankID takes on your phone, typically a few seconds once you've approved it there.
5. `BankID authentication successful!` and `Fetching OAuth token...` — near-instant.
6. `Fetching receipt list...` then `Fetching details for receipt <some-key>...` — a couple of
   seconds, network-bound.
7. Finally: `Dumped one receipt to: /absolute/path/to/scripts/kivra-probe-dump/<key>.json`

Total time from running the command to the final line: usually under a minute, most of it spent
waiting for you to open BankID and approve.

## Where the dump lands

`scripts/kivra-probe-dump/<receipt-key>.json` — this directory is already in `.gitignore`, so it
won't be committed by accident, but **do not manually add or share it** either. It contains a
real purchase from your own account.

## If it fails

- **BankID error "QR-koden är ogiltig" (RFA17), or the QR just times out with no error** — the
  QR expired before you scanned it. Safe to just rerun the command from scratch; nothing was
  written or left in a bad state.
- **`Could not initialize OAuth2` right after the first line** — Kivra's login endpoint rejected
  the request outright (didn't even get to showing a QR). This usually means Kivra changed
  something in their auth flow, not a mistake on your end — report this back rather than
  retrying repeatedly.
- **`Token retrieval failed` or `Missing kivra_user_id` after a successful-looking BankID scan**
  — the OAuth token exchange step failed or came back in an unexpected shape. Also likely an
  upstream API change — report back with the exact message rather than retrying.
- **`No receipts found in this Kivra inbox. Nothing to dump.`** — the script ran successfully
  but there's nothing in this inbox to fetch. Confirm you scanned with the right person's BankID
  (the one whose Kivra inbox actually receives ICA receipts), then rerun if needed.

## What to report back

Open the dumped JSON file and answer these, from what you see in the file (amounts and store
name can be redacted/described rather than pasted verbatim if you'd rather not share the exact
numbers):

- [X] Does it contain individual article rows, each with a name and an amount?
  Yes. 
- [X] Is there a quantity field? For a weight-based item (e.g. loose fruit/veg), is the quantity
      expressed differently than for a countable item (e.g. `3 × 12.90`)?
    Yes, for a weighted item such as onions, it looks like this: "quantityCost": {
                  "formatted": "0,175 kg * 29,90 kr/kg"
- [X] Are there discount rows? If so, do they reference the specific article they discount
      (e.g. via an id), or are they only positioned next to it in the list with no explicit
      link?
    This cannot be checked from this sample as there were no discounts applied. However, for each product there is a field to indicate "type" where the value is "product" for all items in this receipt. 
- [X] Is there a stable identifier for the receipt itself (separate from the file name)?
There is something to indicate an identifier but it is also used as the filename. 
- [X] Is there a purchase timestamp? Does it include a time of day, or only a date?
  Yes, it includes a full date with time of day
- [X] Is the store name present, and in what field?
  Yes, in content.header.text within the json.
- [X] Is there anything indicating which physical card was used at checkout?
  Yes, but are we really supposed to track this? I think not. 