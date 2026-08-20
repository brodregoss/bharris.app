#!/usr/bin/env bash
set -euo pipefail

# Expo Go (SDK 57) requires AsyncStorage 2.x — v3 throws:
# "Native module is null, cannot access legacy storage"
echo "Pinning @react-native-async-storage/async-storage to Expo SDK 57 compatible 2.x..."
npx expo install @react-native-async-storage/async-storage@2.2.0

echo "Reinstalling dependencies..."
rm -rf node_modules
npm install

echo "Done. Installed version:"
npm ls @react-native-async-storage/async-storage

echo ""
echo "Start with: npx expo start --clear"
