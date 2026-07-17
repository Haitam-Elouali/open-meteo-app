// Shared location picker. Wires the header geo button on every page to open
// a modal with a Country <select> and a City <select>. The city dropdown is
// enabled only after a country is chosen and is populated with that country's
// cities. On confirm it resolves the chosen city to lat/lon, overwrites the
// saved location, and dispatches a `location:changed` event so pages reload.
(function () {
  const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia",
    "Austria", "Azerbaijan", "Bahamas", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize",
    "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Chad", "Chile",
    "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
    "Denmark", "Djibouti", "Dominica", "Ecuador", "Egypt", "El Salvador", "Eritrea", "Estonia",
    "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
    "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guyana", "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Italy", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
    "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
    "Malaysia", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
    "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
    "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
    "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga",
    "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
    "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
    "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];

  // Major cities per country (capital + a few extras). Only names are stored;
  // coordinates are resolved on confirm via the geocoding API.
  const CITIES_BY_COUNTRY = {
    "United States": ["Washington", "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Miami"],
    "France": ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille"],
    "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Liverpool", "Bristol", "Edinburgh", "Cardiff", "Belfast"],
    "Germany": ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "Dortmund", "Leipzig", "Bremen"],
    "Spain": ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Malaga", "Murcia", "Palma", "Bilbao", "Alicante"],
    "Italy": ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Venice", "Bari"],
    "Canada": ["Ottawa", "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Quebec", "Winnipeg", "Hamilton", "Kitchener"],
    "Australia": ["Canberra", "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Newcastle", "Hobart", "Darwin"],
    "India": ["New Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"],
    "Brazil": ["Brasília", "Sao Paulo", "Rio de Janeiro", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre"],
    "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Juárez", "Cancún", "Mexicali", "Acapulco"],
    "Japan": ["Tokyo", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Kawasaki", "Saitama", "Hiroshima"],
    "China": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu", "Tianjin", "Wuhan", "Xian", "Hangzhou", "Nanjing"],
    "Russia": ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod", "Chelyabinsk", "Samara", "Omsk", "Rostov-on-Don"],
    "South Africa": ["Pretoria", "Johannesburg", "Cape Town", "Durban", "Port Elizabeth", "Bloemfontein", "East London", "Nelspruit", "Polokwane", "Kimberley"],
    "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Tilburg", "Groningen", "Almere", "Breda", "Nijmegen"],
    "Portugal": ["Lisbon", "Porto", "Braga", "Coimbra", "Funchal", "Setúbal", "Amadora", "Aveiro", "Faro", "Madeira"],
    "Belgium": ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges", "Namur", "Leuven", "Mons", "Aalst"],
    "Switzerland": ["Bern", "Zurich", "Geneva", "Basel", "Lausanne", "Winterthur", "Lucerne", "St. Gallen", "Lugano", "Fribourg"],
    "Austria": ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels", "Sankt Pölten", "Dornbirn"],
    "Sweden": ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping", "Helsingborg", "Jönköping", "Norrköping"],
    "Norway": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand", "Tromsø", "Sandnes", "Ålesund"],
    "Poland": ["Warsaw", "Krakow", "Lodz", "Wroclaw", "Poznan", "Gdansk", "Szczecin", "Bydgoszcz", "Lublin", "Katowice"],
    "Turkey": ["Ankara", "Istanbul", "Izmir", "Bursa", "Adana", "Gaziantep", "Konya", "Antalya", "Kayseri", "Mersin"],
    "Egypt": ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said", "Suez", "Luxor", "Aswan", "Mansoura", "El Mahalla El Kubra"],
    "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Tabuk", "Buraidah", "Khamis Mushait", "Abha"],
    "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Dibba", "Ghayathi"],
    "Nigeria": ["Abuja", "Lagos", "Kano", "Ibadan", "Benin City", "Port Harcourt", "Kaduna", "Enugu", "Aba", "Ilorin"],
    "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi", "Kitale", "Garissa", "Kakamega"],
    "Argentina": ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "Tucuman", "La Plata", "Mar del Plata", "Salta", "Santa Fe", "San Juan"],
    "Chile": ["Santiago", "Valparaiso", "Concepcion", "La Serena", "Antofagasta", "Temuco", "Rancagua", "Talca", "Arica", "Puerto Montt"],
    "Colombia": ["Bogotá", "Medellin", "Cali", "Barranquilla", "Cartagena", "Cúcuta", "Bucaramanga", "Pereira", "Santa Marta", "Ibagué"],
    "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Bekasi", "Medan", "Tangerang", "Depok", "Semarang", "Palembang", "Makassar"],
    "Philippines": ["Manila", "Quezon City", "Davao", "Cebu", "Zamboanga", "Cagayan de Oro", "Parañaque", "Dasmariñas", "Valenzuela", "Bacolod"],
    "Thailand": ["Bangkok", "Chiang Mai", "Pattaya", "Phuket", "Hat Yai", "Nakhon Ratchasima", "Chonburi", "Udon Thani", "Ubon Ratchathani", "Nakhon Si Thammarat"],
    "Vietnam": ["Hanoi", "Ho Chi Minh City", "Da Nang", "Haiphong", "Huế", "Nha Trang", "Can Tho", "Bien Hoa", "Hue", "Vung Tau"],
    "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan", "Jeonju", "Cheongju"],
    "Ireland": ["Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk", "Swords", "Bray", "Navan"],
    "New Zealand": ["Wellington", "Auckland", "Christchurch", "Hamilton", "Tauranga", "Napier", "Dunedin", "Palmerston North", "Nelson", "Rotorua"],
    "Greece": ["Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa", "Volos", "Ioannina", "Chania", "Chalcis", "Serres"],
    "Denmark": ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Frederiksberg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle"],
    "Finland": ["Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä", "Lahti", "Kuopio", "Pori"],
    "Czechia": ["Prague", "Brno", "Ostrava", "Plzen", "Liberec", "Olomouc", "Ceske Budejovice", "Hradec Kralove", "Usti nad Labem", "Pardubice"],
    "Hungary": ["Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr", "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely"],
    "Romania": ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Craiova", "Brașov", "Galați", "Ploiești", "Oradea"],
    "Ukraine": ["Kyiv", "Kharkiv", "Odessa", "Dnipro", "Donetsk", "Zaporizhzhia", "Lviv", "Kryvyi Rih", "Mykolaiv", "Luhansk"],
    "Morocco": ["Rabat", "Casablanca", "Fes", "Marrakesh", "Agadir", "Tangier", "Meknes", "Oujda", "Kenitra", "Tetouan"]
  };

  function $(sel) { return document.querySelector(sel); }

  function citiesFor(country) {
    if (CITIES_BY_COUNTRY[country]) return CITIES_BY_COUNTRY[country];
    // Fall back to the country's capital (same name as the country entry's
    // capital list is not stored, so just return the country itself as a
    // single resolvable option).
    return null;
  }

  async function fetchCitiesFromEndpoint(country) {
    try {
      const qs = new URLSearchParams({ country });
      const res = await fetch(`/api/cities?${qs.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      const cities = (data?.cities || []).filter(Boolean);
      return cities.length ? cities : null;
    } catch (e) {
      return null;
    }
  }

  function t(key, fallback) {
    try {
      const dict = (window.I18n && window.I18n.DICT) || {};
      const lang = window.I18n && window.I18n.getLang ? window.I18n.getLang() : 'en';
      return (dict[lang] && dict[lang][key] != null) ? dict[lang][key] : (fallback || key);
    } catch (e) { return fallback || key; }
  }

  function populateCities(cities) {
    const citySelect = $('.location-city');
    if (!citySelect) return;
    citySelect.disabled = false;
    citySelect.innerHTML = `<option value="">${t('location.selectCity', 'Select a city')}</option>` +
      cities.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function uniqueCityNames(results) {
    const seen = new Set();
    const out = [];
    (results || []).forEach((r) => {
      const name = r?.name || r?.city;
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    });
    return out;
  }

  function removeCountry(select, country) {
    if (!select) return;
    const opt = Array.from(select.options).find((o) => o.value === country);
    if (opt) opt.remove();
    select.value = '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function openModal() {
    const backdrop = $('.location-modal-backdrop');
    if (!backdrop) return;
    const countrySelect = $('.location-country');
    if (countrySelect && countrySelect.options.length <= 1) {
      countrySelect.innerHTML = `<option value="">${t('location.selectCountry', 'Select a country')}</option>` +
        COUNTRIES.map((c) => `<option value="${c}">${c}</option>`).join('');
    }
    const citySelect = $('.location-city');
    if (citySelect) {
      citySelect.innerHTML = `<option value="">${t('location.selectCountryFirst', 'Select a country first')}</option>`;
      citySelect.disabled = true;
    }
    if (window.I18n && window.I18n.apply) window.I18n.apply();
    backdrop.hidden = false;
  }

  function closeModal() {
    const backdrop = $('.location-modal-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  async function resolveCity(country, cityName) {
    const qs = new URLSearchParams({ country, city: cityName, count: 5 });
    const res = await fetch(`/api/location?${qs.toString()}`);
    if (!res.ok) throw new Error('Location search failed');
    const data = await res.json();
    const results = (data?.results || []).filter(
      (r) => (r.country || '').trim().toLowerCase() === country.trim().toLowerCase()
    );
    return results[0] || data?.results?.[0];
  }

  async function fetchCitiesForCountry(country, query) {
    const qs = new URLSearchParams({ country, city: query, count: 50 });
    const res = await fetch(`/api/location?${qs.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.results || [];
  }

  function wire() {
    const backdrop = $('.location-modal-backdrop');
    if (!backdrop) return;

    const geoBtn = $('.header__geo-button');
    if (geoBtn) geoBtn.addEventListener('click', openModal);

    backdrop.querySelector('.location-cancel')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    const countrySelect = $('.location-country');
    const citySelect = $('.location-city');

    countrySelect?.addEventListener('change', async () => {
      const country = countrySelect.value;
      if (!citySelect) return;
      if (!country) {
        citySelect.innerHTML = `<option value="">${t('location.selectCountryFirst', 'Select a country first')}</option>`;
        citySelect.disabled = true;
        return;
      }

      // Prefer the comprehensive curated city list served by the backend
      // (covers every major city, e.g. Morocco). Fall back to the local
      // curated list, then to the live geocoding API.
      const endpointCities = await fetchCitiesFromEndpoint(country);
      if (endpointCities && endpointCities.length) {
        populateCities(endpointCities);
        return;
      }

      const localCities = citiesFor(country);
      if (localCities && localCities.length) {
        populateCities(localCities);
        return;
      }

      // No curated list: ask the geocoding API. If it returns nothing, the
      // country has no resolvable cities, so drop it from the dropdown.
      fetchCitiesForCountry(country, '')
        .then((results) => {
          const names = uniqueCityNames(results);
          if (names.length) {
            populateCities(names);
          } else {
            removeCountry(countrySelect, country);
            citySelect.innerHTML = `<option value="">${t('location.noCities', 'No cities available')}</option>`;
            citySelect.disabled = true;
          }
        })
        .catch(() => {
          citySelect.innerHTML = `<option value="">${t('location.noCities', 'No cities available')}</option>`;
          citySelect.disabled = true;
        });
    });

    const confirmBtn = backdrop.querySelector('.location-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const country = countrySelect?.value;
        const cityName = citySelect?.value?.trim();
        if (!country || !cityName) return;
        try {
          const r = await resolveCity(country, cityName);
          if (!r) return;
          window.__lastLatLon = { lat: Number(r.lat), lon: Number(r.lon) };
          try { localStorage.setItem('open-meteo-latlon', JSON.stringify(window.__lastLatLon)); } catch (e) {}
          closeModal();
          window.dispatchEvent(new CustomEvent('location:changed', { detail: window.__lastLatLon }));
        } catch (e) { console.error(e); }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
