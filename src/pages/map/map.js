// Weather map controller. A permanent geographic base map (OpenStreetMap or
// satellite) with exactly one weather overlay above it.
//
// Weather source: OpenWeatherMap tile layers are used when an API key is
// configured (crisp, pre-rendered tiles — never blurry). If no key is set, the
// app falls back to Open-Meteo's grid endpoint so the map still works. Either
// way, changing the layer only swaps the overlay; the base map stays put.
import { LAYER_ORDER, getLayer } from './layers.js';
import { legendStops, buildLUT, layerRange } from './palette.js';
import { reshape, minZoomForHeight } from './grid.js';
import { createWeatherLayer, weatherPerf } from './weather-layer.js';

const L = window.L;
const OWM_BASE = 'https://tile.openweathermap.org/map';

// Translate a key through the shared i18n dictionary, falling back to English
// then to the key itself so dynamic UI (layer buttons, legend) stays correct
// in every language the page is loaded in.
function t(key) {
  try {
    const lang = (window.I18n && window.I18n.getLang && window.I18n.getLang()) || 'en';
    const dict = (window.I18n && window.I18n.DICT) || {};
    if (dict[lang] && dict[lang][key] != null) return dict[lang][key];
    if (dict.en && dict.en[key] != null) return dict.en[key];
  } catch (e) {
    /* ignore */
  }
  return key;
}

// Map our layer ids to OpenWeatherMap tile layer names. OWM has no dedicated
// radar tile set, so radar reuses the precipitation tiles.
const OWM_LAYERS = {
  temperature: 'temp_new',
  precipitation: 'precipitation_new',
  radar: 'precipitation_new',
  clouds: 'clouds_new',
  pressure: 'pressure_new',
  wind: 'wind_new',
};


// Compositing, OWM-style: base geography -> weather wash -> labels -> country
// borders. Pane z-indexes: tilePane 200 (base+weather), geoPane 230 (unused
// legacy pane), labelPane 300 (place labels), borderPane 320 (country
// borders, topmost of all so they're never obscured by labels or anything
// else — the OWM reference map always draws borders as the very top layer).

// Grid resolution adapts to zoom: a world view (zoom 3-4) needs only a handful
// of sample points to render a smooth bilinear wash, while a city view (zoom
// 9+) wants the full resolution. Open-Meteo's free tier counts multi-location
// requests per location, so a 6x6 world view costs 36 upstream "calls" vs 144
// for 12x12 — a 4x cut in quota burn with no visible difference after the
// bilinear smoothing in the tile renderer.
const GRID_COLS = 12;
const GRID_ROWS = 12;
const DEBOUNCE_MS = 350;
// Never hit the upstream more than once per interval while panning/zooming:
// the overlay only needs to refresh once the map settles, and Open-Meteo's
// free tier rate-limits bursts. Weather fields barely change minute to minute.
// 12x12 = 144 sample points per refresh; the client reuses a cached grid while
// panning inside its expanded bounds, so real refetches are rare.
const MIN_GRID_INTERVAL_MS = 10000;
// Upstream retry backoff. The minutely window is short (60s); the hourly and
// daily windows are much longer — retrying a 503 every 60s for an hour would
// just burn more of the (already exhausted) quota, so scale the wait by what
// the server tells us.
const RATE_LIMIT_RETRY_MS = 60000;
const HOURLY_RETRY_MS = 10 * 60 * 1000; // hourly window: retry in 10 min

const state = {
  // Active weather layer id, or null for no overlay — OWM-style: the map
  // opens showing just the base geography and the user picks a layer.
  layer: null,
  basemap: 'map',
  lat: 31.63,
  lon: -8.0,
  zoom: 3,
  // Selected timeline hour index into the grid's `hours` array (OWM-style
  // time slider). Switching hours reshapes the cached grid locally — no
  // upstream calls.
  hour: 0,
  // True once the timeline position has been chosen — by the user scrubbing,
  // a ?hour= URL, or the initial current-time default. Once pinned, panning
  // or refetching the grid never moves the scrubber by itself.
  hourPinned: false,
};

// The server returns every layer's field in one payload; radar shares
// precipitation's field, everything else maps to itself.
function layerGroup(id) {
  return id === 'radar' ? 'precipitation' : id;
}

let map;
let baseMapLayer;
let satelliteLayer;
let labelsLayer = null; // labels/outlines rendered ABOVE the weather
let weatherLayer = null;
let weatherKind = null; // 'owm' | 'om'
let owmKey = '';
let usingOwm = false;
let currentGrid = null;
let debounceTimer = null;
const gridCache = new Map();
const FAIL_TTL_MS = 15000;
let lastGridFetchAt = 0;
let rateLimitRetryAt = 0;
let retryTimer = null;

const els = {};


// ── Click-to-weather card ──────────────────────────────────────────────────
let weatherCardMarker = null;

// Reverse-geocode coordinates to get a city name via Open-Meteo geocoding.
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=&latitude=' + lat + '&longitude=' + lon + '&count=1&language=en&format=json'
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Open-Meteo geocoding doesn't support reverse — use nominatim fallback.
    return null;
  } catch (e) { return null; }
}

async function fetchClickWeather(lat, lon) {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure'
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) { return null; }
}

// WMO weather code to human description.
const WMO_DESC = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

// WMO weather code to SVG icon path.
const WMO_ICON = {
  0: '/static/day.svg', 1: '/static/cloudy-day-1.svg',
  2: '/static/cloudy-day-2.svg', 3: '/static/cloudy.svg',
  45: '/static/cloudy.svg', 48: '/static/cloudy.svg',
  51: '/static/rainy-1.svg', 53: '/static/rainy-2.svg',
  55: '/static/rainy-3.svg',
  56: '/static/rainy-4.svg', 57: '/static/rainy-5.svg',
  61: '/static/rainy-4.svg', 63: '/static/rainy-5.svg',
  65: '/static/rainy-6.svg',
  66: '/static/rainy-6.svg', 67: '/static/rainy-7.svg',
  71: '/static/snowy-1.svg', 73: '/static/snowy-2.svg',
  75: '/static/snowy-3.svg', 77: '/static/snowy-4.svg',
  80: '/static/rainy-2.svg', 81: '/static/rainy-5.svg',
  82: '/static/rainy-7.svg',
  85: '/static/snowy-5.svg', 86: '/static/snowy-6.svg',
  95: '/static/thunder.svg', 96: '/static/thunder.svg',
  99: '/static/thunder.svg',
};



function showWeatherCard(lat, lon, data) {
  const card = document.getElementById('map-weather-card');
  const cityEl = document.getElementById('map-weather-card-city');
  const coordsEl = document.getElementById('map-weather-card-coords');
  const tempEl = document.getElementById('map-weather-card-temp');
  const iconEl = document.getElementById('map-weather-card-icon');
  const descEl = document.getElementById('map-weather-card-desc');
  const windEl = document.getElementById('map-weather-card-wind');
  const humEl = document.getElementById('map-weather-card-humidity');
  const feelsEl = document.getElementById('map-weather-card-feels');
  const presEl = document.getElementById('map-weather-card-pressure');

  if (!data || !data.current) {
    card.hidden = true;
    return;
  }

  const cur = data.current;
  const tempUnit = Settings.get('tempUnit', 'c');
  const windUnit = Settings.get('windUnit', 'kmh');

  const fmt = (v) => tempUnit === 'f' ? Math.round(v * 9/5 + 32) + '°F' : Math.round(v) + '°C';
  const fmtWind = (v) => windUnit === 'ms' ? (v / 3.6).toFixed(1) + ' m/s'
    : windUnit === 'kt' ? (v / 1.852).toFixed(0) + ' kt'
    : Math.round(v) + ' km/h';

  if (coordsEl) coordsEl.textContent = lat.toFixed(4) + ', ' + lon.toFixed(4);
  tempEl.textContent = fmt(cur.temperature_2m);
  if (iconEl) iconEl.innerHTML = '<img src="' + (WMO_ICON[cur.weather_code] || '/static/cloudy-day-1.svg') + '" width="48" height="48" alt="weather icon">';
  descEl.textContent = WMO_DESC[cur.weather_code] || 'Unknown';
  if (windEl) windEl.textContent = fmtWind(cur.wind_speed_10m);
  if (humEl) humEl.textContent = cur.relative_humidity_2m + '%';
  if (feelsEl) feelsEl.textContent = fmt(cur.apparent_temperature);
  if (presEl) presEl.textContent = Math.round(cur.surface_pressure) + ' hPa';

  card.hidden = false;
}
function hideWeatherCard() {
  const card = document.getElementById('map-weather-card');
  if (card) card.hidden = true;
  if (weatherCardMarker && map) {
    map.removeLayer(weatherCardMarker);
    weatherCardMarker = null;
  }
}

