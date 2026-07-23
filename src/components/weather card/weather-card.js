const { getWeather, reverseGeocode } = window.__apiClient || {};

if (typeof getWeather !== 'function' || typeof reverseGeocode !== 'function') {
  console.warn('API client not ready. Ensure api-client.js runs before weather-card.js');
}

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'ar', label: 'AR' }
];

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

// A single solid color per weather theme (no images). Keeps the background
// identical across every page (home, dashboard, details) for the same weather.
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

const DAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
};

const DAY_LABELS = {
  en: { today: 'Today' },
  fr: { today: "Aujourd'hui" },
  es: { today: 'Hoy' },
  ar: { today: 'اليوم' }
};

const TRANSLATIONS = {
  en: {
    precipitation: 'Precipitation:',
    humidity: 'Humidity:',
    wind: 'Wind:',
    modalTitle: 'Choose city & country',
    countryLabel: 'Country',
    cityLabel: 'City',
    selectCountry: 'Select a country',
    selectCity: 'Select a city',
    cityPlaceholder: 'Start typing a city...',
    cancel: 'Cancel',
    confirm: 'Confirm',
    chanceOfRain: (pct) => `${pct}% chance of rain tomorrow`,
    langTitle: 'Choose language',
    geoTitle: 'Choose location'
  },
  fr: {
    precipitation: 'Précipitations:',
    humidity: 'Humidité:',
    wind: 'Vent:',
    modalTitle: 'Choisir ville et pays',
    countryLabel: 'Pays',
    cityLabel: 'Ville',
    selectCountry: 'Sélectionner un pays',
    selectCity: 'Sélectionner une ville',
    cityPlaceholder: 'Commencez à taper une ville...',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    chanceOfRain: (pct) => `${pct}% de chance de pluie demain`,
    langTitle: 'Choisir la langue',
    geoTitle: 'Choisir la localisation'
  },
  es: {
    precipitation: 'Precipitación:',
    humidity: 'Humedad:',
    wind: 'Viento:',
    modalTitle: 'Elegir ciudad y país',
    countryLabel: 'País',
    cityLabel: 'Ciudad',
    selectCountry: 'Seleccionar un país',
    selectCity: 'Seleccionar una ciudad',
    cityPlaceholder: 'Empieza a escribir una ciudad...',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    chanceOfRain: (pct) => `${pct}% de probabilidad de lluvia mañana`,
    langTitle: 'Elegir idioma',
    geoTitle: 'Elegir ubicación'
  },
  ar: {
    precipitation: 'الهطول:',
    humidity: 'الرطوبة:',
    wind: 'الرياح:',
    modalTitle: 'اختر المدينة والدولة',
    countryLabel: 'الدولة',
    cityLabel: 'المدينة',
    selectCountry: 'اختر دولة',
    selectCity: 'اختر مدينة',
    cityPlaceholder: 'ابدأ بكتابة اسم المدينة...',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    chanceOfRain: (pct) => `${pct}% احتمال هطول غداً`,
    langTitle: 'اختر اللغة',
    geoTitle: 'اختر الموقع'
  }
};

function $(sel) {
  return document.querySelector(sel);
}

function $one(sel, root = document) {
  return root.querySelector(sel);
}


function pad2(n) {
  return String(n).padStart(2, '0');
}

const LATLON_KEY = 'open-meteo-latlon';

function loadSavedLatLon() {
  try {
    const raw = localStorage.getItem(LATLON_KEY);
    if (!raw) return null;
    const { lat, lon } = JSON.parse(raw);
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      return { lat: Number(lat), lon: Number(lon) };
    }
  } catch (e) { /* ignore */ }
  return null;
}

function saveLatLon(lat, lon) {
  try {
    localStorage.setItem(LATLON_KEY, JSON.stringify({ lat, lon }));
  } catch (e) { /* ignore */ }
}

