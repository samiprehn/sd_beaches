// Cloudflare Worker — CORS-enabled proxy for NOAA NDBC buoy realtime data.
// Shared by sd_beaches, sd_dog_beaches, and daily (NOAA sends no CORS headers,
// so the browser can't read the response directly).
//
// Usage:  GET /?id=LJAC1
// Proxies to https://www.ndbc.noaa.gov/data/realtime2/{id}.txt and adds the
// Access-Control-Allow-Origin header browsers need.

const UPSTREAM = 'https://www.ndbc.noaa.gov/data/realtime2';
const ID_PATTERN = /^[A-Z0-9]+$/i;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...extraHeaders },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json(400, { error: 'Missing id parameter' });
    if (!ID_PATTERN.test(id)) return json(400, { error: 'Invalid id format' });

    try {
      const upstream = await fetch(`${UPSTREAM}/${id.toUpperCase()}.txt`, {
        headers: { 'User-Agent': 'noaa-buoy (https://github.com/samiprehn/sd_beaches)' },
      });

      const bodyText = await upstream.text();

      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=600',
          ...cors,
        },
      });
    } catch (e) {
      return json(502, { error: 'Upstream fetch failed', detail: String(e) });
    }
  },
};