// Reverse geocode using Nominatim (OSM) to get a city name.
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
const KNOWN_CITIES = [
  {n:'Paris',la:48.86,lo:2.35,c:'France'},{n:'London',la:51.51,lo:-0.13,c:'UK'},
  {n:'Berlin',la:52.52,lo:13.41,c:'Germany'},{n:'Madrid',la:40.42,lo:-3.70,c:'Spain'},
  {n:'Rome',la:41.90,lo:12.50,c:'Italy'},{n:'Vienna',la:48.21,lo:16.37,c:'Austria'},
  {n:'Prague',la:50.08,lo:14.44,c:'Czechia'},{n:'Athens',la:37.98,lo:23.73,c:'Greece'},
  {n:'Istanbul',la:41.01,lo:28.98,c:'Turkey'},{n:'Cairo',la:30.04,lo:31.24,c:'Egypt'},
  {n:'Lagos',la:6.52,lo:3.38,c:'Nigeria'},{n:'Nairobi',la:-1.29,lo:36.82,c:'Kenya'},
  {n:'Casablanca',la:33.57,lo:-7.59,c:'Morocco'},{n:'New York',la:40.71,lo:-74.01,c:'USA'},
  {n:'Moscow',la:55.76,lo:37.62,c:'Russia'},{n:'Beijing',la:39.90,lo:116.41,c:'China'},
  {n:'Tokyo',la:35.68,lo:139.65,c:'Japan'},{n:'Mumbai',la:19.08,lo:72.88,c:'India'},
  {n:'Dubai',la:25.20,lo:55.27,c:'UAE'},{n:'Sydney',la:-33.87,lo:151.21,c:'Australia'},
  {n:'Sao Paulo',la:-23.55,lo:-46.63,c:'Brazil'},{n:'Buenos Aires',la:-34.60,lo:-58.38,c:'Argentina'},
  {n:'Lima',la:-12.05,lo:-77.04,c:'Peru'},{n:'Bogota',la:4.71,lo:-74.07,c:'Colombia'},
  {n:'Bangkok',la:13.76,lo:100.50,c:'Thailand'},{n:'Jakarta',la:-6.21,lo:106.85,c:'Indonesia'},
  {n:'Manila',la:14.60,lo:120.98,c:'Philippines'},{n:'Seoul',la:37.57,lo:126.98,c:'South Korea'},
  {n:'Riyadh',la:24.71,lo:46.68,c:'Saudi Arabia'},{n:'Tehran',la:35.69,lo:51.39,c:'Iran'},
  {n:'Baghdad',la:33.32,lo:44.37,c:'Iraq'},{n:'Khartoum',la:15.50,lo:32.56,c:'Sudan'},
  {n:'Addis Ababa',la:9.03,lo:38.75,c:'Ethiopia'},{n:'Dakar',la:14.72,lo:-17.47,c:'Senegal'},
  {n:'Accra',la:5.60,lo:-0.19,c:'Ghana'},{n:'Tunis',la:36.81,lo:10.18,c:'Tunisia'},
  {n:'Algiers',la:36.75,lo:3.06,c:'Algeria'},{n:'Tripoli',la:32.90,lo:13.18,c:'Libya'},
  {n:'Amsterdam',la:52.37,lo:4.90,c:'Netherlands'},{n:'Brussels',la:50.85,lo:4.35,c:'Belgium'},
  {n:'Zurich',la:47.38,lo:8.54,c:'Switzerland'},{n:'Lisbon',la:38.72,lo:-9.14,c:'Portugal'},
  {n:'Dublin',la:53.35,lo:-6.26,c:'Ireland'},{n:'Copenhagen',la:55.68,lo:12.57,c:'Denmark'},
  {n:'Stockholm',la:59.33,lo:18.07,c:'Sweden'},{n:'Oslo',la:59.91,lo:10.75,c:'Norway'},
  {n:'Helsinki',la:60.17,lo:24.94,c:'Finland'},{n:'Warsaw',la:52.23,lo:21.01,c:'Poland'},
  {n:'Bucharest',la:44.43,lo:26.10,c:'Romania'},{n:'Sofia',la:42.70,lo:23.32,c:'Bulgaria'},
  {n:'Belgrade',la:44.79,lo:20.45,c:'Serbia'},{n:'Zagreb',la:45.82,lo:15.98,c:'Croatia'},
  {n:'Kyiv',la:50.45,lo:30.52,c:'Ukraine'},{n:'Minsk',la:53.90,lo:27.56,c:'Belarus'},
  {n:'Hanoi',la:21.03,lo:105.85,c:'Vietnam'},{n:'Singapore',la:1.35,lo:103.82,c:'Singapore'},
  {n:'Kuala Lumpur',la:3.14,lo:101.69,c:'Malaysia'},{n:'Perth',la:-31.95,lo:115.86,c:'Australia'},
  {n:'Melbourne',la:-37.81,lo:144.96,c:'Australia'},{n:'Auckland',la:-36.85,lo:174.76,c:'New Zealand'},
  {n:'Vancouver',la:49.28,lo:-123.12,c:'Canada'},{n:'Toronto',la:43.65,lo:-79.38,c:'Canada'},
  {n:'Mexico City',la:19.43,lo:-99.13,c:'Mexico'},{n:'Santiago',la:-33.45,lo:-70.67,c:'Chile'},
  {n:'Havana',la:23.11,lo:-82.37,c:'Cuba'},{n:'Santo Domingo',la:18.49,lo:-69.93,c:'Dominican Republic'},
  {n:'Reykjavik',la:64.15,lo:-21.94,c:'Iceland'},{n:'Kabul',la:34.56,lo:69.21,c:'Afghanistan'},
  {n:'Islamabad',la:33.68,lo:73.05,c:'Pakistan'},{n:'Dhaka',la:23.81,lo:90.41,c:'Bangladesh'},
  {n:'Colombo',la:6.93,lo:79.86,c:'Sri Lanka'},{n:'Kathmandu',la:27.72,lo:85.32,c:'Nepal'},
  {n:'Ulaanbaatar',la:47.89,lo:106.91,c:'Mongolia'},{n:'Tashkent',la:41.30,lo:69.24,c:'Uzbekistan'},
  {n:'Abu Dhabi',la:24.45,lo:54.38,c:'UAE'},{n:'Muscat',la:23.59,lo:58.38,c:'Oman'},
  {n:'Amman',la:31.95,lo:35.93,c:'Jordan'},{n:'Beirut',la:33.89,lo:35.50,c:'Lebanon'},
  {n:'Damascus',la:33.51,lo:36.28,c:'Syria'},{n:'Tbilisi',la:41.72,lo:44.83,c:'Georgia'},
  {n:'Yerevan',la:40.18,lo:44.50,c:'Armenia'},{n:'Baku',la:40.41,lo:49.87,c:'Azerbaijan'},
  {n:'Luanda',la:-8.84,lo:13.29,c:'Angola'},{n:'Maputo',la:-25.97,lo:32.57,c:'Mozambique'},
  {n:'Dar es Salaam',la:-6.79,lo:39.21,c:'Tanzania'},{n:'Kampala',la:0.35,lo:32.58,c:'Uganda'},
  {n:'Kinshasa',la:-4.44,lo:15.27,c:'DR Congo'},{n:'Brazzaville',la:-4.26,lo:15.24,c:'Congo'},
  {n:'Ouagadougou',la:12.37,lo:-1.52,c:'Burkina Faso'},{n:'Bamako',la:12.64,lo:-8.00,c:'Mali'},
  {n:'Niamey',la:13.51,lo:2.11,c:'Niger'},{n:'Nouakchott',la:18.07,lo:-15.96,c:'Mauritania'},
  {n:'Abidjan',la:5.36,lo:-4.01,c:'Ivory Coast'},{n:'Conakry',la:9.64,lo:-13.58,c:'Guinea'},
  {n:'Freetown',la:8.47,lo:-13.23,c:'Sierra Leone'},{n:'Monrovia',la:6.29,lo:-10.76,c:'Liberia'},
  {n:'Managua',la:12.12,lo:-86.24,c:'Nicaragua'},{n:'Tegucigalpa',la:14.07,lo:-87.19,c:'Honduras'},
  {n:'San Salvador',la:13.69,lo:-89.22,c:'El Salvador'},{n:'Guatemala City',la:14.63,lo:-90.51,c:'Guatemala'},
  {n:'Kingston',la:18.02,lo:-76.81,c:'Jamaica'},{n:'Panama City',la:8.98,lo:-79.52,c:'Panama'},
  {n:'San Jose',la:9.93,lo:-84.09,c:'Costa Rica'},{n:'Astana',la:51.17,lo:71.45,c:'Kazakhstan'},
  {n:'Dushanbe',la:38.56,lo:68.77,c:'Tajikistan'},{n:'Bishkek',la:42.87,lo:74.57,c:'Kyrgyzstan'},
  {n:'Juba',la:4.86,lo:31.57,c:'South Sudan'},{n:'Asmara',la:15.34,lo:38.93,c:'Eritrea'},
  {n:'Mogadishu',la:2.05,lo:45.32,c:'Somalia'},{n:'Djibouti',la:11.57,lo:43.15,c:'Djibouti'},
  {n:'Lome',la:6.13,lo:1.23,c:'Togo'},{n:'Porto-Novo',la:6.47,lo:2.62,c:'Benin'},
  {n:'Yaounde',la:3.85,lo:11.50,c:'Cameroon'},{n:'Douala',la:4.05,lo:9.77,c:'Cameroon'},
  {n:'Libreville',la:0.38,lo:9.45,c:'Gabon'},  {n:'Malabo',la:3.75,lo:8.73,c:'Equatorial Guinea'},
  // Additional cities for better coverage
  // USA
  {n:'Los Angeles',la:34.05,lo:-118.24,c:'USA'},{n:'Chicago',la:41.88,lo:-87.63,c:'USA'},
  {n:'Houston',la:29.76,lo:-95.37,c:'USA'},{n:'Phoenix',la:33.45,lo:-112.07,c:'USA'},
  {n:'Philadelphia',la:39.95,lo:-75.17,c:'USA'},{n:'San Antonio',la:29.42,lo:-98.49,c:'USA'},
  {n:'San Diego',la:32.72,lo:-117.16,c:'USA'},{n:'Dallas',la:32.78,lo:-96.80,c:'USA'},
  {n:'San Francisco',la:37.77,lo:-122.42,c:'USA'},{n:'Seattle',la:47.61,lo:-122.33,c:'USA'},
  {n:'Denver',la:39.74,lo:-104.99,c:'USA'},{n:'Boston',la:42.36,lo:-71.06,c:'USA'},
  {n:'Miami',la:25.76,lo:-80.19,c:'USA'},{n:'Atlanta',la:33.75,lo:-84.39,c:'USA'},
  {n:'Minneapolis',la:44.98,lo:-93.27,c:'USA'},{n:'Detroit',la:42.33,lo:-83.05,c:'USA'},
  {n:'Las Vegas',la:36.17,lo:-115.14,c:'USA'},{n:'Portland',la:45.52,lo:-122.68,c:'USA'},
  // Canada
  {n:'Montreal',la:45.50,lo:-73.57,c:'Canada'},{n:'Calgary',la:51.05,lo:-114.07,c:'Canada'},
  {n:'Ottawa',la:45.42,lo:-75.70,c:'Canada'},{n:'Edmonton',la:53.55,lo:-113.49,c:'Canada'},
  // Mexico & Central America
  {n:'Guadalajara',la:20.67,lo:-103.35,c:'Mexico'},{n:'Monterrey',la:25.69,lo:-100.32,c:'Mexico'},
  {n:'Cancun',la:21.16,lo:-86.85,c:'Mexico'},{n:'Belize City',la:17.50,lo:-88.20,c:'Belize'},
  // South America
  {n:'Rio de Janeiro',la:-22.91,lo:-43.17,c:'Brazil'},{n:'Brasilia',la:-15.79,lo:-47.88,c:'Brazil'},
  {n:'Salvador',la:-12.97,lo:-38.51,c:'Brazil'},{n:'Recife',la:-8.05,lo:-34.87,c:'Brazil'},
  {n:'Curitiba',la:-25.43,lo:-49.27,c:'Brazil'},{n:'Manaus',la:-3.12,lo:-60.02,c:'Brazil'},
  {n:'Medellin',la:6.25,lo:-75.56,c:'Colombia'},{n:'Quito',la:-0.18,lo:-78.47,c:'Ecuador'},
  {n:'Caracas',la:10.48,lo:-66.90,c:'Venezuela'},{n:'Georgetown',la:6.80,lo:-58.16,c:'Guyana'},
  {n:'Paramaribo',la:5.85,lo:-55.20,c:'Suriname'},{n:'La Paz',la:-16.50,lo:-68.15,c:'Bolivia'},
  {n:'Asuncion',la:-25.26,lo:-57.58,c:'Paraguay'},{n:'Montevideo',la:-34.90,lo:-56.19,c:'Uruguay'},
  // Europe
  {n:'Barcelona',la:41.39,lo:2.17,c:'Spain'},{n:'Valencia',la:39.47,lo:-0.38,c:'Spain'},
  {n:'Seville',la:37.39,lo:-6.00,c:'Spain'},{n:'Milan',la:45.46,lo:9.19,c:'Italy'},
  {n:'Naples',la:40.85,lo:14.27,c:'Italy'},{n:'Turin',la:45.07,lo:7.69,c:'Italy'},
  {n:'Florence',la:43.77,lo:11.25,c:'Italy'},{n:'Marseille',la:43.30,lo:5.37,c:'France'},
  {n:'Lyon',la:45.76,lo:4.84,c:'France'},{n:'Nice',la:43.71,lo:7.26,c:'France'},
  {n:'Munich',la:48.14,lo:11.58,c:'Germany'},{n:'Hamburg',la:53.55,lo:9.99,c:'Germany'},
  {n:'Frankfurt',la:50.11,lo:8.68,c:'Germany'},{n:'Cologne',la:50.94,lo:6.96,c:'Germany'},
  {n:'Stuttgart',la:48.78,lo:9.18,c:'Germany'},{n:'Dresden',la:51.05,lo:13.74,c:'Germany'},
  {n:'Edinburgh',la:55.95,lo:-3.19,c:'UK'},{n:'Manchester',la:53.48,lo:-2.24,c:'UK'},
  {n:'Birmingham',la:52.49,lo:-1.89,c:'UK'},{n:'Glasgow',la:55.86,lo:-4.25,c:'UK'},
  {n:'Liverpool',la:53.41,lo:-2.98,c:'UK'},{n:'Bristol',la:51.45,lo:-2.59,c:'UK'},
  {n:'Krakow',la:50.06,lo:19.94,c:'Poland'},{n:'Gdansk',la:54.35,lo:18.65,c:'Poland'},
  {n:'Wroclaw',la:51.11,lo:17.04,c:'Poland'},{n:'Lodz',la:51.75,lo:19.46,c:'Poland'},
  {n:'Budapest',la:47.50,lo:19.04,c:'Hungary'},{n:'Debrecen',la:47.53,lo:21.63,c:'Hungary'},
  {n:'Bratislava',la:48.15,lo:17.11,c:'Slovakia'},{n:'Ljubljana',la:46.06,lo:14.51,c:'Slovenia'},
  {n:'Tirana',la:41.33,lo:19.82,c:'Albania'},{n:'Skopje',la:41.99,lo:21.43,c:'North Macedonia'},
  {n:'Sarajevo',la:43.86,lo:18.41,c:'Bosnia & Herzegovina'},{n:'Podgorica',la:42.44,lo:19.26,c:'Montenegro'},
  {n:'Chisinau',la:47.01,lo:28.86,c:'Moldova'},{n:'Tallinn',la:59.44,lo:24.75,c:'Estonia'},
  {n:'Riga',la:56.95,lo:24.11,c:'Latvia'},{n:'Vilnius',la:54.69,lo:25.28,c:'Lithuania'},
  {n:'Luxembourg',la:49.61,lo:6.13,c:'Luxembourg'},{n:'Monaco',la:43.73,lo:7.42,c:'Monaco'},
  {n:'Valletta',la:35.90,lo:14.51,c:'Malta'},{n:'Nicosia',la:35.19,lo:33.38,c:'Cyprus'},
  // Russia / Central Asia
  {n:'St Petersburg',la:59.93,lo:30.32,c:'Russia'},{n:'Novosibirsk',la:55.04,lo:82.93,c:'Russia'},
  {n:'Yekaterinburg',la:56.84,lo:60.60,c:'Russia'},{n:'Kazan',la:55.79,lo:49.11,c:'Russia'},
  {n:'Samara',la:53.20,lo:50.15,c:'Russia'},{n:'Omsk',la:54.99,lo:73.37,c:'Russia'},
  {n:'Almaty',la:43.24,lo:76.95,c:'Kazakhstan'},{n:'Nur-Sultan',la:51.13,lo:71.43,c:'Kazakhstan'},
  {n:'Samarkand',la:39.65,lo:66.96,c:'Uzbekistan'},
  // Middle East
  {n:'Doha',la:25.29,lo:51.53,c:'Qatar'},{n:'Kuwait City',la:29.38,lo:47.99,c:'Kuwait'},
  {n:'Manama',la:26.23,lo:50.58,c:'Bahrain'},{n:'Sanaa',la:15.37,lo:44.19,c:'Yemen'},
  {n:'Tel Aviv',la:32.09,lo:34.78,c:'Israel'},{n:'Jerusalem',la:31.77,lo:35.23,c:'Israel'},
  // East Asia
  {n:'Shanghai',la:31.23,lo:121.47,c:'China'},{n:'Guangzhou',la:23.13,lo:113.26,c:'China'},
  {n:'Shenzhen',la:22.54,lo:114.06,c:'China'},{n:'Chengdu',la:30.57,lo:104.07,c:'China'},
  {n:'Wuhan',la:30.59,lo:114.31,c:'China'},{n:'Hangzhou',la:30.27,lo:120.15,c:'China'},
  {n:'Xi An',la:34.26,lo:108.94,c:'China'},{n:'Harbin',la:45.80,lo:126.53,c:'China'},
  {n:'Hong Kong',la:22.32,lo:114.17,c:'China'},{n:'Taipei',la:25.03,lo:121.57,c:'Taiwan'},
  {n:'Osaka',la:34.69,lo:135.50,c:'Japan'},{n:'Kyoto',la:35.01,lo:135.77,c:'Japan'},
  {n:'Nagoya',la:35.18,lo:136.91,c:'Japan'},{n:'Sapporo',la:43.06,lo:141.35,c:'Japan'},
  {n:'Fukuoka',la:33.59,lo:130.40,c:'Japan'},{n:'Busan',la:35.18,lo:129.08,c:'South Korea'},
  {n:'Daegu',la:35.87,lo:128.60,c:'South Korea'},{n:'Incheon',la:37.46,lo:126.71,c:'South Korea'},
  // South / Southeast Asia
  {n:'Delhi',la:28.61,lo:77.23,c:'India'},{n:'Bangalore',la:12.97,lo:77.59,c:'India'},
  {n:'Chennai',la:13.08,lo:80.27,c:'India'},{n:'Kolkata',la:22.57,lo:88.36,c:'India'},
  {n:'Hyderabad',la:17.39,lo:78.49,c:'India'},{n:'Pune',la:18.52,lo:73.86,c:'India'},
  {n:'Ahmedabad',la:23.02,lo:72.57,c:'India'},{n:'Jaipur',la:26.91,lo:75.79,c:'India'},
  {n:'Lahore',la:31.55,lo:74.35,c:'Pakistan'},{n:'Karachi',la:24.86,lo:67.01,c:'Pakistan'},
  {n:'Rangoon',la:16.87,lo:96.20,c:'Myanmar'},{n:'Phnom Penh',la:11.56,lo:104.92,c:'Cambodia'},
  {n:'Vientiane',la:17.97,lo:102.63,c:'Laos'},

  // Africa
  {n:'Marrakech',la:31.63,lo:-8.00,c:'Morocco'},
  {n:'Fes',la:34.03,lo:-5.00,c:'Morocco'},
  {n:'Kumasi',la:6.69,lo:-1.62,c:'Ghana'},{n:'Kano',la:12.00,lo:8.59,c:'Nigeria'},
  {n:'Abuja',la:9.06,lo:7.49,c:'Nigeria'},{n:'Ibadan',la:7.38,lo:3.94,c:'Nigeria'},
  {n:'Cape Town',la:-33.93,lo:18.42,c:'South Africa'},{n:'Johannesburg',la:-26.20,lo:28.05,c:'South Africa'},
  {n:'Durban',la:-29.86,lo:31.02,c:'South Africa'},{n:'Pretoria',la:-25.75,lo:28.19,c:'South Africa'},
  {n:'Lusaka',la:-15.39,lo:28.32,c:'Zambia'},{n:'Harare',la:-17.83,lo:31.05,c:'Zimbabwe'},
  {n:'Windhoek',la:-22.56,lo:17.08,c:'Namibia'},{n:'Gaborone',la:-24.63,lo:25.91,c:'Botswana'},
  {n:'Antananarivo',la:-18.88,lo:47.51,c:'Madagascar'},{n:'Noumea',la:-22.28,lo:166.46,c:'New Caledonia'},
  {n:'Lilongwe',la:-13.97,lo:33.79,c:'Malawi'},{n:'Bujumbura',la:-3.38,lo:29.36,c:'Burundi'},
  {n:'Kigali',la:-1.94,lo:29.87,c:'Rwanda'},
  {n:"N'Djamena",la:12.13,lo:15.05,c:'Chad'},{n:'Bangui',la:4.39,lo:18.56,c:'Central African Rep.'},
  {n:'Port-Gentil',la:-0.72,lo:8.78,c:'Gabon'},
  {n:'Pointe-Noire',la:-4.77,lo:11.86,c:'Congo'},
  {n:'Mombasa',la:-4.04,lo:39.67,c:'Kenya'},
  // Oceania
  {n:'Brisbane',la:-27.47,lo:153.03,c:'Australia'},{n:'Adelaide',la:-34.93,lo:138.60,c:'Australia'},
  {n:'Canberra',la:-35.28,lo:149.13,c:'Australia'},{n:'Hobart',la:-42.88,lo:147.33,c:'Australia'},
  {n:'Gold Coast',la:-28.02,lo:153.40,c:'Australia'},{n:'Darwin',la:-12.46,lo:130.84,c:'Australia'},
  {n:'Christchurch',la:-43.53,lo:172.64,c:'New Zealand'},{n:'Wellington',la:-41.29,lo:174.78,c:'New Zealand'},
  {n:'Hamilton',la:-37.79,lo:175.28,c:'New Zealand'},{n:'Suva',la:-18.14,lo:178.44,c:'Fiji'},
  {n:'Port Moresby',la:-6.31,lo:143.95,c:'Papua New Guinea'},{n:'Apia',la:-13.83,lo:-171.76,c:'Samoa'},
  // Caribbean
  {n:'Nassau',la:25.03,lo:-77.40,c:'Bahamas'},{n:'Bridgetown',la:13.10,lo:-59.62,c:'Barbados'},
  {n:'Port of Spain',la:10.65,lo:-61.50,c:'Trinidad & Tobago'},{n:'San Juan',la:18.47,lo:-66.11,c:'Puerto Rico'},
  
];
async function reverseGeocodeNominatim(lat, lon) {
  // 1) Fast local lookup — nearest city from the built-in list.
  let best = null, bestD = Infinity;
  for (const c of KNOWN_CITIES) {
    const d = haversine(lat, lon, c.la, c.lo);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best && bestD < 300) return best.n + ', ' + best.c;
  // If the nearest known city is very close, just use it.
  if (best && bestD < 800) return best.n + ', ' + best.c;

  // 2) Remote fallback: call the free Nominatim API (OSM) for reverse
  //    geocoding. One request per click is fine — it's free & no key needed.
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=' +
      lat + '&lon=' + lon + '&zoom=10&addressdetails=1',
      { headers: { 'Accept-Language': 'en' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const city = a.city || a.town || a.village || a.hamlet ||
          a.municipality || a.county || a.state || '';
        const country = a.country || '';
        if (city && country) return city + ', ' + country;
        if (city) return city;
        if (country) return country;
      }
      if (data && data.display_name) {
        // display_name is usually "Place, County, State, Country" — take
        // the first two meaningful parts.
        const parts = data.display_name.split(',').map(s => s.trim());
        if (parts.length >= 2) return parts[0] + ', ' + parts[parts.length - 1];
        if (parts.length === 1) return parts[0];
      }
    }
  } catch (e) { /* ignore network errors */ }

  // 3) Last resort: nearest city even if it's far away, or just coords.
  if (best && bestD < 3000) return best.n + ', ' + best.c;
  return null;
}

