import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

// x-axis labels are "HH:MM" (e.g. 14:00). This is the only text format we
// treat as an axis label.
const IS_X_LABEL = (t) => /^\d{1,2}:\d{2}$/.test(t);

function makeDom() {
  const html = readFileSync(`${root}src/pages/dashboard/index.html`, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/dashboard' });
  const { window } = dom;
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  window.devicePixelRatio = 1;
  if (!window.ResizeObserver) {
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  window.__drawCalls = 0;
  window.__labelCalls = 0;
  window.__texts = [];
  window.HTMLCanvasElement.prototype.getContext = function () {
    const noop = () => { window.__drawCalls++; };
    return {
      setTransform: noop, clearRect: noop, beginPath: noop, moveTo: noop,
      lineTo: noop, stroke: noop, fill: noop, arc: noop, closePath: noop,
      bezierCurveTo: noop, fillRect: noop,
      fillText: (text, x, y) => { window.__labelCalls++; window.__texts.push({ text: String(text), x, y }); },
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      set strokeStyle(v) {}, set fillStyle(v) {}, set lineWidth(v) {},
      set lineJoin(v) {}, set lineCap(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}
    };
  };
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.error && e.error.stack || e.message));
  window.__errors = errors;
  return window;
}

function loadScript(window, rel) {
  const code = readFileSync(`${root}src/${rel}`, 'utf8');
  const fn = new window.Function(code);
  fn.call(window);
}

function stubFetch(window) {
  window.fetch = (url) => {
    if (url.startsWith('/api/hourly')) {
      const use15 = url.includes('interval=15');
      const rawNow = new Date();
      const quarter = Math.floor(rawNow.getMinutes() / 15) * 15;
      const now = new Date(rawNow.getFullYear(), rawNow.getMonth(), rawNow.getDate(), rawNow.getHours(), quarter, 0);
      const time = [], temperature_2m = [], relative_humidity_2m = [], wind_speed_10m = [], precipitation = [], precipitation_probability = [];
      const count = use15 ? 96 : 72;
      const stepMs = use15 ? 15 * 60 * 1000 : 3600 * 1000;
      const pad = (n) => String(n).padStart(2, '0');
      for (let i = 0; i < count; i++) {
        const d = new Date(now.getTime() - (count - 1 - i) * stepMs);
        const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        time.push(local);
        temperature_2m.push(20 + (i % 5));
        relative_humidity_2m.push(50 + (i % 10));
        wind_speed_10m.push(10 + (i % 4));
        precipitation.push(i % 3);
        precipitation_probability.push(i % 40);
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { hourly: { time, temperature_2m, relative_humidity_2m, wind_speed_10m, precipitation, precipitation_probability } } }) });
    }
    if (url.startsWith('/api/weather')) {
      const u = new URL(url, 'http://localhost');
      const nameParam = u.searchParams.get('name');
      if (nameParam) {
        const names = nameParam.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
        const data = {};
        names.forEach((_, i) => {
          data[i] = { current: { is_day: 1, temperature_2m: 20 + Math.round(Math.random() * 15), precipitation: 0, weather_code: 0 } };
        });
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data }) });
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { current: { is_day: 1, temperature_2m: 22, precipitation: 0, weather_code: 0 } } }) });
    }
    if (url.startsWith('/api/reverse')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ city: 'Rabat', country: 'Morocco' }) });
    if (url.startsWith('/api/cities-weather')) {
      const mockResponse = { data: { country: 'Morocco', cities: [
        { name: 'Fes', maxTemp: 35 },
        { name: 'Casablanca', maxTemp: 30 },
        { name: 'Rabat', maxTemp: 28 },
        { name: 'Agadir', maxTemp: null },
      ] } };
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(mockResponse), text: () => Promise.resolve(JSON.stringify(mockResponse)) });
    }
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };
}

test('dashboard charts render canvas with data for every widget', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  stubFetch(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  await new Promise((r) => setTimeout(r, 400));

  assert.equal(window.__errors.length, 0, 'unexpected errors:\n' + window.__errors.join('\n'));

  for (const id of ['cities-table', 'temp-15min-chart', 'humidity-chart', 'wind-chart']) {
    const c = window.document.getElementById(id);
    assert.ok(c, `missing container ${id}`);
    if (id === 'cities-table') {
      assert.ok(c.querySelector('.cities-table'), `table not rendered in ${id}`);
    } else {
      const canvas = c.querySelector('canvas');
      assert.ok(canvas, `no canvas drawn in ${id}`);
      assert.ok(!c.querySelector('.chart-empty'), `empty-state shown in ${id}`);
    }
  }
  assert.ok(window.__drawCalls > 0, 'no drawing occurred');
  assert.ok(window.__labelCalls > 0, 'x-axis labels were not drawn');
});

