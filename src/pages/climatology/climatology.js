(function () {
  const $ = (sel) => document.querySelector(sel);
  const U = (window.Units || {});
  const LANG = (() => {
    try { return localStorage.getItem('open-meteo-lang') || 'en'; }
    catch (e) { return 'en'; }
  })();

  const FETCH_CACHE_KEY = 'open-meteo-climatology-cache';
  const FETCH_CACHE_TTL = 10 * 60 * 1000;

  function getLatLon() {
    try {
      const raw = localStorage.getItem('open-meteo-latlon');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
          return parsed;
        }
      }
    } catch (e) {}
    return { lat: 31.6346, lon: -8.0779, name: 'Marrakech' };
  }

  function iconId(code) {
    const c = Number(code) || 0;
    if ([95, 96, 99].includes(c)) return 'thunder';
    if (c >= 80) return 'rainy-4';
    if (c >= 71) return 'snowy-3';
    if ([45, 48].includes(c)) return 'cloudy';
    if (c >= 51) return 'rainy-4';
    if (c >= 2) return 'cloudy';
    if (c === 1) return 'cloudy-day-1';
    return 'day';
  }

  function weatherLabel(code) {
    const c = Number(code) || 0;
    if ([95, 96, 99].includes(c)) return 'Thunderstorm';
    if (c >= 80) return 'Rain';
    if (c >= 71) return 'Snow';
    if ([45, 48].includes(c)) return 'Fog';
    if (c >= 51) return 'Drizzle';
    if (c >= 2) return 'Cloudy';
    if (c === 1) return 'Partly cloudy';
    return 'Clear';
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // ERA5 archive has no uv_index. When it is missing we estimate UV from the
  // shortwave (solar) radiation that the archive does provide. Daylight peak
  // clear-sky radiation is ~1000 W/m², so dividing by ~95 gives a UV index in
  // the right 0–11+ range. Nighttime/zero radiation yields null.
  function uvValue(uvs, sw, i) {
    if (uvs && Number.isFinite(uvs[i]) && uvs[i] > 0) return uvs[i];
    const rad = sw && Number.isFinite(sw[i]) ? sw[i] : null;
    if (rad == null || rad <= 0) return null;
    return Math.max(0, Math.round((rad / 95) * 10) / 10);
  }

  async function fetchClimatology(lat, lon, date, hour) {
    try {
      const url = new URL('/api/archive', window.location.origin);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('date', date);

      const cacheKey = `${lat},${lon},${date},${hour}`;
      try {
        const raw = localStorage.getItem(FETCH_CACHE_KEY);
        if (raw) {
          const cache = JSON.parse(raw);
          if (cache && cache.data && cache.expires > Date.now() && cache.key === cacheKey) {
            return cache.data;
          }
        }
      } catch (e) {}

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Archive API error: ' + res.status);
      const json = await res.json();
      const data = json?.data || {};
      const times = data?.hourly?.time || [];
      const temps = data?.hourly?.temperature_2m || [];
      const feels = data?.hourly?.apparent_temperature || [];
      const hums = data?.hourly?.relative_humidity_2m || [];
      const codes = data?.hourly?.weather_code || [];
      const precips = data?.hourly?.precipitation || [];
      const winds = data?.hourly?.wind_speed_10m || [];
      const pressures = data?.hourly?.surface_pressure || [];
      const clouds = data?.hourly?.cloud_cover || [];
      const uvs = data?.hourly?.uv_index || [];
      const sw = data?.hourly?.shortwave_radiation || [];

      const target = `${date}T${pad2(hour)}:00`;
      const idx = times.indexOf(target);
      if (idx < 0) {
        const fallback = times.findIndex((t) => {
          const d = new Date(t);
          return d.getHours() === Number(hour);
        });
        const useIdx = fallback >= 0 ? fallback : -1;
        if (useIdx < 0) return null;
        const row = {
          temp: Number.isFinite(temps[useIdx]) ? temps[useIdx] : null,
          feels: Number.isFinite(feels[useIdx]) ? feels[useIdx] : null,
          humidity: Number.isFinite(hums[useIdx]) ? hums[useIdx] : null,
          code: codes[useIdx] ?? 0,
          precip: Number.isFinite(precips[useIdx]) ? precips[useIdx] : null,
          wind: Number.isFinite(winds[useIdx]) ? winds[useIdx] : null,
          pressure: Number.isFinite(pressures[useIdx]) ? pressures[useIdx] : null,
          cloud: Number.isFinite(clouds[useIdx]) ? clouds[useIdx] : null,
          uv: uvValue(uvs, sw, useIdx),
          hourly: { times, temps }
        };
        try {
          localStorage.setItem(FETCH_CACHE_KEY, JSON.stringify({ key: cacheKey, data: row, expires: Date.now() + FETCH_CACHE_TTL }));
        } catch (e) {}
        return row;
      }

      const row = {
        temp: Number.isFinite(temps[idx]) ? temps[idx] : null,
        feels: Number.isFinite(feels[idx]) ? feels[idx] : null,
        humidity: Number.isFinite(hums[idx]) ? hums[idx] : null,
        code: codes[idx] ?? 0,
        precip: Number.isFinite(precips[idx]) ? precips[idx] : null,
        wind: Number.isFinite(winds[idx]) ? winds[idx] : null,
        pressure: Number.isFinite(pressures[idx]) ? pressures[idx] : null,
        cloud: Number.isFinite(clouds[idx]) ? clouds[idx] : null,
        uv: uvValue(uvs, sw, idx),
        hourly: { times, temps }
      };
      try {
        localStorage.setItem(FETCH_CACHE_KEY, JSON.stringify({ key: cacheKey, data: row, expires: Date.now() + FETCH_CACHE_TTL }));
      } catch (e) {}
      return row;
    } catch (e) {
      console.error('[climatology] fetchClimatology error', e);
      throw e;
    }
  }

  function renderResult(row) {
    const result = $('#climatology-result');
    const loading = result && result.querySelector('.climatology-loading');
    const dataBox = result && result.querySelector('.climatology-data');
    const errorBox = result && result.querySelector('.climatology-error');

    if (result) result.hidden = false;
    if (loading) loading.hidden = true;
    if (errorBox) errorBox.hidden = true;
    if (dataBox) dataBox.hidden = false;

    const icon = $('#climatology-icon');
    const id = iconId(row.code);
    if (icon) {
      icon.innerHTML = `<svg viewBox="0 0 64 64" width="100" height="100"><use href="/static/weather-sprite.svg#${id}"></use></svg>`;
    }

    $('#climatology-temp').textContent = row.temp != null ? `${Math.round((U.temp && U.temp(row.temp)) || row.temp)}°` : '--';
    $('#climatology-condition').textContent = weatherLabel(row.code);
    $('#climatology-feels').textContent = row.feels != null ? `${Math.round((U.temp && U.temp(row.feels)) || row.feels)}°` : '--';
    $('#climatology-humidity').textContent = row.humidity != null ? `${Math.round(row.humidity)}%` : '--';
    $('#climatology-wind').textContent = row.wind != null ? `${Math.round((U.wind && U.wind(row.wind)) || row.wind)} ${(U.windLabel && U.windLabel()) || 'km/h'}` : '--';
    $('#climatology-precip').textContent = row.precip != null ? `${Math.round(row.precip)} mm` : '--';
    $('#climatology-pressure').textContent = row.pressure != null ? `${Math.round(row.pressure)} hPa` : '--';
    $('#climatology-cloud').textContent = row.cloud != null ? `${Math.round(row.cloud)}%` : '--';
    $('#climatology-uv').textContent = row.uv != null ? `${Math.round(row.uv)}` : '--';

    if (row.hourly && row.hourly.times.length) {
      renderChart(row.hourly.times, row.hourly.temps);
    }
  }

  function renderChart(times, temps) {
    const container = $('#climatology-chart');
    const rangeEl = $('#climatology-chart-range');
    if (!container || !times.length) return;

    const values = temps.map((t) => (Number.isFinite(t) ? t : null)).filter((v) => v !== null);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const padding = Math.max(2, Math.round((max - min) * 0.15 || 2));
    const yMin = Math.floor(min - padding);
    const yMax = Math.ceil(max + padding);
    const yRange = yMax - yMin || 1;

    if (rangeEl) {
      const first = times[0] || '';
      const last = times[times.length - 1] || '';
      const fmt = (s) => (s ? s.replace('T', ' ').slice(0, 16) : '');
      rangeEl.textContent = `${fmt(first)} → ${fmt(last)}`;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 220;
    const left = 36;
    const right = 12;
    const top = 12;
    const bottom = 28;
    const plotW = width - left - right;
    const plotH = height - top - bottom;

    const points = times.map((t, i) => {
      const x = times.length > 1 ? left + (i / (times.length - 1)) * plotW : left + plotW / 2;
      const v = Number.isFinite(temps[i]) ? temps[i] : null;
      const y = v === null ? null : top + plotH - ((v - yMin) / yRange) * plotH;
      return { x, y, v, label: t ? t.split('T')[1]?.slice(0, 5) || '' : '' };
    });

    const linePoints = points.filter((p) => p.y !== null).map((p) => `${p.x},${p.y}`).join(' ');
    const areaPoints = linePoints + ` ${points[points.length - 1].x},${top + plotH} ${points[0].x},${top + plotH}`;

    const ticks = 4;
    const yTicks = [];
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + (yRange * i) / ticks;
      const y = top + plotH - (plotH * i) / ticks;
      yTicks.push({ v, y });
    }

    const xLabels = [];
    const step = Math.max(1, Math.floor(times.length / 6));
    for (let i = 0; i < times.length; i += step) {
      xLabels.push({ x: points[i].x, label: points[i].label });
    }
    if (xLabels[xLabels.length - 1]?.x !== points[points.length - 1].x) {
      xLabels.push({ x: points[points.length - 1].x, label: points[points.length - 1].label });
    }

    const svg = [];
    svg.push(`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`);
    svg.push(`<path class="chart-area" d="M${areaPoints}"/>`);
    svg.push(`<polyline class="chart-line" points="${linePoints}"/>`);
    yTicks.forEach(({ v, y }) => {
      svg.push(`<line class="chart-axis" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/>`);
      svg.push(`<text class="chart-temp-label" x="${left - 4}" y="${y + 3}" text-anchor="end">${Math.round(v)}°</text>`);
    });
    svg.push(`<line class="chart-axis" x1="${left}" x2="${left}" y1="${top}" y2="${top + plotH}"/>`);
    svg.push(`<line class="chart-axis" x1="${width - right}" x2="${width - right}" y1="${top}" y2="${top + plotH}"/>`);
    xLabels.forEach(({ x, label }) => {
      svg.push(`<text class="chart-label" x="${x}" y="${height - 8}" text-anchor="middle">${label}</text>`);
    });
    points.forEach((p) => {
      if (p.y !== null) {
        svg.push(`<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="3"/>`);
      }
    });
    svg.push('</svg>');
    container.innerHTML = svg.join('');
  }

  function renderError(msg) {
    const result = $('#climatology-result');
    const loading = result && result.querySelector('.climatology-loading');
    const dataBox = result && result.querySelector('.climatology-data');
    const errorBox = result && result.querySelector('.climatology-error');

    if (result) result.hidden = false;
    if (loading) loading.hidden = true;
    if (dataBox) dataBox.hidden = true;
    if (errorBox) {
      errorBox.hidden = false;
      if (msg) errorBox.textContent = msg;
    }
  }

  async function loadClimatology() {
    const latlon = getLatLon();
    if (!latlon) {
      renderError('No location selected. Please choose a city first.');
      return;
    }

    const date = $('#climatology-date').value;
    const hour = $('#climatology-hour').value;
    if (!date || hour === '') {
      renderError('Please select both date and hour.');
      return;
    }

    const result = $('#climatology-result');
    const loading = result && result.querySelector('.climatology-loading');
    const dataBox = result && result.querySelector('.climatology-data');
    const errorBox = result && result.querySelector('.climatology-error');

    if (result) result.hidden = false;
    if (loading) loading.hidden = false;
    if (dataBox) dataBox.hidden = true;
    if (errorBox) errorBox.hidden = true;

    try {
      const row = await fetchClimatology(latlon.lat, latlon.lon, date, hour);
      if (!row) {
        renderError('No data available for the selected date and hour.');
        return;
      }
      renderResult(row);
    } catch (e) {
      renderError('Failed to load climatology data: ' + (e.message || 'Unknown error'));
    }
  }

  function init() {
    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateInput = $('#climatology-date');
    if (dateInput) {
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      dateInput.max = `${yyyy}-${mm}-${dd}`;
    }

    updateHourOptions();

    const fetchBtn = $('#climatology-fetch');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', loadClimatology);
    }

    const dateSelect = $('#climatology-date');
    if (dateSelect) {
      dateSelect.addEventListener('change', updateHourOptions);
    }

    window.addEventListener('location:changed', () => {
      const result = $('#climatology-result');
      if (!result.hidden) loadClimatology();
    });
  }

  function updateHourOptions() {
    const dateInput = $('#climatology-date');
    const hourSelect = $('#climatology-hour');
    if (!dateInput || !hourSelect) return;

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const selectedDate = dateInput.value;

    hourSelect.innerHTML = '';

    if (selectedDate === todayStr) {
      const currentHour = today.getHours();
      for (let h = 0; h <= currentHour; h++) {
        const opt = document.createElement('option');
        opt.value = String(h).padStart(2, '0');
        opt.textContent = String(h).padStart(2, '0') + ':00';
        hourSelect.appendChild(opt);
      }
    } else {
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = String(h).padStart(2, '0');
        opt.textContent = String(h).padStart(2, '0') + ':00';
        hourSelect.appendChild(opt);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
