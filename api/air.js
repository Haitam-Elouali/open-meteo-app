const { cachedFetchJson } = require('./helpers');

module.exports = async (req, res) => {
  const { lat, lon, domains } = req.query;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const dom = String(domains || 'auto').trim() || 'auto';
  const isEurope = dom === 'cams_europe' || dom === 'europe';

  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', la);
  url.searchParams.set('longitude', lo);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('domains', dom);
  [isEurope ? 'european_aqi' : 'us_aqi', 'pm2_5', 'pm10', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'dust'].forEach((f) => url.searchParams.append('current', f));

  try {
    const data = await cachedFetchJson(url.toString());
    res.json({ data, domains: dom });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
