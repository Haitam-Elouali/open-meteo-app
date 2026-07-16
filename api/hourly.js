const { cachedFetchJson } = require('./helpers');

module.exports = async (req, res) => {
  const { lat, lon } = req.query;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', la);
  url.searchParams.set('longitude', lo);
  url.searchParams.set('timezone', 'auto');
  ['temperature_2m', 'relative_humidity_2m', 'weather_code', 'precipitation', 'precipitation_probability', 'wind_speed_10m'].forEach((f) => url.searchParams.append('hourly', f));

  try {
    const data = await cachedFetchJson(url.toString());
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
