# Last Minute Study

A last-minute exam cram app. Develop locally in Cursor; source code lives on GitHub.

AI features (term generation, panic notes, answer grading) still use **Base44 InvokeLLM** via your hosted Base44 app backend. Everything else runs as a normal Vite + React app.

## Prerequisites

- Node.js 20+
- A GitHub account
- A Base44 app (for AI credits only) — you need the app ID and backend URL

## First-time setup

1. Clone this repo (or download and `cd` into the project folder).
2. Install dependencies:

```bash
npm install
```

3. Copy the environment template and add your Base44 app credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

Find these in your [Base44 app dashboard](https://app.base44.com) — use the deployed app URL for `VITE_BASE44_APP_BASE_URL`.

4. Start the dev server:

```bash
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## How to see new changes (do this — do not download a new zip)

Download ZIP from GitHub every time will keep showing the old app, because the old `npm run dev` is still running in the previous folder.

**Do this once** (clone, not zip):

```bash
git clone https://github.com/brodregoss/Last-Minute-Study.git
cd Last-Minute-Study
npm install
npm run dev
```

**Then whenever there are new changes:**

1. In Terminal, stop the running app (`Ctrl+C`)
2. In the **same** folder:

```bash
git checkout main
git pull origin main
npm install
npm run dev
```

3. Hard-refresh the browser (`Cmd+Shift+R`)

To look over notes: Welcome → **use some of ours** → Bill of Rights → Continue → **Look over notes**. You should get a scroll-down list of cards.

If you already downloaded a zip today: close the old Terminal, `cd` into the **new** unzipped folder (the one named `Last-Minute-Study-main`), then `npm install` and `npm run dev` again.

## GitHub repository

This project is connected to [github.com/brodregoss/Last-Minute-Study](https://github.com/brodregoss/Last-Minute-Study).

```bash
git remote add origin https://github.com/brodregoss/Last-Minute-Study.git
git push -u origin main
```

After that, use normal git workflow from Cursor: commit and push when you save changes.

## What still uses Base44

| Feature | Base44 dependency |
|---------|-------------------|
| Term triage (AI) | `InvokeLLM` |
| Panic review notes (AI) | `InvokeLLM` |
| Practice test grading (AI) | `InvokeLLM` |
| Study sessions, settings, UI | Local only (`localStorage`) |

The SDK client is in `src/api/base44Client.js`. AI calls are in `Triage.jsx`, `PanicReview.jsx`, and `PracticeTest.jsx`.

## Migrating off Base44 AI later

When your Base44 credits run out, replace `base44.integrations.Core.InvokeLLM` in those three files with your own LLM API (OpenAI, Anthropic, etc.), then remove `@base44/sdk`, `@base44/vite-plugin`, and the env vars.

## Scripts

```bash
npm run dev      # Local development
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint
npm run ios:sync # Build the web app and copy it into the Xcode project
npm run ios:open # Open the iOS project in Xcode
```

## Run in Xcode (iPhone Simulator)

This repo is a website. Capacitor wraps that website in a native iOS app you can open in Xcode.

On your Mac, in the unzipped project folder (or after `git pull`):

```bash
npm install
npm run ios:sync
npm run ios:open
```

Then in Xcode:

1. Pick an iPhone simulator in the top toolbar.
2. Press the Play button (or **Product → Run**).

Do not open the folder as a generic Xcode project. Use `npm run ios:open`, which opens `ios/App/App.xcworkspace` / `App.xcodeproj`.

After you change the web app, run `npm run ios:sync` again, then Run in Xcode.

The built-in **Bill of Rights** notes are under **use some of ours** on the welcome screen. They do not need AI to load.

## Deploying

Build the static site with `npm run build` and deploy the `dist/` folder to any host (Vercel, Netlify, Cloudflare Pages, etc.). Set the same `VITE_BASE44_*` env vars in your host's dashboard so AI features keep working in production.
