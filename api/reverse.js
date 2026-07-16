const { cachedFetchJson, isBlockedCountry } = require('../_lib');

module.exports = async (req, res) => {
  const { lat, lon } = req.query;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(la));
  url.searchParams.set('lon', String(lo));
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
      return res.status(404).json({ error: 'Location not available' });
    }
    res.json({ city, country });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