function formatHHMM(date) {
  // use local time
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isoDateToLocalMidnight(isoDate) {
  // isoDate like 2026-07-08
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

function getWeatherCategory(code) {
  code = Number(code) || 0;
  if ([95, 96, 99].includes(code)) return 'thunder';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(code)) return 'rain';
  if ([80, 81, 82].includes(code)) return 'rain';
  if ([2, 3].includes(code)) return 'cloudy';
  if (code === 1) return 'partly';
  return 'clear';
}

function chooseMainIcon({ is_day, temperature, precipitation, weatherCode }) {
  const precip = precipitation ?? 0;
  const code = Number(weatherCode) || 0;

  if (precip > 0.1) {
    if (getWeatherCategory(code) === 'thunder') return 'thunder';
    return 'rainy-4';
  }

  const cat = getWeatherCategory(code);
  if (cat === 'thunder') return 'thunder';
  if (cat === 'snow') return 'snowy-3';
  if (cat === 'rain') return 'rainy-4';

  if (!is_day) return 'night';
  if ((temperature ?? 0) < -0.5) return 'snowy-3';

  if (cat === 'cloudy') return 'cloudy';
  if (cat === 'partly') return 'cloudy-day-1';

  return 'day';
}

function chooseRainIcon() {
  return 'rainy-6';
}

function chooseDailyIcon({ isDay, precipitation, weatherCode }) {
  const precip = precipitation ?? 0;
  const code = Number(weatherCode) || 0;

  if (precip > 0.1) {
    if (getWeatherCategory(code) === 'thunder') return 'thunder';
    return isDay ? 'rainy-5' : 'rainy-7';
  }

  const cat = getWeatherCategory(code);
  if (cat === 'thunder') return 'thunder';
  if (cat === 'snow') return 'snowy-5';
  if (cat === 'rain') return isDay ? 'rainy-5' : 'rainy-7';

  if (!isDay) return 'cloudy-night-1';

  if (cat === 'cloudy') return 'cloudy-day-1';
  if (cat === 'partly') return 'cloudy-day-1';

  return isDay ? 'cloudy-day-1' : 'cloudy-night-1';
}

function getLanguageFromUI() {
  const select = $('.header__lang-select');
  if (select) return select.value || 'en';

  const btn = $('.header__lang-button');
  if (!btn) {
    try { return localStorage.getItem('open-meteo-lang') || 'en'; }
    catch (e) { return 'en'; }
  }
  const text = $('.header__lang-text')?.textContent?.trim()?.toLowerCase();
  const found = LANGS.find(l => l.label.toLowerCase() === text);
  return found?.code || 'en';
}

function setLanguageUI(code) {
  const lang = LANGS.find(l => l.code === code) || LANGS[0];
  const langSelect = $('.header__lang-select');
  if (langSelect) {
    langSelect.value = code;
  }
  document.documentElement.lang = code;
  applyTranslations(code);
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function applyTranslations(code) {
  const t = TRANSLATIONS[code] || TRANSLATIONS.en;

  // Metric labels are handled centrally by window.I18n.apply() (via
  // .weather-label[data-key]) so translation stays in one place. Fall back to
  // the local dictionary only if I18n is unavailable.
  if (!window.I18n) {
    document.querySelectorAll('.card-main-weather-info .weather-label').forEach((label) => {
      const key = label.dataset.key;
      if (key && t[key]) label.textContent = t[key];
    });
  }
  const modalTitle = $('.location-modal h2');
  if (modalTitle) modalTitle.textContent = t.modalTitle;

  const labels = document.querySelectorAll('.location-modal label');
  if (labels[0]) labels[0].textContent = t.countryLabel;
  if (labels[1]) labels[1].textContent = t.cityLabel;

  const countrySelect = $('.location-country');
  if (countrySelect && countrySelect.options.length > 0) {
    countrySelect.options[0].textContent = t.selectCountry;
  }

  const cityInput = $('.location-city');
  if (cityInput) cityInput.placeholder = t.cityPlaceholder;

  const cancelBtn = $('.location-cancel');
  if (cancelBtn) cancelBtn.textContent = t.cancel;

  const confirmBtn = $('.location-confirm');
  if (confirmBtn) confirmBtn.textContent = t.confirm;

  const langBtn = $('.header__lang-select');
  if (langBtn) langBtn.title = t.langTitle;

  const geoBtn = $('.header__geo-button');
  if (geoBtn) geoBtn.title = t.geoTitle;
}

// The background is a single static blue on every page, for every country and
// city, regardless of the weather or any saved preference.
async function setWeatherBackground() {
  const body = document.body;
  if (!body) return;
  body.style.backgroundImage = 'none';
  body.style.backgroundColor = '#2a7fd4';
}

function computeDayLabels(langCode, now = new Date()) {
  const names = DAY_NAMES[langCode] || DAY_NAMES.en;
  const todayLabel = DAY_LABELS[langCode]?.today || 'Today';
  const result = [todayLabel];
  for (let i = 1; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    result.push(names[d.getDay()]);
  }
  return result;
}

function renderDayStrip(days7) {
  const slots = [
    '.date-mon', '.date-tue', '.date-wed', '.date-thu', '.date-fri', '.date-sat', '.date-sun'
  ];
  slots.forEach((sel, i) => {
    const el = $(sel);
    if (el && days7[i]) el.textContent = days7[i];
  });
}


function renderForecastCards({ daily }, langCode) {
  const times = daily.time;
  const minTemps = daily.temperature_2m_min;
  const maxTemps = daily.temperature_2m_max;
  const precip = daily.precipitation_probability_max;
  const sunrise = daily.sunrise;
  const sunset = daily.sunset;
  const weatherCodes = daily.weather_code;

  const now = new Date();
  const dayLabels = computeDayLabels(langCode, now);
  renderDayStrip(dayLabels);

  const setText = (sel, text) => {
    const el = $(sel);
    if (el) el.textContent = text;
  };

  const slot = (idx, highSel, lowSel, iconSel, isDayIcon) => {
    const minT = minTemps[idx];
    const maxT = maxTemps[idx];

    const precipProbFrac = (precip?.[idx] ?? 0) / 100;
    const iconId = chooseDailyIcon({ isDay: isDayIcon, precipitation: precipProbFrac, weatherCode: weatherCodes?.[idx] });

    const highInt = Number.isFinite(maxT) ? Math.floor(window.Units.temp(maxT)) : 0;
    const lowInt = Number.isFinite(minT) ? Math.floor(window.Units.temp(minT)) : 0;
    setText(highSel, `${highInt}°`);
    setText(lowSel, `${lowInt}°`);

    const svg = $(iconSel);
    if (svg) renderSvgFromSprite(svg, iconId);
  };

  const isDayIcon = true;
  slot(0, '.temp-high-mon', '.temp-low-mon', '.weather-mon', isDayIcon);
  slot(1, '.temp-high-tue', '.temp-low-tue', '.weather-tue', isDayIcon);
  slot(2, '.temp-high-wed', '.temp-low-wed', '.weather-wed', isDayIcon);
  slot(3, '.temp-high-thu', '.temp-low-thu', '.weather-thu', isDayIcon);
  slot(4, '.temp-high-fri', '.temp-low-fri', '.weather-fri', isDayIcon);
  slot(5, '.temp-high-sat', '.temp-low-sat', '.weather-sat', isDayIcon);
  slot(6, '.temp-high-sun', '.temp-low-sun', '.weather-sun', isDayIcon);
}


let liveTimeStarted = false;

function setLiveTime() {
  const timeEl = $('.time');
  if (!timeEl || liveTimeStarted) return;
  liveTimeStarted = true;

  const tick = () => {
    const d = new Date();
    const lang = getLanguageFromUI();
    const day = d.toLocaleDateString(lang, { weekday: 'long' });
    timeEl.textContent = `${day}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  tick();
  setInterval(tick, 1000);
}

function openLocationModal() {
  const modal = $('.location-modal-backdrop');
  if (!modal) return;

  const countrySelect = $('.location-country');
  if (countrySelect && countrySelect.options.length <= 1) {
    countrySelect.innerHTML = '<option value="">Select a country</option>' +
      COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  const cityInput = $('.location-city');
  if (cityInput) cityInput.value = '';

  const datalist = $('#cities-list');
  if (datalist) datalist.innerHTML = '';

  modal.hidden = false;
}

function closeLocationModal() {
  const modal = $('.location-modal-backdrop');
  if (!modal) return;
  modal.hidden = true;
}

async function searchLocation(country, city) {
  const qs = new URLSearchParams({ country, city, count: 1 });
  const res = await fetch(`/api/location?${qs.toString()}`);
  if (!res.ok) throw new Error(`Location search failed: ${res.status}`);
  return res.json();
}

async function fetchCitiesForCountry(country, query) {
  const qs = new URLSearchParams({ country, city: query, count: 50 });
  const res = await fetch(`/api/location?${qs.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.results || [];
}

function wireUI() {
  window.addEventListener('location:changed', (e) => {
    const detail = e.detail || {};
    const lat = Number(detail.lat);
    const lon = Number(detail.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      saveLatLon(lat, lon);
      window.__lastLatLon = { lat, lon };
      initializeCard(lat, lon);
    }
  });
}

 async function initializeCard(lat, lon) {
  const dataJSON = await getWeather({ lat, lon });
  const data = dataJSON?.data || dataJSON;

  // If Open-Meteo returns an error payload, avoid crashing the UI.
  if (!data || (data.reason && data.error) || !data.current || !data.daily) {
    console.error('Weather payload missing/invalid:', data);
    const tempP = $('.card-temp p');
    if (tempP?.childNodes?.[0]) tempP.childNodes[0].textContent = '—';

    $('.precipitation') && ($('.precipitation').textContent = '—');
    $('.humidity') && ($('.humidity').textContent = '—');
    $('.wind') && ($('.wind').textContent = '—');
    $('.sunrise-time') && ($('.sunrise-time').textContent = 'xx:xx');
    $('.sunset-time') && ($('.sunset-time').textContent = 'xx:xx');
    $('.chance-of-rain') && ($('.chance-of-rain').textContent = '—');
    return;
  }

  const langCode = getLanguageFromUI();

  // localization: prefer the user-selected city name from localStorage,
  // fall back to reverse geocode, then to coordinates.
  const savedCity = (() => { try { return localStorage.getItem('open-meteo-city'); } catch (e) { return ''; } })();
  const savedCountry = (() => { try { return localStorage.getItem('open-meteo-country'); } catch (e) { return ''; } })();
  const rev = savedCity ? { city: savedCity, country: savedCountry } : await reverseGeocode({ lat, lon });
  const loc = $('.localization');
  const city = rev?.city || '';
  const country = rev?.country || '';
  const locationText = (city || country) ? [city, country].filter(Boolean).join(', ') : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  loc.textContent = locationText;

  // times
  setLiveTime();

  const daily = data.daily;
  const current = data.current;

  console.log('[weather-card] daily keys', Object.keys(daily || {}), 'daily time count', daily?.time?.length, 'precip prob count', daily?.precipitation_probability_max?.length);
  console.log('[weather-card] daily time first/last', daily?.time?.[0], daily?.time?.[daily.time.length - 1]);

  setWeatherBackground({
    is_day: current.is_day === 1,
    temperature: current.temperature_2m,
    precipitation: current.precipitation,
    weatherCode: current.weather_code
  });

  const tempValue = current.temperature_2m;
  const tempP = $('.card-temp p');
  if (tempP) {
    const tempInt = Number.isFinite(tempValue) ? Math.floor(window.Units.temp(tempValue)) : 0;
    tempP.childNodes[0].textContent = String(tempInt);
    const unitSpan = tempP.querySelector('span');
    if (unitSpan) unitSpan.textContent = ` ${window.Units.tempLabel()} `;
  }

  renderSvgFromSprite(
    $('.card-main-weather-icon'),
    chooseMainIcon({
      is_day: current.is_day === 1,
      temperature: tempValue,
      precipitation: current.precipitation,
      weatherCode: current.weather_code
    })
  );

  const precip = current.precipitation;
  $('.precipitation') && ($('.precipitation').textContent = `${precip} mm`);
  $('.humidity') && ($('.humidity').textContent = `${current.relative_humidity_2m}%`);
  $('.wind') && ($('.wind').textContent = `${Math.round(window.Units.wind(current.wind_speed_10m))} ${window.Units.windLabel()}`);

  // sunrise/sunset for today
  if (daily?.sunrise?.length && daily?.sunset?.length) {
    const sr = new Date(daily.sunrise[0]);
    const ss = new Date(daily.sunset[0]);
    $('.sunrise-time').textContent = formatHHMM(sr);
    $('.sunset-time').textContent = formatHHMM(ss);

    const diffMs = ss - sr;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const durEl = $('.sun-duration');
    if (durEl) durEl.textContent = `${hours}h ${mins}min`;
  }

  // chance of rain tomorrow
  if (daily?.precipitation_probability_max?.length > 1) {
    const pct = Math.max(0, Math.min(100, Math.round(daily.precipitation_probability_max[1])));
    const langCode = getLanguageFromUI();
    const t = TRANSLATIONS[langCode] || TRANSLATIONS.en;
    $('.chance-of-rain').textContent = t.chanceOfRain(pct);

    renderSvgFromSprite(
      $('.rainy-weather-icon'),
      chooseRainIcon()
    );
  }

  // forecast strip + icons
  renderForecastCards({ daily }, langCode);
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function renderSvgFromSprite(svgEl, symbolId) {
  if (!svgEl) return;
  svgEl.setAttribute('viewBox', '0 0 64 64');
  svgEl.innerHTML = '';
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${symbolId}`);
  svgEl.appendChild(use);
}

function injectSprite() {
  if (document.getElementById('weather-sprite-container')) return Promise.resolve();
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.display = 'none';
    container.id = 'weather-sprite-container';
    fetch('/static/weather-sprite.svg')
      .then((r) => r.text())
      .then((text) => {
        container.innerHTML = text;
        document.body.appendChild(container);
        resolve();
      })
      .catch(() => resolve());
  });
}

function getInitialLanguage() {
  try { return localStorage.getItem('open-meteo-lang') || 'en'; }
  catch (e) { return 'en'; }
}

async function boot() {
  await injectSprite();
  setLanguageUI(getInitialLanguage());
  if (window.I18n) window.I18n.apply();
  wireUI();

  const saved = loadSavedLatLon();
  const defaultLat = saved?.lat ?? 34.261;
  const defaultLon = saved?.lon ?? -6.5802;
  window.__lastLatLon = { lat: defaultLat, lon: defaultLon };

  await initializeCard(defaultLat, defaultLon);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
