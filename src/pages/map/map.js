(function () {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const U = window.Units;

    const weatherStationColors = {
        rain: 'rgba(59, 130, 246, 0.9)',
        sunny: 'rgba(245, 158, 11, 0.9)',
        cloudy: 'rgba(107, 114, 126, 0.9)',
        snow: 'rgba(255, 255, 255, 0.9)',
        storm: 'rgba(167, 29, 42, 0.9)',
        normal: 'rgba(34, 197, 94, 0.9)'
    };

    function getWeatherColor(weatherCode, iconType = 'normal') {
        if (iconType === 'rain') return weatherStationColors.rain;
        if (iconType === 'snow') return weatherStationColors.snow;
        if (iconType === 'storm') return weatherStationColors.storm;

        if (weatherCode === 0) return weatherStationColors.sunny;
        if (weatherCode >= 1 && weatherCode <= 3) return weatherStationColors.cloudy;
        if (weatherCode >= 51 && weatherCode <= 67) return weatherStationColors.rain;
        if (weatherCode >= 71 && weatherCode <= 77) return weatherStationColors.snow;
        if (weatherCode >= 95 && weatherCode <= 99) return weatherStationColors.storm;
        
        return weatherStationColors.normal;
    }

    function getWeatherDescription(code) {
        const map = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            56: 'Light freezing drizzle',
            57: 'Dense freezing drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            66: 'Light freezing rain',
            67: 'Heavy freezing rain',
            71: 'Slight snow fall',
            73: 'Moderate snow fall',
            75: 'Heavy snow fall',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Heavy rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with slight hail',
            99: 'Thunderstorm with heavy hail'
        };
        return map[code] || 'Unknown';
    }

    function createWeatherMarker(lat, lon, data) {
        const marker = document.createElement('div');
        marker.className = `map-marker ${getWeatherColor(data.weatherCode)}`;
        marker.style.left = `${(lon + 180) / 360 * 100}%`;
        marker.style.top = `${(90 - lat) / 180 * 100}%`;
        
        return marker;
    }

    function createPopup(marker, data) {
        const popup = document.createElement('div');
        popup.className = 'map-marker popopup';
        popup.innerHTML = `
            <div style="font-weight: 500; margin-bottom: 8px;">${data.name || 'Weather Station'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">City:</span> ${data.city || 'Unknown'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Country:</span> ${data.country || 'Unknown'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Temp:</span> ${data.temp !== undefined ? `${U.temp(data.temp)}°` : '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Humidity:</span> ${data.humidity !== undefined ? `${data.humidity}%` : '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Pressure:</span> ${data.pressure !== undefined ? `${data.pressure} hPa` : '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Wind:</span> ${data.windSpeed !== undefined ? `${data.windSpeed} ${U.windLabel()}` : '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Wind Dir:</span> ${data.windDir || '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Vis:</span> ${data.visibility !== undefined ? `${data.visibility} km` : '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Rain:</span> ${data.rainfall !== undefined ? `${data.rainfall} mm` : '--'}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><span style="opacity: 0.7">Cloud:</span> ${data.cloudCover !== undefined ? `${data.cloudCover}%` : '--'}</div>
            <div style="font-size: 11px; opacity: 0.6; margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">Last update: ${new Date().toLocaleTimeString()}</div>
        `;
        
        let popupPosX = marker.offsetLeft + marker.offsetWidth / 2;
        let popupPosY = marker.offsetTop - 60;
        
        if (popupPosY < 10) popupPosY = marker.offsetTop + marker.offsetHeight + 10;
        
        popup.style.left = `${Math.max(10, Math.min(popupPosX - 90, window.innerWidth - 200))}px`;
        popup.style.top = `${Math.max(10, popupPosY)}px`;
        
        document.body.appendChild(popup);
        
        marker.addEventListener('mouseleave', () => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        });
        
        return popup;
    }

    function updateWeatherDisplay(data) {
        const tempEl = $('#info-temp');
        const feelsLikeEl = $('#info-feels-like');
        const humidityEl = $('#info-humidity');
        const pressureEl = $('#info-pressure');
        const windEl = $('#info-wind');
        const visibilityEl = $('#info-visibility');
        const uvEl = $('#info-uv');
        const cloudsEl = $('#info-clouds');
        const rainProbEl = $('#info-rain-prob');
        const sunriseEl = $('#info-sunrise');
        const sunsetEl = $('#info-sunset');
        const moonEl = $('#info-moon');

        if (tempEl) tempEl.textContent = data.temperature !== undefined ? `${U.temp(data.temperature)}°` : '--';
        if (feelsLikeEl) feelsLikeEl.textContent = data.feelsLike !== undefined ? `${U.temp(data.feelsLike)}°` : '--';
        if (humidityEl) humidityEl.textContent = data.humidity !== undefined ? `${data.humidity}%` : '--';
        if (pressureEl) pressureEl.textContent = data.pressure !== undefined ? `${data.pressure} hPa` : '--';
        if (windEl) windEl.textContent = data.windSpeed !== undefined ? `${data.windSpeed} ${U.windLabel()}` : '--';
        if (visibilityEl) visibilityEl.textContent = data.visibility !== undefined ? `${data.visibility} km` : '--';
        if (uvEl) uvEl.textContent = data.uvIndex !== undefined ? data.uvIndex.toString() : '--';
        if (cloudsEl) cloudsEl.textContent = data.cloudCover !== undefined ? `${data.cloudCover}%` : '--';
        if (rainProbEl) rainProbEl.textContent = data.rainProbability !== undefined ? `${data.rainProbability}%` : '--';
        if (sunriseEl) sunriseEl.textContent = data.sunrise || '--';
        if (sunsetEl) sunsetEl.textContent = data.sunset || '--';
        if (moonEl) moonEl.textContent = getMoonPhase(data.moonPhase);
    }

    function getMoonPhase(phase) {
        if (phase === undefined) return '--';
        const phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
        return phases[Math.round(phase * 7) % 8] || '--';
    }

    function loadStations() {
        console.log('[map] Loading weather stations...');
        
        const mapContainer = $('#interactive-map');
        if (!mapContainer) return;

        const stations = [
            {name: 'New York', city: 'New York', country: 'United States', lat: 40.71, lon: -74.01, temp: 22, humidity: 65, pressure: 1012, windSpeed: 10, windDir: 'NW', visibility: 8, rainfall: 0, cloudCover: 20, weatherCode: 0, moonPhase: 0.25},
            {name: 'London', city: 'London', country: 'United Kingdom', lat: 51.51, lon: -0.13, temp: 18, humidity: 70, pressure: 1015, windSpeed: 8, windDir: 'SW', visibility: 10, rainfall: 0, cloudCover: 30, weatherCode: 1, moonPhase: 0.3},
            {name: 'Paris', city: 'Paris', country: 'France', lat: 48.86, lon: 2.35, temp: 20, humidity: 68, pressure: 1013, windSpeed: 12, windDir: 'NE', visibility: 9, rainfall: 0, cloudCover: 25, weatherCode: 0, moonPhase: 0.35},
            {name: 'Tokyo', city: 'Tokyo', country: 'Japan', lat: 35.68, lon: 139.69, temp: 26, humidity: 75, pressure: 1010, windSpeed: 14, windDir: 'E', visibility: 7, rainfall: 2, cloudCover: 40, weatherCode: 61, moonPhase: 0.4},
            {name: 'Sydney', city: 'Sydney', country: 'Australia', lat: -33.87, lon: 151.20, temp: 24, humidity: 60, pressure: 1015, windSpeed: 11, windDir: 'SE', visibility: 12, rainfall: 0, cloudCover: 15, weatherCode: 0, moonPhase: 0.45},
            {name: 'Cairo', city: 'Cairo', country: 'Egypt', lat: 30.04, lon: 31.24, temp: 30, humidity: 45, pressure: 1012, windSpeed: 9, windDir: 'S', visibility: 15, rainfall: 0, cloudCover: 10, weatherCode: 0, moonPhase: 0.5},
            {name: 'Moscow', city: 'Moscow', country: 'Russia', lat: 55.76, lon: 37.62, temp: 12, humidity: 55, pressure: 1008, windSpeed: 13, windDir: 'WNW', visibility: 11, rainfall: 0, cloudCover: 50, weatherCode: 3, moonPhase: 0.55},
            {name: 'Sao Paulo', city: 'Sao Paulo', country: 'Brazil', lat: -23.55, lon: -46.63, temp: 28, humidity: 70, pressure: 1018, windSpeed: 10, windDir: 'SW', visibility: 10, rainfall: 5, cloudCover: 60, weatherCode: 61, moonPhase: 0.6},
            {name: 'Mumbai', city: 'Mumbai', country: 'India', lat: 19.07, lon: 72.87, temp: 32, humidity: 80, pressure: 1005, windSpeed: 15, windDir: 'W', visibility: 6, rainfall: 15, cloudCover: 85, weatherCode: 61, moonPhase: 0.65},
        ];

        stations.forEach(station => {
            const marker = createWeatherMarker(station.lat, station.lon, station);
            marker.addEventListener('mouseenter', () => {
                createPopup(marker, station);
            });
            mapContainer.appendChild(marker);
        });

        updateWeatherDisplay(stations[0]);
        console.log('[map] Loaded', stations.length, 'weather stations');
    }

    function initMapControls() {
        const layerCheckboxes = $$('.layer-checkbox input');
        layerCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                console.log('[map] Layer toggled:', cb.dataset.layer, cb.checked);
            });
        });

        const playBtn = $('.map-btn[data-i18n="map.play"]');
        const pauseBtn = $('.map-btn[data-i18n="map.pause"]');
        const nextBtn = $('.map-btn[data-i18n="map.nextFrame"]');
        const prevBtn = $('.map-btn[data-i18n="map.prevFrame"]');

        if (playBtn) playBtn.addEventListener('click', () => console.log('[map] Play animation'));
        if (pauseBtn) pauseBtn.addEventListener('click', () => console.log('[map] Pause animation'));
        if (nextBtn) nextBtn.addEventListener('click', () => console.log('[map] Next frame'));
        if (prevBtn) prevBtn.addEventListener('click', () => console.log('[map] Previous frame'));
    }

    function init() {
        loadStations();
        initMapControls();
        window.I18n?.apply?.();
        console.log('[map] Map initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();