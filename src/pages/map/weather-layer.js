// A Leaflet GridLayer that renders the weather field as semi-transparent canvas
// tiles, sampled from a shared grid. The base map (its outlines, labels, roads)
// always stays visible underneath because the raster itself carries alpha — it is
// not an opaque image replacing the geography. We bake a transparency factor into
// every pixel so the map shows through everywhere.
import { buildLUT, layerRange, colorAt } from './palette.js';
import { getLayer } from './layers.js';
import { tileLatLngBounds, sampleGrid, normalizeLon } from './grid.js';

// Intrinsic overlay transparency (the geography underneath must remain visible).
// Layers may raise this with their own `opacity` (e.g. clouds needs to read as
// a solid white blanket, so it declares opacity: 0.95).
const OVERLAY_ALPHA = 0.7;

// Total sampling budget (samples) for a full weather refresh. The per-tile
// sub-resolution is derived from how many tiles the current viewport shows, so
// a 4K screen (many tiles) costs about the same as a phone (few tiles) and the
// whole refresh stays well under the 60fps frame budget.
const TOTAL_SAMPLE_BUDGET = 80000;
const SUB_MIN = 24;
const SUB_MAX = 96;

// Shared scratch canvas reused across tiles (per-tile allocation of the temp
// canvas + ImageData was a large chunk of the fixed per-tile cost on big
// screens, where a full refresh renders 60-140 tiles).
let scratch = null;
function getScratch(sub) {
  if (!scratch || scratch.size !== sub) {
    const canvas = document.createElement('canvas');
    canvas.width = sub;
    canvas.height = sub;
    const ctx = canvas.getContext('2d');
    scratch = { canvas, ctx, img: ctx.createImageData(sub, sub), size: sub };
  }
  return scratch;
}

// How many tiles the current viewport needs (before Leaflet's small overdraw).
function visibleTileCount(layer) {
  const size = layer._map ? layer._map.getSize() : { x: 1024, y: 768 };
  return Math.max(1, Math.ceil(size.x / 256) * Math.ceil(size.y / 256));
}

function subResFor(layer) {
  const tiles = visibleTileCount(layer);
  const sub = Math.round(Math.sqrt(TOTAL_SAMPLE_BUDGET / tiles));
  return Math.max(SUB_MIN, Math.min(SUB_MAX, sub));
}

// Lightweight timing stats for performance tuning; map.js exposes them on
// window.__mapPerf after init.
export const weatherPerf = { renders: 0, totalMs: 0, lastMs: 0, avgMs: 0 };

