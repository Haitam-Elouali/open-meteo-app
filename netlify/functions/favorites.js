// In-memory favorites (ephemeral per function instance), matching the
// original server.js behavior.
let favorites = [];

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return json(200, { favorites });
  }
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      favorites = Array.isArray(body?.favorites) ? body.favorites : [];
      return json(200, { ok: true, favorites });
    } catch (e) {
      return json(500, { error: String(e?.message || e) });
    }
  }
  return json(405, { error: 'Method not allowed' });
};
