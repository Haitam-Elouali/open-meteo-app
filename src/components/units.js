// Shared unit helpers (temperature + wind). Preferences are stored in
// localStorage by the settings modal and applied on every page load.
window.Units = {
  tempUnit() {
    try { return localStorage.getItem('open-meteo-temp-unit') || 'c'; }
    catch (e) { return 'c'; }
  },
  windUnit() {
    try { return localStorage.getItem('open-meteo-wind-unit') || 'kmh'; }
    catch (e) { return 'kmh'; }
  },
  temp(c) {
    c = Number(c);
    if (!Number.isFinite(c)) return c;
    return this.tempUnit() === 'f' ? c * 9 / 5 + 32 : c;
  },
  wind(kmh) {
    kmh = Number(kmh);
    if (!Number.isFinite(kmh)) return kmh;
    return this.windUnit() === 'mph' ? kmh * 0.621371 : kmh;
  },
  tempLabel() { return this.tempUnit() === 'f' ? '°F' : '°C'; },
  windLabel() { return this.windUnit() === 'mph' ? 'mph' : 'km/h'; }
};
