import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

const realFetch = global.fetch;

function buildForecastResponse(times, temps, dailyMin = null, dailyMax = null) {
  return {
    ok: true,
    json: async () => ({
      hourly: { time: times, temperature_2m: temps },
      daily: { temperature_2m_min: dailyMin !== null ? [dailyMin] : [], temperature_2m_max: dailyMax !== null ? [dailyMax] : [] }
    })
  };
}

function buildArchiveResponse(minTemp, maxTemp) {
  return {
    ok: true,
    json: async () => ({
      daily: { temperature_2m_min: [minTemp], temperature_2m_max: [maxTemp] }
    })
  };
}

function mockFetch(forecastTimes, forecastTemps, minTemp, maxTemp) {
  let dailyMin = null;
  let dailyMax = null;
  if (minTemp !== undefined && minTemp !== null && Number.isFinite(Number(minTemp))) dailyMin = Number(minTemp);
  if (maxTemp !== undefined && maxTemp !== null && Number.isFinite(Number(maxTemp))) dailyMax = Number(maxTemp);
  
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.open-meteo.com/v1/forecast')) {
      return buildForecastResponse(forecastTimes, forecastTemps, dailyMin, dailyMax);
    }
    if (u.includes('archive-api.open-meteo.com')) {
      if (minTemp === 'FAIL' || maxTemp === 'FAIL') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (dailyMin !== null || dailyMax !== null) {
        return buildArchiveResponse(dailyMin, dailyMax);
      }
      return { ok: false, json: async () => ({}) };
    }
    if (u.includes('geocoding-api.open-meteo.com')) {
      return {
        ok: true,
        json: async () => ({
          results: [{ name: 'Test City', latitude: 32.0, longitude: -5.0, country: 'Morocco' }]
        })
      };
    }
    return { ok: true, json: async () => ({}) };
  };
}

function makeReq(query = {}) {
  return { query };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    json(obj) { this.body = obj; return this; },
    status(code) { this.statusCode = code; return this; }
  };
}

async function runCitiesWeather(query, forecastTimes, forecastTemps, minTemp, maxTemp) {
  try {
    const handler = require(`${root}api/cities-weather.js`);
    if (handler.clearCache) handler.clearCache();
    mockFetch(forecastTimes, forecastTemps, minTemp, maxTemp);
    const req = makeReq(query);
    const res = makeRes();
    await handler(req, res);
    return { status: res.statusCode, body: res.body };
  } finally {
    global.fetch = realFetch;
  }
}

test('minTemp is returned from daily temperature_2m_min when available', async () => {
  const times = [];
  const temps = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-08-04T${String(h).padStart(2, '0')}:00`);
    temps.push(20 + h);
  }
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 10, 35);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.minTemp, 10, 'minTemp should be 10 from daily');
  assert.equal(first.maxTemp, 35, 'maxTemp should be 35 from daily');
});

test('minTemp is computed from hourly temps when latest hour >= 18', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  
  const times = [];
  const temps = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-08-04T${pad(h)}:00`);
    temps.push(25 - h);
  }

  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 5, 40);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok(first.minTemp !== null, 'minTemp should not be null');
  assert.ok(Number.isFinite(first.minTemp), 'minTemp should be a finite number');
  const latestHour = now.getUTCHours();
  if (latestHour >= 18) {
    assert.equal(first.minTemp, 15, 'minTemp should be 15 (lowest of 25-4 range)');
    assert.equal(first.maxTemp, 25, 'maxTemp should be 25 (highest of 25-4 range)');
  } else {
    assert.equal(first.minTemp, 5, 'minTemp should be 5 from daily (since latestHour < 18)');
    assert.equal(first.maxTemp, 40, 'maxTemp should be 40 from daily');
  }
});

test('minTemp handles negative temperatures correctly', async () => {
  const times = [];
  const temps = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-08-04T${String(h).padStart(2, '0')}:00`);
    temps.push(-5 - h);
  }

  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, -30, -5);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.minTemp, -30, 'minTemp should be -30 from daily');
  assert.equal(first.maxTemp, -5, 'maxTemp should be -5 from daily');
});

test('minTemp is null when archive fails and no hourly data for latest hour >= 18', async () => {
  const times = [];
  const temps = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-08-04T${String(h).padStart(2, '0')}:00`);
    temps.push(20 + h);
  }
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 'FAIL', 'FAIL');
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const latestHour = new Date().getUTCHours();
  if (latestHour < 18) {
    assert.equal(first.minTemp, null, 'minTemp should be null when archive fails');
    assert.equal(first.maxTemp, null, 'maxTemp should be null when archive fails');
  } else {
    assert.ok(first.minTemp !== null, 'minTemp should be computed from hourly when latestHour >= 18');
  }
});

test('response includes minTemp field', async () => {
  const times = [];
  const temps = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-08-04T${String(h).padStart(2, '0')}:00`);
    temps.push(20 + h);
  }
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 15, 30);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok('minTemp' in first, 'response should include minTemp field');
  assert.ok('maxTemp' in first, 'response should include maxTemp field');
});

test('minTemp can be zero', async () => {
  const times = [];
  const temps = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-08-04T${String(h).padStart(2, '0')}:00`);
    temps.push(10 - h);
  }
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 0, 20);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.minTemp, 0, 'minTemp should be 0');
  assert.equal(first.maxTemp, 20, 'maxTemp should be 20');
});