(function () {
    'use strict';

    var CacheService = {
        _caches: {},
        _timers: {},

        get: function (namespace, key) {
            var ns = this._caches[namespace];
            if (!ns) return null;
            var entry = ns[key];
            if (!entry) return null;
            if (Date.now() > entry.expires) {
                delete ns[key];
                return null;
            }
            return entry.data;
        },

        set: function (namespace, key, data, ttlMs) {
            ttlMs = ttlMs || 15 * 60 * 1000;
            if (!this._caches[namespace]) this._caches[namespace] = {};
            this._caches[namespace][key] = { data: data, expires: Date.now() + ttlMs };
        },

        delete: function (namespace, key) {
            var ns = this._caches[namespace];
            if (!ns) return;
            delete ns[key];
        },

        clear: function (namespace) {
            if (namespace) {
                delete this._caches[namespace];
            } else {
                this._caches = {};
            }
        },

        prune: function () {
            var now = Date.now();
            Object.keys(this._caches).forEach(function (ns) {
                var store = CacheService._caches[ns];
                Object.keys(store).forEach(function (k) {
                    if (store[k].expires <= now) delete store[k];
                });
            });
        },

        startAutoPrune: function (intervalMs) {
            intervalMs = intervalMs || 60 * 1000;
            if (this._timers.prune) return;
            this._timers.prune = setInterval(this.prune, intervalMs);
        },

        stopAutoPrune: function () {
            if (this._timers.prune) {
                clearInterval(this._timers.prune);
                this._timers.prune = null;
            }
        }
    };

    window.CacheService = CacheService;
})();