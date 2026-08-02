const { CAPITALS } = require('../lib/capitals-data');

const BLOCKED_COUNTRIES = new Set(['Israel']);
function isBlockedCountry(country) {
  return BLOCKED_COUNTRIES.has((country || '').trim());
}

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

async function mapWithConcurrency(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        results[i] = e;
      }
    }
  }
  const pool = Array.from({ length: Math.min(size, items.length) }, run);
  await Promise.all(pool);
  return results;
}

async function buildCapitalsWeather() {
  const entries = Object.entries(CAPITALS).filter(([country]) => !isBlockedCountry(country));
  const results = await mapWithConcurrency(entries, 8, async ([country, [capital, lat, lon]]) => {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set('timezone', 'auto');
      ['temperature_2m', 'is_day', 'weather_code'].forEach((f) => url.searchParams.append('current', f));
      const data = await cachedFetchJson(url.toString());
      const cur = data?.current || {};
      return {
        country, capital, lat, lon,
        temperature: cur.temperature_2m,
        is_day: cur.is_day,
        weatherCode: cur.weather_code
      };
    } catch (e) {
      return { country, capital, lat, lon, error: String(e?.message || e) };
    }
  });
  return { capitals: results };
}

async function handler(req, res) {
  try {
    const now = Date.now();
    const cached = apiCache.get('capitals-weather');
    if (cached && cached.expires > now) {
      return res.json(cached.data);
    }
    const data = await buildCapitalsWeather();
    apiCache.set('capitals-weather', { expires: now + CACHE_TTL_MS, data });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

module.exports = handler;