async function onMapClick(e) {
  const { lat, lng } = e.latlng;
  // Normalize longitude to [-180, 180] for API calls (panning can produce values outside this range)
  const normLng = ((lng + 180) % 360 + 360) % 360 - 180;

  // Place a marker dot at the clicked location.
  if (weatherCardMarker) map.removeLayer(weatherCardMarker);
  weatherCardMarker = L.circleMarker([lat, lng], {
    radius: 6,
    fillColor: '#2196F3',
    color: 'white',
    weight: 2,
    fillOpacity: 0.9,
  }).addTo(map);

  // Show loading state
  const cityEl = document.getElementById('map-weather-card-city');
  if (cityEl) cityEl.textContent = 'Loading...';
  const card = document.getElementById('map-weather-card');
  if (card) card.hidden = false;

  // Fetch weather + city name in parallel
  const [weatherData, cityName] = await Promise.all([
    fetchClickWeather(lat, normLng),
    reverseGeocodeNominatim(lat, normLng),
  ]);

  if (cityName && cityEl) {
    cityEl.textContent = cityName;
  } else if (cityEl) {
    cityEl.textContent = lat.toFixed(2) + "°, " + normLng.toFixed(2) + "°";
  }

  showWeatherCard(lat, normLng, weatherData);
}


// ── Country/coastline borders (OWM-style) ───────────────────────────────
// Vector outlines from Natural Earth 110m GeoJSON, rendered via Canvas for
// performance. Properties are stripped to reduce memory. The layer lives in
// its own pane ABOVE every other pane (including labels) so borders are
// always the topmost, fully visible thing on the map.
//
// Leaflet's raster tile layers wrap horizontally forever because tiles are
// addressed by (x, y, z) with x wrapped modulo 2^z — a single GeoJSON layer
// has no such wrapping, it only exists at its literal longitudes. Panning one
// world-width east/west would otherwise leave that repeated copy of the world
// bare. We work around this by keeping one L.geoJSON per visible "world
// copy" (each shifted by copyIndex*360° via a custom coordsToLatLng),
// adding/removing copies as the user pans/zooms so borders cover the entire
// world no matter how far it's panned.
let bordersGeoJson = null;
const borderCopyLayers = new Map(); // copyIndex -> L.GeoJSON layer (country borders)
const stateBorderCopyLayers = new Map(); // copyIndex -> L.GeoJSON layer (state/province borders)
let statesGeoJson = null;

