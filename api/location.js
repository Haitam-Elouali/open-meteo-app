const { cachedFetchJson, isBlockedCountry } = require('./helpers');

module.exports = async (req, res) => {
  const country = String(req.query.country || '').trim();
  const city = String(req.query.city || '').trim();
  const count = Math.min(Number(req.query.count || 10), 50);

  if (!city && !country) {
    return res.status(400).json({ error: 'city or country is required' });
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
    res.json({ results: normalized });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
