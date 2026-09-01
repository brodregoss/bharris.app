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

## Tweak the look or add a page (no new ZIP)

Keep **this same unzipped folder**. Pressing Play rebuilds whatever is in `src/` onto the phone. Re-downloading is only for grabbing files from GitHub, not for your own edits.

1. In Xcode’s left sidebar: **Edit the app here** → `src`.
2. Change a file (see the table below).
3. Press **Play**. Wait until the app reopens on the phone.

| What you want | File to open |
|---------------|--------------|
| Colors / overall look | `src/index.css` (the `--background`, `--primary`, etc. lines at the top) |
| Home screen text | `src/pages/Landing.jsx` |
| Setup screen | `src/pages/Home.jsx` |
| Upload / sample notes | `src/pages/UploadNotes.jsx` |
| Settings | `src/pages/Settings.jsx` |
| Add or remove a page | `src/App.jsx` plus a new file in `src/pages/` |

To add a page: duplicate a file in `src/pages`, change the text, import it in `src/App.jsx`, and add a `<Route path="/your-page" element={<YourPage />} />` next to the other routes.

## Get GitHub updates without a new ZIP

When Cursor (or GitHub) has newer files and you want them in this same folder:

1. In Finder, open this Last-Minute-Study folder.
2. Double-click **`PULL-LATEST.command`**. If Mac blocks it: right-click → **Open**.
3. Press **Play** in Xcode.

That replaces files with the GitHub copy. Do not run it if you still need edits you only made locally.

## TestFlight

In Xcode: **Product → Archive** → **Distribute App** → **App Store Connect**.

Bundle ID: `com.brodregoss.lastminutestudy`

Create that app once in [App Store Connect](https://appstoreconnect.apple.com) if it is not there yet.

## What is still in this folder (and why)

| Thing | Needed? |
|-------|---------|
| `OPEN-IN-XCODE.xcworkspace` | Yes — this is what you double-click |
| `PULL-LATEST.command` | Yes — double-click to get GitHub updates without a new ZIP |
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
