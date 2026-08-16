// auth.js — Google OAuth via chrome.identity (Manifest V3)
// Uses the "identity" permission + the oauth2 client_id configured in manifest.json.
// You must create your own Google Cloud OAuth client (see README "Google Cloud setup").

const TOKEN_CACHE_KEY = "gsc_oauth_token_cache";

/**
 * Get a valid OAuth access token, prompting an interactive consent screen
 * the first time and silently refreshing afterwards.
 * @param {boolean} interactive
 * @returns {Promise<string>} access token
 */
export async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "No token returned"));
        return;
      }
      resolve(token);
    });
  });
}

/** Force-clear a cached (possibly stale/expired) token and re-auth. */
export async function refreshAuthToken() {
  const stale = await getAuthToken(false).catch(() => null);
  if (stale) {
    await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token: stale }, resolve));
  }
  return getAuthToken(true);
}

export async function signOut() {
  const token = await getAuthToken(false).catch(() => null);
  if (!token) return;
  await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
  // Revoke on Google's side too, so the next login re-prompts scopes cleanly.
  await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
}
