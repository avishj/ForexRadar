#!/usr/bin/env bash
#
# run_backfill_mastercard.sh
#
# Wrapper script for launchd to run the Mastercard backfill watchdog.
# Sets up the environment and invokes the Python watchdog.
#
# Usage:
#   ./run_backfill_mastercard.sh
#
# Designed to be called by launchd (com.forexradar.backfill.mastercard.plist)
#

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly PROVIDER="mastercard"
readonly DAYS=160

# Ensure we're in the project directory
cd "$PROJECT_ROOT"

# Log startup
echo ""
echo "========================================"
echo "ForexRadar Mastercard Backfill"
echo "========================================"
echo "Time:    $(date '+%Y-%m-%d %H:%M:%S')"
echo "PWD:     $PROJECT_ROOT"
echo "Provider: $PROVIDER"
echo "Days:    $DAYS"
echo "========================================"
echo ""

# Ensure bun is in PATH (common install locations)
export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Verify bun is available
if ! command -v bun &> /dev/null; then
    echo "[ERROR] bun not found in PATH"
    echo "PATH: $PATH"
    exit 1
fi

echo "Using bun: $(which bun)"
echo "Bun version: $(bun --version)"
echo ""

# Verify python3 is available
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 not found in PATH"
    exit 1
fi

echo "Using python: $(which python3)"
echo "Python version: $(python3 --version)"
echo ""

# Run the watchdog
exec python3 "$SCRIPT_DIR/backfill_watchdog.py" \
    --provider "$PROVIDER" \
    --days "$DAYS"
