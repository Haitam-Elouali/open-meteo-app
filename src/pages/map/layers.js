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
    stops: [
      [-40, '#3b4cc0'],
      [-20, '#5a8dd6'],
      [-10, '#8fc6e8'],
      [0, '#cfeecb'],
      [10, '#f7e08a'],
      [20, '#f7a35a'],
      [30, '#e3603b'],
      [40, '#d6493b'],
    ],
  },
  precipitation: {
    id: 'precipitation',
    label: 'Precipitation',
    variable: 'precipitation',
    unit: 'mm',
    type: 'scalar',
    opaque: false,
    stops: [
      [0, 'rgba(0,0,0,0)'],
      [0.1, '#a4d3ff'],
      [1, '#3b82f6'],
      [5, '#1d4ed8'],
      [10, '#7c3aed'],
      [30, '#4c1d95'],
    ],
  },
  radar: {
    id: 'radar',
    label: 'Radar',
    variable: 'precipitation',
    unit: 'mm',
    type: 'scalar',
    opaque: false,
    stops: [
      [0, 'rgba(0,0,0,0)'],
      [0.1, '#88ef88'],
      [1, '#42f042'],
      [5, '#f5d020'],
      [10, '#f57320'],
      [30, '#e02020'],
      [60, '#a020f0'],
    ],
  },
  clouds: {
    id: 'clouds',
    label: 'Clouds',
    variable: 'cloud_cover',
    unit: '%',
    type: 'scalar',
    opaque: false,
    stops: [
      [0, 'rgba(255,255,255,0)'],
      [20, 'rgba(255,255,255,0.25)'],
      [50, 'rgba(214,214,214,0.55)'],
      [80, 'rgba(150,150,150,0.8)'],
      [100, 'rgba(90,90,90,0.95)'],
    ],
  },
  pressure: {
    id: 'pressure',
    label: 'Pressure',
    variable: 'pressure_msl',
    unit: 'hPa',
    type: 'scalar',
    opaque: false,
    stops: [
      [970, '#4c1d95'],
      [990, '#2563eb'],
      [1005, '#10b981'],
      [1015, '#f59e0b'],
      [1030, '#dc2626'],
      [1045, '#7f1d1d'],
    ],
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    variable: 'wind_speed_10m',
    unit: 'km/h',
    type: 'wind',
    opaque: false,
    stops: [
      [0, '#f7fbff'],
      [10, '#b3d8f0'],
      [20, '#6fb0e0'],
      [40, '#2c7fb8'],
      [60, '#1a4f8a'],
      [100, '#0a1f4d'],
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
