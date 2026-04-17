// ─── CORS ──────────────────────────────────────────────────────────────────────
// Snippets is deployed as its own Cloudflare Pages project. Add production
// origins to ALLOWED_ORIGINS and update PREVIEW_ORIGIN_PATTERN to the project's
// `*.pages.dev` subdomain after the first deploy.
const ALLOWED_ORIGINS = [
  'https://toys.tfduesing.net',
];

const PREVIEW_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.snippets-[a-z0-9]+\.pages\.dev$/;

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (PREVIEW_ORIGIN_PATTERN.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────
const MAX_NAME = 200;
const MAX_NOTES = 10_000;

function sanitizeName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NAME);
}

function sanitizeNotes(value) {
  if (typeof value !== 'string') return null;
  return value.slice(0, MAX_NOTES);
}

// ─── Routing ──────────────────────────────────────────────────────────────────
async function listClients(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, notes FROM clients ORDER BY sort_order ASC, id ASC'
  ).all();
  return results.map((r) => ({ id: String(r.id), name: r.name, notes: r.notes }));
}

async function createClient(env, body) {
  const name = sanitizeName(body?.name) ?? 'New Client';
  const notes = sanitizeNotes(body?.notes) ?? '';
  // New clients appear at the top of the list — pick a sort_order smaller than
  // any existing row.
  const minRow = await env.DB.prepare('SELECT MIN(sort_order) AS min FROM clients').first();
  const nextOrder = (minRow?.min ?? 0) - 10;
  const row = await env.DB.prepare(
    'INSERT INTO clients (name, notes, sort_order, updated_at) VALUES (?, ?, ?, unixepoch()) RETURNING id'
  ).bind(name, notes, nextOrder).first();
  return { id: String(row.id), name, notes };
}

async function updateClient(env, id, body) {
  const fields = [];
  const binds = [];
  const name = body?.name !== undefined ? sanitizeName(body.name) : undefined;
  const notes = body?.notes !== undefined ? sanitizeNotes(body.notes) : undefined;
  if (name !== undefined) {
    if (name === null) return { error: 'Invalid name', status: 400 };
    fields.push('name = ?');
    binds.push(name);
  }
  if (notes !== undefined) {
    if (notes === null) return { error: 'Invalid notes', status: 400 };
    fields.push('notes = ?');
    binds.push(notes);
  }
  if (fields.length === 0) return { error: 'No fields to update', status: 400 };
  fields.push('updated_at = unixepoch()');
  binds.push(id);
  const result = await env.DB.prepare(
    `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...binds).run();
  if (!result.meta?.changes) return { error: 'Not found', status: 404 };
  return { ok: true };
}

async function deleteClient(env, id) {
  const result = await env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
  if (!result.meta?.changes) return { error: 'Not found', status: 404 };
  return { ok: true };
}

// ─── Worker fetch handler ──────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: 'Forbidden origin' }, 403, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const match = path.match(/^\/clients(?:\/(\d+))?$/);

    if (!match) return json({ error: 'Not found' }, 404, origin);

    const id = match[1] ? Number(match[1]) : null;

    try {
      if (request.method === 'GET' && id === null) {
        return json({ clients: await listClients(env) }, 200, origin);
      }

      if (request.method === 'POST' && id === null) {
        const body = await request.json().catch(() => ({}));
        const client = await createClient(env, body);
        return json(client, 201, origin);
      }

      if (request.method === 'PATCH' && id !== null) {
        const body = await request.json().catch(() => ({}));
        const result = await updateClient(env, id, body);
        if (result.error) return json({ error: result.error }, result.status, origin);
        return json(result, 200, origin);
      }

      if (request.method === 'DELETE' && id !== null) {
        const result = await deleteClient(env, id);
        if (result.error) return json({ error: result.error }, result.status, origin);
        return json(result, 200, origin);
      }

      return json({ error: 'Method Not Allowed' }, 405, origin);
    } catch (err) {
      console.error('Request failed:', err.message);
      return json({ error: 'Internal error' }, 500, origin);
    }
  },
};