// Strip heavy per-feature properties to shrink the in-memory footprint.
// Only geometry is needed for the border strokes.
function _stripGeoProps(geo) {
  if (!geo || !geo.features) return geo;
  return {
    type: 'FeatureCollection',
    features: geo.features.map((f) => ({
      type: 'Feature',
      properties: {},
      geometry: f.geometry,
    })),
  };
}

async function loadBordersGeoJson() {
  if (bordersGeoJson) return bordersGeoJson;
  try {
    const res = await fetch('/static/countries.geojson');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    bordersGeoJson = _stripGeoProps(raw);
  } catch (e) {
    console.warn('Failed to load country borders:', e);
    bordersGeoJson = null;
  }
  return bordersGeoJson;
}


async function loadStatesGeoJson() {
  if (statesGeoJson) return statesGeoJson;
  try {
    const res = await fetch('/static/states.geojson');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    statesGeoJson = _stripGeoProps(raw);
  } catch (e) {
    console.warn('Failed to load state borders:', e);
    statesGeoJson = null;
  }
  return statesGeoJson;
}

// Zoom-dependent border styling. Dark borders for both map and satellite basemaps.
// Weight scales aggressively to cover/reinforce the grey border lines from
// the CARTO dark tile labels at every zoom level.
function _borderStyle(zoom) {
  if (zoom <= 2) return { weight: 1.5, opacity: 0.95 };
  if (zoom <= 3) return { weight: 1.8, opacity: 0.95 };
  if (zoom <= 4) return { weight: 2.0, opacity: 0.97 };
  if (zoom <= 5) return { weight: 2.5, opacity: 0.97 };
  if (zoom <= 6) return { weight: 3.0, opacity: 0.98 };
  if (zoom <= 7) return { weight: 3.5, opacity: 0.98 };
  if (zoom <= 8) return { weight: 4.0, opacity: 1.0 };
  if (zoom <= 9) return { weight: 4.5, opacity: 1.0 };
  if (zoom <= 10) return { weight: 5.0, opacity: 1.0 };
  if (zoom <= 12) return { weight: 6.0, opacity: 1.0 };
  if (zoom <= 14) return { weight: 7.0, opacity: 1.0 };
  return { weight: 8.0, opacity: 1.0 };
}

// State/province borders: lighter than country borders, only visible at zoom 5+.
function _stateBorderStyle(zoom) {
  if (zoom <= 5) return { weight: 1.5, opacity: 0.85 };
  if (zoom <= 7) return { weight: 2.0, opacity: 0.9 };
  if (zoom <= 9) return { weight: 2.5, opacity: 0.92 };
  if (zoom <= 11) return { weight: 3.0, opacity: 0.95 };
  if (zoom <= 13) return { weight: 3.5, opacity: 0.95 };
  return { weight: 4.0, opacity: 0.95 };
}

