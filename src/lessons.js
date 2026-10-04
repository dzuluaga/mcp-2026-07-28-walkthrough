
const S = 'https://modelcontextprotocol.io/specification/2026-07-28';

/* Every diff block uses a 2-character gutter on every line:
   "+ " added   "- " removed   "* " highlighted   "  " unchanged */
const LESSONS = [
{
  id: 'start', short: 'Start here', tag: 'orientation', tagLabel: 'Orientation', domain: 'All domains',
  title: 'From a phone call to letters',
  lede: 'Revision 2026-07-28 makes one decision, and almost every other change follows from it: each MCP request now has to stand on its own.',
  what: `
    <p><strong>Before (the "legacy" protocol, 2025-11-25 and earlier),</strong> talking to an MCP server was like a phone call. The client dialled, both sides introduced themselves with <code>initialize</code>, and the server remembered who was on the line. In the middle of a call, the server could interrupt and ask the client something.</p>
    <p><strong>Now (the "modern" protocol, 2026-07-28),</strong> it's like sending letters. Every request carries its own version, capabilities and identity in <code>_meta</code>. The server never sends requests of its own. Anything that must outlive one request is an explicit handle that the client passes back.</p>
    <p>The spec has three words for this, and the exam uses them: <strong>modern</strong> (per-request metadata), <strong>legacy</strong> (the <code>initialize</code> handshake) and <strong>dual-era</strong> (an implementation that supports both).</p>`,
  why: `<p>A phone call has to keep reaching the same machine. That means sticky sessions, shared session storage and reconnect logic. A letter can be opened by any machine in the pool. The spec now says it outright: <em>"all the information needed to process a request is contained in the request itself."</em></p>`,
  seq: {
    before: { actors: ['Client', 'Server'], alt: 'Legacy flow', steps: [
      { f: 0, t: 1, l: 'initialize', k: 'del' }, { f: 1, t: 0, l: 'InitializeResult', k: 'del', d: 1 },
      { f: 0, t: 1, l: 'notifications/initialized', k: 'del' },
      { f: 0, t: 1, l: 'tools/call' },
      { f: 1, t: 0, l: 'sampling/createMessage (server asks!)', k: 'del' },
      { f: 0, t: 1, l: 'CreateMessageResult', k: 'del', d: 1 },
      { f: 1, t: 0, l: 'CallToolResult', d: 1 } ] },
    after: { actors: ['Client', 'Server A', 'Server B'], alt: 'Modern flow across two instances', steps: [
      { f: 0, t: 1, l: 'tools/call + _meta', k: 'add' }, { f: 1, t: 0, l: 'result (resultType: complete)', d: 1 },
      { n: 'Next request can land on any instance', a: 0, b: 2, k: 'acc' },
      { f: 0, t: 2, l: 'tools/call + _meta + handle', k: 'add' }, { f: 2, t: 0, l: 'result', d: 1 } ] }
  },
  extra: `
    <div class="grid2">
      <div class="card"><h3>How each page works</h3><p>What changed, why, the wire diagram, the actual payloads, what it does to your server, how to test it, why it's good news, then a quick check before you move on.</p></div>
      <div class="card"><h3>Reading the payloads</h3>
        <div class="swatches" style="margin-top:8px">
          <span style="background:var(--del-bg);color:var(--del);box-shadow:inset 3px 0 0 var(--del)">− removed in 2026-07-28</span>
          <span style="background:var(--add-bg);color:var(--add);box-shadow:inset 3px 0 0 var(--add)">+ new in 2026-07-28</span>
          <span style="background:var(--hl-bg);color:var(--hl);box-shadow:inset 3px 0 0 var(--hl)">● same field, new rule</span>
        </div></div>
      <div class="card"><h3>Diagrams</h3><p>Each diagram has a <strong>Legacy / 2026-07-28</strong> switch. Try drawing the new flow from memory before you flip it.</p></div>
    </div>`,
  exciting: `<p>MCP servers can now run like ordinary web services: a round-robin load balancer, autoscaling, serverless functions, edge workers. No sticky routing, no session store. That makes the protocol much cheaper to run at scale.</p>`,
  quiz: [
    { q: 'Under 2026-07-28, what is an open stdio connection to a server?',
      o: ['A session: the server can rely on what the client said earlier on it', 'Just a pipe: unrelated requests may share it, and none of them may rely on earlier ones', 'Invalid: stdio was removed in this revision', 'A subscription stream'],
      a: 1, x: 'The spec says an open connection, including a stdio process, <b>is not a conversation or session</b>. Servers MUST NOT rely on earlier requests on the same connection to know the version, capabilities or client identity.' }
  ],
  links: [['Base protocol: Statelessness', S + '/basic/index#statelessness'], ['Versioning and compatibility', S + '/basic/versioning']]
},
{
  id: 'handshake', short: 'The handshake is gone', tag: 'breaking', tagLabel: 'Breaks immediately', domain: 'Interactions & Execution · 26%',
  title: 'No more hello: every request introduces itself',
  lede: 'initialize and notifications/initialized are removed. The version, capabilities and client identity now ride in _meta on every single request.',
  what: `
    <ul>
      <li><code>io.modelcontextprotocol/protocolVersion</code>: <strong>required</strong> on every request.</li>
      <li><code>io.modelcontextprotocol/clientCapabilities</code>: <strong>required</strong>. It covers only the capabilities relevant to <em>this</em> request.</li>
      <li><code>io.modelcontextprotocol/clientInfo</code>: clients <strong>SHOULD</strong> send it. It's for display and logs only; never use it for security decisions.</li>
      <li>Servers <strong>SHOULD</strong> put <code>io.modelcontextprotocol/serverInfo</code> in every result's <code>_meta</code>.</li>
    </ul>
    <p>There are three errors to know. A request missing a required field gets <code>-32602</code> (Invalid params). An unsupported version gets <code>-32022</code> <em>UnsupportedProtocolVersion</em>, with a <code>supported</code> list. A missing capability the server needs gets <code>-32021</code> <em>MissingRequiredClientCapability</em>. Over HTTP, all three return status <code>400</code>.</p>`,
  why: `<p>The handshake pinned negotiated facts (version, capabilities) to a connection. Any instance that later handled a request needed those facts, so you needed sticky routing or a shared store. Putting them in each request removes that dependency, and it lets capabilities differ from one request to the next.</p>`,
  seq: {
    before: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'initialize {protocolVersion, capabilities}', k: 'del' },
      { f: 1, t: 0, l: 'InitializeResult {serverInfo}', k: 'del', d: 1 },
      { f: 0, t: 1, l: 'notifications/initialized', k: 'del' },
      { f: 0, t: 1, l: 'tools/call' }, { f: 1, t: 0, l: 'result', d: 1 } ] },
    after: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'tools/call  _meta{version, caps, info}', k: 'add' },
      { f: 1, t: 0, l: 'result  _meta{serverInfo}', d: 1 },
      { n: 'Version the server does not speak?', a: 0, b: 1 },
      { f: 0, t: 1, l: 'tools/call  _meta{version: 1900-01-01}' },
      { f: 1, t: 0, l: '400 · -32022 {supported: [...]}', k: 'err', d: 1 } ] }
  },
  payloads: [
    { t: 'Calling a tool', before: { lang: 'json', d: 1, text:
`  // ① client → server: open the session
- {"jsonrpc": "2.0", "id": 1, "method": "initialize",
-  "params": {
-    "protocolVersion": "2025-11-25",
-    "capabilities": { "elicitation": {} },
-    "clientInfo": { "name": "ExampleClient", "version": "1.0.0" }
-  }}
  // ② client → server: "I'm ready"
- {"jsonrpc": "2.0", "method": "notifications/initialized"}
  // ③ only now can real work start
  {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
   "params": { "name": "get_weather",
               "arguments": { "location": "Seattle, WA" } }}` },
      after: { lang: 'json', d: 1, text:
`  // One message. No warm-up.
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_weather",
      "arguments": { "location": "Seattle, WA" },
+     "_meta": {
+       "io.modelcontextprotocol/protocolVersion": "2026-07-28",
+       "io.modelcontextprotocol/clientCapabilities": { "elicitation": {} },
+       "io.modelcontextprotocol/clientInfo": { "name": "ExampleClient", "version": "1.0.0" }
+     }
    }
  }` }, cap: 'Note that the request ID no longer has to be 2: there is no earlier request on this "connection" to count from.' },
    { t: 'The answer identifies the server, every time', before: { lang: 'json', d: 1, text:
`  // serverInfo arrived once, in the handshake
  {"jsonrpc": "2.0", "id": 1, "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": { "tools": {} },
*   "serverInfo": { "name": "WeatherServer", "version": "2.1.0" }
  }}` },
      after: { lang: 'json', d: 1, text:
`  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
+     "resultType": "complete",
      "content": [{ "type": "text", "text": "Seattle: 14°C, light rain" }],
+     "_meta": {
+       "io.modelcontextprotocol/serverInfo": { "name": "WeatherServer", "version": "2.1.0" }
+     }
    }
  }` } },
    { t: 'Wrong version: the error tells the client what to retry with', after: { lang: 'json', d: 1, text:
`  {
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
+     "code": -32022,
      "message": "Unsupported protocol version",
      "data": {
+       "supported": ["2026-07-28", "2025-11-25"],
        "requested": "1900-01-01"
      }
    }
  }` }, cap: 'Verbatim from the spec. The client SHOULD pick a version from supported and retry, or show an error if there is none in common.' }
  ],
  impact: `
    <ul>
      <li>A server that stores the negotiated version and capabilities at connect time has nothing to read: a modern client never sends <code>initialize</code>.</li>
      <li>Middleware that rejects requests "before init" rejects <em>every</em> modern request.</li>
      <li>A legacy client that sends <code>initialize</code> to a modern-only server fails. Over HTTP, its request lacks the required headers and gets <code>400</code>. Legacy clients have no way to move forward on their own.</li>
      <li><strong>The fix:</strong> read version and capabilities from each request's <code>_meta</code>. To keep old clients working, go <strong>dual-era</strong>: answer <code>initialize</code> with legacy semantics, and serve requests carrying <code>_meta</code> statelessly. A modern-only server SHOULD name its supported versions in the error it returns to <code>initialize</code>; it's the only diagnostic an old client can show.</li>
    </ul>`,
  test: { intro: `<p>Point these at your server. The helper adds the transport headers so each test shows only the part that matters. It works in bash and zsh.</p>`,
    blocks: [{ label: 'One-time setup', text:
`export MCP=http://localhost:3000/mcp
META='"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}'
mcp() {  # usage: mcp <method> '<json body>' [extra curl args...]
  curl -sS -N "$MCP" \\
    -H 'Content-Type: application/json' \\
    -H 'Accept: application/json, text/event-stream' \\
    -H 'MCP-Protocol-Version: 2026-07-28' \\
    -H "Mcp-Method: $1" "\${@:3}" -d "$2" \\
    -w '\\nHTTP %{http_code}\\n'
}` },
    { label: 'Tests', text:
`# 1. A modern request with no initialize first
mcp tools/list '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{'"$META"'}}'
# expect: HTTP 200 and "resultType":"complete"

# 2. Drop the required capabilities field
mcp tools/list '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}}'
# expect: HTTP 400 and error code -32602

# 3. Ask for a version nobody speaks (header and body must agree)
curl -sS "$MCP" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'MCP-Protocol-Version: 1900-01-01' -H 'Mcp-Method: tools/list' -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"1900-01-01","io.modelcontextprotocol/clientCapabilities":{}}}}' -w '\\nHTTP %{http_code}\\n'
# expect: HTTP 400, code -32022, data.supported lists real versions` }] },
  exciting: `<p>No warm-up round trip, so a serverless function can answer the very first request it receives. Capabilities are scoped to each request, so one client can expose different features to different calls. And any instance can answer anything, which is what makes horizontal scaling trivial.</p>`,
  quiz: [
    { q: 'Which _meta fields MUST be on every request?', o: ['protocolVersion and clientInfo', 'protocolVersion and clientCapabilities', 'All three: protocolVersion, clientCapabilities, clientInfo', 'None: _meta is optional'], a: 1,
      x: '<b>protocolVersion and clientCapabilities are required.</b> clientInfo is a SHOULD, and it is self-reported, so it is for display and logs, never for security decisions. A missing required field gets -32602 (HTTP 400).' },
    { q: 'A client asks for a protocol version the server does not implement. What must the server return?', o: ['-32601 Method not found', '-32602 Invalid params', '-32022 UnsupportedProtocolVersion, listing the supported versions', 'It silently falls back to its newest version'], a: 2,
      x: '<b>-32022</b>, with <code>data.supported</code> and <code>data.requested</code>. Over HTTP the status is 400. The client then retries with a version both sides support.' }
  ],
  links: [['_meta and per-request fields', S + '/basic/index#_meta'], ['Versioning: compatibility matrix', S + '/basic/versioning#compatibility-matrix']]
},
{
  id: 'discover', short: 'server/discover', tag: 'new', tagLabel: 'New, mandatory', domain: 'Architecture & Components · 14%',
  title: 'server/discover: ask what a server can do',
  lede: 'With no handshake, the server needs somewhere else to announce itself. Every server MUST now implement server/discover.',
  what: `
    <p><code>server/discover</code> takes no parameters beyond the standard <code>_meta</code>. It returns <code>supportedVersions</code>, <code>capabilities</code> (including any <code>extensions</code>), optional <code>instructions</code> for the model, and <code>serverInfo</code> in <code>_meta</code>. The result is cacheable, so it also carries <code>ttlMs</code> and <code>cacheScope</code>.</p>
    <p>Servers <strong>MUST</strong> implement it. Calling it is optional for clients: a client may call any method directly and handle <code>-32022</code> if the version is wrong.</p>
    <p>Its second job is as a <strong>probe on stdio</strong>. A dual-era client SHOULD send <code>server/discover</code> first. A result, or a recognised modern error, means a modern server. Any other error, or a timeout, means a legacy server: fall back to <code>initialize</code>. Cache that answer for the lifetime of the server process.</p>`,
  why: `<p>Everything <code>InitializeResult</code> used to carry needed a new home. Putting it in a cacheable method means one call can show a server's identity and abilities, without probing <code>tools/list</code>, <code>prompts/list</code> and <code>resources/list</code> separately, and without opening anything that looks like a session.</p>`,
  seq: {
    after: { actors: ['Dual-era client', 'Server (stdio)'], steps: [
      { f: 0, t: 1, l: 'server/discover', k: 'add' },
      { f: 1, t: 0, l: 'DiscoverResult → modern, stay modern', d: 1, k: 'add' },
      { n: 'or: unknown method / non-modern error / timeout', a: 0, b: 1 },
      { f: 0, t: 1, l: 'initialize (legacy fallback)' },
      { f: 1, t: 0, l: 'InitializeResult', d: 1 } ] }
  },
  payloads: [
    { t: 'Where server identity lives now', before: { lang: 'json', d: 1, text:
`  // legacy: identity and abilities came back from initialize
- {"jsonrpc": "2.0", "id": 1, "result": {
-   "protocolVersion": "2025-11-25",
-   "capabilities": { "tools": {}, "resources": {} },
-   "serverInfo": { "name": "ExampleServer", "version": "1.0.0" },
-   "instructions": "This server provides weather and resource utilities."
- }}` },
      after: { lang: 'json', d: 1, text:
`+ {"jsonrpc": "2.0", "id": "discover-1", "method": "server/discover",
+  "params": { "_meta": {
+    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
+    "io.modelcontextprotocol/clientInfo": { "name": "ExampleClient", "version": "1.0.0" },
+    "io.modelcontextprotocol/clientCapabilities": {}
+  }}}

  {
    "jsonrpc": "2.0",
    "id": "discover-1",
    "result": {
      "resultType": "complete",
+     "supportedVersions": ["2026-07-28"],
      "capabilities": { "tools": {}, "resources": {} },
      "_meta": {
        "io.modelcontextprotocol/serverInfo": { "name": "ExampleServer", "version": "1.0.0" }
      },
      "instructions": "This server provides weather and resource utilities.",
+     "ttlMs": 3600000,
+     "cacheScope": "public"
    }
  }` }, cap: 'Verbatim from the spec. An extension such as Tasks is advertised here, under capabilities.extensions.' }
  ],
  impact: `
    <ul>
      <li>It's a new handler that every server <strong>must</strong> have. Without it, a dual-era stdio client will decide your modern server is legacy.</li>
      <li>Move everything your <code>initialize</code> handler returned into it, and add <code>supportedVersions</code>, <code>ttlMs</code> and <code>cacheScope</code>.</li>
      <li>If you support extensions (Tasks, Apps and so on), this is where you advertise them.</li>
    </ul>`,
  test: { blocks: [{ label: 'HTTP and stdio', text:
`# HTTP
mcp server/discover '{"jsonrpc":"2.0","id":"d1","method":"server/discover","params":{'"$META"'}}'
# expect: supportedVersions, capabilities, serverInfo in _meta, ttlMs and cacheScope

# stdio: pipe one line into your server's start command
printf '%s\\n' '{"jsonrpc":"2.0","id":"d1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}' | node ./server.js
# a legacy server answers with "method not found" or nothing at all; that is the fallback signal` }] },
  exciting: `<p>Registries, gateways and IDEs can list a server's abilities with one cheap request that shared proxies may cache, and without committing to a session. It's the MCP version of a <code>/.well-known</code> document.</p>`,
  quiz: [
    { q: 'Must a client call server/discover before calling tools/call?', o: ['Yes, it replaced initialize as the mandatory first call', 'No. Servers must implement it, but clients may call any method directly', 'Only over HTTP', 'Only when the server advertises extensions'], a: 1,
      x: '<b>Mandatory to implement, optional to call.</b> A client can go straight to tools/call and handle -32022. Dual-era clients on stdio SHOULD call it first, as a probe to tell modern servers from legacy ones.' }
  ],
  links: [['server/discover', S + '/server/discover'], ['stdio backward compatibility', S + '/basic/transports/stdio#backward-compatibility']]
},
{
  id: 'sessions', short: 'Sessions become handles', tag: 'breaking', tagLabel: 'Breaks immediately', domain: 'Interactions · Security',
  title: 'Sessions are gone. State becomes a handle you pass around',
  lede: 'The Mcp-Session-Id header and protocol-level sessions are removed. If a tool needs to remember something between calls, it hands the client an explicit ID.',
  what: `
    <ul>
      <li>There's no <code>Mcp-Session-Id</code>. A modern-only server <strong>ignores</strong> the header and never mints session IDs. It answers HTTP <code>GET</code> or <code>DELETE</code> on the endpoint with <code>405</code>.</li>
      <li>State that spans requests <strong>MUST</strong> be referenced by an explicit identifier that the client passes on each request: a <strong>server-minted handle</strong>, sent as an ordinary tool argument.</li>
      <li><code>tools/list</code>, <code>resources/list</code> and <code>prompts/list</code> no longer vary by connection. They may still vary by the caller's authorization.</li>
    </ul>`,
  why: `<p>A session ties a client to whichever process holds its state. Handles move the state somewhere every instance can reach, such as a database, and put the reference in plain sight. The model can see <code>cartId</code> in a tool result and reason about it.</p>`,
  seq: {
    before: { actors: ['Client', 'Server A', 'Server B'], steps: [
      { f: 0, t: 1, l: 'tools/call  Mcp-Session-Id: 1868…', k: 'del' },
      { f: 1, t: 0, l: 'ok (cart kept in A\'s memory)', d: 1 },
      { n: 'Load balancer sends the next call to B', a: 0, b: 2, k: 'del' },
      { f: 0, t: 2, l: 'tools/call  Mcp-Session-Id: 1868…', k: 'del' },
      { f: 2, t: 0, l: 'error: unknown session', k: 'err', d: 1 } ] },
    after: { actors: ['Client', 'Server A', 'Server B'], steps: [
      { f: 0, t: 1, l: 'tools/call create_cart', k: 'add' },
      { f: 1, t: 0, l: 'result {cartId: "cart_9fK2…"}', k: 'add', d: 1 },
      { n: 'Cart stored in a shared database, keyed by cartId + user', a: 1, b: 2, k: 'acc' },
      { f: 0, t: 2, l: 'tools/call add_to_cart {cartId, sku}', k: 'add' },
      { f: 2, t: 0, l: 'result (B looked the cart up)', d: 1 } ] }
  },
  payloads: [
    { t: 'Keeping a shopping cart between calls', before: { lang: 'http', d: 1, text:
`  POST /mcp HTTP/1.1
- Mcp-Session-Id: 1868a90c-5f4e-4c1a-9d2b-7f3e1c0a9b44
  Content-Type: application/json

  {"jsonrpc": "2.0", "id": 7, "method": "tools/call",
   "params": { "name": "add_to_cart",
               "arguments": { "sku": "MUG-01" } }}
  // the server looks up sessions["1868a90c…"].cart, which lives in ONE process's memory` },
      after: { lang: 'json', d: 1, text:
`  // ① the first call mints a handle and returns it
  {"jsonrpc": "2.0", "id": 1, "result": {
    "resultType": "complete",
    "content": [{ "type": "text", "text": "Cart created" }],
+   "structuredContent": { "cartId": "cart_9fK2xQ7Lw0" }
  }}

  // ② every later call passes it back as an ordinary argument
  {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
   "params": {
     "name": "add_to_cart",
+    "arguments": { "cartId": "cart_9fK2xQ7Lw0", "sku": "MUG-01" },
     "_meta": { … per-request fields … }
   }}` }, cap: 'The handle name and shape are yours to choose. The spec only requires that cross-call state be referenced explicitly on each request.' }
  ],
  impact: `
    <ul>
      <li>Anything kept in a session map is unreachable: the working directory, open DB connections, half-built objects, cached auth decisions.</li>
      <li>It can <strong>fail silently</strong>. If you keyed state by connection, two unrelated conversations sharing one stdio process will see each other's data.</li>
      <li><strong>Secure the handle:</strong> generate it with real randomness, give it an expiry, and on <em>every</em> call check that the authenticated caller owns it. Skip that, and you've built the attack the spec names <strong>state handle hijacking</strong>.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`# 1. The old endpoints are gone
curl -sS -X GET "$MCP" -o /dev/null -w 'GET -> %{http_code}\\n'        # expect 405
curl -sS -X DELETE "$MCP" -o /dev/null -w 'DELETE -> %{http_code}\\n'  # expect 405

# 2. A stray session header is ignored, and no session ID comes back
mcp tools/list '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{'"$META"'}}' -H 'Mcp-Session-Id: abc' -D - | grep -i mcp-session-id
# expect: no output

# 3. The real test: run TWO instances with no sticky routing,
#    call create_cart on one and add_to_cart on the other. It must still work.

# 4. Hijack test: use user A's cartId with user B's token. It must be rejected.` }] },
  exciting: `<p>A round-robin load balancer, autoscaling and serverless all just work. Server crashes lose nothing that matters. And state is now visible: the model, the logs and a human reviewer can all see which cart or job a call refers to.</p>`,
  quiz: [
    { q: 'Your tool builds a report across several calls. Where should the partial report be referenced?', o: ['In the Mcp-Session-Id header', 'By connection identity on the stdio process', 'By a server-minted handle passed as an ordinary tool argument', 'In clientInfo'], a: 2,
      x: 'State that spans requests <b>MUST</b> be referenced by an explicit identifier on each request. Treat the handle as a name, not a password: bind it to the authenticated user and check ownership on every call.' },
    { q: 'What should a 2026-07-28-only server do with an HTTP GET to its MCP endpoint?', o: ['Open an SSE stream for notifications', 'Return 405 Method Not Allowed', 'Return 404', 'Redirect to subscriptions/listen'], a: 1,
      x: '<b>405.</b> GET and DELETE belonged to the old session and stream model. Notifications now come through a subscriptions/listen request.' }
  ],
  links: [['Streamable HTTP: earlier revisions', S + '/basic/transports/streamable-http#earlier-streamable-http-revisions'], ['Statelessness', S + '/basic/index#statelessness']]
},
{
  id: 'mrtr', short: 'Multi Round-Trip Requests', tag: 'breaking', tagLabel: 'Breaks immediately', domain: 'Interactions & Execution · 26%',
  title: 'The server can\'t interrupt any more. It asks, and you retry',
  lede: 'This is the biggest change, and the most tested. Servers no longer send elicitation, sampling or roots requests mid-call. They return input_required, and the client re-sends the original request with the answers.',
  what: `
    <ol>
      <li>The client sends <code>tools/call</code> (id 1).</li>
      <li>The server needs something, so it answers with <code>resultType: "input_required"</code>. That result holds <code>inputRequests</code> (a map of <code>elicitation/create</code>, <code>sampling/createMessage</code> or <code>roots/list</code> requests), <code>requestState</code> (an opaque string), or both. The original request is now <strong>finished</strong>.</li>
      <li>The client gathers the answers and sends the <strong>same request again with a new id</strong>, adding <code>inputResponses</code> and the <em>exact</em> <code>requestState</code>.</li>
      <li>The server rebuilds its context from the retry alone and completes.</li>
    </ol>
    <p>Only <code>tools/call</code>, <code>resources/read</code> and <code>prompts/get</code> may return <code>input_required</code>. The server MUST NOT ask for something the client didn't declare in its capabilities.</p>`,
  why: `<p>A server-initiated request needs a live channel back to the client and memory of the paused call, which means sticky routing again. With Multi Round-Trip Requests (MRTR), each leg is an independent request: whichever instance receives the retry has everything it needs.</p>`,
  seq: {
    before: { actors: ['User', 'Client', 'Server'], steps: [
      { f: 1, t: 2, l: 'tools/call (id 1)' },
      { f: 2, t: 1, l: 'elicitation/create (id srv-1)', k: 'del' },
      { f: 1, t: 0, l: 'ask user' }, { f: 0, t: 1, l: 'octocat', d: 1 },
      { f: 1, t: 2, l: 'response to srv-1', k: 'del', d: 1 },
      { f: 2, t: 1, l: 'result (id 1)', d: 1 } ] },
    after: { actors: ['User', 'Client', 'Server'], steps: [
      { f: 1, t: 2, l: 'tools/call (id 1)' },
      { f: 2, t: 1, l: 'input_required {inputRequests, requestState}', k: 'add', d: 1 },
      { n: 'Request 1 is finished. Nothing is held open.', a: 1, b: 2, k: 'acc' },
      { f: 1, t: 0, l: 'ask user' }, { f: 0, t: 1, l: 'octocat', d: 1 },
      { f: 1, t: 2, l: 'tools/call (id 2) + inputResponses + state', k: 'add' },
      { f: 2, t: 1, l: 'result (resultType: complete)', d: 1 } ] }
  },
  payloads: [
    { t: 'Asking the user for their GitHub username', before: { lang: 'json', d: 1, text:
`  // during a tools/call, the SERVER sent its own request on the response stream
- {"jsonrpc": "2.0", "id": "srv-1", "method": "elicitation/create",
-  "params": { "message": "Please provide your GitHub username",
-              "requestedSchema": { "type": "object",
-                "properties": { "name": { "type": "string" } } } }}
  // …and the client had to answer it with a JSON-RPC response
- {"jsonrpc": "2.0", "id": "srv-1",
-  "result": { "action": "accept", "content": { "name": "octocat" } }}` },
      after: { lang: 'json', d: 1, text:
`  // ① the server's answer to tools/call id 1
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
+     "resultType": "input_required",
+     "inputRequests": {
+       "github_login": {
+         "method": "elicitation/create",
+         "params": {
+           "mode": "form",
+           "message": "Please provide your GitHub username",
+           "requestedSchema": {
+             "type": "object",
+             "properties": { "name": { "type": "string" } },
+             "required": ["name"]
+           }
+         }
+       }
+     },
+     "requestState": "AEAD-protected blob"
    }
  }` }, cap: 'The inputRequests example is verbatim from the spec. The key (github_login) is chosen by the server and must be unique within the request.' },
    { t: 'The retry', after: { lang: 'json', d: 1, text:
`  {
    "jsonrpc": "2.0",
*   "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_repo",
      "arguments": { "repo": "demo" },
+     "inputResponses": {
+       "github_login": { "action": "accept", "content": { "name": "octocat" } }
+     },
+     "requestState": "AEAD-protected blob",
      "_meta": { … per-request fields … }
    }
  }` }, cap: 'Same method and arguments. A new id (MUST differ). requestState echoed back byte for byte. The client MUST NOT parse it, change it, or reuse it on any other request.' }
  ],
  impact: `
    <ul>
      <li>Every place a tool asks the user, calls the model, or reads roots mid-execution stops working. The spec forbids sending requests on the response stream.</li>
      <li>Your handler must be <strong>re-entrant</strong>: one logical operation means two (or more) calls, and the second must resume, not start again.</li>
      <li><strong>requestState comes back attacker-controlled.</strong> If it affects authorization or business logic, protect its integrity (HMAC or AEAD) and reject anything that fails verification. Inside it, include the user (principal), a short expiry, and the method plus a digest of the parameters. If something must be one-time-use, enforce that on the server; the state alone can't.</li>
      <li>If the client leaves out a needed answer, return another <code>input_required</code> rather than an error.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests (example tool: create_repo)', text:
`META_E='"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{"elicitation":{}}}'

# 1. First leg: expect resultType "input_required" with inputRequests and/or requestState
mcp tools/call '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_repo","arguments":{"repo":"demo"},'"$META_E"'}}' -H 'Mcp-Name: create_repo'

# 2. Retry: NEW id, same arguments, answers, and the exact requestState from step 1
mcp tools/call '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_repo","arguments":{"repo":"demo"},"inputResponses":{"github_login":{"action":"accept","content":{"name":"octocat"}}},"requestState":"PASTE_FROM_STEP_1",'"$META_E"'}}' -H 'Mcp-Name: create_repo'
# expect: resultType "complete"

# 3. Negative tests: each one must be rejected
#    a) change one character of requestState
#    b) replay it with another user's token
#    c) replay it after its expiry
#    d) send it on a different tool or with different arguments

# 4. Capability check: repeat step 1 with clientCapabilities {}
#    the server must NOT send an elicitation/create in inputRequests` }] },
  exciting: `<p>Human-in-the-loop over plain request and response. A user can take five minutes to answer, and no socket, worker or session is held open meanwhile. Any instance can resume the work. It's the same pattern as an HTTP 401 challenge-and-retry, applied to user input and model calls.</p>`,
  quiz: [
    { q: 'What must the client change when it retries after input_required?', o: ['Nothing: same id, same params', 'A new JSON-RPC id, plus inputResponses and the exact requestState', 'Send the answers as a notification instead', 'Open a subscriptions/listen stream to wait for the result'], a: 1,
      x: 'The retry is an independent request, so the <b>id MUST differ</b>. The client adds inputResponses (keyed to the inputRequests) and echoes requestState unchanged. If the server sent no requestState, the client MUST NOT include one.' },
    { q: 'Which requests may a server answer with input_required?', o: ['Any request', 'tools/call, resources/read and prompts/get', 'tools/call only', 'tools/list and tools/call'], a: 1,
      x: 'Only those three. Servers <b>MUST NOT</b> send InputRequiredResult on any other request.' },
    { q: 'Why must the server protect requestState with HMAC or AEAD?', o: ['To make it smaller', 'It travels through the client and comes back attacker-controlled', 'Because the spec requires JWT', 'So the client can read it safely'], a: 1,
      x: 'The spec says to treat requestState as <b>attacker-controlled input</b>. Bind it to the principal, give it a short expiry, and tie it to the originating request, so it can\'t be tampered with, reused by another user, or replayed on another call.' }
  ],
  links: [['Multi Round-Trip Requests', S + '/basic/patterns/mrtr'], ['SEP-2322', 'https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2322']]
},
{
  id: 'results', short: 'Typed, cacheable results', tag: 'quiet', tagLabel: 'Fails quietly', domain: 'Interactions & Execution · 26%',
  title: 'Every result says what it is, and how long it stays fresh',
  lede: 'Results must carry resultType. Lists, reads and discovery must also carry ttlMs and cacheScope, so clients and proxies know how long to cache them.',
  what: `
    <p><strong>resultType</strong> is required on every result: <code>"complete"</code>, <code>"input_required"</code>, or a value added by an extension the client advertised (Tasks adds <code>"task"</code>). If the field is absent, the client treats the result as <code>"complete"</code>; that's the rule for older servers. An unrecognised value is invalid.</p>
    <p><strong>Caching hints</strong> are required on complete results from <code>server/discover</code>, <code>tools/list</code>, <code>prompts/list</code>, <code>resources/list</code>, <code>resources/templates/list</code> and <code>resources/read</code>:</p>
    <ul>
      <li><code>ttlMs</code>: milliseconds the result may be treated as fresh. It must be ≥ 0, and <code>0</code> means stale immediately. A missing value is treated as 0, a negative one is ignored.</li>
      <li><code>cacheScope</code>: <code>"public"</code> means no user-specific data, so any shared gateway may cache it. <code>"private"</code> means it can be reused only within the same authorization context.</li>
    </ul>
    <p><code>input_required</code> results and results from MRTR retries are never cached. A change notification immediately invalidates a fresh cache entry. Servers SHOULD return <code>tools/list</code> in a <strong>deterministic order</strong>.</p>`,
  why: `<p>Without a type tag, a client can't tell a final answer from "I need more input". Without cache hints, clients poll list endpoints blindly. Explicit TTLs, the same idea as HTTP <code>Cache-Control</code>, cut that traffic. A stable tool order also makes the model's prompt-cache hits more likely.</p>`,
  seq: {
    after: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'tools/list' }, { f: 1, t: 0, l: '{tools, ttlMs: 300000, public}', k: 'add', d: 1 },
      { n: 'Need tools again 2 min later: still fresh, use the cache', a: 0, b: 0, k: 'acc' },
      { f: 1, t: 0, l: 'notifications/tools/list_changed', d: 1 },
      { n: 'Invalidate at once, even though the TTL hasn\'t expired', a: 0, b: 0, k: 'acc' },
      { f: 0, t: 1, l: 'tools/list' } ] }
  },
  payloads: [
    { t: 'A tool list', before: { lang: 'json', d: 1, text:
`  {"jsonrpc": "2.0", "id": 3, "result": {
    "tools": [ { "name": "get_weather", "inputSchema": { … } } ]
  }}` }, after: { lang: 'json', d: 1, text:
`  {"jsonrpc": "2.0", "id": 3, "result": {
+   "resultType": "complete",
    "tools": [ { "name": "get_weather", "inputSchema": { … } } ],
+   "ttlMs": 300000,
+   "cacheScope": "public"
  }}` } },
    { t: 'A per-user resource must be private', after: { lang: 'json', d: 1, text:
`  {"jsonrpc": "2.0", "id": 4, "result": {
    "resultType": "complete",
    "contents": [{ "uri": "app://me/settings", "mimeType": "application/json", "text": "{…}" }],
+   "ttlMs": 60000,
*   "cacheScope": "private"
  }}` }, cap: 'cacheScope is a promise about the data, not an access control. Every page of a paginated list must use the same scope.' }
  ],
  impact: `
    <ul>
      <li>A result with no <code>resultType</code> from a modern server is non-compliant. Clients assume <code>complete</code>, which hides the mistake until you add MRTR.</li>
      <li>List and read results without <code>ttlMs</code>/<code>cacheScope</code> are non-compliant. Worse, marking user-specific data <code>"public"</code> lets a shared gateway serve one user's data to another.</li>
      <li>Treat the TTL as a freshness check when the data is needed, not as a polling timer. If you do poll, add jitter and backoff.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`# Every result has resultType; lists carry the cache hints
