// Weather map controller. A permanent geographic base map (OpenStreetMap or
// satellite) with exactly one weather overlay above it.
//
// Weather source: OpenWeatherMap tile layers are used when an API key is
// configured (crisp, pre-rendered tiles — never blurry). If no key is set, the
// app falls back to Open-Meteo's grid endpoint so the map still works. Either
// way, changing the layer only swaps the overlay; the base map stays put.
import { LAYER_ORDER, getLayer } from './layers.js';
import { legendStops } from './palette.js';
import { reshape, expandBBox } from './grid.js';
import { createWeatherLayer } from './weather-layer.js';

const L = window.L;
const OWM_BASE = 'https://tile.openweathermap.org/map';

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

const GRID_COLS = 20;
const GRID_ROWS = 20;
const DEBOUNCE_MS = 350;

const state = {
  layer: 'temperature',
  basemap: 'map',
  lat: 31.63,
  lon: -8.0,
  zoom: 3,
};

let map;
let baseMapLayer;
let satelliteLayer;
let weatherLayer = null;
let weatherKind = null; // 'owm' | 'om'
let owmKey = '';
let usingOwm = false;
let currentGrid = null;
let debounceTimer = null;
const gridCache = new Map();
const FAIL_TTL_MS = 15000;

const els = {};

async function init() {
  cacheEls();
  parseUrl();
  await loadConfig();
  initMap();
  buildLayerButtons();
  bindControls();
  updateLegend();
  applyControlValues();
  fitMapLayout();
  window.addEventListener('resize', fitMapLayout);
  setWeatherLayer();
  syncUrl();
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

function initMap() {
  map = L.map('map', {
    center: [state.lat, state.lon],
    zoom: state.zoom,
    zoomControl: false,
  });

  baseMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  });
  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
  );

  (state.basemap === 'satellite' ? satelliteLayer : baseMapLayer).addTo(map);

  map.on('moveend', () => {
    syncUrl();
    if (!usingOwm) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshGrid, DEBOUNCE_MS);
    }
  });
}

// Decide which backend to use and (re)create the overlay for the active layer.
function setWeatherLayer() {
  if (owmKey) {
    usingOwm = true;
    setOwmLayer();
  } else {
    usingOwm = false;
    ensureOpenMeteoLayer();
  }
}

function setOwmLayer() {
  if (weatherLayer && weatherKind === 'owm') map.removeLayer(weatherLayer);
  const name = OWM_LAYERS[state.layer] || 'temp_new';
  const url = `${OWM_BASE}/${name}/{z}/{x}/{y}.png?appid=${encodeURIComponent(owmKey)}`;
  weatherLayer = L.tileLayer(url, {
    maxZoom: 18,
    opacity: 0.65,
    attribution: '&copy; OpenWeatherMap',
  });
  weatherKind = 'owm';
  hideStatus();
  weatherLayer.addTo(map);
  weatherLayer.bringToFront();
}

function ensureOpenMeteoLayer() {
  if (weatherLayer && weatherKind === 'om') {
    refreshGrid();
    return;
  }
  weatherLayer = createWeatherLayer(() => currentGrid, () => state.layer);
  weatherKind = 'om';
  weatherLayer.addTo(map);
  weatherLayer.bringToFront();
  refreshGrid();
}

function buildLayerButtons() {
  els.layers.innerHTML = '';
  LAYER_ORDER.forEach((id) => {
    const def = getLayer(id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-layer-btn' + (id === state.layer ? ' is-active' : '');
    btn.textContent = def.label;
    btn.dataset.layer = id;
    btn.addEventListener('click', () => setLayer(id));
    els.layers.appendChild(btn);
  });
}

function setLayer(id) {
  if (id === state.layer) return;
  state.layer = id;
  els.layers.querySelectorAll('.map-layer-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.layer === id)
  );
  updateLegend();
  if (usingOwm) setOwmLayer();
  else refreshGrid();
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
}

function setBasemap(which) {
  if (which === state.basemap) return;
  state.basemap = which;
  map.removeLayer(which === 'satellite' ? baseMapLayer : satelliteLayer);
  (which === 'satellite' ? satelliteLayer : baseMapLayer).addTo(map);
  if (weatherLayer) weatherLayer.bringToFront();
  els.basemaps.querySelectorAll('[data-basemap]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.basemap === which)
  );
  syncUrl();
}

function parseUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('layer')) state.layer = p.get('layer');
  if (p.get('basemap')) state.basemap = p.get('basemap');
  if (p.get('lat')) state.lat = Number(p.get('lat'));
  if (p.get('lon')) state.lon = Number(p.get('lon'));
  if (p.get('zoom')) state.zoom = Number(p.get('zoom'));
}

