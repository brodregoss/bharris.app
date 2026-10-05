# AGENTS.md

## Project Context

This is the bharris.app app (Vite, React, Firebase Auth, Cloudflare Worker). Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions. Do not add Base44 clients, plugins, hosts, or continue URLs.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Key Files

- `src/`: frontend application source.
- `src/lib/firebase.js`: Firebase Auth, including Google sign-in and password reset.
- `worker/`: Cloudflare Worker API and auth handoff.
- `vite.config.js`: Vite config. Local `/api` routes come from `server/llmDevPlugin.js`.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm run dev` for the frontend. Use `npm run worker:dev` when the local Worker should be running.
- Run the relevant checks from `package.json` before finishing code changes.
- The user runs the app in Xcode. After any UI change, run `npm run ios:sync` and commit `ios/App/App/public` (and iOS config) so Xcode has the latest build. Do not leave the iOS bundle stale.
