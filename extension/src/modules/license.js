// license.js — client-side license check.
// Chrome Web Store discontinued its built-in payments API, so (like
// GSCTool.com itself) licensing lives outside the extension: user pays on
// your website, gets a license key, pastes it in here, and this module
// validates it against your own license server (see /server for a starter).

const LICENSE_ENDPOINT = "https://api.gscsuite.online/api/license/verify";
const STORAGE_KEY = "license_state";
const REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // re-check once a day

export async function activateLicense(licenseKey, deviceId) {
  const res = await fetch(LICENSE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey, deviceId, action: "activate" }),
  });
  const data = await res.json();
  if (!res.ok || !data.valid) {
    throw new Error(data.error || "License activation failed");
  }
  const state = {
    licenseKey,
    plan: data.plan, // "free" | "yearly" | "lifetime" | "day-pass"
    expiresAt: data.expiresAt || null,
    seatsUsed: data.seatsUsed,
    seatsLimit: data.seatsLimit,
    lastValidatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

export async function getLicenseState() {
  const { [STORAGE_KEY]: state } = await chrome.storage.local.get(STORAGE_KEY);
  return state || { plan: "free", licenseKey: null };
}

/** Re-validate the stored license if it's stale; returns the current state either way. */
export async function ensureLicenseFresh(deviceId) {
  const state = await getLicenseState();
  if (!state.licenseKey) return state;
  if (Date.now() - (state.lastValidatedAt || 0) < REVALIDATE_INTERVAL_MS) return state;

  try {
    return await activateLicense(state.licenseKey, deviceId);
  } catch {
    // Network hiccup or server down: don't lock the user out immediately,
    // just keep the last-known state and try again next time.
    return state;
  }
}

export function isFeatureAllowed(state, feature) {
  const limits = {
    free: new Set(["inspect_single", "dashboard_readonly"]),
    "day-pass": new Set(["*"]),
    yearly: new Set(["*"]),
    lifetime: new Set(["*"]),
  };
  const allowed = limits[state.plan] || limits.free;
  return allowed.has("*") || allowed.has(feature);
}

/** Stable per-install device id used for seat counting. */
export async function getDeviceId() {
  const { device_id } = await chrome.storage.local.get("device_id");
  if (device_id) return device_id;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ device_id: id });
  return id;
}
