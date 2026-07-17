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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend (repo is plain files under /src)
const publicDir = path.join(__dirname, 'src');
app.use(express.static(publicDir, { maxAge: 3600000 }));

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
  res.sendFile(path.join(__dirname, 'src', 'pages', 'dashboard', 'index.html'));
});

app.get('/details', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'details', 'index.html'));
});

app.get('/settings', (req, res) => {
  res.redirect('/');
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

    const filtered = results.filter(r => !isBlockedCountry(r.country));

    const normalized = filtered.map(r => ({
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
});

// Cities per country. Serves the curated, comprehensive city lists so the
// location picker can show every major city for a country (e.g. Morocco).
const { CITIES_BY_COUNTRY } = require('./api/cities-data');

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

app.listen(PORT, () => {
  console.log(`Open-Meteo server listening on http://localhost:${PORT}`);
});
