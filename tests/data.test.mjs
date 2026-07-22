import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CITIES = JSON.parse(
  JSON.stringify(require(`${__dirname}../lib/cities-data.js`).CITIES_BY_COUNTRY)
);
const { CAPITALS } = require(`${__dirname}../lib/capitals-data.js`);

// Cities that are NOT in CITIES_BY_COUNTRY and should be added if missing.
// REMOVED_MOROCCO list removed because the user requested expanded city lists.

test('Morocco list covers core curated cities', () => {
  const morocco = CITIES['Morocco'] || [];
  const core = ['Rabat', 'Casablanca', 'Fes', 'Marrakesh', 'Agadir', 'Tangier', 'Oujda', 'Meknes'];
  for (const city of core) {
    assert.ok(morocco.includes(city), `expected core Morocco city missing: ${city}`);
  }
  assert.ok(morocco.length >= 34, `Morocco should have at least 34 cities, got ${morocco.length}`);
});

test('capitals dataset covers every curated country', () => {
  for (const country of Object.keys(CITIES)) {
    assert.ok(CAPITALS[country], `missing capital for ${country}`);
    const [capital, lat, lon] = CAPITALS[country];
    assert.ok(typeof capital === 'string' && capital.length > 0, `bad capital for ${country}`);
    assert.ok(Number.isFinite(lat) && Number.isFinite(lon), `bad coords for ${country}`);
  }
});

test('capitals count matches country count', () => {
  assert.equal(Object.keys(CAPITALS).length, Object.keys(CITIES).length);
});
