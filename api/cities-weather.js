const { cachedFetchJson, isBlockedCountry } = require('../lib/helpers');
const { CITIES_BY_COUNTRY } = require('../lib/cities-data');

const MOROCCO_CITY_COORDS = {
  "Zag": { "latitude": 28.0221, "longitude": -9.294 },
  "Beni-Mellal": { "latitude": 32.3405, "longitude": -6.361 },
  "Tata": { "latitude": 29.7509, "longitude": -7.9756 },
  "Elbrouj": { "latitude": 32.5, "longitude": -7.19 },
  "Smara": { "latitude": 26.7384, "longitude": -11.6719 },
  "Kasba-Tadla": { "latitude": 32.5977, "longitude": -6.2684 },
  "Oujda-Ville": { "latitude": 34.6814, "longitude": -1.9086 },
  "Taza Hammou Meftah": { "latitude": 34.21, "longitude": -4.01 },
  "Marrakech": { "latitude": 31.6346, "longitude": -8.0779 },
  "Taroudant": { "latitude": 30.4703, "longitude": -8.877 },
  "Errachidia": { "latitude": 31.9329, "longitude": -4.4246 },
  "Ouarzazate": { "latitude": 30.9189, "longitude": -6.9094 },
  "Bouarfa": { "latitude": 32.5309, "longitude": -1.965 },
  "Jerrada": { "latitude": 34.3062, "longitude": -2.1794 },
  "Chefchaouen": { "latitude": 35.1688, "longitude": -5.2636 },
  "Tetuan / Sania Ramel": { "latitude": 35.5889, "longitude": -5.3626 },
  "Benguerir": { "latitude": 32.1245, "longitude": -7.8781 },
  "Nador-Aroui": { "latitude": 34.9281, "longitude": -3.0426 },
  "Khouribga": { "latitude": 32.8811, "longitude": -6.9063 },
  "Guelmin": { "latitude": 28.9884, "longitude": -10.0527 },
  "Tiznit": { "latitude": 29.6934, "longitude": -9.7322 },
  "Fes-Sais": { "latitude": 34.0331, "longitude": -5.0003 },
  "Sidi Slimane": { "latitude": 34.2617, "longitude": -5.9198 },
  "Meknes": { "latitude": 33.8935, "longitude": -5.5547 },
  "Ifrane": { "latitude": 33.5228, "longitude": -5.111 },
  "Midelt": { "latitude": 32.6855, "longitude": -4.7502 },
  "Agadir Al Massira": { "latitude": 30.325, "longitude": -9.4131 },
  "Laayoune": { "latitude": 27.1418, "longitude": -13.188 },
  "Al Hoceima": { "latitude": 35.2517, "longitude": -3.9372 },
  "Safi": { "latitude": 32.2994, "longitude": -9.2372 },
  "Settat": { "latitude": 33.004, "longitude": -7.617 },
  "Nouasseur": { "latitude": 33.367, "longitude": -7.5733 },
  "Agadir": { "latitude": 30.4278, "longitude": -9.5981 },
  "Saidia": { "latitude": 35.085, "longitude": -2.2392 },
  "Kenitra": { "latitude": 34.261, "longitude": -6.5802 },
  "Tan-Tan": { "latitude": 28.0833, "longitude": -11.0833 },
  "Larache": { "latitude": 35.1932, "longitude": -6.1557 },
  "Tanger Aerodrome": { "latitude": 35.7595, "longitude": -5.834 },
  "El Jadida": { "latitude": 33.2568, "longitude": -8.5088 },
  "Rabat-Sale": { "latitude": 34.0209, "longitude": -6.8416 },
  "Dakhla": { "latitude": 23.6848, "longitude": -15.958 },
  "Mohammedia": { "latitude": 33.6861, "longitude": -7.383 },
  "Casablanca": { "latitude": 33.5731, "longitude": -7.5898 },
  "Sidi Ifni": { "latitude": 29.377, "longitude": -10.171 },
  "Essaouira": { "latitude": 31.5125, "longitude": -9.77 }
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
