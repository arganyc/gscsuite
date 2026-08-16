# SearchSuite — GSC & Bing Bulk Toolkit

A starter Chrome extension + license server modeled on GSCTool.com: bulk URL
inspection, Bing/IndexNow instant indexing, GSC data export/reporting, and
(unofficial) Google indexing/removal automation, gated behind a license-key
paywall since Chrome Web Store no longer runs native payments.

## What's real vs. unofficial (read this first)

| Feature | How it works | Status |
|---|---|---|
| Bulk URL Inspection | `urlInspection.index.inspect` | Official Google API |
| Search Analytics dashboard / export / compare | `searchAnalytics.query` | Official Google API |
| Sitemap submit/list | `sitemaps` resource | Official Google API |
| Bulk instant indexing (Bing, Yandex, Naver, Seznam) | IndexNow protocol | Official, open standard |
| Bulk "Request Indexing" (Google) | Drives the live Search Console web UI in a real logged-in tab | **Unofficial** — no public API exists for this on ordinary pages (Google's Indexing API is restricted to JobPosting/BroadcastEvent content, 200 req/day) |
| Bulk Removal / Block URLs (Google) | Same UI-automation approach | **Unofficial** — no public API exists for GSC's Removals tool at all |

The unofficial pieces live in `extension/src/content/gsc-automation.js`,
kept deliberately separate from the sanctioned API code in
`extension/src/modules/gsc-api.js` so it's always obvious which parts of the
product rest on a real API contract. They will need ongoing maintenance as
Google's UI changes, and carry a real risk of Google flagging automated
activity on an account — the in-app warning banner and conservative default
pacing (4s between actions, configurable in Settings) exist for that reason.
Consider whether a "we can't guarantee this keeps working" disclaimer belongs
in your own terms of service before selling it.

## 1. Google Cloud setup (required for the official features)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a new project.
2. **APIs & Services → Library** → enable **"Google Search Console API"**.
3. **APIs & Services → OAuth consent screen**:
   - User type: External.
   - Add scopes: `https://www.googleapis.com/auth/webmasters` and
     `.../webmasters.readonly`.
   - While in "Testing" mode you can add up to 100 test users; to let any
     user install the extension you'll need to submit for **verification**
     (Google reviews apps requesting sensitive scopes — expect this to take
     1–2 weeks and to require a privacy policy URL and a demo video).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Chrome Extension**.
   - You'll need your extension's ID first — load it unpacked
     (`chrome://extensions` → Developer mode → Load unpacked →
     select `extension/`) to get a stable ID, or reserve one by publishing
     as a private/unlisted item first.
5. Copy the generated Client ID into `extension/manifest.json` →
   `oauth2.client_id`.

## 2. Bing IndexNow setup

No approval process — it's an open protocol. In the popup's "Bing IndexNow"
tab, click **Generate key**, then host the key as a plain-text file at
`https://yourdomain.com/<key>.txt` (this proves domain ownership per URL
submission). That's it; submissions go straight to `api.indexnow.org`.

## 3. License server

```bash
cd server
cp .env.example .env   # fill in Stripe keys
npm install
npm start
```

`LICENSE_ENDPOINT` in `extension/src/modules/license.js` is already pointed
at `https://api.gscsuite.online/api/license/verify` — deploy the server to
that subdomain (see the main project's deployment guide) and configure a
Stripe webhook (`checkout.session.completed`) pointing at
`https://api.gscsuite.online/webhooks/stripe`. Set `session.metadata.plan`
when creating your Stripe Checkout Sessions so the webhook knows which plan
to issue.

Deploy targets that work well for this: Fly.io, Railway, Render, or a small
VPS — anything that can run a long-lived Node process. Swap `better-sqlite3`
for Postgres if you outgrow single-file SQLite.

## 4. Loading the extension locally

```
chrome://extensions → enable Developer mode → Load unpacked → select extension/
```

## 5. Publishing to the Chrome Web Store

- One-time $5 developer registration fee.
- Because this requests sensitive OAuth scopes *and* injects a content
  script into `search.google.com`, expect closer-than-average review
  scrutiny — have a clear, accurate description of what the extension does
  (including the unofficial automation) and a privacy policy page ready.
- Chrome Web Store no longer supports in-store payments — that's why
  licensing happens externally (see `/server`), same pattern GSCTool.com uses.

## Project layout

```
extension/
  manifest.json
  src/
    background/background.js      — message router, owns the GSC automation tab
    modules/
      auth.js                     — chrome.identity OAuth
      gsc-api.js                  — official Search Console API calls
      indexnow.js                 — official IndexNow submission
      license.js                  — license-key validation client
    content/gsc-automation.js     — unofficial GSC UI automation
    popup/                        — main UI
    options/                      — settings (automation pacing)
server/
  index.js                        — license issuance + verification + Stripe webhook
```
