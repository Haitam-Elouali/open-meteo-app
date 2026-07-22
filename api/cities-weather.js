const { cachedFetchJson, isBlockedCountry } = require('../lib/helpers');
const { CITIES_BY_COUNTRY } = require('../lib/cities-data');

module.exports = async (req, res) => {
  const country = String(req.query.country || '').trim();
  if (!country) {
    return res.status(400).json({ error: 'country is required' });
  }

  const cities = CITIES_BY_COUNTRY[country] || [];
  console.log('[cities-weather] country', country, 'cities count', cities.length);
  if (!cities.length) {
    return res.json({ country, cities: [] });
  }

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

  const results = await mapWithConcurrency(cities, 3, async (city) => {
    try {
      const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geoUrl.searchParams.set('count', '1');
      geoUrl.searchParams.set('language', 'en');
      geoUrl.searchParams.set('name', city);
      const geo = await cachedFetchJson(geoUrl.toString());
      let loc = geo?.results?.[0];
      if (!loc || isBlockedCountry(loc.country)) {
        const geoWithCountry = new URL(geoUrl.toString());
        geoWithCountry.searchParams.set('country', country);
        const geo2 = await cachedFetchJson(geoWithCountry.toString());
        loc = geo2?.results?.[0];
      }
      console.log('[cities-weather] geocode', city, '->', loc ? `${loc.latitude},${loc.longitude},${loc.country}` : 'NOT FOUND');
      if (!loc || isBlockedCountry(loc.country)) {
        return { name: city, maxTemp: null, error: 'not found', lat: null, lon: null };
      }

      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', String(loc.latitude));
      weatherUrl.searchParams.set('longitude', String(loc.longitude));
      weatherUrl.searchParams.set('timezone', 'auto');
      weatherUrl.searchParams.set('forecast_days', '2');
      weatherUrl.searchParams.append('daily', 'temperature_2m_max');

      console.log('[cities-weather] weather url', weatherUrl.toString());
      const weather = await cachedFetchJson(weatherUrl.toString());
      const maxTemp = weather?.daily?.temperature_2m_max?.[0];
      console.log('[cities-weather] weather', city, 'maxTemp', maxTemp);

      return {
        name: city,
        lat: loc.latitude,
        lon: loc.longitude,
        maxTemp: Number.isFinite(maxTemp) ? Math.round(maxTemp) : null,
      };
    } catch (e) {
      console.error('[cities-weather] error for', city, e);
      return { name: city, maxTemp: null, error: String(e?.message || e), lat: null, lon: null };
    }
  });

  console.log('[cities-weather] results count', results.length, 'errors', results.filter(r => r instanceof Error || r.error).length);
  const sorted = results
    .filter((r) => !(r instanceof Error))
    .sort((a, b) => (b.maxTemp ?? -Infinity) - (a.maxTemp ?? -Infinity));

  res.json({ country, cities: sorted });
};
