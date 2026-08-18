'use strict';

function locT(key) {
  const I18n = window.I18n || {};
  const lang = (I18n.getLang && I18n.getLang()) || 'en';
  const dict = (I18n.DICT && (I18n.DICT[lang] || I18n.DICT.en)) || {};
  return dict[key] != null ? dict[key] : (I18n.DICT && I18n.DICT.en[key]) || key;
}

class LocationModal {
  constructor() {
    this.backdrop = null;
    this.modal = null;
    this.countrySelect = null;
    this.citySelect = null;
    this.cities = [];

    this.init();
  }

  init() {
    this.backdrop = document.querySelector('.location-modal-backdrop');
    this.modal = document.querySelector('.location-modal');
    this.countrySelect = document.querySelector('.location-country');
    this.citySelect = document.querySelector('.location-city');

    if (!this.backdrop || !this.modal) return;

    this.bindEvents();
    this.loadCountries();
  }

  bindEvents() {
    this.modal.querySelector('.location-cancel')?.addEventListener('click', () => this.close());
    this.modal.querySelector('.location-confirm')?.addEventListener('click', () => this.confirm());
    this.countrySelect?.addEventListener('change', (e) => this.onCountryChange(e));
    this.citySelect?.addEventListener('change', (e) => this.onCityChange(e));
  }

  populateCountries(countries) {
    const frag = document.createDocumentFragment();
    countries.forEach(country => {
      const option = document.createElement('option');
      option.value = country;
      option.textContent = country;
      frag.appendChild(option);
    });
    this.countrySelect.appendChild(frag);
  }

  async loadCountries() {
    try {
      const response = await fetch('/api/countries');
      const data = await response.json();
      if (data.countries && data.countries.length) {
        this.populateCountries(data.countries);
        return;
      }
    } catch (e) {
      console.error('Failed to load countries:', e);
    }
    // Offline fallback: use the curated local list.
    const local = window.COUNTRIES;
    if (Array.isArray(local) && local.length) this.populateCountries(local);
  }

  populateCities(country, cities) {
    this.cities = cities || [];
    this.citySelect.innerHTML = `<option value="">${locT('location.selectCity')}</option>`;
    this.cities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      this.citySelect.appendChild(option);
    });
    this.citySelect.disabled = false;
  }

  async onCountryChange(e) {
    const country = e.target.value;
    this.citySelect.disabled = true;
    this.citySelect.innerHTML = `<option value="">${locT('location.loadingCities')}</option>`;

    if (!country) {
      this.citySelect.innerHTML = `<option value="">${locT('location.selectCountryFirst')}</option>`;
      return;
    }

    // Prefer the curated local list (always available, no network needed).
    const local = window.CITIES_BY_COUNTRY;
    if (local && Array.isArray(local[country]) && local[country].length) {
      this.populateCities(country, local[country]);
      return;
    }

    try {
      const response = await fetch(`/api/cities?country=${encodeURIComponent(country)}`);
      const data = await response.json();
      const cities = data.cities || [];
      if (cities.length) {
        this.populateCities(country, cities);
      } else {
        // No curated list and API returned nothing: try the geocoder as a
        // last resort, otherwise leave the select empty but enabled.
        this.citySelect.innerHTML = `<option value="">${locT('location.noCities')}</option>`;
        this.citySelect.disabled = false;
      }
    } catch (e) {
      console.error('Failed to load cities:', e);
      this.citySelect.innerHTML = `<option value="">${locT('location.errorCities')}</option>`;
      this.citySelect.disabled = false;
    }
  }

  onCityChange(e) {
    return;
  }

  open() {
    this.backdrop.hidden = false;
    this.countrySelect.value = '';
    this.citySelect.value = '';
    this.citySelect.disabled = true;
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  async confirm() {
    const country = this.countrySelect.value;
    const city = this.citySelect.value;

    if (!country || !city) {
      alert(locT('location.pleaseSelectBoth'));
      return;
    }

    try {
      const response = await fetch(`/api/location?country=${encodeURIComponent(country)}&city=${encodeURIComponent(city)}`);
      const data = await response.json();
      const results = data?.results || [];

      // Prefer the result that actually matches the chosen country (the
      // geocoder can return same-named cities in other countries), then fall
      // back to the top result.
      const match = results.find(r => (r.country || '').trim().toLowerCase() === country.trim().toLowerCase()) || results[0];

      if (match && Number.isFinite(Number(match.lat)) && Number.isFinite(Number(match.lon))) {
        const lat = Number(match.lat);
        const lon = Number(match.lon);
        this.close();

        try {
          localStorage.setItem('open-meteo-latlon', JSON.stringify({ lat, lon }));
          localStorage.setItem('open-meteo-city', city);
          localStorage.setItem('open-meteo-country', country);
        } catch (e) { /* storage may be unavailable */ }

        const detail = { city, country, lat, lon };

        // The map page listens for this event.
        document.dispatchEvent(new CustomEvent('location-selected', { detail }));

        // The rest of the app (weather card, dashboard, details, climatology)
        // listens for 'location:changed'. If we don't bridge it, selecting a
        // city never updates those pages and climatology silently falls back
        // to Marrakech.
        window.dispatchEvent(new CustomEvent('location:changed', { detail }));
      } else {
        alert(locT('location.noMatch'));
      }
    } catch (e) {
      console.error('Location fetch failed:', e);
      alert(locT('location.failedGet'));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.locationModal = new LocationModal();

  // The header geolocation button opens the picker on every page (it was
  // present in the markup everywhere but never wired up).
  const geoButton = document.querySelector('.header__geo-button');
  if (geoButton) {
    geoButton.addEventListener('click', () => {
      if (window.locationModal) window.locationModal.open();
    });
  }
});
