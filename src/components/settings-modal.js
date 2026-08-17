(function () {
  const backdrop = document.querySelector('.settings-modal-backdrop');
  if (!backdrop) return;

  const btn = document.getElementById('settings-button');
  const closeBtn = backdrop.querySelector('.settings-modal-close');
  const cancelBtn = backdrop.querySelector('.settings-cancel');
  const confirmBtn = backdrop.querySelector('.settings-confirm');
  const tickerToggle = document.getElementById('ticker-toggle');

  function getSelect(id) { return document.getElementById(id); }

  function syncSettingsModal() {
    try {
      const tempUnit = localStorage.getItem('open-meteo-temp-unit') || 'c';
      const windUnit = localStorage.getItem('open-meteo-wind-unit') || 'kmh';
      const lang = localStorage.getItem('open-meteo-lang') || 'en';

      const tempSel = getSelect('temp-unit-select');
      const windSel = getSelect('wind-unit-select');
      const langSel = getSelect('settings-lang-select');

      if (tempSel) tempSel.value = tempUnit;
      if (windSel) windSel.value = windUnit;
      if (langSel) langSel.value = lang;
      // The capitals ticker toggle (applies on every page via shared storage).
      if (tickerToggle) {
        tickerToggle.checked = (localStorage.getItem('open-meteo-show-ticker') || 'true') !== 'false';
      }
    } catch (e) {
      // ignore
    }
  }

  function close() { backdrop.hidden = true; }

  function open() {
    syncSettingsModal();
    backdrop.hidden = false;
  }

  btn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Capitals ticker visibility: persist and notify the ticker immediately so
  // it hides/shows live, without waiting for the Confirm reload.
  tickerToggle?.addEventListener('change', (e) => {
    const visible = e.target.checked;
    try {
      localStorage.setItem('open-meteo-show-ticker', visible ? 'true' : 'false');
    } catch (err) {
      // ignore storage errors
    }
    document.dispatchEvent(new CustomEvent('ticker-visibility-change', { detail: { visible } }));
  });

  confirmBtn?.addEventListener('click', () => {
    const tempUnit = getSelect('temp-unit-select')?.value || 'c';
    const windUnit = getSelect('wind-unit-select')?.value || 'kmh';
    const lang = getSelect('settings-lang-select')?.value || 'en';

    try {
      localStorage.setItem('open-meteo-temp-unit', tempUnit);
      localStorage.setItem('open-meteo-wind-unit', windUnit);
      localStorage.setItem('open-meteo-lang', lang);
    } catch (e) {
      // ignore storage errors
    }

    close();
    // Reload so units and language are applied everywhere.
    window.location.reload();
  });
})();
