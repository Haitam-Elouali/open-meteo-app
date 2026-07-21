const { cachedFetchJson } = require('../lib/helpers');

module.exports = async (req, res) => {
  const { lat, lon, interval } = req.query;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', la);
  url.searchParams.set('longitude', lo);
  url.searchParams.set('timezone', 'auto');

  const useMinutely = String(interval || '') === '15';
  const fields = ['temperature_2m', 'relative_humidity_2m', 'weather_code', 'precipitation', 'precipitation_probability', 'wind_speed_10m'];
  if (useMinutely) {
    fields.forEach((f) => url.searchParams.append('minutely_15', f));
  } else {
    fields.forEach((f) => url.searchParams.append('hourly', f));
  }

  try {
    const data = await cachedFetchJson(url.toString());
    if (useMinutely && data?.minutely_15) {
      // Normalize minutely_15 response to the same shape as hourly so the
      // frontend can consume it transparently.
      data.hourly = data.minutely_15;
    }
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
