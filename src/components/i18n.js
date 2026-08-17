// Shared i18n: applies translations to every element marked with
// `data-i18n` (textContent), `data-i18n-placeholder` (placeholder) or
// `data-i18n-title` (title). Runs on load and re-applies when the language
// is changed (the settings modal reloads the page, which re-applies here).
window.I18n = (function () {
  const DICT = {
    en: {
'nav.home': 'Home', 'nav.dashboard': 'Dashboard', 'nav.forecast': 'Forecast', 'nav.map': 'Weather Map',
      'forecast.today': 'Today',
      'forecast.tomorrow': 'Tomorrow',
      'settings.title': 'Settings', 'settings.appearance': 'Appearance', 'settings.theme': 'Theme',
      'settings.units': 'Units', 'settings.temperature': 'Temperature', 'settings.windSpeed': 'Wind Speed',
      'settings.language': 'Language', 'settings.uiLanguage': 'UI Language',
      'settings.cancel': 'Cancel', 'settings.confirm': 'Confirm',
      'settings.interface': 'Interface', 'settings.ticker': 'Capitals ticker',
      'settings.themeWeather': 'Weather-based', 'settings.themeLight': 'Light', 'settings.themeDark': 'Dark',
      'settings.unitC': 'Celsius (°C)', 'settings.unitF': 'Fahrenheit (°F)',
      'settings.windKmh': 'km/h', 'settings.windKn': 'kt', 'settings.windMs': 'm/s',
      'location.title': 'Choose city & country', 'location.country': 'Country', 'location.city': 'City',
      'location.cancel': 'Cancel', 'location.confirm': 'Confirm',
      'location.selectCountry': 'Select a country', 'location.selectCity': 'Select a city',
      'location.selectCountryFirst': 'Select a country first', 'location.noCities': 'No cities available',
      'home.localDomain': 'Local network: http://open-meteo.local:3000',
      'dashboard.airQuality': 'Air Quality', 'dashboard.tempMax': 'Max Temperature (24h)', 'dashboard.tempMin': 'Min Temperature (24h)',
      'dashboard.precip': 'Precipitation Chance', 'dashboard.humidity': 'Humidity', 'dashboard.wind': 'Wind Speed',
      'dashboard.temp': 'Temperature', 'dashboard.citiesTable': 'Cities - (Min) and Max Temperature',
      'dashboard.citiesTableCity': 'City', 'dashboard.citiesTableMaxTemp': 'Max Temperature', 'dashboard.citiesTableMinTemp': 'Min Temperature',
      'dashboard.domain': 'Model:',
      'home.precipitation': 'Precipitation:', 'home.humidity': 'Humidity:', 'home.wind': 'Wind:', 'home.feelsLike': 'Feels like:',
      'header.geoTitle': 'Choose location', 'header.settingsTitle': 'Settings',
      'lang.en': 'English', 'lang.fr': 'Français', 'lang.es': 'Español', 'lang.ar': 'العربية',
      'nav.climatology': 'Climatology',
      'climatology.title': 'Climatology', 'climatology.subtitle': 'View past weather data for a specific date and hour',
      'climatology.date': 'Date', 'climatology.hour': 'Hour', 'climatology.fetch': 'Fetch Data',
      'climatology.loading': 'Loading...', 'climatology.error': 'Unable to load climatology data.', 'climatology.hourlyTrend': 'Hourly temperature trend', 'climatology.pressure': 'Pressure', 'climatology.cloudCover': 'Cloud cover',       'climatology.uvIndex': 'UV Index',
      'map.title': 'Weather Map', 'map.loading': 'Loading weather map...', 'map.noData': 'No weather data available for display on the map.', 'map.error': 'Unable to load weather map data.',
      'map.controls': 'Map Controls', 'map.layer': 'Weather layer', 'map.basemap': 'Base map',
      'map.basemap.map': 'Map', 'map.basemap.satellite': 'Satellite',
      'map.showControls': 'Show controls', 'map.hideControls': 'Hide controls',
      'map.layer.temperature': 'Temperature', 'map.layer.precipitation': 'Precipitation',
      'map.layer.radar': 'Radar', 'map.layer.clouds': 'Clouds', 'map.layer.pressure': 'Pressure', 'map.layer.wind': 'Wind',
    },
    fr: {
      'nav.home': 'Accueil', 'nav.dashboard': 'Tableau de bord',       'nav.forecast': 'Prévisions', 'nav.map': 'Carte météo',
      'forecast.today': "Aujourd'hui",
      'forecast.tomorrow': 'Demain',
      'settings.title': 'Paramètres', 'settings.appearance': 'Apparence', 'settings.theme': 'Thème',
      'settings.units': 'Unités', 'settings.temperature': 'Température', 'settings.windSpeed': 'Vitesse du vent',
      'settings.language': 'Langue', 'settings.uiLanguage': 'Langue de l’interface',
      'settings.cancel': 'Annuler', 'settings.confirm': 'Confirmer',
      'settings.interface': 'Interface', 'settings.ticker': 'Bandeau des capitales',
      'settings.themeWeather': 'Selon la météo', 'settings.themeLight': 'Clair', 'settings.themeDark': 'Sombre',
      'settings.unitC': 'Celsius (°C)', 'settings.unitF': 'Fahrenheit (°F)',
      'settings.windKmh': 'km/h', 'settings.windKn': 'kt', 'settings.windMs': 'm/s',
      'location.title': 'Choisir ville et pays', 'location.country': 'Pays', 'location.city': 'Ville',
      'location.cancel': 'Annuler', 'location.confirm': 'Confirmer',
      'location.selectCountry': 'Choisir un pays', 'location.selectCity': 'Choisir une ville',
      'location.selectCountryFirst': 'Choisir d’abord un pays', 'location.noCities': 'Aucune ville disponible',
      'home.localDomain': 'Réseau local : http://open-meteo.local:3000',
      'dashboard.airQuality': 'Qualité de l’air', 'dashboard.tempMax': 'Température max. (24h)', 'dashboard.tempMin': 'Température min. (24h)',
      'dashboard.precip': 'Probabilité de précipitation', 'dashboard.humidity': 'Humidité', 'dashboard.wind': 'Vitesse du vent',
      'dashboard.temp': 'Température', 'dashboard.citiesTable': 'Villes - Températures (min) et max',
      'dashboard.citiesTableCity': 'Ville', 'dashboard.citiesTableMaxTemp': 'Max', 'dashboard.citiesTableMinTemp': 'Min',
      'dashboard.domain': 'Modèle :',
      'home.precipitation': 'Précipitations :', 'home.humidity': 'Humidité :', 'home.wind': 'Vent :', 'home.feelsLike': 'Ressenti :',
      'header.geoTitle': 'Choisir la localisation', 'header.settingsTitle': 'Paramètres',
      'lang.en': 'Anglais', 'lang.fr': 'Français', 'lang.es': 'Espagnol', 'lang.ar': 'Arabe',
      'nav.climatology': 'Climatologie',
      'climatology.title': 'Climatologie', 'climatology.subtitle': 'Consulter les données météo passées pour une date et heure choisies',
      'climatology.date': 'Date', 'climatology.hour': 'Heure', 'climatology.fetch': 'Charger',
      'climatology.loading': 'Chargement...', 'climatology.error': 'Impossible de charger les données de climatologie.', 'climatology.hourlyTrend': 'Tendance horaire de température', 'climatology.pressure': 'Pression', 'climatology.cloudCover': 'Couverture nuageuse',       'climatology.uvIndex': 'Indice UV',
      'map.title': 'Carte météo', 'map.loading': 'Chargement de la carte météo...', 'map.noData': 'Aucune donnée météo disponible pour afficher sur la carte.', 'map.error': 'Impossible de charger les données de la carte météo.',
      'map.controls': 'Contrôles de la carte', 'map.layer': 'Couche météo', 'map.basemap': 'Carte de base',
      'map.basemap.map': 'Carte', 'map.basemap.satellite': 'Satellite',
      'map.showControls': 'Afficher les contrôles', 'map.hideControls': 'Masquer les contrôles',
      'map.layer.temperature': 'Température', 'map.layer.precipitation': 'Précipitations',
      'map.layer.radar': 'Radar', 'map.layer.clouds': 'Nuages', 'map.layer.pressure': 'Pression', 'map.layer.wind': 'Vent',
    },
    es: {
      'nav.home': 'Inicio', 'nav.dashboard': 'Panel',       'nav.forecast': 'Pronóstico', 'nav.map': 'Mapa meteorológico',
      'forecast.today': 'Hoy',
      'forecast.tomorrow': 'Mañana',
      'settings.title': 'Ajustes', 'settings.appearance': 'Apariencia', 'settings.theme': 'Tema',
      'settings.units': 'Unidades', 'settings.temperature': 'Temperatura', 'settings.windSpeed': 'Velocidad del viento',
      'settings.language': 'Idioma', 'settings.uiLanguage': 'Idioma de la interfaz',
      'settings.cancel': 'Cancelar', 'settings.confirm': 'Confirmar',
      'settings.interface': 'Interfaz', 'settings.ticker': 'Ticker de capitales',
      'settings.themeWeather': 'Según el clima', 'settings.themeLight': 'Claro', 'settings.themeDark': 'Oscuro',
      'settings.unitC': 'Celsius (°C)', 'settings.unitF': 'Fahrenheit (°F)',
      'settings.windKmh': 'km/h', 'settings.windKn': 'kt', 'settings.windMs': 'm/s',
      'location.title': 'Elegir ciudad y país', 'location.country': 'País', 'location.city': 'Ciudad',
      'location.cancel': 'Cancelar', 'location.confirm': 'Confirmar',
      'location.selectCountry': 'Selecciona un país', 'location.selectCity': 'Selecciona una ciudad',
      'location.selectCountryFirst': 'Selecciona primero un país', 'location.noCities': 'No hay ciudades disponibles',
      'home.localDomain': 'Red local: http://open-meteo.local:3000',
      'dashboard.airQuality': 'Calidad del aire', 'dashboard.tempMax': 'Temperatura máx. (24h)', 'dashboard.tempMin': 'Temperatura mín. (24h)',
      'dashboard.precip': 'Probabilidad de precipitación', 'dashboard.humidity': 'Humedad', 'dashboard.wind': 'Velocidad del viento',
      'dashboard.temp': 'Temperatura', 'dashboard.citiesTable': 'Ciudades - Temp. (mín.) y máx.',
      'dashboard.citiesTableCity': 'Ciudad', 'dashboard.citiesTableMaxTemp': 'Máx.', 'dashboard.citiesTableMinTemp': 'Mín.',
      'dashboard.domain': 'Modelo:',
      'home.precipitation': 'Precipitación:', 'home.humidity': 'Humedad:', 'home.wind': 'Viento:', 'home.feelsLike': 'Sensación térmica:',
      'header.geoTitle': 'Elegir ubicación', 'header.settingsTitle': 'Ajustes',
      'lang.en': 'Inglés', 'lang.fr': 'Francés', 'lang.es': 'Español', 'lang.ar': 'Árabe',
      'nav.climatology': 'Climatología',
      'climatology.title': 'Climatología', 'climatology.subtitle': 'Ver datos meteorológicos pasados para una fecha y hora elegidas',
      'climatology.date': 'Fecha', 'climatology.hour': 'Hora', 'climatology.fetch': 'Cargar',
      'climatology.loading': 'Cargando...', 'climatology.error': 'No se pudieron cargar los datos de climatología.', 'climatology.hourlyTrend': 'Tendencia horaria de temperatura', 'climatology.pressure': 'Presión', 'climatology.cloudCover': 'Cobertura de nubes',       'climatology.uvIndex': 'Índice UV',
      'map.title': 'Mapa meteorológico', 'map.loading': 'Cargando mapa meteorológico...', 'map.noData': 'No hay datos meteorológicos disponibles para mostrar en el mapa.', 'map.error': 'No se pudieron cargar los datos del mapa meteorológico.',
      'map.controls': 'Controles del mapa', 'map.layer': 'Capa meteorológica', 'map.basemap': 'Mapa base',
      'map.basemap.map': 'Mapa', 'map.basemap.satellite': 'Satélite',
      'map.showControls': 'Mostrar controles', 'map.hideControls': 'Ocultar controles',
      'map.layer.temperature': 'Temperatura', 'map.layer.precipitation': 'Precipitación',
      'map.layer.radar': 'Radar', 'map.layer.clouds': 'Nubes', 'map.layer.pressure': 'Presión', 'map.layer.wind': 'Viento',
    },
    ar: {
      'nav.home': 'الرئيسية', 'nav.dashboard': 'لوحة التحكم',       'nav.forecast': 'التوقعات', 'nav.map': 'خريطة الطقس',
      'forecast.today': 'اليوم',
      'forecast.tomorrow': 'غداً',
      'settings.title': 'الإعدادات', 'settings.appearance': 'المظهر', 'settings.theme': 'السمة',
      'settings.units': 'الوحدات', 'settings.temperature': 'درجة الحرارة', 'settings.windSpeed': 'سرعة الرياح',
      'settings.language': 'اللغة', 'settings.uiLanguage': 'لغة الواجهة',
      'settings.cancel': 'إلغاء', 'settings.confirm': 'تأكيد',
      'settings.interface': 'الواجهة', 'settings.ticker': 'شريط العواصم',
      'settings.themeWeather': 'حسب الطقس', 'settings.themeLight': 'فاتح', 'settings.themeDark': 'داكن',
      'settings.unitC': 'مئوية (°C)', 'settings.unitF': 'فهرنهايت (°F)',
      'settings.windKmh': 'كم/س', 'settings.windKn': 'عقدة', 'settings.windMs': 'م/ث',
      'location.title': 'اختر المدينة والدولة', 'location.country': 'الدولة', 'location.city': 'المدينة',
      'location.cancel': 'إلغاء', 'location.confirm': 'تأكيد',
      'location.selectCountry': 'اختر الدولة', 'location.selectCity': 'اختر المدينة',
      'location.selectCountryFirst': 'اختر الدولة أولاً', 'location.noCities': 'لا توجد مدن متاحة',
      'home.localDomain': 'الشبكة المحلية: http://open-meteo.local:3000',
      'dashboard.airQuality': 'جودة الهواء', 'dashboard.tempMax': 'أعلى درجة حرارة (24 ساعة)', 'dashboard.tempMin': 'أدنى درجة حرارة (24 ساعة)',
      'dashboard.precip': 'احتمال الهطول', 'dashboard.humidity': 'الرطوبة', 'dashboard.wind': 'سرعة الرياح',
      'dashboard.temp': 'درجة الحرارة', 'dashboard.citiesTable': 'المدن - (أدنى) وأقصى درجة حرارة',
      'dashboard.citiesTableCity': 'المدينة', 'dashboard.citiesTableMaxTemp': 'أقصى', 'dashboard.citiesTableMinTemp': 'أدنى',
      'dashboard.domain': 'النموذج:',
      'home.precipitation': 'الهطول:', 'home.humidity': 'الرطوبة:', 'home.wind': 'الرياح:', 'home.feelsLike': 'الإحساس:',
      'header.geoTitle': 'اختر الموقع', 'header.settingsTitle': 'الإعدادات',
      'lang.en': 'الإنجليزية', 'lang.fr': 'الفرنسية', 'lang.es': 'الإسبانية', 'lang.ar': 'العربية',
      'nav.climatology': 'المناخ',
      'climatology.title': 'المناخ', 'climatology.subtitle': 'عرض بيانات الطقس السابقة لتاريخ ووقت محددين',
      'climatology.date': 'التاريخ', 'climatology.hour': 'الساعة', 'climatology.fetch': 'تحميل',
      'climatology.loading': 'جاري التحميل...', 'climatology.error': 'تعذر تحميل بيانات المناخ.', 'climatology.hourlyTrend': 'الاتجاه الحراري لدرجة الحرارة', 'climatology.pressure': 'الضغط', 'climatology.cloudCover': 'تغطية السحب',       'climatology.uvIndex': 'مؤشر الأشعة فوق البنفسجية',
      'map.title': 'خريطة الطقس', 'map.loading': 'جاري تحميل خريطة الطقس...', 'map.noData': 'لا توجد بيانات طقس متاحة لعرضها على الخريطة.', 'map.error': 'تعذر تحميل بيانات الخريطة الطقسية.',
      'map.controls': 'عناصر التحكم بالخريطة', 'map.layer': 'طبقة الطقس', 'map.basemap': 'الخريطة الأساسية',
      'map.basemap.map': 'خريطة', 'map.basemap.satellite': 'قمر صناعي',
      'map.showControls': 'إظهار العناصر', 'map.hideControls': 'إخفاء العناصر',
      'map.layer.temperature': 'درجة الحرارة', 'map.layer.precipitation': 'هطول',
      'map.layer.radar': 'رادار', 'map.layer.clouds': 'سحب', 'map.layer.pressure': 'ضغط', 'map.layer.wind': 'رياح',
    }
  };

  function getLang() {
    try { return localStorage.getItem('open-meteo-lang') || 'en'; }
    catch (e) { return 'en'; }
  }

  function apply() {
    const lang = getLang();
    const dict = DICT[lang] || DICT.en;
    const root = document.documentElement;
    root.lang = lang;
    // Arabic body text flows RTL so labels read correctly, but the header is
    // forced LTR in CSS so its order is never flipped.
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] != null) el.placeholder = dict[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key] != null) el.title = dict[key];
    });

    // Weather-card metric labels are marked with data-key (precipitation,
    // humidity, wind). Translate them through the shared home.* dictionary so
    // labels are affected by language changes everywhere.
    document.querySelectorAll('.weather-label[data-key]').forEach((el) => {
      const key = `home.${el.getAttribute('data-key')}`;
      if (dict[key] != null) el.textContent = dict[key];
    });
  }

  return { apply, getLang, DICT };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.I18n.apply());
} else {
  window.I18n.apply();
}
