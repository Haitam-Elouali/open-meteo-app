const express = require('express');
const path = require('path');

// Uses the built-in global fetch (Node 18+). No external HTTP dependency.

// Simple in-memory cache for proxied upstream responses. Weather, geocoding and
// air-quality data change slowly, so caching cuts latency and external load.
const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function cachedFetchJson(urlString, options) {
  const now = Date.now();
  const cached = apiCache.get(urlString);
  if (cached && cached.expires > now) return cached.data;

  const r = await fetch(urlString, options);
  const data = await r.json();
  if (r.ok) apiCache.set(urlString, { expires: now + CACHE_TTL_MS, data });
  return data;
}

// Countries excluded from any geocoding result.
const BLOCKED_COUNTRIES = new Set(['Israel']);
function isBlockedCountry(country) {
  return BLOCKED_COUNTRIES.has((country || '').trim());
}

function normalizeCountry(country) {
  const c = (country || '').trim();
  if (c.toLowerCase() === 'western sahara') {
    console.warn('[normalizeCountry] Converting Western Sahara to Morocco for input:', country);
    return 'Morocco';
  }
  return c;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend (repo is plain files under /src).
// Caching is disabled (maxAge 0 + no-cache) so edits to HTML/JS take effect
// immediately without the browser serving a stale, broken previous version.
const publicDir = path.join(__dirname, 'src');
app.use(express.static(publicDir, {
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Root page: serve home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'home', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'dashboard', 'index.html'));
});

app.get('/hourly', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'hourly', 'index.html'));
});

app.get('/details', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'details', 'index.html'));
});

app.get('/climatology', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'climatology', 'index.html'));
});

app.get('/settings', (req, res) => {
  res.redirect('/');
});

app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'map', 'index.html'));
});

// Proxy open-meteo
app.get('/api/weather', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');

    // IMPORTANT:
    // Open-Meteo "current" requests fail unless at least some "daily" is also requested.
    // So we always include daily temperature_2m_min/max.
    [
      'temperature_2m_min',
      'temperature_2m_max'
    ].forEach((f) => url.searchParams.append('daily', f));

    // Keep the UI expectations for forecast strip + icons.
    [
      'sunrise',
      'sunset',
      'precipitation_probability_max',
      'weather_code'
    ].forEach((f) => url.searchParams.append('daily', f));

    // Current fields required by the UI
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'is_day',
      'precipitation',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'cloud_cover',
      'weather_code'
    ].forEach((f) => url.searchParams.append('current', f));

    const data = await cachedFetchJson(url.toString());

    // Always return the full Open-Meteo payload under `data`
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Proxy open-meteo hourly
app.get('/api/hourly', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('past_days', '1');

    [
      'temperature_2m',
      'relative_humidity_2m',
      'weather_code',
      'precipitation',
      'precipitation_probability',
      'wind_speed_10m'
    ].forEach((f) => url.searchParams.append('hourly', f));

    const data = await cachedFetchJson(url.toString());

    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Proxy open-meteo archive for climatology
app.get('/api/archive', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const date = String(req.query.date || '').trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !date) {
      return res.status(400).json({ error: 'lat, lon and date are required' });
    }

    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    url.searchParams.append('hourly', 'temperature_2m');
    url.searchParams.append('hourly', 'relative_humidity_2m');
    url.searchParams.append('hourly', 'weather_code');
    url.searchParams.append('hourly', 'precipitation');
    url.searchParams.append('hourly', 'wind_speed_10m');
    url.searchParams.append('hourly', 'apparent_temperature');
    url.searchParams.append('hourly', 'surface_pressure');
    url.searchParams.append('hourly', 'cloud_cover');
    url.searchParams.append('hourly', 'uv_index');
    url.searchParams.append('hourly', 'shortwave_radiation');

    const data = await cachedFetchJson(url.toString());
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Proxy open-meteo details (current conditions + rich daily)
app.get('/api/details', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');

    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'is_day',
      'precipitation',
      'rain',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'surface_pressure',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'uv_index',
      'visibility'
    ].forEach((f) => url.searchParams.append('current', f));

    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'rain_sum',
      'sunrise',
      'sunset',
      'daylight_duration',
      'sunshine_duration',
      'uv_index_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max'
    ].forEach((f) => url.searchParams.append('daily', f));

    const data = await cachedFetchJson(url.toString());

    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Multi-day forecast with configurable horizon (7 / 14 / 31 days).
