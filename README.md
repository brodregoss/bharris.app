# bharris.app

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
2. **Authentication** → **Settings** → **Authorized domains**: keep `localhost`, `bharris-app.web.app` (the iPhone app hostname), `bharris.app`, and `bharris.broderickharris11.workers.dev`.
3. For the iPhone app: Project settings → **Add app** → iOS, bundle id `app.bharris.cram`. Download `GoogleService-Info.plist` into `ios/App/App/`.
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

The public site is [https://bharris.app](https://bharris.app). `www.bharris.app` redirects there. The iPhone app hostname is `bharris-app.web.app`. Password-reset links return through `bharris.app`.

## What uses OpenAI

All model calls go through the Worker (`/v1/ai/:feature`) after a quota check on the D1 user row: extract, definitions, triage, grade, explain, panic, distractors.

## Scripts

```bash
npm run dev            # Vite frontend (proxies /v1 to wrangler)
npm run worker:dev     # Cloudflare Worker on :8787
npm run worker:deploy  # Build the app, assemble the public site, then wrangler deploy
npm run build          # Production build → dist/ (iPhone). The public site is web-dist/
npm run lint           # ESLint
npm run ios:sync       # Build the web app and copy it into the Xcode project
npm run ios:open       # Open the iOS project in Xcode
```

## Deploying the Worker

```bash
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRICE_SOLO
npx wrangler secret put STRIPE_PRICE_PARTNER
npx wrangler secret put NOTES_SCAN_TOKEN_SECRET
npx wrangler secret put DEV_TOOLS_CODE_HASH
npm run worker:deploy
```

Photo upload does not ask for a password. Settings has a Dev tools code. After that code checks out, Kill photo upload turns scanning off for everyone, and Turn photo upload on brings it back. `node scripts/notes-scan-secret.mjs --write` creates the token secret used by that dev code. `node scripts/notes-scan-secret.mjs --dev --write` creates the dev code and prints it once. The dev code is checked on the server and is not stored in the app.

Website plans are Study at $8/month and Partner study at $12/month.

1. In Stripe, create two recurring monthly prices and save their price ids as `STRIPE_PRICE_SOLO` and `STRIPE_PRICE_PARTNER`.
2. Developers → API keys: save the secret key as `STRIPE_SECRET_KEY`.
3. Developers → Webhooks: add the Worker URL ending in `/v1/billing/stripe` for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Save the signing secret as `STRIPE_WEBHOOK_SECRET`.
4. Settings → Billing → Customer portal: turn the portal on so **Manage subscription** on the plans page can cancel, update a card, and show invoices.

Checkout sends the buyer to `/thanks/`. The plans page has a Code field. `beta` starts a 7-day free period with no card and no charge. When that week ends, access ends and the plans page says the free week ended. Each account can use that code once. Set `BETA_PROMO_CODE` to `off` to stop accepting it. A free trial configured on a Stripe price is different: those buyers enter a card, and Stripe charges the plan price when the trial ends. Manage customers, trials, and cancellations in the Stripe Dashboard under Customers and Subscriptions. Partner study creates one code; resetting it voids the old code, and ending that subscription removes access for both people.

Set `VITE_WORKER_URL` to `https://bharris.app`, then `npm run ios:sync`. Opening https://bharris.app loads the public homepage. The study app is at `/app/` (`/v1` stays the API). Add `bharris.app` under Firebase Authentication → Settings → Authorized domains. The `workers.dev` hostname still reaches the same Worker.

The live app does not use Vercel. Old `api/llm.js` / `api/account.js` files are leftover and unused.

## Run in Xcode

The iPhone app lives in `ios/App/`. After `npm run ios:sync`, open:

`ios/App/App.xcodeproj`

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
