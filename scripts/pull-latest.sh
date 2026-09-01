#!/bin/bash
# Drop GitHub's latest files into this same folder so you do not need a new ZIP.
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="cursor/ios-testflight-capacitor-0f3e"
ZIP_URL="https://github.com/brodregoss/Last-Minute-Study/archive/refs/heads/${BRANCH}.zip"

echo "Updating Last Minute Study in:"
echo "  $ROOT"
echo

if [ -d .git ] && command -v git >/dev/null 2>&1; then
  echo "This folder is a git copy — pulling $BRANCH..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  echo "This folder is a ZIP copy — downloading the latest files..."
  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl is missing. Connect to the internet and try again." >&2
    exit 1
  fi
  TMP="$(mktemp -d)"
  cleanup() { rm -rf "$TMP"; }
  trap cleanup EXIT
  curl -L --fail "$ZIP_URL" -o "$TMP/app.zip"
  unzip -q "$TMP/app.zip" -d "$TMP"
  INNER="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
  if [ -z "$INNER" ] || [ ! -d "$INNER/src" ]; then
    echo "error: the download did not look like Last Minute Study." >&2
    exit 1
  fi
  rsync -a \
    --exclude node_modules \
    --exclude dist \
    --exclude .git \
    --exclude ios/App/App.xcodeproj/xcuserdata \
    --exclude ios/App/App.xcodeproj/project.xcworkspace/xcuserdata \
    "$INNER/" "$ROOT/"
fi

echo
echo "Done. Go to Xcode and press Play. Keep using this same folder."
