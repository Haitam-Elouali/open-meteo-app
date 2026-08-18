import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { CITIES_BY_COUNTRY } = require('../lib/cities-data.js');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOCATION_MODAL_JS = readFileSync(`${__dirname}../src/components/location-modal.js`, 'utf8');
const WC_JS = readFileSync(`${__dirname}../src/components/weather card/weather-card.js`, 'utf8');
const COUNTRIES = eval(WC_JS.match(/const COUNTRIES = (\[[\s\S]*?\]);/)[1]);

const MARKUP = `
  <button class="header__geo-button" type="button">geo</button>
  <div class="location-modal-backdrop" hidden>
    <div class="location-modal" role="dialog" aria-modal="true">
      <select class="location-country">
        <option value="">Select a country</option>
      </select>
      <select class="location-city" disabled>
        <option value="">Select a country first</option>
      </select>
      <div class="location-modal-actions">
        <button class="location-cancel">Cancel</button>
        <button class="location-confirm primary">Confirm</button>
      </div>
    </div>
  </div>
`;

function setup(fetchImpl) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${MARKUP}</body></html>`, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // Mirror the browser's <script src="/cities-data.js"> which exposes the
  // curated lists globally for the modal to use offline.
  window.CITIES_BY_COUNTRY = CITIES_BY_COUNTRY;
  window.COUNTRIES = COUNTRIES;
  window.fetch = fetchImpl;
  window.eval(LOCATION_MODAL_JS);
  // jsdom (outside-only) keeps readyState 'loading', so fire DOMContentLoaded
  // to run the registered init listener deterministically.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  // open the modal (wires the geo button)
  window.document.querySelector('.header__geo-button').click();
  return window;
}

async function selectCountry(window, country) {
  const sel = window.document.querySelector('.location-country');
  // Wait until the country options are populated (loadCountries may resolve
  // on a later tick when it falls back to the local curated list).
  for (let i = 0; i < 60; i++) {
    sel.value = country;
    if (sel.value === country) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  sel.dispatchEvent(new window.Event('change'));
}

function cityOptions(window) {
  return Array.from(window.document.querySelector('.location-city').options).map((o) => o.value);
}

test('country with curated cities populates the city select even when API fails', async () => {
  const window = setup(async () => { throw new Error('network'); });
  await selectCountry(window, 'France');
  await new Promise((r) => setTimeout(r, 20));
  const opts = cityOptions(window);
  assert.ok(opts.includes('Paris'), 'Paris should be available from local curated list when API fails');
});

test('api error falls back to local curated cities (no crash, city select enabled)', async () => {
  const window = setup(async () => { throw new Error('network'); });
  await selectCountry(window, 'Angola');
  await new Promise((r) => setTimeout(r, 20));
  const opts = cityOptions(window);
  assert.ok(opts.includes('Luanda'), 'Luanda should be available from local curated list when API fails');
  assert.equal(window.document.querySelector('.location-city').disabled, false, 'city select enabled when local fallback exists');
});

test('confirm saves selected city and dispatches location:changed', async () => {
  const window = setup(async (url) => {
    if (String(url).includes('/api/location')) {
      return {
        ok: true,
        json: async () => ({ results: [{ name: 'Paris', country: 'France', lat: 48.85341, lon: 2.3488 }] }),
      };
    }
    throw new Error('unexpected ' + url);
  });
  await selectCountry(window, 'France');
  await new Promise((r) => setTimeout(r, 20));
  const citySel = window.document.querySelector('.location-city');
  citySel.value = 'Paris';
  citySel.dispatchEvent(new window.Event('change'));

  let changed = null;
  window.addEventListener('location:changed', (e) => { changed = e.detail; });
  window.document.querySelector('.location-confirm').click();
  await new Promise((r) => setTimeout(r, 20));

  const saved = JSON.parse(window.localStorage.getItem('open-meteo-latlon'));
  assert.ok(saved && Math.abs(saved.lat - 48.85341) < 1e-3, 'latlon persisted from selection');
  assert.equal(window.localStorage.getItem('open-meteo-city'), 'Paris', 'city persisted');
  assert.equal(window.localStorage.getItem('open-meteo-country'), 'France', 'country persisted');
  assert.ok(changed && changed.lat === 48.85341 && changed.lon === 2.3488, 'location:changed fired with coords');
});

test('confirm prefers the chosen country when geocoder returns same-named cities', async () => {
  const window = setup(async (url) => {
    if (String(url).includes('/api/location')) {
      return {
        ok: true,
        json: async () => ({ results: [
          { name: 'Paris', country: 'United States', lat: 33.66, lon: -95.55 },
          { name: 'Paris', country: 'France', lat: 48.85341, lon: 2.3488 },
        ] }),
      };
    }
    throw new Error('unexpected ' + url);
  });
  await selectCountry(window, 'France');
  await new Promise((r) => setTimeout(r, 20));
  const citySel = window.document.querySelector('.location-city');
  citySel.value = 'Paris';
  citySel.dispatchEvent(new window.Event('change'));

  let changed = null;
  window.addEventListener('location:changed', (e) => { changed = e.detail; });
  window.document.querySelector('.location-confirm').click();
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(changed && changed.lat === 48.85341, 'selected France Paris, not US Paris');
});

test('modal option/hint text is localized (not hardcoded English)', async () => {
  // Force French before evaluating the modal markup logic via open().
  const window = setup(async () => { throw new Error('network'); });
  window.localStorage.setItem('open-meteo-lang', 'fr');
  // Re-evaluate i18n apply by calling the global if present.
  if (window.I18n && window.I18n.apply) window.I18n.apply();
  await selectCountry(window, 'France');
  await new Promise((r) => setTimeout(r, 20));
  const placeholder = window.document.querySelector('.location-city').querySelector('option').textContent;
  assert.notEqual(placeholder, 'Select a city', 'city placeholder should be translated');
});