export function createWeatherLayer(getGrid, getLayerId) {
  const L = window.L;

  const WeatherLayer = L.GridLayer.extend({
    createTile(coords, done) {
      const size = 256;
      const tile = document.createElement('canvas');
      tile.width = size;
      tile.height = size;
      const ctx = tile.getContext('2d');
      const layerId = getLayerId();
      const grid = getGrid();
      const def = getLayer(layerId);
      const bounds = tileLatLngBounds(coords.z, coords.x, coords.y);

      // Cloud-blob: use world-space noise renderer (world-space FBM, no tile seams)
      if (def.type === 'cloud-blob') {
        const t0 = performance.now();
        drawClouds(ctx, grid, bounds, size);
        const ms = performance.now() - t0;
        weatherPerf.renders++;
        weatherPerf.totalMs += ms;
        weatherPerf.lastMs = ms;
        weatherPerf.avgMs = weatherPerf.totalMs / weatherPerf.renders;
        if (done) setTimeout(() => done(null, tile), 0);
        return tile;
      }

      // Isobar contour lines (pressure)
      if (def.type === 'isobar') {
        const t0 = performance.now();
        drawIsobars(ctx, grid, def, bounds, size);
        const ms = performance.now() - t0;
        weatherPerf.renders++;
        weatherPerf.totalMs += ms;
        weatherPerf.lastMs = ms;
        weatherPerf.avgMs = weatherPerf.totalMs / weatherPerf.renders;
        if (done) setTimeout(() => done(null, tile), 0);
        return tile;
      }

      // Wind arrows
      if (def.type === 'wind-arrow') {
        const t0 = performance.now();
        drawWindArrows(ctx, grid, bounds, size);
        const ms = performance.now() - t0;
        weatherPerf.renders++;
        weatherPerf.totalMs += ms;
        weatherPerf.lastMs = ms;
        weatherPerf.avgMs = weatherPerf.totalMs / weatherPerf.renders;
        if (done) setTimeout(() => done(null, tile), 0);
        return tile;
      }

      // Scalar / LUT-based layers (temperature, precipitation, radar)
      const { min, max } = layerRange(layerId);
      const lut = buildLUT(layerId, 1024);
      const lutLen = lut.length / 4;

      // Sub-resolution adapts to how many tiles this screen needs so the total
      // render cost stays bounded (a big monitor renders more, coarser tiles;
      // the 256px upscale keeps the wash smooth either way).
      const sub = subResFor(this);
      const tmp = getScratch(sub);
      const tctx = tmp.ctx;
      const img = tmp.img;
      const t0 = performance.now();

      const dLat = bounds.north - bounds.south;
      const dLon = bounds.east - bounds.west;

      for (let py = 0; py < sub; py++) {
        const lat = bounds.north - (py / (sub - 1)) * dLat;
        for (let px = 0; px < sub; px++) {
          // Normalize longitude so tiles rendered past the antimeridian (in
          // the world copy) sample the same field instead of clamping to the
          // grid edge — that was the source of the hard "line in the middle"
          // and wrong colors on wrapped views.
          const lon = normalizeLon(bounds.west + (px / (sub - 1)) * dLon);
          const idx = (py * sub + px) * 4;
          let value = grid ? sampleGrid(grid, lat, lon) : null;
          if (value == null || Number.isNaN(value)) {
            img.data[idx + 3] = 0;
            continue;
          }
          // Layers may declare a transform between the raw field and the
          // palette range (radar converts mm/h -> dBZ reflectivity), applied
          // per sample so the tiles and legend both use the same scale.
          if (def.transform) value = def.transform(value);
          let t = (value - min) / (max - min);
          if (t < 0) t = 0;
          if (t > 1) t = 1;
          const li = Math.round(t * (lutLen - 1)) | 0;
          img.data[idx] = lut[li * 4];
          img.data[idx + 1] = lut[li * 4 + 1];
          img.data[idx + 2] = lut[li * 4 + 2];
          const layerAlpha = def.opacity != null ? def.opacity : OVERLAY_ALPHA;
          img.data[idx + 3] = Math.round(lut[li * 4 + 3] * layerAlpha);
        }
      }
      tctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp.canvas, 0, 0, size, size);

      const ms = performance.now() - t0;
      weatherPerf.renders++;
      weatherPerf.totalMs += ms;
      weatherPerf.lastMs = ms;
      weatherPerf.avgMs = weatherPerf.totalMs / weatherPerf.renders;

      if (done) setTimeout(() => done(null, tile), 0);
      return tile;
    },
  });

  // updateWhenIdle: true so tiles re-render only when the map settles instead
  // of re-sampling the grid on every pan frame (the main cause of pan jank).
  return new WeatherLayer({ tileSize: 256, opacity: 0.8, updateWhenIdle: true });
}


