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

async function proxy(urlString) {
  const data = await cachedFetchJson(urlString);
  return data;
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
  ['temperature_2m_min', 'temperature_2m_max'].forEach((f) => url.searchParams.append('daily', f));
  ['sunrise', 'sunset', 'precipitation_probability_max', 'weather_code'].forEach((f) => url.searchParams.append('daily', f));
  ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover', 'weather_code'].forEach((f) => url.searchParams.append('current', f));
  try {
    const data = await proxy(url.toString());
    return json(200, { data });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};
