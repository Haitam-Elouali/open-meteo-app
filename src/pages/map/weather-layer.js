// A Leaflet GridLayer that renders the weather field as semi-transparent canvas
// tiles, sampled from a shared grid. The base map (its outlines, labels, roads)
// always stays visible underneath because the raster itself carries alpha — it is
// not an opaque image replacing the geography. We bake a transparency factor into
// every pixel so the map shows through everywhere.
import { buildLUT, layerRange } from './palette.js';
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

      const bounds = tileLatLngBounds(coords.z, coords.x, coords.y);
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
