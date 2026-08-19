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

### AsyncStorage error fix

If you see `Native module is null, cannot access legacy storage`, you still have AsyncStorage **3.x** installed. Expo Go (SDK 57) needs **2.2.0**:

```bash
cd cram-app
npm run fix:storage
npx expo start --clear
```

Verify: `npm ls @react-native-async-storage/async-storage` should show **2.2.0**, not 3.x.

### Broken git / can't pull updates

If `git fetch` fails with `pack-....pack is far too short to be a packfile`, your local `.git` is corrupted. Either repair or re-clone:

```bash
# Option A — delete the bad pack and re-fetch (from repo root)
rm .git/objects/pack/pack-da678d9919441af9decf70f56f24ca1f8a07dd9d.pack
git fetch origin
git checkout cursor/cram-app-engine-1016
```

```bash
# Option B — fresh clone (safest)
cd ~
mv Last-Minute-Study Last-Minute-Study-old
git clone https://github.com/brodregoss/Last-Minute-Study.git
cd Last-Minute-Study
git checkout cursor/cram-app-engine-1016
cd cram-app && npm install && npm run fix:storage
```

You can run `npm run fix:storage` **without git** if `cram-app/` already exists on disk.

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
