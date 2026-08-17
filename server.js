const express = require('express');
const path = require('path');
const fs = require('fs');

// Uses the built-in global fetch (Node 18+). No external HTTP dependency.

// Simple in-memory cache for proxied upstream responses. Weather, geocoding and
// air-quality data change slowly, so caching cuts latency and external load.
const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

// The weather-map grid is expensive against Open-Meteo's free tier (each
// refresh samples ~36-144 locations), so its responses are ALSO persisted to
// disk with a 1-hour TTL. Without this, every server restart forced a fresh
// upstream fetch for the same viewport — burning quota for zero benefit.
const GRID_DISK_CACHE = path.join(__dirname, '.grid-cache.json');
const GRID_DISK_TTL_MS = 60 * 60 * 1000;
let gridDiskCache = new Map();
try {
  const raw = JSON.parse(fs.readFileSync(GRID_DISK_CACHE, 'utf8'));
  const now = Date.now();
  for (const [k, v] of Object.entries(raw)) {
    if (v && v.expires > now) gridDiskCache.set(k, v);
  }
} catch (e) {
  // First boot or corrupt file: start empty.
}
function persistGridDiskCache() {
  try {
    fs.writeFileSync(GRID_DISK_CACHE, JSON.stringify(Object.fromEntries(gridDiskCache)));
  } catch (e) {
    // Best-effort: a failed write must never break the server.
  }
}