function _makeGeoJsonLayer(geo, copyIndex, s, color) {
  const offset = copyIndex * 360;
  return L.geoJSON(geo, {
    pane: 'borderPane',
    renderer: L.canvas({ pane: 'borderPane', padding: 0.5 }),
    interactive: false,
    bubblingMouseEvents: true,
    coordsToLatLng: (coords) => L.latLng(coords[1], coords[0] + offset),
    style: {
      color: color || '#000000',
      weight: s.weight,
      opacity: s.opacity,
      fillColor: 'transparent',
      fillOpacity: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
    },
  });
}

function _makeBorderCopyLayer(copyIndex, s, color) {
  const offset = copyIndex * 360;
  return L.geoJSON(bordersGeoJson, {
    pane: 'borderPane',
    // The renderer needs its OWN pane set too: Leaflet's Path layers use
    // options.renderer directly when present (see L.Map#getRenderer), which
    // bypasses the layer's own `pane` option entirely. Without this, the
    // shared canvas renderer falls back to its default pane (overlayPane)
    // and the borders silently render there instead of borderPane.
    renderer: L.canvas({ pane: 'borderPane', padding: 0.5 }),
    interactive: false,
    bubblingMouseEvents: true,
    // Shift every coordinate by a whole number of world-widths so this copy
    // of the borders lines up with the corresponding repeated copy of the
    // base map tiles.
    coordsToLatLng: (coords) => L.latLng(coords[1], coords[0] + offset),
    style: {
      color: color || '#000000',
      weight: s.weight,
      opacity: s.opacity,
      fillColor: 'transparent',
      fillOpacity: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
    },
  });
}

// Ensure a border-layer copy exists for every world repeat currently
// touching the viewport (plus one extra copy of padding on each side so a
// fast pan never outruns the render), and drop copies that have scrolled out
// of view so the layer count stays bounded on a long pan.
// Show/hide ALL border copies (country + state). Borders only render when
// a weather layer is active — without a weather overlay the CARTO tiles
// show their own border lines.
function setBorderVisibility(show) {
  borderCopyLayers.forEach((layer) => {
    if (show && !map.hasLayer(layer)) layer.addTo(map);
    else if (!show && map.hasLayer(layer)) map.removeLayer(layer);
  });
  stateBorderCopyLayers.forEach((layer) => {
    if (show && !map.hasLayer(layer)) layer.addTo(map);
    else if (!show && map.hasLayer(layer)) map.removeLayer(layer);
  });
}

async function updateBorderCopies() {
  if (!map) return;
  if (!bordersGeoJson) {
    const geo = await loadBordersGeoJson();
    if (!geo) return;
  }
  const bounds = map.getBounds();
  const minCopy = Math.floor(bounds.getWest() / 360) - 2;
  const maxCopy = Math.ceil(bounds.getEast() / 360) + 2;
  const s = _borderStyle(map.getZoom());
  const show = state.layer !== null;

  // Unified dark borders for both map and satellite basemaps
  for (let c = minCopy; c <= maxCopy; c++) {
    if (!borderCopyLayers.has(c)) {
      const layer = _makeBorderCopyLayer(c, s, '#000000');
      if (show) layer.addTo(map);
      borderCopyLayers.set(c, layer);
    }
  }
  borderCopyLayers.forEach((layer, c) => {
    if (c < minCopy || c > maxCopy) {
      map.removeLayer(layer);
      borderCopyLayers.delete(c);
    } else if (show && !map.hasLayer(layer)) {
      layer.addTo(map);
    } else if (!show && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });

  // State/province borders: only at zoom 5+
  const zoom = map.getZoom();
  if (zoom >= 5) {
    if (!statesGeoJson) await loadStatesGeoJson();
    if (statesGeoJson) {
      const ss = _stateBorderStyle(zoom);
      for (let c = minCopy; c <= maxCopy; c++) {
        if (!stateBorderCopyLayers.has(c)) {
          const layer = _makeGeoJsonLayer(statesGeoJson, c, ss, "#000000");
          if (show) layer.addTo(map);
          stateBorderCopyLayers.set(c, layer);
        }
      }
      stateBorderCopyLayers.forEach((layer, c) => {
        if (c < minCopy || c > maxCopy) {
          map.removeLayer(layer);
          stateBorderCopyLayers.delete(c);
        } else if (show && !map.hasLayer(layer)) {
          layer.addTo(map);
        } else if (!show && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    }
  } else {
    // Remove state borders when zoomed out past zoom 5
    stateBorderCopyLayers.forEach((layer) => map.removeLayer(layer));
    stateBorderCopyLayers.clear();
  }
}

// Re-style every border copy  when the zoom level changes so weight/opacity
// track the current view, and top up copies for the (possibly wider) zoomed-
// out view. Called from the existing zoomend handler.
function _updateBorderZoom() {
  const s = _borderStyle(map.getZoom());
  borderCopyLayers.forEach((layer) => {
    layer.eachLayer((l) => {
      if (l.setStyle) l.setStyle({ weight: s.weight, opacity: s.opacity });
    });
  });
  // Also update state borders on zoom
  const zoom = map.getZoom();
  if (zoom >= 5 && statesGeoJson) {
    const ss = _stateBorderStyle(zoom);
    stateBorderCopyLayers.forEach((layer) => {
      layer.eachLayer((l) => {
        if (l.setStyle) l.setStyle({ weight: ss.weight, opacity: ss.opacity });
      });
    });
  }
  updateBorderCopies();
}

async function init() {
  cacheEls();
  parseUrl();
  await Promise.all([loadConfig(), loadBordersGeoJson()]);
  initMap();
  buildLayerButtons();
  bindControls();
  updateLegend();
  applyControlValues();
  fitMapLayout();
  window.addEventListener('resize', fitMapLayout);
  // Keep the zoom-out floor in sync with the REAL container: fonts and the
  // capitals ticker can change the header height after first paint, and on
  // mobile the URL bar / orientation collapse and expand the viewport — all
  // without a window resize. Observe the layout (and its chrome) so the floor
  // is recomputed whenever the actual map height changes.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => fitMapLayout());
    const layout = document.querySelector('.map-layout');
    const header = document.querySelector('.header');
    const ticker = document.querySelector('.capitals-ticker');
    if (layout) ro.observe(layout);
    if (header) ro.observe(header);
    if (ticker) ro.observe(ticker);
  }
  window.addEventListener('load', fitMapLayout);
  window.addEventListener('orientationchange', () => setTimeout(fitMapLayout, 300));
  setWeatherLayer();
  ensureLabelsLayer(); // keep labels/outlines above the weather overlay
  await updateBorderCopies(); // pre-render borders so they appear on first paint
  syncUrl();

  // The header geolocation picker fires 'location-selected' when the user
  // confirms a city — move the map there so the button actually does
  // something on the map page.
  document.addEventListener('location-selected', (e) => {
    const { lat, lon } = (e && e.detail) || {};
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.setView([lat, lon], Math.max(map.getZoom(), 8));
    }
  });
}

function cacheEls() {
  els.layers = document.getElementById('map-layers');
  els.basemaps = document.getElementById('map-basemaps');
  els.legend = document.getElementById('map-legend');
  els.status = document.getElementById('map-status');
  els.panel = document.getElementById('map-modal');
  els.panelClose = document.getElementById('map-panel-close');
  els.panelOpen = document.getElementById('map-panel-open');
  els.backdrop = document.getElementById('map-modal-backdrop');
  els.timeline = document.getElementById('map-timeline');
  els.timelineSlider = document.getElementById('map-timeline-slider');
  els.timelinePrev = document.getElementById('map-timeline-prev');
  els.timelineNext = document.getElementById('map-timeline-next');
  els.timelineTime = document.getElementById('map-timeline-time');
  els.weatherCard = document.getElementById('map-weather-card');
}

// Pull the (non-secret) frontend config from the server. The OpenWeatherMap key
// lives server-side in the environment so it is never baked into the bundle.
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      owmKey = cfg.openWeatherKey || '';
    }
  } catch (e) {
    owmKey = '';
  }
}

// Base maps are split into plain geography + a separate labels/outlines tile
// layer that sits ON TOP of the weather wash — the same compositing OWM's
// weathermap uses, so borders and place names stay crisp while the weather
// layer stays transparent underneath them.
const BASE_MAPS = {  map: {
    base: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    labels:
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
    labelFilter: 'drop-shadow(0 0 1px #fff) drop-shadow(0 0 2px #fff)',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels:
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
    labelFilter: 'drop-shadow(0 0 1px #fff) drop-shadow(0 0 2px #fff)',
    attribution: 'Tiles &copy; Esri &copy; CARTO',
  },
};