mcp tools/list '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{'"$META"'}}' | grep -o '"resultType":"[a-z_]*"\\|"ttlMs":[0-9]*\\|"cacheScope":"[a-z]*"'

# Determinism: two calls should list tools in the same order
diff <(mcp tools/list '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{'"$META"'}}') <(mcp tools/list '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{'"$META"'}}')

# Review: any resources/read that depends on the caller must say "private"` }] },
  exciting: `<p>Gateways can cache public tool lists across all users, so a thousand agents don't each poll your server. A deterministic tool order keeps the model's prompt prefix stable, which makes prompt caching cheaper and faster on the LLM side too.</p>`,
  quiz: [
    { q: 'resources/read returns the caller\'s own account settings. Which cacheScope?', o: ['"public"', '"private"', 'Omit it', '"session"'], a: 1,
      x: '<b>"private"</b>: it contains user-specific data and must not be shared across authorization contexts (a different token needs a different cache).' },
    { q: 'A client gets a result with no resultType field. How should it treat it?', o: ['As invalid', 'As "complete" (a server from before 2026-07-28)', 'As "input_required"', 'Retry with a new id'], a: 1,
      x: 'For backward compatibility, a missing resultType <b>MUST</b> be treated as "complete". An <em>unrecognised</em> value, by contrast, is invalid.' }
  ],
  links: [['Caching', S + '/server/utilities/caching'], ['ResultType', S + '/basic/index#resulttype']]
},
{
  id: 'listen', short: 'subscriptions/listen', tag: 'breaking', tagLabel: 'Breaks immediately', domain: 'Interactions & Execution · 26%',
  title: 'Change notifications: one stream you ask for',
  lede: 'The standalone GET stream and resources/subscribe are gone. A client opens subscriptions/listen, an ordinary request whose response stays open, and opts in by notification type.',
  what: `
    <ul>
      <li>The filter has four optional fields: <code>toolsListChanged</code>, <code>promptsListChanged</code>, <code>resourcesListChanged</code> (booleans) and <code>resourceSubscriptions</code> (an array of URIs). The server <strong>MUST NOT</strong> send types the client didn't ask for.</li>
      <li>The first message is always <code>notifications/subscriptions/acknowledged</code>, listing the subset the server agreed to honour.</li>
      <li>Every notification carries <code>io.modelcontextprotocol/subscriptionId</code>, which equals the JSON-RPC id of the listen request. A client can run several subscriptions at once.</li>
      <li>Request-scoped messages like <code>notifications/progress</code> and <code>notifications/message</code> <strong>never</strong> travel on the listen stream. They stay on the response stream of the request they belong to.</li>
      <li>The subscription ends when the client closes the stream (HTTP) or sends <code>notifications/cancelled</code> (stdio). When the server ends it, it SHOULD send a final <code>complete</code> result first.</li>
    </ul>`,
  why: `<p>A standing GET stream belonged to a session. Making "listen" a normal request means it gets the same auth, routing, headers and version rules as everything else, and its state lives in the request, not the connection. Opting in by type also stops notifications nobody wanted.</p>`,
  seq: {
    before: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'GET /mcp (standalone SSE)', k: 'del' },
      { f: 0, t: 1, l: 'resources/subscribe {uri}', k: 'del' },
      { f: 1, t: 0, l: 'notifications/resources/updated', d: 1 },
      { f: 1, t: 0, l: 'any server-initiated message', k: 'del', d: 1 } ] },
    after: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'POST subscriptions/listen (id 1, filter)', k: 'add' },
      { f: 1, t: 0, l: 'subscriptions/acknowledged  subId 1', k: 'add', d: 1 },
      { n: 'The stream stays open', a: 0, b: 1, k: 'acc' },
      { f: 1, t: 0, l: 'tools/list_changed  subId 1', d: 1 },
      { f: 1, t: 0, l: 'resources/updated  subId 1', d: 1 } ] }
  },
  payloads: [
    { t: 'Subscribing', before: { lang: 'http', d: 1, text:
`- GET /mcp HTTP/1.1
- Accept: text/event-stream
- Mcp-Session-Id: 1868a90c-5f4e-4c1a-9d2b-7f3e1c0a9b44

- {"jsonrpc": "2.0", "id": 5, "method": "resources/subscribe",
-  "params": { "uri": "file:///project/config.json" }}` },
      after: { lang: 'json', d: 1, text:
`  {
    "jsonrpc": "2.0",
    "id": 1,
+   "method": "subscriptions/listen",
    "params": {
      "_meta": { … per-request fields … },
+     "notifications": {
+       "toolsListChanged": true,
+       "resourceSubscriptions": ["file:///project/config.json"]
+     }
    }
  }` } },
    { t: 'What comes back on that one stream', after: { lang: 'json', d: 1, text:
`  // always first
  {"jsonrpc": "2.0", "method": "notifications/subscriptions/acknowledged",
   "params": {
+    "_meta": { "io.modelcontextprotocol/subscriptionId": 1 },
     "notifications": { "toolsListChanged": true,
                        "resourceSubscriptions": ["file:///project/config.json"] }
   }}

  // later, whenever the file changes
  {"jsonrpc": "2.0", "method": "notifications/resources/updated",
   "params": {
+    "_meta": { "io.modelcontextprotocol/subscriptionId": 1 },
     "uri": "file:///project/config.json"
   }}` }, cap: 'Verbatim from the spec. subscriptionId 1 is the id of the listen request, which is how a client tells several subscriptions apart.' }
  ],
  impact: `
    <ul>
      <li>Change notifications you push outside a listen stream go nowhere. Clients that open a GET stream get <code>405</code>.</li>
      <li>You must implement the acknowledgement, the filter, the <code>subscriptionId</code> tagging, and stopping when the stream closes.</li>
      <li>On stdio, if the process restarts, the client must send <code>subscriptions/listen</code> again; the server keeps no subscription state across reconnections.</li>
      <li>For long-lived streams, send an SSE comment line (<code>:</code>) now and then as a keep-alive, so proxies don't time the stream out.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`# Open a listen stream (leave it running), then change a tool on the server
