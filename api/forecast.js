const { cachedFetchJson } = require('./helpers');

module.exports = async (req, res) => {
  const { lat, lon, days } = req.query;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const requested = Math.min(Math.max(Number(days) || 7, 1), 31);
  const forecastDays = Math.min(requested, 16);

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', la);
  url.searchParams.set('longitude', lo);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(forecastDays));
  ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'rain', 'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'uv_index'].forEach((f) => url.searchParams.append('current', f));
  ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'precipitation_sum', 'precipitation_probability_max', 'rain_sum', 'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration', 'uv_index_max', 'wind_speed_10m_max', 'wind_gusts_10m_max'].forEach((f) => url.searchParams.append('daily', f));

  try {
    const data = await cachedFetchJson(url.toString());
    res.json({ data, horizon: requested, pastDays: 0, forecastDays });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
