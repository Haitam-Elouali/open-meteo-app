(function () {
    'use strict';

    var LayerManager = {
        _state: {
            activeLayer: 'temperature',
            activeLayers: {},
            opacities: {},
            loading: {}
        },

        _listeners: [],

        init: function (defaultLayer) {
            this._state.activeLayer = defaultLayer || 'temperature';
            this._state.activeLayers[this._state.activeLayer] = true;
            this._state.opacities[this._state.activeLayer] = 0.82;
        },

        subscribe: function (fn) {
            this._listeners.push(fn);
        },

        _emit: function (event) {
            this._listeners.forEach(function (fn) {
                try { fn(event); } catch (e) { console.error('[LayerManager] listener error', e); }
            });
        },

        getActiveLayer: function () {
            return this._state.activeLayer;
        },

        getActiveLayers: function () {
            return Object.assign({}, this._state.activeLayers);
        },

        getOpacity: function (layer) {
            return this._state.opacities[layer] != null ? this._state.opacities[layer] : 0.82;
        },

        setLayer: function (layer) {
            this._state.activeLayer = layer;
            this._state.activeLayers = {};
            this._state.activeLayers[layer] = true;
            this._emit({ type: 'layer:changed', layer: layer });
        },

        setVisibility: function (layer, visible) {
            this._state.activeLayers[layer] = visible;
            if (visible) this._state.activeLayer = layer;
            this._emit({ type: 'layer:visibility', layer: layer, visible: visible });
        },

        setOpacity: function (layer, opacity) {
            this._state.opacities[layer] = opacity;
            this._emit({ type: 'layer:opacity', layer: layer, opacity: opacity });
        },

        setLoading: function (layer, isLoading) {
            this._state.loading[layer] = isLoading;
            this._emit({ type: 'layer:loading', layer: layer, loading: isLoading });
        },

        isLayerLoading: function (layer) {
            return !!this._state.loading[layer];
        },

        clear: function () {
            this._state.activeLayers = {};
            this._state.loading = {};
            this._emit({ type: 'layer:cleared' });
        },

        getState: function () {
            return {
                activeLayer: this._state.activeLayer,
                activeLayers: Object.assign({}, this._state.activeLayers),
                opacities: Object.assign({}, this._state.opacities),
                loading: Object.assign({}, this._state.loading)
            };
        }
    };

    window.LayerManager = LayerManager;
})();