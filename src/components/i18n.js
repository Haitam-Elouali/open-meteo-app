// Shared i18n: applies translations to every element marked with
// `data-i18n` (textContent), `data-i18n-placeholder` (placeholder) or
// `data-i18n-title` (title). Runs on load and re-applies when the language
// is changed (the settings modal reloads the page, which re-applies here).
window.I18n = (function () {
  const DICT = {
    en: {
      'nav.home': 'Home', 'nav.dashboard': 'Dashboard',       'nav.forecast': 'Forecast',
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
      'dashboard.temp': 'Temperature', 'dashboard.citiesTable': "Cities - Yesterday's Maximum Temperature",
      'dashboard.citiesTableCity': 'City', 'dashboard.citiesTableMaxTemp': "Yesterday's Maximum",
      'dashboard.domain': 'Model:',
      'home.precipitation': 'Precipitation:', 'home.humidity': 'Humidity:', 'home.wind': 'Wind:',
      'header.geoTitle': 'Choose location', 'header.settingsTitle': 'Settings',
      'lang.en': 'English', 'lang.fr': 'Français', 'lang.es': 'Español', 'lang.ar': 'العربية'
    },
    fr: {
      'nav.home': 'Accueil', 'nav.dashboard': 'Tableau de bord',       'nav.forecast': 'Prévisions',
      'forecast.today': "Aujourd'hui",
      'forecast.tomorrow': 'Demain',
      'settings.title': 'Paramètres', 'settings.appearance': 'Apparence', 'settings.theme': 'Thème',
      'settings.units': 'Unités', 'settings.temperature': 'Température', 'settings.windSpeed': 'Vitesse du vent',
      'settings.language': 'Langue', 'settings.uiLanguage': 'Langue de l’interface',
      'settings.cancel': 'Annuler', 'settings.confirm': 'Confirmer',
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
      'dashboard.temp': 'Température', 'dashboard.citiesTable': 'Villes - Température maximale d\'hier',
      'dashboard.citiesTableCity': 'Ville', 'dashboard.citiesTableMaxTemp': 'Max. d\'hier',
      'dashboard.domain': 'Modèle :',
      'home.precipitation': 'Précipitations :', 'home.humidity': 'Humidité :', 'home.wind': 'Vent :',
      'header.geoTitle': 'Choisir la localisation', 'header.settingsTitle': 'Paramètres',
      'lang.en': 'Anglais', 'lang.fr': 'Français', 'lang.es': 'Espagnol', 'lang.ar': 'Arabe'
    },
    es: {
      'nav.home': 'Inicio', 'nav.dashboard': 'Panel',       'nav.forecast': 'Pronóstico',
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
      'dashboard.temp': 'Temperatura', 'dashboard.citiesTable': 'Ciudades - Temperatura máxima de ayer',
      'dashboard.citiesTableCity': 'Ciudad', 'dashboard.citiesTableMaxTemp': 'Máx. de ayer',
      'dashboard.domain': 'Modelo:',
      'home.precipitation': 'Precipitación:', 'home.humidity': 'Humedad:', 'home.wind': 'Viento:',
      'header.geoTitle': 'Elegir ubicación', 'header.settingsTitle': 'Ajustes',
      'lang.en': 'Inglés', 'lang.fr': 'Francés', 'lang.es': 'Español', 'lang.ar': 'Árabe'
    },
    ar: {
      'nav.home': 'الرئيسية', 'nav.dashboard': 'لوحة التحكم',       'nav.forecast': 'التوقعات',
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
      'dashboard.temp': 'درجة الحرارة', 'dashboard.citiesTable': 'المدن - أقصى حرارة أمس',
      'dashboard.citiesTableCity': 'المدينة', 'dashboard.citiesTableMaxTemp': 'أقصى حرارة أمس',
      'dashboard.domain': 'النموذج:',
      'home.precipitation': 'الهطول:', 'home.humidity': 'الرطوبة:', 'home.wind': 'الرياح:',
      'header.geoTitle': 'اختر الموقع', 'header.settingsTitle': 'الإعدادات',
      'lang.en': 'الإنجليزية', 'lang.fr': 'الفرنسية', 'lang.es': 'الإسبانية', 'lang.ar': 'العربية'
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