function initMap() {
  map = L.map('map', {
    center: [state.lat, state.lon],
    zoom: state.zoom,
    zoomControl: false,
    // No attribution bar (the "Leaflet | © OpenStreetMap © CARTO" strip at the
    // bottom) — the user wants the map chrome clean.
    attributionControl: false,
    // The weather data only exists between ±85° latitude; without bounds the
    // map drags forever into empty space above/below the poles. The longitude
    // bounds are huge-but-finite so horizontal world wrapping keeps working —
    // Leaflet clamps only the latitude axis (see Leaflet issue #3081).
    maxBounds: L.latLngBounds(L.latLng(-85, -99999), L.latLng(85, 99999)),
    maxBoundsViscosity: 1.0,
  });

  // Explicit z-order: weather below the map outlines, labels on top (like OWM's
  // weathermap compositing).
  map.createPane('geoPane');
  map.getPane('geoPane').style.zIndex = '230';
  map.createPane('borderPane');
  map.getPane('borderPane').style.zIndex = '310';
  map.createPane('labelPane');
  map.getPane('labelPane').style.zIndex = '340';

  const def = BASE_MAPS[state.basemap] || BASE_MAPS.map;
  baseMapLayer = L.tileLayer(BASE_MAPS.map.base, {
    maxZoom: 19,
    opacity: 1.0,
    attribution: BASE_MAPS.map.attribution,
  });
  satelliteLayer = L.tileLayer(BASE_MAPS.satellite.base, {
    maxZoom: 19,
    opacity: 0.65,
    attribution: BASE_MAPS.satellite.attribution,
  });
  // The same geography re-drawn ABOVE the weather wash (only for the "map"
  (state.basemap === 'satellite' ? satelliteLayer : baseMapLayer).addTo(map);
  // Apply IR filter to satellite on initial load if selected.
  if (state.basemap === 'satellite' && satelliteLayer._container) {
    satelliteLayer._container.style.filter = 'saturate(0) brightness(1.1) contrast(1.3)';
  }
  labelsLayer = L.tileLayer(def.labels, { maxZoom: 19, pane: 'labelPane' }).addTo(map);
  // Apply label colour filter for the initial basemap.
  const initLabelPane = map.getPane('labelPane');
  if (initLabelPane) initLabelPane.style.filter = def.labelFilter || '';


  // Debug/verification hooks (same pattern as the perf hooks): the live map
  // instance, used to check the drag bounds clamp.
  window.__map = map;

  // Performance hooks for tuning the tile resolution / particle budget against
  // the 60fps frame target. measureTileBatch() re-renders every visible weather
  // tile and times the whole batch; __weatherPerf holds running per-tile stats.
  window.__weatherPerf = weatherPerf;
  window.__mapPerf = {
    measureTileBatch: () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const before = weatherPerf.renders;
        let stable = 0;
        let last = before;
        (function poll(waits) {
          if (waits > 40) {
            resolve({ batchMs: -1, tilesRendered: weatherPerf.renders - before, timedOut: true });
            return;
          }
          setTimeout(() => {
            if (weatherPerf.renders === last) stable++;
            else {
              last = weatherPerf.renders;
              stable = 0;
            }
            if (stable >= 2) {
              resolve({
                batchMs: Math.round((performance.now() - t0) * 10) / 10,
                tilesRendered: weatherPerf.renders - before,
                avgTileMs: Math.round(weatherPerf.avgMs * 100) / 100,
              });
            } else poll(waits + 1);
          }, 25);
        })(0);
        weatherLayer.redraw();
      }),
  };

  map.on('moveend', () => {
    syncUrl();
    // Never settle below the zoom floor (mobile pinch-outs, orientation
    // changes, or a floor raised after the map already rendered).
    enforceMinZoom();
    updateBorderCopies();
    if (!usingOwm) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshGrid, DEBOUNCE_MS);
    }
  });
  map.on('zoomend', () => { enforceMinZoom(); _updateBorderZoom(); });
  map.on('click', onMapClick);
}

// Remove any weather overlay — toggling the active layer off returns to the
// plain base map (OWM-style), with no data fetch needed.
function clearWeatherLayer() {
  if (weatherLayer && map) map.removeLayer(weatherLayer);
  weatherLayer = null;
  weatherKind = null;
  // Borders stay visible independently — they are always-on for both basemaps.
}

// Decide which backend to use and (re)create the overlay for the active layer.
function setWeatherLayer() {
  if (state.layer === null) {
    clearWeatherLayer();
    hideStatus();
    return;
  }
  if (owmKey) {
    usingOwm = true;
    setOwmLayer();
  } else {
    usingOwm = false;
    ensureOpenMeteoLayer();
  }
  updateBorderCopies();
}

// Per-layer tile opacity for the OWM (pre-rendered) tile path. The fallback
// Open-Meteo renderer applies per-layer `opacity` itself; here OWM's baked
// tiles need an explicit layer-opacity bump so e.g. clouds read as a solid
// white blanket in both modes (the old flat 0.65 washed them out).
const OWM_LAYER_OPACITY = {
  clouds: 0.9,
};

function setOwmLayer() {
  if (weatherLayer && weatherKind === 'owm') map.removeLayer(weatherLayer);
  const name = OWM_LAYERS[state.layer] || 'temp_new';
  const url = `${OWM_BASE}/${name}/{z}/{x}/{y}.png?appid=${encodeURIComponent(owmKey)}`;
  weatherLayer = L.tileLayer(url, {
    maxZoom: 18,
    opacity: OWM_LAYER_OPACITY[state.layer] || 0.65,
    attribution: '&copy; OpenWeatherMap',
  });
  weatherKind = 'owm';
  hideStatus();
  weatherLayer.addTo(map);
  weatherLayer.bringToFront();
}

function ensureOpenMeteoLayer(forceFetch = false) {
  if (weatherLayer && weatherKind === 'om') {
    refreshGrid(forceFetch);
    return;
  }
  // Re-selecting a layer after deselecting it needs a fresh overlay (the old
  // one was removed when the layer was toggled off).
  weatherLayer = createWeatherLayer(() => currentGrid, () => state.layer);
  weatherKind = 'om';
  weatherLayer.addTo(map);
  weatherLayer.bringToFront();
  refreshGrid(forceFetch);
}

function buildLayerButtons() {
  els.layers.innerHTML = '';
  LAYER_ORDER.forEach((id) => {
    const def = getLayer(id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-layer-btn' + (id === state.layer ? ' is-active' : '');
    btn.textContent = t(`map.layer.${id}`);
    btn.dataset.layer = id;
    btn.addEventListener('click', () => setLayer(id));
    els.layers.appendChild(btn);
  });
}

function setLayer(id) {
  // OWM-style toggle: clicking the active layer deselects it, leaving just the
  // base map (no overlay, no legend, no timeline).
  if (id === state.layer) {
    state.layer = null;
    els.layers.querySelectorAll('.map-layer-btn').forEach((b) => b.classList.remove('is-active'));
    if (els.legend) els.legend.hidden = true;
    if (els.timeline) els.timeline.hidden = true;
    clearWeatherLayer();
    hideStatus();
    syncUrl();
    return;
  }
  state.layer = id;
  els.layers.querySelectorAll('.map-layer-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.layer === id)
  );
  // OWM-style: turning a layer on starts the timeline at the current time.
  state.hourPinned = false;
  if (currentGrid && currentGrid.hours && currentGrid.hours.length) {
    state.hour = hourIndexForNow(currentGrid.hours);
    state.hourPinned = true;
    currentGrid.hour = state.hour;
    applyLayerToGrid(currentGrid, state.layer);
    if (weatherLayer) weatherLayer.redraw();
  }
  updateLegend();
  if (usingOwm) setOwmLayer();
  else ensureOpenMeteoLayer(true); // explicit user action: fetch the new layer now
  syncUrl();
}

// --- Timeline (OWM-style forecast scrubber) --------------------------------
// The grid payload carries a full 48h (or 24h archive) window for every layer,
// so scrubbing time is a pure client-side reshape — zero upstream calls, which
// keeps the free-tier quota intact.

// The timeline index closest to the current time — the OWM-style default
// position whenever a layer is turned on (or loaded without a pinned hour).
function hourIndexForNow(hours) {
  const now = Date.now();
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < hours.length; i++) {
    const t = new Date(hours[i]).getTime();
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - now);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function updateTimelineTime() {
  const hours = currentGrid && currentGrid.hours;
  if (!hours || !els.timelineTime) return;
  els.timelineTime.textContent = hours[state.hour] ? hours[state.hour].replace('T', ' ') : '';
}

function buildTimeline() {
  if (!els.timeline) return;
  if (state.layer === null || usingOwm || !currentGrid || !currentGrid.hours || currentGrid.hours.length <= 1) {
    els.timeline.hidden = true;
    return;
  }
  const hours = currentGrid.hours;
  els.timelineSlider.min = '0';
  els.timelineSlider.max = String(hours.length - 1);
  els.timelineSlider.step = '1';
  els.timelineSlider.value = String(state.hour);
  els.timeline.hidden = false;
  updateTimelineTime();
}

// Switch the displayed forecast hour. The grid holds every hour already, so
// this never touches the network.
function setHour(idx) {
  if (!currentGrid || !currentGrid.hours || !currentGrid.hours.length) return;
  const h = Math.max(0, Math.min(currentGrid.hours.length - 1, idx));
  if (h === state.hour) return;
  state.hour = h;
  state.hourPinned = true; // the user chose this time; keep it across refetches
  currentGrid.hour = h;
  applyLayerToGrid(currentGrid, state.layer);
  weatherLayer.redraw();
  if (els.timelineSlider) els.timelineSlider.value = String(h);
  updateTimelineTime();
  syncUrl();
}

function bindControls() {
  els.basemaps.querySelectorAll('[data-basemap]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.basemap === state.basemap);
    btn.addEventListener('click', () => setBasemap(btn.dataset.basemap));
  });

  els.panelClose.addEventListener('click', () => {
    els.panel.hidden = true;
    els.panelOpen.hidden = false;
  });
  els.panelOpen.addEventListener('click', () => {
    els.panel.hidden = false;
    els.panelOpen.hidden = true;
  });

  els.timelineSlider.addEventListener('input', () => setHour(Number(els.timelineSlider.value)));
  els.timelinePrev.addEventListener('click', () => setHour(state.hour - 3));
  els.timelineNext.addEventListener('click', () => setHour(state.hour + 3));

  // Weather card close button.
  const cardClose = document.getElementById('map-weather-card-close');
  if (cardClose) cardClose.addEventListener('click', hideWeatherCard);
}

