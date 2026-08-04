// Shared helpers for both the local Express server (server.js) and Vercel
// serverless functions under /api. Centralizes the upstream fetch + cache and
// the Israel filter so behavior is identical in both environments.
// Uses the built-in global fetch (Node 18+ / Vercel Node 24 runtime) so there
// is no ESM-only dependency to bundle.

const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function cachedFetchJson(urlString, options) {
  const now = Date.now();
  const cached = apiCache.get(urlString);
  if (cached && cached.expires > now) return cached.data;

  const r = await fetch(urlString, options);
  const data = await r.json();
  if (r.ok) apiCache.set(urlString, { expires: now + CACHE_TTL_MS, data });
  return data;
}

// Countries excluded from any geocoding result.
const BLOCKED_COUNTRIES = new Set(['Israel']);

function isBlockedCountry(country) {
  return BLOCKED_COUNTRIES.has((country || '').trim());
}

module.exports = { cachedFetchJson, isBlockedCountry };
