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
  // Input is always km/h (Open-Meteo). Convert to the selected unit.
  wind(kmh) {
    kmh = Number(kmh);
    if (!Number.isFinite(kmh)) return kmh;
    if (this.windUnit() === 'kn') return kmh / 1.852;       // km/h -> knots
    if (this.windUnit() === 'ms') return kmh / 3.6;        // km/h -> m/s
    return kmh;                                            // km/h
  },
  tempLabel() { return this.tempUnit() === 'f' ? '°F' : '°C'; },
  windLabel() {
    const u = this.windUnit();
    if (u === 'kn') return 'kn';
    if (u === 'ms') return 'm/s';
    return 'km/h';
  }
};
