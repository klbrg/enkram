# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**enkram.se** ("en kram" = "a hug" in Swedish) is a tiny web app for sending anonymous, ephemeral digital hugs: you write a short message, optionally attach a Spotify track, and get a shareable short link. The recipient opens the link and sees the message + embedded track. Every hug auto-expires after 24 hours.

UI text and code comments are in Swedish. "kram" = hug, "kramar" = hugs.

## Architecture

Three deployables, hosted on **Azure Static Web Apps**:

1. **Frontend** (`index.html`, `style.css`) — a single-page app written in vanilla JS, **inline inside the `<script>` tag in `index.html`**. No framework, no build step, no bundler. The whole UI is rendered client-side into `<main id="app">`.

2. **API** (`api/`) — Azure Functions (Node.js, CommonJS). Two HTTP functions backed by Cosmos DB.

3. **Keep-warm** (`.azfunctions/keepWarmFunction/`) — a **separate** Azure Functions app (timer-triggered) that pings the API every 2 minutes to avoid cold starts.

### Client-side routing (important)

There is no server-side routing for hug pages. `staticwebapp.config.json`'s `navigationFallback` rewrites every path (except `/api/*`, `/favicon/*`, `/style.css`) to `/index.html`. The inline JS in `index.html` then reads the hug ID off `window.location.pathname`:

- path `/` → render the create form (`renderForm`)
- path `/<id>` → `loadKram(id)` → `renderKram` or `renderNotFound`

So a URL like `https://enkram.se/aB3x` serves `index.html`, and the JS interprets `aB3x` as the hug ID.

### Data flow

- **Create**: `POST /api/sendKram` with `{ message, trackId }` → `api/sendKram/index.js` sanitizes the message (strips all HTML via `sanitize-html`, converts `\n`→`<br>`), enforces a 500-char limit, generates a random **4-char** ID, writes to Cosmos with `ttl: 86400` (24h), returns `{ link: "https://enkram.se/<id>" }`.
- **Read**: `GET /api/getKram/{id}` → `api/getKram/index.js` reads `container.item(id, id)` (the partition key **is** the id) and returns `{ message, trackId }`, or 404/500.

**Cosmos DB**: database `kramDB`, container `kramar`, partitioned on `/id`. Item shape: `{ id, message, trackId, createdAt, ttl }`. The container must have TTL enabled for per-item `ttl` to take effect — this is why hugs disappear ("Kramen du letar efter finns inte längre").

### Spotify handling

When a user pastes a Spotify link into the textarea, a regex (in `renderForm`) extracts the track ID, shows an embed preview, and **strips the link out of the message text**; the track ID is sent separately as `trackId`. The matching regex is duplicated in two places in `index.html` (`extractSpotifyId` and the inline `spotifyRegex` in `renderForm`) — keep them in sync. Recent history is mostly regex tweaks; it currently matches `open.spotify.com/track/<id>` and `spotify.link/<id>`.

### Two different Azure Functions programming models (gotcha)

- `api/` uses the **v3 model**: one folder per function with a `function.json` binding file and `module.exports = async function (context, req)`.
- `.azfunctions/keepWarmFunction/` uses the **v4 model**: code-first registration via `app.timer(...)` from `@azure/functions`, no `function.json`.

Don't copy patterns between them.

## Commands

There is **no build step, no linter, and no test suite** (the `test` scripts in both `package.json`s are placeholders). The frontend is static files served as-is.

Local development (requires [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) and, for full emulation, the [SWA CLI](https://github.com/Azure/static-web-apps-cli)):

```bash
# API alone
cd api && npm install && func start

# Full app (static + API + SPA fallback, mirrors production)
npm i -g @azure/static-web-apps-cli   # if not installed
swa start . --api-location api

# Keep-warm function (separate app)
cd .azfunctions/keepWarmFunction && npm install && npm start   # npm start -> func start
```

The API needs Cosmos credentials. Locally, put them in `api/local.settings.json` (gitignored) under `Values`: `COSMOS_ENDPOINT` and `COSMOS_KEY`. In Azure they are app settings.

## Deployment

- **Frontend + `api/`** deploy automatically via GitHub Actions (`.github/workflows/azure-static-web-apps-red-water-0e8e6b503.yml`) on push/PR to `main` (`app_location: "/"`, `api_location: "api"`). PRs get preview environments; closing a PR tears its preview down.
- **`.azfunctions/keepWarmFunction/` is NOT covered by that workflow** — it is its own Azure Function App and must be deployed separately (e.g. `func azure functionapp publish <app-name>` from that directory).

## Gotchas

- The production URL `https://enkram.se/<id>` is **hard-coded** in `api/sendKram/index.js` rather than derived from the request host.
- 4-char IDs over a 62-char alphabet (~14.7M combinations) are generated with **no collision check** on create.
- Because everything is inline in `index.html` with no build, "the app" and "the source" are the same file — edit `index.html` directly.
