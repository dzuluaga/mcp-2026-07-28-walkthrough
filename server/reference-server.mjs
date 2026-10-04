#!/usr/bin/env node
// MCP 2026-07-28 reference server for the walkthrough's test commands.
// A teaching aid, not a production server: in-memory state, demo auth, no dependencies.
//
//   node reference-server.mjs            # Streamable HTTP on http://localhost:3000/mcp
//   node reference-server.mjs --stdio    # newline-delimited JSON-RPC on stdin/stdout
//   PORT=4000 node reference-server.mjs
//
// Demo auth: "Authorization: Bearer <name>" makes <name> the caller (e.g. alice, bob).
// No header means the caller is "anonymous".

import http from 'node:http';
import crypto from 'node:crypto';
import readline from 'node:readline';

const VERSION = '2026-07-28';
const SERVER_INFO = { name: 'walkthrough-reference-server', version: '1.0.0' };
const SECRET = crypto.randomBytes(32);            // signs requestState; rotates on restart
const STDIO = process.argv.includes('--stdio');
const log = (...a) => process.stderr.write('[ref] ' + a.join(' ') + '\n');

/* ---------------- errors ---------------- */
class RpcError extends Error {
  constructor(code, message, data, http = 400) { super(message); this.code = code; this.data = data; this.http = http; }
}
const E = {
  parse: () => new RpcError(-32700, 'Parse error'),
  invalid: (m, d) => new RpcError(-32602, m, d),
  method: m => new RpcError(-32601, 'Method not found: ' + m, undefined, 404),
  header: m => new RpcError(-32020, 'Header mismatch: ' + m),
  capability: caps => new RpcError(-32021, 'Missing required client capability', { requiredCapabilities: caps }),
  version: v => new RpcError(-32022, 'Unsupported protocol version', { supported: [VERSION], requested: v }),
};

/* ---------------- tools ---------------- */
let betaTool = false;
const TOOLS = () => [
  { name: 'add_to_cart', description: 'Add an item to a cart you own.', inputSchema: { type: 'object', properties: { cartId: { type: 'string' }, sku: { type: 'string' } }, required: ['cartId', 'sku'] } },
  ...(betaTool ? [{ name: 'beta_search', description: 'A tool that appears and disappears (see toggle_beta_tool).', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } }] : []),
  { name: 'build_report', description: 'Slow (10 s). Streams progress and logs; becomes a Task if you opt in to the tasks extension.', inputSchema: { type: 'object', properties: { month: { type: 'string' } }, required: ['month'] } },
  { name: 'create_cart', description: 'Create a cart and return its handle.', inputSchema: { type: 'object', properties: {} } },
  { name: 'create_repo', description: 'Needs your GitHub username: demonstrates Multi Round-Trip Requests.', inputSchema: { type: 'object', properties: { repo: { type: 'string' } }, required: ['repo'] } },
  { name: 'execute_sql', description: 'Pretend SQL. region is mirrored into the Mcp-Param-Region header.', inputSchema: { type: 'object', properties: { region: { type: 'string', 'x-mcp-header': 'Region' }, query: { type: 'string' } }, required: ['region', 'query'] } },
  { name: 'get_weather', description: 'Made-up weather.', inputSchema: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] } },
  { name: 'toggle_beta_tool', description: 'Adds or removes beta_search and notifies toolsListChanged listeners.', inputSchema: { type: 'object', properties: {} } },
  { name: 'touch_config', description: 'Pretends file:///project/config.json changed and notifies its subscribers.', inputSchema: { type: 'object', properties: {} } },
].sort((a, b) => a.name.localeCompare(b.name));   // deterministic order

const carts = new Map();     // cartId -> { owner, items }   (a real server would use a shared database)
const tasks = new Map();     // taskId -> task
const listeners = new Set(); // { filter, send }

const text = t => ({ content: [{ type: 'text', text: t }] });
const complete = r => ({ resultType: 'complete', ...r });

