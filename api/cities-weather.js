const { cachedFetchJson, isBlockedCountry } = require('../lib/helpers');
const { CITIES_BY_COUNTRY } = require('../lib/cities-data');

const MOROCCO_CITY_COORDS = {
  "Zag": { "lat": 28.0221, "lon": -9.294 },
  "Beni-Mellal": { "lat": 32.3405, "lon": -6.361 },
  "Tata": { "lat": 29.7509, "lon": -7.9756 },
  "Elbrouj": { "lat": 32.5, "lon": -7.19 },
  "Smara": { "lat": 26.7384, "lon": -11.6719 },
  "Kasba-Tadla": { "lat": 32.5977, "lon": -6.2684 },
  "Oujda-Ville": { "lat": 34.6814, "lon": -1.9086 },
  "Taza Hammou Meftah": { "lat": 34.21, "lon": -4.01 },
  "Marrakech": { "lat": 31.6346, "lon": -8.0779 },
  "Taroudant": { "lat": 30.4703, "lon": -8.877 },
  "Errachidia": { "lat": 31.9329, "lon": -4.4246 },
  "Ouarzazate": { "lat": 30.9189, "lon": -6.9094 },
  "Bouarfa": { "lat": 32.5309, "lon": -1.965 },
  "Jerrada": { "lat": 34.3062, "lon": -2.1794 },
  "Chefchaouen": { "lat": 35.1688, "lon": -5.2636 },
  "Tetuan / Sania Ramel": { "lat": 35.5889, "lon": -5.3626 },
  "Benguerir": { "lat": 32.1245, "lon": -7.8781 },
  "Nador-Aroui": { "lat": 34.9281, "lon": -3.0426 },
  "Khouribga": { "lat": 32.8811, "lon": -6.9063 },
  "Guelmin": { "lat": 28.9884, "lon": -10.0527 },
  "Tiznit": { "lat": 29.6934, "lon": -9.7322 },
  "Fes-Sais": { "lat": 34.0331, "lon": -5.0003 },
  "Sidi Slimane": { "lat": 34.2617, "lon": -5.9198 },
  "Meknes": { "lat": 33.8935, "lon": -5.5547 },
  "Ifrane": { "lat": 33.5228, "lon": -5.111 },
  "Midelt": { "lat": 32.6855, "lon": -4.7502 },
  "Agadir Al Massira": { "lat": 30.325, "lon": -9.4131 },
  "Laayoune": { "lat": 27.1418, "lon": -13.188 },
  "Al Hoceima": { "lat": 35.2517, "lon": -3.9372 },
  "Safi": { "lat": 32.2994, "lon": -9.2372 },
  "Settat": { "lat": 33.004, "lon": -7.617 },
  "Nouasseur": { "lat": 33.367, "lon": -7.5733 },
  "Agadir": { "lat": 30.4278, "lon": -9.5981 },
  "Saidia": { "lat": 35.085, "lon": -2.2392 },
  "Kenitra": { "lat": 34.261, "lon": -6.5802 },
  "Tan-Tan": { "lat": 28.0833, "lon": -11.0833 },
  "Larache": { "lat": 35.1932, "lon": -6.1557 },
  "Tanger Aerodrome": { "lat": 35.7595, "lon": -5.834 },
  "El Jadida": { "lat": 33.2568, "lon": -8.5088 },
  "Rabat-Sale": { "lat": 34.0209, "lon": -6.8416 },
  "Dakhla": { "lat": 23.6848, "lon": -15.958 },
  "Mohammedia": { "lat": 33.6861, "lon": -7.383 },
  "Casablanca": { "lat": 33.5731, "lon": -7.5898 },
  "Sidi Ifni": { "lat": 29.377, "lon": -10.171 },
  "Essaouira": { "lat": 31.5125, "lon": -9.77 }
};

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

  const results = await mapWithConcurrency(cities, 6, async (city) => {
    try {
      let loc = null;
      if (country === 'Morocco' && MOROCCO_CITY_COORDS[city]) {
        loc = { ...MOROCCO_CITY_COORDS[city], country: 'Morocco' };
      } else {
        const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geoUrl.searchParams.set('count', '1');
        geoUrl.searchParams.set('language', 'en');
        geoUrl.searchParams.set('name', city);
        const geo = await cachedFetchJson(geoUrl.toString());
        loc = geo?.results?.[0];
        if (!loc || isBlockedCountry(loc.country)) {
          const geoWithCountry = new URL(geoUrl.toString());
          geoWithCountry.searchParams.set('country', country);
          const geo2 = await cachedFetchJson(geoWithCountry.toString());
          loc = geo2?.results?.[0];
        }
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