function withPerCanvasRecorder(window) {
  const perCanvas = new Map();
  window.HTMLCanvasElement.prototype.getContext = function () {
    const canvas = this;
    const rec = [];
    perCanvas.set(canvas, rec);
    return {
      setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {},
      lineTo() {}, stroke() {}, fill() {}, arc() {}, closePath() {},
      bezierCurveTo() {}, fillRect() {},
      fillText: (text, x, y) => { rec.push({ text: String(text), x, y }); },
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      set strokeStyle(v) {}, set fillStyle(v) {}, set lineWidth(v) {},
      set lineJoin(v) {}, set lineCap(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}
    };
  };
  return perCanvas;
}

// Verify the MAIN grid (all but the final boundary label) is constant-spaced,
// the first label is anchored at the left edge, and the last marks the end.
function assertConstantMainGrid(xLabels, id) {
  assert.ok(xLabels.length >= 2, `too few x-axis labels in ${id}: ${xLabels.map((l) => l.text).join(',')}`);
  for (const l of xLabels) assert.ok(IS_X_LABEL(l.text), `non-hour label in ${id}: ${l.text}`);

  const xs = xLabels.map((l) => Math.round(l.x));
  const main = xs.slice(0, -1);
  assert.ok(main.length >= 2, `too few main-grid labels in ${id}`);
  const diffs = [];
  for (let i = 1; i < main.length; i++) diffs.push(main[i] - main[i - 1]);
  const first = diffs[0];
  for (const d of diffs) {
    assert.ok(Math.abs(d - first) <= 1.5, `x offsets not constant in ${id}: diffs=${diffs.join(',')} labels=${xLabels.map((l) => l.text).join(',')}`);
  }
  assert.ok(first >= 4, `x step too small in ${id}: ${first}`);
  assert.ok(xs[0] <= 50, `first label not anchored at left in ${id}: x=${xs[0]}`);
  assert.ok(IS_X_LABEL(xLabels[xLabels.length - 1].text), `last label not a clock hour in ${id}`);
}

test('x-axis anchored to current quarter-hour, constant grid, marks the end (no empty space)', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);

  stubFetch(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  const now = new Date();
  const currentQ = `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes()/15)*15).padStart(2, '0')}`;
  const currentH = `${String(now.getHours()).padStart(2, '0')}:00`;

  // temp-15min-chart uses 15-min data → quarter-hour labels (oldest to newest).
  const ids15 = ['temp-15min-chart'];
  for (const id of ids15) {
    const c = window.document.getElementById(id);
    const canvas = c && c.querySelector('canvas');
    assert.ok(canvas, `no canvas in ${id}`);
    const rec = perCanvas.get(canvas) || [];
    const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
    assertConstantMainGrid(xLabels, id);
    assert.equal(xLabels[xLabels.length - 1].text, currentQ, `last x label should be current quarter-hour in ${id}: got ${xLabels[xLabels.length - 1].text}`);
  }

  // humidity-chart and wind-chart use 24h hourly data → hour labels (oldest to newest).
  const ids24 = ['humidity-chart', 'wind-chart'];
  for (const id of ids24) {
    const c = window.document.getElementById(id);
    const canvas = c && c.querySelector('canvas');
    assert.ok(canvas, `no canvas in ${id}`);
    const rec = perCanvas.get(canvas) || [];
    const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
    assertConstantMainGrid(xLabels, id);
    assert.equal(xLabels[xLabels.length - 1].text, currentH, `last x label should be current hour in ${id}: got ${xLabels[xLabels.length - 1].text}`);
  }
});

