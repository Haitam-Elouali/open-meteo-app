(function () {
  // A single solid color per weather theme (no images). Mirrors WEATHER_COLORS
  // in weather-card.js so every page shows the same background for same weather.
  const WEATHER_COLORS = {
    clear: '#2a7fd4',
    partly: '#5a9bd8',
    cloudy: '#7c8a99',
    rain: '#4a5560',
    snow: '#9fb3c8',
    storm: '#2b3242',
    fog: '#aab4bd',
    night: '#0b1224'
  };

  function chooseTheme({ is_day, temperature, precipitation, weatherCode }) {
    const code = Number(weatherCode) || 0;
    if (!is_day) return 'night';
    if ([45, 48].includes(code)) return 'fog';
    if ((precipitation ?? 0) > 0.1) return 'rain';
    if ([95, 96, 99].includes(code)) return 'storm';
    if ([71, 73, 75, 77, 85, 86].includes(code) || (temperature ?? 0) < -0.5) return 'snow';
    if (code >= 2) return 'cloudy';
    if (code === 1) return 'partly';
    return 'clear';
  }

  async function set(data) {
    const body = document.body;
    if (!body) return;

    let theme = 'weather';
    try {
      theme = localStorage.getItem('open-meteo-theme') || 'weather';
    } catch (e) {
      theme = 'weather';
    }

    if (theme === 'light') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = '#e9edf2';
      return;
    }
    if (theme === 'dark') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = '#11151c';
      return;
    }

    const color = WEATHER_COLORS[chooseTheme(data || {})];
    if (!color) return;
    body.style.backgroundImage = 'none';
    body.style.backgroundColor = color;
  }

  function injectSprite() {
    if (document.getElementById('weather-sprite-container')) return Promise.resolve();
    return fetch('/static/weather-sprite.svg')
      .then((r) => r.text())
      .then((text) => {
        const container = document.createElement('div');
        container.style.display = 'none';
        container.id = 'weather-sprite-container';
        container.innerHTML = text;
        document.body.appendChild(container);
      })
      .catch(() => {});
  }

  window.WeatherBackground = { set, injectSprite };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSprite);
  } else {
    injectSprite();
  }
})();