/* requestState: HMAC-signed, bound to principal, expiry and the originating request */
const digest = (method, params) => crypto.createHash('sha256').update(method + JSON.stringify({ name: params.name, arguments: params.arguments })).digest('base64url');
function sealState(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function openState(s, ctx, method, params) {
  const [body, mac] = String(s).split('.');
  const want = crypto.createHmac('sha256', SECRET).update(body || '').digest('base64url');
  if (!mac || mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) throw E.invalid('requestState failed verification (tampered or from another server instance)');
  const st = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (st.p !== ctx.principal) throw E.invalid('requestState belongs to a different user');
  if (Date.now() > st.exp) throw E.invalid('requestState expired');
  if (st.d !== digest(method, params)) throw E.invalid('requestState was issued for a different request');
  return st;
}

async function callTool(params, ctx) {
  const a = params.arguments || {};
  switch (params.name) {
    case 'get_weather': return complete(text((a.location || 'Somewhere') + ': 14°C, light rain'));
    case 'create_cart': {
      const cartId = 'cart_' + crypto.randomBytes(9).toString('base64url');
      carts.set(cartId, { owner: ctx.principal, items: [] });
      return complete({ ...text('Cart created'), structuredContent: { cartId } });
    }
    case 'add_to_cart': {
      const cart = carts.get(a.cartId);
      if (!cart || cart.owner !== ctx.principal) return complete({ ...text('Unknown cart'), isError: true }); // same answer either way: don't confirm the handle exists
      cart.items.push(a.sku);
      return complete({ ...text('Added ' + a.sku), structuredContent: { cartId: a.cartId, items: cart.items } });
    }
    case 'create_repo': {
      const answer = params.inputResponses?.github_login;
      if (params.requestState !== undefined) openState(params.requestState, ctx, 'tools/call', params);
      if (answer?.action === 'accept' && answer.content?.name && params.requestState !== undefined)
        return complete(text('Created github.com/' + answer.content.name + '/' + (a.repo || 'demo')));
      if (!ctx.caps.elicitation) throw E.capability(['elicitation']);
      return {
        resultType: 'input_required',
        inputRequests: { github_login: { method: 'elicitation/create', params: { mode: 'form', message: 'Please provide your GitHub username', requestedSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } } },
        requestState: sealState({ p: ctx.principal, exp: Date.now() + 10 * 60_000, d: digest('tools/call', params) }),
      };
    }
    case 'execute_sql': return complete({ ...text('3 rows from ' + a.region), structuredContent: { region: a.region, rows: [[1], [2], [3]] } });
    case 'toggle_beta_tool':
      betaTool = !betaTool;
      notify('toolsListChanged', { method: 'notifications/tools/list_changed', params: {} });
      return complete(text('beta_search is now ' + (betaTool ? 'listed' : 'hidden')));
    case 'touch_config':
      notify('resource:file:///project/config.json', { method: 'notifications/resources/updated', params: { uri: 'file:///project/config.json' } });
      return complete(text('config.json "changed"'));
    case 'build_report':
      if (ctx.caps.extensions?.['io.modelcontextprotocol/tasks']) return startTask(a, ctx);
      return buildReport(a, ctx);
    case 'beta_search':
      if (betaTool) return complete(text('No results for ' + (a.q || '')));
  }
  throw E.invalid('Unknown tool: ' + params.name);
}

async function buildReport(a, ctx) {
  for (let step = 1; step <= 10; step++) {
    await new Promise(r => setTimeout(r, 1000));
    if (ctx.signal.aborted) { log('build_report cancelled at step', step, '(stream closed)'); throw new Error('cancelled'); }
    if (ctx.progressToken !== undefined) ctx.notify({ method: 'notifications/progress', params: { progressToken: ctx.progressToken, progress: step, total: 10 } });
    if (ctx.logLevel) ctx.notify({ method: 'notifications/message', params: { level: 'debug', logger: 'report', data: 'step ' + step + ': fetched ' + step * 12 + ' rows' } });
  }
  return complete(text('Report for ' + (a.month || 'this month') + ': 120 rows'));
}

/* ---------------- tasks extension ---------------- */
function taskView(t) {
  const v = { taskId: t.taskId, status: t.status, createdAt: t.createdAt, lastUpdatedAt: t.lastUpdatedAt, ttlMs: 3600000, pollIntervalMs: 2000 };
  if (t.status === 'input_required') v.inputRequests = t.inputRequests;
  if (t.status === 'completed') v.result = t.result;
  return v;
}
function startTask(a, ctx) {
  const now = new Date().toISOString();
  const t = { taskId: 'task_' + crypto.randomBytes(6).toString('hex'), owner: ctx.principal, status: 'working', createdAt: now, lastUpdatedAt: now, step: 0 };
  tasks.set(t.taskId, t);
  const tick = () => {
    if (t.status !== 'working') return;
    t.step++; t.lastUpdatedAt = new Date().toISOString();
    if (t.step === 5 && ctx.caps.elicitation && !t.asked) {
      t.asked = true; t.status = 'input_required';
      t.inputRequests = { charts: { method: 'elicitation/create', params: { mode: 'form', message: 'Include charts in the report?', requestedSchema: { type: 'object', properties: { charts: { type: 'boolean' } }, required: ['charts'] } } } };
      return;
    }
    if (t.step >= 10) { t.status = 'completed'; t.result = complete(text('Report for ' + (a.month || 'this month') + (t.charts ? ' with charts' : '') + ': 120 rows')); return; }
    setTimeout(tick, 1500);
  };
  t.resume = () => setTimeout(tick, 1500);
  setTimeout(tick, 1500);
  return { resultType: 'task', ...taskView(t) };
}
function ownTask(params, ctx) {
  const t = tasks.get(params.taskId);
  if (!t || t.owner !== ctx.principal) throw E.invalid('Unknown task');
  return t;
}

/* ---------------- subscriptions ---------------- */
function notify(kind, msg) {
  for (const l of listeners) if (l.kinds.has(kind)) l.send(msg);
}

/* ---------------- dispatch ---------------- */
const NEEDS_NAME = { 'tools/call': 'name', 'resources/read': 'uri', 'prompts/get': 'name' };

async function dispatch(msg, ctx) {
  const params = msg.params || {};
  const meta = params._meta || {};
  // per-request metadata (no handshake, no stored state)
  if (!meta['io.modelcontextprotocol/protocolVersion'] || typeof meta['io.modelcontextprotocol/clientCapabilities'] !== 'object')
    throw E.invalid('Missing required _meta fields (io.modelcontextprotocol/protocolVersion and io.modelcontextprotocol/clientCapabilities). This server speaks ' + VERSION + ' only; initialize is not supported.');
  if (meta['io.modelcontextprotocol/protocolVersion'] !== VERSION) throw E.version(meta['io.modelcontextprotocol/protocolVersion']);
  ctx.caps = meta['io.modelcontextprotocol/clientCapabilities'];
  ctx.logLevel = meta['io.modelcontextprotocol/logLevel'];
  ctx.progressToken = meta.progressToken;
  if (ctx.validateHeaders) ctx.validateHeaders(msg, params);

  switch (msg.method) {
    case 'server/discover':
      return complete({ supportedVersions: [VERSION], capabilities: { tools: { listChanged: true }, resources: { subscribe: true }, logging: {}, extensions: { 'io.modelcontextprotocol/tasks': {} } },
        instructions: 'A teaching server for the MCP 2026-07-28 walkthrough. See tools/list.', ttlMs: 3600000, cacheScope: 'public' });
    case 'tools/list': return complete({ tools: TOOLS(), ttlMs: 300000, cacheScope: 'public' });
    case 'tools/call': return callTool(params, ctx);
    case 'resources/list': return complete({ resources: [{ uri: 'app://me/settings', name: 'Your settings' }, { uri: 'file:///project/config.json', name: 'Project config' }], ttlMs: 300000, cacheScope: 'public' });
    case 'resources/read':
      if (params.uri === 'app://me/settings') return complete({ contents: [{ uri: params.uri, mimeType: 'application/json', text: JSON.stringify({ user: ctx.principal, theme: 'dark' }) }], ttlMs: 60000, cacheScope: 'private' });
      if (params.uri === 'file:///project/config.json') return complete({ contents: [{ uri: params.uri, mimeType: 'application/json', text: '{"debug":false}' }], ttlMs: 60000, cacheScope: 'public' });
      throw E.invalid('Resource not found', { uri: params.uri });
    case 'tasks/get': return complete(taskView(ownTask(params, ctx)));
    case 'tasks/update': {
      const t = ownTask(params, ctx);
      const r = params.inputResponses?.charts;
      if (t.status === 'input_required' && r) { t.charts = r.action === 'accept' && r.content?.charts === true; t.status = 'working'; delete t.inputRequests; t.resume(); }
      return complete({});
    }
    case 'tasks/cancel': { const t = ownTask(params, ctx); if (!['completed', 'failed'].includes(t.status)) t.status = 'cancelled'; return complete({}); }
    case 'subscriptions/listen': return ctx.listen(msg, params);
  }
  throw E.method(msg.method);
}

const withInfo = r => ({ ...r, _meta: { ...(r._meta || {}), 'io.modelcontextprotocol/serverInfo': SERVER_INFO } });
const errBody = (id, e) => ({ jsonrpc: '2.0', id: id ?? null, error: { code: e.code ?? -32603, message: e.message, ...(e.data !== undefined ? { data: e.data } : {}) } });

/* ---------------- Streamable HTTP ---------------- */
function decodeHeader(v) {
  const m = /^=\?base64\?(.*)\?=$/.exec(v || '');
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : v;
}
function headerValidator(req) {
  return (msg, params) => {
    const h = req.headers;
    if (!h['mcp-protocol-version']) throw E.header('MCP-Protocol-Version header is missing');
    if (h['mcp-protocol-version'] !== params._meta['io.modelcontextprotocol/protocolVersion']) throw E.header('MCP-Protocol-Version header does not match _meta');
    if (h['mcp-method'] === undefined) throw E.header('Mcp-Method header is missing');
    if (h['mcp-method'] !== msg.method) throw E.header("Mcp-Method header value '" + h['mcp-method'] + "' does not match body value '" + msg.method + "'");
    const field = NEEDS_NAME[msg.method];
    if (field) {
      if (h['mcp-name'] === undefined) throw E.header('Mcp-Name header is missing');
      if (decodeHeader(h['mcp-name']) !== params[field]) throw E.header("Mcp-Name header value '" + decodeHeader(h['mcp-name']) + "' does not match body value '" + params[field] + "'");
    }
    if (msg.method === 'tools/call') {
      const tool = TOOLS().find(t => t.name === params.name);
      for (const [prop, sch] of Object.entries(tool?.inputSchema?.properties || {})) {
        const name = sch['x-mcp-header']; if (!name) continue;
        const val = (params.arguments || {})[prop], hv = h['mcp-param-' + name.toLowerCase()];
        if (val === undefined || val === null) continue;
        if (hv === undefined) throw E.header('Mcp-Param-' + name + ' header is missing');
        if (decodeHeader(hv) !== String(val)) throw E.header('Mcp-Param-' + name + ' header does not match body');
      }
    }
  };
}

function serveHttp() {
  const port = +(process.env.PORT || 3000);
  http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { res.writeHead(403).end(); return; }
    if (req.url.split('?')[0] === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
    if (req.url.split('?')[0] !== '/mcp') { res.writeHead(404).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }   // GET/DELETE belonged to sessions
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', async () => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return sendJson(res, 400, errBody(null, E.parse())); }
      if (msg.id === undefined) { res.writeHead(202).end(); return; }               // notifications: accepted, nothing to do
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });               // closing the stream IS the cancellation
      let sse = false;
      const startSse = () => { if (!sse) { sse = true; res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' }); } };
      const ctx = {
        principal: (/^Bearer\s+(\S+)/i.exec(req.headers.authorization || '') || [])[1] || 'anonymous',
        signal: ac.signal, validateHeaders: headerValidator(req),
        notify: m => { startSse(); res.write('data: ' + JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n\n'); },
        listen: (m, p) => new Promise(() => {
          const f = p.notifications || {}, kinds = new Set(), ack = {};
          if (f.toolsListChanged) { kinds.add('toolsListChanged'); ack.toolsListChanged = true; }
          if (Array.isArray(f.resourceSubscriptions)) { f.resourceSubscriptions.forEach(u => kinds.add('resource:' + u)); ack.resourceSubscriptions = f.resourceSubscriptions; }
          const tag = n => ({ ...n, params: { ...n.params, _meta: { 'io.modelcontextprotocol/subscriptionId': m.id } } });
          const l = { kinds, send: n => ctx.notify(tag(n)) };
          ctx.notify(tag({ method: 'notifications/subscriptions/acknowledged', params: { notifications: ack } }));
          listeners.add(l);
          const ka = setInterval(() => res.write(':\n\n'), 15000);
          ac.signal.addEventListener('abort', () => { listeners.delete(l); clearInterval(ka); log('subscription', m.id, 'closed'); });
        }),
      };
      try {
        const result = withInfo(await dispatch(msg, ctx));
        const body = { jsonrpc: '2.0', id: msg.id, result };
        if (sse) { res.end('data: ' + JSON.stringify(body) + '\n\n'); } else sendJson(res, 200, body);
      } catch (e) {
        if (ac.signal.aborted) return;
        if (!(e instanceof RpcError)) { log('error', e.stack || e); e = new RpcError(-32603, 'Internal error', undefined, 500); }
        if (sse) res.end('data: ' + JSON.stringify(errBody(msg.id, e)) + '\n\n'); else sendJson(res, e.http, errBody(msg.id, e));
      }
    });
  }).listen(port, '127.0.0.1', () => log(`MCP ${VERSION} reference server on http://localhost:${port}/mcp  (GET /healthz for health checks)`));
}
function sendJson(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); }

