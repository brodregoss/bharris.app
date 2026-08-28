# Last Minute Study — iOS / TestFlight

Builds run in **Expo’s cloud**. You do not need Homebrew or CocoaPods on your Mac.

You **do** need:

- A paid [Apple Developer](https://developer.apple.com/programs/) account
- A free [Expo](https://expo.dev/signup) account

Local `npx expo run:ios` is optional and will fail until CocoaPods exists. Skip it.

## TestFlight (do this)

In Mac Terminal:

```bash
cd /Users/broderickharris/Last-Minute-Study
git checkout -- mobile/package-lock.json
git pull origin cursor/native-live-parity-d64c
cd mobile
npm install
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios --profile production --auto-submit
```

`login` and `build:configure` will ask for Expo + Apple passwords. After that the build runs on Expo’s servers (CocoaPods is already there).

When the command prints a URL, open it and wait until the build is finished. Then:

[App Store Connect](https://appstoreconnect.apple.com/) → **My Apps** → **Last Minute Study** → **TestFlight**

Internal testers on your Apple team can install on a physical iPhone the same day (after Apple processes the binary, usually 10–40 minutes after the EAS build).

Bundle ID: `com.brodregoss.lastminutestudy`

## Scripts

```bash
npm run eas:testflight
```
