// Pure geometry + interpolation helpers for the weather map. Uses the standard
// "slippy map" XYZ tile math (same model OpenWeather/OpenStreetMap use).

// Convert a tile {z,x,y} to its top-left lat/lon (EPSG:3857 web-mercator).
export function tileToLatLon(z, x, y) {
  const n = Math.pow(2, z);
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
}

// Geographic bounds covered by a tile. north > south, east > west (usual case).
export function tileLatLngBounds(z, x, y) {
  const tl = tileToLatLon(z, x, y);
  const br = tileToLatLon(z, x + 1, y + 1);
  return { north: tl.lat, south: br.lat, west: tl.lon, east: br.lon };
}

// Build the row-major list of lat/lon sample points for a bounding box.
// Returns parallel arrays + the cols/rows used (so the response can be reshaped
// back into a 2D grid: grid[r][c] = flat[r*cols + c]).
export function buildGridRequest(bbox, cols, rows) {
  const { north, south, west, east } = bbox;
  const lats = [];
  const lons = [];
  for (let r = 0; r < rows; r++) {
    const lat = north + (south - north) * (rows === 1 ? 0 : r / (rows - 1));
    for (let c = 0; c < cols; c++) {
      const lon = west + (east - west) * (cols === 1 ? 0 : c / (cols - 1));
      lats.push(Number(lat.toFixed(4)));
      lons.push(Number(lon.toFixed(4)));
    }
  }
  return { lats, lons, cols, rows };
}

// Reshape a flat array (row-major, length rows*cols) into grid[r][c].
export function reshape(flat, cols, rows) {
  const grid = new Array(rows);
  for (let r = 0; r < rows; r++) {
    grid[r] = new Array(cols);
    for (let c = 0; c < cols; c++) grid[r][c] = flat[r * cols + c];
  }
  return grid;
}

// Bilinear sample of a grid at a geographic point. Returns null when the grid is
// empty or the point is outside and clamping fails.
export function sampleGrid(grid, lat, lon) {
  const { north, south, west, east, cols, rows, values } = grid;
  if (!values || values.length === 0) return null;
  let fx = ((lon - west) / (east - west)) * (cols - 1);
  let fy = ((north - lat) / (north - south)) * (rows - 1);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  fx = clampNum(fx, 0, cols - 1);
  fy = clampNum(fy, 0, rows - 1);
  const x0 = Math.floor(fx);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y0 = Math.floor(fy);
  const y1 = Math.min(y0 + 1, rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const v00 = values[y0][x0];
  const v10 = values[y0][x1];
  const v01 = values[y1][x0];
  const v11 = values[y1][x1];
  if ([v00, v10, v01, v11].some((v) => v == null || Number.isNaN(v))) return null;
  const top = v00 + (v10 - v00) * tx;
  const bot = v01 + (v11 - v01) * tx;
  return top + (bot - top) * ty;
}

function clampNum(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Expand a viewport bounding box by `pad` (fraction) so panning doesn't
// immediately require a refetch.
export function expandBBox(bbox, pad = 0.3) {
  const { north, south, west, east } = bbox;
  const latPad = Math.max(0.5, (north - south) * pad);
  const lonPad = Math.max(0.5, (east - west) * pad);
  return {
    north: north + latPad,
    south: south - latPad,
    west: west - lonPad,
    east: east + lonPad,
  };
}

// Normalize longitudes into [-180,180] (avoid dateline wrap issues).
export function normalizeLon(lon) {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

// Smallest zoom level at which a viewport of height `H` pixels still fits
// INSIDE the map's valid latitude range (the Web Mercator world, ±85.05°).
// Zooming out further would show empty strips above/below the poles because
// the basemap and the weather data simply don't exist past ±85°. The world is
// 256*2^z px tall and spans ~170.1° of latitude, so a viewport of H px shows
// 170.1*H/(256*2^z) degrees; require that span to stay ≤ 168° (a ~1° margin
// on each side). Floor at zoom 2 — a whole-world-in-viewport view is never
// useful on a weather map.
export function minZoomForHeight(H) {
  const z = Math.ceil(Math.log2((170.1 * H) / (256 * 168)));
  return Math.max(2, Math.min(6, z));
}