async function cachedFetchJson(urlString, options) {
  const now = Date.now();
  const cached = apiCache.get(urlString);
  if (cached && cached.expires > now) return cached.data;

  let r;
  try {
    r = await fetch(urlString, options);
  } catch (e) {
    return { error: `upstream request failed: ${e?.message || e}`, status: 0 };
  }
  let data;
  try {
    data = await r.json();
  } catch {
    return { error: `upstream returned non-JSON (status ${r.status})`, status: r.status };
  }
  if (r.ok) {
    apiCache.set(urlString, { expires: now + CACHE_TTL_MS, data });
  } else if (data && typeof data === 'object' && !data.status) {
    // Preserve the upstream HTTP status so callers can tell a rate limit (429)
    // from a hard failure instead of surfacing everything as a generic 502.
    data.status = r.status;
  }
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

// Frontend config (non-secret, client-visible settings). The OpenWeatherMap
// tile API key is read from the environment so it never gets committed.
app.get('/api/config', (req, res) => {
  res.json({ openWeatherKey: process.env.OPENWEATHER_API_KEY || '' });
});

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

app.get('/api/countries', (req, res) => {
  try {
    const citiesData = require('./lib/cities-data');
    const countries = Object.keys(citiesData.CITIES_BY_COUNTRY).sort();
    res.json({ countries });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
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

// --- Weather-grid request sizing -------------------------------------------
// Pure sizing helpers live in ./api/map-grid-helpers so they can be unit-tested
// without booting the server. They keep upstream URLs short (no 414->502) and
// the quantized bbox inside valid coordinate ranges (no 502 from out-of-range
// lat/lon).
const { fitGridRequest } = require('./api/map-grid-helpers');

// True when an upstream failure object is a rate limit (429 — minutely OR
// daily). Either way it is transient and worth a retry-after.
function isRateLimited(d) {
  if (!d || Array.isArray(d) || !d.error) return false;
  const msg = String(d.reason || d.error || '');
  return (
    d.status === 429 ||
    /rate\s*limit|too\s*many|minutely|request limit|try again|daily api/i.test(msg)
  );
}

// Weather-map grid: samples an Open-Meteo variable across a bounding box and
// returns a row-major 2D grid of values that the client renders as transparent
// overlay tiles. For a past `date` it uses the archive API; otherwise the
// forecast API (current conditions). Wind layers also return speed + direction.
app.get('/api/map-grid', async (req, res) => {
  try {
    const layer = String(req.query.layer || 'temperature');
    let north = parseFloat(req.query.north);
    let south = parseFloat(req.query.south);
    let west = parseFloat(req.query.west);
    let east = parseFloat(req.query.east);

    if ([north, south, west, east].some((v) => !Number.isFinite(v))) {
      return res.status(400).json({ error: 'north, south, west and east are required' });
    }

    // 12x12 = 144 points per refresh: fine for a bilinear-interpolated overlay
    // and keeps each refresh cheap against Open-Meteo's free-tier quota.
    let cols = Math.min(Math.max(parseInt(req.query.cols, 10) || 12, 4), 12);
    let rows = Math.min(Math.max(parseInt(req.query.rows, 10) || 12, 4), 12);

    // Clamp to valid geographic ranges. The client expands the viewport before
    // requesting, which can push coordinates past the poles / antimeridian;
    // Open-Meteo rejects those, so normalise here.
    north = Math.min(85, Math.max(-85, north));
    south = Math.min(85, Math.max(-85, south));
    if (north < south) {
      const t = north;
      north = south;
      south = t;
    }
    west = Math.max(-180, Math.min(180, west));
    east = Math.max(-180, Math.min(180, east));
    if (west > east) {
      west = -180;
      east = 180;
    }

    // One upstream call fetches EVERY layer's field at once (multi-location
    // requests count once per call, and Open-Meteo's free tier has an hourly
    // limit — fetching per-layer was the reason every layer switch after the
    // first 503'd). The client then switches layers purely from this cached
    // payload: zero extra upstream calls.
    const ALL_FIELDS = [
      'temperature_2m',
      'precipitation',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
    ];
    // The archive API has no pressure_msl for hourly data; surface_pressure is
    // the closest equivalent, otherwise the pressure layer would render empty
    // for past dates.
    const ALL_FIELDS_ARCHIVE = [
      'temperature_2m',
      'precipitation',
      'cloud_cover',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
    ];
    // Which response group each layer's `values` comes from. radar and
    // precipitation share the same precipitation field.
    const LAYER_GROUP = {
      temperature: 'temperature',
      precipitation: 'precipitation',
      radar: 'precipitation',
      clouds: 'clouds',
      pressure: 'pressure',
      wind: 'wind',
    };
    const group = LAYER_GROUP[layer] || 'temperature';

    const date = req.query.date ? parseInt(req.query.date, 10) : null;
    const nowSec = Math.floor(Date.now() / 1000);
    const useArchive = date !== null && date < nowSec - 60;

    const fields = useArchive ? ALL_FIELDS_ARCHIVE : ALL_FIELDS;

    // Size the request to the URL budget (fixes the 414 -> 502 on world / low
    // zoom views) while keeping point counts in check for the free-tier quota.
    const fitted = fitGridRequest(north, south, west, east, cols, rows, fields, useArchive, date);
    cols = fitted.cols;
    rows = fitted.rows;
    const latArr = fitted.latArr;
    const lonArr = fitted.lonArr;

    // Disk cache: same quantized upstream URL means the same data — check it
    // BEFORE the upstream so a server restart doesn't refetch the same viewport
    // (the biggest remaining quota sink during development/deploys).
    const upstreamUrl = fitted.url.toString();
    const diskHit = gridDiskCache.get(upstreamUrl);
    if (diskHit && diskHit.expires > Date.now()) {
      const list = Array.isArray(diskHit.data) ? diskHit.data : [diskHit.data];
      return res.json(buildMapGridResponse(list, fitted, layer, group, rows, cols, useArchive, date));
    }

    let data = await cachedFetchJson(upstreamUrl);
    // Open-Meteo's free tier rate-limits bursts; retry once after a short
    // backoff before surfacing an error to the client.
    if (data && !Array.isArray(data) && data.error) {
      await new Promise((r) => setTimeout(r, 600));
      data = await cachedFetchJson(upstreamUrl);
    }
    if (data && !Array.isArray(data) && data.error) {
      if (isRateLimited(data)) {
        // Tell the client how long the window actually is: the minutely window
        // is 60s, but the hourly/daily windows are much longer — a client that
        // retries every minute against an exhausted hourly quota just burns
        // more of the (still exhausted) budget.
        const msg = String(data.reason || data.error || '');
        const longWindow = /hourly|daily|next hour|tomorrow/i.test(msg);
        const retryAfter = longWindow ? 600 : 60;
        return res
          .status(503)
          .set('Retry-After', String(retryAfter))
          .json({
            error: longWindow
              ? 'Open-Meteo free-tier quota reached (hourly/daily limit). Retrying in ~10 minutes.'
              : 'Weather data temporarily unavailable (upstream rate limit). Retrying shortly.',
            retryAfter,
          });
      }
      return res.status(502).json({ error: String(data.reason || data.error) });
    }
    const list = Array.isArray(data) ? data : [data];

    const payload = buildMapGridResponse(list, fitted, layer, group, rows, cols, useArchive, date);
    // Persist for the next boot so restarts never refetch this viewport.
    gridDiskCache.set(upstreamUrl, { expires: Date.now() + GRID_DISK_TTL_MS, data: list });
    persistGridDiskCache();
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Pure builder for the multi-layer response payload (kept in ./api so it can
// be unit-tested without booting the server).
const { buildMapGridResponse } = require('./api/map-grid-response');

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
          return { name: city, maxTemp: null, error: 'not found', lat: null, lon: null };
        }

        const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
        forecastUrl.searchParams.set('latitude', String(loc.latitude));
        forecastUrl.searchParams.set('longitude', String(loc.longitude));
        forecastUrl.searchParams.set('timezone', 'auto');
        forecastUrl.searchParams.set('forecast_days', '2');
        forecastUrl.searchParams.append('daily', 'temperature_2m_max');
        forecastUrl.searchParams.append('daily', 'temperature_2m_min');
        forecastUrl.searchParams.append('hourly', 'temperature_2m');

        let maxTemp = null;
        let minTemp = null;
        try {
          const forecast = await cachedFetchJson(forecastUrl.toString());
          const daily = forecast?.daily || {};

          maxTemp = daily?.temperature_2m_max?.[0] ?? null;
          minTemp = daily?.temperature_2m_min?.[0] ?? null;

          const times = forecast?.hourly?.time || [];
          const temps = forecast?.hourly?.temperature_2m || [];

          if (maxTemp === null || minTemp === null) {
            const now = new Date();
            const n = Math.min(times.length, temps.length, 48);

            let latestHour = -1;
            for (let i = 0; i < n; i++) {
              const raw = String(times[i] || '');
              const timePart = raw.split('T')[1] || '';
              const hhmm = timePart.split('+')[0].split('Z')[0];
              const parts = hhmm.split(':');
              const hour = Number(parts[0]);
              if (Number.isFinite(hour)) {
                const t = new Date(raw);
                if (!isNaN(t) && t <= now) {
                  if (hour > latestHour) latestHour = hour;
                }
              }
            }

            if (latestHour >= 18) {
              let max = null;
              let min = null;
              for (let i = 0; i < n; i++) {
                const v = temps[i];
                if (Number.isFinite(v)) {
                  const t = new Date(times[i]);
                  if (!isNaN(t) && t <= now) {
                    if (max === null || v > max) max = v;
                    if (min === null || v < min) min = v;
                  }
                }
              }
              if (max !== null) maxTemp = Math.round(max);
              if (min !== null) minTemp = Math.round(min);
            }
          }
        } catch (e) {
          console.error('[cities-weather] forecast fetch failed for', city, e);
        }

        if (maxTemp === null || minTemp === null) {
          const yesterday = new Date(Date.now() - 86400000);
          const yyyy = String(yesterday.getFullYear());
          const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
          const dd = String(yesterday.getDate()).padStart(2, '0');
          const archiveUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
          archiveUrl.searchParams.set('latitude', String(loc.latitude));
          archiveUrl.searchParams.set('longitude', String(loc.longitude));
          archiveUrl.searchParams.set('timezone', 'auto');
          archiveUrl.searchParams.set('start_date', `${yyyy}-${mm}-${dd}`);
          archiveUrl.searchParams.set('end_date', `${yyyy}-${mm}-${dd}`);
          archiveUrl.searchParams.append('daily', 'temperature_2m_max');
          archiveUrl.searchParams.append('daily', 'temperature_2m_min');

          try {
            const archive = await cachedFetchJson(archiveUrl.toString());
            const daily = archive?.daily || {};
            if (maxTemp === null && daily?.temperature_2m_max?.[0] !== undefined) {
              maxTemp = Number.isFinite(daily.temperature_2m_max[0]) ? Math.round(daily.temperature_2m_max[0]) : null;
            }
            if (minTemp === null && daily?.temperature_2m_min?.[0] !== undefined) {
              minTemp = Number.isFinite(daily.temperature_2m_min[0]) ? Math.round(daily.temperature_2m_min[0]) : null;
            }
          } catch (e) {
            console.error('[cities-weather] archive fetch failed for', city, e);
          }
        }

        const result = {
          name: city,
          country: loc.country || country,
          lat: loc.latitude,
          lon: loc.longitude,
          maxTemp: Number.isFinite(maxTemp) ? Math.round(maxTemp) : null,
          minTemp: Number.isFinite(minTemp) ? Math.round(minTemp) : null,
          daily: {
            temperature_2m_max: maxTemp !== null ? [maxTemp] : [],
            temperature_2m_min: minTemp !== null ? [minTemp] : []
          }
        };
        return result;
      } catch (e) {
        console.error('[cities-weather] error for', city, e);
        return { name: city, maxTemp: null, error: String(e?.message || e), lat: null, lon: null };
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
// Capitals weather rebuilds ~190 upstream calls, so cache it for an hour —
// refreshing every 10 minutes would burn up to ~27k calls/day on its own and
// blow through Open-Meteo's 10k/day free tier. Hourly temperature data is
// plenty fresh for a ticker.
const CAPITALS_TTL_MS = 60 * 60 * 1000;
let capitalsWeatherCache = { expires: 0, data: null };
// In-flight promise so the boot pre-warm and the first real request share ONE
// build instead of firing ~190 upstream calls twice (which exhausted the
// minute quota and caused the map's 503s right after a restart).
let capitalsWeatherPromise = null;

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

// Cached, deduped capitals weather. Concurrent callers (boot pre-warm + the
// first ticker request) share a single build; the result is cached for
// CAPITALS_TTL_MS so steady-state traffic never touches the upstream.
function getCapitalsWeather() {
  if (capitalsWeatherCache.data && capitalsWeatherCache.expires > Date.now()) {
    return Promise.resolve(capitalsWeatherCache.data);
  }
  if (!capitalsWeatherPromise) {
    capitalsWeatherPromise = buildCapitalsWeather()
      .then((data) => {
        capitalsWeatherCache = { expires: Date.now() + CAPITALS_TTL_MS, data };
        return data;
      })
      .finally(() => {
        capitalsWeatherPromise = null;
      });
  }
  return capitalsWeatherPromise;
}

app.get('/api/capitals-weather', async (req, res) => {
  try {
    const data = await getCapitalsWeather();
    res.json(data);
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

app.listen(PORT, '0.0.0.0', () => {
  const ip = process.env.OPEN_METEO_LAN_IP || '192.168.11.100';
  const domain = process.env.OPEN_METEO_LOCAL_DOMAIN || 'open-meteo.local';
  console.log(`Open-Arsad server listening on http://localhost:${PORT}`);
  console.log(`LAN URL        : http://${ip}:${PORT}`);
  console.log(`Local domain   : http://${domain}:${PORT}`);
});

module.exports = app;
