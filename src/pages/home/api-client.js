// Small client wrapper to call our backend (avoids exposing API keys in browser).

async function getWeather({ lat, lon }) {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const res = await fetch(`/api/weather?${qs.toString()}`);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return res.json();
}

async function reverseGeocode({ lat, lon }) {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const res = await fetch(`/api/reverse?${qs.toString()}`);
  if (!res.ok) throw new Error(`Reverse request failed: ${res.status}`);
  return res.json();
}

// weather-card.js expects these to exist on window
window.__apiClient = { getWeather, reverseGeocode };
