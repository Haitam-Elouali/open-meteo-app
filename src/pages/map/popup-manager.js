(function () {
    'use strict';

    var PopupManager = {
        _marker: null,
        _dailyTempCache: null,
        _dailyTempDate: null,

        init: function (map) {
            this._map = map;
        },

        showMarker: function (lat, lng) {
            if (!this._marker) {
                this._marker = L.circleMarker([lat, lng], {
                    radius: 6,
                    color: '#fff',
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    weight: 2,
                    opacity: 0.9
                }).addTo(this._map);
            } else {
                this._marker.setLatLng([lat, lng]);
            }
        },

        hideMarker: function () {
            if (this._marker) {
                this._map.removeLayer(this._marker);
                this._marker = null;
            }
        },

        setLoading: function (loading) {
            var grid = document.getElementById('map-info-grid');
            var hint = document.getElementById('map-info-hint');
            if (grid) grid.hidden = loading;
            if (hint) {
                hint.hidden = !loading;
                hint.textContent = loading ? 'Loading\u2026' : 'Click the map to inspect a location.';
            }
        },

        renderHourly: function (hourly, times, hidx) {
            var set = function (id, val) {
                var el = document.getElementById(id);
                if (el) el.textContent = val;
            };
            var hv = function (key) {
                return hourly[key] && hourly[key][hidx] != null ? hourly[key][hidx] : null;
            };

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

            var grid = document.getElementById('map-info-grid');
            var hint = document.getElementById('map-info-hint');
            if (grid) grid.hidden = false;
            if (hint) hint.hidden = true;

            var timeEl = document.getElementById('map-info-time');
            if (timeEl && times[hidx]) {
                timeEl.textContent = new Date(times[hidx]).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
            }
        },

        updateDailyTemp: function (lat, lng) {
            var today = new Date().toISOString().slice(0, 10);
            if (this._dailyTempDate === today && this._dailyTempCache) {
                this._applyDailyTemp(this._dailyTempCache);
                return;
            }

            WeatherService.getDailyTemp(lat, lng).then(function (data) {
                if (data && !data.error) {
                    PopupManager._dailyTempCache = data;
                    PopupManager._dailyTempDate = today;
                    PopupManager._applyDailyTemp(data);
                }
            }).catch(function (e) {
                console.error('[PopupManager] daily temp fetch failed', e);
            });
        },

        _applyDailyTemp: function (data) {
            var maxEl = document.getElementById('info-temp-max');
            var minEl = document.getElementById('info-temp-min');
            if (maxEl && data.tempMax != null) maxEl.textContent = Math.round(temperature(data.tempMax)) + '°';
            if (minEl && data.tempMin != null) minEl.textContent = Math.round(temperature(data.tempMin)) + '°';
        },

        resetDailyTemp: function () {
            this._dailyTempCache = null;
            this._dailyTempDate = null;
        }
    };

    window.PopupManager = PopupManager;
})();