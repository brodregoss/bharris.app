#!/bin/bash
# Double-click this file on a Mac to build Last Minute Study and open Xcode.
set +e

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJ="$ROOT/ios/App/App.xcodeproj"

echo ""
echo "Last Minute Study — opening Xcode"
echo "Leave this window open until Xcode appears."
echo ""

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This has to run on your Mac, not on a Linux computer."
  echo "On the Mac, double-click: Open Last Minute Study in Xcode.command"
  echo
  read -r -p "Press Return to close. " _
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Opening Xcode so macOS can finish installing developer tools..."
  open -a Xcode
  echo ""
  echo "When Xcode finishes launching, double-click this file again."
  echo
  read -r -p "Press Return to close. " _
  exit 1
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export CAPACITOR_TELEMETRY=0

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org then double-click this file again."
  echo
  read -r -p "Press Return to close. " _
  exit 1
fi

if [ ! -d "$ROOT/node_modules/@capacitor/ios" ]; then
  echo "Installing JavaScript packages (first time only)..."
  (cd "$ROOT" && npm install) || {
    echo "npm install failed. Free some disk space and try again."
    echo
    read -r -p "Press Return to close. " _
    exit 1
  }
fi

if [ ! -f "$ROOT/.env.local" ] && [ -f "$ROOT/.env.production" ]; then
  cp "$ROOT/.env.production" "$ROOT/.env.local"
fi

echo "Building the app into the Xcode project..."
(cd "$ROOT" && npm run ios:sync) || {
  echo "Build failed. Check the messages above."
  echo
  read -r -p "Press Return to close. " _
  exit 1
}

if [ ! -d "$PROJ" ]; then
  echo "The Xcode project is missing. Generating it..."
  (cd "$ROOT" && npx cap add ios --packagemanager SPM && npm run ios:sync) || {
    echo "Could not generate the Xcode project."
    echo
    read -r -p "Press Return to close. " _
    exit 1
  }
fi

echo "Opening App.xcodeproj in Xcode..."
open "$PROJ"

echo ""
echo "In Xcode:"
echo "  1. Click App in the left sidebar"
echo "  2. Signing & Capabilities → Team → pick the paid Apple Developer team"
echo "  3. Choose a simulator or your iPhone, then press Run"
echo "  4. Product → Archive → Distribute App → App Store Connect / TestFlight"
echo ""
echo "Bundle ID: com.brodregoss.lastminutestudy"
echo ""
echo "You can close this window."
echo
read -r -p "Press Return to close. " _