mcp subscriptions/listen '{"jsonrpc":"2.0","id":1,"method":"subscriptions/listen","params":{'"$META"',"notifications":{"toolsListChanged":true}}}'
# expect: first event is notifications/subscriptions/acknowledged with subscriptionId 1
#         then notifications/tools/list_changed carrying subscriptionId 1
#         and NOT any resource or prompt notifications (you didn't ask for them)

# In another terminal, call a slow tool: its progress must arrive on ITS stream, not here` }] },
  exciting: `<p>Notifications are now filtered, correlated and tied to auth like any other request. It's one mechanism for everything, and the Tasks extension reuses it for task status pushes. Gateways can route a listen request like any other request.</p>`,
  quiz: [
    { q: 'Where do notifications/progress messages for a long tools/call arrive?', o: ['On the subscriptions/listen stream', 'On the response stream of that tools/call', 'On the GET stream', 'They were removed'], a: 1,
      x: 'Request-scoped notifications (progress and log messages) flow <b>only on the response stream of the request they relate to</b>, never on the listen stream.' },
    { q: 'What is the subscriptionId on each notification?', o: ['A random UUID the server picks', 'The JSON-RPC id of the subscriptions/listen request', 'The Mcp-Session-Id', 'The resource URI'], a: 1,
      x: 'It is the <b>id of the listen request</b>. On stdio, where everything shares one channel, clients MUST use it to match notifications to subscriptions.' }
  ],
  links: [['Subscriptions', S + '/basic/patterns/subscriptions'], ['Streamable HTTP: message flow', S + '/basic/transports/streamable-http#message-flow']]
},
{
  id: 'headers', short: 'HTTP headers', tag: 'quiet', tagLabel: 'Fails quietly', domain: 'Architecture · Security',
  title: 'Routing without reading the body: required HTTP headers',
  lede: 'Every POST mirrors key body fields into headers, so load balancers, gateways and firewalls can route and rate-limit without parsing JSON. If a header disagrees with the body, the request is rejected.',
  what: `
    <ul>
      <li><code>MCP-Protocol-Version</code> (around since 2025-06-18) <strong>MUST now equal</strong> the <code>_meta</code> protocolVersion.</li>
      <li><code>Mcp-Method</code> on every request. <code>Mcp-Name</code> (<code>params.name</code> or <code>params.uri</code>) on <code>tools/call</code>, <code>resources/read</code> and <code>prompts/get</code>.</li>
      <li>A tool can mark a parameter with <code>x-mcp-header</code>. Clients <strong>MUST</strong> then mirror its value as <code>Mcp-Param-{Name}</code>. Values that aren't plain ASCII use <code>=?base64?…?=</code>.</li>
      <li>Missing, mismatched or malformed headers get <code>400</code> and error <code>-32020</code> <em>HeaderMismatch</em>. An unknown method gets <code>404</code> with <code>-32601</code>.</li>
    </ul>`,
  why: `<p>The danger here is a load balancer routing on the header while the server executes the body. If the two could disagree, an attacker could route a "harmless" call past a policy and run a dangerous one. Strict header-body equality closes that gap.</p>`,
  seq: {
    after: { actors: ['Client', 'Gateway', 'Server'], steps: [
      { f: 0, t: 1, l: 'POST  Mcp-Method: tools/call', k: 'add' },
      { n: 'Routes and rate-limits on headers alone', a: 1, b: 1, k: 'acc' },
      { f: 1, t: 2, l: 'forward (Mcp-Name: execute_sql)' },
      { n: 'Server checks headers == body', a: 2, b: 2 },
      { f: 2, t: 0, l: '400 · -32020 HeaderMismatch (if not)', k: 'err', d: 1 } ] }
  },
  payloads: [
    { t: 'A tool call over HTTP', before: { lang: 'http', d: 1, text:
`  POST /mcp HTTP/1.1
  Content-Type: application/json
  MCP-Protocol-Version: 2025-11-25
- Mcp-Session-Id: 1868a90c-5f4e-4c1a-9d2b-7f3e1c0a9b44

  {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
   "params": { "name": "execute_sql",
               "arguments": { "region": "us-west1", "query": "SELECT * FROM users" } }}` },
      after: { lang: 'http', d: 1, text:
`  POST /mcp HTTP/1.1
  Content-Type: application/json
* MCP-Protocol-Version: 2026-07-28
+ Mcp-Method: tools/call
+ Mcp-Name: execute_sql
+ Mcp-Param-Region: us-west1

  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "_meta": {
*       "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { "name": "ExampleClient", "version": "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {}
      },
      "name": "execute_sql",
      "arguments": { "region": "us-west1", "query": "SELECT * FROM users" }
    }
  }` }, cap: 'Verbatim from the spec. Mcp-Param-Region exists because the tool marked region with "x-mcp-header": "Region" in its inputSchema.' },
    { t: 'The tool definition that asks for the extra header', after: { lang: 'json', d: 1, text:
`  {
    "name": "execute_sql",
    "inputSchema": {
      "type": "object",
      "properties": {
        "region": {
          "type": "string",
          "description": "The region to execute the query in",
+         "x-mcp-header": "Region"
        },
        "query": { "type": "string", "description": "The SQL query to execute" }
      },
      "required": ["region", "query"]
    }
  }` }, cap: 'Only primitive types (string, integer, boolean, never number), reachable from the schema root through properties alone. A client must drop a tool whose annotation breaks these rules.' }
  ],
  impact: `
    <ul>
      <li>A proxy that rewrites or strips headers now produces mysterious <code>400</code>s with <code>-32020</code>.</li>
      <li>Your server must compare headers with the body, decoding base64 values first and comparing integers as numbers.</li>
      <li>Still required as before: validate <code>Origin</code> (an invalid one gets <code>403</code>, which stops DNS rebinding), and bind to localhost when running locally.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`# Header says one tool, body says another: expect HTTP 400 and -32020
mcp tools/call '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"delete_all","arguments":{},'"$META"'}}' -H 'Mcp-Name: get_weather'

# Missing Mcp-Name on tools/call: expect 400 and -32020
mcp tools/call '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_weather","arguments":{"location":"Seattle"},'"$META"'}}'

# Unknown method: expect 404 and -32601
mcp nope/nope '{"jsonrpc":"2.0","id":3,"method":"nope/nope","params":{'"$META"'}}'` }] },
  exciting: `<p>MCP traffic becomes legible to ordinary infrastructure. You can route by tool name, pin a region from a header, and run web-application-firewall rules or per-tool rate limits at the edge, all without a JSON parser in the hot path.</p>`,
  quiz: [
    { q: 'The Mcp-Name header says get_weather but the body\'s params.name is delete_all. What happens?', o: ['The server runs delete_all; the body wins', 'The gateway routes get_weather and the server runs get_weather', '400 Bad Request with -32020 HeaderMismatch', '404 with -32601'], a: 2,
      x: 'Servers that process the body <b>MUST reject</b> any header-body mismatch with 400 and -32020. That prevents a split where infrastructure routes one thing and the server runs another.' }
  ],
  links: [['Streamable HTTP: request metadata', S + '/basic/transports/streamable-http#request-metadata'], ['Server validation', S + '/basic/transports/streamable-http#server-validation']]
},
{
  id: 'streams', short: 'No resume, close = cancel', tag: 'quiet', tagLabel: 'Fails quietly', domain: 'Interactions & Execution · 26%',
  title: 'A dropped stream loses the request. Closing one cancels it',
  lede: 'SSE resumability (Last-Event-ID) is gone. If a response stream breaks, the client re-sends the request with a new id. And on HTTP, hanging up is how a client says stop.',
  what: `
    <ul>
      <li>There are no SSE event IDs and no <code>Last-Event-ID</code>. A server that receives the header ignores it.</li>
      <li>A broken response stream loses the in-flight request. The client <strong>MUST</strong> re-issue it as a <strong>new request with a new id</strong>.</li>
      <li>On Streamable HTTP, <strong>closing the response stream is the cancellation</strong>. The server SHOULD stop work as soon as it can and MUST NOT send anything more for that request. (On stdio, <code>notifications/cancelled</code> is still used.)</li>
      <li>For work that must survive disconnects, use the Tasks extension (a later page).</li>
    </ul>`,
  why: `<p>Resumability meant keeping a replay buffer per stream, which is state again, and pinned to one instance. Dropping it keeps servers stateless. Treating disconnect as cancel removes an extra message type from HTTP and makes cancellation unambiguous, because each request has its own stream.</p>`,
  seq: {
    before: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'POST tools/call (id 7)' },
      { f: 1, t: 0, l: 'SSE event 41, 42 …', d: 1 },
      { n: 'connection drops', a: 0, b: 1, k: 'del' },
      { f: 0, t: 1, l: 'GET  Last-Event-ID: 42', k: 'del' },
      { f: 1, t: 0, l: 'replay 43… then the result', k: 'del', d: 1 } ] },
    after: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'POST tools/call (id 7)' },
      { f: 1, t: 0, l: 'notifications/progress', d: 1 },
      { n: 'stream closes: request 7 is cancelled; server stops', a: 0, b: 1, k: 'acc' },
      { f: 0, t: 1, l: 'POST tools/call (id 8), the same call again', k: 'add' },
      { f: 1, t: 0, l: 'result', d: 1 } ] }
  },
  payloads: [
    { t: 'Recovering from a drop', before: { lang: 'http', d: 1, text:
`- GET /mcp HTTP/1.1
- Accept: text/event-stream
- Mcp-Session-Id: 1868a90c-5f4e-4c1a-9d2b-7f3e1c0a9b44
- Last-Event-ID: 42
  // the server replays everything after event 42` },
      after: { lang: 'http', d: 1, text:
`  // the stream for request 7 dropped, so request 7 is gone
  POST /mcp HTTP/1.1
  Content-Type: application/json
  MCP-Protocol-Version: 2026-07-28
  Mcp-Method: tools/call
  Mcp-Name: build_report

* {"jsonrpc": "2.0", "id": 8, "method": "tools/call",
   "params": { "name": "build_report", "arguments": { "month": "2026-09" },
               "_meta": { … per-request fields … } }}` }, cap: 'Same call, new id. If running it twice is unsafe, make the tool idempotent, or return a Task handle.' }
  ],
  impact: `
    <ul>
      <li>Long tools on flaky networks can run twice. A drop at minute nine of ten means starting again.</li>
      <li>If your server keeps working after the client hangs up, it wastes resources and may complete actions nobody is waiting for. Wire the request's disconnect signal to an abort.</li>
      <li>Any replay-buffer or event-ID code can be deleted.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`# Start a slow tool, then press Ctrl-C after a few progress events