// Keep requested bounds within valid geographic ranges so we never send
// out-of-range coordinates to the weather API.
function clampBBox(b) {
  let north = Math.min(85, Math.max(-85, b.north));
  let south = Math.min(85, Math.max(-85, b.south));
  if (north < south) [north, south] = [south, north];
  let west = Math.max(-180, Math.min(180, b.west));
  let east = Math.max(-180, Math.min(180, b.east));
  if (west > east) [west, east] = [-180, 180];
  return { north, south, west, east };
}

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
}

// Validate the existing grid still covers a viewport (same layer) so we can skip
// a redundant, and potentially rate-limited, upstream request while panning.
function gridCovers(grid, bbox) {
  return (
    grid.north >= bbox.north &&
    grid.south <= bbox.south &&
    grid.west <= bbox.west &&
    grid.east >= bbox.east
  );
}

async function refreshGrid() {
  showStatus('Loading weather…');
  const b = map.getBounds();
  const bbox = expandBBox(
    clampBBox({
      north: b.getNorth(),
      south: b.getSouth(),
      west: b.getWest(),
      east: b.getEast(),
    }),
    0.3
  );

  const cacheKey = `${state.layer}:${bbox.north.toFixed(1)}:${bbox.south.toFixed(
    1
  )}:${bbox.west.toFixed(1)}:${bbox.east.toFixed(1)}`;

  try {
    const cached = gridCache.get(cacheKey);
    if (cached) {
      if (cached.__error) {
        if (Date.now() - cached.t < FAIL_TTL_MS) {
          showStatus('Weather layer temporarily unavailable — retrying soon');
          return;
        }
        gridCache.delete(cacheKey);
      } else {
        currentGrid = cached;
        weatherLayer.redraw();
        hideStatus();
        return;
      }
    }

    if (currentGrid && currentGrid.layer === state.layer && gridCovers(currentGrid, bbox)) {
      weatherLayer.redraw();
      hideStatus();
      return;
    }

    const params = new URLSearchParams({
      layer: state.layer,
      north: bbox.north.toFixed(4),
      south: bbox.south.toFixed(4),
      west: bbox.west.toFixed(4),
      east: bbox.east.toFixed(4),
      cols: GRID_COLS,
      rows: GRID_ROWS,
    });

    const res = await fetch(`/api/map-grid?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const grid = {
      north: bbox.north,
      south: bbox.south,
      west: bbox.west,
      east: bbox.east,
      cols: GRID_COLS,
      rows: GRID_ROWS,
      values: reshape(data.values, GRID_COLS, GRID_ROWS),
      layer: state.layer,
    };
    if (data.windSpeed) grid.windSpeed = reshape(data.windSpeed, GRID_COLS, GRID_ROWS);
    if (data.windDir) grid.windDir = reshape(data.windDir, GRID_COLS, GRID_ROWS);
    currentGrid = grid;
    gridCache.set(cacheKey, grid);
    weatherLayer.redraw();
    hideStatus();
  } catch (err) {
    gridCache.set(cacheKey, { __error: true, t: Date.now() });
    showStatus(`Map data unavailable: ${err.message}`);
  }
}

function updateLegend() {
  const stops = legendStops(state.layer, 7);
  const def = getLayer(state.layer);
  const grad = stops.map((s) => s.color).join(',');
  const ticks = stops.map((s) => formatTick(s.value, def.unit)).join('</span><span>');
  els.legend.innerHTML = `
    <div class="map-legend__title">${def.label} (${def.unit})</div>
    <div class="map-legend__bar" style="background:linear-gradient(90deg, ${grad})"></div>
    <div class="map-legend__ticks"><span>${ticks}</span></div>`;
}

function formatTick(v, unit) {
  const rounded = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${rounded}${unit === '°C' ? '°' : ''}`;
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set('layer', state.layer);
  p.set('basemap', state.basemap);
  const c = map.getCenter();
  p.set('lat', c.lat.toFixed(4));
  p.set('lon', c.lng.toFixed(4));
  p.set('zoom', String(map.getZoom()));
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
