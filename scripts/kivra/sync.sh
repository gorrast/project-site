#!/usr/bin/env bash
#
# Run kivra import
#
# Usage:
#   ./scripts/kivra/sync.sh
#   ./scripts/kivra/sync.sh --max-receipts 1 --dry-run
#

set -uo pipefail   # medvetet INTE -e: ett misslyckat körning ska inte
                   # hindra att den andra personen får sin fråga

# Hitta repo-roten oavsett var skriptet startas ifrån
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

PERSONS=(Hugo Benjamin)
declare -A RESULT

FULL_SCAN_ARGS=()
read -r -p "Full genomsökning? Kontrollerar alla kvitton även efter en dubblett, istället för att stanna vid den första (normalt onödigt). [y/N] " full_scan_answer
case "$full_scan_answer" in
    [yY] | [yY][eE][sS])
        FULL_SCAN_ARGS=(--full-scan)
        ;;
esac

run_for() {
    local person="$1"
    shift
    echo
    echo "── $person ──────────────────────────────────"
    echo "Ha BankID-appen öppen och redo. QR-koden hinner gå ut annars."
    echo

    if uv run python -m scripts.kivra.cli --person "$person" "${FULL_SCAN_ARGS[@]}" "$@"; then
        RESULT[$person]="OK"
    else
        RESULT[$person]="MISSLYCKADES (exit $?)"
    fi
}

for person in "${PERSONS[@]}"; do
    read -r -p "Köra importen för $person? [y/N] " answer
    case "$answer" in
        [yY] | [yY][eE][sS])
            run_for "$person" "$@"
            ;;
        *)
            RESULT[$person]="hoppades över"
            ;;
    esac
done

echo
echo "── Sammanfattning ───────────────────────────"
for person in "${PERSONS[@]}"; do
    printf '  %-10s %s\n' "$person" "${RESULT[$person]}"
done

# Exit 1 om någon körning faktiskt misslyckades (överhoppade räknas inte)
for person in "${PERSONS[@]}"; do
    [[ "${RESULT[$person]}" == MISSLYCKADES* ]] && exit 1
done
exit 0