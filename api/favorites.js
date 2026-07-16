// Note: Vercel serverless functions are ephemeral; favorites live only in
// memory for the lifetime of the lambda instance. This matches the original
// in-memory behavior of server.js.
let favorites = [];

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.json({ favorites });
  }
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      favorites = Array.isArray(body?.favorites) ? body.favorites : [];
      return res.json({ ok: true, favorites });
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
};
