#!/bin/bash
# Fixes "crypto.getRandomValues() not supported" for Base44 SDK in React Native.
# Run from anywhere: bash fix-crypto.sh
# Or from this folder: npm run fix:crypto

set -e
cd "$(dirname "$0")"

echo "→ Installing react-native-get-random-values..."
npm install react-native-get-random-values

echo "→ Creating index.js..."
cat > index.js << 'EOF'
// Must load before @base44/sdk (uses uuid → crypto.getRandomValues).
import 'react-native-get-random-values';
import 'expo-router/entry';
EOF

echo "→ Setting package.json main to index.js..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.main = 'index.js';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo ""
echo "✅ Done! Now run:"
echo "   npm start"
echo "   (then press i for iOS Simulator — only while Metro is running)"
echo ""
