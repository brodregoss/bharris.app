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

## Run in Xcode (this is the app)

The iPhone app lives in `ios/App/`. I copy the latest website into that Xcode project and push it to GitHub, so you only need to pull and press Play.

**Do this once:**

```bash
git clone https://github.com/brodregoss/Last-Minute-Study.git
cd Last-Minute-Study
```

Then open this file in Xcode (double-click it in Finder, or File → Open):

`Last-Minute-Study/ios/App/App.xcodeproj`

1. At the top of Xcode, pick an iPhone simulator (for example iPhone 16).
2. Press the Play button (or Product → Run).

**Whenever there are new changes:**

```bash
cd Last-Minute-Study
git pull origin main
```

Then in Xcode: Product → Clean Build Folder, then Play again.

**To run on your real iPhone** (required — a phone cannot run an unsigned app):

1. Plug in the iPhone and unlock it. Trust the computer if asked.
2. In Xcode, click the blue **App** icon at the top of the left file list.
3. Click **Signing & Capabilities**.
4. Check **Automatically manage signing**.
5. Team → **Add an Account…** → sign in with your Apple ID → pick **Your Name (Personal Team)**.
6. At the top of Xcode, choose **your iPhone** (not a simulator).
7. Press Play. The first time, on the iPhone go to **Settings → General → VPN & Device Management** (or **Developer Mode**) and trust your Apple ID.

A free Apple ID is enough. You do not need a paid Developer account for your own phone.

Do not download a new zip each time. Do not keep an old Terminal `npm run dev` running — that is a different copy of the app.

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

## Native iOS / Xcode

The Xcode app lives in `mobile/ios/`. After pulling this branch, double-click:

`Open Last Minute Study in Xcode.command`

That opens `mobile/ios/LastMinuteStudy.xcworkspace`. In Xcode: pick mom's Team under Signing, then **Product → Archive**.

See `mobile/README.md` for TestFlight details.

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

The built-in **Bill of Rights** notes are under **use some of ours** on the welcome screen.

## Deploying

Build the static site with `npm run build` and deploy the `dist/` folder to any host (Vercel, Netlify, Cloudflare Pages, etc.). Set the same `VITE_BASE44_*` env vars in your host's dashboard so AI features keep working in production.
