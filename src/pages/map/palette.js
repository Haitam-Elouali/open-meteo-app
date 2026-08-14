// Pure color-mapping utilities for weather layers. No DOM dependencies so they
// can be unit-tested and benchmarked in Node.
import { LAYERS, getLayer } from './layers.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function parseColor(str) {
  if (typeof str === 'string' && str.startsWith('#')) {
    let h = str.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

export function layerRange(layerId) {
  const stops = getLayer(layerId).stops;
  return { min: stops[0][0], max: stops[stops.length - 1][0] };
}

export function valueToT(layerId, value) {
  const { min, max } = layerRange(layerId);
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

// Interpolated color for a value. Returns {r,g,b,a} with a in 0..1.
export function colorAt(layerId, value) {
  const stops = getLayer(layerId).stops;
  const v = clamp(value, stops[0][0], stops[stops.length - 1][0]);
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
  const [v0, c0] = stops[i];
  const [v1, c1] = stops[i + 1];
  const a = parseColor(c0);
  const b = parseColor(c1);
  const t = v1 === v0 ? 0 : (v - v0) / (v1 - v0);
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: a.a + (b.a - a.a) * t,
  };
}

// Precomputed lookup table (size*4 bytes RGBA) for fast per-pixel mapping.
export function buildLUT(layerId, size = 1024) {
  const { min, max } = layerRange(layerId);
  const lut = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    const value = min + (i / (size - 1)) * (max - min);
    const c = colorAt(layerId, value);
    lut[i * 4] = c.r;
    lut[i * 4 + 1] = c.g;
    lut[i * 4 + 2] = c.b;
    lut[i * 4 + 3] = Math.round(c.a * 255);
  }
  return lut;
}

// Sample the LUT with a normalized t in [0,1].
export function sampleLUT(lut, t) {
  const i = clamp(Math.round(t * (lut.length / 4 - 1)), 0, lut.length / 4 - 1) | 0;
  return { r: lut[i * 4], g: lut[i * 4 + 1], b: lut[i * 4 + 2], a: lut[i * 4 + 3] };
}

// Legend stops (value + css color) sampled across the palette range.
export function legendStops(layerId, count = 7) {
  const { min, max } = layerRange(layerId);
  const stops = [];
  for (let i = 0; i < count; i++) {
    const value = min + (i / (count - 1)) * (max - min);
    const c = colorAt(layerId, value);
    stops.push({ value, color: `rgba(${c.r},${c.g},${c.b},${c.a})` });
  }
  return stops;
}
