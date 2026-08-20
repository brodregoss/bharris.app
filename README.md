# Last Minute Study

One app. Cram smarter before an exam.

Native iOS (Expo + React Native). Web and App Store builds come later.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # add Base44 credentials
npm run ios
```

Or open in **Xcode** (after first prebuild):

```bash
npm install
cp .env.local.example .env.local
npm run prebuild:ios
npm run xcode
```

Then press ▶ in Xcode to run on the simulator.

## Daily dev

| Command | What it does |
|---------|----------------|
| `npm start` | Metro bundler — press `i` for simulator |
| `npm run ios` | Start + open iOS simulator (localhost) |
| `npm run prebuild:ios` | Generate `ios/` folder for Xcode |
| `npm run xcode` | Open project in Xcode |

## Flow

```
Landing → Setup → Upload Notes → Triage → Study → Done
                              critical → core → passive → test → confidence
```

## Environment

Create `.env.local`:

```
EXPO_PUBLIC_BASE44_APP_ID=your_app_id
EXPO_PUBLIC_BASE44_APP_BASE_URL=https://your-app.base44.app
```

AI triage and test grading need Base44. Copy values from your existing web app.

## Troubleshooting

**AsyncStorage error in Expo Go:**
```bash
npm run fix:storage
```

**Simulator timeout when pressing `i`:**
```bash
npm run ios
```
Or open Simulator manually, then open Expo Go → `exp://127.0.0.1:8081`

## Project layout

```
app/           screens (expo-router)
src/core/      study algorithm (same as original web app)
src/components study UI blocks
src/services/  storage + Base44 AI
src/engine/    Smart Cram engine (Step 2 — not wired yet)
_archive/      old web + study app (reference only)
```

## Roadmap

1. **Now** — match web cram flow, test and polish
2. **Smart Cram** — subject tailoring after session (`src/engine/`)
3. **Later** — App Store build, web version
