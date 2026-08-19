# Last Minute Study — Mobile (Expo)

Native iOS/Android app. AI features still use **Base44 InvokeLLM** via your hosted app backend.

## Prerequisites

- Node.js 20+ (Node 22 recommended)
- macOS + Xcode Command Line Tools for iOS Simulator (full Xcode only needed for App Store / dev builds)
- [Expo Go](https://expo.dev/go) on a physical device is optional — **iOS Simulator is the default workflow**

## Setup

```bash
cd mobile
npm install
cp .env.example .env
```

Edit `.env` with the same Base44 credentials as the web app:

```bash
EXPO_PUBLIC_BASE44_APP_ID=6a6155d14517fbb12343f754
EXPO_PUBLIC_BASE44_APP_BASE_URL=https://enthusiastic-cram-genius-flow.base44.app
```

## Run (recommended workflow)

```bash
npm start
```

Press **`i`** in the Metro terminal to open the **iOS Simulator**.

Do **not** use web preview (`w`) — AsyncStorage/SQLite paths differ and are not fully supported yet.

## Fixing `crypto.getRandomValues()` on Triage

React Native does not provide `crypto.getRandomValues()`, which the Base44 SDK needs (via `uuid`). This project loads `react-native-get-random-values` in `index.js` **before** any other imports. If you see this error on an older local copy, ensure:

1. `npm install react-native-get-random-values`
2. `"main": "index.js"` in `package.json`
3. `index.js` starts with `import 'react-native-get-random-values';`

## When you need Xcode

| Task | Simulator + Expo | Xcode |
|------|------------------|-------|
| UI / JS changes | ✅ | Not needed |
| Test on iPhone simulator | ✅ (`i` in Metro) | Not needed |
| App Store / TestFlight | ❌ | ✅ (`eas build` or `expo run:ios`) |
| Custom native modules | ❌ | ✅ |

## Screens

| Route | Status |
|-------|--------|
| `/` Landing | ✅ Matches web — continue/restart/practice, corner nav |
| `/setup` | ✅ Gradient setup with steppers + selects |
| `/upload-notes` | ✅ Photo picker + sample notes |
| `/triage` | ✅ AI triage board with tier colors |
| `/study` | ✅ Full phase flow: critical → core → passive → test → confidence |
| `/panic` | ✅ AI markdown panic notes |
| `/history` | ✅ Placeholder (same as web) |
| `/settings` | ✅ Sleep-protection explainer (same as web) |

## Base44 billing

If AI fails with **401/403/billing/credits** messages, that is likely account cutoff — not the crypto error. The web app at repo root is the quickest way to test whether Base44 AI still responds.
