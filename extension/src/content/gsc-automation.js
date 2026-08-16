// gsc-automation.js — Content script injected into an open, already-logged-in
// Search Console tab (https://search.google.com/search-console/*).
//
// ⚠️ UNOFFICIAL / AT YOUR OWN RISK ⚠️
// There is no public Google API for "request indexing" on ordinary pages or
// for the Removals tool (see modules/gsc-api.js for what IS official). This
// file drives the real Search Console web UI the same way a human would:
// it types a URL into the Inspection box, clicks the visible buttons, and
// waits for the on-screen confirmation — using the account's own already
// -authenticated session. It does not touch credentials, does not access
// any account other than the one already logged into the tab, and does not
// attempt to defeat CAPTCHAs, rotate IPs, or otherwise evade Google's bot
// detection — if Google's UI presents a CAPTCHA or blocks the action, this
// script stops and reports it rather than trying to push through.
//
// You (the extension operator) are responsible for:
//  - Telling end users clearly this is unofficial and can change/break
//    whenever Google tweaks the Search Console UI (it *will* break — this
//    needs maintenance).
//  - The real possibility Google flags automated-looking activity on an
//    account. Keep the pacing conservative (see DEFAULT_DELAY_MS).
//  - Not using this to hit other people's properties or accounts you don't
//    control.
//
// This module is intentionally kept SEPARATE from the sanctioned API code
// in modules/gsc-api.js so it's obvious which parts of the product rest on
// a real API contract and which parts rest on "the current DOM happens to
// look like this."

const DEFAULT_DELAY_MS = 4000; // conservative pacing between UI actions

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(selectorFn, { timeout = 15000, interval = 250 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = selectorFn();
    if (el) return el;
    await sleep(interval);
  }
  return null;
}

/**
 * Drive the Inspection box: paste a URL, submit, wait for the result panel.
 * Selectors are best-effort and MUST be re-verified against the live GSC UI
 * before shipping — Google renders this app with obfuscated class names
 * that change over time. Update SELECTORS below when the UI shifts.
 */
const SELECTORS = {
  inspectionInput: () =>
    document.querySelector('input[aria-label="Inspect any URL in the current domain owner"]') ||
    document.querySelector('input[type="text"][jsname]'),
  requestIndexingButton: () =>
    Array.from(document.querySelectorAll("button, span[role=button]")).find((el) =>
      /request indexing/i.test(el.textContent || "")
    ),
  removeUrlButton: () =>
    Array.from(document.querySelectorAll("button, span[role=button]")).find((el) =>
      /remove this url|new request/i.test(el.textContent || "")
    ),
  captchaLikely: () =>
    !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="captcha"]'),
  confirmationToast: () =>
    document.querySelector('[role="alert"], .cdk-live-announcer-element'),
};

async function submitOneUrl(url, action) {
  const input = await waitFor(SELECTORS.inspectionInput);
  if (!input) return { url, ok: false, error: "Inspection input not found — GSC UI may have changed." };

  input.focus();
  input.value = url;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  await sleep(1500);

  if (SELECTORS.captchaLikely()) {
    return { url, ok: false, error: "CAPTCHA/anti-bot challenge detected — stopping, not attempting to bypass it." };
  }

  const actionButton =
    action === "index" ? await waitFor(SELECTORS.requestIndexingButton, { timeout: 8000 }) : await waitFor(SELECTORS.removeUrlButton, { timeout: 8000 });

  if (!actionButton) {
    return { url, ok: false, error: `"${action}" button not found for this URL (may already be indexed/removed, or UI changed).` };
  }

  actionButton.click();
  await sleep(1500);

  if (SELECTORS.captchaLikely()) {
    return { url, ok: false, error: "CAPTCHA/anti-bot challenge detected after click — stopping." };
  }

  const toast = await waitFor(SELECTORS.confirmationToast, { timeout: 8000 });
  return { url, ok: !!toast, note: toast ? toast.textContent : "No confirmation toast observed — verify manually." };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "GSC_AUTOMATION_RUN_BATCH") return;

  (async () => {
    const { urls, action, delayMs = DEFAULT_DELAY_MS } = msg.payload;
    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const result = await submitOneUrl(urls[i], action);
      results.push(result);
      chrome.runtime.sendMessage({
        type: "GSC_AUTOMATION_PROGRESS",
        payload: { done: i + 1, total: urls.length, result },
      });
      if (result.error?.includes("CAPTCHA")) break; // hard stop, no bypass attempts
      if (i < urls.length - 1) await sleep(delayMs);
    }
    sendResponse({ results });
  })();

  return true; // keep the message channel open for the async response
});
