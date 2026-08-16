# Going live: gscsuite.online on Hostinger + GitHub

Your setup: domain + DNS at **Hostinger**, code on **GitHub**. Here's the
plan that fits it with the least moving parts:

```
gscsuite.online          → GitHub Pages   (marketing site + blog, free, static)
api.gscsuite.online      → Hostinger      (Node license server, needs a real backend)
Chrome Web Store         → the extension itself (separate from both)
```

Static sites don't need a paid host at all — GitHub Pages serves them free
and reliably. The license server needs an always-on Node process, which is
what your Hostinger plan is for.

---

## Part 1 — Push the code to GitHub

You said you already have a GitHub account. Two repos keeps concerns clean
(you can also use one repo with two folders if you'd rather — adjust paths
below accordingly):

```bash
# from the folder containing gscsuite-site/
cd gscsuite-site
git init
git add .
git commit -m "Initial GSCSuite marketing site"
git branch -M main
git remote add origin https://github.com/<your-username>/gscsuite-site.git
git push -u origin main
```

```bash
# from the folder containing gsc-suite/ (extension + server)
cd gsc-suite
git init
git add .
git commit -m "Initial GSCSuite extension + license server"
git branch -M main
git remote add origin https://github.com/<your-username>/gscsuite.git
git push -u origin main
```

(Create the empty repos on github.com first — "New repository", no README,
so the pushes above don't hit a merge conflict.)

## Part 2 — GitHub Pages for the marketing site

1. On the `gscsuite-site` repo → **Settings → Pages**.
2. Source: "Deploy from a branch" → branch `main`, folder `/ (root)`.
3. Under "Custom domain," enter `gscsuite.online` → Save. (The `CNAME` file
   already in the repo does this automatically too, but setting it in the
   UI is what triggers GitHub's HTTPS certificate provisioning.)
4. Leave this tab open — you'll come back to check the box once DNS
   propagates.

## Part 3 — Point Hostinger's DNS at GitHub Pages

In **Hostinger hPanel → Domains → gscsuite.online → DNS / Nameservers**,
add these records (delete any existing `A`/`CNAME` records on the same
host first — you can't have two):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |
| CNAME | www | `<your-username>.github.io` | 3600 |

DNS propagation is usually under an hour but can take up to 24. Once it's
resolved, go back to the GitHub Pages settings tab and check **"Enforce
HTTPS"** — it'll be greyed out until GitHub verifies the DNS.

## Part 4 — License server on Hostinger

Hostinger's Node.js hosting requires a **Business Web Hosting plan or
higher** (or a Cloud/VPS plan). If you're on a lower shared plan you'll
need to upgrade for this piece specifically — the marketing site doesn't
need it, only the server does.

1. In **hPanel → Websites → Add Website → Node.js**.
2. Connect your GitHub account and select the `gscsuite` repo, `/server`
   as the root directory (if you used two repos, point it at the
   `gscsuite` repo directly).
3. Entry file: `index.js`. Install command: `npm install`. Start command:
   `npm start`.
4. Under **Environment Variables**, add:
   - `STRIPE_SECRET_KEY` = your live Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` = you'll get this in Part 5 below
   - `PORT` = whatever Hostinger's Node runtime expects (check the panel;
     usually it's injected automatically)
5. Deploy. Hostinger auto-redeploys on every push to `main` once this is
   connected.
6. Attach the subdomain: in the same Node.js website's settings, under
   **Domain**, set it to `api.gscsuite.online`. Hostinger will add the
   necessary DNS record for you automatically since the domain is already
   on your account — confirm it shows up under DNS records as pointing to
   Hostinger's hosting IP for that subdomain.

## Part 5 — Stripe

1. In the [Stripe Dashboard](https://dashboard.stripe.com), create one
   **Product** per plan (Yearly $29, Lifetime $59, Day Pass $5) and a
   **Price** for each.
2. Create a **Checkout Session** flow on your pricing page's buttons — the
   simplest version is a [Stripe Payment Link](https://dashboard.stripe.com/payment-links)
   per plan (no code needed): create one, set `metadata.plan` to `yearly`
   / `lifetime` / `day-pass` matching what `server/index.js` expects, and
   swap the `href="#"` placeholders on `pricing.html`'s buttons for the
   generated Payment Link URLs.
3. **Developers → Webhooks → Add endpoint**: URL
   `https://api.gscsuite.online/webhooks/stripe`, event
   `checkout.session.completed`. Copy the signing secret into the
   `STRIPE_WEBHOOK_SECRET` environment variable from Part 4.
4. Test with Stripe's test mode + test card `4242 4242 4242 4242` before
   flipping to live keys.

## Part 6 — Google Cloud OAuth (for the extension itself)

Covered in `gsc-suite/README.md` — you'll need this before the extension's
Google features work at all. Two things from that guide matter for the
website: the OAuth consent screen requires a **privacy policy URL**, use
`https://gscsuite.online/privacy.html` (already built and in the repo,
but replace the placeholder legal text with something reviewed).

## Part 7 — Chrome Web Store

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) →
   pay the one-time $5 registration fee if you haven't already.
2. Zip the `extension/` folder's **contents** (not the folder itself) and
   upload as a new item.
3. Store listing needs: description, at least one 1280×800 screenshot,
   the privacy policy URL from Part 6, and — because this requests
   sensitive OAuth scopes and injects a content script into
   `search.google.com` — expect a longer review and a request for a demo
   video showing what the extension does before approval.
4. Once approved, grab the real Chrome Web Store URL and swap it into the
   `href="#"` "Add to Chrome" buttons across the site.

## Order to actually do this in

DNS propagation is the only slow, unattended step — kick that off first,
then work on Stripe/Node server setup while it resolves:

1. Push both repos to GitHub (Part 1).
2. Set the custom domain in GitHub Pages settings + add the Hostinger DNS
   `A` records (Parts 2–3) — **do this first**, propagation takes a while.
3. While DNS propagates: set up Stripe products/payment links/webhook
   (Part 5), and deploy the Node server on Hostinger (Part 4).
4. Submit the OAuth consent screen for verification (Part 6) — this is the
   slowest step overall (1–2 weeks), so don't leave it for last.
5. Once DNS is live, enforce HTTPS on GitHub Pages, test the full flow
   end-to-end (visit the site → buy → get a key → activate in the
   extension), then submit to the Chrome Web Store (Part 7).
