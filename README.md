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

   **`OPEN-IN-XCODE.xcworkspace`**

   Look for the white page with a **blue hammer** and the word **WORKSPACE** on the icon. In older downloads the same file was named `Last Minute Study.xcworkspace` (Finder may show it as `Last Minute Study.x...orkspace`). That is the file. Do not open `ios`, `src`, or `package.json`.

4. If Mac says it was downloaded from the internet: right-click → **Open**.
5. Xcode opens. In the left sidebar you will see:
   - **Edit the app here** → `src` (the screens)
   - **App** (the iPhone wrapper)
6. Click **App** in the sidebar → **Signing & Capabilities** → **Team** → pick the paid Apple Developer team.
7. At the top, pick an iPhone simulator (or your plugged-in iPhone).
8. Press the **Play** button.

The first Run can take a few minutes. Xcode may download a small Apple/Ionic package the first time (needs internet). After that, Run is faster.

If the phone still shows the **old** app (no **History Civil Rights** sample, Settings does not say **Version 1.0.1**):

1. On the iPhone: long-press the Last Minute Study icon → **Remove App** → **Delete App**.
2. On the Mac: throw the old unzipped **Last-Minute-Study** folder in the Trash. Xcode keeps using that old folder even if GitHub has newer files.
3. Download a **new** ZIP from this branch (not the green Code button on the main repo page):
   https://github.com/brodregoss/Last-Minute-Study/archive/refs/heads/cursor/ios-testflight-capacitor-0f3e.zip
4. Double-click the zip, then double-click **`OPEN-IN-XCODE.xcworkspace`**.
5. In Xcode: **Product → Clean Build Folder**, then press **Play** again.

You should now see **History Civil Rights** as the third sample on Upload notes, and **Version 1.0.1** in Settings.

If Xcode says **Missing package product 'CapApp-SPM'**:

1. Make sure you opened **OPEN-IN-XCODE.xcworkspace** (or the hammer **WORKSPACE** file), not a random file inside `ios`.
2. Connect to Wi‑Fi.
3. In Xcode’s menu bar: **File → Packages → Reset Package Caches**.
4. Then **File → Packages → Resolve Package Versions**.
5. Wait until the top bar finishes spinning, then **Product → Clean Build Folder**, then press **Play**.

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
| `OPEN-IN-XCODE.xcworkspace` | Yes — this is what you double-click |
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
