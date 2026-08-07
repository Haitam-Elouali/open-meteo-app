(function () {
    'use strict';

    var GRID_ENDPOINT = '/api/grid';
    var DAILY_TEMP_ENDPOINT = '/api/daily-temp';
    var CITIES_ENDPOINT = '/api/cities';
    var REVERSE_ENDPOINT = '/api/reverse';
    var LOCATION_ENDPOINT = '/api/location';

    var WeatherService = {
        _pending: new Map(),
        _abortControllers: new Map(),

        _key: function (url, options) {
            return url + '|' + (options && options.signal ? '1' : '0');
        },

        _cancelExisting: function (key) {
            var existing = this._pending.get(key);
            if (existing && existing.controller) {
                existing.controller.abort();
            }
        },

        fetchJson: function (url, options) {
            options = options || {};
            var key = this._key(url, options);

            this._cancelExisting(key);

            var controller = new AbortController();
            var signal = controller.signal;
            var opts = Object.assign({}, options, { signal: signal });
            var requestId = Math.random().toString(36).slice(2);

            var promise = fetch(url, opts)
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .finally(function () {
                    WeatherService._pending.delete(key);
                    WeatherService._abortControllers.delete(requestId);
                });

            this._pending.set(key, { promise: promise, controller: controller });
            this._abortControllers.set(requestId, controller);

            return promise;
        },

        abortAll: function () {
            this._abortControllers.forEach(function (c) { c.abort(); });
            this._pending.clear();
            this._abortControllers.clear();
        },

        abortByPattern: function (pattern) {
            var self = this;
            this._pending.forEach(function (entry, key) {
                if (key.indexOf(pattern) !== -1) {
                    if (entry.controller) entry.controller.abort();
                    self._pending.delete(key);
                }
            });
        },

        getDailyTemp: function (lat, lng) {
            var url = DAILY_TEMP_ENDPOINT + '?lat=' + lat + '&lon=' + lng;
            return this.fetchJson(url);
        },

        getGrid: function (params) {
            var url = GRID_ENDPOINT + '?' + new URLSearchParams(params).toString();
            return this.fetchJson(url);
        },

        getCities: function (country) {
            var url = CITIES_ENDPOINT + '?country=' + encodeURIComponent(country);
            return this.fetchJson(url);
        },

        reverseGeocode: function (lat, lng) {
            var url = REVERSE_ENDPOINT + '?lat=' + lat + '&lon=' + lng;
            return this.fetchJson(url);
        },

        forwardGeocode: function (query, count) {
            count = count || 10;
            var url = LOCATION_ENDPOINT + '?city=' + encodeURIComponent(query) + '&count=' + count;
            return this.fetchJson(url);
        },

        batchGridRequests: function (requests) {
            return Promise.all(requests.map(function (req) {
                return this.getGrid(req.params);
            }.bind(this)));
        }
    };

    window.WeatherService = WeatherService;
})();