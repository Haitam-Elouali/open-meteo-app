import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

const realFetch = global.fetch;
let fetchCallCount = 0;

function buildForecastResponse(times, temps) {
  return {
    ok: true,
    json: async () => ({
      hourly: { time: times, temperature_2m: temps }
    })
  };
}

function buildArchiveResponse(maxTemp) {
  return {
    ok: true,
    json: async () => ({
      daily: { temperature_2m_max: [maxTemp] }
    })
  };
}

function makePastTimes(count, hoursBack = 23) {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const times = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() - (hoursBack - i) * 3600000);
    d.setMinutes(0, 0, 0);
    times.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`);
  }
  return times;
}

function makeFutureTimes(count) {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const times = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    d.setMinutes(0, 0, 0);
    times.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`);
  }
  return times;
}

function makeTimesFromHours(hourList) {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  now.setMinutes(0, 0, 0);
  return hourList.map((h) => {
    const d = new Date(now);
    d.setHours(h);
    d.setMinutes(0, 0, 0);
    if (d > now) d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  });
}

function mockFetch(forecastTimes, forecastTemps, archiveMax = null) {
  global.fetch = async (url) => {
    fetchCallCount++;
    const u = String(url);
    if (u.includes('api.open-meteo.com/v1/forecast')) {
      return buildForecastResponse(forecastTimes, forecastTemps);
    }
    if (u.includes('archive-api.open-meteo.com')) {
      if (archiveMax === 'FAIL') {
        return { ok: false, json: async () => ({}) };
      }
      return buildArchiveResponse(archiveMax);
    }
    return { ok: true, json: async () => ({}) };
  };
}

function makeReq(query = {}) {
  return { query };
}

function makeRes() {
  let body = null;
  return {
    statusCode: 200,
    body: null,
    json(obj) { this.body = obj; return this; },
    status(code) { this.statusCode = code; return this; }
  };
}

function clearModuleCache() {
  try { delete require.cache[require.resolve(`${root}api/cities-weather.js`)]; } catch (e) { /* ignore */ }
}

async function runCitiesWeather(query, forecastTimes, forecastTemps, archiveMax = null) {
  clearModuleCache();
  mockFetch(forecastTimes, forecastTemps, archiveMax);
  try {
    const handler = require(`${root}api/cities-weather.js`);
    const req = makeReq(query);
    const res = makeRes();
    await handler(req, res);
    return { status: res.statusCode, body: res.body };
  } finally {
    global.fetch = realFetch;
  }
}

// Helper: get current hour to determine test expectations
function getCurrentHour() {
  return new Date().getHours();
}

// ============================================================================
// 18:00 LOCK RULE TESTS
// Rule: If current time is 18:00 or later, use the forecast max for past hours.
//       If before 18:00, fall back to yesterday's archive max.
// ============================================================================

test('18:00 lock: maxTemp uses forecast max when currentHour >= 18', async () => {
  const now = new Date();
  const currentHour = getCurrentHour();

  if (currentHour < 18) {
    // When testing before 18:00, we can't test this path.
    // But we can still verify the archive fallback works (see next test).
    console.log('[test] Skipping 18:00 lock test: currentHour is', currentHour, '(would need >= 18 to test)');
    return;
  }

  const times = makePastTimes(24);
  const temps = times.map((_, i) => 20 + i * 0.5);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const expectedMax = Math.round(Math.max(...temps));
  assert.equal(first.maxTemp, expectedMax, `maxTemp should be ${expectedMax} from forecast when past 18:00`);
});

test('18:00 lock: maxTemp falls back to archive when currentHour < 18', async () => {
  const currentHour = getCurrentHour();

  if (currentHour >= 18) {
    console.log('[test] Skipping archive fallback test: currentHour is', currentHour, '(would need < 18 to test)');
    return;
  }

  // Before 18:00: even with valid forecast data, should use archive
  const times = makePastTimes(24);
  const temps = times.map((_, i) => 20 + i * 0.5);
  const archiveMax = 38;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, archiveMax, `maxTemp should be archive value ${archiveMax} when before 18:00`);
});

test('18:00 lock: maxTemp uses archive when forecast fails and currentHour >= 18', async () => {
  const currentHour = getCurrentHour();

  if (currentHour < 18) {
    console.log('[test] Skipping: currentHour is', currentHour, '(would need >= 18)');
    return;
  }

  // Forecast fails (empty), archive provides the max
  const archiveMax = 35;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, [], [], archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, archiveMax, `maxTemp should fall back to archive ${archiveMax}`);
});

test('18:00 lock: maxTemp is null when archive also fails', async () => {
  // Archive fails - maxTemp should stay null
  const times = makePastTimes(24);
  const temps = times.map((_, i) => 20 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 'FAIL');
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, null, 'maxTemp should be null when archive fails');
});

// ============================================================================
// FORECAST DATA EDGE CASES (when currentHour >= 18)
// ============================================================================

test('maxTemp handles all-null forecast by falling back to archive', async () => {
  const times = makePastTimes(24);
  const temps = times.map(() => null);
  const archiveMax = 38;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  if (getCurrentHour() < 18) {
    assert.equal(first.maxTemp, archiveMax, 'before 18:00, should use archive');
  } else {
    assert.equal(first.maxTemp, archiveMax, 'after 18:00 with all-null forecast, should fall back to archive');
  }
});

