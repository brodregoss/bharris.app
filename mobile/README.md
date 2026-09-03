# Last Minute Study — iOS / Xcode

The Xcode project is in this repo. After `git pull`, you do **not** hunt through source files.

## File to open

Double-click this in Finder:

`Last-Minute-Study/Open Last Minute Study in Xcode.command`

That installs iPhone libraries once (no Homebrew), then opens:

`Last-Minute-Study/mobile/ios/LastMinuteStudy.xcworkspace`

If macOS says the file can't be opened, right-click it → **Open**.

Open the **`.xcworkspace`**, not `.xcodeproj`.

## In Xcode

1. Left sidebar → **LastMinuteStudy**
2. **Signing & Capabilities** → Team → your mom's paid Apple team
3. Menu **Product → Archive** → **Distribute App** → App Store Connect / TestFlight

Bundle ID: `com.brodregoss.lastminutestudy`

## TestFlight without local CocoaPods

If Archive fails, Expo's cloud can still build:

```bash
cd /Users/broderickharris/Last-Minute-Study/mobile
npx eas-cli login
npx eas-cli build --platform ios --profile production --auto-submit
```
