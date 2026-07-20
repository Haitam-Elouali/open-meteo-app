const { cachedFetchJson, isBlockedCountry } = require('../lib/helpers');
const { CAPITALS } = require('../lib/capitals-data');

const CAPITALS_TTL_MS = 10 * 60 * 1000;
let capitalsWeatherCache = { expires: 0, data: null };

// Resolve promises with a bounded concurrency so we never fire ~190 outbound
// requests at once (which saturates the event loop / network and makes the
// ticker feel slow). Items run in pools of `size`.
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
  // ~190 parallel requests hammer the upstream + the client's first paint.
  // Limit to 8 in-flight at a time; this keeps latency low without overload.
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

module.exports = async (req, res) => {
  try {
    const now = Date.now();
    if (capitalsWeatherCache.data && capitalsWeatherCache.expires > now) {
      return res.json(capitalsWeatherCache.data);
    }
    const data = await buildCapitalsWeather();
    capitalsWeatherCache = { expires: now + CAPITALS_TTL_MS, data };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
