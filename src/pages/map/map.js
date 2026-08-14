// Main weather map controller. Architecture: a permanent geographic base map
// (OpenStreetMap or satellite) with exactly one transparent weather overlay tile
// layer above it. Changing the layer only swaps the overlay; the base stays.
import { LAYER_ORDER, getLayer } from './layers.js';
import { legendStops } from './palette.js';
import { reshape, expandBBox } from './grid.js';
import { createWeatherLayer } from './weather-layer.js';

const L = window.L;
const GRID_COLS = 32;
const GRID_ROWS = 32;
const DEBOUNCE_MS = 350;

const state = {
  layer: 'temperature',
  basemap: 'map',
  opacity: 0.8,
  cities: true,
  timeHours: 0,
  lat: 31.63,
  lon: -8.0,
  zoom: 3,
};

let map;
let baseMapLayer;
let satelliteLayer;
let weatherLayer;
let currentGrid = null;
let citiesGroup = null;
let citiesLoaded = false;
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
  if (state.cities) loadCities();
  syncUrl();
}

function cacheEls() {
  els.layers = document.getElementById('map-layers');
  els.basemaps = document.getElementById('map-basemaps');
  els.opacity = document.getElementById('opacity-slider');
  els.opacityValue = document.getElementById('opacity-value');
  els.time = document.getElementById('time-slider');
  els.timeValue = document.getElementById('time-value');
  els.citiesToggle = document.getElementById('cities-toggle');
  els.search = document.getElementById('map-search');
  els.searchResults = document.getElementById('map-search-results');
  els.share = document.getElementById('map-share');
  els.legend = document.getElementById('map-legend');
  els.status = document.getElementById('map-status');
}

function parseUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('layer')) state.layer = p.get('layer');
  if (p.get('basemap')) state.basemap = p.get('basemap');
  if (p.get('opacity')) state.opacity = clamp(Number(p.get('opacity')), 0, 1);
  if (p.get('cities') !== null) state.cities = p.get('cities') === 'true';
  if (p.get('time')) state.timeHours = Number(p.get('time')) || 0;
  if (p.get('lat')) state.lat = Number(p.get('lat'));
  if (p.get('lon')) state.lon = Number(p.get('lon'));
  if (p.get('zoom')) state.zoom = Number(p.get('zoom'));
}

function initMap() {
  map = L.map('map', { center: [state.lat, state.lon], zoom: state.zoom, zoomControl: true });

  baseMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  });
  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
  );

  (state.basemap === 'satellite' ? satelliteLayer : baseMapLayer).addTo(map);

  weatherLayer = createWeatherLayer(
    () => currentGrid,
    () => state.layer
  );
  weatherLayer.setOpacity(state.opacity);
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

  els.opacity.addEventListener('input', () => {
    state.opacity = Number(els.opacity.value) / 100;
    weatherLayer.setOpacity(state.opacity);
    els.opacityValue.textContent = `${els.opacity.value}%`;
    syncUrl();
  });

  els.time.addEventListener('input', () => {
    state.timeHours = Number(els.time.value);
    els.timeValue.textContent = timeLabel(state.timeHours);
    refreshGrid();
    syncUrl();
  });

  els.citiesToggle.addEventListener('change', () => {
    state.cities = els.citiesToggle.checked;
    if (state.cities) loadCities();
    else clearCities();
    syncUrl();
  });

  els.share.addEventListener('click', shareLink);

  els.search.addEventListener('input', debounce(runSearch, 300));
  els.searchResults.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-lat]');
    if (!li) return;
    const lat = Number(li.dataset.lat);
    const lon = Number(li.dataset.lon);
    map.setView([lat, lon], Math.max(map.getZoom(), 6));
    els.search.value = '';
    els.searchResults.innerHTML = '';
    refreshGrid();
  });
}

