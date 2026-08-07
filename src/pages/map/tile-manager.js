(function () {
    'use strict';

    // ============================================================
    // TILE COORDINATE HELPERS
    // ============================================================
    function latLngToTile(lat, lng, zoom) {
        var r = Math.PI / 180;
        var x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        var y = Math.floor((1 - Math.log(Math.tan(lat * r) + 1 / Math.cos(lat * r)) / Math.PI) / 2 * Math.pow(2, zoom));
        return { x: x, y: y, z: zoom };
    }

    function tileToLatLng(x, y, z) {
        var n = Math.pow(2, z);
        var lng = x / n * 360 - 180;
        var latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        var lat = latRad * 180 / Math.PI;
        return { lat: lat, lng: lng };
    }

    function getTileBounds(x, y, z) {
        var tl = tileToLatLng(x, y, z);
        var br = tileToLatLng(x + 1, y + 1, z);
        return {
            north: tl.lat,
            south: br.lat,
            west: tl.lng,
            east: br.lng
        };
    }

    function getVisibleTiles(map, zoom) {
        var bounds = map.getBounds();
        var nw = latLngToTile(bounds.getNorth(), bounds.getWest(), zoom);
        var se = latLngToTile(bounds.getSouth(), bounds.getEast(), zoom);
        var tiles = [];
        for (var x = nw.x; x <= se.x; x++) {
            for (var y = nw.y; y <= se.y; y++) {
                tiles.push({ x: x, y: y, z: zoom });
            }
        }
        return tiles;
    }

    // ============================================================
    // TILE CACHE
    // ============================================================
    var tileCache = new Map();
    var CACHE_TTL = 15 * 60 * 1000;

    function getCachedTile(key) {
        var cached = tileCache.get(key);
        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }
        tileCache.delete(key);
        return null;
    }

    function setCachedTile(key, data) {
        tileCache.set(key, { expires: Date.now() + CACHE_TTL, data: data });
    }

    function pruneCache() {
        var now = Date.now();
        for (var [key, entry] of tileCache) {
            if (entry.expires <= now) tileCache.delete(key);
        }
    }

    // ============================================================
    // REQUEST DEDUPLICATION
    // ============================================================
    var pendingRequests = new Map();

    async function dedupFetch(url, options) {
        var key = url + (options?.signal ? '?signal=' + (options.signal._dedupId || Math.random()) : '');
        var existing = pendingRequests.get(key);
        if (existing) {
            return existing.promise;
        }

        var controller = new AbortController();
        var promise = fetch(url, { ...options, signal: controller.signal })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .finally(function () { pendingRequests.delete(key); });

        pendingRequests.set(key, { promise: promise, controller: controller });
        return promise;
    }

    // ============================================================
    // TILE MANAGER
    // ============================================================
    var TileManager = {
        tiles: new Map(),
        layerStates: new Map(),
        currentZoom: 5,
        map: null,

        init: function (map) {
            this.map = map;
            this.currentZoom = map.getZoom();
            map.on('moveend', this.onMoveEnd.bind(this));
            map.on('zoomend', this.onZoomEnd.bind(this));
        },

        onMoveEnd: function () {
            if (this.map.getZoom() !== this.currentZoom) {
                this.currentZoom = this.map.getZoom();
                this.reloadVisibleTiles();
            }
        },

        onZoomEnd: function () {
            this.currentZoom = this.map.getZoom();
            this.reloadVisibleTiles();
        },

        getTileKey: function (x, y, z, layer) {
            return layer + '/' + z + '/' + x + '/' + y;
        },

        loadTile: function (x, y, z, layer, vars) {
            var key = this.getTileKey(x, y, z, layer);
            var cached = getCachedTile(key);
            if (cached) return Promise.resolve(cached);

            var bounds = getTileBounds(x, y, z);
            var lat = (bounds.north + bounds.south) / 2;
            var lon = (bounds.west + bounds.east) / 2;

            var url = '/api/grid?source=forecast&latitude=' + lat + '&longitude=' + lon +
                '&hourly=' + vars.join(',') + '&timezone=auto&forecast_days=1&past_days=0';

            return dedupFetch(url).then(function (data) {
                setCachedTile(key, data);
                return data;
            }).catch(function (e) {
                console.error('[tile] failed to load tile', key, e);
                return null;
            });
        },

        reloadVisibleTiles: function () {
            if (!this.map) return;
            var tiles = getVisibleTiles(this.map, this.currentZoom);
            var self = this;
            tiles.forEach(function (t) {
                var layerKeys = Array.from(self.layerStates.keys()).filter(function (k) { return self.layerStates.get(k); });
                layerKeys.forEach(function (layer) {
                    var cfg = window.MapLayers && window.MapLayers[layer];
                    if (!cfg) return;
                    var vars = cfg.dirVar ? [cfg.var, cfg.dirVar] : [cfg.var];
                    self.loadTile(t.x, t.y, t.z, layer, vars).then(function (data) {
                        if (data) self.renderTile(t.x, t.y, t.z, layer, data);
                    });
                });
            });
        },

        renderTile: function (x, y, z, layer, data) {
            // Placeholder for tile rendering logic.
            // In a full implementation this would:
            // 1. Build a small canvas for this tile's grid
            // 2. Convert it to a data URL or blob URL
            // 3. Update or create an L.ImageOverlay for this tile
            // 4. Reuse existing overlay if present
        },

        setLayerVisible: function (layer, visible) {
            this.layerStates.set(layer, visible);
            if (visible) this.reloadVisibleTiles();
        },

        clearLayer: function (layer) {
            this.layerStates.set(layer, false);
        },

        clearAll: function () {
            this.layerStates.clear();
            tileCache.clear();
            pendingRequests.clear();
        }
    };

    // Expose for global access if needed
    window.TileManager = TileManager;
    window.MapLayers = {
        temperature: { label: 'Temperature', var: 'temperature_2m', unit: '°C', range: [-20, 45] },
        humidity:    { label: 'Humidity',     var: 'relative_humidity_2m', unit: '%',   range: [0, 100] },
        precipitation:{ label: 'Precipitation',var: 'precipitation',        unit: 'mm',  range: [0, 12] },
        pressure:    { label: 'Pressure',     var: 'pressure_msl',         unit: 'hPa', range: [970, 1045] },
        clouds:      { label: 'Clouds',       var: 'cloud_cover',          unit: '%',   range: [0, 100] },
        wind:        { label: 'Wind',         var: 'wind_speed_10m', dirVar: 'wind_direction_10m', unit: 'km/h', range: [0, 60] },
        uv:          { label: 'UV Index',     var: 'uv_index',             unit: '',    range: [0, 11] },
        dewpoint:    { label: 'Dew Point',    var: 'dew_point_2m',         unit: '°C',  range: [-10, 30] }
    };

    // Periodically prune stale cache entries
    setInterval(pruneCache, 60 * 1000);
})();