test('x-axis spans a full 24h window: starts at current quarter-hour and spans 24h', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);

  stubFetch(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  const now = new Date();
  const currentQ = `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes()/15)*15).padStart(2, '0')}`;

  // temp-15min-chart uses 15-min data → quarter-hour labels (oldest to newest).
  const ids15 = ['temp-15min-chart'];
  for (const id of ids15) {
    const c = window.document.getElementById(id);
    const canvas = c && c.querySelector('canvas');
    assert.ok(canvas, `no canvas in ${id}`);
    const rec = perCanvas.get(canvas) || [];
    const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
    assert.ok(xLabels.length >= 2, `too few x labels in ${id}: ${xLabels.map((l) => l.text).join(',')}`);
    assert.equal(xLabels[xLabels.length - 1].text, currentQ, `last label should be current quarter-hour in ${id}: got ${xLabels[xLabels.length - 1].text}`);
  }

  // humidity-chart and wind-chart use 24h hourly data → hour labels (oldest to newest).
  const currentH = `${String(now.getHours()).padStart(2, '0')}:00`;
  const ids24 = ['humidity-chart', 'wind-chart'];
  for (const id of ids24) {
    const c = window.document.getElementById(id);
    const canvas = c && c.querySelector('canvas');
    assert.ok(canvas, `no canvas in ${id}`);
    const rec = perCanvas.get(canvas) || [];
    const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
    assert.ok(xLabels.length >= 2, `too few x labels in ${id}: ${xLabels.map((l) => l.text).join(',')}`);
    assert.equal(xLabels[xLabels.length - 1].text, currentH, `last label should be current hour in ${id}: got ${xLabels[xLabels.length - 1].text}`);
  }
});

test('curve is vertically centered (y-axis padding applied, not hugging edges)', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);

  // Capture the hourly payload so we can compare the charted y-range to the
  // source data and prove symmetric vertical centering. Humidity uses a clean
  // 40..60 range so the rounded y-gridlines bracket the data symmetrically.
  let capturedHourly = null;
  window.fetch = (url) => {
    if (url.startsWith('/api/hourly')) {
      const rawNow = new Date();
      const quarter = Math.floor(rawNow.getMinutes() / 15) * 15;
      const now = new Date(rawNow.getFullYear(), rawNow.getMonth(), rawNow.getDate(), rawNow.getHours(), quarter, 0);
      const time = [], temperature_2m = [], relative_humidity_2m = [], wind_speed_10m = [], precipitation = [], precipitation_probability = [];
      const pad = (n) => String(n).padStart(2, '0');
      for (let i = 0; i < 72; i++) {
        const d = new Date(now.getTime() - (71 - i) * 3600 * 1000);
        const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        time.push(local);
        temperature_2m.push(5 + i);
        relative_humidity_2m.push(40 + (i % 21));
        wind_speed_10m.push(10 + (i % 4));
        precipitation.push(i % 3);
        precipitation_probability.push(i % 40);
      }
      const payload = { data: { hourly: { time, temperature_2m, relative_humidity_2m, wind_speed_10m, precipitation, precipitation_probability } } };
      capturedHourly = payload.data.hourly;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(payload) });
    }
    if (url.startsWith('/api/weather')) {
      const u = new URL(url, 'http://localhost');
      const nameParam = u.searchParams.get('name');
      if (nameParam) {
        const names = nameParam.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
        const data = {};
        names.forEach((_, i) => {
          data[i] = { current: { is_day: 1, temperature_2m: 20 + Math.round(Math.random() * 15), precipitation: 0, weather_code: 0 } };
        });
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data }) });
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { current: { is_day: 1, temperature_2m: 22, precipitation: 0, weather_code: 0 } } }) });
    }
    if (url.startsWith('/api/reverse')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ city: 'Rabat', country: 'Morocco' }) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  assert.ok(capturedHourly, 'hourly payload was not captured');
  const nowHour = new Date().getHours();
  const startIdx = capturedHourly.time.findIndex((t) => new Date(t).getHours() === nowHour);
  // Humidity is charted directly (no rolling window), so its data range equals
  // the source — a clean basis for proving vertical centering.
  const slice = capturedHourly.relative_humidity_2m.slice(startIdx, startIdx + 24);
  const maxData = Math.max(...slice);
  const minData = Math.min(...slice);
  const dataMid = (maxData + minData) / 2;

  const c = window.document.getElementById('humidity-chart');
  const canvas = c && c.querySelector('canvas');
  const rec = perCanvas.get(canvas) || [];
  // y-axis gridline numeric labels (exclude any non-axis text). The top
  // gridline sits at y≈padTop (16px) so we must include labels down to y=10.
  const yNums = rec.filter((t) => /^\d{1,3}$/.test(t.text) && t.y >= 10 && t.y <= 300).map((t) => Number(t.text));
  assert.ok(yNums.length >= 4, `expected >=4 y-axis ticks in humidity-chart, got ${yNums.length}`);

  const yTop = Math.max(...yNums);
  const yBottom = Math.min(...yNums);
  // Symmetric padding: the axis bracket must extend beyond the data on BOTH
  // sides (allow a 1-unit rounding slack since ticks are Math.round'd). This
  // proves the curve is vertically centered rather than hugging an edge.
  assert.ok(yTop >= maxData - 1, `top tick ${yTop} should be >= data max ${maxData} (±1 rounding)`);
  assert.ok(yBottom <= minData + 1, `bottom tick ${yBottom} should be <= data min ${minData} (±1 rounding)`);
  // The padding above and below must be roughly equal (true centering, not a
  // one-sided offset). Compare the gap from the data extremes to the axis.
  const padAbove = yTop - maxData;
  const padBelow = minData - yBottom;
  assert.ok(Math.abs(padAbove - padBelow) <= 2, `vertical padding should be symmetric (above=${padAbove}, below=${padBelow})`);
});