mcp tools/call '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"build_report","arguments":{"month":"2026-09"},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"progressToken":"p7"}}}' -H 'Mcp-Name: build_report'
# expect in server logs: work for request 7 stops shortly after the disconnect

# A Last-Event-ID header must be ignored (no replay)
mcp tools/list '{"jsonrpc":"2.0","id":9,"method":"tools/list","params":{'"$META"'}}' -H 'Last-Event-ID: 42'` }] },
  exciting: `<p>Servers get simpler: no event log, no replay buffer, no stream bookkeeping. Cancellation is free and reliable, and users who close a tab really do stop the expensive work.</p>`,
  quiz: [
    { q: 'Over Streamable HTTP in 2026-07-28, how does a client cancel an in-flight request?', o: ['Send notifications/cancelled in a new POST', 'Close that request\'s response stream', 'Send DELETE with the session id', 'Send tasks/cancel'], a: 1,
      x: '<b>Closing the SSE response stream is the cancellation signal</b> on HTTP. notifications/cancelled is for stdio. tasks/cancel applies only to Tasks.' }
  ],
  links: [['Streamable HTTP: cancellation', S + '/basic/transports/streamable-http#cancellation'], ['Cancellation', S + '/basic/patterns/cancellation']]
},
{
  id: 'removed', short: 'Removed: ping, setLevel…', tag: 'quiet', tagLabel: 'Fails quietly', domain: 'Interactions · Fundamentals',
  title: 'Small removals with a long reach',
  lede: 'Several utilities that depended on session state are gone, and one familiar error code moved.',
  what: `
    <ul>
      <li><strong><code>ping</code></strong> is removed.</li>
      <li><strong><code>logging/setLevel</code></strong> is removed. The level is now set <em>per request</em> with <code>io.modelcontextprotocol/logLevel</code> in <code>_meta</code>. If a request doesn't carry it, the server <strong>MUST NOT</strong> send any <code>notifications/message</code> for that request.</li>
      <li><strong><code>notifications/roots/list_changed</code></strong> is removed.</li>
      <li><strong><code>notifications/elicitation/complete</code></strong> and the <code>elicitationId</code> on URL-mode elicitation (both added in 2025-11-25) are removed. Under MRTR, the client learns the outcome by retrying, and the server tracks its own ID inside <code>requestState</code>.</li>
      <li>"Resource not found" changed from <code>-32002</code> to <strong><code>-32602</code></strong>. Don't emit the old code, but clients should still accept it from older servers. <code>-32042</code> (URL elicitation required) is retired too.</li>
    </ul>`,
  why: `<p>Each of these assumed a session: a global log level, a liveness check on a connection, a server-pushed completion signal. In a stateless protocol they either have nothing to attach to or are covered by something else.</p>`,
  seq: {
    before: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'logging/setLevel {debug}', k: 'del' },
      { n: 'Global: affects everything on the session', a: 0, b: 1, k: 'del' },
      { f: 0, t: 1, l: 'tools/call' },
      { f: 1, t: 0, l: 'notifications/message', d: 1 } ] },
    after: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'tools/call  _meta{logLevel: debug}', k: 'add' },
      { f: 1, t: 0, l: 'notifications/message (this stream)', d: 1 },
      { f: 1, t: 0, l: 'result', d: 1 },
      { f: 0, t: 1, l: 'tools/call (no logLevel)' },
      { f: 1, t: 0, l: 'result, with zero log messages', d: 1 } ] }
  },
  payloads: [
    { t: 'Turning on debug logs', before: { lang: 'json', d: 1, text:
`- {"jsonrpc": "2.0", "id": 4, "method": "logging/setLevel",
-  "params": { "level": "debug" }}
  // from now on the server logs at debug, for the whole session` },
      after: { lang: 'json', d: 1, text:
`  {"jsonrpc": "2.0", "id": 9, "method": "tools/call",
   "params": {
     "name": "build_report",
     "arguments": { "month": "2026-09" },
     "_meta": {
       "io.modelcontextprotocol/protocolVersion": "2026-07-28",
       "io.modelcontextprotocol/clientCapabilities": {},
+      "io.modelcontextprotocol/logLevel": "debug"
     }
   }}

  // log lines arrive on THIS request's response stream only
  {"jsonrpc": "2.0", "method": "notifications/message",
   "params": { "level": "debug", "logger": "report", "data": "fetched 120 rows" }}` } },
    { t: 'Resource not found', before: { lang: 'json', d: 1, text:
`  {"jsonrpc": "2.0", "id": 5,
-  "error": { "code": -32002, "message": "Resource not found" }}` },
      after: { lang: 'json', d: 1, text:
`  {"jsonrpc": "2.0", "id": 5,
+  "error": { "code": -32602, "message": "Resource not found" }}` }, cap: '-32602 is the standard JSON-RPC "Invalid params" code. The spec\'s new allocation rule: -32000 to -32019 is legacy territory, and -32020 to -32099 is reserved for MCP.' }
  ],
  impact: `
    <ul>
      <li>Health checks built on <code>ping</code> break. Use <code>server/discover</code>, or a plain HTTP health endpoint.</li>
      <li>Admin tools that call <code>setLevel</code> break, and servers that log by default now break the "MUST NOT" rule.</li>
      <li>Clients matching <code>-32002</code> stop recognising not-found errors from modern servers.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`# Without logLevel: zero notifications/message on the stream
