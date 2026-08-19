// Layer definitions for the weather map. Each layer maps to an Open-Meteo
// variable and declares a color palette (list of [value, cssColor] stops) used
// both for tile rendering and the legend. Colors are interpolated between stops.
export const LAYERS = {
  temperature: {
    id: 'temperature',
    label: 'Temperature',
    variable: 'temperature_2m',
    unit: '°C',
    type: 'scalar',
    opaque: false,
    opacity: 0.95,
    // Very dark, high-contrast palette — must read on both light OSM and
    // dark satellite basemaps.  Deep saturated tones with hard chromatic jumps.
    stops: [
      [-40, '#1a0a8e'],
      [-30, '#2919d4'],
      [-20, '#3d5af1'],
      [-10, '#1e90ff'],
      [0, '#42d9c8'],
      [5, '#6bcf4c'],
      [10, '#d4e821'],
      [15, '#f5c518'],
      [20, '#f58a18'],
      [25, '#ef6212'],
      [30, '#e02020'],
      [35, '#c01050'],
      [40, '#8b0040'],
    ],
  },
  precipitation: {
    id: 'precipitation',
    label: 'Precipitation',
    variable: 'precipitation',
    unit: 'mm',
    type: 'scalar',
    opaque: false,
    opacity: 0.95,
    // Dark blue ramp from light drizzle to heavy downpour — very saturated
    // so it reads clearly on both light and dark basemaps.
    stops: [
      [0, 'rgba(130,165,255,0)'],
      [0.2, 'rgba(120,155,255,0.55)'],
      [1, 'rgba(105,140,250,0.68)'],
      [2.5, 'rgba(85,115,242,0.78)'],
      [5, 'rgba(65,92,232,0.85)'],
      [10, 'rgba(45,68,218,0.9)'],
      [25, 'rgba(28,44,202,0.95)'],
      [50, 'rgba(16,24,185,0.98)'],
    ],
    ticks: [0.2, 1, 2.5, 5, 10, 25, 50],
  },
  radar: {
    id: 'radar',
    label: 'Radar',
    variable: 'precipitation',
    unit: 'dBZ',
    type: 'scalar',
    opaque: false,
    opacity: 0.95,
    transform: (mm) => (mm > 0 ? 10 * Math.log10(200 * Math.pow(mm, 1.6)) : -Infinity),
    stops: [
      [0, 'rgba(0,0,0,0)'],
      [15, '#6ee86e'],
      [20, '#38d438'],
      [25, '#9fd820'],
      [30, '#f2d000'],
      [35, '#f5a000'],
      [40, '#f05600'],
      [45, '#e00000'],
      [50, '#c010c0'],
      [60, '#d020d0'],
    ],
    ticks: [15, 25, 35, 45, 50],
  },
  clouds: {
    id: 'clouds',
    label: 'Clouds',
    variable: 'cloud_cover',
    unit: '%',
    type: 'cloud-blob',
    opaque: false,
    opacity: 0.98,
    stops: [
      [0, 'rgba(255,255,255,0)'],
      [50, 'rgba(255,255,255,0.8)'],
      [100, 'rgba(255,255,255,1)'],
    ],
  },
  pressure: {
    id: 'pressure',
    label: 'Pressure',
    variable: 'pressure_msl',
    unit: 'hPa',
    type: 'isobar',
    opaque: false,
    // Contour levels every 4 hPa from 988 to 1036 — the classic synoptic
    // chart convention. The colour is a subtle gradient applied to the lines
    // themselves; the fill between them stays transparent.
    contourStep: 4,
    contourMin: 988,
    contourMax: 1036,
    stops: [
      [988, '#1a3399'],
      [1000, '#2266cc'],
      [1008, '#2299cc'],
      [1013, '#22aa66'],
      [1020, '#cc8800'],
      [1028, '#cc3300'],
      [1036, '#991a1a'],
    ],
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    variable: 'wind_speed_10m',
    unit: 'km/h',
    type: 'wind-arrow',
    opaque: false,
    opacity: 0.98,
    stops: [
      [0, '#3f51ff'],
      [10, '#00b3f0'],
      [25, '#00d97a'],
      [40, '#b8d920'],
      [55, '#ffd400'],
      [75, '#ff8c00'],
      [100, '#ff2d2d'],
    ],
  },
};

// UI display order for the layer selector.
export const LAYER_ORDER = [
  'temperature',
  'precipitation',
  'radar',
  'clouds',
  'pressure',
  'wind',
];

export function getLayer(id) {
  return LAYERS[id] || LAYERS.temperature;
}