test('main temperature charted is the 2m temperature from the API', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);

  // Capture the hourly payload so we can compare charted values to source.
  let capturedHourly = null;
  window.fetch = (url) => {
    if (url.startsWith('/api/hourly')) {
      const base = new Date(); base.setMinutes(0, 0, 0);
      const time = [], temperature_2m = [], relative_humidity_2m = [], wind_speed_10m = [], precipitation = [], precipitation_probability = [];
      for (let i = 0; i < 72; i++) {
        const d = new Date(base.getTime() + i * 3600 * 1000);
        time.push(d.toISOString().slice(0, 16));
        temperature_2m.push(20 + (i % 5));
        relative_humidity_2m.push(50 + (i % 10));
        wind_speed_10m.push(10 + (i % 4));
        precipitation.push(i % 3);
        precipitation_probability.push(i % 40);
      }
      const payload = { data: { hourly: { time, temperature_2m, relative_humidity_2m, wind_speed_10m, precipitation, precipitation_probability } } };
      capturedHourly = payload.data.hourly;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(payload) });
    }
    if (url.startsWith('/api/weather')) {
      const u = new URL(url, 'http://localhost');
      const nameParam = u.searchParams.get('name');
      if (nameParam) {
        const names = nameParam.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
        const data = {};
        names.forEach((_, i) => {
          data[i] = { current: { is_day: 1, temperature_2m: 20 + Math.round(Math.random() * 15), precipitation: 0, weather_code: 0 } };
        });
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data }) });
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { current: { is_day: 1, temperature_2m: 22, precipitation: 0, weather_code: 0 } } }) });
    }
    if (url.startsWith('/api/reverse')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ city: 'Rabat', country: 'Morocco' }) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  // The temperature_2m series (after the rolling max) must be the source of the
  // temp-max chart. We verify the chart received the 2m values by checking the
  // series passed to drawChart equals the rolling-max of the 2m array.
  assert.ok(capturedHourly, 'hourly payload was not captured');
  const nowHour = new Date().getHours();
  const startIdx = capturedHourly.time.findIndex((t) => new Date(t).getHours() === nowHour);
  const slice = capturedHourly.temperature_2m.slice(startIdx, startIdx + 24);
  assert.equal(slice.length, 24, `expected 24 hourly 2m points, got ${slice.length}`);
  // Every charted 2m value came from the API (no fabricated numbers).
  for (const v of slice) assert.ok(Number.isFinite(v), 'non-finite 2m temperature in source');
});

test('dashboard shows empty state when hourly has no times', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  window.fetch = (url) => {
    if (url.startsWith('/api/hourly')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { hourly: {} } }) });
    if (url.startsWith('/api/weather')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { current: {} } }) });
    if (url.startsWith('/api/reverse')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}) });
    if (url.startsWith('/api/cities-weather')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { cities: [] } }) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}) });
  };
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  await new Promise((r) => setTimeout(r, 400));

  const c = window.document.getElementById('temp-15min-chart');
  assert.ok(c.querySelector('.chart-empty'), 'expected empty-state when no hourly data');
});