mcp tools/call '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"build_report","arguments":{"month":"2026-09"},'"$META"'}}' -H 'Mcp-Name: build_report' | grep -c notifications/message
# expect: 0

# ping is gone: expect 404 and -32601
mcp ping '{"jsonrpc":"2.0","id":2,"method":"ping","params":{'"$META"'}}'

# Missing resource: expect -32602, not -32002
mcp resources/read '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"file:///nope",'"$META"'}}' -H 'Mcp-Name: file:///nope'` }] },
  exciting: `<p>Debug logging becomes surgical: turn it on for the one failing call, not for every user sharing the server. With no global mutable state, server behaviour is fully determined by the request in front of it.</p>`,
  quiz: [
    { q: 'A request arrives with no io.modelcontextprotocol/logLevel. May the server send notifications/message for it?', o: ['Yes, at "info"', 'Yes, at whatever level was last set', 'No: it MUST NOT', 'Only on the listen stream'], a: 2,
      x: 'Logging is <b>opt-in per request</b>. No logLevel means no log notifications for that request. (Logging as a whole is also deprecated: prefer stderr on stdio, or OpenTelemetry.)' }
  ],
  links: [['Logging', S + '/server/utilities/logging'], ['Error codes', S + '/basic/index#error-codes']]
},
{
  id: 'tasks', short: 'Tasks extension', tag: 'new', tagLabel: 'Redesigned', domain: 'Use Cases & Ecosystem · 20%',
  title: 'Long-running work: Tasks left the core and got simpler',
  lede: 'Experimental tasks moved out of the core protocol into an official extension, io.modelcontextprotocol/tasks, with a different set of methods.',
  what: `
    <ul>
      <li><strong>Opt in</strong>: the client lists the extension in each request's <code>clientCapabilities.extensions</code>, and the server advertises it in <code>server/discover</code>. A server must never return a task to a client that didn't declare it.</li>
      <li><strong>Server decides</strong>: for a supported request, the server may answer with <code>resultType: "task"</code> and a task handle (<code>taskId</code>, status, <code>ttlMs</code>, <code>pollIntervalMs</code>), with no per-request flag needed.</li>
      <li><strong>Poll</strong> with <code>tasks/get</code>. Blocking <code>tasks/result</code> is <strong>removed</strong>, and so is <code>tasks/list</code>.</li>
      <li><strong>Mid-flight input</strong>: the status changes to <code>input_required</code> with <code>inputRequests</code>, and the client answers with the <strong>new</strong> <code>tasks/update</code>.</li>
      <li><strong>Cancel</strong> with <code>tasks/cancel</code>. It's cooperative, so the task may still finish.</li>
      <li>The statuses are <code>working</code>, <code>input_required</code>, <code>completed</code>, <code>failed</code> and <code>cancelled</code>; the last three are terminal. Status pushes are available via <code>subscriptions/listen</code>.</li>
    </ul>`,
  why: `<p>Holding a connection open while a job runs breaks on timeouts, crashes and flaky networks. A durable task ID survives all three. Moving Tasks to an extension keeps the core small, and lets the feature change on its own schedule.</p>`,
  seq: {
    after: { actors: ['Client', 'Server'], steps: [
      { f: 0, t: 1, l: 'tools/call (+ tasks extension)' },
      { f: 1, t: 0, l: 'resultType: "task" {taskId, working}', k: 'add', d: 1 },
      { f: 0, t: 1, l: 'tasks/get', k: 'add' }, { f: 1, t: 0, l: 'input_required + inputRequests', d: 1 },
      { f: 0, t: 1, l: 'tasks/update {inputResponses}', k: 'add' }, { f: 1, t: 0, l: 'ack', d: 1 },
      { f: 0, t: 1, l: 'tasks/get', k: 'add' }, { f: 1, t: 0, l: 'completed + result', d: 1 } ] }
  },
  payloads: [
    { t: 'The method set', before: { lang: 'json', d: 1, text:
`  // 2025-11-25: experimental, in the core protocol
- {"jsonrpc": "2.0", "id": 11, "method": "tasks/result", "params": { "taskId": "t-123" }}
  // ↑ blocked until the task finished
