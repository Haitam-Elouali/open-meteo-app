import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => readFileSync(`${__dirname}../${p}`, 'utf8');

const headerCss = read('src/components/header/header.css');
const globalCss = read('src/components/global.css');
const detailsCss = read('src/pages/details/details.css');
const dashboardCss = read('src/pages/dashboard/dashboard.css');

test('header does not use 100vw (avoids horizontal scroll) and can wrap', () => {
  assert.ok(!/width:\s*100vw/.test(headerCss), 'header must not use width:100vw');
  assert.ok(/flex-wrap:\s*wrap/.test(headerCss), 'header should allow wrapping');
});

test('header has a mobile breakpoint that un-centers the nav (LTR order)', () => {
  assert.ok(/@media/.test(headerCss), 'header should have a media query');
  // nav must drop the absolute centering on small screens so it stacks LTR
  assert.ok(/position:\s*static/.test(headerCss), 'nav should become static on mobile');
});

test('header is forced LTR even when the document is RTL (Arabic)', () => {
  // .header must declare direction: ltr so its order is never flipped
  assert.ok(/\.header\s*\{[^}]*direction:\s*ltr/.test(headerCss), 'header must be direction: ltr');
});

test('global body wraps content for small screens', () => {
  assert.ok(/flex-wrap:\s*wrap/.test(globalCss), 'body should wrap');
});

test('details forecast toolbar is aligned with the card (arrow offset, RTL-aware) and resets on mobile', () => {
  // logical property so it aligns in both LTR and RTL (Arabic)
  assert.ok(/\.forecast-toolbar[^}]*margin-inline-start:\s*48px/.test(detailsCss), 'toolbar should offset by arrow width (logical)');
  assert.ok(/@media/.test(detailsCss), 'details page should have a media query');
});

test('dashboard and details pages define responsive breakpoints', () => {
  assert.ok(/@media/.test(dashboardCss), 'dashboard should have a media query');
  assert.ok(/@media/.test(detailsCss), 'details should have a media query');
});
