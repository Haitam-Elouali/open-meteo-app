const { cachedFetchJson } = require('../lib/helpers');

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
  ['temperature_2m_min', 'temperature_2m_max'].forEach((f) => url.searchParams.append('daily', f));
  ['sunrise', 'sunset', 'precipitation_probability_max', 'weather_code'].forEach((f) => url.searchParams.append('daily', f));
  ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover', 'weather_code'].forEach((f) => url.searchParams.append('current', f));

  try {
    const data = await cachedFetchJson(url.toString());
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
