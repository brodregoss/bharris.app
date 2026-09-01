#!/bin/bash
# Double-click this in Finder to pull the latest GitHub files into THIS folder.
cd "$(dirname "$0")" || exit 1

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

confirm="$(osascript -e 'display dialog "Download the latest Last Minute Study files into this same folder?\n\nAfter it finishes, press Play in Xcode. You do not need a new ZIP.\n\nYour own unsaved edits in this folder will be replaced." buttons {"Cancel", "Update"} default button "Update" with title "Last Minute Study"' 2>/dev/null || true)"
if [[ "$confirm" != *"Update"* ]]; then
  exit 0
fi

if ! ./scripts/pull-latest.sh; then
  osascript -e 'display dialog "Update failed. Check that you are on Wi‑Fi, then try again." buttons {"OK"} default button "OK" with title "Last Minute Study"' >/dev/null
  exit 1
fi

osascript -e 'display dialog "Updated.\n\nGo back to Xcode and press Play. Keep this same folder — do not download a new ZIP for your own tweaks." buttons {"OK"} default button "OK" with title "Last Minute Study"' >/dev/null