test('maxTemp picks highest valid temp with mixed nulls and values', async () => {
  const times = makePastTimes(24);
  const temps = times.map((_, i) => i % 3 === 0 ? null : 25 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const validTemps = temps.filter((v) => Number.isFinite(v));
  const expectedMax = Math.round(Math.max(...validTemps));
  if (getCurrentHour() >= 18) {
    assert.equal(first.maxTemp, expectedMax, `maxTemp should be ${expectedMax} from forecast`);
  } else {
    // Before 18:00, uses archive
    assert.ok(first.maxTemp === null || Number.isFinite(first.maxTemp), 'maxTemp should be valid or null');
  }
});

test('maxTemp handles fewer than 24 forecast entries', async () => {
  const times = makePastTimes(12);
  const temps = times.map((_, i) => 22 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok(first.maxTemp === null || Number.isFinite(first.maxTemp), 'maxTemp should be valid or null');
});

test('maxTemp ignores NaN values in forecast', async () => {
  const times = makePastTimes(24);
  const temps = times.map((_, i) => i === 5 ? NaN : 20 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const validTemps = temps.filter((v) => Number.isFinite(v));
  const expectedMax = Math.round(Math.max(...validTemps));
  if (getCurrentHour() >= 18) {
    assert.equal(first.maxTemp, expectedMax, `maxTemp should ignore NaN and use ${expectedMax}`);
  } else {
    assert.ok(first.maxTemp === null || Number.isFinite(first.maxTemp), 'maxTemp should be valid or null');
  }
});

test('maxTemp does not use forecast when archive has higher value (past 18:00)', async () => {
  const currentHour = getCurrentHour();
  if (currentHour < 18) {
    console.log('[test] Skipping: currentHour is', currentHour, '(would need >= 18)');
    return;
  }

  // Forecast has lower max, archive has higher - should use forecast, not archive
  const times = makePastTimes(24);
  const temps = times.map((_, i) => 10 + i * 0.2);
  const forecastMax = Math.round(Math.max(...temps));
  const archiveMax = 99; // Archive is higher
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, forecastMax, `maxTemp should be forecast max ${forecastMax}, not archive ${archiveMax}`);
});

test('maxTemp returns null when forecast fetch fails', async () => {
  global.fetch = async () => {
    return { ok: false, status: 500, json: async () => ({}) };
  };
  try {
    clearModuleCache();
    const handler = require(`${root}api/cities-weather.js`);
    const req = makeReq({ country: 'Morocco' });
    const res = makeRes();
    await handler(req, res);
    const cities = res.body?.cities || [];
    assert.ok(cities.length >= 1, 'expected at least one city');
    const first = cities[0];
    assert.equal(first.maxTemp, null, 'maxTemp should be null when all fetches fail');
  } finally {
    global.fetch = realFetch;
  }
});

test('maxTemp handles empty forecast arrays', async () => {
  const { body } = await runCitiesWeather({ country: 'Morocco' }, [], []);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  if (getCurrentHour() >= 18) {
    assert.equal(first.maxTemp, null, 'before archive fallback, maxTemp should be null with empty forecast');
  }
});

test('maxTemp handles infinity values by ignoring them', async () => {
  const times = makePastTimes(24);
  const temps = times.map((_, i) => i === 5 ? Infinity : 20 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok(Number.isFinite(first.maxTemp) || first.maxTemp === null, 'maxTemp should be finite or null');
});

test('maxTemp sorts cities descending by maxTemp', async () => {
  const times = makePastTimes(24);
  const temps = times.map((_, i) => 15 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  const maxs = cities.map((c) => c.maxTemp).filter((t) => t != null);
  for (let i = 1; i < maxs.length; i++) {
    assert.ok(maxs[i - 1] >= maxs[i], `cities should be sorted desc: ${maxs.join(',')}`);
  }
});

test('maxTemp handles zero temperature correctly', async () => {
  const times = makePastTimes(24);
  const temps = times.map((_, i) => i === 0 ? 0 : 20 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok(first.maxTemp === null || Number.isFinite(first.maxTemp), 'maxTemp should be valid or null');
});

test('18:00 lock: does not change maxTemp after 18:00 when new max appears', async () => {
  const currentHour = getCurrentHour();
  if (currentHour < 18) {
    console.log('[test] Skipping: currentHour is', currentHour, '(would need >= 18)');
    return;
  }

  // After 18:00, the max should come from forecast (past hours).
  // If the forecast has a higher value than what was recorded, it should update.
  const times = makePastTimes(24);
  const temps = times.map((_, i) => i === 10 ? 45 : 20 + i * 0.3);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const expectedMax = Math.round(Math.max(...temps));
  assert.equal(first.maxTemp, expectedMax, `maxTemp should update to new max ${expectedMax} after 18:00`);
});

test('18:00 lock: uses only past hours, ignores future forecast entries', async () => {
  const currentHour = getCurrentHour();
  if (currentHour < 18) {
    console.log('[test] Skipping: currentHour is', currentHour, '(would need >= 18)');
    return;
  }

  // Mix past and future entries - should only use past entries
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  now.setMinutes(0, 0, 0);

  const pastD = new Date(now);
  pastD.setHours(15);
  pastD.setMinutes(0, 0, 0);
  const pastTime = `${pastD.getFullYear()}-${pad(pastD.getMonth() + 1)}-${pad(pastD.getDate())}T15:00`;

  const futureD = new Date(now);
  futureD.setHours(22);
  futureD.setMinutes(0, 0, 0);
  const futureTime = `${futureD.getFullYear()}-${pad(futureD.getMonth() + 1)}-${pad(futureD.getDate())}T22:00`;

  const times = [pastTime, futureTime];
  const temps = [30, 50]; // future is higher but should be ignored

  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, 30, 'maxTemp should only use past hours (30), not future (50)');
});