const { cachedFetchJson } = require('../../api/_lib');

function qs(event) {
  return event.queryStringParameters || {};
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  const q = qs(event);
  const lat = num(q.lat);
  const lon = num(q.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json(400, { error: 'lat and lon are required' });
  }
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('timezone', 'auto');
  ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'rain', 'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'uv_index', 'visibility'].forEach((f) => url.searchParams.append('current', f));
  ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'precipitation_sum', 'precipitation_probability_max', 'rain_sum', 'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration', 'uv_index_max', 'wind_speed_10m_max', 'wind_gusts_10m_max'].forEach((f) => url.searchParams.append('daily', f));
  try {
    const data = await cachedFetchJson(url.toString());
    return json(200, { data });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};
