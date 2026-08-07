(function () {
    'use strict';

    // ============================================================
    // ENHANCED TILE MANAGER
    // ============================================================
    var EnhancedTileManager = {
        _tiles: new Map(),
        _layerOverlays: new Map(),
        _pendingRequests: new Map(),
        _map: null,
        _currentZoom: null,
        _tileSize: 512,
        _CACHE_TTL: 15 * 60 * 1000,
        _moveTimer: null,
        _zoomTimer: null,
        _MOVE_DELAY: 150,
        _ZOOM_DELAY: 100,
        _layerStates: {},
        _layerOpacities: {},
        _activeLayers: new Set(['temperature']),
        _frameIndex: 0,
        _times: [],
        _gridData: null,
        _animationId: null,
        _isPlaying: false,
        _playSpeed: 1000,
        _listeners: [],

        _layerConfig: {
            temperature:   { var: 'temperature_2m', unit: '°C', range: [-20, 45], dirVar: null },
            humidity:      { var: 'relative_humidity_2m', unit: '%', range: [0, 100], dirVar: null },
            precipitation: { var: 'precipitation', unit: 'mm', range: [0, 12], dirVar: null },
            pressure:      { var: 'pressure_msl', unit: 'hPa', range: [970, 1045], dirVar: null },
            clouds:        { var: 'cloud_cover', unit: '%', range: [0, 100], dirVar: null },
            wind:          { var: 'wind_speed_10m', unit: 'km/h', range: [0, 60], dirVar: 'wind_direction_10m' },
            uv:            { var: 'uv_index', unit: '', range: [0, 11], dirVar: null },
            dewpoint:      { var: 'dew_point_2m', unit: '°C', range: [-10, 30], dirVar: null }
        },

        init: function (map) {
            this._map = map;
            this._currentZoom = map.getZoom();
            var self = this;

            map.on('moveend', function () {
                clearTimeout(self._moveTimer);
                self._moveTimer = setTimeout(function () { self.reloadVisibleTiles(); }, self._MOVE_DELAY);
            });

            map.on('zoomend', function () {
                self._currentZoom = map.getZoom();
                clearTimeout(self._zoomTimer);
                self._zoomTimer = setTimeout(function () { self.reloadVisibleTiles(); }, self._ZOOM_DELAY);
            });

            map.on('resize', function () { self.reloadVisibleTiles(); });

            this._pruneLoop();
        },

        subscribe: function (fn) {
            this._listeners.push(fn);
        },

        _emit: function (event) {
            this._listeners.forEach(function (fn) {
                try { fn(event); } catch (e) { console.error('[TileManager] listener error', e); }
            });
        },

        setGridData: function (gridData, times) {
            this._gridData = gridData;
            this._times = times || [];
            this._frameIndex = 0;
            this.reloadVisibleTiles();
        },

        setActiveLayers: function (layers) {
            this._activeLayers = new Set(layers);
            this.reloadVisibleTiles();
        },

        setLayerOpacity: function (layer, opacity) {
            this._layerOpacities[layer] = opacity;
            var keyPrefix = layer + ':';
            this._layerOverlays.forEach(function (overlay, key) {
                if (key.indexOf(keyPrefix) === 0) {
                    overlay.setOpacity(opacity);
                }
            });
        },

        setFrameIndex: function (idx) {
            this._frameIndex = idx;
            this.reloadVisibleTiles();
        },

        play: function () {
            if (!this._times.length) return;
            this._isPlaying = true;
            var self = this;
            this._animationId = setInterval(function () {
                var next = (self._frameIndex + 1) % self._times.length;
                self._frameIndex = next;
                self.reloadVisibleTiles();
                self._emit({ type: 'tile:frame', index: next, time: self._times[next] });
            }, this._playSpeed);
        },

        pause: function () {
            this._isPlaying = false;
            if (this._animationId) {
                clearInterval(this._animationId);
                this._animationId = null;
            }
        },

        toggle: function () {
            if (this._isPlaying) this.pause();
            else this.play();
            return this._isPlaying;
        },

        setPlaySpeed: function (speed) {
            this._playSpeed = speed;
            if (this._isPlaying) {
                this.pause();
                this.play();
            }
        },

        _latLngToTile: function (lat, lng, zoom) {
            var r = Math.PI / 180;
            var x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
            var y = Math.floor((1 - Math.log(Math.tan(lat * r) + 1 / Math.cos(lat * r)) / Math.PI) / 2 * Math.pow(2, zoom));
            var max = Math.pow(2, zoom) - 1;
            return { x: Math.max(0, Math.min(max, x)), y: Math.max(0, Math.min(max, y)), z: zoom };
        },

        _tileToLatLng: function (x, y, z) {
            var n = Math.pow(2, z);
            var lng = x / n * 360 - 180;
            var latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
            return { lat: latRad * 180 / Math.PI, lng: lng };
        },

        _getTileBounds: function (x, y, z) {
            var tl = this._tileToLatLng(x, y, z);
            var br = this._tileToLatLng(x + 1, y + 1, z);
            return { north: tl.lat, south: br.lat, west: tl.lng, east: br.east };
        },

        _getVisibleTiles: function () {
            if (!this._map) return [];
            var bounds = this._map.getBounds();
            var nw = this._latLngToTile(bounds.getNorth(), bounds.getWest(), this._currentZoom);
            var se = this._latLngToTile(bounds.getSouth(), bounds.getEast(), this._currentZoom);
            var tiles = [];
            for (var x = nw.x; x <= se.x; x++) {
                for (var y = nw.y; y <= se.y; y++) {
                    tiles.push({ x: x, y: y, z: this._currentZoom });
                }
            }
            return tiles;
        },

        _getCachedTile: function (key) {
            var entry = this._tiles.get(key);
            if (!entry) return null;
            if (Date.now() > entry.expires) {
                this._tiles.delete(key);
                return null;
            }
            return entry.data;
        },

        _setCachedTile: function (key, data) {
            this._tiles.set(key, { data: data, expires: Date.now() + this._CACHE_TTL });
        },

        _pruneLoop: function () {
            var self = this;
            setInterval(function () {
                var now = Date.now();
                self._tiles.forEach(function (entry, key) {
                    if (entry.expires <= now) self._tiles.delete(key);
                });
                self._pendingRequests.forEach(function (entry, key) {
                    if (entry.expires <= now) {
                        if (entry.controller) entry.controller.abort();
                        self._pendingRequests.delete(key);
                    }
                });
            }, 60 * 1000);
        },

        _dedupFetch: function (url) {
            var key = url;
            var existing = this._pendingRequests.get(key);
            if (existing && Date.now() < existing.expires) {
                return existing.promise;
            }

            var controller = new AbortController();
            var promise = fetch(url, { signal: controller.signal })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .finally(function () {
                    EnhancedTileManager._pendingRequests.delete(key);
                });

            this._pendingRequests.set(key, { promise: promise, controller: controller, expires: Date.now() + 30000 });
            return promise;
        },

        _buildTileUrl: function (x, y, z, layer) {
            if (!this._gridData) return null;
            var bounds = this._getTileBounds(x, y, z);
            var lat = (bounds.north + bounds.south) / 2;
            var lng = (bounds.west + bounds.east) / 2;
            var cfg = this._layerConfig[layer];
            if (!cfg) return null;

            var params = new URLSearchParams();
            params.set('source', 'forecast');
            params.set('latitude', String(lat));
            params.set('longitude', String(lng));
            params.set('timezone', 'auto');
            params.set('forecast_days', '1');
            params.set('past_days', '0');
            params.append('hourly', cfg.var);
            if (cfg.dirVar) params.append('hourly', cfg.dirVar);

            return '/api/grid?' + params.toString();
        },

        _renderTileCanvas: function (tileData, layer, frameIndex) {
            var cfg = this._layerConfig[layer];
            if (!cfg || !tileData) return null;

            var list = Array.isArray(tileData) ? tileData : [tileData];
            var point = list[0] || {};
            var hourly = point.hourly || {};
            var times = hourly.time || [];
            if (!times.length) return null;

            var hidx = Math.min(frameIndex || 0, times.length - 1);
            var W = this._tileSize;
            var H = this._tileSize;
            var canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            var ctx = canvas.getContext('2d');

            if (layer === 'wind' && cfg.dirVar) {
                var nx = 8, ny = 8;
                var cellW = W / nx, cellH = H / ny;
                for (var iy = 0; iy < ny; iy++) {
                    for (var ix = 0; ix < nx; ix++) {
                        var hh = point.hourly;
                        if (!hh || hh[cfg.var] == null || hh[cfg.var][hidx] == null) continue;
                        var v = hh[cfg.var][hidx];
                        var dir = hh[cfg.dirVar] ? hh[cfg.dirVar][hidx] : null;
                        var col = this._colorForValue(layer, v);
                        if (!col) continue;
                        var cx = (ix + 0.5) * cellW;
                        var cy = (iy + 0.5) * cellH;
                        this._drawWindGlyph(ctx, cx, cy, cfg.range[1], v, dir, Math.min(cellW, cellH) * 0.4, col);
                    }
                }
            } else {
                var nx2 = 64, ny2 = 64;
                var image = ctx.createImageData(nx2, ny2);
                for (var iy2 = 0; iy2 < ny2; iy2++) {
                    for (var ix2 = 0; ix2 < nx2; ix2++) {
                        var k2 = iy2 * nx2 + ix2;
                        var hh2 = point.hourly;
                        if (!hh2 || hh2[cfg.var] == null || hh2[cfg.var][hidx] == null) {
                            image.data[k2 * 4 + 3] = 0;
                            continue;
                        }
                        var v2 = hh2[cfg.var][hidx];
                        var col2 = this._colorForValue(layer, v2);
                        if (!col2) {
                            image.data[k2 * 4 + 3] = 0;
                            continue;
                        }
                        var idx2 = k2 * 4;
                        image.data[idx2] = col2[0];
                        image.data[idx2 + 1] = col2[1];
                        image.data[idx2 + 2] = col2[2];
                        image.data[idx2 + 3] = col2[3];
                    }
                }
                var tmp = document.createElement('canvas');
                tmp.width = nx2;
                tmp.height = ny2;
                tmp.getContext('2d').putImageData(image, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(tmp, 0, 0, W, H);
            }

            return canvas;
        },

        _colorForValue: function (layer, value) {
            var scale = window.MapLayers && window.MapLayers[layer] ? window.MapLayers[layer].scale : null;
            var range = this._layerConfig[layer].range;
            if (!scale || value == null || !Number.isFinite(value)) return null;
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
        },

        _drawWindGlyph: function (ctx, x, y, maxV, v, dir, size, col) {
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
        },

        loadTile: function (x, y, z, layer) {
            var key = layer + '/' + z + '/' + x + '/' + y;
            var cached = this._getCachedTile(key);
            if (cached) return Promise.resolve(cached);

            var url = this._buildTileUrl(x, y, z, layer);
            if (!url) return Promise.resolve(null);

            var self = this;
            return this._dedupFetch(url).then(function (data) {
                self._setCachedTile(key, data);
                return data;
            }).catch(function (e) {
                console.error('[EnhancedTileManager] tile load failed', key, e);
                return null;
            });
        },

        renderTile: function (x, y, z, layer, tileData) {
            var canvas = this._renderTileCanvas(tileData, layer, this._frameIndex);
            if (!canvas) return;

            var bounds = this._getTileBounds(x, y, z);
            var key = layer + ':' + x + ':' + y + ':' + z;
            var opacity = this._layerOpacities[layer] != null ? this._layerOpacities[layer] : 0.82;

            var existing = this._layerOverlays.get(key);
            if (existing) {
                try { this._map.removeLayer(existing); } catch (e) {}
            }

            var url = canvas.toDataURL();
            var overlay = L.imageOverlay(url, [[bounds.south, bounds.west], [bounds.north, bounds.east]], {
                opacity: opacity,
                interactive: false,
                className: 'weather-tile'
            }).addTo(this._map);

            this._layerOverlays.set(key, overlay);
        },

        renderFromGridData: function () {
            if (!this._map || !this._gridData) return;
            var tiles = this._getVisibleTiles();
            var activeLayers = Array.from(this._activeLayers);
            var self = this;

            tiles.forEach(function (tile) {
                activeLayers.forEach(function (layer) {
                    if (!self._layerStates[layer]) return;
                    var point = self._findClosestPoint(tile.x, tile.y, tile.z);
                    if (point) {
                        self.renderTile(tile.x, tile.y, tile.z, layer, point);
                    }
                });
            });
        },

        _findClosestPoint: function (tileX, tileY, zoom) {
            if (!this._gridData || !this._gridData.pts) return null;
            var bounds = this._getTileBounds(tileX, tileY, zoom);
            var centerLat = (bounds.north + bounds.south) / 2;
            var centerLng = (bounds.west + bounds.east) / 2;

            var pts = this._gridData.pts;
            var arr = this._gridData.arr;
            if (!pts || !arr || !pts.length) return null;

            var bestIdx = 0;
            var bestDist = Infinity;
            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];
                var dLat = (p[0] - centerLat);
                var dLng = (p[1] - centerLng);
                var dist = dLat * dLat + dLng * dLng;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }
            }
            return arr[bestIdx] || null;
        },

        reloadVisibleTiles: function () {
            if (!this._map) return;
            var tiles = this._getVisibleTiles();
            var activeLayers = Array.from(this._activeLayers);
            var self = this;

            tiles.forEach(function (tile) {
                activeLayers.forEach(function (layer) {
                    if (!self._layerStates[layer]) return;
                    var point = self._findClosestPoint(tile.x, tile.y, tile.z);
                    if (point) {
                        self.renderTile(tile.x, tile.y, tile.z, layer, point);
                    }
                });
            });
        },

        setLayerVisible: function (layer, visible) {
            this._layerStates[layer] = visible;
            if (visible) {
                this.reloadVisibleTiles();
            } else {
                this.clearLayer(layer);
            }
        },

        clearLayer: function (layer) {
            var self = this;
            this._layerOverlays.forEach(function (overlay, key) {
                if (key.indexOf(layer + ':') === 0) {
                    try { self._map.removeLayer(overlay); } catch (e) {}
                    self._layerOverlays.delete(key);
                }
            });
        },

        clearAll: function () {
            var self = this;
            this._layerOverlays.forEach(function (overlay) {
                try { self._map.removeLayer(overlay); } catch (e) {}
            });
            this._layerOverlays.clear();
            this._tiles.clear();
            this._pendingRequests.forEach(function (entry) {
                if (entry.controller) entry.controller.abort();
            });
            this._pendingRequests.clear();
            this._gridData = null;
            this._times = [];
            this.pause();
        },

        getStats: function () {
            return {
                tileCount: this._tiles.size,
                overlayCount: this._layerOverlays.size,
                pendingRequests: this._pendingRequests.size,
                currentZoom: this._currentZoom,
                activeLayers: Array.from(this._activeLayers),
                isPlaying: this._isPlaying,
                frameIndex: this._frameIndex
            };
        }
    };

    window.EnhancedTileManager = EnhancedTileManager;
})();