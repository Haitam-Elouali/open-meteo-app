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

// Cities that were deliberately removed from the curated Morocco list.
const REMOVED_MOROCCO = [
  'Ait-Melloul', 'Ben-Guerir', 'Bouarfa', 'Nouaceur', 'Salé',
  'Souk El Arbaa', 'Youssoufia', 'Bouznika', 'Benslimane',
  'Sidi Slimane', 'Sidi Kacem', 'Tiflet', 'Taourirt', 'Oulad Teima',
  'Akka', 'Assa', 'Mirleft', "M'Diq", 'Fnideq', 'Martil', 'Asilah',
  'Jerada', 'Figuig', 'Boujdour', 'Smara', 'Tan-Tan', 'Guelmim'
];

test('specified + district Morocco cities are removed from the curated list', () => {
  const morocco = CITIES['Morocco'] || [];
  for (const city of REMOVED_MOROCCO) {
    assert.ok(!morocco.includes(city), `unexpected Morocco city still present: ${city}`);
  }
  // Core real cities must remain.
  for (const city of ['Rabat', 'Casablanca', 'Fes', 'Marrakesh', 'Agadir', 'Tangier']) {
    assert.ok(morocco.includes(city), `expected real Morocco city missing: ${city}`);
  }
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