// ── Bilinear sampler for arbitrary 2D grids ────────────────────────────────
// Like sampleGrid but works on any 2D values array (e.g. grid.windDir) using
// the geometry stored in the grid object.
export function sampleField(values, north, south, west, east, cols, rows, lat, lon) {
  if (!values || !values.length) return null;
  let fx = ((lon - west) / (east - west)) * (cols - 1);
  let fy = ((north - lat) / (north - south)) * (rows - 1);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  fx = Math.max(0, Math.min(cols - 1, fx));
  fy = Math.max(0, Math.min(rows - 1, fy));
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


// ── Isobar contour rendering (marching squares) ────────────────────────────
//
// Classic synoptic-chart isobars: thin coloured contour lines drawn at regular
// pressure intervals using the marching-squares algorithm on a fine sub-grid
// sampled from the bilinear pressure field. Each line is coloured from the
// pressure palette via colorAt() so the legend and the map match exactly.

// Sub-grid resolution for the isobar field (samples per tile edge).
const ISOBAR_SUB = 48;

// Marching-squares edge interpolation. For a cell at grid position (cx, cy),
// the four corners are:
//   NW = grid[cy][cx]        NE = grid[cy][cx+1]
//   SW = grid[cy+1][cx]      SE = grid[cy+1][cx+1]
// Edges between corners (where contour crossings are detected):
//   top    = lerp between NW and NE  → x varies, y = cy
//   right  = lerp between NE and SE  → x = cx+1, y varies
//   bottom = lerp between SW and SE  → x varies, y = cy+1
//   left   = lerp between NW and SW  → x = cx, y varies

function _isoLerp(va, vb, level) {
  // Interpolation factor t ∈ [0,1] where the contour crosses the edge
  // between two corners with values va and vb. Returns 0.5 if both are
  // equal to the level (midpoint fallback to avoid division by zero).
  if (Math.abs(vb - va) < 1e-10) return 0.5;
  return (level - va) / (vb - va);
}

export function drawIsobars(ctx, grid, def, bounds, res) {
  const step = def.contourStep || 4;
  const cMin = def.contourMin || 988;
  const cMax = def.contourMax || 1036;

  // Sample the pressure field onto a local sub-grid.
  const sub = ISOBAR_SUB;
  const field = new Array(sub);
  for (let r = 0; r < sub; r++) {
    field[r] = new Float64Array(sub);
    const lat = bounds.north - (r / (sub - 1)) * (bounds.north - bounds.south);
    for (let c = 0; c < sub; c++) {
      const lon = normalizeLon(bounds.west + (c / (sub - 1)) * (bounds.east - bounds.west));
      const v = grid ? sampleGrid(grid, lat, lon) : null;
      field[r][c] = (v != null && Number.isFinite(v)) ? v : NaN;
    }
  }

  // Cell size in canvas pixels.
  const cellW = res / (sub - 1);
  const cellH = res / (sub - 1);

  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Iterate over each contour level.
  for (let level = cMin; level <= cMax; level += step) {
    const c = colorAt('pressure', level);
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.85)`;

    ctx.beginPath();

    for (let cy = 0; cy < sub - 1; cy++) {
      for (let cx = 0; cx < sub - 1; cx++) {
        const nw = field[cy][cx];
        const ne = field[cy][cx + 1];
        const sw = field[cy + 1][cx];
        const se = field[cy + 1][cx + 1];

        // Skip cells with any NaN corner — no contour can cross.
        if (Number.isNaN(nw) || Number.isNaN(ne) || Number.isNaN(sw) || Number.isNaN(se)) continue;

        // Classify each corner as above (1) or below (0) the contour level.
        const b = ((nw >= level) ? 8 : 0) |
                  ((ne >= level) ? 4 : 0) |
                  ((se >= level) ? 2 : 0) |
                  ((sw >= level) ? 1 : 0);

        // No crossings when all corners are on the same side.
        if (b === 0 || b === 15) continue;

        // Compute edge intersection points (in canvas pixel coordinates).
        const topX    = (cx + _isoLerp(nw, ne, level)) * cellW;
        const topY    = cy * cellH;
        const rightX  = (cx + 1) * cellW;
        const rightY  = (cy + _isoLerp(ne, se, level)) * cellH;
        const bottomX = (cx + _isoLerp(sw, se, level)) * cellW;
        const bottomY = (cy + 1) * cellH;
        const leftX   = cx * cellW;
        const leftY   = (cy + _isoLerp(nw, sw, level)) * cellH;

        // Draw line segments for this cell's marching-squares case.
        switch (b) {
          case 1:  case 14: _isoSeg(ctx, leftX, leftY, bottomX, bottomY); break;
          case 2:  case 13: _isoSeg(ctx, bottomX, bottomY, rightX, rightY); break;
          case 3:  case 12: _isoSeg(ctx, leftX, leftY, rightX, rightY); break;
          case 4:  case 11: _isoSeg(ctx, topX, topY, rightX, rightY); break;
          case 5:  // saddle — ambiguous
            _isoSeg(ctx, leftX, leftY, topX, topY);
            _isoSeg(ctx, bottomX, bottomY, rightX, rightY);
            break;
          case 6:  case 9:  _isoSeg(ctx, topX, topY, bottomX, bottomY); break;
          case 7:  case 8:  _isoSeg(ctx, leftX, leftY, topX, topY); break;
          case 10: // saddle — ambiguous
            _isoSeg(ctx, leftX, leftY, bottomX, bottomY);
            _isoSeg(ctx, topX, topY, rightX, rightY);
            break;
        }
      }
    }

    ctx.stroke();
  }

  // Add pressure labels along the contour lines at a few positions per tile.
  _addIsobarLabels(ctx, field, sub, cellW, cellH, step, cMin, cMax);
}

function _isoSeg(ctx, x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

// Place pressure labels on the contour lines. Walk along each contour and
// drop a label every ~80px of arc length; the label shows the hPa value.
function _addIsobarLabels(ctx, field, sub, cellW, cellH, step, cMin, cMax) {
  const labelInterval = 2; // label every Nth contour level to avoid clutter
  let levelIdx = 0;
  for (let level = cMin; level <= cMax; level += step) {
    levelIdx++;
    if (levelIdx % labelInterval !== 0) continue;

    const c = colorAt('pressure', level);
    // Walk the sub-grid looking for contour crossings on the top and left edges
    // of cells — pick the first crossing point as the label position.
    let labelPlaced = false;
    for (let cy = 0; cy < sub - 1 && !labelPlaced; cy++) {
      for (let cx = 0; cx < sub - 1 && !labelPlaced; cx++) {
        const nw = field[cy][cx];
        const ne = field[cy][cx + 1];
        const sw = field[cy + 1][cx];
        const se = field[cy + 1][cx + 1];
        if (Number.isNaN(nw) || Number.isNaN(ne) || Number.isNaN(sw) || Number.isNaN(se)) continue;

        const b = ((nw >= level) ? 8 : 0) |
                  ((ne >= level) ? 4 : 0) |
                  ((se >= level) ? 2 : 0) |
                  ((sw >= level) ? 1 : 0);
        if (b === 0 || b === 15) continue;

        // Use the top edge crossing if it exists, otherwise the left edge.
        let lx, ly;
        if (b & 12) { // top edge has a crossing (NW/NE differ)
          const t = _isoLerp(nw, ne, level);
          lx = (cx + t) * cellW;
          ly = cy * cellH;
        } else { // left edge
          const t = _isoLerp(nw, sw, level);
          lx = cx * cellW;
          ly = (cy + t) * cellH;
        }

        // Only place if it's within the central 60% of the tile to avoid
        // labels being cut off at tile edges.
        if (lx > sub * cellW * 0.2 && lx < sub * cellW * 0.8 &&
            ly > sub * cellH * 0.15 && ly < sub * cellH * 0.85) {
          ctx.save();
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Dark outline for readability.
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillText(String(level), lx + 1, ly + 1);
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.95)`;
          ctx.fillText(String(level), lx, ly);
          ctx.restore();
          labelPlaced = true;
        }
      }
    }
  }
}


