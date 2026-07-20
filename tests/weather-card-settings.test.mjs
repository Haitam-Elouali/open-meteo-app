import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const HOME_HTML = readFileSync(`${__dirname}../src/pages/home/index.html`, 'utf8');
const UNITS_JS = readFileSync(`${__dirname}../src/components/units.js`, 'utf8');
const WEATHER_CARD_JS = readFileSync(
  `${__dirname}../src/components/weather card/weather-card.js`,
  'utf8'
);
const I18N_JS = readFileSync(`${__dirname}../src/components/i18n.js`, 'utf8');

function mockWeather() {
  return {
    current: {
      temperature_2m: 20,
      apparent_temperature: 19,
      relative_humidity_2m: 50,
      is_day: 1,
      precipitation: 0,
      wind_speed_10m: 10,
      weather_code: 0,
    },
    daily: {
      time: ['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21'],
      temperature_2m_min: [10, 11, 12, 13, 14, 15, 16],
      temperature_2m_max: [20, 21, 22, 23, 24, 25, 26],
      precipitation_probability_max: [0, 10, 20, 30, 40, 50, 60],
      sunrise: Array.from({ length: 7 }, (_, i) => `2026-07-${15 + i}T06:0${i}`),
      sunset: Array.from({ length: 7 }, (_, i) => `2026-07-${15 + i}T20:0${i}`),
      weather_code: [0, 1, 2, 3, 61, 63, 80],
    },
  };
}

async function bootWith(storage = {}, weatherOverride) {
  const dom = new JSDOM(HOME_HTML, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  for (const [k, v] of Object.entries(storage)) {
    window.localStorage.setItem(k, v);
  }

  // Prevent the 1s live-time interval from keeping the process alive.
  window.setInterval = () => 0;

  window.fetch = async () => ({ ok: true, text: async () => '<svg><symbol id="day"></symbol></svg>' });
  window.__apiClient = {
    getWeather: async () => ({ data: weatherOverride || mockWeather() }),
    reverseGeocode: async () => ({ city: 'Rabat', country: 'Morocco' }),
  };

  window.eval(UNITS_JS);
  window.eval(WEATHER_CARD_JS);
  window.eval(I18N_JS);

  // Give boot() (async) time to render.
  await new Promise((r) => setTimeout(r, 60));
  return window;
}

test('boot applies the SAVED language instead of forcing English', async () => {
  const window = await bootWith({ 'open-meteo-lang': 'fr' });
  assert.equal(window.document.documentElement.lang, 'fr');
  assert.equal(window.document.querySelector('.localization').textContent, 'Rabat, Morocco');
});

test('navbar is localized on the home page (incl. the Details -> Forecast label)', async () => {
  const window = await bootWith({ 'open-meteo-lang': 'fr' });
  assert.equal(window.document.querySelector('.header__nav-link[data-i18n="nav.home"]').textContent, 'Accueil');
  assert.equal(window.document.querySelector('.header__nav-link[data-i18n="nav.dashboard"]').textContent, 'Tableau de bord');
  // The home "Details" link uses the shared nav.forecast key -> "Prévisions"
  assert.equal(window.document.querySelector('.header__nav-link[data-i18n="nav.forecast"]').textContent, 'Prévisions');
});

test('live time uses the selected UI language, not the browser locale', async () => {
  const window = await bootWith({ 'open-meteo-lang': 'fr' });
  const timeText = window.document.querySelector('.time').textContent;
  const expectedWeekday = new Date().toLocaleDateString('fr', { weekday: 'long' });
  assert.ok(
    timeText.toLowerCase().startsWith(expectedWeekday.toLowerCase()),
    `expected time to start with "${expectedWeekday}", got "${timeText}"`
  );
});

test('changing one setting does not reset the others on reload (language)', async () => {
  const window = await bootWith({
    'open-meteo-lang': 'es',
    'open-meteo-theme': 'dark',
    'open-meteo-temp-unit': 'f',
    'open-meteo-wind-unit': 'kn',
  });
  // All saved settings must be reflected simultaneously on load.
  assert.equal(window.document.documentElement.lang, 'es');
  assert.equal(window.document.body.style.backgroundColor.replace(/\s/g, ''), 'rgb(42,127,212)', 'static blue applied');
  assert.match(window.document.querySelector('.card-temp p span').textContent, /°F/, 'fahrenheit applied');
  assert.match(window.document.querySelector('.wind').textContent, /kn/, 'knots applied');
});

test('background is always static blue regardless of saved theme', async () => {
  const dark = await bootWith({ 'open-meteo-theme': 'dark' });
  assert.equal(dark.document.body.style.backgroundColor.replace(/\s/g, ''), 'rgb(42,127,212)');

  const light = await bootWith({ 'open-meteo-theme': 'light' });
  assert.equal(light.document.body.style.backgroundColor.replace(/\s/g, ''), 'rgb(42,127,212)');
});

test('temperature unit conversion is applied on the card', async () => {
  const f = await bootWith({ 'open-meteo-temp-unit': 'f' });
  // main temp is temperature_2m (20°C) -> 68°F -> floor 68
  assert.equal(f.document.querySelector('.card-temp p').childNodes[0].textContent, '68');
  assert.match(f.document.querySelector('.card-temp p span').textContent, /°F/);

  const c = await bootWith({ 'open-meteo-temp-unit': 'c' });
  assert.equal(c.document.querySelector('.card-temp p').childNodes[0].textContent, '20');
  assert.match(c.document.querySelector('.card-temp p span').textContent, /°C/);
});

test('wind unit conversion is applied on the card', async () => {
  const kn = await bootWith({ 'open-meteo-wind-unit': 'kn' });
  // 10 km/h -> 5.4 kn -> round 5
  assert.match(kn.document.querySelector('.wind').textContent, /^5 kn$/);

  const kmh = await bootWith({ 'open-meteo-wind-unit': 'kmh' });
  assert.match(kmh.document.querySelector('.wind').textContent, /^10 km\/h$/);
});
