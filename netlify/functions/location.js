const { cachedFetchJson, isBlockedCountry } = require('../../api/_lib');

function qs(event) {
  return event.queryStringParameters || {};
}
function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  const q = qs(event);
  const country = String(q.country || '').trim();
  const city = String(q.city || '').trim();
  const count = Math.min(Number(q.count || 10), 50);
  if (!city && !country) {
    return json(400, { error: 'city or country is required' });
  }
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  if (city) url.searchParams.set('name', city);
  if (country) {
    url.searchParams.set('name', city || country);
    url.searchParams.set('country', country);
  }
  try {
    const data = await cachedFetchJson(url.toString());
    const results = data?.results || [];
    const filtered = results.filter((r) => !isBlockedCountry(r.country));
    const normalized = filtered.map((r) => ({
      name: r.name || city,
      country: r.country || '',
      admin1: r.admin1 || '',
      lat: r.latitude,
      lon: r.longitude
    }));
    return json(200, { results: normalized });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};
