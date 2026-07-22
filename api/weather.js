const { cachedFetchJson } = require('../lib/helpers');

module.exports = async (req, res) => {
  const { lat, lon, name, forecast_days } = req.query;
  const la = String(lat || '').split(',').map(Number).filter(Number.isFinite);
  const lo = String(lon || '').split(',').map(Number).filter(Number.isFinite);
  if (!la.length || !lo.length || la.length !== lo.length) {
    return res.status(400).json({ error: 'lat and lon arrays of equal length are required' });
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', la.join(','));
  url.searchParams.set('longitude', lo.join(','));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(Number(forecast_days) || 1));
  ['temperature_2m_min', 'temperature_2m_max'].forEach((f) => url.searchParams.append('daily', f));
  ['sunrise', 'sunset', 'precipitation_probability_max', 'weather_code'].forEach((f) => url.searchParams.append('daily', f));
  ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover', 'weather_code'].forEach((f) => url.searchParams.append('current', f));

  try {
    const data = await cachedFetchJson(url.toString());
    const names = String(name || '').split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
    res.json({ data, names });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
