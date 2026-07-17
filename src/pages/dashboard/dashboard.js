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

  function drawChart(containerId, values, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const { color, label } = options;
    const lineColor = color || 'rgba(96,165,250,0.85)';
    const canvas = document.createElement('canvas');
    const tooltip = document.createElement('div');
    tooltip.className = 'dashboard-tooltip';
    container.innerHTML = '';
    container.appendChild(canvas);
    container.appendChild(tooltip);

    const ctx = canvas.getContext && canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const data = (values || []).map((v) => Number(v) || 0);

    function pointX(i, chartW) {
      const n = data.length;
      if (n <= 1) return padLeft + chartW / 2;
      return padLeft + (chartW * i) / (n - 1);
    }

    let padLeft = 36, padRight = 8, padTop = 12, padBottom = 20;

    // Keep a stable reference so we can remove the resize/load listeners before
    // re-rendering (drawChart is called once per chart on every location change,
    // and we must not accumulate global listeners -> memory leak + redundant paints).
    const renderRef = () => render();
    if (container.__chartRender) {
      window.removeEventListener('resize', container.__chartRender);
    }
    container.__chartRender = renderRef;

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

      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;
      const maxVal = Math.max(...data, 1);
      const minVal = Math.min(...data, 0);
      const range = maxVal - minVal || 1;

      const yFor = (v) => padTop + chartH - ((v - minVal) / range) * chartH;

      // Horizontal grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padTop + (chartH * i) / 4;
        ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
      }

      // Build a smooth (monotone-ish cubic) curve through the points.
      const pts = data.map((v, i) => ({ x: pointX(i, chartW), y: yFor(v) }));

      function buildPath() {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i - 1] || pts[i];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[i + 2] || p2;
          const t = 0.18; // smoothing tension
          const cp1x = p1.x + (p2.x - p0.x) * t;
          const cp1y = p1.y + (p2.y - p0.y) * t;
          const cp2x = p2.x - (p3.x - p1.x) * t;
          const cp2y = p2.y - (p3.y - p1.y) * t;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
      }

      // Gradient fill under the curve
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, lineColor.replace(/[\d.]+\)$/, '0.35)'));
      grad.addColorStop(1, lineColor.replace(/[\d.]+\)$/, '0.02)'));
      buildPath();
      ctx.lineTo(pts[pts.length - 1].x, padTop + chartH);
      ctx.lineTo(pts[0].x, padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Smooth curve stroke
      buildPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Data point dots
      ctx.fillStyle = lineColor;
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      const step = Math.max(1, Math.floor(data.length / 6));
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px Roboto, sans-serif';
      ctx.textAlign = 'center';
      data.forEach((_, i) => {
        if (i % step === 0) {
          ctx.fillText(`${i}h`, pointX(i, chartW), padTop + chartH + 13);
        }
      });

      canvas.onmousemove = (evt) => {
        const rect = canvas.getBoundingClientRect();
        const mx = evt.clientX - rect.left;
        const n = data.length;
        let idx = n <= 1 ? 0 : Math.round(((mx - padLeft) / chartW) * (n - 1));
        idx = Math.max(0, Math.min(n - 1, idx));
        if (mx >= padLeft - 6 && mx <= padLeft + chartW + 6) {
          tooltip.innerHTML = `<strong>${idx}h</strong><br>${label}: ${data[idx]}`;
          tooltip.style.display = 'block';
          tooltip.style.left = `${Math.min(Math.max(mx + 10, 4), w - 80)}px`;
          tooltip.style.top = `${Math.max(pts[idx].y - 30, 4)}px`;
        }
      };
      canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
    }

    // Defer the first paint until after layout/paint so the container has a
    // measurable size; otherwise getBoundingClientRect() can be 0 and the chart
    // looks empty. Re-render on resize (deduped via container.__chartRender)
    // and once after full load (fonts etc.).
    requestAnimationFrame(renderRef);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', renderRef, { once: true });
    }
    window.addEventListener('resize', renderRef);
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
      const [weather, hourly, rev] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/hourly?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/reverse?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({}))
      ]);

      const current = weather?.data?.current || {};

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
