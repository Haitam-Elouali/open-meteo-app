// A Leaflet GridLayer that renders the weather field as transparent canvas
// tiles, sampled from a shared grid. The base map stays underneath; only this
// overlay is swapped when the layer/opacity changes. Opacity is applied by
// Leaflet's built-in tile-pane opacity, so pixels keep their palette alpha.
import { buildLUT, layerRange } from './palette.js';
import { tileLatLngBounds, sampleGrid } from './grid.js';

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
      const { min, max } = layerRange(layerId);
      const lut = buildLUT(layerId, 1024);
      const lutLen = lut.length / 4;

      // Render at half resolution then upscale for speed.
      const sub = 128;
      const tmp = document.createElement('canvas');
      tmp.width = sub;
      tmp.height = sub;
      const tctx = tmp.getContext('2d');
      const img = tctx.createImageData(sub, sub);

      const bounds = tileLatLngBounds(coords.z, coords.x, coords.y);
      const dLat = bounds.north - bounds.south;
      const dLon = bounds.east - bounds.west;
      const isWind = layerId === 'wind';
      const hasWind = grid && grid.windSpeed && grid.windDir;

      for (let py = 0; py < sub; py++) {
        const lat = bounds.north - (py / (sub - 1)) * dLat;
        for (let px = 0; px < sub; px++) {
          const lon = bounds.west + (px / (sub - 1)) * dLon;
          const idx = (py * sub + px) * 4;
          let value = grid ? sampleGrid(grid, lat, lon) : null;
          if (value == null || Number.isNaN(value)) {
            img.data[idx + 3] = 0;
            continue;
          }
          let t = (value - min) / (max - min);
          if (t < 0) t = 0;
          if (t > 1) t = 1;
          const li = Math.round(t * (lutLen - 1)) | 0;
          img.data[idx] = lut[li * 4];
          img.data[idx + 1] = lut[li * 4 + 1];
          img.data[idx + 2] = lut[li * 4 + 2];
          img.data[idx + 3] = lut[li * 4 + 3];
        }
      }
      tctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, size, size);

      if (isWind && hasWind) {
        drawWindArrows(ctx, grid, bounds, size);
      }

      if (done) setTimeout(() => done(null, tile), 0);
      return tile;
    },
  });

  return new WeatherLayer({ tileSize: 256, opacity: 0.8, updateWhenIdle: false });
}

function drawWindArrows(ctx, grid, bounds, size) {
  const step = Math.max(22, Math.round(size / 8));
  const dLat = bounds.north - bounds.south;
  const dLon = bounds.east - bounds.west;
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let py = step / 2; py < size; py += step) {
    const lat = bounds.north - (py / size) * dLat;
    for (let px = step / 2; px < size; px += step) {
      const lon = bounds.west + (px / size) * dLon;
      const speed = sampleGrid({ ...grid, values: grid.windSpeed }, lat, lon);
      const dir = sampleGrid({ ...grid, values: grid.windDir }, lat, lon);
      if (speed == null || dir == null || Number.isNaN(speed)) continue;
      // Meteorological direction = where wind comes FROM. Arrow points TO.
      const rad = ((dir + 180) * Math.PI) / 180;
      const len = Math.min(step * 0.5, 6 + speed * 0.25);
      const ex = px + Math.sin(rad) * len;
      const ey = py - Math.cos(rad) * len;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // arrow head
      const ah = 4;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.sin(rad - 0.5) * ah, ey + Math.cos(rad - 0.5) * ah);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.sin(rad + 0.5) * ah, ey + Math.cos(rad + 0.5) * ah);
      ctx.stroke();
    }
  }
}
