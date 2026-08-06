import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => readFileSync(`${__dirname}../${p}`, 'utf8');

const MAP_HTML = read('src/pages/map/index.html');
const MAP_CSS = read('src/pages/map/map.css');
const MAP_JS = read('src/pages/map/map.js');
const HEADER_CSS = read('src/components/header/header.css');

const MAP_MARKUP = `<!DOCTYPE html><html lang="en"><head></head><body>${MAP_HTML.match(/<body>([\s\S]*?)<\/body>/)[1]}</body></html>`;

function setup() {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(MAP_MARKUP, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.eval(MAP_JS);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

test('map page has settings-modal-backdrop and location-modal-backdrop', () => {
  assert.ok(/settings-modal-backdrop/.test(MAP_HTML), 'map page must have settings modal backdrop');
  assert.ok(/location-modal-backdrop/.test(MAP_HTML), 'map page must have location modal backdrop');
});

test('map page loads settings-modal.js and location-modal.js', () => {
  assert.ok(/settings-modal\.js/.test(MAP_HTML), 'map page must load settings-modal.js');
  assert.ok(/location-modal\.js/.test(MAP_HTML), 'map page must load location-modal.js');
});

test('map page has logo in header__left for desktop visibility', () => {
  assert.ok(/header__left[\s\S]{0,500}header__logo/.test(MAP_HTML), 'map page must have logo in header__left');
});

test('map page does not contain the removed menu elements', () => {
  assert.ok(!/map-control-panel/.test(MAP_HTML), 'map page must not have map-control-panel');
  assert.ok(!/map-tools/.test(MAP_HTML), 'map page must not have map-tools');
  assert.ok(!/map-tool-btn/.test(MAP_HTML), 'map page must not have map-tool-btn');
  assert.ok(!/panel-card/.test(MAP_HTML), 'map page must not have panel-card');
  assert.ok(!/map-layer-toggle/.test(MAP_HTML), 'map page must not have map-layer-toggle');
  assert.ok(!/animation-controls/.test(MAP_HTML), 'map page must not have animation-controls');
  assert.ok(!/anim-speed/.test(MAP_HTML), 'map page must not have anim-speed');
  assert.ok(!/map-sidebar/.test(MAP_HTML), 'map page must not have map-sidebar');
});

test('map page retains essential map elements', () => {
  assert.ok(/map-search/.test(MAP_HTML), 'map page must have map-search');
  assert.ok(/map-geo-btn/.test(MAP_HTML), 'map page must have map-geo-btn');
  assert.ok(/map-refresh-btn/.test(MAP_HTML), 'map page must have map-refresh-btn');
  assert.ok(/map-export-btn/.test(MAP_HTML), 'map page must have map-export-btn');
  assert.ok(/map-legend/.test(MAP_HTML), 'map page must have map-legend');
  assert.ok(/map-timeline/.test(MAP_HTML), 'map page must have map-timeline');
  assert.ok(/map-info-panel/.test(MAP_HTML), 'map page must have map-info-panel');
});

test('map CSS uses dark translucent color palette', () => {
  assert.ok(/rgba\(15,\s*23,\s*42/.test(MAP_CSS), 'map CSS must use dark rgba backgrounds');
  assert.ok(/rgba\(255,\s*255,\s*255/.test(MAP_CSS), 'map CSS must use white text/borders');
});

test('map CSS does not contain removed menu styles', () => {
  assert.ok(!/\.map-control-panel/.test(MAP_CSS), 'map CSS must not have .map-control-panel');
  assert.ok(!/\.map-tools/.test(MAP_CSS), 'map CSS must not have .map-tools');
  assert.ok(!/\.map-tool-btn/.test(MAP_CSS), 'map CSS must not have .map-tool-btn');
  assert.ok(!/\.panel-card/.test(MAP_CSS), 'map CSS must not have .panel-card');
  assert.ok(!/\.map-layer-toggle/.test(MAP_CSS), 'map CSS must not have .map-layer-toggle');
  assert.ok(!/\.animation-controls/.test(MAP_CSS), 'map CSS must not have .animation-controls');
  assert.ok(!/\.anim-speed/.test(MAP_CSS), 'map CSS must not have .anim-speed');
  assert.ok(!/\.map-sidebar/.test(MAP_CSS), 'map CSS must not have .map-sidebar');
});

test('map CSS has responsive breakpoints', () => {
  const mediaQueries = MAP_CSS.match(/@media/g);
  assert.ok(mediaQueries && mediaQueries.length >= 3, 'map CSS must have at least 3 media queries');
  assert.ok(/@media\s*\(max-width:\s*1024px\)/.test(MAP_CSS), 'map CSS must have 1024px breakpoint');
  assert.ok(/@media\s*\(max-width:\s*768px\)/.test(MAP_CSS), 'map CSS must have 768px breakpoint');
  assert.ok(/@media\s*\(max-width:\s*480px\)/.test(MAP_CSS), 'map CSS must have 480px breakpoint');
});

test('map JS does not reference removed elements', () => {
  assert.ok(!/anim-play/.test(MAP_JS), 'map JS must not reference anim-play');
  assert.ok(!/anim-pause/.test(MAP_JS), 'map JS must not reference anim-pause');
  assert.ok(!/anim-next/.test(MAP_JS), 'map JS must not reference anim-next');
  assert.ok(!/anim-prev/.test(MAP_JS), 'map JS must not reference anim-prev');
  assert.ok(!/tool-fullscreen/.test(MAP_JS), 'map JS must not reference tool-fullscreen');
  assert.ok(!/tool-screenshot/.test(MAP_JS), 'map JS must not reference tool-screenshot');
  assert.ok(!/tool-print/.test(MAP_JS), 'map JS must not reference tool-print');
  assert.ok(!/layerToggles/.test(MAP_JS), 'map JS must not reference layerToggles');
  assert.ok(!/forecast-range/.test(MAP_JS), 'map JS must not reference forecast-range');
});

test('map JS retains essential map functionality', () => {
  assert.ok(/searchBtn/.test(MAP_JS), 'map JS must reference searchBtn');
  assert.ok(/geoBtn/.test(MAP_JS), 'map JS must reference geoBtn');
  assert.ok(/refreshBtn/.test(MAP_JS), 'map JS must reference refreshBtn');
  assert.ok(/exportBtn/.test(MAP_JS), 'map JS must reference exportBtn');
  assert.ok(/timelineSlider/.test(MAP_JS), 'map JS must reference timelineSlider');
  assert.ok(/playBtn/.test(MAP_JS), 'map JS must reference playBtn');
  assert.ok(/stopBtn/.test(MAP_JS), 'map JS must reference stopBtn');
  assert.ok(/L\.map/.test(MAP_JS), 'map JS must initialize Leaflet map');
  assert.ok(/L\.tileLayer/.test(MAP_JS), 'map JS must add tile layer');
});

test('header CSS has mobile breakpoint with hamburger and logo hiding', () => {
  assert.ok(/@media\s*\(max-width:\s*640px\)/.test(HEADER_CSS), 'header CSS must have 640px breakpoint');
  assert.ok(/header__hamburger[^}]*display:\s*flex/.test(HEADER_CSS), 'hamburger must be visible on mobile');
  assert.ok(/header__left\s*\.header__logo[^}]*display:\s*none/.test(HEADER_CSS), 'logo in header__left must be hidden on mobile');
  assert.ok(/header__mobile-center[^}]*display:\s*flex/.test(HEADER_CSS), 'mobile center must be visible on mobile');
});

test('header CSS has 768px breakpoint for tablet nav', () => {
  assert.ok(/@media\s*\(max-width:\s*768px\)/.test(HEADER_CSS), 'header CSS must have 768px breakpoint');
});

test('map page HTML has proper closing tags', () => {
  assert.ok(/<\/html>/.test(MAP_HTML), 'map HTML must have closing </html> tag');
  assert.ok(/<\/body>/.test(MAP_HTML), 'map HTML must have closing </body> tag');
  assert.ok(/<\/head>/.test(MAP_HTML), 'map HTML must have closing </head> tag');
});

test('map page has no duplicate script references', () => {
  const scriptMatches = MAP_HTML.match(/<script[^>]*src="[^"]*"[^>]*>/g);
  const srcs = scriptMatches ? scriptMatches.map((s) => s.match(/src="([^"]*)"/)[1]) : [];
  const uniqueSrcs = new Set(srcs);
  assert.equal(srcs.length, uniqueSrcs.size, 'map page must not have duplicate script references');
});