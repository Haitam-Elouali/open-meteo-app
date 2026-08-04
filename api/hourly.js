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

async function handler(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('past_days', '1');

    const interval = String(req.query.interval || '').trim();
    if (interval === '15') {
      url.searchParams.set('minutely_15', 'temperature_2m');
    } else {
      [
        'temperature_2m',
        'relative_humidity_2m',
        'weather_code',
        'precipitation',
        'precipitation_probability',
        'wind_speed_10m'
      ].forEach((f) => url.searchParams.append('hourly', f));
    }

    const data = await cachedFetchJson(url.toString());

    if (interval === '15' && data?.minutely_15) {
      res.json({
        data: {
          hourly: {
            time: data.minutely_15.time || [],
            temperature_2m: data.minutely_15.temperature_2m || []
          }
        }
      });
      return;
    }

    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

module.exports = handler;
