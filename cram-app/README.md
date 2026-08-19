# Last Minute Study (cram-app)

Native cram app — same flow, algorithm, and styling as the web app.

Built with **Expo + React Native + TypeScript + expo-router**.

## Run

```bash
cd cram-app
cp .env.local.example .env.local   # add Base44 credentials
npm install
npm run fix:storage                # if AsyncStorage errors in Expo Go
npm start
```

Press `i` for iOS Simulator or scan QR with **Expo Go** (SDK 57).

## Flow

```
Landing → Setup → Upload Notes → Triage → Study Flow → Done
                                              ↓
                    critical → core → passive → test → confidence
```

## Smart Cram (Step 2 — later)

After a session completes, subject-specific tailoring will use `src/engine/` (not wired yet).

## Architecture

```
app/                 ← expo-router screens
src/core/            ← studyUtils, types, triageUtils (same as web)
src/components/      ← study blocks + UI
src/services/        ← sessionStore, aiService, base44Client
src/engine/          ← subject gearing engine (Smart Cram — future)
src/data/            ← subjectGearing.json (engine config)
```

## Base44

Copy web app credentials into `cram-app/.env.local`:

```
EXPO_PUBLIC_BASE44_APP_ID=...
EXPO_PUBLIC_BASE44_APP_BASE_URL=...
```

Triage and practice-test grading require Base44 AI.
