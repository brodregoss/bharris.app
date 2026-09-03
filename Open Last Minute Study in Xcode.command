#!/bin/bash
# Double-click this file on a Mac to install iOS deps (once) and open Xcode.
set +e

ROOT="$(cd "$(dirname "$0")" && pwd)"
IOS="$ROOT/mobile/ios"
MOBILE="$ROOT/mobile"
WORKSPACE="$IOS/LastMinuteStudy.xcworkspace"

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

# Node is required for Expo's Xcode build phase and for CocoaPods autolinking.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org then double-click this file again."
  echo
  read -r -p "Press Return to close. " _
  exit 1
fi

if [ ! -d "$MOBILE/node_modules/expo" ]; then
  echo "Installing JavaScript packages (first time only)..."
  (cd "$MOBILE" && npm install) || {
    echo "npm install failed. Free some disk space and try again."
    echo
    read -r -p "Press Return to close. " _
    exit 1
  }
fi

if [ ! -d "$IOS" ]; then
  echo "Generating the Xcode project (first time only)..."
  (cd "$MOBILE" && npx expo prebuild --platform ios --no-install) || {
    echo "Could not generate the Xcode project."
    echo
    read -r -p "Press Return to close. " _
    exit 1
  }
fi

ensure_pod() {
  if command -v pod >/dev/null 2>&1; then
    return 0
  fi
  export GEM_HOME="${GEM_HOME:-$HOME/.gem}"
  export PATH="$GEM_HOME/bin:$PATH"
  if command -v pod >/dev/null 2>&1; then
    return 0
  fi
  echo "Installing CocoaPods with Apple's Ruby (no Homebrew)..."
  gem install cocoapods --no-document || return 1
  export PATH="$GEM_HOME/bin:$PATH"
  command -v pod >/dev/null 2>&1
}

if [ ! -d "$IOS/Pods/Pods.xcodeproj" ]; then
  echo "Preparing iPhone libraries for Xcode (first time only, a few minutes)..."
  if ! ensure_pod; then
    echo "Could not install CocoaPods automatically."
    echo "Xcode will still open. If Archive fails, CocoaPods is the missing piece."
  else
    (cd "$IOS" && pod install) || {
      echo "pod install failed. Xcode will still open; Archive may fail until this succeeds."
    }
  fi
fi

if [ -d "$WORKSPACE" ]; then
  echo "Opening LastMinuteStudy.xcworkspace in Xcode..."
  open "$WORKSPACE"
else
  echo "Opening LastMinuteStudy.xcodeproj in Xcode..."
  open "$IOS/LastMinuteStudy.xcodeproj"
fi

echo ""
echo "In Xcode:"
echo "  1. Click LastMinuteStudy in the left sidebar"
echo "  2. Signing & Capabilities → Team → pick your mom's Apple team"
echo "  3. Product menu → Archive → Distribute App → App Store Connect"
echo ""
echo "You can close this window."
echo
read -r -p "Press Return to close. " _
