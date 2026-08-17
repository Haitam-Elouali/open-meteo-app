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
  minZoomForHeight,
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

test('precipitation/radar render as light colors at low rain, not dark smudges', () => {
  // The old palette interpolated from black, so 0.2-1mm rain came out as a
  // dark patch. Light rain must stay light (high R channel, low darkness).
  const light = colorAt('precipitation', 0.2);
  assert.ok(light.r > 100, `precipitation 0.2mm should be light blue, got r=${light.r}`);
  assert.ok(light.g > 150, `precipitation 0.2mm should be light blue, got g=${light.g}`);
  assert.ok(light.a > 0.5, 'light rain should be clearly visible');
  const zero = colorAt('precipitation', 0);
  assert.equal(zero.a, 0, 'no rain stays fully transparent');

  // Radar is in dBZ: 20 dBZ (light rain) is green, drizzle below ~15 dBZ
  // stays transparent, and zero rain is fully transparent.
  const radar = colorAt('radar', 20);
  assert.ok(radar.g > 150, `radar 20 dBZ should be green, got g=${radar.g}`);
  assert.ok(radar.r < radar.g, 'radar low value should be green-dominant');
  // Below the 15 dBZ stop the wash fades from transparent to light green;
  // drizzle is still faint green, never a dark smudge.
  const drizzle = colorAt('radar', 10);
  assert.ok(drizzle.g > drizzle.r && drizzle.g > drizzle.b, 'drizzle below 15 dBZ should be faint green');
  const radarZero = colorAt('radar', 0);
  assert.equal(radarZero.a, 0, 'radar with no rain stays transparent');
});

test('radar converts mm/h to dBZ reflectivity like real radar maps', () => {
  const t = getLayer('radar').transform;
  assert.ok(t, 'radar layer declares a transform');
  // Z-R relation: dBZ = 10*log10(200*R^1.6). 1 mm/h ≈ 23 dBZ.
  assert.ok(Math.abs(t(1) - 10 * Math.log10(200)) < 0.01, `t(1mm) ≈ 23 dBZ, got ${t(1)}`);
  assert.ok(t(5) > t(1) && t(10) > t(5), 'transform is monotonic in rain rate');
  assert.equal(t(0), -Infinity, 'no rain maps to no reflectivity');
});

test('precipitation is a pure blue scale like OpenWeatherMap (no purple top)', () => {
  // OWM's classic rain ramps pale blue -> deep royal blue; the old palette
  // turned purple at the top, which no weather map shows for rain.
  for (const v of [1, 5, 25]) {
    const c = colorAt('precipitation', v);
    assert.ok(c.b > c.r && c.b > c.g, `precipitation at ${v}mm should be blue-dominant, got rgb(${c.r},${c.g},${c.b})`);
  }
});

test('radar follows the classic reflectivity rainbow (green -> yellow -> orange -> red -> magenta)', () => {
  // The NWS/RainViewer/Windy reflectivity scale in dBZ: green for light rain,
  // warming through yellow/orange, red for heavy rain, magenta for extreme.
  const low = colorAt('radar', 22); // ~green (light rain, 20-25 dBZ)
  const mid = colorAt('radar', 33); // ~yellow/orange (moderate, 30-35 dBZ)
  const high = colorAt('radar', 48); // ~red/magenta (heavy/extreme, 45-50 dBZ)
  assert.ok(low.g > low.r && low.g > low.b, 'light rain should be green');
  assert.ok(mid.r > mid.g && mid.r > mid.b, 'moderate rain should be red-dominant (yellow/orange)');
  assert.ok(high.r > high.g, 'heavy rain should be red');
  assert.ok(high.b > high.g, 'extreme rain should be magenta-ish (blue above green)');
});