- {"jsonrpc": "2.0", "id": 12, "method": "tasks/list"}` },
      after: { lang: 'json', d: 1, text:
`  // ① opt in on the request
  "_meta": { "io.modelcontextprotocol/clientCapabilities": {
+   "extensions": { "io.modelcontextprotocol/tasks": {} } } }

  // ② the server chooses to answer with a handle
  {"jsonrpc": "2.0", "id": 11, "result": {
+   "resultType": "task",
+   "task": { "taskId": "t-123", "status": "working", "ttlMs": 3600000, "pollIntervalMs": 5000 }
  }}

  // ③ poll, ④ answer a mid-flight question, ⑤ optionally cancel
+ {"jsonrpc": "2.0", "id": 12, "method": "tasks/get", "params": { "taskId": "t-123" }}
+ {"jsonrpc": "2.0", "id": 13, "method": "tasks/update", "params": { "taskId": "t-123", "inputResponses": { … } }}
+ {"jsonrpc": "2.0", "id": 14, "method": "tasks/cancel", "params": { "taskId": "t-123" }}` }, cap: 'The method names, statuses and fields come from the extension overview, but this field layout is illustrative. The exact shapes are defined in the modelcontextprotocol/ext-tasks repository.' }
  ],
  impact: `
    <ul>
      <li>Code written against core experimental tasks no longer matches what clients send.</li>
      <li>You must create tasks durably <em>before</em> responding, persist task IDs, and keep honouring <code>ttlMs</code>.</li>
      <li>If you return tasks to clients that didn't opt in, those clients can't handle the result.</li>
    </ul>`,
  test: { blocks: [{ label: 'Tests', text:
`META_T='"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{"extensions":{"io.modelcontextprotocol/tasks":{}}}}'

