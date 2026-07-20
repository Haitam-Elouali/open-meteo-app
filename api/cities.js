const { CITIES_BY_COUNTRY } = require('../lib/cities-data');

module.exports = async (req, res) => {
  const country = String(req.query.country || '').trim();
  if (!country) {
    return res.status(400).json({ error: 'country is required' });
  }
  const cities = CITIES_BY_COUNTRY[country] || [];
  res.json({ country, cities });
};