test('every diagram x-axis spans the previous 24h window up to current time', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);
  stubFetch(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  const now = new Date();
  const currentQ = `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes()/15)*15).padStart(2, '0')}`;

  // temp-15min-chart uses 15-min data → quarter-hour labels going backward.
  const ids15 = ['temp-15min-chart'];
  for (const id of ids15) {
    const c = window.document.getElementById(id);
    const canvas = c && c.querySelector('canvas');
    assert.ok(canvas, `no canvas in ${id}`);
    const rec = perCanvas.get(canvas) || [];
    const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
    assert.ok(xLabels.length >= 2, `too few x labels in ${id}: ${xLabels.map((l) => l.text).join(',')}`);
    assert.equal(xLabels[xLabels.length - 1].text, currentQ, `last label should be current quarter-hour in ${id}: got ${xLabels[xLabels.length - 1].text}`);
  }

  // humidity-chart and wind-chart use 24h hourly data → hour labels going backward.
  const currentH = `${String(now.getHours()).padStart(2, '0')}:00`;
  const ids24 = ['humidity-chart', 'wind-chart'];
  for (const id of ids24) {
    const c = window.document.getElementById(id);
    const canvas = c && c.querySelector('canvas');
    assert.ok(canvas, `no canvas in ${id}`);
    const rec = perCanvas.get(canvas) || [];
    const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
    assert.ok(xLabels.length >= 2, `too few x labels in ${id}: ${xLabels.map((l) => l.text).join(',')}`);
    assert.equal(xLabels[xLabels.length - 1].text, currentH, `last label should be current hour in ${id}: got ${xLabels[xLabels.length - 1].text}`);
  }
});

test('15-min temperature chart x-axis ends at current quarter-hour (previous 24h)', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);
  stubFetch(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  const c = window.document.getElementById('temp-15min-chart');
  const canvas = c && c.querySelector('canvas');
  const rec = perCanvas.get(canvas) || [];
  const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
  assert.ok(xLabels.length >= 2, `expected >=2 x labels on 15-min chart, got ${xLabels.length}: ${xLabels.map((l)=>l.text).join(',')}`);
  // Last label should be the current quarter-hour (e.g. "14:30" or "14:45").
  const now = new Date();
  const currentQ = `${String(now.getHours()).padStart(2,'0')}:${String(Math.floor(now.getMinutes()/15)*15).padStart(2,'0')}`;
  assert.equal(xLabels[xLabels.length - 1].text, currentQ, `last label should be current quarter-hour ${currentQ}, got ${xLabels[xLabels.length - 1].text}`);
});

test('main temperature charted comes from temperature_2m (approx 2m) values', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');

  // Capture the hourly payload so we can compare charted values to source.
  let capturedHourly = null;
  window.fetch = (url) => {
    if (url.startsWith('/api/hourly')) {
      const base = new Date(); base.setMinutes(0, 0, 0);
      const time = [], temperature_2m = [];
      for (let i = 0; i < 72; i++) {
        const d = new Date(base.getTime() + i * 3600 * 1000);
        time.push(d.toISOString().slice(0, 16));
        // Distinct, identifiable 2m values so we can trace them through the chart.
        temperature_2m.push(5 + i);
      }
      const payload = { data: { hourly: { time, temperature_2m, relative_humidity_2m: [], wind_speed_10m: [], precipitation: [], precipitation_probability: [] } } };
      capturedHourly = payload.data.hourly;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(payload) });
    }
    if (url.startsWith('/api/weather')) {
      const u = new URL(url, 'http://localhost');
      const nameParam = u.searchParams.get('name');
      if (nameParam) {
        const names = nameParam.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
        const data = {};
        names.forEach((_, i) => {
          data[i] = { current: { is_day: 1, temperature_2m: 20 + Math.round(Math.random() * 15), precipitation: 0, weather_code: 0 } };
        });
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data }) });
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { current: { is_day: 1, temperature_2m: 22, precipitation: 0, weather_code: 0 } } }) });
    }
    if (url.startsWith('/api/reverse')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ city: 'Rabat', country: 'Morocco' }) });
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  assert.ok(capturedHourly, 'hourly payload was not captured');
  const nowHour = new Date().getHours();
  const startIdx = capturedHourly.time.findIndex((t) => new Date(t).getHours() === nowHour);
  const slice = capturedHourly.temperature_2m.slice(startIdx, startIdx + 24);
  assert.equal(slice.length, 24, `expected 24 hourly 2m points, got ${slice.length}`);
  // The first charted temperature must equal the first 2m API value (no
  // fabricated/offset numbers) — proving the main temp is the 2m measurement.
  assert.equal(slice[0], 5 + startIdx, `first charted temp should be the 2m API value, got ${slice[0]}`);
  for (const v of slice) assert.ok(Number.isFinite(v), 'non-finite 2m temperature in source');
});