# 1. The server advertises the extension
mcp server/discover '{"jsonrpc":"2.0","id":"d","method":"server/discover","params":{'"$META"'}}' | grep -o 'io.modelcontextprotocol/tasks'

# 2. With opt-in: a slow tool may return resultType "task"
mcp tools/call '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"build_report","arguments":{"month":"2026-09"},'"$META_T"'}}' -H 'Mcp-Name: build_report'

# 3. Without opt-in ($META): the same call must NOT return a task

# 4. Poll until terminal, kill your client, restart it, keep polling the same taskId` }] },
  exciting: `<p>Continuous-integration runs, batch imports and approval gates become first-class MCP operations. A phone can start a job, lose signal, and pick it up an hour later with the same task ID. Pairing this with MRTR-style input makes human-in-the-loop workflows durable.</p>`,
  quiz: [
    { q: 'Which statement about Tasks in 2026-07-28 is true?', o: ['tasks/result still blocks until completion', 'tasks/list lets a client find all its tasks', 'It is an opt-in extension; clients poll with tasks/get and send input with tasks/update', 'Clients must flag each request that may become a task'], a: 2,
      x: 'Tasks is an <b>extension</b> (io.modelcontextprotocol/tasks). tasks/result and tasks/list are removed, tasks/update is new, and the server may return a task without a per-request flag, but only to clients that declared the extension.' }
  ],
  links: [['Tasks extension overview', 'https://modelcontextprotocol.io/extensions/tasks/overview'], ['ext-tasks repository', 'https://github.com/modelcontextprotocol/ext-tasks'], ['Extensions overview', 'https://modelcontextprotocol.io/docs/extensions/overview']]
},
{
  id: 'deprecated', short: 'Deprecations & lifecycle', tag: 'deprecated', tagLabel: 'On a 12-month clock', domain: 'Use Cases & Ecosystem · 20%',
  title: 'Deprecated, not dead: the twelve-month clock',
  lede: 'The revision adds a formal feature lifecycle, Active → Deprecated → Removed, with at least twelve months between Deprecated and Removed, and puts several features on it.',
  what: `
    <ul>
      <li><strong>Roots</strong>: pass directories or files as tool parameters, resource URIs or server configuration instead.</li>
      <li><strong>Sampling</strong>: call your LLM provider's API directly instead.</li>
      <li><strong>Logging</strong>: log to <code>stderr</code> (stdio) or use OpenTelemetry instead.</li>
      <li><strong>HTTP+SSE transport</strong> (from 2024-11-05): reclassified as Deprecated; migrate to Streamable HTTP.</li>
      <li><strong><code>includeContext</code></strong> values <code>"thisServer"</code> and <code>"allServers"</code>: omit the field or use <code>"none"</code>. They'll be removed no later than Sampling itself.</li>
      <li><strong>Dynamic Client Registration</strong>: deprecated in favour of Client ID Metadata Documents (next page).</li>
    </ul>
    <p>Deprecated features still <strong>work</strong>, but new implementations shouldn't adopt them. The spec keeps a public registry of every deprecated feature.</p>`,
  why: `<p>Roots, Sampling and Logging all make the server depend on the client mid-request, or on shared mutable state. The direct alternatives are simpler and already standard. The lifecycle policy gives everyone a predictable runway instead of surprise removals.</p>`,
  payloads: [
    { t: 'Replacing Roots with an explicit parameter', before: { lang: 'json', d: 1, text:
`  // the server asked the client which folders it may touch
- {"jsonrpc": "2.0", "id": "srv-2", "method": "roots/list"}` },
      after: { lang: 'json', d: 1, text:
`  // the tool simply takes the folder as an argument
  {
    "name": "search_code",
    "inputSchema": {
      "type": "object",
      "properties": {
+       "path": { "type": "string", "description": "Folder to search, e.g. file:///projects/myapp" },
        "query": { "type": "string" }
      },
      "required": ["path", "query"]
    }
  }` }, cap: 'Roots still works during the window (now through MRTR inputRequests), but new servers shouldn\'t build on it.' },
    { t: 'includeContext in a sampling request', before: { lang: 'json', d: 1, text:
`  "params": {
    "messages": [ … ],
-   "includeContext": "allServers",
    "maxTokens": 400
  }` },
      after: { lang: 'json', d: 1, text:
`  "params": {
    "messages": [ … ],
*   "includeContext": "none",
    "maxTokens": 400
  }` } }
  ],
  impact: `
    <ul>
      <li>Nothing breaks today. But any new feature built on Roots, Sampling or Logging is building on borrowed time.</li>
      <li>Plan the migration inside the window: a removal can only come in a revision at least twelve months after deprecation.</li>
    </ul>`,
  test: { blocks: [{ label: 'Audit your code', text:
`# Find code that depends on deprecated features
grep -rnE 'roots/list|sampling/createMessage|logging/setLevel|includeContext|notifications/message' src/
grep -rnE '/register|registration_endpoint' src/    # Dynamic Client Registration
grep -rnE 'text/event-stream.*GET|/sse\\b' src/      # old HTTP+SSE endpoints` }] },
  exciting: `<p>MCP now evolves like a mature standard: changes announced in advance, a public registry, and a guaranteed runway. That's what lets enterprises commit to it.</p>`,
  quiz: [
    { q: 'What is the minimum time between a feature becoming Deprecated and being Removed?', o: ['One revision', 'Six months', 'Twelve months', 'There is no minimum'], a: 2,
      x: 'The lifecycle policy guarantees <b>at least twelve months</b> in the Deprecated state before removal.' },
    { q: 'The suggested replacement for Sampling is…', o: ['MRTR', 'Calling the LLM provider\'s API directly', 'The Tasks extension', 'Elicitation'], a: 1,
      x: 'Integrate directly with LLM provider APIs. (Sampling still works during the window, and is now carried inside MRTR inputRequests.)' }
  ],
  links: [['Deprecated features registry', S + '/deprecated'], ['Feature lifecycle policy', 'https://modelcontextprotocol.io/community/feature-lifecycle']]
},
{
  id: 'auth', short: 'Auth tightening', tag: 'deprecated', tagLabel: 'Shifting', domain: 'Security & Governance · 24%',
  title: 'OAuth: metadata documents, issuer checks, bound credentials',
  lede: 'Clients move from registering dynamically to identifying themselves by a URL. Several MUSTs close known OAuth attacks.',
  what: `
    <ul>
      <li><strong>Client ID Metadata Documents (CIMD)</strong> replace Dynamic Client Registration (DCR) as the preferred method. The client's <code>client_id</code> is an HTTPS URL; the authorization server fetches it to learn the client's name and redirect URIs. DCR remains for authorization servers that don't support CIMD.</li>
      <li><strong>Issuer in the response (RFC 9207).</strong> Authorization servers SHOULD add <code>iss</code> to the authorization response. If it's present, the client <strong>MUST</strong> check it against the issuer it recorded, <em>before</em> exchanging the code for a token.</li>
      <li><strong>Credentials are bound to their issuer.</strong> Clients MUST store them keyed by issuer, MUST NOT reuse them with another authorization server, and MUST register again if the authorization server changes.</li>
      <li><strong><code>application_type</code></strong> must be set correctly in DCR, to avoid OpenID Connect redirect-URI conflicts.</li>
    </ul>
    <p>Unchanged, and still heavily tested: tokens must be audience-bound to <em>your</em> server; never pass a client's token through to another service; <code>401</code> means a missing or bad token, <code>403</code> a valid token with too little scope; stdio servers take credentials from the environment.</p>`,
  why: `<p>With thousands of MCP clients, registering each one with each authorization server doesn't scale, while a URL-based identity does. The issuer check and credential binding close the <strong>mix-up attack</strong>, where a malicious authorization server tricks a client into sending a code or credentials meant for another one.</p>`,
  seq: {
    after: { actors: ['Client', 'Auth server', 'Client\'s URL'], steps: [
      { f: 0, t: 1, l: 'authorize  client_id=https://app…/client.json', k: 'add' },
      { f: 1, t: 2, l: 'GET client metadata document', k: 'add' },
      { f: 2, t: 1, l: 'name, redirect_uris, …', d: 1 },
      { f: 1, t: 0, l: 'redirect: code + state + iss', k: 'add', d: 1 },
      { n: 'Client checks iss == recorded issuer, or stops', a: 0, b: 0, k: 'acc' },
      { f: 0, t: 1, l: 'token request (code)' } ] }
  },
  payloads: [
    { t: 'The redirect back to the client', before: { lang: 'text', d: 1, text:
`  GET https://app.example.com/callback?code=SplxlOBeZQQYbYS6WxSbIA&state=af0ifjsldkj` },
      after: { lang: 'text', d: 1, text:
`  GET https://app.example.com/callback?code=SplxlOBeZQQYbYS6WxSbIA&state=af0ifjsldkj
+     &iss=https%3A%2F%2Fauth.example.com
  // the client MUST compare iss with the issuer it started with before redeeming the code` } },
    { t: 'How the client identifies itself', before: { lang: 'json', d: 1, text:
`  // DCR (deprecated): register first, receive an opaque id
- POST /register
- { "client_name": "ExampleClient", "redirect_uris": ["https://app.example.com/callback"] }
- → { "client_id": "s6BhdRkqt3" }` },
      after: { lang: 'json', d: 1, text:
`  // CIMD: the client_id IS a URL the authorization server can fetch
+ client_id=https://app.example.com/oauth/client-metadata.json

  // which serves a document such as:
  {
    "client_id": "https://app.example.com/oauth/client-metadata.json",
    "client_name": "ExampleClient",
    "redirect_uris": ["https://app.example.com/callback"]
  }` }, cap: 'Illustrative values. See the client registration page for the required metadata fields.' }
  ],
  impact: `
    <ul>
      <li>Clients without an issuer check, or that share credentials across authorization servers, are now non-compliant and vulnerable to mix-up attacks.</li>
      <li>Servers (resource servers) see little change, but if you also run the authorization server, plan CIMD support.</li>
    </ul>`,
  test: { blocks: [{ label: 'Checks', text:
`# Run these against your client with a test authorization server
# 1. Return a redirect with iss = a DIFFERENT issuer: the client must refuse to redeem the code
# 2. Point the client at a new authorization server: it must register again, not reuse credentials
# 3. Call your MCP server with a valid token minted for ANOTHER audience: expect 401
# 4. A valid token with too little scope: expect 403 with a WWW-Authenticate scope hint` }] },
  exciting: `<p>Any client can work with any authorization server without a registration step: identity is just a URL you control. With issuer binding, multi-server setups are secure by default instead of by careful configuration.</p>`,
  quiz: [
    { q: 'Which check stops a mix-up attack?', o: ['Validating the Origin header', 'Comparing the iss parameter with the recorded issuer before redeeming the code', 'Setting cacheScope to private', 'Using PKCE alone'], a: 1,
      x: '<b>RFC 9207 issuer identification.</b> The client confirms the response came from the authorization server it started with, and keeps credentials bound to that issuer.' }
  ],
  links: [['Authorization', S + '/basic/authorization'], ['Client registration', S + '/basic/authorization/client-registration'], ['Security best practices', 'https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices']]
},
{
  id: 'wrap', short: 'Wrap-up', tag: 'orientation', tagLabel: 'Review', domain: 'All domains',
  title: 'Putting it together: migrating one server',
  lede: 'The whole revision as a to-do list, in the order you\'d actually do it. If you can explain each line without scrolling back, you\'re ready.',
  what: `
    <ol>
      <li><strong>Find all per-session state.</strong> Turn each item into a handle passed as a tool argument, or remove it.</li>
      <li><strong>Find every place the server talks first</strong> (elicitation, sampling, roots) and turn it into <code>input_required</code> with a protected <code>requestState</code>.</li>
      <li><strong>Make handlers re-entrant</strong>, so a retry carrying <code>inputResponses</code> resumes instead of restarting.</li>
      <li><strong>Implement <code>server/discover</code></strong>. It's mandatory.</li>
      <li><strong>Read version and capabilities from each request's <code>_meta</code>.</strong> Return <code>-32602</code>, <code>-32021</code> or <code>-32022</code> correctly.</li>
      <li><strong>Add <code>resultType</code></strong> to every result, and <code>ttlMs</code> plus <code>cacheScope</code> to lists, reads and discovery.</li>
      <li><strong>Validate HTTP headers against the body</strong>: <code>400</code> with <code>-32020</code> on mismatch.</li>
      <li><strong>Replace GET and subscribe</strong> with <code>subscriptions/listen</code>, tagging notifications with <code>subscriptionId</code>.</li>
      <li><strong>Treat a closed stream as cancellation</strong>, and delete replay and <code>Last-Event-ID</code> code.</li>
      <li><strong>Remove <code>ping</code> and <code>setLevel</code></strong>, log only when <code>logLevel</code> is present, and switch not-found to <code>-32602</code>.</li>
      <li><strong>Move long-running work to the Tasks extension</strong> where it fits.</li>
      <li><strong>Decide: dual-era or modern-only.</strong> If modern-only, make the error to <code>initialize</code> name your supported versions.</li>
    </ol>`,
  extra: `
    <div class="grid2">
      <div class="card"><h3>Error codes to know</h3><p><code>-32020</code> header mismatch · <code>-32021</code> missing client capability · <code>-32022</code> unsupported version · <code>-32602</code> invalid params and resource not found · <code>-32601</code> method not found (HTTP 404)</p></div>
      <div class="card"><h3>The one-line summary</h3><p>Every request stands alone, the server never initiates, and state is an explicit handle.</p></div>
      <div class="card"><h3>Next</h3><p>Read the <a href="https://modelcontextprotocol.io/specification/2026-07-28/changelog">official changelog</a> once more, then move on to <a href="https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices">security best practices</a>: Security &amp; Governance is 24% of the MCPA exam.</p></div>
    </div>`,
  quiz: [
    { q: 'A legacy client sends initialize to a modern-only HTTP server. What is the most useful thing the server can do?', o: ['Silently accept and create a session', 'Reject it, naming the protocol versions it supports', 'Redirect to server/discover', 'Return 200 with an empty result'], a: 1,
      x: 'Legacy clients can\'t fall forward, so the error message is the only diagnostic they can show. A modern-only server <b>SHOULD name its supported versions</b> in it. (Over HTTP, the request will already fail header validation with 400.)' },
    { q: 'Which of these is still allowed in 2026-07-28?', o: ['A server sending elicitation/create on the response stream', 'A server answering tools/call with resultType "input_required"', 'A client resuming a stream with Last-Event-ID', 'A server minting Mcp-Session-Id'], a: 1,
      x: 'MRTR\'s <b>input_required</b> is the modern replacement for server-initiated requests. The other three are all removed.' }
  ],
  links: [['Key changes (changelog)', S + '/changelog'], ['Full specification', S]]
}
];

