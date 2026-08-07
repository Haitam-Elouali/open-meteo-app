(function () {
    'use strict';

    var SearchService = {
        _cache: new Map(),
        _recent: [],
        _favorites: [],
        _abortController: null,
        _listeners: [],
        _MAX_RECENT: 10,

        init: function () {
            try {
                var recent = localStorage.getItem('map_recent_searches');
                if (recent) this._recent = JSON.parse(recent);
                var favs = localStorage.getItem('map_favorite_searches');
                if (favs) this._favorites = JSON.parse(favs);
            } catch (e) { /* ignore */ }
        },

        subscribe: function (fn) {
            this._listeners.push(fn);
        },

        _emit: function (event) {
            this._listeners.forEach(function (fn) {
                try { fn(event); } catch (e) { console.error('[SearchService] listener error', e); }
            });
        },

        getRecent: function () {
            return this._recent.slice();
        },

        getFavorites: function () {
            return this._favorites.slice();
        },

        addRecent: function (item) {
            this._recent = this._recent.filter(function (r) {
                return r.name !== item.name || r.country !== item.country;
            });
            this._recent.unshift({ name: item.name, country: item.country, lat: item.lat, lng: item.lng, ts: Date.now() });
            if (this._recent.length > this._MAX_RECENT) this._recent = this._recent.slice(0, this._MAX_RECENT);
            try { localStorage.setItem('map_recent_searches', JSON.stringify(this._recent)); } catch (e) {}
            this._emit({ type: 'search:recent', data: this._recent });
        },

        addFavorite: function (item) {
            this._favorites = this._favorites.filter(function (r) {
                return r.name !== item.name || r.country !== item.country;
            });
            this._favorites.unshift({ name: item.name, country: item.country, lat: item.lat, lng: item.lng });
            try { localStorage.setItem('map_favorite_searches', JSON.stringify(this._favorites)); } catch (e) {}
            this._emit({ type: 'search:favorites', data: this._favorites });
        },

        removeFavorite: function (name, country) {
            this._favorites = this._favorites.filter(function (r) {
                return !(r.name === name && r.country === country);
            });
            try { localStorage.setItem('map_favorite_searches', JSON.stringify(this._favorites)); } catch (e) {}
            this._emit({ type: 'search:favorites', data: this._favorites });
        },

        isFavorite: function (name, country) {
            return this._favorites.some(function (r) { return r.name === name && r.country === country; });
        },

        search: function (query, count) {
            count = count || 10;
            var cacheKey = 'forward:' + query.toLowerCase() + '|' + count;

            var cached = this._cache.get(cacheKey);
            if (cached && Date.now() < cached.expires) {
                this._emit({ type: 'search:results', data: cached.data, cached: true });
                return Promise.resolve(cached.data);
            }

            if (this._abortController) {
                this._abortController.abort();
            }
            this._abortController = new AbortController();

            return WeatherService.forwardGeocode(query, count).then(function (data) {
                var results = (data.results || []).map(function (r) {
                    return { name: r.name, country: r.country, admin1: r.admin1, lat: r.lat, lng: r.lng };
                });
                SearchService._cache.set(cacheKey, { data: results, expires: Date.now() + 5 * 60 * 1000 });
                SearchService._emit({ type: 'search:results', data: results, cached: false });
                return results;
            }).catch(function (e) {
                if (e.name !== 'AbortError') {
                    SearchService._emit({ type: 'search:error', error: e });
                }
                return [];
            });
        },

        reverse: function (lat, lng) {
            var cacheKey = 'reverse:' + lat.toFixed(2) + ',' + lng.toFixed(2);

            var cached = this._cache.get(cacheKey);
            if (cached && Date.now() < cached.expires) {
                this._emit({ type: 'search:reverse', data: cached.data, cached: true });
                return Promise.resolve(cached.data);
            }

            return WeatherService.reverseGeocode(lat, lng).then(function (data) {
                var result = { city: data.city, country: data.country, lat: lat, lng: lng };
                SearchService._cache.set(cacheKey, { data: result, expires: Date.now() + 10 * 60 * 1000 });
                SearchService._emit({ type: 'search:reverse', data: result, cached: false });
                return result;
            }).catch(function (e) {
                if (e.name !== 'AbortError') {
                    SearchService._emit({ type: 'search:error', error: e });
                }
                return null;
            });
        },

        flyTo: function (lat, lng, zoom) {
            this._emit({ type: 'search:flyto', lat: lat, lng: lng, zoom: zoom || 12 });
        },

        clearCache: function () {
            this._cache.clear();
        }
    };

    window.SearchService = SearchService;
})();