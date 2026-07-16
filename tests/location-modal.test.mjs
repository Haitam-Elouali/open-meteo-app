import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOCATION_MODAL_JS = readFileSync(`${__dirname}../src/components/location-modal.js`, 'utf8');

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
  window.fetch = fetchImpl;
  window.eval(LOCATION_MODAL_JS);
  // jsdom (outside-only) keeps readyState 'loading', so fire DOMContentLoaded
  // to run the registered init listener deterministically.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  // open the modal (wires the geo button)
  window.document.querySelector('.header__geo-button').click();
  return window;
}

function selectCountry(window, country) {
  const sel = window.document.querySelector('.location-country');
  sel.value = country;
  sel.dispatchEvent(new window.Event('change'));
}

function cityOptions(window) {
  return Array.from(window.document.querySelector('.location-city').options).map((o) => o.value);
}

test('country with curated cities populates the city select', async () => {
  const window = setup(async () => ({ ok: true, json: async () => ({ results: [] }) }));
  selectCountry(window, 'France');
  await new Promise((r) => setTimeout(r, 20));
  const opts = cityOptions(window);
  assert.ok(opts.includes('Paris'), 'Paris should be available for France');
});

test('country with API cities (no curated list) populates the city select', async () => {
  const window = setup(async (url) => {
    const u = new URL(url, 'http://localhost');
    if (u.searchParams.get('country') === 'Angola') {
      return { ok: true, json: async () => ({ results: [{ name: 'Luanda', country: 'Angola' }, { name: 'Huambo', country: 'Angola' }] }) };
    }
    return { ok: true, json: async () => ({ results: [] }) };
  });
  selectCountry(window, 'Angola');
  await new Promise((r) => setTimeout(r, 20));
  const opts = cityOptions(window);
  assert.ok(opts.includes('Luanda'), 'API-provided city should be available');
});

test('country with NO cities is removed from the dropdown', async () => {
  const window = setup(async (url) => {
    const u = new URL(url, 'http://localhost');
    if (u.searchParams.get('country') === 'Algeria') {
      return { ok: true, json: async () => ({ results: [] }) };
    }
    return { ok: true, json: async () => ({ results: [{ name: 'X', country: 'Y' }] }) };
  });
  const countrySel = window.document.querySelector('.location-country');
  assert.ok(Array.from(countrySel.options).some((o) => o.value === 'Algeria'), 'Algeria present before selection');

  selectCountry(window, 'Algeria');
  await new Promise((r) => setTimeout(r, 30));

  const remaining = Array.from(countrySel.options).map((o) => o.value);
  assert.ok(!remaining.includes('Algeria'), 'Algeria should be removed when it has no cities');
  assert.equal(window.document.querySelector('.location-city').disabled, true, 'city select disabled when no cities');
});

test('api error leaves the city select disabled (no crash)', async () => {
  const window = setup(async () => { throw new Error('network'); });
  selectCountry(window, 'Angola');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(window.document.querySelector('.location-city').disabled, true);
});
