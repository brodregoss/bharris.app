#!/usr/bin/env bash
set -euo pipefail
echo "Ensuring react-native-get-random-values is installed and index.js loads it first..."
npm install react-native-get-random-values
if ! grep -q "react-native-get-random-values" index.js 2>/dev/null; then
  echo "Add this as the first line of index.js:"
  echo "import 'react-native-get-random-values';"
  exit 1
fi
echo "Done."
