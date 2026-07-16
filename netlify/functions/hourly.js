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
  ['temperature_2m', 'relative_humidity_2m', 'weather_code', 'precipitation', 'precipitation_probability', 'wind_speed_10m'].forEach((f) => url.searchParams.append('hourly', f));
  try {
    const data = await cachedFetchJson(url.toString());
    return json(200, { data });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};
