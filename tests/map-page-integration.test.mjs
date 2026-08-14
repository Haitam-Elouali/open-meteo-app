import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_HTML = path.join(__dirname, '..', 'src', 'pages', 'map', 'index.html');

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
  };
  return {
    map() { return map; },
    tileLayer() {
      return { addTo() { return this; } };
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
  };
}

function fakeGridFor(url) {
  const p = new URL(url, 'http://localhost/');
  const layer = p.searchParams.get('layer') || 'temperature';
  const cols = Number(p.searchParams.get('cols')) || 16;
  const rows = Number(p.searchParams.get('rows')) || 16;
  const values = Array.from({ length: cols * rows }, (_, i) => (i % 7) - 3 + 15);
  const out = { layer, cols, rows, values };
  if (layer === 'wind') {
    out.windSpeed = Array.from({ length: cols * rows }, () => 10);
    out.windDir = Array.from({ length: cols * rows }, () => 200);
  }
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
  assert.ok(doc.querySelector('.map-layer-btn.is-active'), 'one layer is active');
  assert.ok(doc.getElementById('map-legend').textContent.length > 0, 'legend populated');
  assert.ok(
    fetchCalls.some((u) => u.includes('/api/map-grid')),
    'initial grid fetch happened'
  );
});

test('layer switch triggers a new grid fetch with the chosen layer', async () => {
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
  const precip = [...doc.querySelectorAll('.map-layer-btn')].find(
    (b) => b.dataset.layer === 'precipitation'
  );
  assert.ok(precip, 'precipitation button exists');
  precip.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(
    fetchCalls.some((u) => u.includes('layer=precipitation')),
    'fetch for precipitation happened after switch'
  );
  assert.ok(precip.classList.contains('is-active'), 'precipitation button now active');
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

  const panel = doc.getElementById('map-panel');
  const openBtn = doc.getElementById('map-panel-open');
  doc.getElementById('map-panel-close').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(panel.hidden, true, 'panel hidden after close');
  assert.equal(openBtn.hidden, false, 'reopen button shown after close');

  openBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(panel.hidden, false, 'panel shown again');
  assert.equal(openBtn.hidden, true, 'reopen button hidden again');
});
