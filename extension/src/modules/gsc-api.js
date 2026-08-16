// gsc-api.js — thin wrapper around the OFFICIAL Google Search Console API
// (searchconsole.googleapis.com / www.googleapis.com/webmasters/v3).
// Every call here maps to a real, documented, sanctioned endpoint:
//   https://developers.google.com/webmaster-tools/v1/api_reference_index
//
// There is intentionally NO "removeUrl" or "requestIndexing" function in this
// file — Google does not expose those as public APIs for ordinary pages.
// See modules/indexnow.js (Bing/legit) and content/gsc-automation.js
// (Google UI-automation, unofficial) for those features instead.

import { getAuthToken, refreshAuthToken } from "./auth.js";

const WEBMASTERS_BASE = "https://www.googleapis.com/webmasters/v3";
const SC_BASE = "https://searchconsole.googleapis.com/v1";

async function authedFetch(url, options = {}, _retried = false) {
  const token = await getAuthToken(true);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && !_retried) {
    await refreshAuthToken();
    return authedFetch(url, options, true);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GSC API ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

/** List the Search Console properties (sites) the authenticated user can access. */
export async function listSites() {
  const data = await authedFetch(`${WEBMASTERS_BASE}/sites`);
  return data?.siteEntry || [];
}

/** List sitemaps submitted for a property. */
export async function listSitemaps(siteUrl) {
  const data = await authedFetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps`
  );
  return data?.sitemap || [];
}

/** Submit (re-ping) a sitemap for a property — official, sanctioned. */
export async function submitSitemap(siteUrl, feedpath) {
  return authedFetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
    { method: "PUT" }
  );
}

/**
 * Query Search Analytics (clicks/impressions/CTR/position), the data source
 * for the dashboard, comparisons, and CSV export.
 */
export async function querySearchAnalytics(siteUrl, {
  startDate,
  endDate,
  dimensions = ["query"],
  rowLimit = 1000,
  startRow = 0,
  dimensionFilterGroups = [],
  searchType = "web",
} = {}) {
  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    startRow,
    dimensionFilterGroups,
    type: searchType,
  };
  const data = await authedFetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data?.rows || [];
}

/**
 * Official URL Inspection API — real index status, coverage state, canonical,
 * mobile usability, rich results, etc. Google's documented per-property quota
 * is limited (historically ~2000 requests/day, refreshed daily) — the batch
 * runner below paces calls and surfaces quota errors instead of hammering it.
 */
export async function inspectUrl(siteUrl, inspectionUrl) {
  const data = await authedFetch(`${SC_BASE}/urlInspection/index:inspect`, {
    method: "POST",
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  return data?.inspectionResult;
}

/**
 * Bulk URL inspection with simple client-side pacing to stay well under
 * Google's per-minute quota (380 req/min across all Search Console API
 * endpoints) and to fail gracefully on daily quota exhaustion.
 * @param {string} siteUrl
 * @param {string[]} urls
 * @param {(progress:{done:number,total:number,url:string,result?:any,error?:string})=>void} onProgress
 * @param {{delayMs?:number}} opts
 */
export async function bulkInspect(siteUrl, urls, onProgress = () => {}, opts = {}) {
  const delayMs = opts.delayMs ?? 350; // ~170/min, safely under the 380/min cap
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const result = await inspectUrl(siteUrl, url);
      results.push({ url, result });
      onProgress({ done: i + 1, total: urls.length, url, result });
    } catch (err) {
      results.push({ url, error: String(err.message || err) });
      onProgress({ done: i + 1, total: urls.length, url, error: String(err.message || err) });
      // Daily quota exhausted or rate-limited — stop early rather than
      // burning through remaining URLs on guaranteed failures.
      if (/RESOURCE_EXHAUSTED|429/.test(err.message || "")) {
        onProgress({ done: i + 1, total: urls.length, url, error: "Quota exhausted — stopping batch." });
        break;
      }
    }
    if (i < urls.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}

/** Convert Search Analytics rows to CSV for the "Export Complete Data" feature. */
export function rowsToCsv(rows, dimensions) {
  const header = [...dimensions, "clicks", "impressions", "ctr", "position"];
  const lines = [header.join(",")];
  for (const row of rows) {
    const keys = row.keys || [];
    const line = [
      ...keys.map((k) => `"${String(k).replace(/"/g, '""')}"`),
      row.clicks ?? 0,
      row.impressions ?? 0,
      row.ctr ?? 0,
      row.position ?? 0,
    ];
    lines.push(line.join(","));
  }
  return lines.join("\n");
}
