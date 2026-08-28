# Last Minute Study — iOS app

Standalone iPhone app. AI still uses Base44 InvokeLLM.

Do **not** use Expo Go. Local runs and TestFlight both use a real `Last Minute Study` binary.

## One-time setup

```bash
cd /Users/broderickharris/Last-Minute-Study
git fetch origin
git checkout cursor/native-live-parity-d64c
git pull origin cursor/native-live-parity-d64c
cd mobile
cp .env.example .env
npm install
```

You need:

- A paid [Apple Developer](https://developer.apple.com/programs/) account ($99/year) for TestFlight
- Xcode installed and opened once
- An [Expo](https://expo.dev) account (free) for EAS cloud builds

## Run on the Simulator like a normal app

This compiles **Last Minute Study.app** and installs it on the Simulator (home screen icon, not Expo Go):

```bash
cd /Users/broderickharris/Last-Minute-Study/mobile
npx expo run:ios
```

First build takes several minutes. After that, launch **Last Minute Study** from the Simulator home screen.

## TestFlight (today)

From `mobile/`:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile production --auto-submit
```

`eas build:configure` creates the Expo project and will ask you to log in with Apple. EAS then:

1. Builds a store IPA in the cloud
2. Uploads it to App Store Connect
3. Puts it on **TestFlight Internal** for anyone on your Apple Developer team

Watch the build at the URL EAS prints. Processing in App Store Connect is usually 10–30 minutes after the build finishes.

Then open [App Store Connect](https://appstoreconnect.apple.com/) → **Last Minute Study** → **TestFlight** → install on your iPhone.

Bundle ID is `com.brodregoss.lastminutestudy`. Create that App ID in the Apple Developer portal if EAS asks.

## Base44 env (already set for EAS production)

```
EXPO_PUBLIC_BASE44_APP_ID=6a6155d14517fbb12343f754
EXPO_PUBLIC_BASE44_APP_BASE_URL=https://enthusiastic-cram-genius-flow.base44.app
```

## Crypto polyfill

`index.js` must stay as the `"main"` entry and must import `react-native-get-random-values` first so Base44 AI works on device.
