(function () {
  const $ = (sel) => document.querySelector(sel);

  const TRANSLATIONS = {
    en: {
      time: 'Time',
      temp: 'Temperature (°C)',
      precip: 'Precipitation (%)',
      humidity: 'Humidity (%)',
      wind: 'Wind (km/h)',
      loading: 'Loading hourly data...',
      error: 'Unable to load hourly data.'
    },
    fr: {
      time: 'Heure',
      temp: 'Température (°C)',
      precip: 'Précipitations (%)',
      humidity: 'Humidité (%)',
      wind: 'Vent (km/h)',
      loading: 'Chargement des données horaires...',
      error: 'Impossible de charger les données horaires.'
    },
    es: {
      time: 'Hora',
      temp: 'Temperatura (°C)',
      precip: 'Precipitación (%)',
      humidity: 'Humedad (%)',
      wind: 'Viento (km/h)',
      loading: 'Cargando datos por hora...',
      error: 'No se pudieron cargar los datos por hora.'
    },
    ar: {
      time: 'الوقت',
      temp: 'درجة الحرارة (°C)',
      precip: 'الهطول (%)',
      humidity: 'الرطوبة (%)',
      wind: 'الرياح (كم/س)',
      loading: 'جاري تحميل البيانات الساعية...',
      error: 'تعذر تحميل البيانات الساعية.'
    }
  };

  function getLang() {
    const sel = document.querySelector('.header__lang-select');
    return sel ? sel.value : 'en';
  }

  function t() {
    return TRANSLATIONS[getLang()] || TRANSLATIONS.en;
  }

  function drawChart() {
    const container = $('#hourly-chart');
    if (!container) return;

    const lat = window.__lastLatLon?.lat;
    const lon = window.__lastLatLon?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      container.innerHTML = `<div class="hourly-loading">${t().error}</div>`;
      return;
    }

    fetch(`/api/hourly?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((res) => {
        const data = res?.data || {};
        const hourly = data.hourly || {};
        const times = hourly.time || [];
        const temps = hourly.temperature_2m || [];
        const precips = hourly.precipitation_probability || [];
        const humidities = hourly.relative_humidity_2m || [];
        const winds = hourly.wind_speed_10m || [];
        const codes = hourly.weather_code || [];

        if (!times.length) {
          container.innerHTML = `<div class="hourly-loading">${t().error}</div>`;
          return;
        }

        // show next 24 hours starting from current hour
        const now = new Date();
        const currentHour = now.getHours();
        const startIdx = Math.max(0, times.findIndex((t) => {
          const d = new Date(t);
          return d.getHours() === currentHour;
        }));

        // The window is a rolling 24h span that starts at the current hour and
        // closes at the SAME hour the next day, so it reads 15:00 -> 15:00.
        const startHour = currentHour;

        const maxPoints = 24;
        const entries = [];
        for (let i = startIdx; i < times.length && entries.length < maxPoints; i++) {
          entries.push({
            time: times[i],
            temp: temps[i],
            precip: precips[i],
            humidity: humidities[i],
            wind: winds[i],
            code: codes[i]
          });
        }

        // create canvas
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        const tooltip = document.createElement('div');
        tooltip.className = 'hourly-tooltip';
        container.appendChild(canvas);
        container.appendChild(tooltip);

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        function resize() {
          const rect = container.getBoundingClientRect();
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          return { w: rect.width, h: rect.height };
        }

        function getCat(code) {
          const c = Number(code) || 0;
          if ([95, 96, 99].includes(c)) return 'thunder';
          if ([71, 73, 75, 77, 85, 86].includes(c)) return 'snow';
          if ([45, 48].includes(c)) return 'fog';
          if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return 'rain';
          if ([2, 3].includes(c)) return 'cloudy';
          if (c === 1) return 'partly';
          return 'clear';
        }

        function getIcon(code) {
          const cat = getCat(code);
          if (cat === 'thunder') return '⛈';
          if (cat === 'snow') return '❄';
          if (cat === 'rain') return '🌧';
          if (cat === 'fog') return '🌫';
          if (cat === 'cloudy') return '☁';
          if (cat === 'partly') return '⛅';
          return '☀';
        }

        function render() {
          const { w, h } = resize();
          ctx.clearRect(0, 0, w, h);

          const padLeft = 50;
          const padRight = 16;
          const padTop = 20;
          const padBottom = 40;
          const chartW = w - padLeft - padRight;
          const chartH = h - padTop - padBottom;

          const tempsV = entries.map((e) => Number(e.temp) || 0);
          let maxTemp = Math.max(...tempsV, 1);
          let minTemp = Math.min(...tempsV, 0);
          // Symmetric vertical padding so the temperature line is centered on the
          // y-axis instead of hugging the top/bottom edges.
          const tPad = Math.max(1, (maxTemp - minTemp) * 0.18);
          maxTemp += tPad;
          minTemp -= tPad;
          const tempRange = maxTemp - minTemp || 1;

          const precipsV = entries.map((e) => Number(e.precip) || 0);
          const maxPrecip = 100;

          const barW = Math.max(8, chartW / entries.length - 8);

          // grid
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          for (let i = 0; i <= 4; i++) {
            const y = padTop + (chartH * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + chartW, y);
            ctx.stroke();
          }

          // precipitation bars (behind)
          entries.forEach((entry, i) => {
            const x = padLeft + (chartW / entries.length) * i + (chartW / entries.length - barW) / 2;
            const barH = (Number(entry.precip) || 0) / maxPrecip * chartH;
            const y = padTop + chartH - barH;
            ctx.fillStyle = 'rgba(96, 165, 250, 0.4)';
            ctx.fillRect(x, y, barW, barH);
          });

          // temperature line
          ctx.beginPath();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          entries.forEach((entry, i) => {
            const x = padLeft + (chartW / entries.length) * (i + 0.5);
            const y = padTop + chartH - ((Number(entry.temp) || 0) - minTemp) / tempRange * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          // temperature points and labels
          entries.forEach((entry, i) => {
            const x = padLeft + (chartW / entries.length) * (i + 0.5);
            const y = padTop + chartH - ((Number(entry.temp) || 0) - minTemp) / tempRange * chartH;

            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();

            // x labels. The final label marks the 24h boundary, i.e. the SAME
            // hour the next day, so the axis closes 15:00 -> 15:00.
            const d = new Date(entry.time);
            const isLast = i === entries.length - 1;
            const label = isLast ? `${pad2(startHour)}:00` : `${pad2(d.getHours())}:00`;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '11px Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x, padTop + chartH + 14);

            // y temperature labels
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(entry.temp)}°`, padLeft - 6, y + 3);
          });

          // y max precipitation labels
          ctx.fillStyle = 'rgba(96,165,250,0.8)';
          ctx.textAlign = 'left';
          ctx.fillText('100%', padLeft + 4, padTop + chartH + 14);

          // legend
          ctx.fillStyle = 'white';
          ctx.font = '12px Roboto, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('— Temperature', padLeft + 10, padTop - 6);
          ctx.fillStyle = 'rgba(96, 165, 250, 0.8)';
          ctx.fillRect(padLeft + 120, padTop - 16, 16, 8);
            ctx.fillText('Precipitation', padLeft + 142, padTop - 6);

          // Explicit 24h window caption, e.g. "15:00 → 15:00 (24h)". The window
          // closes at the SAME hour the next day (startHour), so it reads 15:00 -> 15:00.
          const firstHour = entries.length ? pad2(startHour) + ':00' : '';
          const windowText = `${firstHour} → ${firstHour} (24h)`;
          ctx.font = '11px Roboto, Arial, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.fillText(windowText, padLeft + chartW, padTop - 6);
          const chartEl = document.getElementById('hourly-chart');
          if (chartEl) chartEl.dataset.window = windowText;

          // interaction
          canvas.onmousemove = (evt) => {
            const rect = canvas.getBoundingClientRect();
            const mx = evt.clientX - rect.left;
            const idx = Math.floor((mx - padLeft) / (chartW / entries.length));
            if (idx >= 0 && idx < entries.length) {
              const entry = entries[idx];
              const d = new Date(entry.time);
              tooltip.innerHTML = `<strong>${pad2(d.getHours())}:00</strong><br>${t().temp}: ${entry.temp}°C<br>${t().precip}: ${entry.precip}%<br>${t().humidity}: ${entry.humidity}%<br>${t().wind}: ${entry.wind} km/h`;
              tooltip.style.display = 'block';
              tooltip.style.left = `${evt.clientX - rect.left + 10}px`;
              tooltip.style.top = `${evt.clientY - rect.top + 10}px`;
            }
          };

          canvas.onmouseleave = () => {
            tooltip.style.display = 'none';
          };
        }

        render();
        window.addEventListener('resize', render);
      })
      .catch(() => {
        container.innerHTML = `<div class="hourly-loading">${t().error}</div>`;
      });
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getLangSelect() {
    const sel = document.querySelector('.header__lang-select');
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = 'true';
      sel.addEventListener('change', () => {
        drawChart();
      });
    }
  }

  function init() {
    getLangSelect();

    const geoBtn = document.querySelector('.header__geo-button');
    if (geoBtn) {
      geoBtn.addEventListener('click', () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((pos) => {
          window.__lastLatLon = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          };
          drawChart();
        });
      });
    }

    drawChart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
