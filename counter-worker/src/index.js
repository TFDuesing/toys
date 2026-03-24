import { DurableObject } from 'cloudflare:workers';

// ─── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://toys.tfduesing.net',
  'https://tfduesing.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 10;       // max increments per window
const RATE_LIMIT_WINDOW_MS = 1000; // 1-second sliding window

// ─── Counter Durable Object ────────────────────────────────────────────────────
export class Counter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.initialized = false;
    this.rateLimitMap = new Map(); // ip -> [timestamps]
  }

  isRateLimited(ip) {
    const now = Date.now();
    const key = ip || 'unknown';
    let timestamps = this.rateLimitMap.get(key);
    if (!timestamps) {
      timestamps = [];
      this.rateLimitMap.set(key, timestamps);
    }
    // Prune old entries
    while (timestamps.length > 0 && timestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
      timestamps.shift();
    }
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return true;
    }
    timestamps.push(now);
    return false;
  }

  async initialize() {
    if (this.initialized) return;
    // Create table in DO's built-in SQLite if it doesn't exist
    this.ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL DEFAULT 0)'
    );
    // Seed from D1 on first ever access
    const rows = this.ctx.storage.sql.exec('SELECT value FROM counter WHERE id = 1').toArray();
    if (rows.length === 0) {
      const d1Row = await this.env.DB.prepare('SELECT value FROM counter WHERE id = 1').first();
      const initial = d1Row?.value ?? 0;
      this.ctx.storage.sql.exec('INSERT INTO counter (id, value) VALUES (1, ?)', initial);
    }
    this.initialized = true;
  }

  getCount() {
    return this.ctx.storage.sql.exec('SELECT value FROM counter WHERE id = 1').one().value;
  }

  async incrementAndBroadcast() {
    const row = this.ctx.storage.sql.exec(
      'UPDATE counter SET value = value + 1 WHERE id = 1 RETURNING value'
    ).one();
    const count = row.value;

    // Broadcast to all connected WebSockets
    const msg = JSON.stringify({ count });
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch {}
    }

    // Sync back to D1 in the background (best-effort)
    this.ctx.waitUntil(
      this.env.DB.prepare('UPDATE counter SET value = ? WHERE id = 1').bind(count).run()
    );

    return count;
  }

  async fetch(request) {
    await this.initialize();

    // WebSocket upgrade
    const upgrade = request.headers.get('Upgrade');
    if (upgrade === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      this.ctx.acceptWebSocket(server, [ip]);
      // Send current count immediately on connect
      server.send(JSON.stringify({ count: this.getCount() }));
      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP GET — return current count
    if (request.method === 'GET') {
      return json({ count: this.getCount() });
    }

    // HTTP POST — increment
    if (request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP');
      if (this.isRateLimited(ip)) {
        return json({ error: 'Rate limit exceeded' }, 429);
      }
      const count = await this.incrementAndBroadcast();
      return json({ count });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }

  // ─── Hibernation handlers ──────────────────────────────────────────────────
  async webSocketMessage(ws, message) {
    await this.initialize();
    if (message === 'increment') {
      const tags = this.ctx.getTags(ws);
      const ip = tags[0] || 'unknown';
      if (this.isRateLimited(ip)) {
        ws.send(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
      }
      await this.incrementAndBroadcast();
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    ws.close(1011, 'WebSocket error');
  }
}

// ─── Worker fetch handler ──────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Route everything to the singleton Counter DO
    const id = env.COUNTER.idFromName('global');
    const stub = env.COUNTER.get(id);
    const response = await stub.fetch(request);

    // Add CORS headers to DO responses (except WebSocket upgrades)
    if (response.status === 101) return response;

    const newResponse = new Response(response.body, response);
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      newResponse.headers.set(key, value);
    }
    return newResponse;
  },
};
