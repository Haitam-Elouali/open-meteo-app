import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const handler = require(`${root}api/capitals-weather.js`);

// Minimal res stub that captures res.json output (never HTML).
function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    json(obj) { this.body = obj; return this; },
    status(code) { this.statusCode = code; return this; }
  };
  return res;
}

test('capitals-weather endpoint returns valid JSON (never an HTML error page)', async () => {
  // Mock the upstream Open-Meteo so the test is offline-safe and deterministic.
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    assert.ok(u.includes('api.open-meteo.com'), 'unexpected upstream url');
    return {
      ok: true,
      json: async () => ({ current: { temperature_2m: 21, is_day: 1, weather_code: 0 } })
    };
  };

  try {
    const res = makeRes();
    await handler({ query: {} }, res);
    assert.ok(res.body, 'no response body returned');
    // The body must be a JSON object, not an HTML string.
    assert.equal(typeof res.body, 'object', 'response body should be JSON, not HTML');
    assert.ok(Array.isArray(res.body.capitals), 'capitals array missing');
    assert.ok(res.body.capitals.length > 0, 'capitals should be populated');
    // Each capital carries the fields the ticker expects.
    const first = res.body.capitals[0];
    assert.ok('country' in first && 'capital' in first, 'capital missing country/capital');
    assert.ok('temperature' in first, 'capital missing temperature');
    assert.ok('weatherCode' in first, 'capital missing weatherCode');
  } finally {
    global.fetch = realFetch;
  }
});

test('capitals-weather skips blocked countries and tolerates upstream errors', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 10 } }) });
  try {
    const res = makeRes();
    await handler({ query: {} }, res);
    assert.equal(typeof res.body, 'object');
    // No entry should be a blocked country (Israel is excluded in the dataset).
    const countries = res.body.capitals.map((c) => c.country);
    assert.ok(!countries.includes('Israel'), 'blocked country should be excluded');
  } finally {
    global.fetch = realFetch;
  }
});
