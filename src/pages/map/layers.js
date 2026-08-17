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
    // OpenWeatherMap's "classic rain" scale: a single blue ramp from a pale
    // blue-gray for drizzle to deep royal blue for heavy rain (OWM's own
    // legend stops are (110,110,205)@1mm -> (80,80,225)@10mm -> (20,20,255)
    // @140mm). The old palette turned purple at the top, which no weather map
    // shows for rain. Stops are dense at the low end because drizzle (0-2mm)
    // is the common case and needs several distinct blues to read as a field.
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
    // Legend tick positions: the stop values themselves, so each tick sits
    // exactly under the color it names (equal-interval ticks would misplace
    // them because the palette is densest at the low end).
    ticks: [0.2, 1, 2.5, 5, 10, 25, 50],
  },
  radar: {
    id: 'radar',
    label: 'Radar',
    variable: 'precipitation',
    unit: 'dBZ',
    type: 'scalar',
    opaque: false,
    // Real radar maps (Windy, RainViewer, NWS) display REFLECTIVITY in dBZ,
    // not rain rate — plotting mm/h linearly compresses the common light-rain
    // colors into a sliver and leaves the legend mostly red. Open-Meteo gives
    // mm/h, so grid values are converted with the standard Z-R relation
    // dBZ = 10*log10(200*R^1.6) before they hit the palette (see the
    // `transform` below, applied by the tile renderer). Stops sit at the
    // classic reflectivity levels: 20 dBZ light rain -> 25 -> 30 moderate ->
    // 35 -> 40 heavy -> 45 -> 50+ dBZ extreme, green -> yellow -> orange ->
    // red -> magenta, exactly the rainbow every radar app uses. Drizzle below
    // ~15 dBZ stays transparent.
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
    // Legend tick positions: the dBZ levels themselves, so each tick sits
    // exactly under the color it names.
    ticks: [15, 20, 25, 30, 35, 40, 45, 50],
  },
  clouds: {
    id: 'clouds',
    label: 'Clouds',
    variable: 'cloud_cover',
    unit: '%',
    type: 'scalar',
    opaque: false,
    // Neon-blue clouds: a glowing blue wash instead of the classic white.
    // Opacity still does the work — higher cloud cover reads as a more solid
    // neon-blue blanket, while the geo overlay stays visible above it.
    opacity: 0.95,
    stops: [
      [0, 'rgba(0,195,255,0)'],
      [25, 'rgba(0,195,255,0.5)'],
      [50, 'rgba(0,170,255,0.8)'],
      [75, 'rgba(0,140,255,0.95)'],
      [100, 'rgba(0,110,255,1)'],
    ],
  },
  pressure: {
    id: 'pressure',
    label: 'Pressure',
    variable: 'pressure_msl',
    unit: 'hPa',
    type: 'scalar',
    opaque: false,
    // Widen the interesting range (985-1035 hPa) so the typical 995-1030 band
    // spans several distinct colors instead of collapsing into one olive wash.
    stops: [
      [985, '#1e3a8a'],
      [1000, '#2563eb'],
      [1008, '#06b6d4'],
      [1013, '#10b981'],
      [1018, '#f59e0b'],
      [1025, '#dc2626'],
      [1035, '#7f1d1d'],
    ],
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    variable: 'wind_speed_10m',
    unit: 'km/h',
    type: 'wind',
    opaque: false,
    // OWM wind speed scale: blue (calm) → cyan → green → yellow → orange →
    // red (storm). Range 0-100 km/h is the same 0-29 m/s window OWM shows.
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
