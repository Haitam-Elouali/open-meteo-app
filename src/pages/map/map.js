(function () {
    'use strict';

    var GRID_ENDPOINT = '/api/grid';

    var LAYERS = {
        temperature:  { label: 'Temperature', var: 'temperature_2m',        unit: '\u00B0C', range: [-20, 45] },
        humidity:     { label: 'Humidity',     var: 'relative_humidity_2m', unit: '%',   range: [0, 100] },
        precipitation:{ label: 'Precipitation',var: 'precipitation',        unit: 'mm',  range: [0, 12] },
        pressure:     { label: 'Pressure',     var: 'pressure_msl',         unit: 'hPa', range: [970, 1045] },
        clouds:       { label: 'Cloud cover',  var: 'cloud_cover',          unit: '%',   range: [0, 100] },
        wind:         { label: 'Wind',         var: 'wind_speed_10m', dirVar: 'wind_direction_10m', unit: 'km/h', range: [0, 60] },
        uv:           { label: 'UV Index',     var: 'uv_index',             unit: '',    range: [0, 11] },
        dewpoint:     { label: 'Dew Point',    var: 'dew_point_2m',         unit: '\u00B0C',  range: [-10, 30] },
    };

    var SCALES = {
        temperature: [[0,[49,54,149,220]],[0.25,[69,117,180,220]],[0.5,[116,196,118,220]],[0.7,[253,212,70,220]],[0.85,[244,128,44,220]],[1,[215,48,39,220]]],
        humidity:    [[0,[188,154,99,180]],[0.5,[120,180,120,200]],[1,[30,120,200,220]]],
        precipitation:[[0,[200,220,255,0]],[0.05,[120,180,255,200]],[0.4,[40,120,255,230]],[0.7,[255,90,200,235]],[1,[150,20,120,245]]],
        pressure:    [[0,[215,48,39,210]],[0.5,[240,240,200,200]],[1,[49,91,173,220]]],
        clouds:      [[0,[255,255,255,0]],[1,[245,248,255,220]]],
        wind:        [[0,[200,230,255,200]],[0.4,[120,200,255,220]],[0.7,[255,220,120,230]],[1,[255,80,80,240]]],
        uv:          [[0,[120,220,120,200]],[0.36,[255,235,90,220]],[0.55,[255,160,50,230]],[0.73,[255,70,70,240]],[1,[160,60,200,245]]],
        dewpoint:    [[0,[60,80,160,210]],[0.5,[120,180,160,210]],[1,[210,120,80,220]]],
    };

    var MODELS = [
        { id: 'auto', name: 'Best Match (Auto)' },
        { id: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25\u00B0' },
        { id: 'ecmwf_aifs025_single', name: 'ECMWF AIFS' },
        { id: 'gfs_seamless', name: 'NOAA GFS' },
        { id: 'icon_seamless', name: 'DWD ICON' },
        { id: 'ukmo_seamless', name: 'UK Met Office' },
        { id: 'meteofrance_seamless', name: 'M\u00E9t\u00E9o-France' },
        { id: 'jma_seamless', name: 'JMA' },
        { id: 'gem_seamless', name: 'CMC GEM' },
        { id: 'cma_grapes_global', name: 'CMA GRAPES' },
        { id: 'metno_seamless', name: 'MET Nordic' },
        { id: 'knmi_seamless', name: 'KNMI' },
        { id: 'dmi_seamless', name: 'DMI' },
        { id: 'kma_seamless', name: 'KMA' },
    ];

    var U = window.Units;
    var temperature = function (v) { return U && U.temp ? U.temp(v) : v; };
    var windSpeed = function (v) { return U && U.wind ? U.wind(v) : v; };
    var windLabel = function () { return U && U.windLabel ? U.windLabel() : 'km/h'; };

    var WIND_PARTICLE_COUNT = 1500;
    var WIND_PARTICLE_MAX_LIFE = 90;
    var windParticles = [];
    var windAnimId = null;
    var windCanvas = null;
    var windCtx = null;
    var windFrameIndex = -1;

    var map, baseOsm, baseSatellite, radarLayer, infoMarker;
    var overlayCanvas = null;
    var overlayCtx = null;
    var animTimer = null;
    var state = { layer: null, model: 'auto', date: new Date(), times: [], grid: null, radar: false, satellite: false, playing: false, playSpeed: 700 };
    var clientCache = new Map();
    var CACHE_TTL = 15 * 60 * 1000;
    var lastFetchAt = 0;
    var MIN_FETCH_GAP = 2500;
    var fetchAbortController = null;

    function colorFor(key, value) {
        var scale = SCALES[key];
        if (!scale || value == null || !Number.isFinite(value)) return null;
        var range = LAYERS[key].range;
        var t = Math.max(0, Math.min(1, (value - range[0]) / (range[1] - range[0])));
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

    function ymd(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function hm(d) {
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function buildGrid(bounds) {
        var clampLat = function (v) { return Math.max(-85, Math.min(85, v)); };
        var clampLon = function (v) { return Math.max(-180, Math.min(180, v)); };
        var north = clampLat(bounds.getNorth()), south = clampLat(bounds.getSouth());
        var west = clampLon(bounds.getWest()), east = clampLon(bounds.getEast());
        if (north < south) { var tmp = north; north = south; south = tmp; }
        if (east < west) { var tmp2 = east; east = west; west = tmp2; }
        var w = Math.abs(east - west), h = Math.abs(north - south);
        var pad = 0.15;
        var step = 0.75;
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
        var tms = target.getTime();
        var best = 0, bestDiff = Infinity;
        for (var i = 0; i < times.length; i++) {
            var diff = Math.abs(new Date(times[i]).getTime() - tms);
            if (diff < bestDiff) { bestDiff = diff; best = i; }
        }
        return best;
    }

    async function fetchJson(url) {
        var r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }

    async function fetchGrid() {
        var note = document.getElementById('map-legend-note');
        if (note) note.textContent = 'Loading\u2026';
        if (!state.layer) return;
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
        lastFetchAt = Date.now();

        var cfg = LAYERS[state.layer];
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
        var hourlyVars = cfg.dirVar ? cfg.var + ',' + cfg.dirVar : cfg.var;
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
                var resp = await fetchJson(cacheKey);
                if ((resp.error || !Array.isArray(resp.data)) && params.has('models')) {
                    var p2 = new URLSearchParams(params.toString());
                    p2.delete('models');
                    var cacheKey2 = GRID_ENDPOINT + '?' + p2.toString();
                    var c2 = clientCache.get(cacheKey2);
                    resp = (c2 && c2.expires > Date.now()) ? { data: c2.data } : await fetchJson(cacheKey2);
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
                    resp = (c3 && c3.expires > Date.now()) ? { data: c3.data } : await fetchJson(fbKey);
                    if (!resp.error && Array.isArray(resp.data) && note) {
                        note.textContent = source === 'archive'
                            ? 'Archive limited \u2014 showing forecast data.'
                            : 'Forecast limited \u2014 showing latest archived data.';
                    }
                }
                if (resp.error || !Array.isArray(resp.data)) throw new Error(resp.error || 'empty');
                list = resp.data;
                clientCache.set(cacheKey, { expires: Date.now() + CACHE_TTL, data: list });
            } catch (e) {
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
    }

    function clearLayers() {
        if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
        if (overlayCanvas) {
            try { map.removeLayer(overlayCanvas); } catch (e) {}
            overlayCanvas = null;
            overlayCtx = null;
        }
        animTimer = clearInterval(animTimer); animTimer = null;
        if (state.frameURLs) {
            state.frameURLs.forEach(function (u) {
                if (u && u.indexOf('blob:') === 0) { try { URL.revokeObjectURL(u); } catch (e) {} }
            });
        }
        state.frameURLs = null; state.frames = null;
        stopWindAnimation();
        try { map.setMaxBounds(undefined); } catch (e) {}
    }

    var overlayLayer = null;

    function buildFrameCanvas(hidx) {
        var cfg = LAYERS[state.layer];
        var g = state.grid.g;
        var pts = state.grid.pts;
        var arr = state.grid.arr;
        var nx = g.lons.length, ny = g.lats.length;
        var W = 512;
        var H = Math.max(128, Math.round(W * (g.north - g.south) / Math.max(1, (g.east - g.west))));
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
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
                    if (!hh2 || hh2[cfg.var] == null || hh2[cfg.var][hidx] == null) { img.data[(iy2 * nx + ix2) * 4 + 3] = 0; continue; }
                    var v2 = hh2[cfg.var][hidx];
                    var idx = (iy2 * nx + ix2) * 4;
                    var col2 = colorFor(state.layer, v2);
                    img.data[idx] = col2[0]; img.data[idx + 1] = col2[1]; img.data[idx + 2] = col2[2]; img.data[idx + 3] = col2[3];
                }
            }
            var tmp = document.createElement('canvas');
            tmp.width = nx; tmp.height = ny;
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
    }

    function addOverlay(url) {
        var bounds = [[state.grid.g.south, state.grid.g.west], [state.grid.g.north, state.grid.g.east]];
        if (overlayLayer) {
            overlayLayer.setBounds(bounds);
            if (overlayLayer._image) overlayLayer._image.src = url;
            else overlayLayer.setUrl(url);
            return;
        }
        overlayLayer = L.imageOverlay(url, bounds, { opacity: 0.82, interactive: false }).addTo(map);
    }

    function startAutoplay() {
        if (animTimer) { clearInterval(animTimer); animTimer = null; }
        if (!state.frames || state.frames.length < 2) return;
        if (state.layer === 'wind') return;
        animTimer = setInterval(function () {
            var next = state.frameIndex >= state.frames.length - 1 ? 0 : state.frameIndex + 1;
            showFrame(next);
        }, state.playSpeed);
    }

    function stopAutoplay() {
        if (animTimer) { clearInterval(animTimer); animTimer = null; }
    }

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
                maxLife: WIND_PARTICLE_MAX_LIFE,
            });
        }
    }

    function bilinearInterpolate(grid, x, y, varName, hidx) {
        var nx = grid.lons.length, ny = grid.lats.length;
        var gx = x * (nx - 1);
        var gy = y * (ny - 1);
        var ix = Math.max(0, Math.min(nx - 2, Math.floor(gx)));
        var iy = Math.max(0, Math.min(ny - 2, Math.floor(gy)));
        var fx = gx - ix;
        var fy = gy - iy;

        function getVal(ix2, iy2) {
            var k = iy2 * nx + ix2;
            var hh = grid.arr[k] && grid.arr[k].hourly;
            if (!hh || hh[varName] == null || hh[varName][hidx] == null) return null;
            return hh[varName][hidx];
        }

        var v00 = getVal(ix, iy);
        var v10 = getVal(ix + 1, iy);
        var v01 = getVal(ix, iy + 1);
        var v11 = getVal(ix + 1, iy + 1);

        if (v00 == null && v10 == null && v01 == null && v11 == null) return null;

        v00 = v00 != null ? v00 : 0;
        v10 = v10 != null ? v10 : 0;
        v01 = v01 != null ? v01 : 0;
        v11 = v11 != null ? v11 : 0;

        return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
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
            var step = 0.003 + (speed / 80) * 0.01;
            p.x += Math.cos(rad) * step;
            p.y += Math.sin(rad) * step;
            p.life++;

            var px = p.x * w;
            var py = p.y * h;
            var alpha = Math.max(0.05, 1 - p.life / p.maxLife);
            var col = colorFor('wind', speed);
            if (col) {
                windCtx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (alpha * 0.7) + ')';
                windCtx.beginPath();
                windCtx.arc(px, py, 1.5, 0, Math.PI * 2);
                windCtx.fill();
            }

            if (p.life > p.maxLife || p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) {
                resetWindParticle(p);
            }
        }

        windAnimId = requestAnimationFrame(animateWind);
    }

    function resetWindParticle(p) {
        p.x = Math.random();
        p.y = Math.random();
        p.life = 0;
        p.maxLife = WIND_PARTICLE_MAX_LIFE;
    }

    async function toggleRadar(on) {
        if (on) {
            try {
                var meta = await fetchJson('https://api.rainviewer.com/public/weather-maps.json');
                var frame = meta.radar.past[meta.radar.past.length - 1];
                radarLayer = L.tileLayer(meta.host + frame.path + '/256/{z}/{x}/{y}/2/1.png', { opacity: 0.6, attribution: '\u00A9 RainViewer' }).addTo(map);
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

    async function updateInfo(lat, lng) {
        if (!infoMarker) {
            infoMarker = L.circleMarker([lat, lng], { radius: 6, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }).addTo(map);
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
        var hourlyVars = 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,uv_index,apparent_temperature,visibility';
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
                if (hint) hint.textContent = 'Forecast limited \u2014 showing latest archived data.';
            }
            var hourly = point ? point.hourly || {} : {};
            var times = hourly.time || [];
            var idx = findHourIndex(times, target);
            var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
            var hv = function (key) { return hourly[key] && hourly[key][idx] != null ? hourly[key][idx] : null; };

            set('info-temp', hv('temperature_2m') != null ? Math.round(temperature(hv('temperature_2m'))) + '\u00B0' : '--');
            set('info-feels', hv('apparent_temperature') != null ? Math.round(temperature(hv('apparent_temperature'))) + '\u00B0' : '--');
            set('info-humidity', hv('relative_humidity_2m') != null ? Math.round(hv('relative_humidity_2m')) + '%' : '--');
            set('info-pressure', hv('pressure_msl') != null ? Math.round(hv('pressure_msl')) + ' hPa' : '--');
            set('info-wind', hv('wind_speed_10m') != null ? Math.round(windSpeed(hv('wind_speed_10m'))) + ' ' + windLabel() : '--');
            set('info-wind-dir', hv('wind_direction_10m') != null ? Math.round(hv('wind_direction_10m')) + '\u00B0' : '--');
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

    function updateLegend() {
        var bar = document.getElementById('map-legend-bar');
        var labels = document.getElementById('map-legend-labels');
        var title = document.getElementById('map-legend-title');
        if (!state.layer) {
            if (bar) bar.style.background = 'transparent';
            if (labels) labels.innerHTML = '';
            if (title) title.textContent = 'Legend';
            return;
        }
        var cfg = LAYERS[state.layer];
        title.textContent = cfg.label;
        if (bar) bar.style.background = gradientCss(state.layer);
        if (labels) labels.innerHTML = '<span>' + cfg.range[0] + cfg.unit + '</span><span>' + cfg.range[1] + cfg.unit + '</span>';
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
            if (state.layer) fetchGrid();
            if (infoMarker) updateInfo(infoMarker.getLatLng().lat, infoMarker.getLatLng().lng);
        }
    }

    function init() {
        map = L.map('map', { center: [30, -6], zoom: 5, zoomControl: false, attributionControl: true });
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        baseOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
        }).addTo(map);
        baseSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '\u00A9 Esri', maxZoom: 19,
        });

        var modelSel = document.getElementById('map-model');
        MODELS.forEach(function (m) {
            var o = document.createElement('option');
            o.value = m.id;
            o.textContent = m.name;
            modelSel.appendChild(o);
        });
        modelSel.addEventListener('change', function () {
            state.model = modelSel.value;
            if (state.layer) fetchGrid();
            if (infoMarker) updateInfo(infoMarker.getLatLng().lat, infoMarker.getLatLng().lng);
        });

        document.querySelectorAll('.map-layer-btn[data-layer]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.dataset.layer;
                var already = state.layer === key;
                document.querySelectorAll('.map-layer-btn[data-layer]').forEach(function (b) { b.classList.remove('active'); });
                if (already) {
                    state.layer = null;
                    clearLayers();
                    updateLegend();
                    return;
                }
                state.layer = key;
                btn.classList.add('active');
                fetchGrid();
            });
        });

        document.getElementById('layer-radar').addEventListener('click', function (e) {
            state.radar = !state.radar;
            e.currentTarget.classList.toggle('active', state.radar);
            toggleRadar(state.radar);
        });
        document.getElementById('layer-satellite').addEventListener('click', function (e) {
            state.satellite = !state.satellite;
            e.currentTarget.classList.toggle('active', state.satellite);
            toggleSatellite(state.satellite);
        });

        document.getElementById('map-sidebar-toggle').addEventListener('click', function () {
            var sb = document.getElementById('map-sidebar');
            sb.classList.toggle('is-collapsed');
            document.getElementById('map-sidebar-toggle').textContent = sb.classList.contains('is-collapsed') ? '\u203A' : '\u2039';
            var fab = document.getElementById('map-sidebar-fab');
            if (fab) fab.classList.toggle('visible', sb.classList.contains('is-collapsed'));
        });

        var sidebarFab = document.getElementById('map-sidebar-fab');
        if (sidebarFab) {
            sidebarFab.addEventListener('click', function () {
                var sb = document.getElementById('map-sidebar');
                sb.classList.remove('is-collapsed');
                document.getElementById('map-sidebar-toggle').textContent = '\u2039';
                sidebarFab.classList.remove('visible');
            });
        }

        var infoPanel = document.getElementById('map-info-panel');
        var infoToggle = document.getElementById('map-info-toggle');
        if (infoToggle && infoPanel) {
            infoToggle.addEventListener('click', function () {
                infoPanel.classList.toggle('is-hidden');
            });
        }

        var def = new Date(Date.now() - 24 * 3600 * 1000);
        def.setMinutes(0, 0, 0);
        state.date = def;
        syncDateTimeInputs();

        document.getElementById('timeline-date').addEventListener('change', onDateTimeChange);
        document.getElementById('timeline-time').addEventListener('change', onDateTimeChange);
        document.getElementById('timeline-now').addEventListener('click', function () {
            state.date = new Date();
            state.date.setMinutes(0, 0, 0);
            syncDateTimeInputs();
            onDateTimeChange();
        });

        var playBtn = document.getElementById('timeline-play');
        var stopBtn = document.getElementById('timeline-stop');

        if (playBtn) {
            playBtn.addEventListener('click', function () {
                if (state.playing) {
                    state.playing = false;
                    stopAutoplay();
                    playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
                } else {
                    state.playing = true;
                    if (state.layer && state.frames && state.frames.length > 1 && state.layer !== 'wind') {
                        startAutoplay();
                    }
                    playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
                }
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', function () {
                state.playing = false;
                stopAutoplay();
                state.frameIndex = state.startIndex || 0;
                if (playBtn) playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
                if (state.layer && state.layer !== 'wind') showFrame(state.frameIndex);
            });
        }

        map.on('click', function (e) { updateInfo(e.latlng.lat, e.latlng.lng); });

        var moveT;
        map.on('moveend', function () {
            if (!state.layer || !state.region) return;
            clearTimeout(moveT);
            moveT = setTimeout(function () {
                var c = map.getCenter();
                var clat = state.region.center[0], clon = state.region.center[1];
                var outside = Math.abs(c.lat - clat) > state.region.span ||
                    Math.abs(c.lng - clon) > state.region.span;
                if (outside) fetchGrid();
            }, 800);
        });

        updateLegend();
        window.I18n && window.I18n.apply && window.I18n.apply();

        window.addEventListener('resize', function () {
            if (state.layer === 'wind' && windCanvas) resizeWindCanvas();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();