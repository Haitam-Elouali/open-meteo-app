'use strict';

// Single source of truth for every user setting persisted in localStorage.
// Components (units, i18n, ticker, map, settings modal) read/write through
// this module instead of hardcoding raw localStorage keys, so a key rename or
// a new default lives in exactly one place.
const Settings = {
  keys: {
    tempUnit: 'open-meteo-temp-unit',
    windUnit: 'open-meteo-wind-unit',
    lang: 'open-meteo-lang',
    showTicker: 'open-meteo-show-ticker',
  },

  // Read a setting. `fallback` is returned when nothing is stored (or when
  // storage is unavailable, e.g. private mode), so callers never crash.
  get(key, fallback) {
    try {
      const v = window.localStorage.getItem(this.keys[key] || key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  },

  set(key, value) {
    try {
      window.localStorage.setItem(this.keys[key] || key, String(value));
    } catch (e) {
      // Storage can be unavailable (private mode / quota); never crash.
    }
  },

  // Boolean settings. Accepts the literal strings 'true'/'false', 'on'/'off'
  // and '1'/'0' so legacy values keep working.
  getBool(key, fallback) {
    const v = this.get(key, null);
    if (v === null) return fallback;
    return v !== 'false' && v !== 'off' && v !== '0';
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Settings;
}
