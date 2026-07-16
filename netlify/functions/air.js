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
  const dom = String(q.domains || 'auto').trim() || 'auto';
  const isEurope = dom === 'cams_europe' || dom === 'europe';
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('domains', dom);
  [isEurope ? 'european_aqi' : 'us_aqi', 'pm2_5', 'pm10', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'dust'].forEach((f) => url.searchParams.append('current', f));
  try {
    const data = await cachedFetchJson(url.toString());
    return json(200, { data, domains: dom });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};
