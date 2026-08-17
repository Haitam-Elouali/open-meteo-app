import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_HTML = path.join(__dirname, '..', 'src', 'pages', 'map', 'index.html');

// The map page loads /components/settings.js before map.js (it backs every
// persisted preference). In jsdom we stub the shared Settings module so the
// import behaves like the browser: defaults flow through, writes are no-ops.
global.Settings = {
  get: (_key, fallback) => fallback,
  set: () => {},
  getBool: (_key, fallback) => fallback,
};

// ---- Fake Leaflet ----
function makeFakeL() {
  const map = {
    setView() { return this; },
    getBounds() {
      return {
        getNorth: () => 60,
        getSouth: () => -30,
        getWest: () => -40,
        getEast: () => 150,
      };
    },
    on() { return this; },
    getCenter() { return { lat: 31.6, lng: -8.0 }; },
    getZoom() { return 3; },
    hasLayer() { return false; },
    removeLayer() { return this; },
    addLayer() { return this; },
    bringToFront() { return this; },
    fitBounds() { return this; },
    getContainer() {
      if (!this._container) {
        this._container = window.document.createElement('div');
      }
      return this._container;
    },
    createPane(name) {
      this._panes = this._panes || {};
      if (!this._panes[name]) {
        const el = window.document.createElement('div');
        el.className = 'leaflet-pane leaflet-' + name + '-pane';
        el.style = {};
        this._panes[name] = el;
      }
      return this._panes[name];
    },
    getPane(name) {
      return this._panes && this._panes[name] ? this._panes[name] : this.createPane(name);
    },
  };
  return {
    map() { return map; },
    tileLayer() {
      return {
        addTo() { return this; },
        bringToFront() { return this; },
      };
    },
    GridLayer: {
      extend(spec) {
        return function Layer() {
          Object.assign(this, spec);
          this.setOpacity = () => {};
          this.addTo = () => this;
          this.redraw = () => {};
          this.bringToFront = () => {};
        };
      },
    },
    layerGroup() { return { addTo() { return this; } }; },
    divIcon() { return {}; },
    marker() { return { addTo() { return this; } }; },
    // initMap builds a lat-only maxBounds for the drag clamp.
    latLng(lat, lng) { return { lat, lng }; },
    latLngBounds(a, b) {
      return { getNorthEast: () => b, getSouthWest: () => a };
    },
  };
}

const HOURS = [
  '2026-08-16T00:00',
  '2026-08-16T03:00',
  '2026-08-16T06:00',
  '2026-08-16T09:00',
  '2026-08-16T12:00',
  '2026-08-16T15:00',
  '2026-08-16T18:00',
  '2026-08-16T21:00',
];

function fakeGridFor(url) {
  const p = new URL(url, 'http://localhost/');
  const layer = p.searchParams.get('layer') || 'temperature';
  const cols = Number(p.searchParams.get('cols')) || 16;
  const rows = Number(p.searchParams.get('rows')) || 16;
  const n = cols * rows;
  const byHour = (mk) => Array.from({ length: n }, (_, i) => HOURS.map((_, h) => mk(i, h)));
  const fields = {
    temperature: byHour((i, h) => (i % 7) - 3 + 15 + h),
    precipitation: byHour((i, h) => (i % 5) / 2 + h * 0.1),
    clouds: byHour((i, h) => (i % 10) * 10 + h),
    pressure: byHour((i, h) => 1000 + (i % 20) + h),
    wind: byHour((i, h) => 10 + h),
  };
  const group = layer === 'radar' ? 'precipitation' : layer;
  const out = {
    layer,
    cols,
    rows,
    values: (fields[group] || fields.temperature).map((loc) => loc[0]),
    fields,
    hours: HOURS,
    windSpeed: byHour(() => 10),
    windDir: byHour(() => 200),
  };
  return out;
}

