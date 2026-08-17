// Pure builder for the multi-layer /api/map-grid response payload. Kept free of
// Express so it can be unit-tested directly.
//
// One upstream call returns every layer's field at once (temperature,
// precipitation, clouds, pressure + wind speed/direction/gusts) AND the full
// forecast window (48 hourly steps for the forecast API, 24 for the archive),
// so the client can switch layers AND timeline hours purely from this payload —
// zero additional upstream calls (Open-Meteo's free tier counts per-location
// and rate-limits hourly).
//
// Shape: `fields` is per-location x per-hour, i.e. fields.temperature[i] is the
// 48-value hourly array for grid location i (row-major over rows*cols). The
// client reshapes a single hour into its 2D grid for the tile sampler.
function buildMapGridResponse(list, fitted, layer, group, rows, cols, useArchive, date) {
  const n = rows * cols;

  // Hour labels come from the first location that actually returned data.
  let hours = null;
  for (let i = 0; i < list.length; i++) {
    const src = list[i] && list[i].hourly;
    if (src && Array.isArray(src.time) && src.time.length) {
      hours = src.time;
      break;
    }
  }
  const nHours = hours ? hours.length : 1;

  const mk = () => Array.from({ length: n }, () => new Array(nHours).fill(null));
  const layerFields = {
    temperature: mk(),
    precipitation: mk(),
    clouds: mk(),
    pressure: mk(),
    wind: mk(),
  };
  const windSpeed = mk();
  const windDir = mk();

  const pick = (obj, f, h) => {
    if (!obj) return null;
    const v = obj[f];
    if (Array.isArray(v)) {
      if (h != null && h < v.length) return v[h] ?? null;
      return v.find((x) => x !== null && x !== undefined) ?? null;
    }
    return v ?? null;
  };

  for (let i = 0; i < n; i++) {
    const loc = list[i];
    if (!loc) continue;
    const src = loc.hourly;
    if (!src) continue;
    for (let h = 0; h < nHours; h++) {
      layerFields.temperature[i][h] = pick(src, 'temperature_2m', h);
      layerFields.precipitation[i][h] = pick(src, 'precipitation', h);
      layerFields.clouds[i][h] = pick(src, 'cloud_cover', h);
      layerFields.pressure[i][h] = pick(src, useArchive ? 'surface_pressure' : 'pressure_msl', h);
      layerFields.wind[i][h] = pick(src, 'wind_speed_10m', h);
      windSpeed[i][h] = pick(src, 'wind_speed_10m', h);
      windDir[i][h] = pick(src, 'wind_direction_10m', h);
    }
  }

  return {
    layer,
    rows,
    cols,
    north: fitted.bbox.north,
    south: fitted.bbox.south,
    west: fitted.bbox.west,
    east: fitted.bbox.east,
    lats: fitted.latArr,
    lons: fitted.lonArr,
    hours,
    // `values` stays as the first hour of the requested layer group so any
    // legacy consumer (and the layer-switch cache logic) keeps working.
    values: layerFields[group].map((locArr) => locArr[0]),
    windSpeed,
    windDir,
    fields: layerFields,
    date: date || null,
  };
}

module.exports = { buildMapGridResponse };
