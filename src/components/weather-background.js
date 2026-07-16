(function () {
  // One deterministic, pure-nature image per weather theme. Mirrors the map in
  // weather-card.js so every page shows the same background for the same weather.
  const WEATHER_BACKGROUNDS = {
    clear: ['/static/bg-clear.jpg'],
    partly: ['/static/bg-partly.jpg'],
    cloudy: ['/static/bg-cloudy.jpg'],
    rain: ['/static/bg-rain.jpg'],
    snow: ['/static/bg-snow.jpg'],
    storm: ['/static/bg-storm.jpg'],
    fog: ['/static/bg-fog.jpg'],
    night: ['/static/bg-night.jpg']
  };

  function preloadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

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

    const options = WEATHER_BACKGROUNDS[chooseTheme(data || {})];
    if (!options || !options.length) return;
    const url = options[Math.floor(Math.random() * options.length)];

    const loaded = await preloadImage(url);
    if (loaded) {
      body.style.backgroundColor = '';
      body.style.backgroundImage = `url(${url})`;
    }
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
