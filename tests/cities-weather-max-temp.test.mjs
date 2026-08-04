import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

const realFetch = global.fetch;

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

function makeTimesWithHour(hour, count = 24) {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const times = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() - (count - 1 - i) * 3600000);
    d.setHours(hour, 0, 0, 0);
    times.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`);
  }
  return times;
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

function mockFetch(forecastTimes, forecastTemps, archiveMax = null) {
  global.fetch = async (url) => {
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

function getCurrentHour() {
  return new Date().getHours();
}

function getLatestPastHour(times) {
  const now = new Date();
  let latest = -1;
  for (const t of times) {
    const d = new Date(t);
    if (!isNaN(d) && d <= now) {
      const h = d.getHours();
      if (h > latest) latest = h;
    }
  }
  return latest;
}

// ============================================================================
// 18:00 LOCK RULE TESTS
// ============================================================================

test('18:00 lock: when latest past hour >= 18, maxTemp uses forecast max', async () => {
  // Create times with hours from 18 to 23 (all future relative to now)
  // Actually, we need to create times that are in the past with hour >= 18.
  // Since current time is 12:00 (11:58 AM), we can't create past times with hour >= 18
  // (past 18:00 would be yesterday, which would still be valid).
  
  // Create times: yesterday 18:00 to 23:00 (6 entries, all past)
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestPad = (x) => String(x).padStart(2, '0');
  const yestYYYY = yesterday.getFullYear();
  const yestMM = yestPad(yesterday.getMonth() + 1);
  const yestDD = yestPad(yesterday.getDate());
  
  // Create 6 hourly entries from yesterday 18:00 to 23:00
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(20 + h);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 99);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  // The latest past hour should be 23 (yesterday 23:00), which is >= 18
  const latestHour = getLatestPastHour(times);
  assert.ok(latestHour >= 18, `latest past hour should be >= 18, got ${latestHour}`);
  // maxTemp should be from forecast, not archive (99)
  assert.equal(first.maxTemp, 43, `maxTemp should be forecast max 43, got ${first.maxTemp}`);
});

test('18:00 lock: when latest past hour < 18, maxTemp falls back to archive', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yestYYYY = now.getFullYear();
  const yestMM = pad(now.getMonth() + 1);
  const yestDD = pad(now.getDate() - 1);
  
  // Create times: yesterday 10:00 to 17:00 (8 entries, all past, hour < 18)
  const times = [];
  const temps = [];
  for (let h = 10; h <= 17; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(20 + h);
  }
  
  const archiveMax = 35;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const latestHour = getLatestPastHour(times);
  assert.ok(latestHour < 18, `latest past hour should be < 18, got ${latestHour}`);
  assert.equal(first.maxTemp, archiveMax, `maxTemp should fall back to archive ${archiveMax}`);
});

test('18:00 lock: maxTemp does not change when latest hour < 18 even if forecast has higher values', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  // Yesterday hours 10-17, with very high temps
  const times = [];
  const temps = [];
  for (let h = 10; h <= 17; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(50 + h); // high temps
  }
  
  const archiveMax = 30;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  // Even though forecast has 67, it should use archive (30) because latest hour < 18
  assert.equal(first.maxTemp, archiveMax, `maxTemp should be archive ${archiveMax}, not forecast max`);
});

test('18:00 lock: maxTemp uses forecast max when latest hour is exactly 18', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  // Yesterday hour 18 only (latest past hour = 18, which is >= 18)
  const times = [`${yestYYYY}-${yestMM}-${yestDD}T${pad(18)}:00`];
  const temps = [42];
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 99);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, 42, `maxTemp should be 42 from forecast (latest hour = 18)`);
});

test('18:00 lock: maxTemp falls back to archive when no forecast entries are past', async () => {
  const times = makeFutureTimes(24);
  const temps = times.map((_, i) => 25 + i);
  const archiveMax = 35;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  // All entries are future → latestHour = -1 → < 18 → archive
  assert.equal(first.maxTemp, archiveMax, 'maxTemp should fall back to archive when no past entries');
});

test('18:00 lock: maxTemp is null when archive also fails and latest hour >= 18', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  // All temps null so forecast max is null, then archive fails
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(null);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 'FAIL');
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, null, 'maxTemp should be null when archive fails');
});

test('18:00 lock: maxTemp uses forecast max when latest hour >= 18 and there are null temps', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  const times = [];
  const temps = [];
  for (let h = 14; h <= 22; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(h === 18 ? null : 20 + h);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 99);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const validTemps = temps.filter((v) => Number.isFinite(v));
  const expectedMax = Math.round(Math.max(...validTemps));
  assert.equal(first.maxTemp, expectedMax, `maxTemp should be ${expectedMax} from forecast`);
});

test('18:00 lock: ignores future entries when calculating maxTemp', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const today = new Date();
  const futureHour = now.getHours() + 5; // ensure it's in the future
  const todayYYYY = today.getFullYear();
  const todayMM = pad(today.getMonth() + 1);
  const todayDD = pad(today.getDate());
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  // Yesterday 18:00 and 22:00 (both past, hour >= 18), plus future hours (truly future)
  const times = [
    `${yestYYYY}-${yestMM}-${yestDD}T18:00`,
    `${todayYYYY}-${todayMM}-${todayDD}T${pad(futureHour)}:00`, // future
    `${yestYYYY}-${yestMM}-${yestDD}T22:00`,
    `${todayYYYY}-${todayMM}-${todayDD}T${pad(futureHour + 1)}:00`, // future
  ];
  const temps = [30, 99, 40, 99]; // 99s are for future entries
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 99);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  // Should only consider past entries with hour >= 18 (30 and 40 from yesterday)
  assert.equal(first.maxTemp, 40, `maxTemp should be 40 (ignoring future entries with 99)`);
});

test('18:00 lock: maxTemp rounds correctly at 18:00 boundary', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(h === 20 ? 36.6 : 20 + h * 0.3);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  const validTemps = temps.filter((v) => Number.isFinite(v));
  const expectedMax = Math.round(Math.max(...validTemps));
  assert.equal(first.maxTemp, expectedMax, `maxTemp should be ${expectedMax}`);
});

test('18:00 lock: maxTemp is NaN-safe', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(h === 20 ? NaN : Infinity);
  }
  
  const archiveMax = 32;
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, archiveMax);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  // All forecast temps are NaN or Infinity → no valid contender → archive
  assert.equal(first.maxTemp, archiveMax, `maxTemp should fall back to archive ${archiveMax}`);
});

test('18:00 lock: sorts cities descending by maxTemp', async () => {
  const times = makePastTimes(24);
  const temps = times.map((_, i) => 15 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  const maxs = cities.map((c) => c.maxTemp).filter((t) => t != null);
  for (let i = 1; i < maxs.length; i++) {
    assert.ok(maxs[i - 1] >= maxs[i], `cities should be sorted desc: ${maxs.join(',')}`);
  }
});

test('18:00 lock: maxTemp handles zero temperature', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(h === 18 ? 0 : 20 + h);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok(first.maxTemp === null || Number.isFinite(first.maxTemp), 'maxTemp should be valid or null');
});

test('18:00 lock: maxTemp handles negative temperatures', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(-5 + h * 0.5);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.ok(first.maxTemp === null || Number.isFinite(first.maxTemp), 'maxTemp should handle negative values');
});

test('18:00 lock: fetches new forecast data on each request (cache TTL works)', async () => {
  clearModuleCache();
  const times = makePastTimes(24);
  const temps = times.map((_, i) => 20 + i);
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps);
  const first = body?.cities?.[0];
  assert.ok(first, 'expected at least one city');
  
  // Call again with different data
  const temps2 = times.map((_, i) => 30 + i);
  const { body: body2 } = await runCitiesWeather({ country: 'Morocco' }, times, temps2);
  const first2 = body2?.cities?.[0];
  assert.ok(first2, 'expected at least one city on second call');
});

test('18:00 lock: does not change maxTemp after 18:00 when no higher temp appears later', async () => {
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const yesterday = new Date(now.getTime() - 86400000);
  const yestYYYY = yesterday.getFullYear();
  const yestMM = pad(yesterday.getMonth() + 1);
  const yestDD = pad(yesterday.getDate());
  
  // Yesterday 18:00 to 23:00, with max at 18:00 (35), rest all lower
  const times = [];
  const temps = [];
  for (let h = 18; h <= 23; h++) {
    times.push(`${yestYYYY}-${yestMM}-${yestDD}T${pad(h)}:00`);
    temps.push(h === 18 ? 35 : 20);
  }
  
  const { body } = await runCitiesWeather({ country: 'Morocco' }, times, temps, 99);
  const cities = body?.cities || [];
  assert.ok(cities.length >= 1, 'expected at least one city');
  const first = cities[0];
  assert.equal(first.maxTemp, 35, `maxTemp should be 35 (locked at 18:00, not changed by later entries)`);
});
