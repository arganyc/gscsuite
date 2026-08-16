// background.js — MV3 service worker. Routes messages between the popup UI
// and the API/automation modules, and owns the one content-script tab used
// for GSC UI automation.

import * as gsc from "../modules/gsc-api.js";
import * as indexnow from "../modules/indexnow.js";
import * as license from "../modules/license.js";

const GSC_TAB_URL_PREFIX = "https://search.google.com/search-console";

async function findOrOpenGscTab() {
  const tabs = await chrome.tabs.query({ url: `${GSC_TAB_URL_PREFIX}/*` });
  if (tabs[0]) return tabs[0];
  const tab = await chrome.tabs.create({ url: `${GSC_TAB_URL_PREFIX}/inspect`, active: false });
  // Give the SPA time to boot before we try to drive it.
  await new Promise((r) => setTimeout(r, 4000));
  return tab;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "LIST_SITES":
          return sendResponse({ ok: true, data: await gsc.listSites() });

        case "QUERY_SEARCH_ANALYTICS":
          return sendResponse({ ok: true, data: await gsc.querySearchAnalytics(msg.siteUrl, msg.opts) });

        case "BULK_INSPECT": {
          const data = await gsc.bulkInspect(msg.siteUrl, msg.urls, (progress) => {
            chrome.runtime.sendMessage({ type: "BULK_INSPECT_PROGRESS", progress });
          });
          return sendResponse({ ok: true, data });
        }

        case "INDEXNOW_SUBMIT": {
          const data = await indexnow.bulkSubmitToIndexNow(msg.params, (progress) => {
            chrome.runtime.sendMessage({ type: "INDEXNOW_PROGRESS", progress });
          });
          return sendResponse({ ok: true, data });
        }

        case "GSC_AUTOMATION_RUN": {
          const tab = await findOrOpenGscTab();
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: "GSC_AUTOMATION_RUN_BATCH",
            payload: { urls: msg.urls, action: msg.action, delayMs: msg.delayMs },
          });
          return sendResponse({ ok: true, data: response?.results || [] });
        }

        case "LICENSE_ACTIVATE": {
          const deviceId = await license.getDeviceId();
          const state = await license.activateLicense(msg.licenseKey, deviceId);
          return sendResponse({ ok: true, data: state });
        }

        case "LICENSE_STATE":
          return sendResponse({ ok: true, data: await license.getLicenseState() });

        default:
          return sendResponse({ ok: false, error: `Unknown message type: ${msg.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err.message || err) });
    }
  })();
  return true; // async response
});

// Forward automation progress events from the content script up to any open popup.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "GSC_AUTOMATION_PROGRESS") {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});
