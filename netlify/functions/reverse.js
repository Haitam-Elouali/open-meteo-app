const { cachedFetchJson, isBlockedCountry } = require('../../api/_lib');

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
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('accept-language', 'en');
  try {
    const data = await cachedFetchJson(url.toString(), {
      headers: { 'User-Agent': 'Open-Meteo-Client/1.0' }
    });
    const address = data?.address || {};
    const city = address.city || address.town || address.village || address.county || '';
    const country = address.country || '';
    if (isBlockedCountry(country)) {
      return json(404, { error: 'Location not available' });
    }
    return json(200, { city, country });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};
