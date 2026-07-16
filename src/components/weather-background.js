(function () {
  const WEATHER_BACKGROUNDS = {
    clear: [
      '/static/weather-bg-sky-clear.jpg',
      '/static/weather-bg-sky-clear-2.jpg',
      '/static/weather-bg-sky-clear-3.jpg',
      '/static/weather-bg-sky-clear-5.jpg'
    ],
    partly: [
      '/static/weather-bg-partly-2.jpg'
    ],
    cloudy: [
      '/static/weather-bg-sky-cloudy.jpg',
      '/static/weather-bg-cloudy-2.jpg',
      '/static/weather-bg-cloudy-3.jpg',
      '/static/weather-bg-cloudy-5.jpg'
    ],
    rain: [
      '/static/weather-bg-rain.jpg',
      '/static/weather-bg-rain-2.jpg',
      '/static/weather-bg-rain-3.jpg',
      '/static/weather-bg-rain-4.jpg',
      '/static/weather-bg-rain-5.jpg'
    ],
    snow: [
      '/static/weather-bg-snow.jpg',
      '/static/weather-bg-snow-2.jpg',
      '/static/weather-bg-snow-3.jpg',
      '/static/weather-bg-snow-4.jpg'
    ],
    storm: [
      '/static/weather-bg-storm.jpg',
      '/static/weather-bg-storm-2.jpg',
      '/static/weather-bg-storm-3.jpg',
      '/static/weather-bg-storm-4.jpg',
      '/static/weather-bg-storm-5.jpg'
    ],
    fog: [
      '/static/weather-bg-fog-1.jpg',
      '/static/weather-bg-fog-2.jpg'
    ],
    night: [
      '/static/weather-bg-night-1.jpg',
      '/static/weather-bg-night-2.jpg',
      '/static/weather-bg-night-3.jpg'
    ]
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
