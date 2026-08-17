// Pure helpers for sizing /api/map-grid requests to Open-Meteo. Kept free of
// Express so they can be unit-tested directly.
//
// Open-Meteo rejects long URLs (414 URI Too Long) and its free tier rate-limits
// bursts (429). Every upstream URL is kept comfortably short by rounding
// coordinates to 2 decimals (0.01° ≈ 1.1 km — ample for an overlay wash) and
// scaling the grid resolution down when a wide/low-zoom viewport would push the
// URL over budget.

const GRID_URL_BUDGET = 4200; // chars; well under any proxy 414 threshold
const GRID_COORD_PRECISION = 2; // decimals in lat/lon sent to Open-Meteo

function gridSamplePoints(north, south, west, east, cols, rows) {
  const latArr = new Array(cols * rows);
  const lonArr = new Array(cols * rows);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const lat = north + (south - north) * (rows === 1 ? 0 : r / (rows - 1));
    for (let c = 0; c < cols; c++) {
      const lon = west + (east - west) * (cols === 1 ? 0 : c / (cols - 1));
      latArr[i] = Number(lat.toFixed(GRID_COORD_PRECISION));
      lonArr[i] = Number(lon.toFixed(GRID_COORD_PRECISION));
      i++;
    }
  }
  return { latArr, lonArr };
}

function gridUpstreamUrl(base, latArr, lonArr, fields, useArchive, date) {
  const url = new URL(base);
  url.searchParams.set('latitude', latArr.join(','));
  url.searchParams.set('longitude', lonArr.join(','));
  url.searchParams.set('timezone', 'UTC');
  if (useArchive) {
    const d = new Date(date * 1000).toISOString().slice(0, 10);
    url.searchParams.set('start_date', d);
    url.searchParams.set('end_date', d);
    fields.forEach((f) => url.searchParams.append('hourly', f));
  } else {
    // The timeline panel (OWM-style) needs hourly data: fetch 48 hours in the
    // SAME request that powers every layer, so switching time or layer on the
    // client is a pure cache hit — zero extra upstream calls. The time dimension
    // rides along in the URL so the disk cache is keyed by (bbox, forecast
    // window, fields) exactly as before.
    url.searchParams.set('forecast_days', '2');
    fields.forEach((f) => url.searchParams.append('hourly', f));
  }
  return url;
}

// Return { cols, rows, latArr, lonArr, url, bbox } sized to the URL budget.
// The returned bbox is the one the upstream request actually covers (quantized
// outward then clamped to valid ranges).
function fitGridRequest(north, south, west, east, cols, rows, fields, useArchive, date) {
  const base = useArchive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';

  // Quantize the bbox OUTWARD to ~2% of its own span so viewports that differ
  // by less than that share the same upstream URL — and therefore the same
  // 10-minute cache entry. During normal panning this turns nearly every
  // refresh into a cache hit instead of a fresh upstream call, which is what
  // keeps the app inside Open-Meteo's free-tier quota (the main cause of the
  // 503s). The quantized bbox always covers the requested one, and is clamped
  // back into [-180,180] / [-85,85] — the rounding upward can otherwise push a
  // coordinate past the valid range (e.g. east=182.32), which Open-Meteo
  // rejects and the client would have surfaced as a 502.
  const lonUnit = Math.max(east - west, 0.05) / 50;
  const latUnit = Math.max(north - south, 0.05) / 50;
  west = Math.max(-180, Math.floor(west / lonUnit) * lonUnit);
  east = Math.min(180, Math.ceil(east / lonUnit) * lonUnit);
  south = Math.max(-85, Math.floor(south / latUnit) * latUnit);
  north = Math.min(85, Math.ceil(north / latUnit) * latUnit);

  let fitCols = cols;
  let fitRows = rows;
  let pts = gridSamplePoints(north, south, west, east, fitCols, fitRows);
  let url = gridUpstreamUrl(base, pts.latArr, pts.lonArr, fields, useArchive, date);
  let guard = 0;
  while (url.toString().length > GRID_URL_BUDGET && guard++ < 8) {
    // URL length is proportional to the point count, so scale both axes by
    // sqrt(budget/len) — reaches the target in one or two steps.
    const f = Math.sqrt(GRID_URL_BUDGET / url.toString().length);
    fitCols = Math.max(4, Math.floor(fitCols * f));
    fitRows = Math.max(4, Math.floor(fitRows * f));
    pts = gridSamplePoints(north, south, west, east, fitCols, fitRows);
    url = gridUpstreamUrl(base, pts.latArr, pts.lonArr, fields, useArchive, date);
  }
  return { cols: fitCols, rows: fitRows, latArr: pts.latArr, lonArr: pts.lonArr, url, bbox: { north, south, west, east } };
}

module.exports = { fitGridRequest, gridSamplePoints, gridUpstreamUrl, GRID_URL_BUDGET };
