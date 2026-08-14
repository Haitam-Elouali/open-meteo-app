// Main weather map controller. Architecture: a permanent geographic base map
// (OpenStreetMap or satellite) with exactly one transparent weather overlay tile
// layer above it. Changing the layer only swaps the overlay; the base stays.
import { LAYER_ORDER, getLayer } from './layers.js';
import { legendStops } from './palette.js';
import { reshape, expandBBox, clampBBox } from './grid.js';
import { createWeatherLayer } from './weather-layer.js';

const L = window.L;
const GRID_COLS = 16;
const GRID_ROWS = 16;
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
let weatherLayer;
let currentGrid = null;
let debounceTimer = null;

const els = {};

function init() {
  cacheEls();
  parseUrl();
  initMap();
  buildLayerButtons();
  bindControls();
  updateLegend();
  applyControlValues();
  refreshGrid();
  syncUrl();
}

function cacheEls() {
  els.layers = document.getElementById('map-layers');
  els.basemaps = document.getElementById('map-basemaps');
  els.legend = document.getElementById('map-legend');
  els.status = document.getElementById('map-status');
  els.panel = document.getElementById('map-panel');
  els.panelClose = document.getElementById('map-panel-close');
  els.panelOpen = document.getElementById('map-panel-open');
}

function parseUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('layer')) state.layer = p.get('layer');
  if (p.get('basemap')) state.basemap = p.get('basemap');
  if (p.get('lat')) state.lat = Number(p.get('lat'));
  if (p.get('lon')) state.lon = Number(p.get('lon'));
  if (p.get('zoom')) state.zoom = Number(p.get('zoom'));
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

  weatherLayer = createWeatherLayer(() => currentGrid, () => state.layer);
  weatherLayer.setOpacity(0.8);
  weatherLayer.addTo(map);

  map.on('moveend', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshGrid, DEBOUNCE_MS);
  });
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
  refreshGrid();
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
  weatherLayer.bringToFront();
  els.basemaps.querySelectorAll('[data-basemap]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.basemap === which)
  );
  syncUrl();
}

async function refreshGrid() {
  showStatus('Loading weather…');
  try {
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
    };
    if (data.windSpeed) grid.windSpeed = reshape(data.windSpeed, GRID_COLS, GRID_ROWS);
    if (data.windDir) grid.windDir = reshape(data.windDir, GRID_COLS, GRID_ROWS);
    currentGrid = grid;
    weatherLayer.redraw();
    hideStatus();
  } catch (err) {
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
