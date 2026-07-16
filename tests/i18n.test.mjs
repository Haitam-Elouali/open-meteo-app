import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const I18N_JS = readFileSync(`${__dirname}../src/components/i18n.js`, 'utf8');

const MARKUP = `
  <nav>
    <a href="/" data-i18n="nav.home">Home</a>
    <a href="/dashboard" data-i18n="nav.dashboard">Dashboard</a>
    <a href="/details" data-i18n="nav.forecast">Details</a>
  </nav>
  <button data-i18n-title="header.geoTitle" title="Choose location">geo</button>
`;

function setup(lang) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${MARKUP}</body></html>`, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (lang) window.localStorage.setItem('open-meteo-lang', lang);
  window.eval(I18N_JS);
  // jsdom (outside-only) keeps readyState 'loading', so fire DOMContentLoaded
  // to run the registered init listener deterministically.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

test('i18n translates nav links and titles for the selected language', () => {
  const window = setup('fr');
  assert.equal(window.document.documentElement.lang, 'fr');
  assert.equal(window.document.querySelector('[data-i18n="nav.home"]').textContent, 'Accueil');
  assert.equal(window.document.querySelector('[data-i18n="nav.dashboard"]').textContent, 'Tableau de bord');
  assert.equal(window.document.querySelector('[data-i18n="nav.forecast"]').textContent, 'Prévisions');
  assert.equal(window.document.querySelector('[data-i18n-title]').getAttribute('title'), 'Choisir la localisation');
});

test('i18n sets document RTL for Arabic so body text reads correctly', () => {
  const window = setup('ar');
  assert.equal(window.document.documentElement.lang, 'ar');
  assert.equal(window.document.documentElement.dir, 'rtl');
});

test('i18n keeps header order LTR (enforced in header.css, not here)', () => {
  const window = setup('en');
  assert.equal(window.document.documentElement.dir, 'ltr');
});

test('i18n falls back to English for unknown language', () => {
  const window = setup('zz');
  assert.equal(window.document.querySelector('[data-i18n="nav.home"]').textContent, 'Home');
  assert.equal(window.document.documentElement.dir, 'ltr');
});