// ── Wind arrow rendering ───────────────────────────────────────────────────
//
// Directional arrows placed on a regular grid within each tile. The arrow
// direction follows the wind direction (meteorological convention: direction
// the wind blows FROM, rotated 180° so the arrow points where the wind is
// going). Arrow colour is mapped from the wind-speed palette.

// Approximate pixel spacing between arrow centres.
const ARROW_SPACING = 36;

export function drawWindArrows(ctx, grid, bounds, res) {
  if (!grid) return;

  // Arrow grid: place arrows at fixed pixel intervals.
  const spacing = ARROW_SPACING;
  const half = spacing / 2;

  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // grid.values holds wind speed when the wind layer is active.
  // grid.windDir holds wind direction (2D, reshaped by applyLayerToGrid).
  const hasDir = grid.windDir && grid.windDir[0];

  for (let py = half; py < res; py += spacing) {
    for (let px = half; px < res; px += spacing) {
      // Convert pixel position to geographic coordinates.
      const lat = bounds.north - (py / (res - 1)) * (bounds.north - bounds.south);
      const lon = normalizeLon(bounds.west + (px / (res - 1)) * (bounds.east - bounds.west));

      // Wind speed from the grid's values array (bilinearly sampled).
      const speedVal = sampleGrid(grid, lat, lon);

      // Wind direction from the dedicated windDir 2D array.
      const dirVal = hasDir
        ? sampleField(grid.windDir, grid.north, grid.south, grid.west, grid.east,
                       grid.cols, grid.rows, lat, lon)
        : null;

      if (speedVal == null || !Number.isFinite(speedVal) || speedVal <= 0) continue;
      if (dirVal == null || !Number.isFinite(dirVal)) continue;

      const c = colorAt('wind', speedVal);

      // Arrow length scales with speed (min 5px, max 14px).
      const len = Math.max(5, Math.min(14, speedVal * 0.15));
      const headLen = Math.min(len * 0.4, 5);

      // Meteorological convention: direction is where wind blows FROM.
      // Convert to radians: arrow should point in the direction wind blows TO.
      const angle = (dirVal + 180) * Math.PI / 180;

      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      const tipX = px + dx * len;
      const tipY = py + dy * len;
      const tailX = px - dx * len;
      const tailY = py - dy * len;

      // Shaft.
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.85)`;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Arrowhead (two short lines from tip back at ±35°).
      const headAngle = 35 * Math.PI / 180;
      const cosH = Math.cos(headAngle);
      const sinH = Math.sin(headAngle);

      // Rotate the back-direction by ±35°.
      const h1x = tipX + (-dx * cosH + dy * sinH) * headLen;
      const h1y = tipY + (-dy * cosH - dx * sinH) * headLen;
      const h2x = tipX + (-dx * cosH - dy * sinH) * headLen;
      const h2y = tipY + (-dy * cosH + dx * sinH) * headLen;

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(h1x, h1y);
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(h2x, h2y);
      ctx.stroke();
    }
  }
}


// ── Noise functions for cloud rendering ─────────────────────────────────────
function _hash(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263 + 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return h;
}
function _grad(h, dx, dy) {
  const g = h & 3;
  return g === 0 ? dx + dy : g === 1 ? -dx + dy : g === 2 ? dx - dy : -dx - dy;
}
function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = _grad(_hash(ix, iy), fx, fy);
  const n10 = _grad(_hash(ix + 1, iy), fx - 1, fy);
  const n01 = _grad(_hash(ix, iy + 1), fx, fy - 1);
  const n11 = _grad(_hash(ix + 1, iy + 1), fx - 1, fy - 1);
  return (n00 + sx * (n10 - n00)) + sy * ((n01 + sx * (n11 - n01)) - (n00 + sx * (n10 - n00)));
}
function fbm(x, y, octaves) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < (octaves || 4); i++) {
    val += amp * valueNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return val;
}

// ── Cloud rendering (world-space noise, no tile seams) ─────────────────────
function drawClouds(ctx, grid, bounds, res) {
  const dLat = bounds.north - bounds.south;
  const dLon = bounds.east - bounds.west;
  const img = ctx.createImageData(res, res);
  const noiseScale = 10.0;
  for (let py = 0; py < res; py++) {
    const lat = bounds.north - (py / (res - 1)) * dLat;
    for (let px = 0; px < res; px++) {
      const lon = normalizeLon(bounds.west + (px / (res - 1)) * dLon);
      const idx = (py * res + px) * 4;
      const value = grid ? sampleGrid(grid, lat, lon) : null;
      if (value == null || !Number.isFinite(value) || value < 2) {
        img.data[idx + 3] = 0;
        continue;
      }
      const cover = Math.max(0, Math.min(100, value)) / 100;
      const nx = lon / 360 * noiseScale;
      const ny = lat / 180 * noiseScale;
      const noise = fbm(nx, ny, 5);
      const distorted = Math.max(0, Math.min(1,
        cover + noise * 0.5 * Math.min(cover * 2, 1)
      ));
      let alpha;
      if (distorted > 0.6) alpha = 255;
      else if (distorted < 0.08) alpha = 0;
      else {
        const t = (distorted - 0.08) / 0.52;
        alpha = Math.round(255 * t * t * (3 - 2 * t));
      }
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = alpha;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = res; tmp.height = res;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, res, res);
}
