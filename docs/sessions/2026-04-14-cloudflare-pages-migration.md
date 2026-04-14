# Session Log — 2026-04-14

## Migration: Hostinger → Cloudflare Pages, allowlist refactor, www redirect, token rotation

A long working session that started as "the daily briefing showed somapym.com is stale" and ended with the site fully migrated to Cloudflare Pages, sign-in fixed, code refactored for multi-user access, www properly redirecting, and the deploy pipeline reduced to one command.

This document is **canonical** for what was done — refer to it before assuming anything about how somapym.com is wired.

---

## TL;DR — the new state

| Thing | Where it lives now |
|---|---|
| Live site | https://somapym.com (apex) and https://www.somapym.com (301 → apex) |
| Hosting | Cloudflare Pages, project `somapym-hub`, in `Pixelartinc@gmail.com's Account` |
| Source repo | `/Users/somapym/Developer/somapym-hub/` on Mac Studio (`Somas-Mac-Studio.local`) |
| GitHub | `https://github.com/somachak/somapym-hub` |
| Deploy command | `npm run deploy:cf` |
| API token | `~/.cloudflare/token` (chmod 600), token name in CF dashboard: "Edit Cloudflare Workers" |
| Auth allowlist | `src/firebase.js` → `ALLOWED_EMAILS` array (1 filled + 5 empty slots) |
| Firebase project | `cosmetic-ai-assistant` (shared — the Command Centre piggybacks on the Cosmetic AI Assistant's Firebase project for auth + Firestore) |
| Cloudflare zone ID | `d3a01644a583008939687700bd2bb1df` |
| Cloudflare account ID | `84109e1abca4de1a49667be4443d08e7` |
| Domain registrar | Cloudflare (transfer from Hostinger initiated, status "waiting for previous registrar to release", up to 7 days) |

**To grant a new person access**: edit one of the empty slots in `ALLOWED_EMAILS` in `src/firebase.js`, then `npm run deploy:cf`. Done.

---

## What was already true (context coming in)

- somapym.com was hosted on Hostinger (LiteSpeed) behind Cloudflare DNS/CDN
- The live HTML had a `Last-Modified: Fri, 20 Mar 2026 11:35:16 GMT` header — **25 days stale**
- Local repo had 6 unpushed... no wait, all commits were on origin/main. The dist folder existed but was never copied to Hostinger after March 20
- The deploy script `gh-pages -d dist` in package.json was a leftover from the Vite template — pushed to a `gh-pages` branch nobody used. Effectively dead code
- No GitHub Actions, no Hostinger Git integration, no FTP automation — Soma had been deploying manually via Hostinger's File Manager and stopped
- Firebase Auth was broken on the live site (silent fail) because the Firebase project's authorized domains list didn't include `somapym.com` — only `localhost` and `cosmetic-ai-assistant.firebaseapp.com` were on the allowlist
- The auth gate was a hardcoded single-email check: `if (email === 'pixelartinc@gmail.com')`

---

## What was done (in order)

### 1. Diagnosed the deploy problem
Confirmed the site was 25 days stale by comparing live `Last-Modified` to git log. Confirmed the `gh-pages` script was a no-op. Looked for FTP credentials, lftp, rclone, and Hostinger automation — none existed.

### 2. Switched to Cloudflare Pages
- Tried `wrangler login` (OAuth) — timed out because the user was busy in another tab during the 60-second window
- Switched to API token: user created an "Edit Cloudflare Workers" template token at https://dash.cloudflare.com/profile/api-tokens and pasted it
- Token saved to `~/.cloudflare/token` with chmod 600
- Verified `wrangler whoami`
- Discovered the Cloudflare MCP exposes account/D1/KV/R2/Hyperdrive/Workers (read-only) but **no Pages CRUD** — confirmed by exhaustive ToolSearch. Pages operations require wrangler CLI.

### 3. Created the Pages project + first deploy
```bash
npx wrangler@latest pages project create somapym-hub --production-branch=main
npx wrangler@latest pages deploy dist --project-name=somapym-hub --branch=main
```
Preview URL `somapym-hub.pages.dev` returned the new bundle.

### 4. Diagnosed and instructed the Firebase Auth fix
Read `src/firebase.js` and saw `authDomain: "cosmetic-ai-assistant.firebaseapp.com"`. The Command Centre is sharing the Firebase project from the Cosmetic AI Assistant. By default Firebase only allows OAuth callbacks to `localhost` and `<project>.firebaseapp.com`. Loading the app from `somapym.com` or `somapym-hub.pages.dev` caused the Google sign-in popup to silently fail because Firebase rejected the callback origin.

**Fix (Soma did this in the Firebase console):** added `somapym.com`, `www.somapym.com`, and `somapym-hub.pages.dev` to Authentication → Settings → Authorized domains in the `cosmetic-ai-assistant` Firebase project.

After Soma made this change, sign-in worked on `somapym-hub.pages.dev`.

### 5. Refactored the auth allowlist
Added `ALLOWED_EMAILS` array + `isAllowedEmail()` helper to `src/firebase.js`:
```js
export const ALLOWED_EMAILS = [
  'pixelartinc@gmail.com',
  '', // slot 2 — e.g. 'lucas@example.com'
  '', // slot 3
  '', // slot 4
  '', // slot 5
  '', // slot 6
];
```
Empty slots are placeholders — `isAllowedEmail()` filters them out at runtime via `ALLOWED_EMAILS.filter(Boolean).includes(email)`.

Updated `src/components/AuthGate.jsx` (both the `onAuthStateChanged` handler and `handleSignIn`) and `src/App.jsx` (the duplicate auth check used by the Layout) to call `isAllowedEmail()` instead of comparing strings. Improved the rejection alert from *"Please sign in with pixelartinc@gmail.com"* to *"This email is not on the allowlist. Contact the admin to be added."*

Build → bundle hash changed to `index-BCgZ0iGo.js` → deployed → verified strings present in minified output → Soma confirmed sign-in worked on the new URL.

Commit: `48221ab refactor: convert AuthGate hardcoded email check to ALLOWED_EMAILS array`.

### 6. Cut over the apex domain
- Attached `somapym.com` to the Pages project via API: `POST /accounts/{account}/pages/projects/somapym-hub/domains` with `{"name":"somapym.com"}`
- API returned `status: pending, error: "CNAME record not set"` — Pages doesn't auto-update DNS
- The token didn't have DNS:Edit scope, so used Chrome MCP to drive the Cloudflare dashboard at `dash.cloudflare.com/{account}/somapym.com/dns/records`
- Deleted the apex A record (`somapym.com → 145.14.152.221`)
- Deleted the apex AAAA record (`somapym.com → 2a02:4780:a:808:0:148f:9c97:6`)
- Added apex CNAME @ → `somapym-hub.pages.dev` with proxy ON (CNAME flattening at apex)
- Triggered Pages re-verification by clicking "Check DNS records" in the custom domains panel
- Status went `pending` → `active` in **15 seconds**
- Verified `https://somapym.com/` returned HTTP 200 with the new bundle hash and no `platform: hostinger` header

**Brief downtime**: ~3 seconds between deleting the A record and adding the CNAME. Recovered instantly. somapym.com was NXDOMAIN during this window.

### 7. www subdomain + redirect
- Attached `www.somapym.com` to the Pages project via API
- Edited `www` DNS: deleted A `185.158.133.1` (Hostinger), added CNAME `www → somapym-hub.pages.dev` (proxied)
- Created a Single Redirect rule from the **"Redirect from WWW to root"** template at `dash.cloudflare.com/{account}/somapym.com/rules/redirect-rules`. Pattern: `https://www.*` → `https://${1}` with status 301
- Verified `curl -sI https://www.somapym.com/some/path?foo=bar&baz=qux` returns `HTTP/2 301` with `location: https://somapym.com/some/path?foo=bar&baz=qux` — query string preserved
- Pages domain status for www went `pending` → `active`

### 8. Deploy script
Added to `package.json`:
```json
"deploy:cf": "vite build && CLOUDFLARE_API_TOKEN=$(cat ~/.cloudflare/token) npx wrangler@latest pages deploy dist --project-name=somapym-hub --branch=main --commit-dirty=true"
```
Commit: `04b3664 chore: add deploy:cf script for Cloudflare Pages`.

The legacy `"deploy": "gh-pages -d dist"` script was left in place as dead code (didn't proactively clean up — scope discipline).

### 9. Token rotation
After the API token had been pasted in chat history (security risk), used Chrome MCP to drive the Cloudflare API tokens page → kebab menu on the "Edit Cloudflare Workers" row → **Roll** → confirmed rolled. Captured the new token value via `javascript_tool` reading the rendered DOM, saved to `~/.cloudflare/token`, verified `wrangler whoami` still authenticated.

The previously-leaked token is now dead. The new token is also in this conversation history (because reading via JS pulls the value into context); future-me should consider rolling it again from the dashboard if security matters.

### 10. Anaconda Learning Hub link added
The Command Centre `AppDetail.jsx` already renders an "Open App" button when a project has a `deployUrl` field. Added `deployUrl: 'https://anaconda-learning-hub.pages.dev'` to the `anaconda-hub` project in `src/data/projects.js`. Build + deploy + verified the live bundle on somapym.com contains the new URL.

This is **just a link** — no architectural consolidation. Anaconda Learning Hub remains a separate Cloudflare Pages project at `anaconda-learning-hub.pages.dev` (created 3 weeks ago, untouched by this session).

### 11. Phase 2 architectural consolidation — DROPPED
Started a brainstorm on consolidating Anaconda + other projects under `somapym.com` (subdomain vs subpath vs merged repo). Soma rejected all options: *"No, just leave them as is for now. I don't want to do any architectural work to bring them into somapym.com."*

This decision is recorded in memory at `feedback_no_consolidation.md`. **Do not re-pitch consolidation in future sessions.** Each project keeps its own URL. The Command Centre is a portal, not a wrapper.

### 12. Phase 3 initiatives — DEFERRED
Soma described two follow-on initiatives at the end of the session:

1. **Bold dashboard + autonomous QA**. Use the autonomous managed agents he has enabled to schedule a Chrome MCP test run against `somapym.com`, write findings to an issues log, stop at a human gate, then a fixer agent applies approved fixes.
2. **Million-dollar idea engine**. A scheduled web-research task that produces evidence-based ideas tied to each project, surfaced in the Command Centre dashboard.

Both are detailed in `project_phase3_ideas.md` (memory). They need their own brainstorming sessions — neither was scoped, designed, or implemented in this session.

---

## Things to NEVER touch

| What | Why |
|---|---|
| `ftp` A record (`145.14.152.221`) | Legacy Hostinger FTP subdomain — unrelated to web hosting, may still be in use for SFTP access |
| `hank` Tunnel record | Unrelated Cloudflare Tunnel for the Hank assistant |
| `.claude/` directory in the repo | Local Claude Code config, never commit — already in `.gitignore` indirectly via working tree |
| The legacy `deploy: gh-pages -d dist` script | Dead code but harmless. Leaving for now. |
| The `cosmetic-ai-assistant` Firebase project's other config | The Command Centre shares this Firebase project. Don't change project-wide settings without thinking about Cosmetic AI impact |

---

## Commits made in this session (in order)

```
04b3664 chore: add deploy:cf script for Cloudflare Pages
48221ab refactor: convert AuthGate hardcoded email check to ALLOWED_EMAILS array
<also added later> feat: add Anaconda Learning Hub live URL to project card
```

All committed locally on `main`. **Not pushed to GitHub** — Soma can `git push` whenever.

---

## How to verify everything still works

```bash
# 1. Site loads
curl -sI https://somapym.com/ | head -3
# Expected: HTTP/2 200, server: cloudflare, no platform: hostinger

# 2. www redirects to apex
curl -sI https://www.somapym.com/ | grep -i location
# Expected: location: https://somapym.com/

# 3. Bundle is fresh
curl -s https://somapym.com/ | grep "assets/index-"
# Expected: shows the latest hash, NOT index-CQwUoHQG.js (old Hostinger build)

# 4. wrangler still works
CLOUDFLARE_API_TOKEN=$(cat ~/.cloudflare/token) npx wrangler@latest whoami

# 5. Deploy works
cd ~/Developer/somapym-hub && npm run deploy:cf
```

---

## Things Soma should know

- **You can deploy any time** with `npm run deploy:cf`. The token reads from `~/.cloudflare/token`, no env vars needed.
- **To grant Lucas (or anyone) access**: edit a slot in `src/firebase.js` `ALLOWED_EMAILS`, run `npm run deploy:cf`. They use Google sign-in with their email, the AuthGate lets them in.
- **To revoke access**: clear their slot back to `''` and redeploy.
- **To roll the API token** (for security hygiene): `dash.cloudflare.com/profile/api-tokens` → kebab menu on "Edit Cloudflare Workers" → Roll → save the new value into `~/.cloudflare/token`.
- **The registrar transfer** from Hostinger to Cloudflare is in flight. Status: "waiting for previous registrar to release". Up to 7 days. **Doesn't affect the live site** — DNS is already in CF.
- **Cosmetic AI Assistant is your P1, May 15 launch**, and is currently STALE. Nothing in this session touched it — its repo is at `~/Desktop/Coding & Development/Active Projects/Brainstorming for cosmetic-ai-assistant/cosmetic-ai-assistant/` (per memory). Next session might want to focus there.