/* ---------------- stdio ---------------- */
function serveStdio() {
  const out = m => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
  const inflight = new Map();
  readline.createInterface({ input: process.stdin }).on('line', async line => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { return out(errBody(null, E.parse())); }
    if (msg.id === undefined) {                                                    // on stdio, cancellation is a notification
      if (msg.method === 'notifications/cancelled') inflight.get(msg.params?.requestId)?.abort();
      return;
    }
    const ac = new AbortController(); inflight.set(msg.id, ac);
    const ctx = {
      principal: process.env.MCP_USER || 'local', signal: ac.signal, notify: out,
      listen: (m, p) => new Promise(() => {
        const f = p.notifications || {}, kinds = new Set(), ack = {};
        if (f.toolsListChanged) { kinds.add('toolsListChanged'); ack.toolsListChanged = true; }
        if (Array.isArray(f.resourceSubscriptions)) { f.resourceSubscriptions.forEach(u => kinds.add('resource:' + u)); ack.resourceSubscriptions = f.resourceSubscriptions; }
        const tag = n => ({ ...n, params: { ...n.params, _meta: { 'io.modelcontextprotocol/subscriptionId': m.id } } });
        const l = { kinds, send: n => out(tag(n)) };
        out(tag({ method: 'notifications/subscriptions/acknowledged', params: { notifications: ack } }));
        listeners.add(l);
        ac.signal.addEventListener('abort', () => listeners.delete(l));
      }),
    };
    try { out({ id: msg.id, result: withInfo(await dispatch(msg, ctx)) }); }
    catch (e) { if (!ac.signal.aborted) out(errBody(msg.id, e instanceof RpcError ? e : new RpcError(-32603, 'Internal error'))); }
    finally { inflight.delete(msg.id); }
  });
  log(`MCP ${VERSION} reference server on stdio`);
}

STDIO ? serveStdio() : serveHttp();
