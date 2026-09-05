# Last Minute Study

A last-minute exam cram app. Develop locally in Cursor; source code lives on GitHub.

AI features (term generation, panic notes, answer grading) use **OpenAI** through a small server so the secret key is never inside the iPhone app. Friends can beta test without pasting a key.

## Prerequisites

- Node.js 20+
- A GitHub account
- An OpenAI API key (restricted to List models + Model capabilities)
- A free [Vercel](https://vercel.com) account (so friends can use AI without your key sitting in the app)

## First-time setup

1. Clone this repo (or download and `cd` into the project folder).
2. Install dependencies:

```bash
npm install
```

3. Copy the environment template and add your **server** OpenAI key:

```bash
cp .env.local.example .env.local
```

In `.env.local` set `OPENAI_API_KEY` (no `VITE_` prefix). That file is gitignored. Do not put the key in any `src/` file — `npm run ios:sync` would copy it into GitHub.

4. Start the dev server:

```bash
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). AI calls go to `/api/llm` on your machine.

## Share with friends (beta)

Do **not** put the OpenAI key in the iPhone project. Put it on Vercel once. You pay for their usage, so set a **monthly budget** on the OpenAI project first.

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com), import the GitHub repo, and deploy.
3. In Vercel → Project → Settings → Environment Variables, add `OPENAI_API_KEY` with your key. Redeploy.
4. Copy the deployment URL, then in `.env.local` set:

```bash
VITE_LLM_PROXY_URL=https://YOUR-APP.vercel.app/api/llm
```

5. Run `npm run ios:sync` and rebuild in Xcode. The iPhone app now calls that URL. Testers do not paste a key.

Easiest way to share: send friends the Vercel website link. Sharing the Xcode app requires each person to build with their Apple ID (or a paid TestFlight account).

Friends then use the app with no key to paste.

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

## What uses OpenAI

| Feature | How |
|---------|-----|
| Term triage (AI) | OpenAI (`gpt-4o-mini`) |
| Panic review notes (AI) | OpenAI (`gpt-4o-mini`) |
| Practice test grading (AI) | OpenAI (`gpt-4o-mini`) |
| Study sessions, settings, UI | Local only (`localStorage`) |

The shared server is `api/llm.js` (Vercel) and `server/openaiLlm.js`. The iPhone app only stores the public `VITE_LLM_PROXY_URL`.

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

Build the static site with `npm run build` and deploy to Vercel so `/api/llm` is included. Set `OPENAI_API_KEY` in the Vercel dashboard, not as a `VITE_*` variable.
