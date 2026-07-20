import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SETTINGS_MODAL_JS = readFileSync(
  `${__dirname}../src/components/settings-modal.js`,
  'utf8'
);

const SETTINGS_MARKUP = `
  <button id="settings-button" type="button">Settings</button>
  <div class="settings-modal-backdrop" hidden>
    <div class="settings-modal" role="dialog" aria-modal="true">
      <div class="settings-modal-header">
        <h2>Settings</h2>
        <button class="settings-modal-close" type="button">&times;</button>
      </div>
      <div class="settings-modal-body">
        <section class="settings-section">
          <h3>Units</h3>
          <select class="settings-select" id="temp-unit-select">
            <option value="c">Celsius (°C)</option>
            <option value="f">Fahrenheit (°F)</option>
          </select>
          <select class="settings-select" id="wind-unit-select">
            <option value="kmh">km/h</option>
            <option value="kn">kn</option>
            <option value="ms">m/s</option>
          </select>
        </section>
        <section class="settings-section">
          <h3>Language</h3>
          <select class="settings-select" id="settings-lang-select">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="ar">العربية</option>
          </select>
        </section>
      </div>
      <div class="settings-modal-footer">
        <button class="settings-cancel" type="button">Cancel</button>
        <button class="settings-confirm primary" type="button">Confirm</button>
      </div>
    </div>
  </div>
`;

function setup(initialStorage = {}) {
  // jsdom's window.location.reload is non-writable, so we detect the reload
  // attempt via the "navigation" jsdomError it emits.
  let reloadedTarget = null;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => {
    if (err && /navigation/.test(String(err.message || '')) && reloadedTarget) {
      reloadedTarget.__reloaded = true;
    }
  });

  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${SETTINGS_MARKUP}</body></html>`, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  reloadedTarget = window;
  window.__reloaded = false;

  for (const [k, v] of Object.entries(initialStorage)) {
    window.localStorage.setItem(k, v);
  }

  // Execute the modal IIFE inside the window context.
  window.eval(SETTINGS_MODAL_JS);

  return window;
}

function openModal(window) {
  window.document.getElementById('settings-button').click();
}

function setSelect(window, id, value) {
  const el = window.document.getElementById(id);
  el.value = value;
}

function confirm(window) {
  window.document.querySelector('.settings-confirm').click();
}

function cancel(window) {
  window.document.querySelector('.settings-cancel').click();
}

function storageOf(window) {
  return {
    tempUnit: window.localStorage.getItem('open-meteo-temp-unit'),
    windUnit: window.localStorage.getItem('open-meteo-wind-unit'),
    lang: window.localStorage.getItem('open-meteo-lang'),
  };
}

test('open() syncs selects from saved storage', () => {
  const window = setup({
    'open-meteo-temp-unit': 'f',
    'open-meteo-wind-unit': 'kn',
    'open-meteo-lang': 'fr',
  });
  openModal(window);
  assert.equal(window.document.getElementById('temp-unit-select').value, 'f');
  assert.equal(window.document.getElementById('wind-unit-select').value, 'kn');
  assert.equal(window.document.getElementById('settings-lang-select').value, 'fr');
});

test('confirm() saves ALL settings (changing one preserves the others)', () => {
  const window = setup({
    'open-meteo-temp-unit': 'f',
    'open-meteo-wind-unit': 'kn',
    'open-meteo-lang': 'fr',
  });
  openModal(window);
  // Change ONLY the temp unit, then confirm.
  setSelect(window, 'temp-unit-select', 'c');

  confirm(window);

  const s = storageOf(window);
  assert.equal(s.tempUnit, 'c', 'changed setting should be saved');
  assert.equal(s.windUnit, 'kn', 'untouched setting must NOT reset');
  assert.equal(s.lang, 'fr', 'untouched setting must NOT reset');
});

test('changing language only preserves temp/wind', () => {
  const window = setup({
    'open-meteo-temp-unit': 'f',
    'open-meteo-wind-unit': 'kn',
    'open-meteo-lang': 'en',
  });
  openModal(window);
  setSelect(window, 'settings-lang-select', 'es');
  confirm(window);

  const s = storageOf(window);
  assert.equal(s.lang, 'es');
  assert.equal(s.tempUnit, 'f');
  assert.equal(s.windUnit, 'kn');
});

test('confirm() triggers a page reload so settings propagate', () => {
  const window = setup({ 'open-meteo-theme': 'light' });
  openModal(window);
  confirm(window);
  assert.equal(window.__reloaded, true);
});

test('cancel() does not write to storage', () => {
  const window = setup({
    'open-meteo-temp-unit': 'f',
  });
  openModal(window);
  setSelect(window, 'temp-unit-select', 'c');
  cancel(window);

  const s = storageOf(window);
  assert.equal(s.tempUnit, 'f', 'cancel must not persist changes');
});

test('empty storage uses defaults and persists them on confirm', () => {
  const window = setup({});
  openModal(window);
  assert.equal(window.document.getElementById('temp-unit-select').value, 'c');
  assert.equal(window.document.getElementById('wind-unit-select').value, 'kmh');
  assert.equal(window.document.getElementById('settings-lang-select').value, 'en');

  confirm(window);

  const s = storageOf(window);
  assert.equal(s.tempUnit, 'c');
  assert.equal(s.windUnit, 'kmh');
  assert.equal(s.lang, 'en');
});

test('close button hides the modal', () => {
  const window = setup({});
  openModal(window);
  const backdrop = window.document.querySelector('.settings-modal-backdrop');
  assert.equal(backdrop.hidden, false);
  window.document.querySelector('.settings-modal-close').click();
  assert.equal(backdrop.hidden, true);
});
