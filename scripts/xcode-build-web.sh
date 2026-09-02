#!/bin/bash
# Runs from Xcode before the iPhone app is packaged.
# Rebuilds the React screens into ios/App/App/public.
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export CAPACITOR_TELEMETRY=0

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js is not installed. Install the LTS version from https://nodejs.org then press Run again." >&2
  exit 1
fi

# When this folder is connected to GitHub and you have not edited files locally,
# Play pulls the latest Cursor/GitHub work before building.
if [ -x "$ROOT/scripts/git-sync.sh" ]; then
  "$ROOT/scripts/git-sync.sh" --if-clean || echo "Could not pull from GitHub; building local files."
fi

if [ ! -d node_modules ]; then
  echo "Installing JavaScript packages (first time only)..."
  npm install
fi

echo "Building Last Minute Study..."
npm run build
npx cap copy ios

# Xcode treats `public` as one folder. Touch it so Copy Bundle Resources
# actually picks up the files we just wrote, instead of keeping the old copy.
PUBLIC="$ROOT/ios/App/App/public"
touch "$PUBLIC"
find "$PUBLIC" -exec touch {} +

echo "Web app copied into the Xcode project."