// The window always STARTS AT TODAY and goes forward. Open-Meteo caps
// `forecast_days` at 16, so any horizon above 16 is clamped to 16 future
// days (i.e. today + the next 15 days).
app.get('/api/forecast', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const requested = Math.min(Math.max(Number(req.query.days) || 7, 1), 31);
    const forecastDays = Math.min(requested, 16); // API caps future at 16
    const pastDays = 0; // window starts at today

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');
    if (pastDays > 0) url.searchParams.set('past_days', String(pastDays));
    url.searchParams.set('forecast_days', String(forecastDays));

    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'is_day',
      'precipitation',
      'rain',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'surface_pressure',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'uv_index'
    ].forEach((f) => url.searchParams.append('current', f));

    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'rain_sum',
      'sunrise',
      'sunset',
      'daylight_duration',
      'sunshine_duration',
      'uv_index_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max'
    ].forEach((f) => url.searchParams.append('daily', f));

    const data = await cachedFetchJson(url.toString());

    res.json({ data, horizon: requested, pastDays, forecastDays });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Generic, cached proxy used by the Weather Map overlays. Forwards the supplied
// query parameters to Open-Meteo (forecast or archive) and returns the JSON.
// Going through the server keeps requests same-origin (no browser CORS issues),
// reuses the in-memory cache (so identical grid requests are not re-fetched),
// and lets the client stay generic about which variables/models it asks for.
app.get('/api/grid', async (req, res) => {
  try {
    const source = String(req.query.source || 'forecast').toLowerCase();
    const base = source === 'archive'
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';
    const url = new URL(base);
    Object.entries(req.query).forEach(([k, v]) => {
      if (k === 'source') return;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.append(k, v);
    });
    if (!url.searchParams.get('timezone')) url.searchParams.set('timezone', 'auto');

    const data = await cachedFetchJson(url.toString());
    // Open-Meteo returns an array when multiple coordinates are requested.
    // It can also return an error object (e.g. rate limited) as the first/only
    // element — surface that as a 502 so the client can react.
    const list = Array.isArray(data) ? data : [data];
    const first = list[0] || {};
    if (!list.length || first.error || !first.hourly) {
      res.set('Access-Control-Allow-Origin', '*');
      return res.status(502).json({ error: first.reason || first.error || 'No data from upstream' });
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ source, data: list });
  } catch (e) {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Daily temperature summary for the current date only.
// Returns max/min temperature for the requested location, cached per day.
app.get('/api/daily-temp', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '1');

    url.searchParams.append('daily', 'temperature_2m_max');
    url.searchParams.append('daily', 'temperature_2m_min');
    url.searchParams.append('daily', 'weather_code');
    url.searchParams.append('daily', 'precipitation_sum');

    const data = await cachedFetchJson(url.toString());
    const daily = data?.daily || {};
    const todayIndex = 0;
    const tempMax = daily.temperature_2m_max?.[todayIndex];
    const tempMin = daily.temperature_2m_min?.[todayIndex];
    const weatherCode = daily.weather_code?.[todayIndex];
    const precipSum = daily.precipitation_sum?.[todayIndex];

    if (tempMax == null && tempMin == null) {
      return res.status(502).json({ error: 'No daily temperature data from upstream' });
    }

    res.json({
      date: daily.time?.[todayIndex],
      tempMax: tempMax ?? null,
      tempMin: tempMin ?? null,
      weatherCode: weatherCode ?? null,
      precipSum: precipSum ?? null
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Additional endpoint: Open-Meteo Air Quality API (AQI, pollutants, pollen).
// Demonstrates optional params: `domains` (auto / cams_europe / cams_global)
// and `pollen` for daily pollen forecasts.
app.get('/api/air', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    // `domains` is the optional Open-Meteo Air Quality param:
    //   - 'auto'      -> picks the best available domain (global CAMS)
    //   - 'cams_europe' -> European CAMS (enables european_aqi)
    //   - 'cams_global' -> global CAMS
    // The current Air Quality API only supports `current` variables
    // (no daily), so we request the AQI + key pollutants here.
    const domains = String(req.query.domains || 'auto').trim() || 'auto';
    const isEurope = domains === 'cams_europe' || domains === 'europe';

    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('domains', domains);

    [
      isEurope ? 'european_aqi' : 'us_aqi',
      'pm2_5',
      'pm10',
      'carbon_monoxide',
      'nitrogen_dioxide',
      'sulphur_dioxide',
      'ozone',
      'dust'
    ].forEach((f) => url.searchParams.append('current', f));

    const data = await cachedFetchJson(url.toString());

    res.json({ data, domains });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Proxy reverse geocode (free, no key required)
app.get('/api/reverse', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('zoom', '10');
    url.searchParams.set('accept-language', 'en');

    const data = await cachedFetchJson(url.toString(), {
      headers: { 'User-Agent': 'Open-Arsad-Client/1.0' }
    });
    const address = data?.address || {};

    const city = address.city || address.town || address.village || address.county || '';
    const rawCountry = address.country || '';
    const country = normalizeCountry(rawCountry);

    if (rawCountry && rawCountry.toLowerCase().includes('western sahara')) {
      console.warn('[api/reverse] Western Sahara detected', { rawCountry, city, lat: req.query.lat, lon: req.query.lon });
    }

    if (isBlockedCountry(country)) {
      return res.status(404).json({ error: 'Location not available' });
    }

    res.json({ city, country });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forward search to Open-Meteo geocoding
app.get('/api/location', async (req, res) => {
  try {
    const country = String(req.query.country || '').trim();
    const city = String(req.query.city || '').trim();
    const count = Math.min(Number(req.query.count || 10), 50);

    if (!city && !country) {
      return res.status(400).json({ error: 'city or country is required' });
    }

    if (country === 'Morocco' && city && MOROCCO_CITY_COORDS[city]) {
      const coord = MOROCCO_CITY_COORDS[city];
      return res.json({
        results: [
          {
            name: city,
            country: 'Morocco',
            admin1: '',
            lat: coord.latitude,
            lon: coord.longitude
          }
        ]
      });
    }

    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('count', String(count));
    url.searchParams.set('language', 'en');

    if (city) {
      url.searchParams.set('name', city);
    }
    if (country) {
      url.searchParams.set('name', city || country);
      url.searchParams.set('country', country);
    }

    const data = await cachedFetchJson(url.toString());
    const results = data?.results || [];

    const filtered = results.filter(r => {
      const c = (r.country || '').trim();
      if (isBlockedCountry(c)) return false;
      if (!c) {
        const lat = Number(r.latitude);
        const lon = Number(r.longitude);
        if (lat >= 20 && lat <= 28 && lon >= -17 && lon <= -10) {
          console.warn('[api/location] Filtering out empty-country result in Western Sahara region', { name: r.name, lat, lon, query: req.query });
          return false;
        }
      }
      return true;
    });

    const normalized = filtered.map(r => {
      const raw = r.country || '';
      const norm = normalizeCountry(raw);
      if (raw.toLowerCase().includes('western sahara')) {
        console.warn('[api/location] Western Sahara detected', { raw, city: r.name, query: req.query });
      }
      return {
        name: r.name || city,
        country: norm,
        admin1: r.admin1 || '',
        lat: r.latitude,
        lon: r.longitude
      };
    });

    res.json({ results: normalized });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Cities per country. Serves the curated, comprehensive city lists so the
// location picker can show every major city for a country (e.g. Morocco).
const { CITIES_BY_COUNTRY } = require('./lib/cities-data');

app.get('/api/cities', (req, res) => {
  try {
    const country = String(req.query.country || '').trim();
    if (!country) {
      return res.status(400).json({ error: 'country is required' });
    }
    const cities = CITIES_BY_COUNTRY[country] || [];
    res.json({ country, cities });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const MOROCCO_CITY_COORDS = {
  "Zag": { "latitude": 28.0221, "longitude": -9.294 },
  "Beni-Mellal": { "latitude": 32.3405, "longitude": -6.361 },
  "Tata": { "latitude": 29.7509, "longitude": -7.9756 },
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

app.get('/api/cities-weather', async (req, res) => {
  try {
    const country = String(req.query.country || '').trim();
    if (!country) {
      return res.status(400).json({ error: 'country is required' });
    }

    const cities = CITIES_BY_COUNTRY[country] || [];
    if (!cities.length) {
      return res.json({ country, cities: [] });
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
          if (loc && loc.country && String(loc.country).toLowerCase().includes('western sahara')) {
            console.warn('[api/cities-weather] Western Sahara from geocoding', { city, rawCountry: loc.country });
            loc.country = 'Morocco';
          }
          if (!loc || isBlockedCountry(loc.country)) {
            const geoWithCountry = new URL(geoUrl.toString());
            geoWithCountry.searchParams.set('country', country);
            const geo2 = await cachedFetchJson(geoWithCountry.toString());
            loc = geo2?.results?.[0];
            if (loc && loc.country && String(loc.country).toLowerCase().includes('western sahara')) {
              console.warn('[api/cities-weather] Western Sahara from geocoding (retry)', { city, rawCountry: loc.country });
              loc.country = 'Morocco';
            }
          }
        }
        if (!loc || isBlockedCountry(loc.country)) {
          return { name: city, maxTemp: null, minTemp: null, error: 'not found', lat: null, lon: null };
        }

        const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
        forecastUrl.searchParams.set('latitude', String(loc.latitude));
        forecastUrl.searchParams.set('longitude', String(loc.longitude));
        forecastUrl.searchParams.set('timezone', 'auto');
        forecastUrl.searchParams.set('forecast_days', '1');
        forecastUrl.searchParams.append('daily', 'temperature_2m_min');
        forecastUrl.searchParams.append('daily', 'temperature_2m_max');

        let maxTemp = null;
        let minTemp = null;
        try {
          const forecast = await cachedFetchJson(forecastUrl.toString());
          const daily = forecast?.daily || {};
          const minVals = daily.temperature_2m_min || [];
          const maxVals = daily.temperature_2m_max || [];
          if (minVals.length > 0) {
            minTemp = Number.isFinite(minVals[0]) ? Math.round(minVals[0]) : null;
          }
          if (maxVals.length > 0) {
            maxTemp = Number.isFinite(maxVals[0]) ? Math.round(maxVals[0]) : null;
          }
        } catch (e) {
          console.error('[cities-weather] forecast fetch failed for', city, e);
        }

        return {
          name: city,
          lat: loc.latitude,
          lon: loc.longitude,
          maxTemp: Number.isFinite(maxTemp) ? maxTemp : null,
          minTemp: Number.isFinite(minTemp) ? minTemp : null,
        };
      } catch (e) {
        console.error('[cities-weather] error for', city, e);
        return { name: city, maxTemp: null, minTemp: null, error: String(e?.message || e), lat: null, lon: null };
      }
    });

    const sorted = results
      .filter((r) => !(r instanceof Error))
      .sort((a, b) => (b.maxTemp ?? -Infinity) - (a.maxTemp ?? -Infinity));

    res.json({ country, cities: sorted });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Capital cities (country -> [capital, lat, lon]). Powers the scrolling
// capitals ticker under the dashboard header.
const { CAPITALS } = require('./lib/capitals-data');

app.get('/api/capitals', (req, res) => {
  try {
    const list = Object.entries(CAPITALS).map(([country, [capital, lat, lon]]) => ({
      country, capital, lat, lon
    }));
    res.json({ capitals: list });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Current weather for every capital, fetched server-side in parallel so the
// ticker only makes ONE request instead of ~195. Blocked countries are skipped.
// The aggregated result is cached in-memory (CAPITALS_TTL) so we don't fire
// ~188 outbound requests on every page load.
const CAPITALS_TTL_MS = 10 * 60 * 1000;
let capitalsWeatherCache = { expires: 0, data: null };

// Resolve promises with a bounded concurrency so we never fire ~190 outbound
// requests at once (which saturates the event loop / network and makes the
// ticker feel slow). Items run in pools of `size`.
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

async function buildCapitalsWeather() {
  const entries = Object.entries(CAPITALS).filter(([country]) => !isBlockedCountry(country));
  // ~190 parallel requests hammer the upstream + the client's first paint.
  // Limit to 8 in-flight at a time; this keeps latency low without overload.
  const results = await mapWithConcurrency(entries, 8, async ([country, [capital, lat, lon]]) => {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set('timezone', 'auto');
      ['temperature_2m', 'is_day', 'weather_code'].forEach((f) => url.searchParams.append('current', f));
      const data = await cachedFetchJson(url.toString());
      const cur = data?.current || {};
      return {
        country, capital, lat, lon,
        temperature: cur.temperature_2m,
        is_day: cur.is_day,
        weatherCode: cur.weather_code
      };
    } catch (e) {
      return { country, capital, lat, lon, error: String(e?.message || e) };
    }
  });
  return { capitals: results };
}

app.get('/api/capitals-weather', async (req, res) => {
  try {
    const now = Date.now();
    if (capitalsWeatherCache.data && capitalsWeatherCache.expires > now) {
      return res.json(capitalsWeatherCache.data);
    }
    const data = await buildCapitalsWeather();
    capitalsWeatherCache = { expires: now + CAPITALS_TTL_MS, data };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Pre-warm the capitals-weather cache on boot (fire and forget) so the first
// visitor doesn't pay the cost of ~188 outbound requests.
buildCapitalsWeather()
  .then((data) => { capitalsWeatherCache = { expires: Date.now() + CAPITALS_TTL_MS, data }; })
  .catch(() => {});

// Favorites API
const FAVORITES_KEY = 'open-meteo-favorites';
let favorites = [];

app.get('/api/favorites', (req, res) => {
  res.json({ favorites });
});

app.post('/api/favorites', express.json(), (req, res) => {
  try {
    favorites = Array.isArray(req.body?.favorites) ? req.body.favorites : [];
    res.json({ ok: true, favorites });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const ip = process.env.OPEN_METEO_LAN_IP || '192.168.11.100';
  const domain = process.env.OPEN_METEO_LOCAL_DOMAIN || 'open-meteo.local';
  console.log(`Open-Arsad server listening on http://localhost:${PORT}`);
  console.log(`LAN URL        : http://${ip}:${PORT}`);
  console.log(`Local domain   : http://${domain}:${PORT}`);
});

module.exports = app;
