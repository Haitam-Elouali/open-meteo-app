(function () {
  const $ = (sel) => document.querySelector(sel);
  const U = window.Units;

  const WEATHER_TEXT = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
    55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain',
    67: 'Freezing rain', 71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow',
    77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers',
    82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ hail'
  };

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

  function conditionText(code) { return WEATHER_TEXT[Number(code)] || 'Unknown'; }

  function aqiCategory(aqi) {
    if (aqi == null) return '';
    const v = Number(aqi);
    if (v <= 50) return '#86efac';
    if (v <= 100) return '#fde047';
    if (v <= 150) return '#fb923c';
    if (v <= 200) return '#f87171';
    if (v <= 300) return '#c084fc';
    return '#f472b6';
  }

  function getLatLon() {
    let lat = Number(window.__lastLatLon?.lat);
    let lon = Number(window.__lastLatLon?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      try {
        const raw = localStorage.getItem('open-meteo-latlon');
        if (raw) {
          const saved = JSON.parse(raw);
          if (Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lon))) {
            lat = Number(saved.lat);
            lon = Number(saved.lon);
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = 34.261; lon = -6.5802; }
    window.__lastLatLon = { lat, lon };
    return { lat, lon };
  }

  function renderAir(airData, domains) {
    const card = $('#air-card');
    const grid = $('#air-grid');
    if (!card || !grid) return;
    const d = airData?.data || {};
    if (d.error || !d.current) { card.hidden = true; return; }
    const cur = d.current;
    card.hidden = false;
    const domainLabel = window.I18n?.DICT?.[window.I18n.getLang()]?.dashboard?.domain || 'domain:';
    $('#air-domain').textContent = `${domainLabel} ${domains}`;

    const aqi = cur.us_aqi ?? cur.european_aqi;
    const aqiLabel = cur.us_aqi != null ? 'US AQI' : 'EU AQI';
    const stats = [
      { label: aqiLabel, value: aqi != null ? Math.round(aqi) : '—', sub: aqiCategory(aqi) },
      { label: 'PM2.5', value: cur.pm2_5 != null ? Math.round(cur.pm2_5) : '—', sub: 'µg/m³' },
      { label: 'PM10', value: cur.pm10 != null ? Math.round(cur.pm10) : '—', sub: 'µg/m³' },
      { label: 'Ozone', value: cur.ozone != null ? Math.round(cur.ozone) : '—', sub: 'µg/m³' },
      { label: 'NO₂', value: cur.nitrogen_dioxide != null ? Math.round(cur.nitrogen_dioxide) : '—', sub: 'µg/m³' },
      { label: 'SO₂', value: cur.sulphur_dioxide != null ? Math.round(cur.sulphur_dioxide) : '—', sub: 'µg/m³' },
      { label: 'CO', value: cur.carbon_monoxide != null ? Math.round(cur.carbon_monoxide) : '—', sub: 'µg/m³' },
      { label: 'Dust', value: cur.dust != null ? Math.round(cur.dust) : '—', sub: 'µg/m³' }
    ];

    grid.innerHTML = stats.map((s) => `
      <div class="db-air-stat">
        <div class="db-air-stat-label">${s.label}</div>
        <div class="db-air-stat-value">${s.value}</div>
        <div class="db-air-stat-sub" style="color:${s.sub && s.sub.startsWith('#') ? s.sub : 'rgba(255,255,255,0.5)'}">${s.sub && !s.sub.startsWith('#') ? s.sub : ''}</div>
      </div>
    `).join('');
  }

  function drawChart(containerId, values, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const { color, label } = options;
    const canvas = document.createElement('canvas');
    const tooltip = document.createElement('div');
    tooltip.className = 'dashboard-tooltip';
    container.innerHTML = '';
    container.appendChild(canvas);
    container.appendChild(tooltip);

    const ctx = canvas.getContext && canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const data = (values || []).map((v) => Number(v) || 0);

    function render() {
      if (!ctx) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height || 200;
      if (w <= 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!data.length) return;

      const padLeft = 36, padRight = 8, padTop = 12, padBottom = 20;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;
      const maxVal = Math.max(...data, 1);
      const minVal = Math.min(...data, 0);
      const range = maxVal - minVal || 1;
      const barW = Math.max(3, chartW / data.length - 3);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padTop + (chartH * i) / 4;
        ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
      }

      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, color || 'rgba(96,165,250,0.85)');
      grad.addColorStop(1, (color || 'rgba(96,165,250,0.85)').replace(/[\d.]+\)$/, '0.25)'));

      data.forEach((val, i) => {
        const x = padLeft + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
        const barH = (val - minVal) / range * chartH;
        const y = padTop + chartH - barH;
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);
      });

      const step = Math.max(1, Math.floor(data.length / 6));
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px Roboto, sans-serif';
      ctx.textAlign = 'center';
      data.forEach((_, i) => {
        if (i % step === 0) {
          const x = padLeft + (chartW / data.length) * (i + 0.5);
          ctx.fillText(`${i}h`, x, padTop + chartH + 13);
        }
      });

      canvas.onmousemove = (evt) => {
        const rect = canvas.getBoundingClientRect();
        const idx = Math.floor((evt.clientX - rect.left - padLeft) / (chartW / data.length));
        if (idx >= 0 && idx < data.length) {
          tooltip.innerHTML = `<strong>${idx}h</strong><br>${label}: ${data[idx]}`;
          tooltip.style.display = 'block';
          tooltip.style.left = `${evt.clientX - rect.left + 10}px`;
          tooltip.style.top = `${evt.clientY - rect.top + 10}px`;
        }
      };
      canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
    }

    // Defer the first paint until after layout/paint so the container has a
    // measurable size; otherwise getBoundingClientRect() can be 0 and no bars
    // are drawn (chart looks empty). Also re-render on full load (fonts etc.).
    requestAnimationFrame(render);
    window.addEventListener('load', render);
    window.addEventListener('resize', render);
  }

  function next24(arr, times) {
    const out = [];
    if (!times || !times.length) return out;
    const currentHour = new Date().getHours();
    const startIdx = Math.max(0, times.findIndex((t) => new Date(t).getHours() === currentHour));
    for (let i = startIdx; i < times.length && out.length < 24; i++) out.push(arr[i]);
    return out;
  }

  async function loadDashboard() {
    const { lat, lon } = getLatLon();
    try {
      const [weather, hourly, air, rev] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/hourly?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/air?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/reverse?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({}))
      ]);

      const current = weather?.data?.current || {};
      renderAir(air?.data ? air : { data: air }, air?.domains || 'auto');

      const loc = (rev && (rev.city || rev.country))
        ? [rev.city, rev.country].filter(Boolean).join(', ')
        : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
      const locEl = $('#dashboard-location');
      if (locEl) locEl.textContent = loc;

      window.WeatherBackground?.set({
        is_day: current.is_day === 1,
        temperature: current.temperature_2m,
        precipitation: current.precipitation,
        weatherCode: current.weather_code
      });

      const h = hourly?.data?.hourly || {};
      const times = h.time || [];
      if (times.length) {
        const safe = (id, vals, opts) => {
          try { drawChart(id, vals, opts); }
          catch (e) { console.error('drawChart failed for', id, e); }
        };
        safe('temp-chart', next24(h.temperature_2m, times).map((v) => U.temp(v)), { color: 'rgba(255,255,255,0.9)', label: U.tempLabel() });
        safe('precip-chart', next24(h.precipitation_probability || h.precipitation, times).map((v) => Number(v) || 0), { color: 'rgba(96,165,250,0.85)', label: '%' });
        safe('humidity-chart', next24(h.relative_humidity_2m, times), { color: 'rgba(52,211,153,0.85)', label: '%' });
        safe('wind-chart', next24(h.wind_speed_10m, times).map((v) => U.wind(v)), { color: 'rgba(251,191,36,0.85)', label: U.windLabel() });
      }
    } catch (e) {
      console.error(e);
    }
  }

  function init() {
    window.addEventListener('location:changed', loadDashboard);
    loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
