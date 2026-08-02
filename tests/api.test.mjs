import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

const realFetch = global.fetch;

function mockUpstream() {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.open-meteo.com/v1/forecast')) {
      if (u.includes('minutely_15')) {
        return {
          ok: true,
          json: async () => ({
            minutely_15: {
              time: ['2026-07-21T14:30', '2026-07-21T14:45', '2026-07-21T15:00'],
              temperature_2m: [20, 21, 22],
            }
          })
        };
      }
      if (u.includes('forecast_days')) {
        return {
          ok: true,
          json: async () => ({
            daily: { temperature_2m_max: [35] }
          })
        };
      }
      return { ok: true, json: async () => ({ current: {}, daily: {} }) };
    }
    if (u.includes('geocoding-api.open-meteo.com')) {
      return { ok: true, json: async () => ({ results: [{ latitude: 34.02, longitude: -6.83, country: 'Morocco' }] }) };
    }
    return { ok: true, json: async () => ({}) };
  };
}

test('/api/hourly with interval=15 returns minutely_15 data normalized to data.hourly', async () => {
  mockUpstream();
  try {
    const handler = require(`${root}api/hourly.js`);
    const res = {
      statusCode: 200,
      body: null,
      json(obj) { this.body = obj; return this; },
      status(code) { this.statusCode = code; return this; }
    };
    await handler({ query: { lat: 34.02, lon: -6.83, interval: '15' } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body?.data?.hourly, 'minutely data should be exposed under data.hourly');
    assert.ok(res.body.data.hourly.time, 'time array missing');
    assert.ok(res.body.data.hourly.temperature_2m, 'temperature_2m array missing');
    assert.equal(res.body.data.hourly.time.length, 3);
    assert.equal(res.body.data.hourly.temperature_2m[2], 22);
  } finally {
    global.fetch = realFetch;
  }
});

test('/api/cities-weather returns cities with maxTemp sorted descending', async () => {
  mockUpstream();
  try {
    const handler = require(`${root}api/cities-weather.js`);
    const res = {
      statusCode: 200,
      body: null,
      json(obj) { this.body = obj; return this; },
      status(code) { this.statusCode = code; return this; }
    };
    await handler({ query: { country: 'Morocco' } }, res);
    assert.equal(res.statusCode, 200);
    const cities = res.body?.cities || [];
    assert.ok(cities.length >= 1, 'expected at least one city');
    const temps = cities.map((c) => c.maxTemp).filter((t) => t != null);
    for (let i = 1; i < temps.length; i++) {
      assert.ok(temps[i - 1] >= temps[i], `cities should be sorted desc: ${temps.join(',')}`);
    }
  } finally {
    global.fetch = realFetch;
  }
});
