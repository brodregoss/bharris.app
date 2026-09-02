#!/bin/bash
# Double-click this in Finder to pull the latest GitHub files into THIS folder.
cd "$(dirname "$0")" || exit 1

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

confirm="$(osascript -e 'display dialog "Connect this folder to GitHub and take the latest files?\n\nAfter this, you do not need a new ZIP. When Cursor finishes a task, just press Play in Xcode.\n\nUnsaved edits in this folder will be replaced." buttons {"Cancel", "Connect"} default button "Connect" with title "Last Minute Study"' 2>/dev/null || true)"
if [[ "$confirm" != *"Connect"* ]]; then
  exit 0
fi

if ! ./scripts/pull-latest.sh; then
  osascript -e 'display dialog "Update failed. Check that you are on Wi‑Fi, then try again." buttons {"OK"} default button "OK" with title "Last Minute Study"' >/dev/null
  exit 1
fi

osascript -e 'display dialog "This folder is connected to GitHub.\n\nFrom now on: when Cursor finishes a task, press Play in Xcode. No new ZIP." buttons {"OK"} default button "OK" with title "Last Minute Study"' >/dev/null
