(function () {
  const $ = (sel) => document.querySelector(sel);
  const U = window.Units;

  const MAJOR_CITIES_BY_COUNTRY = {
    "Morocco": [
      { name: "Casablanca", lat: 33.5731, lon: -7.5898 },
      { name: "Rabat", lat: 34.0209, lon: -6.8416 },
      { name: "Fes", lat: 34.0331, lon: -5.0003 },
      { name: "Marrakech", lat: 31.6295, lon: -7.9811 },
      { name: "Tangier", lat: 35.7595, lon: -5.834 },
      { name: "Agadir", lat: 30.4278, lon: -9.5981 },
      { name: "Oujda", lat: 34.6814, lon: -1.9086 },
      { name: "Meknes", lat: 33.8935, lon: -5.5547 },
      { name: "Tetouan", lat: 35.5889, lon: -5.3626 },
      { name: "Nador", lat: 34.9281, lon: -3.0426 }
    ],
    "France": [
      { name: "Paris", lat: 48.8566, lon: 2.3522 },
      { name: "Marseille", lat: 43.2965, lon: 5.3698 },
      { name: "Lyon", lat: 45.764, lon: 4.8357 },
      { name: "Toulouse", lat: 43.6047, lon: 1.4442 },
      { name: "Nice", lat: 43.7102, lon: 7.262 },
      { name: "Nantes", lat: 47.2184, lon: -1.5536 },
      { name: "Strasbourg", lat: 48.5734, lon: 7.7521 },
      { name: "Montpellier", lat: 43.6108, lon: 3.8767 },
      { name: "Bordeaux", lat: 44.8378, lon: -0.5792 },
      { name: "Lille", lat: 50.6292, lon: 3.0573 }
    ],
    "United Kingdom": [
      { name: "London", lat: 51.5074, lon: -0.1278 },
      { name: "Birmingham", lat: 52.4862, lon: -1.8904 },
      { name: "Manchester", lat: 53.4808, lon: -2.2426 },
      { name: "Glasgow", lat: 55.8642, lon: -4.2518 },
      { name: "Liverpool", lat: 53.4084, lon: -2.9916 },
      { name: "Edinburgh", lat: 55.9533, lon: -3.1883 },
      { name: "Bristol", lat: 51.4545, lon: -2.5879 },
      { name: "Sheffield", lat: 53.3811, lon: -1.4701 }
    ],
    "Spain": [
      { name: "Madrid", lat: 40.4168, lon: -3.7038 },
      { name: "Barcelona", lat: 41.3874, lon: 2.1686 },
      { name: "Valencia", lat: 39.4699, lon: -0.3763 },
      { name: "Seville", lat: 37.3891, lon: -5.9845 },
      { name: "Malaga", lat: 36.7213, lon: -4.4214 },
      { name: "Bilbao", lat: 43.263, lon: -2.935 },
      { name: "Zaragoza", lat: 41.6488, lon: -0.8891 }
    ],
    "United States": [
      { name: "New York", lat: 40.7128, lon: -74.006 },
      { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
      { name: "Chicago", lat: 41.8781, lon: -87.6298 },
      { name: "Houston", lat: 29.7604, lon: -95.3698 },
      { name: "Phoenix", lat: 33.4484, lon: -112.074 },
      { name: "Philadelphia", lat: 39.9526, lon: -75.1652 },
      { name: "San Antonio", lat: 29.4241, lon: -98.4936 },
      { name: "San Diego", lat: 32.7157, lon: -117.1611 }
    ],
    "Germany": [
      { name: "Berlin", lat: 52.52, lon: 13.405 },
      { name: "Munich", lat: 48.1351, lon: 11.582 },
      { name: "Hamburg", lat: 53.5511, lon: 9.9937 },
      { name: "Cologne", lat: 50.9375, lon: 6.9603 },
      { name: "Frankfurt", lat: 50.1109, lon: 8.6821 },
      { name: "Stuttgart", lat: 48.7758, lon: 9.1829 },
      { name: "Dusseldorf", lat: 51.2277, lon: 6.7885 }
    ],
    "Italy": [
      { name: "Rome", lat: 41.9028, lon: 12.4964 },
      { name: "Milan", lat: 45.4642, lon: 9.19 },
      { name: "Naples", lat: 40.8518, lon: 14.2681 },
      { name: "Turin", lat: 45.0703, lon: 7.6869 },
      { name: "Palermo", lat: 38.1157, lon: 13.3615 },
      { name: "Bologna", lat: 44.4949, lon: 11.3426 }
    ],
    "Brazil": [
      { name: "Sao Paulo", lat: -23.5505, lon: -46.6333 },
      { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 },
      { name: "Brasilia", lat: -15.7975, lon: -47.8919 },
      { name: "Salvador", lat: -12.9714, lon: -38.5014 },
      { name: "Fortaleza", lat: -3.7172, lon: -38.5433 },
      { name: "Belo Horizonte", lat: -19.9167, lon: -43.9345 }
    ],
    "India": [
      { name: "Mumbai", lat: 19.076, lon: 72.8777 },
      { name: "Delhi", lat: 28.6139, lon: 77.209 },
      { name: "Bangalore", lat: 12.9716, lon: 77.5946 },
      { name: "Chennai", lat: 13.0827, lon: 80.2707 },
      { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
      { name: "Hyderabad", lat: 17.385, lon: 78.4867 }
    ],
    "China": [
      { name: "Beijing", lat: 39.9042, lon: 116.4074 },
      { name: "Shanghai", lat: 31.2304, lon: 121.4737 },
      { name: "Guangzhou", lat: 23.1291, lon: 113.2644 },
      { name: "Shenzhen", lat: 22.5431, lon: 114.0579 },
      { name: "Chengdu", lat: 30.5728, lon: 104.0668 }
    ],
    "Japan": [
      { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
      { name: "Osaka", lat: 34.6937, lon: 135.5023 },
      { name: "Yokohama", lat: 35.4437, lon: 139.638 },
      { name: "Nagoya", lat: 35.1815, lon: 136.9066 },
      { name: "Sapporo", lat: 43.0618, lon: 141.3545 }
    ],
    "Australia": [
      { name: "Sydney", lat: -33.8688, lon: 151.2093 },
      { name: "Melbourne", lat: -37.8136, lon: 144.9631 },
      { name: "Brisbane", lat: -27.4698, lon: 153.0251 },
      { name: "Perth", lat: -31.9505, lon: 115.8605 },
      { name: "Adelaide", lat: -34.9285, lon: 138.6007 }
    ],
    "Canada": [
      { name: "Toronto", lat: 43.6532, lon: -79.3832 },
      { name: "Vancouver", lat: 49.2827, lon: -123.1207 },
      { name: "Montreal", lat: 45.5017, lon: -73.5673 },
      { name: "Calgary", lat: 51.0447, lon: -114.0719 },
      { name: "Ottawa", lat: 45.4215, lon: -75.6972 }
    ],
    "Russia": [
      { name: "Moscow", lat: 55.7558, lon: 37.6173 },
      { name: "Saint Petersburg", lat: 59.9343, lon: 30.3351 },
      { name: "Novosibirsk", lat: 55.0084, lon: 82.9357 },
      { name: "Yekaterinburg", lat: 56.8389, lon: 60.6057 }
    ],
    "Egypt": [
      { name: "Cairo", lat: 30.0444, lon: 31.2357 },
      { name: "Alexandria", lat: 31.2001, lon: 29.9187 },
      { name: "Giza", lat: 30.0131, lon: 31.2089 }
    ],
    "Turkey": [
      { name: "Istanbul", lat: 41.0082, lon: 28.9784 },
      { name: "Ankara", lat: 39.9334, lon: 32.8597 },
      { name: "Izmir", lat: 38.4237, lon: 27.1428 },
      { name: "Antalya", lat: 36.8969, lon: 30.7133 }
    ],
    "Saudi Arabia": [
      { name: "Riyadh", lat: 24.7136, lon: 46.6753 },
      { name: "Jeddah", lat: 21.4858, lon: 39.1925 },
      { name: "Mecca", lat: 21.3891, lon: 39.8579 },
      { name: "Medina", lat: 24.5247, lon: 39.5692 }
    ],
    "UAE": [
      { name: "Dubai", lat: 25.2048, lon: 55.2708 },
      { name: "Abu Dhabi", lat: 24.4539, lon: 54.3773 },
      { name: "Sharjah", lat: 25.3573, lon: 55.4033 }
    ],
    "South Africa": [
      { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
      { name: "Johannesburg", lat: -26.2041, lon: 28.0473 },
      { name: "Durban", lat: -29.8587, lon: 31.0218 },
      { name: "Pretoria", lat: -25.7479, lon: 28.2293 }
    ],
    "Nigeria": [
      { name: "Lagos", lat: 6.5244, lon: 3.3792 },
      { name: "Abuja", lat: 9.0579, lon: 7.4951 },
      { name: "Kano", lat: 12.0022, lon: 8.592 }
    ],
    "Kenya": [
      { name: "Nairobi", lat: -1.2921, lon: 36.8219 },
      { name: "Mombasa", lat: -4.0435, lon: 39.6682 }
    ],
    "Argentina": [
      { name: "Buenos Aires", lat: -34.6037, lon: -58.3816 },
      { name: "Cordoba", lat: -31.4201, lon: -64.1888 },
      { name: "Rosario", lat: -32.9442, lon: -60.6505 }
    ],
    "Mexico": [
      { name: "Mexico City", lat: 19.4326, lon: -99.1332 },
      { name: "Guadalajara", lat: 20.6597, lon: -103.3496 },
      { name: "Monterrey", lat: 25.6866, lon: -100.3161 }
    ],
    "Indonesia": [
      { name: "Jakarta", lat: -6.2088, lon: 106.8456 },
      { name: "Bali", lat: -8.6500, lon: 115.2167 },
      { name: "Surabaya", lat: -7.2575, lon: 112.7521 }
    ],
    "Thailand": [
      { name: "Bangkok", lat: 13.7563, lon: 100.5018 },
      { name: "Chiang Mai", lat: 18.7883, lon: 98.9853 }
    ],
    "Vietnam": [
      { name: "Ho Chi Minh City", lat: 10.8231, lon: 106.6297 },
      { name: "Hanoi", lat: 21.0278, lon: 105.8342 }
    ],
    "South Korea": [
      { name: "Seoul", lat: 37.5665, lon: 126.978 },
      { name: "Busan", lat: 35.1796, lon: 129.0756 }
    ],
    "Pakistan": [
      { name: "Karachi", lat: 24.8607, lon: 67.0011 },
      { name: "Lahore", lat: 31.5204, lon: 74.3587 },
      { name: "Islamabad", lat: 33.6844, lon: 73.0479 }
    ],
    "Bangladesh": [
      { name: "Dhaka", lat: 23.8103, lon: 90.4125 },
      { name: "Chittagong", lat: 22.3569, lon: 91.7832 }
    ],
    "Philippines": [
      { name: "Manila", lat: 14.5995, lon: 120.9842 },
      { name: "Cebu", lat: 10.3157, lon: 123.8854 }
    ],
    "Malaysia": [
      { name: "Kuala Lumpur", lat: 3.139, lon: 101.6869 },
      { name: "Penang", lat: 5.4141, lon: 100.3288 }
    ],
    "Singapore": [
      { name: "Singapore", lat: 1.3521, lon: 103.8198 }
    ],
    "New Zealand": [
      { name: "Auckland", lat: -36.8509, lon: 174.7645 },
      { name: "Wellington", lat: -41.2865, lon: 174.7762 }
    ],
    "Portugal": [
      { name: "Lisbon", lat: 38.7223, lon: -9.1393 },
      { name: "Porto", lat: 41.1579, lon: -8.6291 }
    ],
    "Netherlands": [
      { name: "Amsterdam", lat: 52.3676, lon: 4.9041 },
      { name: "Rotterdam", lat: 51.9244, lon: 4.4777 },
      { name: "The Hague", lat: 52.0705, lon: 4.3007 }
    ],
    "Sweden": [
      { name: "Stockholm", lat: 59.3293, lon: 18.0686 },
      { name: "Gothenburg", lat: 57.7089, lon: 11.9746 },
      { name: "Malmo", lat: 55.605, lon: 13.0038 }
    ],
    "Norway": [
      { name: "Oslo", lat: 59.9139, lon: 10.7522 },
      { name: "Bergen", lat: 60.3913, lon: 5.3221 }
    ],
    "Denmark": [
      { name: "Copenhagen", lat: 55.6761, lon: 12.5683 },
      { name: "Aarhus", lat: 56.1629, lon: 10.2039 }
    ],
    "Poland": [
      { name: "Warsaw", lat: 52.2297, lon: 21.0122 },
      { name: "Krakow", lat: 50.0647, lon: 19.945 },
      { name: "Gdansk", lat: 54.352, lon: 18.6466 }
    ],
    "Greece": [
      { name: "Athens", lat: 37.9838, lon: 23.7275 },
      { name: "Thessaloniki", lat: 40.6401, lon: 22.9444 }
    ],
    "Switzerland": [
      { name: "Zurich", lat: 47.3769, lon: 8.5417 },
      { name: "Geneva", lat: 46.2044, lon: 6.1432 }
    ],
    "Austria": [
      { name: "Vienna", lat: 48.2082, lon: 16.3738 },
      { name: "Graz", lat: 47.0707, lon: 15.4395 }
    ],
    "Belgium": [
      { name: "Brussels", lat: 50.8503, lon: 4.3517 },
      { name: "Antwerp", lat: 51.2194, lon: 4.4025 }
    ],
    "Ireland": [
      { name: "Dublin", lat: 53.3498, lon: -6.2603 },
      { name: "Cork", lat: 51.8985, lon: -8.4756 }
    ],
    "Finland": [
      { name: "Helsinki", lat: 60.1699, lon: 24.9384 },
      { name: "Tampere", lat: 61.4978, lon: 23.761 }
    ]
  };

  const WEATHER_TEXT = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
    55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain',
    67: 'Freezing rain', 71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow',
    77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers',
    82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ hail'
  };

  function conditionText(code) { return WEATHER_TEXT[Number(code)] || 'Unknown'; }

  function getLatLon() {
    let lat = Number(window.__lastLatLon?.lat);
    let lon = Number(window.__lastLatLon?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      try {
        const raw = localStorage.getItem('open-meteo-latlon');
        if (raw) {
          const saved = JSON.parse(raw);
          if (Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lon))) {
            lat = Number(saved.lat);
            lon = Number(saved.lon);
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = 34.261; lon = -6.5802; }
    window.__lastLatLon = { lat, lon };
    return { lat, lon };
  }

  function drawChart(containerId, series, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Accept: plain number array, single {values,...} object, or array of such.
    let list;
    if (Array.isArray(series)) {
      const looksLikeSeries = series.length && typeof series[0] === 'object' && series[0] !== null && 'values' in series[0];
      list = looksLikeSeries ? series : [{ values: series, color: options.color, label: options.label }];
    } else if (series && typeof series === 'object' && 'values' in series) {
      list = [series];
    } else {
      list = [{ values: series, color: options.color, label: options.label }];
    }
    // x-axis labels (e.g. "14:00") come from the series object, not options.
    const labels =
      (Array.isArray(series) ? series[0] && series[0].labels : series && series.labels) ||
      options.labels ||
      null;
    const canvas = document.createElement('canvas');
    const tooltip = document.createElement('div');
    tooltip.className = 'dashboard-tooltip';
    container.innerHTML = '';
    container.appendChild(canvas);
    container.appendChild(tooltip);

    const ctx = canvas.getContext && canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const allData = list.map((s) => (s.values || []).map((v) => Number(v) || 0));
    const n = allData[0] ? allData[0].length : 0;

    let padLeft = 42, padRight = 12, padTop = 16, padBottom = 34;

    const renderRef = () => render();
    if (container.__chartRender) {
      window.removeEventListener('resize', container.__chartRender);
    }
    container.__chartRender = renderRef;

    function measure() {
      const w = container.clientWidth || container.getBoundingClientRect().width || 360;
      const h = container.clientHeight || container.getBoundingClientRect().height || 200;
      return { w, h };
    }

    function pointX(i, chartW) {
      if (n <= 1) return padLeft + chartW / 2;
      return padLeft + (chartW * i) / (n - 1);
    }

    function render() {
      try {
        if (!ctx) return;
        const { w, h } = measure();
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (!n) return;

        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        let maxVal = -Infinity, minVal = Infinity;
        allData.forEach((d) => d.forEach((v) => { if (v > maxVal) maxVal = v; if (v < minVal) minVal = v; }));
        if (!Number.isFinite(maxVal)) maxVal = 1;
        if (!Number.isFinite(minVal)) minVal = 0;
        maxVal = Math.max(maxVal, minVal + 1);
        // Add symmetric vertical padding so the curve is centered in the chart
        // instead of hugging the top/bottom edges. The padding is a percentage
        // of the data span, which keeps the line visually centered for both
        // wide (temperature) and narrow (humidity) ranges.
        const yPad = Math.max(1, (maxVal - minVal) * 0.18);
        const yMin = minVal - yPad;
        const yMax = maxVal + yPad;
        const range = yMax - yMin || 1;
        // With symmetric padding the data midpoint maps to the vertical center
        // of the plot area, i.e. the curve is centered on the y-axis.
        const dataMid = (maxVal + minVal) / 2;
        const plotMid = yMin + range / 2;
        const centerOffset = dataMid - plotMid;

        const yFor = (v) => padTop + chartH - ((v - yMin) / range) * chartH;

        // Horizontal grid lines + y-axis value labels (always visible).
        ctx.font = '10px Roboto, Arial, sans-serif';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
          const y = padTop + (chartH * i) / 4;
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
          const val = yMax - (range * i) / 4;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.textAlign = 'right';
          ctx.fillText(String(Math.round(val)), padLeft - 6, y);
        }

        // x-axis baseline
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop + chartH);
        ctx.lineTo(padLeft + chartW, padTop + chartH);
        ctx.stroke();

        list.forEach((s) => {
          const data = allData[list.indexOf(s)];
          const lineColor = s.color || 'rgba(96,165,250,0.85)';
          const pts = data.map((v, i) => ({ x: pointX(i, chartW), y: yFor(v) }));

          function buildPath() {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 0; i < pts.length - 1; i++) {
              const p0 = pts[i - 1] || pts[i];
              const p1 = pts[i];
              const p2 = pts[i + 1];
              const p3 = pts[i + 2] || p2;
              const t = 0.18;
              const cp1x = p1.x + (p2.x - p0.x) * t;
              const cp1y = p1.y + (p2.y - p0.y) * t;
              const cp2x = p2.x - (p3.x - p1.x) * t;
              const cp2y = p2.y - (p3.y - p1.y) * t;
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          }

          const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
          grad.addColorStop(0, lineColor.replace(/[\d.]+\)$/, '0.35)'));
          grad.addColorStop(1, lineColor.replace(/[\d.]+\)$/, '0.02)'));
          buildPath();
          ctx.lineTo(pts[pts.length - 1].x, padTop + chartH);
          ctx.lineTo(pts[0].x, padTop + chartH);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          buildPath();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.fillStyle = lineColor;
          pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });
        });

        // x-axis time labels with tick marks. Always visible on the diagram.
        // The axis spans a full 24h rolling window anchored to NOW: position 0
        // is the current hour (e.g. "15:00") and the right edge is the SAME
        // hour the next day ("15:00" again), so it reads 15:00 -> 15:00.
        const X_STEP_HOURS = 4;
        // The end label shows the current hour rolled forward 24h (same hour
        // next day) so the window visibly closes 15:00 -> 15:00.
        const endLabel = (() => {
          const m = labels && labels[0] && String(labels[0]).match(/^(\d{1,2})/);
          const h = m ? Number(m[1]) : 0;
          return `${String(h).padStart(2, '0')}:00`;
        })();
        ctx.font = '11px Roboto, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < n; i++) {
          // Mark every STEP-th point from the start, and always the last point
          // (the 24h boundary) so there is no blank space at the right edge.
          const isStep = i % X_STEP_HOURS === 0;
          const isEnd = i === n - 1;
          if (!isStep && !isEnd) continue;
          const x = pointX(i, chartW);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padTop + chartH);
          ctx.lineTo(x, padTop + chartH + 4);
          ctx.stroke();
          const text = isEnd
            ? endLabel
            : (labels && labels[i] != null ? labels[i] : `${i}h`);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(text, x, padTop + chartH + 7);
        }
        if (list.length > 1) {
          let lx = padLeft;
          ctx.textAlign = 'left';
          ctx.font = '11px Roboto, sans-serif';
          list.forEach((s) => {
            const lineColor = s.color || 'rgba(96,165,250,0.85)';
            ctx.fillStyle = lineColor;
            ctx.fillRect(lx, padTop - 2, 10, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            const txt = s.label || '';
            ctx.fillText(txt, lx + 14, padTop + 2);
            lx += 28 + ctx.measureText(txt).width;
          });
        }


        canvas.onmousemove = (evt) => {
          const rect = canvas.getBoundingClientRect();
          const mx = evt.clientX - rect.left;
          let idx = n <= 1 ? 0 : Math.round(((mx - padLeft) / chartW) * (n - 1));
          idx = Math.max(0, Math.min(n - 1, idx));
          if (mx >= padLeft - 6 && mx <= padLeft + chartW + 6) {
            const lines = list.map((s) => {
              const data = allData[list.indexOf(s)];
              return `<strong style="color:${s.color}">${s.label || ''}</strong>: ${data[idx]}`;
            }).join('<br>');
            tooltip.innerHTML = lines;
            tooltip.style.display = 'block';
            tooltip.style.left = `${Math.min(Math.max(mx + 10, 4), w - 120)}px`;
            const anyY = Math.min(...list.map((s) => yFor(allData[list.indexOf(s)][idx])));
            tooltip.style.top = `${Math.max(anyY - 30, 4)}px`;
          }
        };
        canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
      } catch (e) {
        console.error('[dashboard] drawChart render failed for', containerId, e);
      }
    }

    if (!n) { return; }

    requestAnimationFrame(renderRef);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', renderRef, { once: true });
    }
    window.addEventListener('resize', renderRef);
    if (typeof ResizeObserver !== 'undefined') {
      let rt = null;
      const ro = new ResizeObserver(() => {
        if (rt) clearTimeout(rt);
        rt = setTimeout(renderRef, 60);
      });
      ro.observe(container);
    }
  }

  function rolling(values, fn, windowSize = 5) {
    const half = Math.floor(windowSize / 2);
    return values.map((_, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(values.length, i + half + 1);
      let acc = values[start];
      for (let j = start + 1; j < end; j++) acc = fn(acc, values[j]);
      return acc;
    });
  }

  function next24(arr, times) {
    const out = [];
    const labels = [];
    if (!times || !times.length || !arr || !arr.length) return { values: out, labels };
    const currentHour = new Date().getHours();
    let startIdx = times.findIndex((t) => new Date(t).getHours() === currentHour);
    if (startIdx < 0) startIdx = 0;
    for (let i = startIdx; i < times.length && out.length < 24; i++) {
      out.push(arr[i]);
      const d = new Date(times[i]);
      labels.push(`${String(d.getHours()).padStart(2, '0')}:00`);
    }
    if (!out.length) {
      for (let i = 0; i < 24 && i < arr.length; i++) {
        out.push(arr[i]);
        const d = new Date(times[i]);
        labels.push(`${String(d.getHours()).padStart(2, '0')}:00`);
      }
    }
    return { values: out, labels };
  }

  function next15min(arr, times) {
    const out = [];
    const labels = [];
    if (!times || !times.length || !arr || !arr.length) return { values: out, labels };
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentQuarter = Math.floor(currentMinute / 15) * 15;
    let startIdx = times.findIndex((t) => {
      const d = new Date(t);
      return d.getHours() === currentHour && d.getMinutes() === currentQuarter;
    });
    if (startIdx < 0) startIdx = 0;
    const maxPoints = 96; // 24h * 4 per hour
    for (let i = startIdx; i < times.length && out.length < maxPoints; i++) {
      out.push(arr[i]);
      const d = new Date(times[i]);
      labels.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
    if (!out.length) {
      for (let i = 0; i < maxPoints && i < arr.length; i++) {
        out.push(arr[i]);
        const d = new Date(times[i]);
        labels.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      }
    }
    return { values: out, labels };
  }

  function showChartError(containerId, msg) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.querySelector('.chart-empty')) return;
    const el = document.createElement('div');
    el.className = 'chart-empty';
    el.textContent = msg || 'No data';
    container.appendChild(el);
  }

  function tempToColor(temp) {
    if (temp == null || !Number.isFinite(temp)) return 'transparent';
    const t = Math.max(0, Math.min(1, (temp - (-10)) / (45 - (-10))));
    const hue = (1 - t) * 240;
    return `hsl(${hue}, 75%, 55%)`;
  }

  function renderCitiesTable(containerId, cities) {
    const container = document.getElementById(containerId);
    console.log('[dashboard] renderCitiesTable', { containerId, containerExists: !!container, citiesCount: cities?.length, firstCity: cities?.[0] });
    if (!container) return;
    container.innerHTML = '';
    if (!cities || !cities.length) {
      console.warn('[dashboard] renderCitiesTable: no cities, showing empty state');
      container.innerHTML = '<div class="chart-empty">No data</div>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'cities-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th data-i18n="dashboard.citiesTableCity">City</th><th data-i18n="dashboard.citiesTableMaxTemp">Max Temp</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    cities.forEach((c) => {
      const tr = document.createElement('tr');
      const bg = tempToColor(c.maxTemp);
      tr.style.backgroundColor = bg;
      tr.style.color = 'white';
      const tdName = document.createElement('td');
      tdName.textContent = c.name;
      const tdTemp = document.createElement('td');
      tdTemp.textContent = c.maxTemp != null ? `${c.maxTemp}°` : '--';
      tr.appendChild(tdName);
      tr.appendChild(tdTemp);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    console.log('[dashboard] renderCitiesTable: table appended, children', container.children.length);
    window.I18n?.apply?.();
    console.log('[dashboard] renderCitiesTable: i18n applied');
  }

  async function loadDashboard() {
    const { lat, lon } = getLatLon();
    console.log('[dashboard] loadDashboard start', { lat, lon });
    try {
      const [weather, minutely, hourly, rev] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] weather fetch failed', e); return {}; }),
        fetch(`/api/hourly?lat=${lat}&lon=${lon}&interval=15`).then((r) => r.json()).catch((e) => { console.error('[dashboard] minutely fetch failed', e); return {}; }),
        fetch(`/api/hourly?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] hourly fetch failed', e); return {}; }),
        fetch(`/api/reverse?lat=${lat}&lon=${lon}`).then((r) => r.json()).catch((e) => { console.error('[dashboard] reverse fetch failed', e); return {}; })
      ]);
      console.log('[dashboard] reverse result', rev);
      console.log('[dashboard] weather keys', Object.keys(weather?.data || {}));

      const current = weather?.data?.current || {};

      window.WeatherBackground?.set({
        is_day: current.is_day === 1,
        temperature: current.temperature_2m,
        precipitation: current.precipitation,
        weatherCode: current.weather_code
      });

      const country = rev?.country || '';
      console.log('[dashboard] country from reverse', country);

      const h24 = hourly?.data?.hourly || {};
      const h15 = minutely?.data?.hourly || {};
      const times15 = h15.time || [];
      const times24 = h24.time || [];
      console.log('[dashboard] hourly times count', times24.length, 'minutely times count', times15.length);

      ['cities-table', 'temp-15min-chart', 'humidity-chart', 'wind-chart']
        .forEach((id) => {
          const c = document.getElementById(id);
          const empty = c && c.querySelector('.chart-empty');
          if (empty) empty.remove();
        });

      // Fetch cities data directly from Open-Meteo using a static list of major cities
      let cities = [];
      const countryCities = MAJOR_CITIES_BY_COUNTRY[country];
      if (countryCities && countryCities.length) {
        console.log('[dashboard] fetching weather for', countryCities.length, 'cities in', country);
        try {
          const lats = countryCities.map(c => c.lat).join(',');
          const lons = countryCities.map(c => c.lon).join(',');
          const names = countryCities.map(c => encodeURIComponent(c.name)).join(',');
          const weatherUrl = `/api/weather?lat=${lats}&lon=${lons}&name=${names}`;
          console.log('[dashboard] fetching batch weather', weatherUrl);
          const weatherR = await fetch(weatherUrl);
          console.log('[dashboard] batch weather status', weatherR.status);
          if (weatherR.ok) {
            const weatherData = await weatherR.json();
            console.log('[dashboard] batch weather data keys', Object.keys(weatherData?.data || {}));
            const currents = Object.keys(weatherData?.data || {})
              .filter((k) => !isNaN(Number(k)))
              .sort((a, b) => Number(a) - Number(b))
              .map((k) => weatherData.data[k]?.current)
              .filter(Boolean);
            cities = countryCities.map((c, i) => ({
              name: c.name,
              maxTemp: currents[i]?.temperature_2m != null ? Math.round(currents[i].temperature_2m) : null,
            })).sort((a, b) => (b.maxTemp ?? -Infinity) - (a.maxTemp ?? -Infinity));
            console.log('[dashboard] cities from batch', cities.length, 'first', cities[0]);
          } else {
            console.warn('[dashboard] batch weather HTTP', weatherR.status);
          }
        } catch (e) {
          console.error('[dashboard] batch weather fetch failed', e);
        }
      }
      if (!cities.length) {
        console.warn('[dashboard] no cities for country, using global fallback');
        const fallbackCountries = ['Morocco', 'France', 'United Kingdom', 'Spain', 'United States'];
        for (const fbCountry of fallbackCountries) {
          const fbCities = MAJOR_CITIES_BY_COUNTRY[fbCountry];
          if (!fbCities) continue;
          try {
            const lats = fbCities.map(c => c.lat).join(',');
            const lons = fbCities.map(c => c.lon).join(',');
            const names = fbCities.map(c => encodeURIComponent(c.name)).join(',');
            const weatherUrl = `/api/weather?lat=${lats}&lon=${lons}&name=${names}`;
            const weatherR = await fetch(weatherUrl);
            if (weatherR.ok) {
              const weatherData = await weatherR.json();
              const currents = weatherData?.data?.current || [];
              cities = fbCities.map((c, i) => ({
                name: c.name,
                maxTemp: currents[i]?.temperature_2m != null ? Math.round(currents[i].temperature_2m) : null,
              })).sort((a, b) => (b.maxTemp ?? -Infinity) - (a.maxTemp ?? -Infinity));
              console.log('[dashboard] fallback cities from', fbCountry, cities.length);
              if (cities.length) break;
            }
          } catch (e) { /* ignore */ }
        }
      }
      console.log('[dashboard] final cities count', cities.length, 'first', cities[0]);
      const container = document.getElementById('cities-table');
      console.log('[dashboard] cities-table container exists', !!container);
      renderCitiesTable('cities-table', cities);

      // Temperature chart: prefer 15-min data, fall back to hourly.
      const MAX_15MIN_POINTS = 48;
      const MAX_HOURLY_POINTS = 24;
      const safe = (id, series) => {
        try { drawChart(id, series); }
        catch (e) { console.error('[dashboard] drawChart failed for', id, e); showChartError(id, 'No data'); }
      };

      if (times15.length) {
        const temp15 = next15min(h15.temperature_2m, times15);
        const temp15cut = { values: temp15.values.slice(0, MAX_15MIN_POINTS), labels: temp15.labels.slice(0, MAX_15MIN_POINTS) };
        safe('temp-15min-chart', { values: temp15cut.values.map((v) => U.temp(v)), color: 'rgba(248,113,113,0.9)', label: '°C', labels: temp15cut.labels });
        const titleEl = document.getElementById('temp-15min-title');
        if (titleEl) titleEl.setAttribute('data-i18n', 'dashboard.temp15min');
      } else if (times24.length) {
        const temp24 = next24(h24.temperature_2m, times24);
        const temp24cut = { values: temp24.values.slice(0, MAX_HOURLY_POINTS), labels: temp24.labels.slice(0, MAX_HOURLY_POINTS) };
        safe('temp-15min-chart', { values: temp24cut.values.map((v) => U.temp(v)), color: 'rgba(248,113,113,0.9)', label: '°C', labels: temp24cut.labels });
        const titleEl = document.getElementById('temp-15min-title');
        if (titleEl) {
          titleEl.setAttribute('data-i18n', 'dashboard.tempHourly');
          window.I18n?.apply?.();
        }
      } else {
        showChartError('temp-15min-chart', 'No data');
      }

      // Humidity and wind stay on the 24h hourly window.
      if (times24.length) {
        const hum24 = next24(h24.relative_humidity_2m, times24);
        safe('humidity-chart', { values: hum24.values, color: 'rgba(52,211,153,0.85)', label: '%', labels: hum24.labels });
        const wind24 = next24(h24.wind_speed_10m, times24);
        safe('wind-chart', { values: wind24.values.map((v) => U.wind(v)), color: 'rgba(251,191,36,0.85)', label: U.windLabel(), labels: wind24.labels });
      } else {
        ['humidity-chart', 'wind-chart']
          .forEach((id) => showChartError(id, 'No data'));
      }
    } catch (e) {
      console.error('[dashboard] loadDashboard error', e);
    }
  }

  function init() {
    window.addEventListener('location:changed', loadDashboard);
    loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
