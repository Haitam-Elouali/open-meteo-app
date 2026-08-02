(function () {
  const $ = (sel) => document.querySelector(sel);

  const THEME_KEY = 'open-meteo-theme';
  const TEMP_UNIT_KEY = 'open-meteo-temp-unit';
  const WIND_UNIT_KEY = 'open-meteo-wind-unit';
  const LANG_KEY = 'open-meteo-lang';

  const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia",
    "Austria", "Azerbaijan", "Bahamas", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize",
    "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Chad", "Chile",
    "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
    "Denmark", "Djibouti", "Dominica", "Ecuador", "Egypt", "El Salvador", "Eritrea", "Estonia",
    "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
    "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guyana", "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Italy", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
    "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
    "Malaysia", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
    "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
    "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
    "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga",
    "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
    "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
    "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];

  function getSaved(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setSaved(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore
    }
  }

  function applyTheme(theme) {
    const body = document.body;
    if (!body) return;
    if (theme === 'light') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = '#e9edf2';
    } else if (theme === 'dark') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = '#11151c';
    }
  }

  function renderFavorites(favorites) {
    const list = $('#favorites-list');
    if (!list) return;

    if (!favorites.length) {
      list.innerHTML = '<div class="settings-placeholder">No saved locations.</div>';
      return;
    }

    list.innerHTML = favorites
      .map((fav, idx) => `
        <div class="favorite-item">
          <div>
            <div class="name">${escapeHtml(fav.city || fav.name || 'Unknown')}</div>
            <div class="coords">${Number(fav.lat).toFixed(2)}, ${Number(fav.lon).toFixed(2)}</div>
          </div>
          <button data-idx="${idx}">Remove</button>
        </div>
      `)
      .join('');

    list.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const updated = favorites.filter((_, i) => i !== idx);
        setSaved('open-meteo-favorites', updated);
        fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorites: updated })
        }).then(() => renderFavorites(updated));
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function populateCountrySelect() {
    const sel = $('#fav-country');
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML = '<option value="">Country</option>' +
      COUNTRIES.map((c) => `<option value="${c}">${c}</option>`).join('');
    if (sel) {
      sel.addEventListener('change', () => {
        const country = sel.value;
        document.getElementById('fav-city').disabled = !country;
        document.getElementById('fav-add').disabled = !country;
      });
    }
  }

  function init() {
    const theme = getSaved(THEME_KEY, 'weather');
    const tempUnit = getSaved(TEMP_UNIT_KEY, 'c');
    const windUnit = getSaved(WIND_UNIT_KEY, 'kmh');
    const lang = getSaved(LANG_KEY, 'en');

    const themeSelect = $('#theme-select');
    if (themeSelect) themeSelect.value = theme;

    const tempSelect = $('#temp-unit-select');
    if (tempSelect) tempSelect.value = tempUnit;

    const windSelect = $('#wind-unit-select');
    if (windSelect) windSelect.value = windUnit;

    const langSelect = $('#settings-lang-select');
    if (langSelect) langSelect.value = lang;

    // sync header language
    const headerLang = document.querySelector('.header__lang-select');
    if (headerLang) {
      headerLang.value = lang;
      headerLang.dispatchEvent(new Event('change'));
    }

    applyTheme(theme);

    const savedFavorites = getSaved('open-meteo-favorites', []);
    renderFavorites(savedFavorites);

    // sync favorites with server on load
    fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites: savedFavorites })
    }).catch(() => {});

    populateCountrySelect();

    themeSelect?.addEventListener('change', () => {
      setSaved(THEME_KEY, themeSelect.value);
      applyTheme(themeSelect.value);
    });

    tempSelect?.addEventListener('change', () => {
      setSaved(TEMP_UNIT_KEY, tempSelect.value);
    });

    windSelect?.addEventListener('change', () => {
      setSaved(WIND_UNIT_KEY, windSelect.value);
    });

    langSelect?.addEventListener('change', () => {
      setSaved(LANG_KEY, langSelect.value);
      const headerLang = document.querySelector('.header__lang-select');
      if (headerLang) {
        headerLang.value = langSelect.value;
        headerLang.dispatchEvent(new Event('change'));
      }
    });

    document.getElementById('fav-add')?.addEventListener('click', async () => {
      const country = document.getElementById('fav-country').value;
      const city = document.getElementById('fav-city').value.trim();
      if (!country || !city) return;

      try {
        const res = await fetch(`/api/location?country=${encodeURIComponent(country)}&city=${encodeURIComponent(city)}&count=1`);
        const data = await res.json();
        const result = data?.results?.[0];
        if (!result) return;

        const favs = getSaved('open-meteo-favorites', []);
        favs.push({
          city: result.name,
          country: result.country,
          lat: result.lat,
          lon: result.lon
        });
        setSaved('open-meteo-favorites', favs);
        document.getElementById('fav-city').value = '';
        renderFavorites(favs);
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorites: favs })
        });
      } catch (e) {
        // ignore
      }
    });

    document.getElementById('fav-city')?.addEventListener('input', (e) => {
      const city = e.target.value.trim();
      const country = document.getElementById('fav-country').value;
      document.getElementById('fav-add').disabled = !(city && country);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
