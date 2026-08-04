(function () {
  const backdrop = document.querySelector('.settings-modal-backdrop');
  if (!backdrop) return;

  const btn = document.getElementById('settings-button');
  const closeBtn = backdrop.querySelector('.settings-modal-close');
  const cancelBtn = backdrop.querySelector('.settings-cancel');
  const confirmBtn = backdrop.querySelector('.settings-confirm');

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
