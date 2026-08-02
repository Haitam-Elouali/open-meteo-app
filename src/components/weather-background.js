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

  // Debug: watch for any occurrence of "Western Sahara" in the DOM or console.
  (function watchWesternSahara() {
    const TARGET = 'western sahara';
    function checkNode(node) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.toLowerCase().includes(TARGET)) {
        console.error('[watchWesternSahara] Found in text:', node.nodeValue);
      }
    }
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') checkNode(m.target);
        else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) checkNode(n);
            else n.childNodes && n.childNodes.forEach(checkNode);
          });
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = function (...args) {
      if (args.some((a) => String(a).toLowerCase().includes(TARGET))) console.error('[watchWesternSahara] console.log:', ...args);
      return origLog.apply(console, args);
    };
    console.warn = function (...args) {
      if (args.some((a) => String(a).toLowerCase().includes(TARGET))) console.error('[watchWesternSahara] console.warn:', ...args);
      return origWarn.apply(console, args);
    };
    console.error = function (...args) {
      if (args.some((a) => String(a).toLowerCase().includes(TARGET))) console.error('[watchWesternSahara] console.error:', ...args);
      return origError.apply(console, args);
    };
  })();
})();
