import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { LAYERS, LAYER_ORDER, getLayer } from '../src/pages/map/layers.js';
import {
  colorAt,
  buildLUT,
  legendStops,
  valueToT,
  layerRange,
  parseColor,
} from '../src/pages/map/palette.js';
import {
  tileToLatLon,
  tileLatLngBounds,
  buildGridRequest,
  reshape,
  sampleGrid,
  expandBBox,
  normalizeLon,
} from '../src/pages/map/grid.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_HTML = path.join(__dirname, '..', 'src', 'pages', 'map', 'index.html');

// ---------- Layer definitions ----------
test('layer definitions are complete and ordered', () => {
  assert.equal(LAYER_ORDER.length, 6);
  for (const id of LAYER_ORDER) {
    const def = getLayer(id);
    assert.ok(def.stops.length >= 2, `${id} needs >=2 stops`);
    assert.ok(def.unit, `${id} needs a unit`);
  }
  assert.equal(getLayer('temperature').variable, 'temperature_2m');
});

// ---------- Palette ----------
test('parseColor handles hex and rgba', () => {
  assert.deepEqual(parseColor('#ff0000'), { r: 255, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseColor('rgba(0,0,0,0)'), { r: 0, g: 0, b: 0, a: 0 });
});

test('colorAt interpolates within palette range', () => {
  const c = colorAt('temperature', 0);
  assert.ok(c.r >= 0 && c.r <= 255);
  // extremes clamp
  const low = colorAt('temperature', -100);
  const high = colorAt('temperature', 100);
  assert.deepEqual(low, colorAt('temperature', -40));
  assert.deepEqual(high, colorAt('temperature', 40));
});

test('valueToT maps range to 0..1', () => {
  const { min, max } = layerRange('temperature');
  assert.ok(Math.abs(valueToT('temperature', min) - 0) < 1e-9);
  assert.ok(Math.abs(valueToT('temperature', max) - 1) < 1e-9);
  assert.ok(Math.abs(valueToT('temperature', (min + max) / 2) - 0.5) < 1e-9);
});

test('buildLUT returns RGBA bytes of expected length', () => {
  const lut = buildLUT('temperature', 1024);
  assert.equal(lut.length, 1024 * 4);
  for (let i = 0; i < lut.length; i++) assert.ok(lut[i] >= 0 && lut[i] <= 255);
});

test('legendStops returns the requested count with colors', () => {
  for (const id of LAYER_ORDER) {
    const stops = legendStops(id, 7);
    assert.equal(stops.length, 7);
    for (const s of stops) assert.match(s.color, /^rgba\(/);
  }
});

// ---------- Grid math ----------
test('tileToLatLon / tileLatLngBounds for root tile', () => {
  const tl = tileToLatLon(0, 0, 0);
  assert.ok(Math.abs(tl.lon + 180) < 1e-6);
  assert.ok(tl.lat > 80); // ~85.05
  const b = tileLatLngBounds(2, 0, 0);
  assert.ok(b.north > b.south);
  assert.ok(b.east > b.west);
});

test('buildGridRequest produces row-major points and reshape round-trips', () => {
  const bbox = { north: 40, south: 30, west: -10, east: 0 };
  const { lats, lons, cols, rows } = buildGridRequest(bbox, 4, 3);
  assert.equal(lats.length, 12);
  assert.equal(cols * rows, 12);
  const flat = Array.from({ length: 12 }, (_, i) => i);
  const grid = reshape(flat, cols, rows);
  assert.equal(grid[0][0], 0);
  assert.equal(grid[2][3], 11);
});

test('sampleGrid bilinear averages corners', () => {
  const grid = {
    north: 40,
    south: 0,
    west: 0,
    east: 40,
    cols: 2,
    rows: 2,
    values: [
      [0, 10],
      [0, 10],
    ],
  };
  assert.equal(sampleGrid(grid, 20, 20), 5); // center of a constant-x gradient
  assert.equal(sampleGrid(grid, 40, 0), 0); // top-left corner
  assert.equal(sampleGrid(grid, 0, 40), 10); // bottom-right corner
});

test('expandBBox and normalizeLon helpers', () => {
  const eb = expandBBox({ north: 10, south: 0, west: 0, east: 10 }, 0.5);
  assert.ok(eb.north > 10 && eb.south < 0 && eb.west < 0 && eb.east > 10);
  assert.equal(normalizeLon(190), -170);
  assert.equal(normalizeLon(-190), 170);
});

// ---------- Page structure (jsdom) ----------
test('map page contains required controls and hide/reopen wiring', () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  assert.ok(doc.getElementById('map'), 'map canvas missing');
  assert.ok(doc.getElementById('map-layers'), 'layer container missing');
  assert.ok(doc.getElementById('map-panel'), 'control panel missing');
  assert.ok(doc.getElementById('map-panel-close'), 'panel close button missing');
  assert.ok(doc.getElementById('map-panel-open'), 'panel reopen button missing');
  assert.ok(doc.getElementById('map-legend'), 'legend missing');
  assert.equal(doc.querySelectorAll('[data-basemap]').length, 2, 'need 2 basemap options');
  // Removed controls must be gone.
  assert.equal(doc.getElementById('opacity-slider'), null, 'opacity slider should be removed');
  assert.equal(doc.getElementById('time-slider'), null, 'time slider should be removed');
  assert.equal(doc.getElementById('cities-toggle'), null, 'cities toggle should be removed');
  assert.equal(doc.getElementById('map-search'), null, 'search should be removed');
  assert.ok(doc.querySelector('script[src*="leaflet"]'), 'leaflet script missing');
  assert.ok(doc.querySelector('script[src*="map.js"]'), 'map.js module missing');
  assert.ok(doc.querySelector('a.header__nav-link[href="/map"]'), 'map nav link missing');
});

// ---------- Performance benchmark ----------
test('performance: grid sampling and LUT build are fast', () => {
  const cols = 64;
  const rows = 64;
  const grid = {
    north: 70,
    south: -70,
    west: -180,
    east: 180,
    cols,
    rows,
    values: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() * 50 - 10)
    ),
  };

  // Benchmark bilinear sampling across many tile pixels.
  const N = 300000;
  const start = process.hrtime.bigint();
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const lat = -70 + Math.random() * 140;
    const lon = -180 + Math.random() * 360;
    const v = sampleGrid(grid, lat, lon);
    if (v != null) acc += v;
  }
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const opsPerSec = N / (elapsedMs / 1000);
  console.log(
    `[bench] sampleGrid: ${N} samples in ${elapsedMs.toFixed(1)}ms => ${Math.round(
      opsPerSec
    ).toLocaleString()} samples/sec`
  );
  assert.ok(elapsedMs < 2000, `sampling too slow: ${elapsedMs.toFixed(1)}ms`);

  // Benchmark LUT building for every layer.
  const lutStart = process.hrtime.bigint();
  for (let r = 0; r < 50; r++) for (const id of LAYER_ORDER) buildLUT(id, 1024);
  const lutMs = Number(process.hrtime.bigint() - lutStart) / 1e6;
  console.log(`[bench] buildLUT x${LAYER_ORDER.length * 50} in ${lutMs.toFixed(1)}ms`);
  assert.ok(lutMs < 500, `LUT build too slow: ${lutMs.toFixed(1)}ms`);
});