test('map.js loads and runs init without errors', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();

  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return { ok: true, json: async () => fakeGridFor(url) };
  };

  // Import the module (init runs on import since readyState is 'complete').
  await import('../src/pages/map/map.js?' + Date.now());
  // give async refreshGrid a chance to resolve
  await new Promise((r) => setTimeout(r, 30));

  const doc = window.document;
  const layerBtns = doc.querySelectorAll('.map-layer-btn');
  assert.equal(layerBtns.length, 6, 'six layer buttons should be built');
  // OWM-style: no weather layer is selected by default — plain base map.
  assert.equal(doc.querySelectorAll('.map-layer-btn.is-active').length, 0, 'no layer active by default');
  assert.equal(doc.getElementById('map-legend').hidden, true, 'legend hidden with no layer');
  assert.equal(
    fetchCalls.some((u) => u.includes('/api/map-grid')),
    false,
    'no grid fetch until a layer is selected'
  );

  // Selecting a layer fetches the adaptive world-view grid and shows the legend.
  [...layerBtns]
    .find((b) => b.dataset.layer === 'temperature')
    .dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 30));
  const gridUrl = fetchCalls.find((u) => u.includes('/api/map-grid'));
  assert.ok(gridUrl, 'layer selection fetches the grid');
  const g = new URL(gridUrl, 'http://localhost/').searchParams;
  // One fetch covers the ENTIRE map (OWM-style global dataset): full-world
  // bbox at the server's max grid, so pan/zoom never refetches.
  assert.equal(g.get('north'), '85', 'world fetch spans the full latitude');
  assert.equal(g.get('south'), '-85', 'world fetch spans the full latitude');
  assert.equal(g.get('west'), '-180', 'world fetch spans the full longitude');
  assert.equal(g.get('east'), '180', 'world fetch spans the full longitude');
  assert.equal(g.get('cols'), '12', 'world fetch requests the max grid cols');
  assert.equal(g.get('rows'), '12', 'world fetch requests the max grid rows');
  assert.equal(doc.getElementById('map-legend').hidden, false, 'legend shown once a layer is active');
});

test('layer switch is served from the multi-layer grid (no new fetch)', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();

  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return { ok: true, json: async () => fakeGridFor(url) };
  };

  await import('../src/pages/map/map.js?' + Date.now());
  await new Promise((r) => setTimeout(r, 20));

  const doc = window.document;
  const gridFetches = () => fetchCalls.filter((u) => u.includes('/api/map-grid')).length;
  assert.equal(gridFetches(), 0, 'no grid fetch on init (no layer selected)');

  const precip = [...doc.querySelectorAll('.map-layer-btn')].find(
    (b) => b.dataset.layer === 'precipitation'
  );
  assert.ok(precip, 'precipitation button exists');
  precip.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(gridFetches(), 1, 'selecting a layer fetches the multi-layer grid');
  assert.ok(precip.classList.contains('is-active'), 'precipitation button now active');

  // Every layer in the order is served from the same cached payload.
  for (const id of ['radar', 'clouds', 'pressure', 'wind']) {
    [...doc.querySelectorAll('.map-layer-btn')]
      .find((b) => b.dataset.layer === id)
      .dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(gridFetches(), 1, 'all six layers served from one fetch');
});

test('wind layer has no Wind/Gusts field toggle (removed)', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();
  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return { ok: true, json: async () => fakeGridFor(url) };
  };

  await import('../src/pages/map/map.js?' + Date.now());
  await new Promise((r) => setTimeout(r, 20));

  const doc = window.document;
  // The Wind/Gusts "Wind field" option is gone entirely.
  assert.equal(doc.getElementById('map-wind-mode-section'), null, 'wind mode section removed');
  assert.equal(doc.querySelector('[data-windmode]'), null, 'no wind-mode buttons');

  // Selecting the wind layer still works and still fetches one grid payload.
  [...doc.querySelectorAll('.map-layer-btn')]
    .find((b) => b.dataset.layer === 'wind')
    .dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const gridCount = () => fetchCalls.filter((u) => u.includes('/api/map-grid')).length;
  assert.equal(gridCount(), 1, 'one grid fetch for the wind layer');
});

test('timeline shows an OWM-style scrubber; switching hours never refetches', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();
  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return { ok: true, json: async () => fakeGridFor(url) };
  };

  await import('../src/pages/map/map.js?' + Date.now());
  await new Promise((r) => setTimeout(r, 30));

  const doc = window.document;
  const timeline = doc.getElementById('map-timeline');
  assert.ok(timeline, 'timeline element exists');
  assert.equal(timeline.hidden, true, 'timeline hidden until a layer is selected');

  // Select a layer so the (single) grid payload loads with its hours.
  [...doc.querySelectorAll('.map-layer-btn')]
    .find((b) => b.dataset.layer === 'temperature')
    .dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(timeline.hidden, false, 'timeline shown once a layer (with hours) loads');

  const slider = doc.getElementById('map-timeline-slider');
  assert.ok(slider, 'scrubber slider exists');
  assert.equal(Number(slider.max), 7, 'slider max = hours-1');
  const time = doc.getElementById('map-timeline-time');
  assert.ok(time.textContent.includes('2026-08-16'), 'timestamp displayed');

  // OWM-style default: the timeline starts at the CURRENT time, not hour 0.
  const now = Date.now();
  let nearest = 0;
  let bestDist = Infinity;
  HOURS.forEach((h, i) => {
    const t = new Date(h).getTime();
    const d = Math.abs(t - now);
    if (d < bestDist) {
      bestDist = d;
      nearest = i;
    }
  });
  assert.equal(Number(slider.value), nearest, 'timeline defaults to the current time');

  const gridCount = () => fetchCalls.filter((u) => u.includes('/api/map-grid')).length;
  assert.equal(gridCount(), 1, 'one grid fetch on layer selection');

  // Scrub to hour 3 — pure client-side.
  slider.value = '3';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(Number(slider.value), 3, 'slider tracks the selection');
  assert.equal(gridCount(), 1, 'scrubbing the timeline never fetches');

  // Next/prev step by 3 hours.
  doc.getElementById('map-timeline-next').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(Number(slider.value), 6, 'next steps forward 3h');
  doc.getElementById('map-timeline-prev').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(Number(slider.value), 3, 'prev steps back 3h');
  assert.equal(gridCount(), 1, 'step buttons never fetch');
});