// Labels/outlines always render on top of the weather overlay.
function ensureLabelsLayer() {
  if (labelsLayer) map.removeLayer(labelsLayer);
  const def = BASE_MAPS[state.basemap] || BASE_MAPS.map;
  labelsLayer = L.tileLayer(def.labels, { maxZoom: 19, pane: 'labelPane' }).addTo(map);
  // Apply label colour filter: satellite uses dark_only_labels inverted to white.
  const pane = map.getPane('labelPane');
  if (pane) pane.style.filter = def.labelFilter || '';
}

function setBasemap(which) {
  if (which === state.basemap) return;
  state.basemap = which;
  map.removeLayer(which === 'satellite' ? baseMapLayer : satelliteLayer);
  (which === 'satellite' ? satelliteLayer : baseMapLayer).addTo(map);
  // IR filter: apply ONLY to the satellite tile element, not the whole
  // tilePane (which would desaturate weather overlays too).
  if (satelliteLayer._container) {
    satelliteLayer._container.style.filter = which === 'satellite'
      ? 'saturate(0) brightness(1.1) contrast(1.3)' : '';
  }
  // Also clear any leftover tilePane filter from older code paths.
  const tilePane = map.getPane('tilePane');
  if (tilePane) tilePane.style.filter = '';
  ensureLabelsLayer();
  // Refresh border copies (visible only when a weather layer is active).
  updateBorderCopies();
  els.basemaps.querySelectorAll('[data-basemap]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.basemap === which)
  );
  syncUrl();
}

function parseUrl() {
  const p = new URLSearchParams(location.search);
  // 'none' (or an unknown id) means no overlay — the OWM-style default.
  const layerParam = p.get('layer');
  if (layerParam && layerParam !== 'none' && LAYER_ORDER.includes(layerParam)) {
    state.layer = layerParam;
  }
  if (p.get('basemap')) state.basemap = p.get('basemap');
  if (p.get('lat')) state.lat = Number(p.get('lat'));
  if (p.get('lon')) state.lon = Number(p.get('lon'));
  if (p.get('zoom')) state.zoom = Number(p.get('zoom'));
  // Clamp the requested zoom to the absolute floor immediately so the initial
  // view can never open on a whole-world (blank-border) view even before the
  // dynamic height-based min-zoom is computed in fitMapLayout().
  state.zoom = Math.max(2, Math.min(18, Math.round(state.zoom) || 3));
  const h = Number(p.get('hour'));
  if (Number.isFinite(h) && h >= 0) {
    state.hour = Math.floor(h);
    state.hourPinned = true; // explicit ?hour= wins over the current-time default
  }
}

// Keep requested bounds within valid geographic ranges so we never send
// out-of-range coordinates to the weather API. Viewports that wrap the
// antimeridian (or are world-wide) cannot be expressed as one non-wrapping
// window, so they request the whole world [-180, 180] — the sampling code then
// normalizes longitudes back into that range. lat/lon must be clamped AFTER
// expanding, otherwise the padding pushes coordinates out of range again.
// Make the map fill the viewport below the header + ticker chrome, and keep the
// control panel sitting just under that chrome with a little breathing room.
function fitMapLayout() {
  const layout = document.querySelector('.map-layout');
  if (!layout) return;
  const header = document.querySelector('.header');
  const ticker = document.querySelector('.capitals-ticker');
  const top = (header ? header.offsetHeight : 0) + (ticker ? ticker.offsetHeight : 0);
  layout.style.position = 'absolute';
  layout.style.top = top + 'px';
  layout.style.left = '0';
  layout.style.right = '0';
  layout.style.bottom = '0';
  layout.style.height = 'auto';

  // The control panel (and its reopen button) live inside the fixed modal, so
  // start it below the header + ticker instead of overlapping them.
  if (els.panel) {
    els.panel.style.position = 'fixed';
    els.panel.style.top = top + 'px';
    els.panel.style.left = '0';
    els.panel.style.right = '0';
    els.panel.style.bottom = '0';
  }

  // Zoom-out floor: keep the visible latitude span inside ±85° so the user can
  // never zoom out into the empty strips at the top/bottom (the basemap and
  // weather data both end at the pole line). Recomputed on every resize from
  // the ACTUAL container height — a short phone viewport can zoom out further
  // than a tall desktop monitor without showing blanks.
  enforceMinZoom();
}

// Recompute + apply the zoom-out floor from the map container's REAL size.
// Separate from fitMapLayout so it can also run on every zoom/pan settle,
// orientation change and container resize (header/ticker height changes,
// mobile URL-bar collapse): the floor only helps if it tracks the container
// the user is actually looking at.
let _enforceGuard = false;
function enforceMinZoom() {
  if (_enforceGuard) return;
  _enforceGuard = true;
  try {
  if (!map || !map.setMinZoom) return;
  const layout = document.querySelector('.map-layout');
  if (!layout) return;
  const header = document.querySelector('.header');
  const ticker = document.querySelector('.capitals-ticker');
  const top = (header ? header.offsetHeight : 0) + (ticker ? ticker.offsetHeight : 0);
  const h = layout.clientHeight || window.innerHeight - top || 600;
  const minZ = minZoomForHeight(h);
  if (map.getMinZoom && map.getMinZoom() !== minZ) map.setMinZoom(minZ);
  // Force the view inside the allowed range explicitly (not relying on
  // Leaflet's setMinZoom auto-zoom): without this a URL like ?zoom=1, or a
  // floor raised after the map settled, would keep the map zoomed out into
  // the blank strips. animate:false so mobile pinch/pan settle instantly.
  if (map.getZoom() < minZ) {
    map.setView(map.getCenter(), minZ, { animate: false });
  }
  // The height floor only bounds the visible SPAN, not its POSITION — on a
  // tall viewport at low zoom the span can exceed 170°, so panning toward a
  // pole pushes the far edge past ±85° where the basemap and weather data
  // end, leaving the empty strip at the bottom (or top). Clamp the CENTER so
  // the whole visible latitude range stays inside ±85°: the weather then
  // covers the ENTIRE map with no void border, at every zoom.
  const span = (170.1 * h) / (256 * Math.pow(2, map.getZoom()));
  const maxCenter = Math.max(0, 85 - span / 2);
  const center = map.getCenter();
  if (center && Number.isFinite(center.lat) && map.panTo) {
    if (center.lat > maxCenter) map.panTo([maxCenter, center.lng], { animate: false });
    else if (center.lat < -maxCenter) map.panTo([-maxCenter, center.lng], { animate: false });
  }
  } finally { _enforceGuard = false; }
}

// Point the grid's active values at the requested layer (from the shared
// multi-layer payload) AND the selected timeline hour, then reshape them for
// sampling. No upstream call.
function applyLayerToGrid(grid, layerId) {
  const g = layerGroup(layerId);
  const h = grid.hour || 0;
  const arr = grid.fields && grid.fields[g];
  if (arr && arr[0] && Array.isArray(arr[0])) {
    // Per-location hourly arrays (timeline payload): pick the selected hour
    // and reshape into the 2D grid the tile sampler expects.
    grid.values = reshape(
      arr.map((locArr) => (locArr && locArr[h] != null ? locArr[h] : null)),
      grid.cols,
      grid.rows
    );
  } else if (arr) {
    grid.values = reshape(arr, grid.cols, grid.rows);
  }
  // Also reshape windDir for the current hour so arrow rendering stays in sync
  // with the timeline scrubber.
  if (grid._rawWindDir) {
    const wd = grid._rawWindDir;
    if (Array.isArray(wd[0])) {
      grid.windDir = reshape(
        wd.map((locArr) => (locArr && locArr[h] != null ? locArr[h] : null)),
        grid.cols,
        grid.rows
      );
    } else {
      grid.windDir = reshape(wd, grid.cols, grid.rows);
    }
  }
  grid.layer = layerId;
}

// One-shot retry after a rate limit — scheduled only when a limit actually
// happens, so no background timer keeps running (or blocking tests) otherwise.
function scheduleRetry(waitMs) {
  clearTimeout(retryTimer);
  const wait = Math.min(waitMs || RATE_LIMIT_RETRY_MS, 60 * 60 * 1000);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (rateLimitRetryAt && Date.now() >= rateLimitRetryAt) {
      rateLimitRetryAt = 0;
      refreshGrid(true);
    }
  }, wait);
}

// forceFetch bypasses the pan throttle: layer switches and rate-limit retries
// are explicit actions that must fetch right away, while pan/zoom refreshes are
// gated so continuous dragging cannot spam the upstream.
// The ENTIRE map is served from ONE full-world grid fetched once per session
// (OWM-style: a single global dataset — panning and zooming never reload it).
// Open-Meteo's multi-location API returns every point in one upstream call;
// the server caps the point count to its URL budget (~120 points) and bilinear
// sampling smooths that into a wash covering the whole world at any zoom.
const WORLD_BBOX = { north: 85, south: -85, west: -180, east: 180 };
const WORLD_GRID_COLS = 12;
const WORLD_GRID_ROWS = 12;
const WORLD_CACHE_KEY = 'world';