test('clouds palette is neon blue (opacity does the work)', () => {
  // Clouds are now a NEON-BLUE wash: the intensity of the cloud field is
  // conveyed by opacity and a blue-dominant color cast, not by darkness. The
  // blue reads on both the light map and the dark satellite basemap.
  for (const v of [25, 50, 75, 100]) {
    const c = colorAt('clouds', v);
    // Neon blue: blue channel clearly dominant over red and green.
    assert.ok(c.b > c.r && c.b > c.g, `clouds at ${v}% should be blue-dominant, got rgb(${c.r},${c.g},${c.b})`);
    assert.ok(c.b >= 110, `clouds at ${v}% should be a vivid blue, got b=${c.b}`);
    assert.ok(c.a > 0.4, `clouds at ${v}% should be clearly visible (alpha ${c.a})`);
  }
  assert.equal(colorAt('clouds', 0).a, 0, 'clear sky stays transparent');
  assert.equal(colorAt('clouds', 100).a, 1, 'full cloud cover is fully opaque');
  // The layer also raises the tile alpha above the default 0.7 wash so the
  // blanket reads as solid (the geo outlines still render above the weather).
  assert.equal(getLayer('clouds').opacity, 0.95, 'clouds declare a high per-layer opacity');
});

test('pressure palette spreads the typical 995-1030 hPa band across colors', () => {
  const { min, max } = layerRange('pressure');
  assert.ok(min <= 990 && max >= 1030, `pressure range should cover the common band, got ${min}-${max}`);
  const low = colorAt('pressure', 997);
  const mid = colorAt('pressure', 1013);
  const high = colorAt('pressure', 1028);
  // Distinct hues across the band: low is blue-ish, high is red-ish.
  assert.ok(low.b > low.r, 'low pressure should be blue-ish');
  assert.ok(high.r > high.b, 'high pressure should be red-ish');
  const diff = Math.abs(mid.r - low.r) + Math.abs(mid.g - low.g) + Math.abs(mid.b - low.b);
  assert.ok(diff > 100, 'mid pressure should differ visibly from low pressure');
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

test('minZoomForHeight never shows empty top/bottom borders', () => {
  // The viewport must stay inside the ±85° Web Mercator world: a taller
  // viewport needs a higher minimum zoom.
  assert.equal(minZoomForHeight(400), 2);
  assert.equal(minZoomForHeight(900), 2);
  assert.equal(minZoomForHeight(1300), 3);
  assert.equal(minZoomForHeight(2200), 4);
  // Hard floors: never a whole-world view, never absurdly zoomed in.
  assert.ok(minZoomForHeight(50) >= 2, 'min zoom never below 2');
  assert.ok(minZoomForHeight(100000) <= 6, 'min zoom never above 6');
  // For every tested height the visible latitude span at the returned zoom
  // actually fits inside ±85° (168° target leaves ~1° margin each side).
  for (const H of [400, 900, 1300, 2200]) {
    const z = minZoomForHeight(H);
    const span = (170.1 * H) / (256 * Math.pow(2, z));
    assert.ok(span <= 168 + 1e-9, `span ${span.toFixed(1)}° at zoom ${z} for H=${H}`);
  }
});

// ---------- Page structure (jsdom) ----------
test('map page contains required controls and hide/reopen wiring', () => {
  const html = readFileSync(MAP_HTML, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  assert.ok(doc.getElementById('map'), 'map canvas missing');
  assert.ok(doc.getElementById('map-layers'), 'layer container missing');
  assert.ok(doc.getElementById('map-panel'), 'control panel card missing');
  assert.ok(doc.getElementById('map-modal'), 'modal wrapper missing');
  assert.ok(doc.getElementById('map-modal-backdrop'), 'modal backdrop missing');
  assert.ok(doc.getElementById('map-panel-close'), 'panel close button missing');
  assert.ok(doc.getElementById('map-panel-open'), 'panel reopen button missing');
  assert.ok(doc.getElementById('map-legend'), 'legend missing');
  assert.equal(doc.querySelectorAll('[data-basemap]').length, 2, 'need 2 basemap options');
  // Removed controls must be gone.
  assert.equal(doc.getElementById('opacity-slider'), null, 'opacity slider should be removed');
  assert.equal(doc.getElementById('time-slider'), null, 'time slider should be removed');
  assert.equal(doc.getElementById('cities-toggle'), null, 'cities toggle should be removed');
  assert.equal(doc.getElementById('map-search'), null, 'search should be removed');
  assert.equal(doc.getElementById('map-wind-mode-section'), null, 'wind field (Wind/Gusts) toggle should be removed');
  assert.equal(doc.querySelector('[data-windmode]'), null, 'no wind-mode buttons should exist');
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