function setBasemap(which) {
  if (which === state.basemap) return;
  state.basemap = which;
  map.removeLayer(state.basemap === 'satellite' ? baseMapLayer : satelliteLayer);
  (which === 'satellite' ? satelliteLayer : baseMapLayer).addTo(map);
  // keep weather overlay on top
  weatherLayer.bringToFront();
  els.basemaps.querySelectorAll('[data-basemap]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.basemap === which)
  );
  syncUrl();
}

function timeLabel(h) {
  if (h <= 0) return 'Now';
  return `+${h}h`;
}

function currentDateUnix() {
  if (state.timeHours <= 0) return null;
  return Math.floor(Date.now() / 1000) + state.timeHours * 3600;
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
    const date = currentDateUnix();
    const params = new URLSearchParams({
      layer: state.layer,
      north: bbox.north.toFixed(4),
      south: bbox.south.toFixed(4),
      west: bbox.west.toFixed(4),
      east: bbox.east.toFixed(4),
      cols: GRID_COLS,
      rows: GRID_ROWS,
    });
    if (date) params.set('date', String(date));

    const res = await fetch(`/api/map-grid?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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

async function loadCities() {
  if (citiesLoaded) {
    showCities();
    return;
  }
  try {
    const res = await fetch('/api/capitals-weather');
    const data = await res.json();
    const capitals = data.capitals || [];
    citiesGroup = L.layerGroup();
    capitals.forEach((c) => {
      if (c.temperature == null) return;
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-city-marker"><span>${escapeHtml(c.capital)}</span><strong>${Math.round(
          c.temperature
        )}°</strong></div>`,
        iconSize: [120, 28],
        iconAnchor: [60, 14],
      });
      L.marker([c.lat, c.lon], { icon }).addTo(citiesGroup);
    });
    citiesLoaded = true;
    showCities();
  } catch (err) {
    showStatus(`Cities unavailable: ${err.message}`);
  }
}

function showCities() {
  if (citiesGroup && !map.hasLayer(citiesGroup)) citiesGroup.addTo(map);
}
function clearCities() {
  if (citiesGroup && map.hasLayer(citiesGroup)) map.removeLayer(citiesGroup);
}

async function runSearch() {
  const q = els.search.value.trim();
  if (q.length < 2) {
    els.searchResults.innerHTML = '';
    return;
  }
  try {
    const res = await fetch(`/api/location?city=${encodeURIComponent(q)}`);
    const data = await res.json();
    const results = (data.results || []).slice(0, 8);
    els.searchResults.innerHTML = results
      .map(
        (r) =>
          `<li data-lat="${r.latitude}" data-lon="${r.longitude}">${escapeHtml(
            r.name
          )}, ${escapeHtml(r.country || '')}</li>`
      )
      .join('');
  } catch {
    els.searchResults.innerHTML = '';
  }
}

function shareLink() {
  syncUrl();
  const url = location.origin + location.pathname + location.search;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => showStatus('Share link copied to clipboard'),
      () => showStatus(url)
    );
  } else {
    showStatus(url);
  }
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set('layer', state.layer);
  p.set('basemap', state.basemap);
  p.set('opacity', String(Math.round(state.opacity * 100)));
  p.set('cities', String(state.cities));
  p.set('time', String(state.timeHours));
  const c = map.getCenter();
  p.set('lat', c.lat.toFixed(4));
  p.set('lon', c.lng.toFixed(4));
  p.set('zoom', String(map.getZoom()));
  history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

function applyControlValues() {
  els.opacity.value = Math.round(state.opacity * 100);
  els.opacityValue.textContent = `${els.opacity.value}%`;
  els.time.value = state.timeHours;
  els.timeValue.textContent = timeLabel(state.timeHours);
  els.citiesToggle.checked = state.cities;
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

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function clampBBox(b) {
  let north = Math.min(85, Math.max(-85, b.north));
  let south = Math.min(85, Math.max(-85, b.south));
  if (north < south) [north, south] = [south, north];
  let west = Math.max(-180, Math.min(180, b.west));
  let east = Math.max(-180, Math.min(180, b.east));
  if (west > east) [west, east] = [-180, 180];
  return { north, south, west, east };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
