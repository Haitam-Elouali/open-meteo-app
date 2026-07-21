// Ticker shown under the header on every page. Displays ONE capital at a time
// (weather icon + current temperature) and slides the next capital in from the
// right while the current one slides out to the left, so both are visible
// during the transition. Data comes from a single server-side batched request
// (/api/capitals-weather) so we don't hammer the API with ~188 calls.
(function () {
  const $ = (sel) => document.querySelector(sel);
  // Fall back to identity converters so the ticker never crashes if Units is
  // somehow unavailable (which would otherwise blank the whole ticker).
  const U = window.Units || { temp: (v) => v, tempLabel: () => '' };

  const INTERVAL_MS = 3500;

  function chooseIcon({ is_day, weatherCode }) {
    const code = Number(weatherCode) || 0;
    if ([95, 96, 99].includes(code)) return 'thunder';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowy-3';
    if ([45, 48].includes(code)) return 'cloudy';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy-4';
    if (!is_day) return 'night';
    if (code >= 2) return 'cloudy';
    if (code === 1) return 'cloudy-day-1';
    return 'day';
  }

  function renderSvg(svgEl, symbolId) {
    if (!svgEl) return;
    svgEl.setAttribute('viewBox', '0 0 64 64');
    svgEl.innerHTML = '';
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${symbolId}`);
    svgEl.appendChild(use);
  }

  function buildItem(cap) {
    const item = document.createElement('div');
    item.className = 'capital-card';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'capital-card__icon');
    svg.setAttribute('width', '60');
    svg.setAttribute('height', '60');
    svg.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'capital-card__text';
    if (cap.error || cap.temperature == null) {
      text.textContent = `${cap.capital}, ${cap.country}:`;
      renderSvg(svg, 'day');
    } else {
      const temp = Number.isFinite(Number(cap.temperature))
        ? Math.round(U.temp(Number(cap.temperature)))
        : '';
      text.textContent = `${cap.capital}, ${cap.country} — ${temp}${U.tempLabel()}`;
      renderSvg(svg, chooseIcon({ is_day: cap.is_day === 1, weatherCode: cap.weatherCode }));
    }
    item.appendChild(svg);
    item.appendChild(text);
    return item;
  }

  function ensureSprite() {
    if (document.getElementById('weather-sprite-container')) return Promise.resolve();
    return fetch('/static/weather-sprite.svg')
      .then((r) => r.text())
      .then((text) => {
        const c = document.createElement('div');
        c.style.display = 'none';
        c.id = 'weather-sprite-container';
        c.innerHTML = text;
        document.body.appendChild(c);
      })
      .catch(() => {});
  }

  const IDX_KEY = 'open-meteo-capital-idx';

  async function init() {
    const stage = $('#capitals-stage');
    if (!stage) return;
    await ensureSprite();

    let caps = [];
    try {
      const res = await fetch('/api/capitals-weather');
      if (res.ok) {
        const data = await res.json();
        caps = Array.isArray(data?.capitals) ? data.capitals : [];
      }
    } catch (e) {
      console.error('capitals ticker failed', e);
    }
    if (!caps.length) return;

    // Resume where the previous page left off so the cycle is continuous
    // across navigations/reloads (no SPA required).
    let idx = 0;
    try { idx = Number(localStorage.getItem(IDX_KEY)) || 0; } catch (e) {}
    if (!Number.isFinite(idx) || idx < 0 || idx >= caps.length) idx = 0;

    const place = (el, pos) => { el.classList.add('capital-card--' + pos); };

    const show = () => {
      const incoming = buildItem(caps[idx]);
      place(incoming, 'incoming');
      stage.appendChild(incoming);
      void incoming.offsetWidth;
      incoming.classList.remove('capital-card--incoming');
      incoming.classList.add('capital-card--current');

      const outgoing = stage.querySelector('.capital-card--current:not(.capital-card--incoming)');
      if (outgoing && outgoing !== incoming) {
        outgoing.classList.remove('capital-card--current');
        outgoing.classList.add('capital-card--outgoing');
        setTimeout(() => outgoing.remove(), 700);
      }
      idx = (idx + 1) % caps.length;
      try { localStorage.setItem(IDX_KEY, String(idx)); } catch (e) {}
    };

    show();
    setInterval(show, INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
