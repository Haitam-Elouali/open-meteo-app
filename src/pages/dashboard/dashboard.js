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

  function drawChart(containerId, series, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Accept: plain number array, single {values,...} object, or array of such.
    let list;
    if (Array.isArray(series)) {
      const looksLikeSeries = series.length && typeof series[0] === 'object' && series[0] !== null && 'values' in series[0];
      list = looksLikeSeries ? series : [{ values: series, color: options.color, label: options.label }];
    } else if (series && typeof series === 'object' && 'values' in series) {
      list = [series];
    } else {
      list = [{ values: series, color: options.color, label: options.label }];
    }
    // x-axis labels (e.g. "14:00") come from the series object, not options.
    const labels =
      (Array.isArray(series) ? series[0] && series[0].labels : series && series.labels) ||
      options.labels ||
      null;
    const canvas = document.createElement('canvas');
    const tooltip = document.createElement('div');
    tooltip.className = 'dashboard-tooltip';
    container.innerHTML = '';
    container.appendChild(canvas);
    container.appendChild(tooltip);

    const ctx = canvas.getContext && canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const allData = list.map((s) => (s.values || []).map((v) => Number(v) || 0));
    const n = allData[0] ? allData[0].length : 0;

    let padLeft = 42, padRight = 12, padTop = 16, padBottom = 34;

    const renderRef = () => render();
    if (container.__chartRender) {
      window.removeEventListener('resize', container.__chartRender);
    }
    container.__chartRender = renderRef;

    function measure() {
      const w = container.clientWidth || container.getBoundingClientRect().width || 360;
      const h = container.clientHeight || container.getBoundingClientRect().height || 200;
      return { w, h };
    }

    function pointX(i, chartW) {
      if (n <= 1) return padLeft + chartW / 2;
      return padLeft + (chartW * i) / (n - 1);
    }

    function render() {
      try {
        if (!ctx) return;
        const { w, h } = measure();
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!n) return;

        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        let maxVal = -Infinity, minVal = Infinity;
        allData.forEach((d) => d.forEach((v) => { if (v > maxVal) maxVal = v; if (v < minVal) minVal = v; }));
        if (!Number.isFinite(maxVal)) maxVal = 1;
        if (!Number.isFinite(minVal)) minVal = 0;
        maxVal = Math.max(maxVal, minVal + 1);
        // Add symmetric vertical padding so the curve is centered in the chart
        // instead of hugging the top/bottom edges. The padding is a percentage
        // of the data span, which keeps the line visually centered for both
        // wide (temperature) and narrow (humidity) ranges.
        const yPad = Math.max(1, (maxVal - minVal) * 0.18);
        const yMin = minVal - yPad;
        const yMax = maxVal + yPad;
        const range = yMax - yMin || 1;
        // With symmetric padding the data midpoint maps to the vertical center
        // of the plot area, i.e. the curve is centered on the y-axis.
        const dataMid = (maxVal + minVal) / 2;
        const plotMid = yMin + range / 2;
        const centerOffset = dataMid - plotMid;

        const yFor = (v) => padTop + chartH - ((v - yMin) / range) * chartH;

        // Horizontal grid lines + y-axis value labels (always visible).
        ctx.font = '10px Roboto, Arial, sans-serif';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
          const y = padTop + (chartH * i) / 4;
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
          const val = yMax - (range * i) / 4;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.textAlign = 'right';
          ctx.fillText(String(Math.round(val)), padLeft - 6, y);
        }

        // x-axis baseline
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop + chartH);
        ctx.lineTo(padLeft + chartW, padTop + chartH);
        ctx.stroke();

        list.forEach((s) => {
          const data = allData[list.indexOf(s)];
          const lineColor = s.color || 'rgba(96,165,250,0.85)';
          const pts = data.map((v, i) => ({ x: pointX(i, chartW), y: yFor(v) }));

          function buildPath() {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 0; i < pts.length - 1; i++) {
              const p0 = pts[i - 1] || pts[i];
              const p1 = pts[i];
              const p2 = pts[i + 1];
              const p3 = pts[i + 2] || p2;
              const t = 0.18;
              const cp1x = p1.x + (p2.x - p0.x) * t;
              const cp1y = p1.y + (p2.y - p0.y) * t;
              const cp2x = p2.x - (p3.x - p1.x) * t;
              const cp2y = p2.y - (p3.y - p1.y) * t;
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          }

          const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
          grad.addColorStop(0, lineColor.replace(/[\d.]+\)$/, '0.35)'));
          grad.addColorStop(1, lineColor.replace(/[\d.]+\)$/, '0.02)'));
          buildPath();
          ctx.lineTo(pts[pts.length - 1].x, padTop + chartH);
          ctx.lineTo(pts[0].x, padTop + chartH);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          buildPath();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.fillStyle = lineColor;
          pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });
        });

        // x-axis time labels with tick marks. Always visible on the diagram.
        // The axis spans a full 24h rolling window anchored to NOW: position 0
        // is the current hour (e.g. "15:00") and the right edge is the SAME
        // hour the next day ("15:00" again), so it reads 15:00 -> 15:00.
        const X_STEP_HOURS = 4;
        // The end label shows the current hour rolled forward 24h (same hour
        // next day) so the window visibly closes 15:00 -> 15:00.
        const endLabel = (() => {
          const m = labels && labels[0] && String(labels[0]).match(/^(\d{1,2})/);
          const h = m ? Number(m[1]) : 0;
          return `${String(h).padStart(2, '0')}:00`;
        })();
        ctx.font = '11px Roboto, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < n; i++) {
          // Mark every STEP-th point from the start, and always the last point
          // (the 24h boundary) so there is no blank space at the right edge.
          const isStep = i % X_STEP_HOURS === 0;
          const isEnd = i === n - 1;
          if (!isStep && !isEnd) continue;
          const x = pointX(i, chartW);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padTop + chartH);
          ctx.lineTo(x, padTop + chartH + 4);
          ctx.stroke();
          const text = isEnd
            ? endLabel
            : (labels && labels[i] != null ? labels[i] : `${i}h`);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(text, x, padTop + chartH + 7);
        }
        if (list.length > 1) {
          let lx = padLeft;
          ctx.textAlign = 'left';
          ctx.font = '11px Roboto, sans-serif';
          list.forEach((s) => {
            const lineColor = s.color || 'rgba(96,165,250,0.85)';
            ctx.fillStyle = lineColor;
            ctx.fillRect(lx, padTop - 2, 10, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            const txt = s.label || '';
            ctx.fillText(txt, lx + 14, padTop + 2);
            lx += 28 + ctx.measureText(txt).width;
          });
        }


        canvas.onmousemove = (evt) => {
          const rect = canvas.getBoundingClientRect();
          const mx = evt.clientX - rect.left;
          let idx = n <= 1 ? 0 : Math.round(((mx - padLeft) / chartW) * (n - 1));
          idx = Math.max(0, Math.min(n - 1, idx));
          if (mx >= padLeft - 6 && mx <= padLeft + chartW + 6) {
            const lines = list.map((s) => {
              const data = allData[list.indexOf(s)];
              return `<strong style="color:${s.color}">${s.label || ''}</strong>: ${data[idx]}`;
            }).join('<br>');
            tooltip.innerHTML = lines;
            tooltip.style.display = 'block';
            tooltip.style.left = `${Math.min(Math.max(mx + 10, 4), w - 120)}px`;
            const anyY = Math.min(...list.map((s) => yFor(allData[list.indexOf(s)][idx])));
            tooltip.style.top = `${Math.max(anyY - 30, 4)}px`;
          }
        };
        canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
      } catch (e) {
        console.error('[dashboard] drawChart render failed for', containerId, e);
      }
    }

    if (!n) { return; }

    requestAnimationFrame(renderRef);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', renderRef, { once: true });
    }
    window.addEventListener('resize', renderRef);
    if (typeof ResizeObserver !== 'undefined') {
      let rt = null;
      const ro = new ResizeObserver(() => {
        if (rt) clearTimeout(rt);
        rt = setTimeout(renderRef, 60);
      });
      ro.observe(container);
    }
  }

  function rolling(values, fn, windowSize = 5) {
    const half = Math.floor(windowSize / 2);
    return values.map((_, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(values.length, i + half + 1);
      let acc = values[start];
      for (let j = start + 1; j < end; j++) acc = fn(acc, values[j]);
      return acc;
    });
  }

  function next24(arr, times) {
    const out = [];
    const labels = [];
    if (!times || !times.length || !arr || !arr.length) return { values: out, labels };
    const currentHour = new Date().getHours();
    let startIdx = times.findIndex((t) => new Date(t).getHours() === currentHour);
    if (startIdx < 0) startIdx = 0;
    for (let i = startIdx; i < times.length && out.length < 24; i++) {
      out.push(arr[i]);
      const d = new Date(times[i]);
      labels.push(`${String(d.getHours()).padStart(2, '0')}:00`);
    }
    if (!out.length) {
      for (let i = 0; i < 24 && i < arr.length; i++) {
        out.push(arr[i]);
        const d = new Date(times[i]);
        labels.push(`${String(d.getHours()).padStart(2, '0')}:00`);
      }
    }
    return { values: out, labels };
  }

  function next15min(arr, times) {
    const out = [];
    const labels = [];
    if (!times || !times.length || !arr || !arr.length) return { values: out, labels };
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentQuarter = Math.floor(currentMinute / 15) * 15;
    let startIdx = times.findIndex((t) => {
      const d = new Date(t);
      return d.getHours() === currentHour && d.getMinutes() === currentQuarter;
    });
    if (startIdx < 0) startIdx = 0;
    const maxPoints = 96; // 24h * 4 per hour
    for (let i = startIdx; i < times.length && out.length < maxPoints; i++) {
      out.push(arr[i]);
      const d = new Date(times[i]);
      labels.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
    if (!out.length) {
      for (let i = 0; i < maxPoints && i < arr.length; i++) {
        out.push(arr[i]);
        const d = new Date(times[i]);
        labels.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      }
    }
    return { values: out, labels };
  }

  function showChartError(containerId, msg) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.querySelector('.chart-empty')) return;
    const el = document.createElement('div');
    el.className = 'chart-empty';
    el.textContent = msg || 'No data';
    container.appendChild(el);
  }

  function tempToColor(temp) {
    if (temp == null || !Number.isFinite(temp)) return 'transparent';
    const t = Math.max(0, Math.min(1, (temp - (-10)) / (45 - (-10))));
    const hue = (1 - t) * 240;
    return `hsl(${hue}, 75%, 55%)`;
  }

  function renderCitiesTable(containerId, cities) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!cities || !cities.length) {
      container.innerHTML = '<div class="chart-empty">No data</div>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'cities-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th data-i18n="dashboard.citiesTableCity">City</th><th data-i18n="dashboard.citiesTableMaxTemp">Max Temp</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    cities.forEach((c) => {
      const tr = document.createElement('tr');
      const bg = tempToColor(c.maxTemp);
      tr.style.backgroundColor = bg;
      tr.style.color = 'white';
      const tdName = document.createElement('td');
      tdName.textContent = c.name;
      const tdTemp = document.createElement('td');
      tdTemp.textContent = c.maxTemp != null ? `${c.maxTemp}°` : '--';
      tr.appendChild(tdName);
      tr.appendChild(tdTemp);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    window.I18n?.apply?.();
  }

  async function loadDashboard() {
    const { lat, lon } = getLatLon();
    try {
      const [weather, minutely, hourly, rev] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] weather fetch failed', e); return {}; }),
        fetch(`/api/hourly?lat=${lat}&lon=${lon}&interval=15`).then((r) => r.json()).catch((e) => { console.error('[dashboard] minutely fetch failed', e); return {}; }),
        fetch(`/api/hourly?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] hourly fetch failed', e); return {}; }),
        fetch(`/api/reverse?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] reverse fetch failed', e); return {}; })
      ]);

      const current = weather?.data?.current || {};

      window.WeatherBackground?.set({
        is_day: current.is_day === 1,
        temperature: current.temperature_2m,
        precipitation: current.precipitation,
        weatherCode: current.weather_code
      });

      const country = rev?.country || '';
      const citiesWeather = country
        ? await fetch(`/api/cities-weather?country=${encodeURIComponent(country)}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] cities-weather fetch failed', e); return {}; })
        : { data: { cities: [] } };

      const h24 = hourly?.data?.hourly || {};
      const h15 = minutely?.data?.hourly || {};
      const times15 = h15.time || [];
      const times24 = h24.time || [];

      ['cities-table', 'temp-15min-chart', 'humidity-chart', 'wind-chart']
        .forEach((id) => {
          const c = document.getElementById(id);
          const empty = c && c.querySelector('.chart-empty');
          if (empty) empty.remove();
        });

      const cities = citiesWeather?.data?.cities || [];
      renderCitiesTable('cities-table', cities);

      // 15-min temperature: cap at ~48 points (12h) so labels don't squeeze.
      const MAX_15MIN_POINTS = 48;
      if (times15.length) {
        const safe = (id, series) => {
          try { drawChart(id, series); }
          catch (e) { console.error('[dashboard] drawChart failed for', id, e); showChartError(id, 'No data'); }
        };
        const temp15 = next15min(h15.temperature_2m, times15);
        const temp15cut = { values: temp15.values.slice(0, MAX_15MIN_POINTS), labels: temp15.labels.slice(0, MAX_15MIN_POINTS) };
        safe('temp-15min-chart', { values: temp15cut.values.map((v) => U.temp(v)), color: 'rgba(248,113,113,0.9)', label: '°C', labels: temp15cut.labels });

        // Humidity and wind stay on the 24h hourly window.
        const hum24 = next24(h24.relative_humidity_2m, times24);
        safe('humidity-chart', { values: hum24.values, color: 'rgba(52,211,153,0.85)', label: '%', labels: hum24.labels });
        const wind24 = next24(h24.wind_speed_10m, times24);
        safe('wind-chart', { values: wind24.values.map((v) => U.wind(v)), color: 'rgba(251,191,36,0.85)', label: U.windLabel(), labels: wind24.labels });
      } else {
        ['temp-15min-chart', 'humidity-chart', 'wind-chart']
          .forEach((id) => showChartError(id, 'No data'));
      }
    } catch (e) {
      console.error('[dashboard] loadDashboard error', e);
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
