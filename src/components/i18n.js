// Shared i18n: applies translations to every element marked with
// `data-i18n` (textContent), `data-i18n-placeholder` (placeholder) or
// `data-i18n-title` (title). Runs on load and re-applies when the language
// is changed (the settings modal reloads the page, which re-applies here).
window.I18n = (function () {
  const DICT = {
    en: {
      'nav.home': 'Home', 'nav.dashboard': 'Dashboard', 'nav.forecast': 'Forecast', 'nav.map': 'Weather Map', 'nav.dataImport': 'Data Import', 'nav.observations': 'Weather Observations', 'nav.forecasts': 'Forecasts', 'nav.statistics': 'Statistics', 'nav.historical': 'Historical Data', 'nav.reports': 'Reports', 'nav.settings': 'Settings',
      'forecast.today': 'Today',
      'forecast.tomorrow': 'Tomorrow',
      'settings.title': 'Settings', 'settings.appearance': 'Appearance', 'settings.theme': 'Theme',
      'settings.units': 'Units', 'settings.temperature': 'Temperature', 'settings.windSpeed': 'Wind Speed',
      'settings.language': 'Language', 'settings.uiLanguage': 'UI Language',
      'settings.cancel': 'Cancel', 'settings.confirm': 'Confirm',
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
      'dashboard.temp': 'Temperature', 'dashboard.citiesTable': 'Cities - Max Temperature',
      'dashboard.citiesTableCity': 'City', 'dashboard.citiesTableMaxTemp': 'Max Temperature', 'dashboard.citiesTableMinTemp': 'Min Temperature',
      'dashboard.domain': 'Model:',
      'home.precipitation': 'Precipitation:', 'home.humidity': 'Humidity:', 'home.wind': 'Wind:', 'home.feelsLike': 'Feels like:',
      'header.geoTitle': 'Choose location', 'header.settingsTitle': 'Settings',
      'lang.en': 'English', 'lang.fr': 'Français', 'lang.es': 'Español', 'lang.ar': 'العربية',
      'nav.climatology': 'Climatology',
      'climatology.title': 'Climatology', 'climatology.subtitle': 'View past weather data for a specific date and hour',
      'climatology.date': 'Date', 'climatology.hour': 'Hour', 'climatology.fetch': 'Fetch Data',
'climatology.loading': 'Loading...', 'climatology.error': 'Unable to load climatology data.', 'climatology.hourlyTrend': 'Hourly temperature trend', 'climatology.pressure': 'Pressure', 'climatology.cloudCover': 'Cloud cover', 'climatology.uvIndex': 'UV Index',
      'map.title': 'Weather Map', 'map.subtitle': 'Interactive visualization of meteorological observations and forecasts.',
      'map.searchPlaceholder': 'Search city, country or coordinates...', 'map.currentLocation': 'Current Location', 'map.refreshData': 'Refresh Data', 'map.exportMap': 'Export Map',
      'map.layers': 'Map Layers', 'map.forecast': 'Forecast', 'map.animation': 'Animation',
      'map.play': 'Play', 'map.pause': 'Pause', 'map.nextFrame': 'Next Frame', 'map.prevFrame': 'Previous Frame',
      'map.speed': 'Speed:', 'map.forecastCurrent': 'Current', 'map.forecast24h': '24h', 'map.forecast3d': '3d', 'map.forecast7d': '7d',
      'map.forecasts': 'Forecasts', 'map.dataImport': 'Data Import', 'map.observations': 'Observations', 'map.statistics': 'Statistics',
      'map.historical': 'Historical Data', 'map.reports': 'Reports', 'map.settings': 'Settings',
      'map.legend': 'Legend', 'map.legendTemperature': 'Temperature', 'map.legendRain': 'Rain', 'map.legendWind': 'Wind',
      'map.prevHour': 'Prev Hour', 'map.playAnimation': 'Play Animation', 'map.stopAnimation': 'Stop', 'map.temperature': 'Temperature', 'map.feelsLike': 'Feels Like', 'map.visibility': 'Visibility', 'map.rainProb': 'Rain Probability', 'map.moonPhase': 'Moon Phase', 'map.satellite': 'Satellite', 'map.radar': 'Radar', 'map.heatIndex': 'Heat Index',
    },
  fr: {
      'nav.home': 'Accueil', 'nav.dashboard': 'Tableau de bord', 'nav.forecast': 'Prévisions', 'nav.map': 'Carte Météo', 'nav.dataImport': 'Import de données', 'nav.observations': 'Observations météo', 'nav.forecasts': 'Prévisions', 'nav.statistics': 'Statistiques', 'nav.historical': 'Données historiques', 'nav.reports': 'Rapports', 'nav.settings': 'Paramètres',
      'forecast.today': "Aujourd'hui",
      'forecast.tomorrow': 'Demain',
      'settings.title': 'Paramètres', 'settings.appearance': 'Apparence', 'settings.theme': 'Thème',
      'settings.units': 'Unités', 'settings.temperature': 'Température', 'settings.windSpeed': 'Vitesse du vent',
      'settings.language': 'Langue', 'settings.uiLanguage': 'Langue de l\'interface',
      'settings.cancel': 'Annuler', 'settings.confirm': 'Confirmer',
      'settings.themeWeather': 'Selon la météo', 'settings.themeLight': 'Clair', 'settings.themeDark': 'Sombre',
      'settings.unitC': 'Celsius (°C)', 'settings.unitF': 'Fahrenheit (°F)',
      'settings.windKmh': 'km/h', 'settings.windKn': 'kt', 'settings.windMs': 'm/s',
      'location.title': 'Choisir ville et pays', 'location.country': 'Pays', 'location.city': 'Ville',
      'location.cancel': 'Annuler', 'location.confirm': 'Confirmer',
      'location.selectCountry': 'Choisir un pays', 'location.selectCity': 'Choisir une ville',
      'location.selectCountryFirst': 'Choisir d\'abord un pays', 'location.noCities': 'Aucune ville disponible',
      'home.localDomain': 'Réseau local : http://open-meteo.local:3000',
      'dashboard.airQuality': 'Qualité de l\'air', 'dashboard.tempMax': 'Température max. (24h)', 'dashboard.tempMin': 'Température min. (24h)',
      'dashboard.precip': 'Probabilité de précipitation', 'dashboard.humidity': 'Humidité', 'dashboard.wind': 'Vitesse du vent',
      'dashboard.temp': 'Température', 'dashboard.citiesTable': 'Villes - Température maximale',
      'dashboard.citiesTableCity': 'Ville', 'dashboard.citiesTableMaxTemp': 'Max', 'dashboard.citiesTableMinTemp': 'Min',
      'dashboard.domain': 'Modèle :',
      'home.precipitation': 'Précipitations :', 'home.humidity': 'Humidité :', 'home.wind': 'Vent :', 'home.feelsLike': 'Ressenti :',
      'header.geoTitle': 'Choisir la localisation', 'header.settingsTitle': 'Paramètres',
      'lang.en': 'Anglais', 'lang.fr': 'Français', 'lang.es': 'Espagnol', 'lang.ar': 'Arabe',
      'nav.climatology': 'Climatologie',
      'climatology.title': 'Climatologie', 'climatology.subtitle': 'Consulter les données météo passées pour une date et heure choisies',
      'climatology.date': 'Date', 'climatology.hour': 'Heure', 'climatology.fetch': 'Charger',
      'climatology.loading': 'Chargement...', 'climatology.error': 'Impossible de charger les données de climatologie.', 'climatology.hourlyTrend': 'Tendance horaire de température', 'climatology.pressure': 'Pression', 'climatology.cloudCover': 'Couverture nuageuse', 'climatology.uvIndex': 'Indice UV',
      'map.title': 'Carte Météo', 'map.subtitle': 'Visualisation interactive des observations et prévisions météorologiques.',
      'map.searchPlaceholder': 'Rechercher une ville, un pays ou des coordonnées...',
      'map.currentLocation': 'Emplacement actuel', 'map.refreshData': 'Actualiser les données', 'map.exportMap': 'Exporter la carte',
      'map.layers': 'Couches', 'map.forecast': 'Prévision', 'map.animation': 'Animation',
      'map.play': 'Play', 'map.pause': 'Pause', 'map.nextFrame': 'Image suivante', 'map.prevFrame': 'Image précédente',
      'map.speed': 'Vitesse :', 'map.forecastCurrent': 'Actuel', 'map.forecast24h': '24h', 'map.forecast3d': '3j', 'map.forecast7d': '7j',
      'map.forecasts': 'Prévisions',
      'map.dataImport': 'Import de données', 'map.observations': 'Observations', 'map.statistics': 'Statistiques',
      'map.historical': 'Données historiques', 'map.reports': 'Rapports', 'map.settings': 'Paramètres',
      'map.legend': 'Légende', 'map.legendTemperature': 'Température', 'map.legendRain': 'Pluie', 'map.legendWind': 'Vent', 'map.prevHour': 'Heure précédente', 'map.playAnimation': 'Lire l\'animation', 'map.stopAnimation': 'Arrêter', 'map.temperature': 'Température', 'map.feelsLike': 'Ressentie', 'map.visibility': 'Visibilité', 'map.rainProb': 'Probabilité de pluie', 'map.moonPhase': 'Lune', 'map.satellite': 'Satellite', 'map.radar': 'Radar', 'map.heatIndex': 'Indice de chaleur',
    },
    es: {
      'nav.home': 'Inicio', 'nav.dashboard': 'Panel', 'nav.forecast': 'Pronóstico', 'nav.map': 'Mapa Meteorológico', 'nav.dataImport': 'Importar datos', 'nav.observations': 'Observaciones', 'nav.forecasts': 'Pronósticos', 'nav.statistics': 'Estadísticas', 'nav.historical': 'Datos históricos', 'nav.reports': 'Reportes', 'nav.settings': 'Ajustes',
      'forecast.today': 'Hoy',
      'forecast.tomorrow': 'Mañana',
      'settings.title': 'Ajustes', 'settings.appearance': 'Apariencia', 'settings.theme': 'Tema',
      'settings.units': 'Unidades', 'settings.temperature': 'Temperatura', 'settings.windSpeed': 'Velocidad del viento',
      'settings.language': 'Idioma', 'settings.uiLanguage': 'Idioma de la interfaz',
      'settings.cancel': 'Cancelar', 'settings.confirm': 'Confirmar',
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
      'dashboard.temp': 'Temperatura', 'dashboard.citiesTable': 'Ciudades - Temperatura máxima',
      'dashboard.citiesTableCity': 'Ciudad', 'dashboard.citiesTableMaxTemp': 'Máx.', 'dashboard.citiesTableMinTemp': 'Mín.',
      'dashboard.domain': 'Modelo:',
      'home.precipitation': 'Precipitación:', 'home.humidity': 'Humedad:', 'home.wind': 'Viento:', 'home.feelsLike': 'Sensación térmica:',
      'header.geoTitle': 'Elegir ubicación', 'header.settingsTitle': 'Ajustes',
      'lang.en': 'Inglés', 'lang.fr': 'Francés', 'lang.es': 'Español', 'lang.ar': 'Árabe',
      'nav.climatology': 'Climatología',
      'climatology.title': 'Climatología', 'climatology.subtitle': 'Ver datos meteorológicos pasados para una fecha y hora elegidas',
      'climatology.date': 'Fecha', 'climatology.hour': 'Hora', 'climatology.fetch': 'Cargar',
      'climatology.loading': 'Cargando...', 'climatology.error': 'No se pudieron cargar los datos de climatología.', 'climatology.hourlyTrend': 'Tendencia horaria de temperatura', 'climatology.pressure': 'Presión', 'climatology.cloudCover': 'Cobertura de nubes', 'climatology.uvIndex': 'Índice UV',
      'map.title': 'Mapa Meteorológico', 'map.subtitle': 'Visualización interactiva de observaciones y pronósticos meteorológicos.',
      'map.searchPlaceholder': 'Buscar ciudad, país o coordenadas...',
      'map.currentLocation': 'Ubicación actual', 'map.refreshData': 'Actualizar datos', 'map.exportMap': 'Exportar mapa',
      'map.layers': 'Capas', 'map.forecast': 'Pronóstico', 'map.animation': 'Animación',
      'map.play': 'Reproducir', 'map.pause': 'Pausar', 'map.nextFrame': 'Siguiente', 'map.prevFrame': 'Anterior',
      'map.speed': 'Velocidad :', 'map.forecastCurrent': 'Actual', 'map.forecast24h': '24h', 'map.forecast3d': '3d', 'map.forecast7d': '7d',
      'map.forecasts': 'Pronósticos', 'map.dataImport': 'Importar datos', 'map.observations': 'Observaciones', 'map.statistics': 'Estadísticas',
      'map.historical': 'Datos históricos', 'map.reports': 'Reportes', 'map.settings': 'Ajustes',
'map.legend': 'Leyenda', 'map.legendTemperature': 'Temperatura', 'map.legendRain': 'Lluvia', 'map.legendWind': 'Viento', 'map.prevHour': 'Hora anterior', 'map.playAnimation': 'Reproducir animación', 'map.stopAnimation': 'Detener', 'map.temperature': 'Temperatura', 'map.feelsLike': 'Sensación térmica', 'map.visibility': 'Visibilidad', 'map.rainProb': 'Probabilidad de lluvia', 'map.moonPhase': 'Fase lunar', 'map.satellite': 'Satélite', 'map.radar': 'Radar', 'map.heatIndex': 'Índice de calor',
    },
  ar: {
      'nav.home': 'الرئيسية', 'nav.dashboard': 'لوحة التحكم', 'nav.forecast': 'التوقعات', 'nav.map': 'خريطة الطقس', 'nav.dataImport': 'استيراد البيانات', 'nav.observations': 'الملاحظات الطقسية', 'nav.forecasts': 'التوقعات', 'nav.statistics': 'الإحصائيات', 'nav.historical': 'البيانات التاريخية', 'nav.reports': 'تقارير', 'nav.settings': 'الإعدادات',
      'forecast.today': 'اليوم',
      'forecast.tomorrow': 'غداً',
      'settings.title': 'الإعدادات', 'settings.appearance': 'المظهر', 'settings.theme': 'السمة',
      'settings.units': 'الوحدات', 'settings.temperature': 'درجة الحرارة', 'settings.windSpeed': 'سرعة الرياح',
      'settings.language': 'اللغة', 'settings.uiLanguage': 'لغة الواجهة',
      'settings.cancel': 'إلغاء', 'settings.confirm': 'تأكيد',
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
      'dashboard.temp': 'درجة الحرارة', 'dashboard.citiesTable': 'المدن - أقصى درجة حرارة',
      'dashboard.citiesTableCity': 'المدينة', 'dashboard.citiesTableMaxTemp': 'أقصى', 'dashboard.citiesTableMinTemp': 'أدنى',
      'dashboard.domain': 'النموذج:',
      'home.precipitation': 'الهطول:', 'home.humidity': 'الرطوبة:', 'home.wind': 'الرياح:', 'home.feelsLike': 'الإحساس:',
      'header.geoTitle': 'اختر الموقع', 'header.settingsTitle': 'الإعدادات',
      'lang.en': 'الإنجليزية', 'lang.fr': 'الفرنسية', 'lang.es': 'الإسبانية', 'lang.ar': 'العربية',
      'nav.climatology': 'المناخ',
      'climatology.title': 'المناخ', 'climatology.subtitle': 'عرض بيانات الطقس السابقة لتاريخ ووقت محددين',
      'climatology.date': 'التاريخ', 'climatology.hour': 'الساعة', 'climatology.fetch': 'تحميل',
      'climatology.loading': 'جاري التحميل...', 'climatology.error': 'تعذر تحميل بيانات المناخ.', 'climatology.hourlyTrend': 'الاتجاه الحراري لدرجة الحرارة', 'climatology.pressure': 'الضغط', 'climatology.cloudCover': 'تغطية السحب', 'climatology.uvIndex': 'مؤشر الأشعة فوق البنفسجية',
      'map.title': 'خريطة الطقس', 'map.subtitle': 'تصور تفاعلي للملاحظات والتوقعات الطقسية.',
      'map.searchPlaceholder': 'ابحث عن مدينة أو دولة أو إحداثيات...',
      'map.currentLocation': 'الموقع الحالي', 'map.refreshData': 'تحديث البيانات', 'map.exportMap': 'تصدير الخريطة',
      'map.layers': 'الطبقات', 'map.forecast': 'التوقعات', 'map.animation': 'التحريك',
      'map.play': 'تشغيل', 'map.pause': 'توقف', 'map.nextFrame': 'الإطار التالي', 'map.prevFrame': 'الإطار السابق',
      'map.speed': 'السرعة :', 'map.forecastCurrent': 'حالي', 'map.forecast24h': '24 ساعة', 'map.forecast3d': '3 أيام', 'map.forecast7d': '7 أيام',
      'map.forecasts': 'التوقعات', 'map.dataImport': 'استيراد البيانات', 'map.observations': 'الملاحظات', 'map.statistics': 'الإحصائيات',
      'map.historical': 'البيانات التاريخية', 'map.reports': 'تقارير', 'map.settings': 'الإعدادات',
      'map.legend': 'الوسيلة', 'map.legendTemperature': 'درجة الحرارة', 'map.legendRain': 'المطربل', 'map.legendWind': 'الرياح', 'map.prevHour': 'الساعة السابقة', 'map.playAnimation': 'تشغيل الرسالة المتحركة', 'map.stopAnimation': 'إيقاف', 'map.temperature': 'درجة الحرارة', 'map.feelsLike': 'مثل ذلك', 'map.visibility': 'الرؤية', 'map.rainProb': 'احتمال الهطول', 'map.moonPhase': 'مرحلة القمر', 'map.satellite': 'القمر الصناعي', 'map.radar': 'رادار', 'map.heatIndex': 'مؤشر الحرارة',
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
