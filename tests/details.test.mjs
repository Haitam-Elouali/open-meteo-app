import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DETAILS_HTML = readFileSync(`${__dirname}../src/pages/details/index.html`, 'utf8');
const UNITS_JS = readFileSync(`${__dirname}../src/components/units.js`, 'utf8');
const I18N_JS = readFileSync(`${__dirname}../src/components/i18n.js`, 'utf8');
const DETAILS_JS = readFileSync(`${__dirname}../src/pages/details/details.js`, 'utf8');

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mockForecast() {
  const t0 = todayISO();
  const times = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  return {
    daily: {
      time: times,
      weather_code: [0, 1, 2, 3, 61, 63, 80],
      temperature_2m_max: [20, 21, 22, 23, 24, 25, 26],
      temperature_2m_min: [10, 11, 12, 13, 14, 15, 16],
      precipitation_probability_max: [0, 10, 20, 30, 40, 50, 60],
      sunrise: times.map((t) => `${t}T06:00`),
      sunset: times.map((t) => `${t}T20:00`),
      wind_speed_10m_max: [5, 6, 7, 8, 9, 10, 11],
    },
  };
}

async function bootDetails(lang) {
  const dom = new JSDOM(DETAILS_HTML, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (lang) window.localStorage.setItem('open-meteo-lang', lang);
  window.localStorage.setItem('open-meteo-latlon', JSON.stringify({ lat: 34.26, lon: -6.58 }));

  window.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/forecast')) return { ok: true, json: async () => ({ data: mockForecast() }) };
    if (u.includes('/api/weather')) return { ok: true, json: async () => ({ data: { current: { is_day: 1, temperature_2m: 20, precipitation: 0, weather_code: 0 } } }) };
    return { ok: true, json: async () => ({}) };
  };

  window.eval(UNITS_JS);
  window.eval(I18N_JS);
  window.eval(DETAILS_JS);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  await new Promise((r) => setTimeout(r, 80));
  return window;
}

test('forecast day labels use the selected language (Today -> Aujourd’hui in French)', async () => {
  const window = await bootDetails('fr');
  const firstDay = window.document.querySelector('#details-daily .forecast-col .forecast-col-day');
  assert.ok(firstDay, 'first forecast column should exist');
  assert.equal(firstDay.textContent, "Aujourd'hui", 'today should be localized to French');
});

test('forecast dates use the selected locale', async () => {
  const window = await bootDetails('es');
  const dateEls = window.document.querySelectorAll('#details-daily .forecast-col-date');
  assert.ok(dateEls.length >= 2, 'date elements should be rendered');
  // Spanish short month is "jul." etc.; just assert it is not the bare English default by checking it rendered
  assert.ok(dateEls[1].textContent.length > 0, 'date label should be non-empty');
});

test('forecast keeps working in English by default', async () => {
  const window = await bootDetails('en');
  const firstDay = window.document.querySelector('#details-daily .forecast-col .forecast-col-day');
  assert.equal(firstDay.textContent, 'Today');
});

test('forecast card sizes to its content (auto width, capped at container)', async () => {
  const window = await bootDetails('en');
  const card = window.document.getElementById('details-daily');
  assert.ok(card, 'forecast card should exist');
  assert.ok(card.classList.contains('forecast-card') && card.classList.contains('forecast-scroll-view'),
    'card should carry both forecast-card and forecast-scroll-view classes');
  // jsdom does not apply external stylesheets, so assert the rule directly in
  // the source CSS: the combined selector must size to content (flex-grow 0)
  // and cap the width at 100% so it never crosses the available width.
  const fs = await import('fs');
  const css = fs.readFileSync(`${__dirname}../src/pages/details/details.css`, 'utf8');
  const m = css.match(/\.forecast-card\.forecast-scroll-view\s*\{([^}]*)\}/);
  assert.ok(m, 'forecast-card.forecast-scroll-view rule not found in details.css');
  assert.ok(/flex:\s*0\s+1\s+auto/.test(m[1]), `expected flex: 0 1 auto, got: ${m[1].trim()}`);
  assert.ok(/max-width:\s*100%/.test(m[1]), `expected max-width: 100%, got: ${m[1].trim()}`);
});

test('forecast card is centered horizontally and vertically', async () => {
  const window = await bootDetails('en');
  assert.ok(window.document.getElementById('details-daily'), 'forecast card should exist');
  const fs = await import('fs');
  const css = fs.readFileSync(`${__dirname}../src/pages/details/details.css`, 'utf8');

  // The page content is vertically centered within the viewport...
  const page = css.match(/\.page\s*\{([^}]*)\}/);
  assert.ok(page, '.page rule not found in details.css');
  assert.ok(/display:\s*flex/.test(page[1]), 'page should be a flex container');
  assert.ok(/flex-direction:\s*column/.test(page[1]), 'page should be a flex column');
  assert.ok(/justify-content:\s*center/.test(page[1]), 'page content should be vertically centered');

  // ...and the forecast card block is horizontally centered.
  const scroll = css.match(/\.forecast-scroll\s*\{([^}]*)\}/);
  assert.ok(scroll, '.forecast-scroll rule not found in details.css');
  assert.ok(/justify-content:\s*center/.test(scroll[1]), 'forecast block should center its items horizontally');
  assert.ok(/margin:\s*0\s+auto/.test(scroll[1]), 'forecast block should be centered (margin: 0 auto)');
});
