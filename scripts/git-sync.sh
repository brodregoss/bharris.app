#!/bin/bash
# Keep this Mac folder in sync with GitHub.
#   --force     connect if needed, then take GitHub's copy (overwrites local edits)
#   --if-clean  used by Xcode Play: pull only when this folder has no local edits
set -euo pipefail

export PATH="/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
export GIT_TERMINAL_PROMPT=0

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="cursor/ios-testflight-capacitor-0f3e"
REMOTE="https://github.com/brodregoss/Last-Minute-Study.git"
MODE="${1:---force}"

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is not available. In Terminal run: xcode-select --install" >&2
  exit 1
fi

if [ ! -d .git ]; then
  if [ "$MODE" = "--if-clean" ]; then
    echo "This folder is not connected to GitHub yet. Skipping pull."
    echo "One-time: double-click PULL-LATEST.command, or see README."
    exit 0
  fi
  echo "Connecting this folder to GitHub (one time)..."
  git init
  git remote add origin "$REMOTE" 2>/dev/null || git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE" 2>/dev/null || git remote set-url origin "$REMOTE"
fi

echo "Fetching $BRANCH..."
if ! git fetch origin "$BRANCH"; then
  if [ "$MODE" = "--if-clean" ]; then
    echo "Could not reach GitHub; building local files."
    exit 0
  fi
  echo "error: could not reach GitHub. Check Wi‑Fi and try again." >&2
  exit 1
fi

if [ "$MODE" = "--if-clean" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "This folder has local edits — Play will use YOUR files, not GitHub."
    exit 0
  fi
  git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
  if git merge --ff-only "origin/$BRANCH"; then
    echo "Xcode folder now matches GitHub."
  else
    echo "Could not fast-forward from GitHub; building local files."
  fi
  exit 0
fi

git checkout -f -B "$BRANCH" "origin/$BRANCH"
echo "This folder now matches GitHub ($BRANCH)."
