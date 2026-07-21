const { cachedFetchJson, isBlockedCountry } = require('../lib/helpers');
const { CITIES_BY_COUNTRY } = require('../lib/cities-data');

module.exports = async (req, res) => {
  const country = String(req.query.country || '').trim();
  if (!country) {
    return res.status(400).json({ error: 'country is required' });
  }

  const cities = CITIES_BY_COUNTRY[country] || [];
  if (!cities.length) {
    return res.json({ country, cities: [] });
  }

  // Geocode each city to lat/lon, then fetch daily max temperature.
  // Run with bounded concurrency so we don't hammer upstream APIs.
  async function mapWithConcurrency(items, size, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function run() {
      while (cursor < items.length) {
        const i = cursor++;
        try {
          results[i] = await worker(items[i], i);
        } catch (e) {
          results[i] = e;
        }
      }
    }
    const pool = Array.from({ length: Math.min(size, items.length) }, run);
    await Promise.all(pool);
    return results;
  }

  const results = await mapWithConcurrency(cities, 6, async (city) => {
    try {
      // Geocode city -> lat/lon
      const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geoUrl.searchParams.set('count', '1');
      geoUrl.searchParams.set('language', 'en');
      geoUrl.searchParams.set('name', city);
      if (country) geoUrl.searchParams.set('country', country);

      const geo = await cachedFetchJson(geoUrl.toString());
      const loc = geo?.results?.[0];
      if (!loc || isBlockedCountry(loc.country)) {
        return { name: city, maxTemp: null, error: 'not found' };
      }

      // Fetch daily max temperature for this city
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', String(loc.latitude));
      weatherUrl.searchParams.set('longitude', String(loc.longitude));
      weatherUrl.searchParams.set('timezone', 'auto');
      weatherUrl.searchParams.set('forecast_days', '1');
      weatherUrl.searchParams.append('daily', 'temperature_2m_max');

      const weather = await cachedFetchJson(weatherUrl.toString());
      const maxTemp = weather?.daily?.temperature_2m_max?.[0];

      return {
        name: city,
        lat: loc.latitude,
        lon: loc.longitude,
        maxTemp: Number.isFinite(maxTemp) ? Math.round(maxTemp) : null,
      };
    } catch (e) {
      return { name: city, maxTemp: null, error: String(e?.message || e) };
    }
  });

  // Sort descending by maxTemp (highest first), push nulls to the end.
  const sorted = results
    .filter((r) => !(r instanceof Error))
    .sort((a, b) => (b.maxTemp ?? -Infinity) - (a.maxTemp ?? -Infinity));

  res.json({ country, cities: sorted });
};