async function refreshGrid(forceFetch = false) {
  // No overlay means no data: with every layer deselected (OWM-style default)
  // the map is pure base geography and never needs a grid fetch.
  if (state.layer === null) return;

  try {
    // Once the full-world grid exists, EVERY viewport is served locally:
    // panning, zooming and layer switches never touch the upstream again.
    if (
      currentGrid &&
      currentGrid.fields &&
      currentGrid.fields[layerGroup(state.layer)]
    ) {
      applyLayerToGrid(currentGrid, state.layer);
      weatherLayer.redraw();
      buildTimeline();
      hideStatus();
      return;
    }

    const cacheKey = WORLD_CACHE_KEY;
    const cached = gridCache.get(cacheKey);
    if (cached) {
      if (cached.__error) {
        // Error entries live as long as the wait we scheduled, otherwise layer
        // switches re-trigger a fetch while the upstream is still refusing.
        const ttl = Math.max(cached.waitMs || 0, cached.rateLimited ? RATE_LIMIT_RETRY_MS : FAIL_TTL_MS);
        if (Date.now() - cached.t < ttl) {
          if (!currentGrid) showStatus(cached.statusMsg || 'Weather layer temporarily unavailable — retrying soon');
          return;
        }
        gridCache.delete(cacheKey);
      } else {
        currentGrid = cached;
        applyLayerToGrid(currentGrid, state.layer);
        weatherLayer.redraw();
        buildTimeline();
        hideStatus();
        return;
      }
    }

    // Throttle upstream calls while the user is actively panning/zooming.
    const wait = lastGridFetchAt + MIN_GRID_INTERVAL_MS - Date.now();
    if (!forceFetch && wait > 0) {
      showStatus('Loading weather…');
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshGrid, wait);
      return;
    }

    // Fetch the WHOLE map in one request. cols/rows hit the server's 12x12
    // cap; fitGridRequest scales the point count down to the URL budget.
    showStatus('Loading weather…');
    const params = new URLSearchParams({
      layer: state.layer,
      north: WORLD_BBOX.north,
      south: WORLD_BBOX.south,
      west: WORLD_BBOX.west,
      east: WORLD_BBOX.east,
      cols: WORLD_GRID_COLS,
      rows: WORLD_GRID_ROWS,
    });

    lastGridFetchAt = Date.now();
    const res = await fetch(`/api/map-grid?${params.toString()}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `HTTP ${res.status}`);
      if (body.retryAfter) err.retryAfter = body.retryAfter;
      throw err;
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // The server adapts the grid to its URL budget and quantizes the bbox, so
    // reshape with the dimensions it actually returned and store ITS bbox —
    // sampling against the requested bbox would displace the whole field.
    const rCols = data.cols || GRID_COLS;
    const rRows = data.rows || GRID_ROWS;
    const hours = data.hours && data.hours.length ? data.hours : null;
    // Timeline position: keep a pinned hour (user scrub / ?hour= URL) clamped
    // to the loaded window, otherwise default to the CURRENT time — the
    // OWM-style "now" position whenever a layer is turned on.
    if (hours) {
      if (state.hourPinned) {
        state.hour = Math.max(0, Math.min(state.hour, hours.length - 1));
      } else {
        state.hour = hourIndexForNow(hours);
        state.hourPinned = true;
      }
    } else {
      state.hour = 0;
    }
    const grid = {
      north: data.north != null ? data.north : WORLD_BBOX.north,
      south: data.south != null ? data.south : WORLD_BBOX.south,
      west: data.west != null ? data.west : WORLD_BBOX.west,
      east: data.east != null ? data.east : WORLD_BBOX.east,
      cols: rCols,
      rows: rRows,
      hours,
      hour: state.hour,
      // Every layer's field (per-location x per-hour arrays for the timeline;
      // layer switches reshape the active one locally, so one upstream call
      // serves all six layers across all hours).
      fields: data.fields || { [layerGroup(state.layer)]: data.values },
      windSpeed: data.windSpeed || null,
      // Store raw windDir (per-location x per-hour) so applyLayerToGrid can
      // reshape it when the timeline hour changes.
      _rawWindDir: data.windDir || null,
      windDir: null, // will be reshaped by applyLayerToGrid
      layer: state.layer,
    };
    applyLayerToGrid(grid, state.layer);
    currentGrid = grid;
    gridCache.set(WORLD_CACHE_KEY, grid);
    weatherLayer.redraw();
    buildTimeline();
    hideStatus();
  } catch (err) {
    const msg = String(err.message || err);
    const rateLimited = /503|429|rate\s*limit|too\s*many|minutely|hourly|daily/i.test(msg);
    // Hourly/daily windows are long: back off hard instead of hammering the
    // exhausted quota every minute. err.retryAfter comes from the server's
    // 503 body when it knows the window length.
    const hourly = /hourly|daily|next hour|tomorrow/i.test(msg);
    const waitMs = err && err.retryAfter ? err.retryAfter * 1000 : hourly ? HOURLY_RETRY_MS : RATE_LIMIT_RETRY_MS;
    const statusMsg = hourly
      ? 'Open-Meteo free-tier quota reached — retrying in ~10 minutes'
      : 'Weather data temporarily unavailable — retrying soon';
    gridCache.set(WORLD_CACHE_KEY, { __error: true, t: Date.now(), rateLimited, waitMs, statusMsg });
    if (rateLimited) {
      rateLimitRetryAt = Date.now() + waitMs;
      scheduleRetry(waitMs);
      showStatus(statusMsg);
    } else {
      showStatus(`Map data unavailable: ${msg}`);
    }
  }
}

function updateLegend() {
  // No layer selected: no legend (OWM-style plain base map).
  if (state.layer === null) {
    if (els.legend) els.legend.hidden = true;
    return;
  }
  els.legend.hidden = false;
  const def = getLayer(state.layer);
  // Wind speeds arrive in km/h from the grid; the legend can display them in
  // the app's chosen wind unit (km/h default, or m/s / kt from settings) like
  // OWM. The palette range and bar stay in km/h — only the tick labels convert.
  const isWind = state.layer === 'wind';
  const windUnit = isWind ? Settings.get('windUnit', 'kmh') : null;
  const toDisplay = isWind
    ? (kmh) => (windUnit === 'ms' ? kmh / 3.6 : windUnit === 'kt' ? kmh / 1.852 : kmh)
    : (v) => v;
  const unitLabel = isWind
    ? windUnit === 'ms'
      ? 'm/s'
      : windUnit === 'kt'
        ? 'kt'
        : 'km/h'
    : def.unit;

  const { min, max } = layerRange(state.layer);
  // Ticks: layers may declare exact positions (`ticks`), otherwise sample the
  // palette evenly. Each tick is placed proportionally so it sits under the
  // color it names.
  const tickVals = def.ticks || legendStops(state.layer, 7).map((s) => s.value);
  const ticks = tickVals
    .map((v) => {
      const t = max === min ? 0 : (v - min) / (max - min);
      const left = Math.max(0, Math.min(100, t * 100));
      return `<span class="map-legend__tick" style="left:${left.toFixed(1)}%">${formatTick(toDisplay(v), unitLabel)}</span>`;
    })
    .join('');

  els.legend.innerHTML = `
    <div class="map-legend__title">${t(`map.layer.${state.layer}`)} (${unitLabel})</div>
    <div class="map-legend__bar"></div>
    <div class="map-legend__ticks">${ticks}</div>`;

  // Collision-cull tick labels so dense legends (radar's low end) never
  // overflow into each other: keep the first label, then drop any label whose
  // rendered box would overlap the previous kept one. The bar itself always
  // shows the full gradient, so dropped numbers lose no information.
  let prevRight = -Infinity;
  els.legend.querySelectorAll('.map-legend__tick').forEach((s) => {
    const r = s.getBoundingClientRect();
    if (r.left < prevRight) s.style.display = 'none';
    else prevRight = r.right;
  });

  // Draw the bar from the SAME lookup table the tiles use, so the legend shows
  // exactly what the map paints. The old CSS linear-gradient interpolated
  // colors differently from the tile LUT (premultiplied vs straight alpha) —
  // most visible on radar, where the transparent low end turned into a dark
  // green in the bar while the map showed light green. Falls back to the CSS
  // gradient in headless environments without a 2D canvas context.
  const lut = buildLUT(state.layer, 256);
  const lutLen = lut.length / 4;
  const barW = 440;
  const barH = 24;
  const bar = document.createElement('canvas');
  bar.width = barW;
  bar.height = barH;
  const bctx = bar.getContext && bar.getContext('2d');
  if (bctx && bctx.createImageData) {
    const img = bctx.createImageData(barW, barH);
    for (let x = 0; x < barW; x++) {
      const li = Math.round((x / (barW - 1)) * (lutLen - 1)) | 0;
      const r = lut[li * 4];
      const g = lut[li * 4 + 1];
      const b = lut[li * 4 + 2];
      const a = lut[li * 4 + 3];
      for (let y = 0; y < barH; y++) {
        const idx = (y * barW + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = a;
      }
    }
    bctx.putImageData(img, 0, 0);
    els.legend.querySelector('.map-legend__bar').appendChild(bar);
  } else {
    const grad = legendStops(state.layer, 32)
      .map((s) => s.color)
      .join(',');
    els.legend.querySelector('.map-legend__bar').style.background = `linear-gradient(90deg, ${grad})`;
  }
}

function formatTick(v, unit) {
  const rounded = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${rounded}${unit === '°C' ? '°' : ''}`;
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set('layer', state.layer || 'none');
  p.set('basemap', state.basemap);
  const c = map.getCenter();
  p.set('lat', c.lat.toFixed(4));
  p.set('lon', c.lng.toFixed(4));
  p.set('zoom', String(map.getZoom()));
  if (state.layer && currentGrid && currentGrid.hours && currentGrid.hours.length) {
    p.set('hour', String(state.hour));
  }
  history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

function applyControlValues() {
  els.basemaps.querySelectorAll('[data-basemap]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.basemap === state.basemap)
  );
}

function showStatus(msg) {
  els.status.textContent = msg;
  els.status.hidden = false;
}
function hideStatus() {
  els.status.hidden = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
