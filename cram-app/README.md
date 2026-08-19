# Cram App

Native flashcard study app with subject-specific "gearing" — concept graphs for History/Science, minimal graph for English, math pipeline for Other.

Built with **Expo (managed) + React Native + TypeScript + React Navigation**. No web APIs.

## Run

```bash
cd cram-app
npm install
npm start
```

Press `i` for iOS Simulator or scan QR with **Expo Go** (SDK 57).

**Important:** Use `npx expo install @react-native-async-storage/async-storage` if you see `Native module is null` — Expo Go requires AsyncStorage **2.x**, not 3.x.

## Architecture

```
src/engine/          ← Pure TypeScript (no RN imports) — do not rewrite
src/storage/         ← AsyncStorage boundary only
src/data/            ← subjectGearing.json + sample decks (TODO: real ingestion)
src/screens/         ← React Navigation screens
src/components/      ← FlashcardFlow, etc.
```

## Flow

1. **SubjectPicker** → pick Psych / History / Science / English / Language / Other
2. **Other** → **ProblemPractice** (math engine)
3. Other subjects → **Diagnostic** (first time) or **Review** (has mastery data)
4. After diagnostic → **GapDashboard** (clustered weak spots)
5. Tap cluster → focused **Review**

## Settings

Override gearing weights per subject (stored in AsyncStorage, not bundled JSON).

## Content

Sample decks in `src/data/sampleDecks.ts` — marked `TODO` for real content pipeline.
