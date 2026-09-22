# Last Minute Study

A last-minute exam cram app. Accounts use **Firebase**. Notes, sessions, and AI quota go through a **Cloudflare Worker** (D1 + Durable Objects). Photos are transcribed on the device, then discarded — original JPEGs are not stored. App Store upgrades use **RevenueCat**. The OpenAI key never lives in the iPhone app.

## Prerequisites

- Node.js 20+
- A GitHub account
- A Firebase project with Email/Password and Google sign-in enabled
- A Cloudflare account (Workers, D1, Durable Objects)
- An OpenAI API key
- A RevenueCat project (for the iPhone paywall)

## First-time setup

1. Clone this repo and install dependencies:

```bash
npm install
cd worker && npm install && cd ..
```

2. Copy env templates:

```bash
cp .env.local.example .env.local
cp worker/.dev.vars.example worker/.dev.vars
```

3. In `.env.local` set the public Firebase config, `VITE_WORKER_URL` (for iOS builds), and the RevenueCat public iOS key.

4. In `worker/.dev.vars` set `FIREBASE_PROJECT_ID`, `OPENAI_API_KEY`, and later the RevenueCat secret / webhook secret. Put real secrets there with `wrangler secret put` before deploying.

5. Run the Worker and the web app:

```bash
npm run worker:dev
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). Vite proxies `/v1` to the Worker on port 8787.

Create an account on `/account/create` or tap **Continue with Google**. That calls Firebase, then `POST /v1/users/me`.

### Google sign-in

1. Firebase Console → **Authentication** → **Sign-in method** → enable **Google** → Save.
2. **Authentication** → **Settings** → **Authorized domains**: keep `localhost` and add `enthusiastic-cram-genius-flow.base44.app` (the Capacitor iOS hostname).
3. For the iPhone app: Project settings → **Add app** → iOS, bundle id `app.lastminutestudy.cram`. Download `GoogleService-Info.plist` into `ios/App/App/`.
4. In Xcode, **Info** → **URL Types**, add a URL scheme equal to `REVERSED_CLIENT_ID` from that plist.
5. `npm run ios:sync` and rebuild in Xcode.

## iPhone (Xcode)

```bash
npm run ios:sync
```

Then open `ios/App/App.xcodeproj`. The shared App scheme points at `ios/StudyApp.storekit` so Simulator has monthly/yearly Study Pro products. Product ids must match App Store Connect, RevenueCat, and `src/lib/appConfig.js`:

- `studyapp.pro.monthly`
- `studyapp.pro.yearly`
- Entitlement: `Study Pro`

Plans in the app: **Free** (5 AI calls/month) and **Study Pro** (30 AI calls/month, $4.99/mo or $39.99/yr). The paywall in Settings shows that comparison. StoreKit / RevenueCat supply the live prices on device.

Add your Firebase auth domain for the Capacitor hostname (`enthusiastic-cram-genius-flow.base44.app`).

## What uses OpenAI

All model calls go through the Worker (`/v1/ai/:feature`) after a quota check on the D1 user row: extract, definitions, triage, grade, explain, panic, distractors.

## Scripts

```bash
npm run dev            # Vite frontend (proxies /v1 to wrangler)
npm run worker:dev     # Cloudflare Worker on :8787
npm run worker:deploy  # wrangler deploy
npm run build          # Production build → dist/
npm run lint           # ESLint
npm run ios:sync       # Build the web app and copy it into the Xcode project
npm run ios:open       # Open the iOS project in Xcode
```

## Deploying the Worker

```bash
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put OPENAI_API_KEY
npm run worker:deploy
```

Set `VITE_WORKER_URL` to the `workers.dev` URL it prints, then `npm run ios:sync`. Opening that URL in a browser now loads the app (`/v1` stays the API). Add the same hostname under Firebase Authentication → Settings → Authorized domains.

The live app does not use Vercel. Old `api/llm.js` / `api/account.js` files are leftover and unused.

## Run in Xcode

The iPhone app lives in `ios/App/`. After `npm run ios:sync`, open:

`Last-Minute-Study/ios/App/App.xcodeproj`

1. At the top of Xcode, pick an iPhone simulator (for example iPhone 16).
2. Press the Play button (or Product → Run).

**To run on your real iPhone:**

1. Plug in the iPhone and unlock it. Trust the computer if asked.
2. In Xcode, click the blue **App** icon at the top of the left file list.
3. Click **Signing & Capabilities**.
4. Check **Automatically manage signing**.
5. Team → **Add an Account…** → sign in with your Apple ID → pick **Your Name (Personal Team)**.
6. At the top of Xcode, choose **your iPhone** (not a simulator).
7. Press Play. The first time, on the iPhone go to **Settings → General → VPN & Device Management** (or **Developer Mode**) and trust your Apple ID.

The built-in **Bill of Rights** notes are under **use some of ours** on the welcome screen.
