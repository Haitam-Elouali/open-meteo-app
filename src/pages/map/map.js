(function () {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    var GRID_ENDPOINT = '/api/grid';
    var CITIES_ENDPOINT = '/api/cities';

    var LAYERS = {
        temperature:  { label: 'Temperature', var: 'temperature_2m',        unit: '\u00B0C', range: [-20, 45], icon: '🌡️' },
        humidity:     { label: 'Humidity',     var: 'relative_humidity_2m', unit: '%',   range: [0, 100], icon: '💧' },
        precipitation:{ label: 'Precipitation',var: 'precipitation',        unit: 'mm',  range: [0, 12],  icon: '🌧️' },
        pressure:     { label: 'Pressure',     var: 'pressure_msl',         unit: 'hPa', range: [970, 1045], icon: '🔵' },
        clouds:       { label: 'Clouds',       var: 'cloud_cover',          unit: '%',   range: [0, 100], icon: '☁️' },
        wind:         { label: 'Wind',         var: 'wind_speed_10m', dirVar: 'wind_direction_10m', unit: 'km/h', range: [0, 60], icon: '💨' },
        uv:           { label: 'UV Index',     var: 'uv_index',             unit: '',    range: [0, 11],  icon: '☀️' },
        dewpoint:     { label: 'Dew Point',    var: 'dew_point_2m',         unit: '\u00B0C', range: [-10, 30], icon: '🌡️' }
    };

    var SCALES = {
        temperature: [[0,[49,54,149,220]],[0.25,[69,117,180,220]],[0.5,[116,196,118,220]],[0.7,[253,212,70,220]],[0.85,[244,128,44,220]],[1,[215,48,39,220]]],
        humidity:    [[0,[188,154,99,180]],[0.5,[120,180,120,200]],[1,[30,120,200,220]]],
        precipitation:[[0,[200,220,255,0]],[0.05,[120,180,255,200]],[0.4,[40,120,255,230]],[0.7,[255,90,200,235]],[1,[150,20,120,245]]],
        pressure:    [[0,[215,48,39,210]],[0.5,[240,240,200,200]],[1,[49,91,173,220]]],
        clouds:      [[0,[255,255,255,0]],[1,[245,248,255,220]]],
        wind:        [[0,[200,230,255,200]],[0.4,[120,200,255,220]],[0.7,[255,220,120,230]],[1,[255,80,80,240]]],
        uv:          [[0,[120,220,120,200]],[0.36,[255,235,90,220]],[0.55,[255,160,50,230]],[0.73,[255,70,70,240]],[1,[160,60,200,245]]],
        dewpoint:    [[0,[60,80,160,210]],[0.5,[120,180,160,210]],[1,[210,120,80,220]]]
    };

    var MODELS = [
        { id: 'auto', name: 'Best Match (Auto)' },
        { id: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25°' },
        { id: 'ecmwf_aifs025_single', name: 'ECMWF AIFS' },
        { id: 'gfs_seamless', name: 'NOAA GFS' },
        { id: 'icon_seamless', name: 'DWD ICON' },
        { id: 'ukmo_seamless', name: 'UK Met Office' },
        { id: 'meteofrance_seamless', name: 'Météo-France' },
        { id: 'jma_seamless', name: 'JMA' },
        { id: 'gem_seamless', name: 'CMC GEM' },
        { id: 'cma_grapes_global', name: 'CMA GRAPES' },
        { id: 'metno_seamless', name: 'MET Nordic' },
        { id: 'knmi_seamless', name: 'KNMI' },
        { id: 'dmi_seamless', name: 'DMI' },
        { id: 'kma_seamless', name: 'KMA' }
    ];

    var WMO_CODES = {
        0: { label: 'Clear sky', icon: '☀️' },
        1: { label: 'Mainly clear', icon: '🌤️' },
        2: { label: 'Partly cloudy', icon: '⛅' },
        3: { label: 'Overcast', icon: '☁️' },
        45: { label: 'Fog', icon: '🌫️' },
        48: { label: 'Depositing rime fog', icon: '🌫️' },
        51: { label: 'Light drizzle', icon: '🌦️' },
        53: { label: 'Moderate drizzle', icon: '🌦️' },
        55: { label: 'Dense drizzle', icon: '🌧️' },
        56: { label: 'Light freezing drizzle', icon: '🌧️' },
        57: { label: 'Dense freezing drizzle', icon: '🌧️' },
        61: { label: 'Slight rain', icon: '🌦️' },
        63: { label: 'Moderate rain', icon: '🌧️' },
        65: { label: 'Heavy rain', icon: '🌧️' },
        66: { label: 'Light freezing rain', icon: '🌧️' },
        67: { label: 'Heavy freezing rain', icon: '🌧️' },
        71: { label: 'Slight snow fall', icon: '🌨️' },
        73: { label: 'Moderate snow fall', icon: '🌨️' },
        75: { label: 'Heavy snow fall', icon: '❄️' },
        77: { label: 'Snow grains', icon: '❄️' },
        80: { label: 'Slight rain showers', icon: '🌦️' },
        81: { label: 'Moderate rain showers', icon: '🌧️' },
        82: { label: 'Violent rain showers', icon: '🌧️' },
        85: { label: 'Slight snow showers', icon: '🌨️' },
        86: { label: 'Heavy snow showers', icon: '❄️' },
        95: { label: 'Thunderstorm', icon: '⛈️' },
        96: { label: 'Thunderstorm with slight hail', icon: '⛈️' },
        99: { label: 'Thunderstorm with heavy hail', icon: '⛈️' }
    };

    // ============================================================
    // UTILITIES
    // ============================================================
    var U = window.Units;
    var temperature = function (v) { return U && U.temp ? U.temp(v) : v; };
    var windSpeed = function (v) { return U && U.wind ? U.wind(v) : v; };
    var windLabel = function () { return U && U.windLabel ? U.windLabel() : 'km/h'; };

    function ymd(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function hm(d) {
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function debounce(fn, wait) {
        var t;
        return function () {
            var ctx = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function colorFor(key, value) {
        var scale = SCALES[key];
        if (!scale || value == null || !Number.isFinite(value)) return null;
        var range = LAYERS[key].range;
        var t = clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
        for (var i = 0; i < scale.length - 1; i++) {
            var t0 = scale[i][0], c0 = scale[i][1];
            var t1 = scale[i + 1][0], c1 = scale[i + 1][1];
            if (t >= t0 && t <= t1) {
                var f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
                return [0, 1, 2, 3].map(function (j) { return Math.round(c0[j] + (c1[j] - c0[j]) * f); });
            }
        }
        return scale[scale.length - 1][1];
    }

    function gradientCss(key) {
        var s = SCALES[key];
        if (!s) return 'transparent';
        return 'linear-gradient(to right,' + s.map(function (entry) {
            var c = entry[1];
            return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] / 255) + ') ' + (entry[0] * 100).toFixed(0) + '%';
        }).join(',') + ')';
    }

    function buildGrid(bounds) {
        var clampLat = function (v) { return Math.max(-85, Math.min(85, v)); };
        var clampLon = function (v) { return Math.max(-180, Math.min(180, v)); };
        var north = clampLat(bounds.getNorth()), south = clampLat(bounds.getSouth());
        var west = clampLon(bounds.getWest()), east = clampLon(bounds.getEast());
        if (north < south) { var tmp = north; north = south; south = tmp; }
        if (east < west) { var tmp2 = east; east = west; west = tmp2; }
        var w = Math.abs(east - west), h = Math.abs(north - south);
        var pad = 0.15, step = 0.75;
        while (((w / step) + 3) * ((h / step) + 3) > 120) step += 0.25;
        var westP = clampLon(west - w * pad), eastP = clampLon(east + w * pad);
        var southP = clampLat(south - h * pad), northP = clampLat(north + h * pad);
        var lats = [], lons = [];
        for (var lat = northP; lat >= southP; lat -= step) lats.push(+lat.toFixed(3));
        for (var lon = westP; lon <= eastP; lon += step) lons.push(+lon.toFixed(3));
        return { lats: lats, lons: lons, north: northP, south: southP, west: westP, east: eastP };
    }

    function findHourIndex(times, target) {
        if (!times || !times.length) return 0;
        var tms = target.getTime(), best = 0, bestDiff = Infinity;
        for (var i = 0; i < times.length; i++) {
            var diff = Math.abs(new Date(times[i]).getTime() - tms);
            if (diff < bestDiff) { bestDiff = diff; best = i; }
        }
        return best;
    }

    async function fetchJson(url, options) {
        options = options || {};
        var resp = await fetch(url, options);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
    }

    // ============================================================
    // STATE
    // ============================================================
    var state = {
        layer: null,
        model: 'auto',
        date: new Date(Date.now() - 24 * 3600 * 1000),
        times: [],
        grid: null,
        radar: false,
        satellite: false,
        playing: false,
        playSpeed: 1000,
        frameIndex: 0,
        startIndex: 0,
        region: null,
        activeLayers: {},
        opacities: {},
        searchHistory: [],
        favorites: [],
        locateMarker: null,
        locateAccuracy: null,
        weatherStations: null,
        scaleControl: null,
        showCoords: true
    };

    // Cache
    var clientCache = new Map();
    var CACHE_TTL = 15 * 60 * 1000;
    var lastFetchAt = 0;
    var MIN_FETCH_GAP = 2500;
    var fetchAbortController = null;

    // Map references
    var map, baseOsm, baseSatellite, radarLayer, overlayLayer, overlayCanvas, overlayCtx;
    var windCanvas, windCtx, windAnimId, windParticles = [];
    var animTimer = null;
    var infoMarker = null;
    var moveTimeout = null;
    var hoverDebounce = null;

    // ============================================================
    // MAP INITIALIZATION
    // ============================================================
    function initMap() {
        map = L.map('map', {
            center: [30, -6],
            zoom: 5,
            zoomControl: false,
            attributionControl: true,
            fadeAnimation: true,
            markerZoomAnimation: true,
            worldCopyJump: false
        });

        baseOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 4
        }).addTo(map);

        baseSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        });

        // Custom zoom control
        L.Control.Zoom = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function () {
                var container = L.DomUtil.create('div', 'map-controls');
                var zoomIn = L.DomUtil.create('button', 'map-ctrl-btn', container);
                zoomIn.innerHTML = '+';
                zoomIn.setAttribute('aria-label', 'Zoom in');
                zoomIn.onclick = function () { map.zoomIn(); };
                var zoomOut = L.DomUtil.create('button', 'map-ctrl-btn', container);
                zoomOut.innerHTML = '−';
                zoomOut.setAttribute('aria-label', 'Zoom out');
                zoomOut.onclick = function () { map.zoomOut(); };
                return container;
            }
        });

        // Custom scale control
        L.Control.Scale = L.Control.extend({
            options: { position: 'bottomleft', metric: true, imperial: false },
            onAdd: function () {
                var container = L.DomUtil.create('div', 'leaflet-control-scale');
                container.style.cssText = 'margin:0 0 8px 8px;padding:4px 8px;background:rgba(15,23,42,0.72);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e5e7eb;font-size:11px;font-family:Roboto,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
                this._container = container;
                map.on('zoomend moveend', this._update, this);
                this._update();
                return container;
            },
            _update: function () {
                if (!this._container) return;
                var maxZoom = 18;
                var bounds = map.getBounds();
                var center = map.getCenter();
                var latlng1 = map.containerPointToLatLng([0, 0]);
                var latlng2 = map.containerPointToLatLng([100, 0]);
                var dist = latlng1.distanceTo(latlng2);
                var metersPerPixel = dist / 100;
                var width = map.getSize().x;
                var totalMeters = metersPerPixel * width;
                var km = totalMeters / 1000;
                var text = km > 1 ? Math.round(km) + ' km' : Math.round(totalMeters) + ' m';
                this._container.textContent = 'Scale: ' + text;
            },
            onRemove: function () {
                map.off('zoomend moveend', this._update, this);
            }
        });

        new L.Control.Zoom().addTo(map);
        new L.Control.Scale().addTo(map);

        // Map events
        map.on('click', onMapClick);
        map.on('moveend', onMapMoveEnd);
        map.on('zoomend', onMapZoomEnd);
        map.on('mousemove', onMapMouseMove);
        map.on('resize', onMapResize);

        // Populate model select
        var modelSel = document.getElementById('map-model');
        MODELS.forEach(function (m) {
            var o = document.createElement('option');
            o.value = m.id;
            o.textContent = m.name;
            modelSel.appendChild(o);
        });
    }

    // ============================================================
    // WEATHER DATA FETCHING
    // ============================================================
    async function fetchGrid() {
        var note = document.getElementById('map-legend-note');
        if (note) note.textContent = 'Loading\u2026';

        if (!state.layer || !Object.keys(state.activeLayers).length) {
            clearLayers();
            if (note) note.textContent = 'Select a layer to view weather data.';
            return;
        }

        if (map.getZoom() < 3) {
            clearLayers();
            if (note) note.textContent = 'Zoom in to load weather layers.';
            return;
        }

        var now = Date.now();
        if (now - lastFetchAt < MIN_FETCH_GAP) {
            clearTimeout(fetchGrid._t);
            fetchGrid._t = setTimeout(function () { fetchGrid(); }, MIN_FETCH_GAP - (now - lastFetchAt));
            return;
        }
        lastFetchAt = now;

        // Cancel previous request
        if (fetchAbortController) {
            fetchAbortController.abort();
        }
        fetchAbortController = new AbortController();

        var activeLayerKeys = Object.keys(state.activeLayers).filter(function (k) { return state.activeLayers[k]; });
        var cfg = LAYERS[activeLayerKeys[0]];
        if (!cfg) return;

        var center = map.getCenter();
        var span = Math.max(12, (map.getBounds().getEast() - map.getBounds().getWest()) * 1.6);
        var g = buildGrid(L.latLngBounds(
            [center.lat - span / 2, center.lng - span / 2],
            [center.lat + span / 2, center.lng + span / 2]
        ));
        state.region = { center: [center.lat, center.lng], span: span };

        var pts = [];
        g.lats.forEach(function (lat) { g.lons.forEach(function (lon) { pts.push([lat, lon]); }); });
        var lats = pts.map(function (p) { return p[0]; }).join(',');
        var lons = pts.map(function (p) { return p[1]; }).join(',');

        var vars = [];
        activeLayerKeys.forEach(function (key) {
            var l = LAYERS[key];
            vars.push(l.dirVar ? l.var + ',' + l.dirVar : l.var);
        });
        var hourlyVars = vars.join(',');

        var target = state.date;
        var isPast = target < new Date(Date.now() - 3600 * 1000);
        var source = isPast ? 'archive' : 'forecast';

        var params = new URLSearchParams();
        params.set('source', source);
        params.set('latitude', lats);
        params.set('longitude', lons);
        params.set('hourly', hourlyVars);
        params.set('timezone', 'auto');
        if (source === 'archive') {
            params.set('start_date', ymd(target));
            params.set('end_date', ymd(target));
        } else {
            params.set('forecast_days', '1');
            params.set('past_days', '0');
        }
        if (source !== 'archive' && state.model !== 'auto') params.set('models', state.model);

        var cacheKey = GRID_ENDPOINT + '?' + params.toString();
        var list = null;
        var cached = clientCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            list = cached.data;
        } else {
            try {
                var resp = await fetchJson(cacheKey, { signal: fetchAbortController.signal });
                if ((resp.error || !Array.isArray(resp.data)) && params.has('models')) {
                    var p2 = new URLSearchParams(params.toString());
                    p2.delete('models');
                    var cacheKey2 = GRID_ENDPOINT + '?' + p2.toString();
                    var c2 = clientCache.get(cacheKey2);
                    resp = (c2 && c2.expires > Date.now()) ? { data: c2.data } : await fetchJson(cacheKey2, { signal: fetchAbortController.signal });
                }
                if (resp.error || !Array.isArray(resp.data)) {
                    var fbSource = source === 'archive' ? 'forecast' : 'archive';
                    var fbParams = new URLSearchParams(params.toString());
                    fbParams.set('source', fbSource);
                    if (fbSource === 'archive') {
                        fbParams.set('start_date', ymd(target));
                        fbParams.set('end_date', ymd(target));
                        fbParams.delete('forecast_days');
                        fbParams.delete('past_days');
                        fbParams.delete('models');
                    }
                    var fbKey = GRID_ENDPOINT + '?' + fbParams.toString();
                    var c3 = clientCache.get(fbKey);
                    resp = (c3 && c3.expires > Date.now()) ? { data: c3.data } : await fetchJson(fbKey, { signal: fetchAbortController.signal });
                    if (!resp.error && Array.isArray(resp.data) && note) {
                        note.textContent = source === 'archive'
                            ? 'Archive limited — showing forecast data.'
                            : 'Forecast limited — showing latest archived data.';
                    }
                }
                if (resp.error || !Array.isArray(resp.data)) throw new Error(resp.error || 'empty');
                list = resp.data;
                clientCache.set(cacheKey, { expires: Date.now() + CACHE_TTL, data: list });
            } catch (e) {
                if (e.name === 'AbortError') return;
                if (note) note.textContent = 'Failed to load data (network or rate limit). Try again shortly.';
                console.error('[map] grid fetch failed', e);
                return;
            }
        }

        state.grid = { g: g, pts: pts, arr: list };
        state.times = list[0] ? list[0].hourly.time : [];
        try { map.setMaxBounds([[g.south - 2, g.west - 2], [g.north + 2, g.east + 2]]); } catch (e) {}
        state.startIndex = findHourIndex(state.times, target);

        if (state.layer === 'wind') {
            state.frames = null;
            state.frameURLs = null;
            startWindAnimation();
        } else {
            state.frames = [];
            state.frameURLs = [];
            for (var h = 0; h < state.times.length; h++) {
                var c = buildFrameCanvas(h);
                state.frames.push(c);
                state.frameURLs.push(c.toDataURL());
            }
        }
        state.frameIndex = state.startIndex;
        showFrame(state.frameIndex);
        if (state.playing) startAutoplay();
        updateLegend();
        updateTimelineSlider();
    }

    // ============================================================
    // LAYER MANAGEMENT
    // ============================================================
    function clearLayers() {
        if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
        if (overlayCanvas) {
            try { map.removeLayer(overlayCanvas); } catch (e) {}
            overlayCanvas = null;
            overlayCtx = null;
        }
        animTimer = clearInterval(animTimer);
        animTimer = null;
        if (state.frameURLs) {
            state.frameURLs.forEach(function (u) {
                if (u && u.indexOf('blob:') === 0) { try { URL.revokeObjectURL(u); } catch (e) {} }
            });
        }
        state.frameURLs = null;
        state.frames = null;
        stopWindAnimation();
        try { map.setMaxBounds(undefined); } catch (e) {}
    }

    function buildFrameCanvas(hidx) {
        var cfg = LAYERS[state.layer];
        if (!cfg) return document.createElement('canvas');
        var g = state.grid.g;
        var pts = state.grid.pts;
        var arr = state.grid.arr;
        var nx = g.lons.length, ny = g.lats.length;
        var W = 512;
        var H = Math.max(128, Math.round(W * (g.north - g.south) / Math.max(1, (g.east - g.west))));
        var canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext('2d');

        if (cfg.dirVar) {
            for (var iy = 0; iy < ny; iy++) {
                for (var ix = 0; ix < nx; ix++) {
                    var k = iy * nx + ix;
                    var hh = arr[k] && arr[k].hourly;
                    if (!hh || hh[cfg.var] == null || hh[cfg.var][hidx] == null) continue;
                    var v = hh[cfg.var][hidx];
                    var col = colorFor(state.layer, v);
                    var x = ((g.lons[ix] - g.west) / Math.max(0.0001, (g.east - g.west))) * W;
                    var y = ((g.north - g.lats[iy]) / Math.max(0.0001, (g.north - g.south))) * H;
                    drawWindGlyph(ctx, x, y, cfg.range[1], v, hh[cfg.dirVar] ? hh[cfg.dirVar][hidx] : null, 13, col);
                }
            }
        } else {
            var img = ctx.createImageData(nx, ny);
            for (var iy2 = 0; iy2 < ny; iy2++) {
                for (var ix2 = 0; ix2 < nx; ix2++) {
                    var k2 = iy2 * nx + ix2;
                    var hh2 = arr[k2] && arr[k2].hourly;
                    if (!hh2 || hh2[cfg.var] == null || hh2[cfg.var][hidx] == null) {
                        img.data[(iy2 * nx + ix2) * 4 + 3] = 0;
                        continue;
                    }
                    var v2 = hh2[cfg.var][hidx];
                    var idx = (iy2 * nx + ix2) * 4;
                    var col2 = colorFor(state.layer, v2);
                    img.data[idx] = col2[0];
                    img.data[idx + 1] = col2[1];
                    img.data[idx + 2] = col2[2];
                    img.data[idx + 3] = col2[3];
                }
            }
            var tmp = document.createElement('canvas');
            tmp.width = nx;
            tmp.height = ny;
            tmp.getContext('2d').putImageData(img, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(tmp, 0, 0, W, H);
        }
        return canvas;
    }

    function drawWindGlyph(ctx, x, y, maxV, v, dir, size, col) {
        var t = Math.max(0.35, Math.min(1, v / maxV));
        var len = size * (0.6 + 0.4 * t);
        var rad = ((dir == null ? 0 : dir) - 90) * Math.PI / 180;
        var dx = Math.cos(rad) * len, dy = Math.sin(rad) * len;
        ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.95)';
        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
        var ah = len * 0.45;
        ctx.lineTo(x + dx - Math.cos(rad - 0.5) * ah, y + dy - Math.sin(rad - 0.5) * ah);
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx - Math.cos(rad + 0.5) * ah, y + dy - Math.sin(rad + 0.5) * ah);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function showFrame(hidx) {
        var note = document.getElementById('map-legend-note');
        if (!state.layer || !state.grid) return;
        var cfg = LAYERS[state.layer];
        var hasVar = state.grid.arr[0] && state.grid.arr[0].hourly && state.grid.arr[0].hourly[cfg.var];
        if (!hasVar) {
            clearLayers();
            if (note) note.textContent = 'This variable is not available for the selected model/date.';
            return;
        }
        if (note) note.textContent = '';
        state.frameIndex = hidx;
        if (state.layer === 'wind') return;
        hidx = Math.min(hidx, state.frames.length - 1);
        addOverlay(state.frameURLs[hidx]);
        var el = document.getElementById('timeline-current');
        if (el && state.times[hidx]) {
            el.textContent = new Date(state.times[hidx]).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }
        // Update hover inspection if visible
    }

    function addOverlay(url) {
        var bounds = [[state.grid.g.south, state.grid.g.west], [state.grid.g.north, state.grid.g.east]];
        var opacity = state.opacities[state.layer] != null ? state.opacities[state.layer] : 0.82;
        if (overlayLayer) {
            overlayLayer.setBounds(bounds);
            overlayLayer.setOpacity(opacity);
            if (overlayLayer._image) overlayLayer._image.src = url;
            else overlayLayer.setUrl(url);
            return;
        }
        overlayLayer = L.imageOverlay(url, bounds, { opacity: opacity, interactive: false, className: 'weather-overlay' }).addTo(map);
    }

    // ============================================================
    // WIND ANIMATION
    // ============================================================
    var WIND_PARTICLE_COUNT = 500;
    var WIND_PARTICLE_MAX_LIFE = 60;

    function startWindAnimation() {
        stopWindAnimation();
        var container = document.getElementById('map');
        if (!container) return;
        windCanvas = document.createElement('canvas');
        windCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:400;';
        container.style.position = 'relative';
        container.appendChild(windCanvas);
        windCtx = windCanvas.getContext('2d');
        resizeWindCanvas();
        initWindParticles();
        windFrameIndex = -1;
        animateWind();
    }

    function stopWindAnimation() {
        if (windAnimId) { cancelAnimationFrame(windAnimId); windAnimId = null; }
        if (windCanvas && windCanvas.parentNode) {
            windCanvas.parentNode.removeChild(windCanvas);
        }
        windCanvas = null;
        windCtx = null;
        windParticles = [];
    }

    function resizeWindCanvas() {
        if (!windCanvas) return;
        var container = document.getElementById('map');
        if (!container) return;
        var rect = container.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        windCanvas.width = rect.width * dpr;
        windCanvas.height = rect.height * dpr;
        windCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initWindParticles() {
        windParticles = [];
        for (var i = 0; i < WIND_PARTICLE_COUNT; i++) {
            windParticles.push({
                x: Math.random(),
                y: Math.random(),
                life: Math.floor(Math.random() * WIND_PARTICLE_MAX_LIFE),
                maxLife: WIND_PARTICLE_MAX_LIFE
            });
        }
    }

    function animateWind() {
        if (!state.layer || state.layer !== 'wind' || !state.grid || !windCtx) {
            windAnimId = null;
            return;
        }
        var g = state.grid.g;
        var nx = g.lons.length, ny = g.lats.length;
        var hidx = state.frameIndex;
        var w = windCanvas.width / (window.devicePixelRatio || 1);
        var h = windCanvas.height / (window.devicePixelRatio || 1);

        windCtx.clearRect(0, 0, w, h);

        for (var i = 0; i < windParticles.length; i++) {
            var p = windParticles[i];
            var gx = p.x * (nx - 1);
            var gy = p.y * (ny - 1);
            var ix = Math.max(0, Math.min(nx - 1, Math.floor(gx)));
            var iy = Math.max(0, Math.min(ny - 1, Math.floor(gy)));
            var k = iy * nx + ix;
            var hh = state.grid.arr[k] && state.grid.arr[k].hourly;
            if (!hh || hh.wind_speed_10m == null || hh.wind_direction_10m == null ||
                hh.wind_speed_10m[hidx] == null || hh.wind_direction_10m[hidx] == null) {
                p.life++;
                if (p.life > p.maxLife) resetWindParticle(p);
                continue;
            }

            var speed = bilinearInterpolate(state.grid, p.x, p.y, 'wind_speed_10m', hidx);
            var dir = bilinearInterpolate(state.grid, p.x, p.y, 'wind_direction_10m', hidx);
            if (speed == null || dir == null) { p.life++; if (p.life > p.maxLife) resetWindParticle(p); continue; }

            var rad = ((dir - 90) * Math.PI) / 180;
            var step = 0.004 + (speed / 80) * 0.012;
            p.x += Math.cos(rad) * step;
            p.y += Math.sin(rad) * step;
            p.life++;

            var px = p.x * w;
            var py = p.y * h;
            var alpha = Math.max(0.05, 1 - p.life / p.maxLife);
            var col = colorFor('wind', speed);
            if (col) {
                windCtx.globalAlpha = alpha * 0.7;
                windCtx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
                windCtx.fillRect(px - 1.5, py - 1.5, 3, 3);
            }

            if (p.life > p.maxLife || p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) {
                resetWindParticle(p);
            }
        }

        windCtx.globalAlpha = 1;
        windAnimId = requestAnimationFrame(animateWind);
    }

    function resetWindParticle(p) {
        p.x = Math.random();
        p.y = Math.random();
        p.life = 0;
        p.maxLife = WIND_PARTICLE_MAX_LIFE;
    }

    function bilinearInterpolate(grid, x, y, varName, hidx) {
        var nx = grid.lons.length, ny = grid.lats.length;
        var gx = x * (nx - 1), gy = y * (ny - 1);
        var ix = Math.max(0, Math.min(nx - 2, Math.floor(gx)));
        var iy = Math.max(0, Math.min(ny - 2, Math.floor(gy)));
        var fx = gx - ix, fy = gy - iy;

        function getVal(ix2, iy2) {
            var k = iy2 * nx + ix2;
            var hh = grid.arr[k] && grid.arr[k].hourly;
            if (!hh || hh[varName] == null || hh[varName][hidx] == null) return null;
            return hh[varName][hidx];
        }

        var v00 = getVal(ix, iy), v10 = getVal(ix + 1, iy);
        var v01 = getVal(ix, iy + 1), v11 = getVal(ix + 1, iy + 1);

        if (v00 == null && v10 == null && v01 == null && v11 == null) return null;

        v00 = v00 != null ? v00 : 0; v10 = v10 != null ? v10 : 0;
        v01 = v01 != null ? v01 : 0; v11 = v11 != null ? v11 : 0;

        return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }

    // ============================================================
    // TIMELINE
    // ============================================================
    function startAutoplay() {
        if (animTimer) { clearInterval(animTimer); animTimer = null; }
        if (!state.frames || state.frames.length < 2) return;
        if (state.layer === 'wind') return;
        animTimer = setInterval(function () {
            var next = state.frameIndex >= state.frames.length - 1 ? 0 : state.frameIndex + 1;
            showFrame(next);
            updateTimelineSlider();
        }, state.playSpeed);
    }

    function stopAutoplay() {
        if (animTimer) { clearInterval(animTimer); animTimer = null; }
    }

    function updateTimelineSlider() {
        var slider = document.getElementById('timeline-slider');
        if (slider && state.times.length > 0) {
            slider.max = state.times.length - 1;
            slider.value = state.frameIndex;
        }
    }

    function syncDateTimeInputs() {
        var d = document.getElementById('timeline-date');
        var t = document.getElementById('timeline-time');
        if (d) d.value = ymd(state.date);
        if (t) t.value = hm(state.date);
    }

    function onDateTimeChange() {
        var d = document.getElementById('timeline-date');
        var t = document.getElementById('timeline-time');
        if (d && d.value && t && t.value) {
            state.date = new Date(d.value + 'T' + t.value + ':00');
            if (Object.keys(state.activeLayers).length) fetchGrid();
            if (infoMarker) updateInfo(infoMarker.getLatLng().lat, infoMarker.getLatLng().lng);
        }
    }

    // ============================================================
    // WEATHER INFO POPUP
    // ============================================================
    async function updateInfo(lat, lng) {
        if (!infoMarker) {
            infoMarker = L.circleMarker([lat, lng], {
                radius: 6,
                color: '#fff',
                fillColor: '#3b82f6',
                fillOpacity: 1,
                weight: 2,
                opacity: 0.9
            }).addTo(map);
        } else {
            infoMarker.setLatLng([lat, lng]);
        }

        var grid = document.getElementById('map-info-grid');
        var hint = document.getElementById('map-info-hint');
        if (grid) grid.hidden = true;
        if (hint) { hint.hidden = false; hint.textContent = 'Loading\u2026'; }

        var target = state.date;
        var isPast = target < new Date(Date.now() - 3600 * 1000);
        var source = isPast ? 'archive' : 'forecast';
        var hourlyVars = 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,uv_index,apparent_temperature,visibility,weather_code';
        var params = new URLSearchParams();
        params.set('source', source);
        params.set('latitude', String(lat));
        params.set('longitude', String(lng));
        params.set('hourly', hourlyVars);
        params.set('timezone', 'auto');
        if (source === 'archive') {
            params.set('start_date', ymd(target));
            params.set('end_date', ymd(target));
        } else {
            var startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            var days = Math.min(3, Math.max(1, Math.ceil((target - startOfToday) / 86400000) + 1));
            params.set('forecast_days', String(days));
            params.set('past_days', '0');
        }
        if (source !== 'archive' && state.model !== 'auto') params.set('models', state.model);

        try {
            var resp = await fetchJson(GRID_ENDPOINT + '?' + params.toString());
            var point = Array.isArray(resp.data) ? resp.data[0] : resp.data;
            if (resp.error || !point || !point.hourly) {
                var fb = new URLSearchParams(params.toString());
                fb.set('source', 'archive');
                fb.set('start_date', ymd(target));
                fb.set('end_date', ymd(target));
                fb.delete('forecast_days');
                fb.delete('past_days');
                fb.delete('models');
                var r2 = await fetchJson(GRID_ENDPOINT + '?' + fb.toString());
                point = Array.isArray(r2.data) ? r2.data[0] : r2.data;
                if (hint) hint.textContent = 'Forecast limited — showing latest archived data.';
            }
            var hourly = point ? point.hourly || {} : {};
            var times = hourly.time || [];
            var idx = findHourIndex(times, target);
            var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
            var hv = function (key) { return hourly[key] && hourly[key][idx] != null ? hourly[key][idx] : null; };

            set('info-temp', hv('temperature_2m') != null ? Math.round(temperature(hv('temperature_2m'))) + '°' : '--');
            set('info-feels', hv('apparent_temperature') != null ? Math.round(temperature(hv('apparent_temperature'))) + '°' : '--');
            set('info-humidity', hv('relative_humidity_2m') != null ? Math.round(hv('relative_humidity_2m')) + '%' : '--');
            set('info-pressure', hv('pressure_msl') != null ? Math.round(hv('pressure_msl')) + ' hPa' : '--');
            set('info-wind', hv('wind_speed_10m') != null ? Math.round(windSpeed(hv('wind_speed_10m'))) + ' ' + windLabel() : '--');
            set('info-wind-dir', hv('wind_direction_10m') != null ? Math.round(hv('wind_direction_10m')) + '°' : '--');
            set('info-visibility', hv('visibility') != null ? Math.round(hv('visibility')) + ' m' : '--');
            set('info-uv', hv('uv_index') != null ? Math.round(hv('uv_index')) : '--');
            set('info-clouds', hv('cloud_cover') != null ? Math.round(hv('cloud_cover')) + '%' : '--');
            set('info-rain', hv('precipitation') != null ? Math.round(hv('precipitation')) + ' mm' : '--');

            if (grid) grid.hidden = false;
            if (hint) hint.hidden = true;
            var timeEl = document.getElementById('map-info-time');
            if (timeEl && times[idx]) timeEl.textContent = new Date(times[idx]).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) {
            if (hint) hint.textContent = 'Unable to load weather for this location.';
        }
    }

    // ============================================================
    // LEGEND
    // ============================================================
    function updateLegend() {
        var bar = document.getElementById('map-legend-bar');
        var labels = document.getElementById('map-legend-labels');
        var title = document.getElementById('map-legend-title');
        var note = document.getElementById('map-legend-note');

        var activeLayerKeys = Object.keys(state.activeLayers).filter(function (k) { return state.activeLayers[k]; });
        var displayLayer = state.layer || (activeLayerKeys.length > 0 ? activeLayerKeys[0] : null);

        if (!displayLayer) {
            if (bar) bar.style.background = 'transparent';
            if (labels) labels.innerHTML = '';
            if (title) title.textContent = 'Legend';
            if (note) note.textContent = 'Select a layer to view legend.';
            return;
        }

        var cfg = LAYERS[displayLayer];
        if (title) title.textContent = cfg.label;
        if (bar) bar.style.background = gradientCss(displayLayer);
        if (labels) labels.innerHTML = '<span>' + cfg.range[0] + cfg.unit + '</span><span>' + cfg.range[1] + cfg.unit + '</span>';
        if (note) note.textContent = '';
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ============================================================
    // WEATHER STATIONS
    // ============================================================
    async function loadWeatherStations() {
        if (state.weatherStations) return;

        try {
            var data = await fetchJson(CITIES_ENDPOINT);
            var stations = (data.cities || []).map(function (city) {
                return {
                    name: city.name,
                    country: city.country,
                    lat: city.lat,
                    lon: city.lon,
                    temp: city.temp,
                    weather: city.weather
                };
            });

            state.weatherStations = L.layerGroup().addTo(map);
            stations.forEach(function (station) {
                var marker = L.circleMarker([station.lat, station.lon], {
                    radius: 5,
                    color: '#fff',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.9,
                    weight: 2
                }).addTo(state.weatherStations);

                marker.bindPopup(
                    '<div class="weather-popup">' +
                    '<div class="weather-popup-header">' +
                    '<span class="weather-popup-icon">📍</span>' +
                    '<div class="weather-popup-title">' +
                    '<div class="weather-popup-city">' + escapeHtml(station.name) + '</div>' +
                    '<div class="weather-popup-country">' + escapeHtml(station.country || '') + '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="weather-popup-grid">' +
                    '<div class="weather-popup-item"><span class="weather-popup-item-label">Temperature</span><span class="weather-popup-item-value">' + (station.temp != null ? Math.round(temperature(station.temp)) + '°' : '--') + '</span></div>' +
                    '<div class="weather-popup-item"><span class="weather-popup-item-label">Weather</span><span class="weather-popup-item-value">' + escapeHtml(station.weather || '--') + '</span></div>' +
                    '</div>' +
                    '</div>'
                );
            });
        } catch (e) {
            // Weather stations require a country parameter; skip silently if unavailable.
        }
    }

    // ============================================================
    // RADAR & SATELLITE
    // ============================================================
    async function toggleRadar(on) {
        if (on) {
            try {
                var meta = await fetchJson('https://api.rainviewer.com/public/weather-maps.json');
                var frame = meta.radar.past[meta.radar.past.length - 1];
                radarLayer = L.tileLayer(meta.host + frame.path + '/256/{z}/{x}/{y}/2/1.png', {
                    opacity: 0.6,
                    attribution: '© RainViewer'
                }).addTo(map);
            } catch (e) { /* ignore */ }
        } else if (radarLayer) {
            map.removeLayer(radarLayer);
            radarLayer = null;
        }
    }

    function toggleSatellite(on) {
        if (on) {
            if (baseOsm) map.removeLayer(baseOsm);
            baseSatellite.addTo(map);
        } else {
            if (baseSatellite) map.removeLayer(baseSatellite);
            baseOsm.addTo(map);
        }
    }

    // ============================================================
    // MAP EVENT HANDLERS
    // ============================================================
    function onMapClick(e) {
        updateInfo(e.latlng.lat, e.latlng.lng);
    }

    function onMapMoveEnd() {
        if (!state.layer || !state.region) return;
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(function () {
            var c = map.getCenter();
            var clat = state.region.center[0], clon = state.region.center[1];
            var outside = Math.abs(c.lat - clat) > state.region.span ||
                Math.abs(c.lng - clon) > state.region.span;
            if (outside) fetchGrid();
        }, 800);
    }

    function onMapZoomEnd() {
        if (state.layer === 'wind' && windCanvas) resizeWindCanvas();
        updateCoordsDisplay();
    }

    function onMapResize() {
        if (state.layer === 'wind' && windCanvas) resizeWindCanvas();
        map.invalidateSize();
    }

    function onMapMouseMove(e) {
        updateCoordsDisplay();
        var tooltip = document.getElementById('map-hover-tooltip');
        if (!tooltip || !state.grid || !state.layer) return;

        var lat = e.latlng.lat, lng = e.latlng.lng;
        var g = state.grid.g;
        var nx = g.lons.length, ny = g.lats.length;
        var x = (lng - g.west) / Math.max(0.001, g.east - g.west);
        var y = (g.north - lat) / Math.max(0.001, g.north - g.south);

        if (x < 0 || x > 1 || y < 0 || y > 1) {
            tooltip.hidden = true;
            return;
        }

        var ix = Math.max(0, Math.min(nx - 1, Math.floor(x * (nx - 1))));
        var iy = Math.max(0, Math.min(ny - 1, Math.floor(y * (ny - 1))));
        var k = iy * nx + ix;
        var hh = state.grid.arr[k] && state.grid.arr[k].hourly;
        if (!hh) { tooltip.hidden = true; return; }

        var cfg = LAYERS[state.layer];
        var hidx = state.frameIndex;
        var val = hh[cfg.var] && hh[cfg.var][hidx] != null ? hh[cfg.var][hidx] : null;
        var tempVal = hh.temperature_2m && hh.temperature_2m[hidx] != null ? hh.temperature_2m[hidx] : null;
        var windVal = hh.wind_speed_10m && hh.wind_speed_10m[hidx] != null ? hh.wind_speed_10m[hidx] : null;

        var html = '<strong>' + lat.toFixed(2) + '°, ' + lng.toFixed(2) + '°</strong>';
        if (tempVal != null) html += '<br>🌡️ ' + Math.round(temperature(tempVal)) + '°';
        if (val != null) html += '<br>' + (cfg.icon || '') + ' ' + cfg.label + ': ' + Math.round(val) + cfg.unit;
        if (windVal != null) html += '<br>💨 Wind: ' + Math.round(windSpeed(windVal)) + ' ' + windLabel();

        tooltip.innerHTML = html;
        tooltip.hidden = false;
        tooltip.style.left = e.containerPoint.x + 'px';
        tooltip.style.top = (e.containerPoint.y - 12) + 'px';
    }

    function updateCoordsDisplay() {
        var coordsEl = document.getElementById('map-ctrl-coords');
        if (!coordsEl || !map) return;
        var center = map.getCenter();
        coordsEl.textContent = center.lat.toFixed(1) + '° ' + center.lng.toFixed(1) + '°';
    }

    // ============================================================
    // UI CONTROLS
    // ============================================================
    function initControls() {
        // Model select
        var modelSel = document.getElementById('map-model');
        if (modelSel) {
            modelSel.addEventListener('change', function () {
                state.model = modelSel.value;
                if (Object.keys(state.activeLayers).length) fetchGrid();
                if (infoMarker) updateInfo(infoMarker.getLatLng().lat, infoMarker.getLatLng().lng);
            });
        }

        // Layer select (dropdown)
        var layerSelect = document.getElementById('map-layer-select');
        var layerOpacity = document.getElementById('map-layer-opacity');
        var layerOpacityVal = document.getElementById('map-layer-opacity-val');

        if (layerSelect) {
            layerSelect.value = state.layer || 'temperature';
            layerSelect.addEventListener('change', function () {
                state.layer = layerSelect.value;
                state.activeLayers = {};
                state.activeLayers[state.layer] = true;
                clearLayers();
                updateLegend();
                fetchGrid();
            });
        }

        if (layerOpacity) {
            layerOpacity.value = Math.round((state.opacities[state.layer] || 0.82) * 100);
            if (layerOpacityVal) layerOpacityVal.textContent = layerOpacity.value + '%';
            layerOpacity.addEventListener('input', function () {
                var val = parseInt(layerOpacity.value, 10);
                state.opacities[state.layer] = val / 100;
                if (layerOpacityVal) layerOpacityVal.textContent = val + '%';
                if (overlayLayer) {
                    overlayLayer.setOpacity(state.opacities[state.layer]);
                }
            });
        }

        // Sidebar toggle
        var sidebarToggle = document.getElementById('map-sidebar-toggle');
        var sidebar = document.getElementById('map-sidebar');
        var sidebarFab = document.getElementById('map-sidebar-fab');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', function () {
                sidebar.classList.toggle('is-collapsed');
                if (sidebarFab) sidebarFab.classList.toggle('visible', sidebar.classList.contains('is-collapsed'));
            });
        }

        if (sidebarFab && sidebar) {
            sidebarFab.addEventListener('click', function () {
                sidebar.classList.remove('is-collapsed');
                sidebarFab.classList.remove('visible');
            });
        }

        // Info panel close / reopen
        var infoPanel = document.getElementById('map-info-panel');
        var infoToggle = document.getElementById('map-info-toggle');
        var infoClose = document.getElementById('map-info-close');
        var infoFab = document.getElementById('map-info-fab');

        if (infoClose && infoPanel) {
            infoClose.addEventListener('click', function () {
                infoPanel.classList.add('is-hidden');
                if (infoFab) infoFab.classList.add('visible');
            });
        }

        if (infoToggle && infoPanel) {
            infoToggle.addEventListener('click', function () {
                infoPanel.classList.add('is-hidden');
                if (infoFab) infoFab.classList.add('visible');
            });
        }

        if (infoFab && infoPanel) {
            infoFab.addEventListener('click', function () {
                infoPanel.classList.remove('is-hidden');
                infoFab.classList.remove('visible');
            });
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        initMap();
        initControls();

        // Set default date
        var def = new Date(Date.now() - 24 * 3600 * 1000);
        def.setMinutes(0, 0, 0);
        state.date = def;
        syncDateTimeInputs();

        // Set default layer
        state.layer = 'temperature';
        state.activeLayers = { temperature: true };
        state.opacities = { temperature: 0.82 };

        // Update layer dropdown
        var layerSelect = document.getElementById('map-layer-select');
        var layerOpacity = document.getElementById('map-layer-opacity');
        var layerOpacityVal = document.getElementById('map-layer-opacity-val');
        if (layerSelect) layerSelect.value = state.layer;
        if (layerOpacity) {
            layerOpacity.value = Math.round((state.opacities[state.layer] || 0.82) * 100);
            if (layerOpacityVal) layerOpacityVal.textContent = layerOpacity.value + '%';
        }

        updateLegend();
        updateCoordsDisplay();

        // Initial fetch
        setTimeout(function () { fetchGrid(); }, 500);

        // i18n
        if (window.I18n && window.I18n.apply) window.I18n.apply();

        // Resize handling
        window.addEventListener('resize', debounce(function () {
            if (state.layer === 'wind' && windCanvas) resizeWindCanvas();
            map.invalidateSize();
        }, 200));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();