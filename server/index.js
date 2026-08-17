// index.js — minimal license-key server matching the pattern GSCTool.com
// itself uses: pay on the website (Stripe) → get a license key → paste it
// into the extension → extension calls /api/license/verify.
//
// This is a STARTER, not production-hardened. Before going live: add HTTPS
// (or put it behind a platform that terminates TLS), rate-limit the verify
// endpoint, rotate the Stripe webhook secret, and move off SQLite if you
// expect meaningful concurrent writes.
//
// Run: STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... npm start

import express from "express";
import cors from "cors";
import Stripe from "stripe";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";

const PORT = process.env.PORT || 4242;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder";

const db = new Database("licenses.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    key TEXT PRIMARY KEY,
    plan TEXT NOT NULL,               -- 'yearly' | 'lifetime' | 'day-pass'
    email TEXT,
    stripe_customer_id TEXT,
    expires_at INTEGER,               -- epoch ms, NULL for lifetime
    seats_limit INTEGER DEFAULT 5,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activations (
    license_key TEXT NOT NULL,
    device_id TEXT NOT NULL,
    activated_at INTEGER NOT NULL,
    PRIMARY KEY (license_key, device_id)
  );
`);

const PLAN_DURATIONS_MS = {
  yearly: 365 * 24 * 60 * 60 * 1000,
  "day-pass": 24 * 60 * 60 * 1000,
  lifetime: null,
};

// Maps Stripe Price IDs (from the GSCSuite Payment Links created in the
// Stripe Dashboard) to internal plan names. Price IDs aren't secret — they're
// safe to hardcode here, same as they'd appear in client-side Checkout code.
// Both live-mode and test-mode IDs are listed; Stripe never mixes the two
// modes in a single session, so there's no ambiguity keeping both here —
// this also means test mode keeps working if STRIPE_SECRET_KEY is ever
// pointed back at a test key.
const PRICE_ID_TO_PLAN = {
  // Live mode
  price_1U5DVTAGs4FfkogR1QmvJNb3: "day-pass", // GSCSuite Day Pass — $5 one-time
  price_1U5DYeAGs4FfkogRGcUGdUAc: "yearly", // GSCSuite Yearly — $29/year
  price_1U5DaXAGs4FfkogRPCNh4j28: "lifetime", // GSCSuite Lifetime — $59 one-time

  // Test mode
  price_1U53sBAGs4FfkogRE6ZPIv3q: "day-pass", // GSCSuite Day Pass — $5 one-time
  price_1U53u8AGs4FfkogRR6twvvEZ: "yearly", // GSCSuite Yearly — $29/year
  price_1U53vIAGs4FfkogR2Ak2L1no: "lifetime", // GSCSuite Lifetime — $59 one-time
};

function issueLicense({ plan, email, stripeCustomerId }) {
  const key = `SS-${nanoid(4)}-${nanoid(4)}-${nanoid(4)}`.toUpperCase();
  const now = Date.now();
  const duration = PLAN_DURATIONS_MS[plan];
  db.prepare(
    `INSERT INTO licenses (key, plan, email, stripe_customer_id, expires_at, seats_limit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(key, plan, email, stripeCustomerId, duration ? now + duration : null, 5, now);
  return key;
}

const app = express();
app.use(cors());

// Stripe webhook needs the raw body for signature verification, so it's
// registered before the global json() body parser below.
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Prefer metadata.plan if it was set (e.g. via the API), otherwise fall
    // back to looking up the plan from the Price ID actually purchased —
    // this is what the Payment Links created in the Dashboard rely on,
    // since the Dashboard's Payment Link UI doesn't expose a metadata field.
    let plan = session.metadata?.plan;
    if (!plan) {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data[0]?.price?.id;
        plan = PRICE_ID_TO_PLAN[priceId];
      } catch (err) {
        console.error("Failed to look up line items for session", session.id, err.message);
      }
    }
    if (!plan) {
      console.error(`Could not determine plan for session ${session.id}; defaulting to yearly`);
      plan = "yearly";
    }

    const key = issueLicense({
      plan,
      email: session.customer_details?.email,
      stripeCustomerId: session.customer,
    });
    // In production: email the key to the customer (Stripe Checkout can
    // also just redirect to a success page that displays it once).
    console.log(`Issued license ${key} (${plan}) for ${session.customer_details?.email}`);
  }

  res.json({ received: true });
});

app.use(express.json());

app.post("/api/license/verify", (req, res) => {
  const { licenseKey, deviceId } = req.body || {};
  if (!licenseKey || !deviceId) {
    return res.status(400).json({ valid: false, error: "licenseKey and deviceId are required" });
  }

  const license = db.prepare("SELECT * FROM licenses WHERE key = ?").get(licenseKey);
  if (!license) return res.status(404).json({ valid: false, error: "Unknown license key" });

  if (license.expires_at && Date.now() > license.expires_at) {
    return res.status(403).json({ valid: false, error: "License expired" });
  }

  const existing = db
    .prepare("SELECT * FROM activations WHERE license_key = ? AND device_id = ?")
    .get(licenseKey, deviceId);

  if (!existing) {
    const seatsUsed = db
      .prepare("SELECT COUNT(*) AS n FROM activations WHERE license_key = ?")
      .get(licenseKey).n;
    if (seatsUsed >= license.seats_limit) {
      return res.status(403).json({ valid: false, error: "Seat limit reached for this license" });
    }
    db.prepare("INSERT INTO activations (license_key, device_id, activated_at) VALUES (?, ?, ?)").run(
      licenseKey,
      deviceId,
      Date.now()
    );
  }

  const seatsUsed = db
    .prepare("SELECT COUNT(*) AS n FROM activations WHERE license_key = ?")
    .get(licenseKey).n;

  res.json({
    valid: true,
    plan: license.plan,
    expiresAt: license.expires_at,
    seatsUsed,
    seatsLimit: license.seats_limit,
  });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`License server listening on :${PORT}`));
