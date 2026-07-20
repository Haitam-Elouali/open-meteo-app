(function () {
  // The page background is a single static blue, independent of the weather.
  const STATIC_BLUE = '#2a7fd4';

  function set() {
    const body = document.body;
    if (!body) return;
    body.style.backgroundImage = 'none';
    body.style.backgroundColor = STATIC_BLUE;
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
