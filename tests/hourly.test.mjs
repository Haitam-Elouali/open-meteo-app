import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const IS_X_LABEL = (t) => /^\d{1,2}:\d{2}$/.test(t);

function makeDom() {
  const html = readFileSync(`${root}src/pages/hourly/index.html`, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/hourly' });
  const { window } = dom;
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  window.devicePixelRatio = 1;
  if (!window.ResizeObserver) {
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  // Guarantee a layout so getBoundingClientRect returns a real size.
  Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() { return { width: 800, height: 460, top: 0, left: 0, right: 800, bottom: 460 }; }
  });
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() { return { width: 800, height: 460, top: 0, left: 0, right: 800, bottom: 460 }; }
  });
  window.__texts = [];
  window.HTMLCanvasElement.prototype.getContext = function () {
    const rec = [];
    this.__rec = rec;
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
  window.__recFor = (canvas) => canvas && canvas.__rec ? canvas.__rec : [];
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.error && e.error.stack || e.message));
  window.__errors = errors;
  return window;
}

function stubHourly(window) {
  window.fetch = (url) => {
    if (String(url).startsWith('/api/hourly')) {
      const base = new Date(); base.setMinutes(0, 0, 0);
      const time = [], temperature_2m = [], relative_humidity_2m = [], wind_speed_10m = [], precipitation = [], precipitation_probability = [];
      for (let i = 0; i < 72; i++) {
        const d = new Date(base.getTime() + i * 3600 * 1000);
        time.push(d.toISOString().slice(0, 16));
        temperature_2m.push(5 + i);
        relative_humidity_2m.push(50 + (i % 10));
        wind_speed_10m.push(10 + (i % 4));
        precipitation.push(i % 3);
        precipitation_probability.push(i % 40);
      }
      const payload = { data: { hourly: { time, temperature_2m, relative_humidity_2m, wind_speed_10m, precipitation, precipitation_probability } } };
      window.__hourly = payload.data.hourly;
      return Promise.resolve({ json: () => Promise.resolve(payload) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  };
}

async function boot() {
  const window = makeDom();
  const js = readFileSync(`${root}src/pages/hourly/hourly.js`, 'utf8');
  window.eval(js);
  window.__lastLatLon = { lat: 34.26, lon: -6.58 };
  stubHourly(window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 400));
  return window;
}

test('hourly chart renders a canvas from hourly data', async () => {
  const window = await boot();
  assert.equal(window.__errors.length, 0, 'unexpected errors:\n' + window.__errors.join('\n'));
  const c = window.document.getElementById('hourly-chart');
  assert.ok(c, 'missing container');
  assert.ok(c.querySelector('canvas'), 'no canvas drawn');
  assert.ok(!c.querySelector('.hourly-loading'), 'loading state left up');
});

test('hourly diagram spans a full 24h window: starts and ends on the same hour (15:00 -> 15:00)', async () => {
  const window = await boot();
  const c = window.document.getElementById('hourly-chart');
  const rec = window.__recFor(c.querySelector('canvas'));
  const xLabels = rec.filter((t) => IS_X_LABEL(t.text));
  assert.ok(xLabels.length >= 2, `too few x labels: ${xLabels.map((l) => l.text).join(',')}`);
  const nowHour = new Date().getHours();
  const sameHour = `${String(nowHour).padStart(2, '0')}:00`;
  assert.equal(xLabels[0].text, sameHour, `first label should be current hour: got ${xLabels[0].text}`);
  assert.equal(xLabels[xLabels.length - 1].text, sameHour, `last label should be ${sameHour} (24h boundary): got ${xLabels[xLabels.length - 1].text}`);
  assert.equal(c.dataset.window, `${sameHour} → ${sameHour} (24h)`, `window caption wrong: ${c.dataset.window}`);
});

test('hourly temperature series comes from temperature_2m (approx 2m)', async () => {
  const window = await boot();
  assert.ok(window.__hourly, 'hourly payload not captured');
  const h = window.__hourly;
  const nowHour = new Date().getHours();
  const startIdx = h.time.findIndex((t) => new Date(t).getHours() === nowHour);
  const slice = h.temperature_2m.slice(startIdx, startIdx + 24);
  assert.equal(slice.length, 24, `expected 24 2m points, got ${slice.length}`);
  assert.equal(slice[0], 5 + startIdx, `first charted temp should match 2m API value, got ${slice[0]}`);
  for (const v of slice) assert.ok(Number.isFinite(v), 'non-finite 2m temperature in source');
});

test('hourly chart centers the temperature line on the y-axis (symmetric padding)', async () => {
  const window = await boot();
  const c = window.document.getElementById('hourly-chart');
  const rec = window.__recFor(c.querySelector('canvas'));
  // Hourly draws the temperature value label next to each data point as
  // "<n>°". The y-coordinate of each such label sits on the plotted point,
  // so the average of those y's must land on the vertical center of the
  // plot area (proving symmetric centering, not hugging the edges).
  const pointLabels = rec.filter((t) => /^\d+°$/.test(t.text));
  assert.ok(pointLabels.length >= 20, `expected ~24 temp point labels, got ${pointLabels.length}`);
  const ys = pointLabels.map((t) => t.y);
  const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
  // Plot center for the mock 800x460 box: padTop 20 + (460-20-40)/2 = 220.
  assert.ok(Math.abs(avgY - 220) <= 30, `temperature line not centered on y-axis: avgY=${avgY.toFixed(1)} (expected ~220)`);
});

test('hourly card uses a larger chart container', async () => {
  const window = await boot();
  const css = readFileSync(`${root}src/pages/hourly/hourly.css`, 'utf8');
  const m = css.match(/\.hourly-chart\s*\{[^}]*height:\s*(\d+)px/);
  assert.ok(m, 'hourly-chart height not found');
  assert.ok(Number(m[1]) >= 400, `hourly chart container too small: ${m[1]}px`);
});
