const ALLOWED_ORIGINS = [
  'https://tfduesing.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT value FROM counter WHERE id = 1').first();
      return json({ count: row?.value ?? 0 }, 200, origin);
    }

    if (request.method === 'POST') {
      const row = await env.DB
        .prepare('UPDATE counter SET value = value + 1 WHERE id = 1 RETURNING value')
        .first();
      return json({ count: row.value }, 200, origin);
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
};
