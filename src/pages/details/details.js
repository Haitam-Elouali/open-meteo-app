(function () {
  const $ = (sel) => document.querySelector(sel);
  const U = window.Units;
  const LANG = (() => {
    try { return localStorage.getItem('open-meteo-lang') || 'en'; }
    catch (e) { return 'en'; }
  })();

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

  function dayName(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    const dict = window.I18n?.DICT?.[LANG] || {};
    if (t.getTime() === today.getTime()) return dict['forecast.today'] || 'Today';
    if (t.getTime() === tomorrow.getTime()) return dict['forecast.tomorrow'] || 'Tomorrow';
    return d.toLocaleDateString(LANG, { weekday: 'long' });
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' });
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

  function renderDaily(forecastData) {
    const container = $('#details-daily');
    const loading = $('#forecast-loading');
    if (!container) return;
    if (loading) loading.hidden = true;

    const daily = forecastData.daily || {};
    const times = daily.time || [];
    if (!times.length) {
      container.innerHTML = '<div class="forecast-loading">Unable to load forecast.</div>';
      return;
    }

    const codes = daily.weather_code || [];
    const maxTemps = daily.temperature_2m_max || [];
    const minTemps = daily.temperature_2m_min || [];
    const precipProbs = daily.precipitation_probability_max || [];
    const sunrises = daily.sunrise || [];
    const sunsets = daily.sunset || [];
    const windMax = daily.wind_speed_10m_max || [];
    const todayStr = new Date().toDateString();

    const cols = times.map((t, i) => {
      const id = iconId(codes[i]);
      const max = Number.isFinite(Number(maxTemps[i])) ? Math.round(U.temp(maxTemps[i])) : '—';
      const min = Number.isFinite(Number(minTemps[i])) ? Math.round(U.temp(minTemps[i])) : '—';
      const precip = Number.isFinite(Number(precipProbs[i])) ? Math.round(precipProbs[i]) : '—';
      const wind = Number.isFinite(Number(windMax[i])) ? Math.round(U.wind(windMax[i])) : '—';
      const isToday = new Date(t + 'T00:00:00').toDateString() === todayStr;

      return `
        <div class="forecast-col ${isToday ? 'is-today' : ''}">
          <div class="forecast-col-day">${dayName(t)}</div>
          <div class="forecast-col-date">${new Date(t + 'T00:00:00').toLocaleDateString(LANG, { month: 'short', day: 'numeric' })}</div>
          <div class="forecast-col-icon">
            <svg viewBox="0 0 64 64" width="48" height="48">
              <use href="/static/weather-sprite.svg#${id}"></use>
            </svg>
          </div>
          <div class="forecast-col-temps">
            <span class="forecast-col-high">${max}°</span>
            <span class="forecast-col-low">${min}°</span>
          </div>
          <div class="forecast-col-precip" title="Water / precipitation chance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
            <span>${precip}%</span>
          </div>
          <div class="forecast-col-meta">☀ ${fmtTime(sunrises[i])}</div>
          <div class="forecast-col-meta">🌙 ${fmtTime(sunsets[i])}</div>
          <div class="forecast-col-meta">💨 ${wind} ${U.windLabel()}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="forecast-row">${cols}</div>`;
    if (typeof updateArrows === 'function') requestAnimationFrame(updateArrows);
  }

  let currentDays = 7;
  let updateArrows = () => {};

  function wireScrollArrows() {
    const view = $('#details-daily');
    const prev = $('.forecast-prev');
    const next = $('.forecast-next');
    if (!view || !prev || !next) return;

    const amount = () => Math.max(200, view.clientWidth * 0.8);
    // Arrows keep their natural positions. In RTL the reading direction is
    // reversed, so the left (‹) arrow scrolls toward the end (later content)
    // and the right (›) arrow toward the start (earlier content).
    const isRtl = document.documentElement.dir === 'rtl';
    const leftDir = isRtl ? 1 : -1;
    prev.addEventListener('click', () => view.scrollBy({ left: leftDir * amount(), behavior: 'smooth' }));
    next.addEventListener('click', () => view.scrollBy({ left: -leftDir * amount(), behavior: 'smooth' }));

    updateArrows = () => {
      const maxScroll = view.scrollWidth - view.clientWidth - 1;
      if (isRtl) {
        // RTL scroll origins differ across browsers, so don't disable the
        // arrows (scrollBy is a no-op at the limit). Both arrows stay usable.
        prev.disabled = false;
        next.disabled = false;
      } else {
        prev.disabled = view.scrollLeft <= 0;
        next.disabled = view.scrollLeft >= maxScroll;
      }
    };
    view.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    // Recompute after layout settles so the buttons reflect the real scroll size.
    requestAnimationFrame(updateArrows);
    window.addEventListener('load', updateArrows);
  }

  async function loadForecast(days) {
    const { lat, lon } = getLatLon();
    const loading = $('#forecast-loading');
    const container = $('#details-daily');
    const pageLoading = $('#details-loading');
    if (loading) { loading.hidden = false; loading.textContent = 'Loading forecast...'; }
    if (container) container.innerHTML = '';

    try {
      const [forecastRes, weatherRes] = await Promise.all([
        fetch(`/api/forecast?lat=${lat}&lon=${lon}&days=${days}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/weather?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch(() => ({}))
      ]);

      const current = weatherRes?.data?.current || {};
      window.WeatherBackground?.set({
        is_day: current.is_day === 1,
        temperature: current.temperature_2m,
        precipitation: current.precipitation,
        weatherCode: current.weather_code
      });

      renderDaily(forecastRes?.data || {});
      if (pageLoading) pageLoading.hidden = true;
      updateArrows();
    } catch (e) {
      if (container) container.innerHTML = '<div class="forecast-loading">Unable to load forecast.</div>';
      if (pageLoading) pageLoading.hidden = true;
    }
  }

  function wireControls() {
    const toggle = $('#forecast-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-days]');
        if (!btn) return;
        currentDays = Number(btn.dataset.days) || 7;
        toggle.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        loadForecast(currentDays);
      });
    }
  }

  function init() {
    window.addEventListener('location:changed', () => loadForecast(currentDays));
    wireControls();
    wireScrollArrows();
    loadForecast(currentDays);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
