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
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // Map your Stripe Price IDs to plans here.
    const plan = session.metadata?.plan || "yearly";
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