test('basemap toggle and panel hide/reopen work', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();
  global.fetch = async (url) => ({ ok: true, json: async () => fakeGridFor(url) });

  await import('../src/pages/map/map.js?' + Date.now());
  await new Promise((r) => setTimeout(r, 20));

  const doc = window.document;
  const sat = doc.querySelector('[data-basemap="satellite"]');
  sat.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(sat.classList.contains('is-active'), 'satellite basemap active after click');

  const panel = doc.getElementById('map-modal');
  const openBtn = doc.getElementById('map-panel-open');
  doc.getElementById('map-panel-close').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(panel.hidden, true, 'panel hidden after close');
  assert.equal(openBtn.hidden, false, 'reopen button shown after close');

  openBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(panel.hidden, false, 'panel shown again');
  assert.equal(openBtn.hidden, true, 'reopen button hidden again');
});

test('toggling layers back and forth never refetches the grid', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();
  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return { ok: true, json: async () => fakeGridFor(url) };
  };

  await import('../src/pages/map/map.js?' + Date.now());
  await new Promise((r) => setTimeout(r, 20));

  const doc = window.document;
  const clickLayer = (id) =>
    [...doc.querySelectorAll('.map-layer-btn')]
      .find((b) => b.dataset.layer === id)
      .dispatchEvent(new window.Event('click', { bubbles: true }));

  const gridCount = () => fetchCalls.filter((u) => u.includes('/api/map-grid')).length;
  assert.equal(gridCount(), 0, 'no fetch on init (no layer selected)');

  clickLayer('precipitation');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gridCount(), 1, 'first layer selection fetches the grid');

  clickLayer('temperature');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gridCount(), 1, 'no refetch switching away');

  clickLayer('precipitation');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gridCount(), 1, 'no refetch switching back');
});

test('clicking the active layer deselects it (OWM-style toggle back to the base map)', async () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/map', pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
  Object.defineProperty(globalThis, 'history', { value: window.history, configurable: true });
  window.L = makeFakeL();
  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    return { ok: true, json: async () => fakeGridFor(url) };
  };

  await import('../src/pages/map/map.js?' + Date.now());
  await new Promise((r) => setTimeout(r, 20));

  const doc = window.document;
  const clickLayer = (id) =>
    [...doc.querySelectorAll('.map-layer-btn')]
      .find((b) => b.dataset.layer === id)
      .dispatchEvent(new window.Event('click', { bubbles: true }));
  const activeCount = () => doc.querySelectorAll('.map-layer-btn.is-active').length;
  const gridCount = () => fetchCalls.filter((u) => u.includes('/api/map-grid')).length;

  clickLayer('temperature');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(activeCount(), 1, 'layer active after selection');
  assert.equal(doc.getElementById('map-legend').hidden, false, 'legend shown');
  assert.equal(doc.getElementById('map-timeline').hidden, false, 'timeline shown');
  assert.equal(gridCount(), 1, 'one fetch on selection');

  // Deselect: clicking the active layer returns to the plain base map.
  clickLayer('temperature');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(activeCount(), 0, 'no layer active after deselect');
  assert.equal(doc.getElementById('map-legend').hidden, true, 'legend hidden');
  assert.equal(doc.getElementById('map-timeline').hidden, true, 'timeline hidden');
  assert.equal(gridCount(), 1, 'deselect never fetches');

  // Re-selecting resets the timeline to the current time, served from cache.
  clickLayer('temperature');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(activeCount(), 1, 'layer active again');
  assert.equal(doc.getElementById('map-legend').hidden, false, 'legend shown again');
  assert.equal(doc.getElementById('map-timeline').hidden, false, 'timeline shown again');
  assert.equal(gridCount(), 1, 're-select is served from cache (no fetch)');
  const now = Date.now();
  let nearest = 0;
  let bestDist = Infinity;
  HOURS.forEach((h, i) => {
    const t = new Date(h).getTime();
    const d = Math.abs(t - now);
    if (d < bestDist) {
      bestDist = d;
      nearest = i;
    }
  });
  assert.equal(Number(doc.getElementById('map-timeline-slider').value), nearest, 'timeline resets to the current time');
});

