// Cross-device progress sync: a short code maps to one JSON progress blob in Upstash Redis.
// POST            -> create a code, store the body's state, return { code }
// GET  ?code=...  -> { state } or 404
// PUT  ?code=...  -> overwrite the stored state
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 400;                 // ~13 months, refreshed on every write
const MAX = 64 * 1024;
const ALPHA = '23456789abcdefghjkmnpqrstuvwxyz';
const CODE = /^mcpa-[a-z0-9]{4}-[a-z0-9]{4}$/;

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}
const newCode = () => 'mcpa-' + [4, 4].map(n => Array.from(crypto.randomBytes(n), b => ALPHA[b % ALPHA.length]).join('')).join('-');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let s = '';
  for await (const c of req) { s += c; if (s.length > MAX) throw Object.assign(new Error('too large'), { status: 413 }); }
  return JSON.parse(s || '{}');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, obj) => res.status(status).json(obj);
  if (!URL_ || !TOKEN) return send(503, { error: 'sync storage not configured' });
  try {
    const code = String((req.query && req.query.code) || '').toLowerCase();
    if (req.method === 'GET') {
      if (!CODE.test(code)) return send(400, { error: 'bad code' });
      const v = await redis(['GET', 'mcpa:' + code]);
      return v ? send(200, { state: JSON.parse(v) }) : send(404, { error: 'not found' });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body.state !== 'object' || body.state === null) return send(400, { error: 'state required' });
      const json = JSON.stringify(body.state);
      if (json.length > MAX) return send(413, { error: 'too large' });
      if (req.method === 'POST') {
        for (let i = 0; i < 5; i++) {
          const c = newCode();
          if (await redis(['SET', 'mcpa:' + c, json, 'EX', TTL, 'NX'])) return send(201, { code: c });
        }
        return send(500, { error: 'could not allocate a code' });
      }
      if (!CODE.test(code)) return send(400, { error: 'bad code' });
      await redis(['SET', 'mcpa:' + code, json, 'EX', TTL]);
      return send(200, { ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PUT');
    return send(405, { error: 'method not allowed' });
  } catch (e) {
    return send(e.status || (e instanceof SyntaxError ? 400 : 500), { error: e.message });
  }
};