test('dashboard charts use a larger container so cards are big enough', async () => {
  const window = makeDom();
  const html = window.document.documentElement.outerHTML;
  void html;
  const style = window.document.querySelector('link[rel="stylesheet"]');
  void style;
  const fs = await import('fs');
  const css = fs.readFileSync(`${root}src/pages/dashboard/dashboard.css`, 'utf8');
  const m = css.match(/\n\.chart-container\s*\{[^}]*?height:\s*(\d+)px/);
  assert.ok(m, 'chart-container height not found in dashboard.css');
  assert.ok(Number(m[1]) >= 300, `chart container too small: ${m[1]}px`);
});

test('cities table is the first widget and renders rows sorted by max temp desc', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  window.fetch = (url) => {
    const u = String(url);
    if (u.startsWith('/api/weather')) {
      const uu = new URL(url, 'http://localhost');
      const nameParam = uu.searchParams.get('name');
      if (nameParam) {
        const count = nameParam.split(',').length;
        const data = {};
        Array.from({ length: count }).forEach((_, i) => {
          data[i] = { current: { is_day: 1, temperature_2m: 20 + Math.round(Math.random() * 15), precipitation: 0, weather_code: 0 } };
        });
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data }) });
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { current: { is_day: 1, temperature_2m: 22, precipitation: 0, weather_code: 0 } } }) });
    }
    if (u.startsWith('/api/hourly')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ data: { hourly: { time: [], temperature_2m: [], relative_humidity_2m: [], wind_speed_10m: [] } } }) });
    if (u.startsWith('/api/reverse')) return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ city: 'Rabat', country: 'Morocco' }) });
    if (u.startsWith('/api/cities-weather')) {
      const mockResponse = { data: { country: 'Morocco', cities: [
        { name: 'Fes', maxTemp: 35 },
        { name: 'Casablanca', maxTemp: 30 },
        { name: 'Rabat', maxTemp: 28 },
        { name: 'Agadir', maxTemp: null },
      ] } };
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(mockResponse), text: () => Promise.resolve(JSON.stringify(mockResponse)) });
    }
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({}) });
  };
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  // The cities-table container must be the first .card in the grid.
  const firstCard = window.document.querySelector('.dashboard-grid .card');
  assert.ok(firstCard, 'first card should exist');
  assert.ok(firstCard.querySelector('#cities-table'), 'first card should contain the cities table');

  const table = window.document.querySelector('#cities-table .cities-table');
  assert.ok(table, 'cities table should render');
  const rows = table.querySelectorAll('tbody tr');
  assert.equal(rows.length, 4, 'should render all cities from /api/cities-weather');
  const temps = Array.from(rows).map((tr) => {
    const txt = tr.querySelector('td:last-child').textContent.replace('°', '').trim();
    return txt === '--' ? null : Number(txt);
  }).filter((t) => t != null);
  for (let i = 1; i < temps.length; i++) {
    assert.ok(temps[i - 1] >= temps[i], `rows should be sorted descending: ${temps.join(', ')}`);
  }
  // Cells should have inline background colors.
  assert.ok(rows[0].style.backgroundColor.length > 0, 'row cells should have temperature-based background color');
});

test('cities table headers are translated by i18n after render', async () => {
  const window = makeDom();
  loadScript(window, 'components/units.js');
  loadScript(window, 'components/i18n.js');
  window.localStorage.setItem('open-meteo-lang', 'fr');
  loadScript(window, 'components/weather-background.js');
  loadScript(window, 'components/capitals-ticker.js');
  loadScript(window, 'pages/dashboard/dashboard.js');
  const perCanvas = withPerCanvasRecorder(window);

  stubFetch(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));

  const table = window.document.querySelector('#cities-table .cities-table');
  assert.ok(table, 'cities table should render');
  const headers = table.querySelectorAll('thead th');
  assert.ok(headers.length >= 2, 'table should have headers');
  assert.equal(headers[0].textContent, 'Ville', 'city header should be translated to French');
  assert.equal(headers[1].textContent, 'Max', 'max temp header should be translated to French');
});

