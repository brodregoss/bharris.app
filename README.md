# Last Minute Study

A last-minute exam cram app. The iPhone app is this same React UI, wrapped in a native Xcode project with Capacitor. Change features in `src/`, then sync into Xcode.

AI features (term generation, panic notes, answer grading) still use **Base44 InvokeLLM** via your hosted Base44 app backend. Everything else runs in the app (`localStorage` on web, the same store inside the iPhone wrapper).

## Open in Xcode (Mac)

1. Pull this branch.
2. In Finder, double-click:

`Last-Minute-Study/Open Last Minute Study in Xcode.command`

If macOS blocks it: right-click → **Open**.

That installs npm packages if needed, builds the web app into the iPhone project, then opens:

`Last-Minute-Study/ios/App/App.xcodeproj`

## In Xcode → TestFlight

1. Left sidebar → **App**
2. **Signing & Capabilities** → Team → the paid Apple Developer team
3. Pick an iPhone simulator or a plugged-in iPhone, then press **Run** (▶)
4. When it looks right: **Product → Archive** → **Distribute App** → **App Store Connect** → TestFlight

Bundle ID: `com.brodregoss.lastminutestudy`

Create that App ID / app record once in [App Store Connect](https://appstoreconnect.apple.com) if it does not exist yet. Internal TestFlight testers can install without App Review. External testers need a short Beta App Review.

The first upload asks about encryption. The project already sets **App Uses Non-Exempt Encryption** to **No** (HTTPS only).

## Tinker (add or remove features)

Edit the React app in `src/` — that is the product. Examples:

- Add a screen: create `src/pages/YourPage.jsx` and a `<Route>` in `src/App.jsx`
- Remove a screen: delete the route and its page file
- Change copy, colors, cram flow: same files you would change for the website

Then on the Mac:

```bash
npm run ios:sync
```

Xcode already has the project open — press **Run** again. You do not maintain a second mobile codebase.

Web-only work (browser):

```bash
npm install
cp .env.local.example .env.local   # optional; production Base44 values are in .env.production
npm run dev
```

## Prerequisites

- Node.js 20+
- A Mac with Xcode (26+ if you are submitting to App Store Connect after Apple's April 2026 SDK rule)
- A paid Apple Developer account for TestFlight (a free Apple ID can run on Simulator only)
- A Base44 app (for AI credits) — production builds already point at the hosted Last Minute Study backend

## First-time setup

1. Clone this repo.
2. Install dependencies:

```bash
npm install
```

3. For local web AI calls, copy the environment template:

```bash
cp .env.local.example .env.local
```

iOS / production builds use `.env.production` automatically.

4. Start the dev server:

```bash
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## GitHub repository

This project is connected to [github.com/brodregoss/Last-Minute-Study](https://github.com/brodregoss/Last-Minute-Study).

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
npm run dev        # Local web development
npm run build      # Production web build → dist/
npm run ios:sync   # Build web app and copy it into the Xcode project
npm run ios:open   # Open ios/App/App.xcodeproj (Mac only)
npm run preview    # Preview production build
npm run lint       # ESLint
```

## Deploying the website

Build the static site with `npm run build` and deploy the `dist/` folder to any host (Vercel, Netlify, Cloudflare Pages, etc.). Set the same `VITE_BASE44_*` env vars in your host's dashboard so AI features keep working in production.
