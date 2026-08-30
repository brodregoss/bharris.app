# Last Minute Study

A last-minute exam cram app. Open it in **Xcode**, press Run, then later Archive for TestFlight.

The screens you see on the phone are the files in `src/`. Change those in Xcode (or any editor). Pressing Run rebuilds them into the iPhone app.

## Open in Xcode (from the Mac desktop)

1. Click **Finder** in the Dock (blue smiling face).
2. Open the **Last-Minute-Study** folder. If you do not have it:
   - Go to https://github.com/brodregoss/Last-Minute-Study/tree/cursor/ios-testflight-capacitor-0f3e
   - Click the green **Code** button → **Download ZIP**
   - Double-click the zip to unzip it
   - Open the unzipped folder
3. At the **top** of that folder, double-click:

   **`Last Minute Study.xcworkspace`**

   It has the blue Xcode icon. That is the file to open. Do not hunt for a `.command` helper.

4. If Mac says it was downloaded from the internet: right-click → **Open**.
5. Xcode opens. In the left sidebar you will see:
   - **Edit the app here** → `src` (the screens)
   - **App** (the iPhone wrapper)
6. Click **App** in the sidebar → **Signing & Capabilities** → **Team** → pick the paid Apple Developer team.
7. At the top, pick an iPhone simulator (or your plugged-in iPhone).
8. Press the **Play** button.

The first Run can take a few minutes (it installs Node packages once, then builds). After that, Run is faster.

You need [Node.js LTS](https://nodejs.org) installed on the Mac. Xcode itself comes from the Mac App Store.

## Edit and view from Xcode

1. In the left sidebar, open **Edit the app here** → **src** → **pages**.
2. Click a screen, for example `Landing.jsx` or `Home.jsx`.
3. Change the text or layout.
4. Press **Play** again. The iPhone simulator shows your change.

| File | What it is |
|------|------------|
| `src/pages/Landing.jsx` | Home screen |
| `src/pages/Home.jsx` | Setup (terms, hours, exam type) |
| `src/pages/UploadNotes.jsx` | Photo / sample notes |
| `src/pages/Triage.jsx` | Sort terms into Blank / Shaky / Know it |
| `src/pages/StudyFlow.jsx` | The cram session |
| `src/pages/PanicReview.jsx` | Panic notes |
| `src/pages/PastSessions.jsx` | History |
| `src/pages/Settings.jsx` | Settings |
| `src/App.jsx` | Which screens exist (add or remove a route here) |

## TestFlight

In Xcode: **Product → Archive** → **Distribute App** → **App Store Connect**.

Bundle ID: `com.brodregoss.lastminutestudy`

Create that app once in [App Store Connect](https://appstoreconnect.apple.com) if it is not there yet.

## What is still in this folder (and why)

| Thing | Needed? |
|-------|---------|
| `Last Minute Study.xcworkspace` | Yes — this is what you double-click |
| `src/` | Yes — the actual app screens |
| `ios/` | Yes — the iPhone project Xcode builds |
| `package.json` | Yes — lists the libraries the app uses |
| Base44 bits (`src/api`, `.env.production`) | Yes — AI triage / panic notes / grading |
| Extra login pages, Stripe, maps, leftover UI kit | Removed — they were unused Base44 leftovers |

## Web preview (optional)

```bash
npm install
npm run dev
```
