// indexnow.js — Bulk "instant indexing" via the IndexNow protocol.
// This is a REAL, sanctioned mechanism (not a workaround): Bing, Yandex,
// Naver, and Seznam.cz all officially consume IndexNow submissions.
// Google does NOT participate in IndexNow — see modules/gsc-api.js and
// content/gsc-automation.js for the Google-side story.
//
// Docs: https://www.bing.com/indexnow/getstarted

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_REQUEST = 10000; // IndexNow spec limit per submission

/**
 * Generate a random IndexNow key (host it as {key}.txt at your site root,
 * e.g. https://example.com/abcdef1234567890abcdef1234567890.txt containing
 * just the key string).
 */
export function generateIndexNowKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Submit a batch of URLs (must all share one host) to IndexNow.
 * @param {{host:string, key:string, keyLocation?:string, urlList:string[]}} params
 */
export async function submitUrlsToIndexNow({ host, key, keyLocation, urlList }) {
  if (!host || !key || !urlList?.length) {
    throw new Error("host, key, and urlList are required");
  }
  if (urlList.length > MAX_URLS_PER_REQUEST) {
    throw new Error(`IndexNow accepts at most ${MAX_URLS_PER_REQUEST} URLs per request`);
  }

  const body = {
    host,
    key,
    keyLocation: keyLocation || `https://${host}/${key}.txt`,
    urlList,
  };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  // IndexNow returns 200/202 on success, 400/403/422/429 on various failures.
  const status = res.status;
  if (status === 200 || status === 202) {
    return { ok: true, status };
  }
  const text = await res.text().catch(() => "");
  const messages = {
    400: "Invalid request format",
    403: "Key not found / key file not verified at keyLocation",
    422: "URLs don't belong to the host, or key doesn't match host",
    429: "Too many requests — back off",
  };
  return { ok: false, status, error: messages[status] || `HTTP ${status}`, body: text };
}

/**
 * Chunk a large URL list into IndexNow-sized batches and submit sequentially
 * with a short delay between batches to be a good citizen.
 */
export async function bulkSubmitToIndexNow({ host, key, keyLocation, urls }, onProgress = () => {}) {
  const chunks = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    chunks.push(urls.slice(i, i + MAX_URLS_PER_REQUEST));
  }
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const result = await submitUrlsToIndexNow({ host, key, keyLocation, urlList: chunks[i] });
    results.push(result);
    onProgress({ batch: i + 1, totalBatches: chunks.length, urlsInBatch: chunks[i].length, result });
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}
