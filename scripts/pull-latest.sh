#!/bin/bash
# Drop GitHub's latest files into this same folder so you do not need a new ZIP.
set -euo pipefail

export PATH="/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Updating Last Minute Study in:"
echo "  $ROOT"
echo

exec "$ROOT/scripts/git-sync.sh" --force
