/* Per-lesson extras: an exam TL;DR, a real-life story, and extra scenario questions.
   Stories are hypothetical scenarios, written to make each rule memorable. */
const EXTRAS = {
start: {
  tldr: ['Every request carries its own version, capabilities and identity in _meta.', 'Servers never send requests to clients; they return input_required instead.', 'State that outlives a request is an explicit handle the client passes back.'],
  story: { title: 'Black Friday, three pods, one restart', html: `
    <p>Picture an AI shopping assistant whose MCP server runs on three pods behind a round-robin load balancer. It's 9:02 on Black Friday. Under the legacy protocol, each shopper's session (their negotiated capabilities, their cart, the paused "which size?" question) lives in one pod's memory, so the load balancer has to pin every shopper to their pod.</p>
    <p>At 9:04 the busiest pod runs out of memory and restarts. Several thousand shoppers lose their sessions in the middle of checkout.</p>
    <p><strong>Under 2026-07-28 the same incident is a non-event.</strong> Every request says who's asking and what it supports, carts are handles stored in a shared database, and the "which size?" question travels inside the request. The next request goes to a healthy pod, which answers it without knowing the old one ever existed.</p>` }
},
handshake: {
  tldr: ['initialize and notifications/initialized are gone.', '_meta protocolVersion + clientCapabilities are REQUIRED on every request (clientInfo SHOULD).', '-32602 missing field · -32021 missing capability · -32022 unsupported version (all HTTP 400).'],
  story: { title: 'The serverless cold start', html: `
    <p>You deploy your MCP server as a serverless function. Each request may wake up a brand-new instance with empty memory.</p>
    <p>Under the legacy protocol that's a contradiction. Instance #1 handles <code>initialize</code> and then disappears; instance #2 gets <code>tools/call</code> and has no idea which version or capabilities were agreed. You end up bolting on a key-value store just to remember a handshake.</p>
    <p><strong>Now the first request is a complete request.</strong> Instance #2 reads the version and capabilities straight from <code>_meta</code> and answers. On a mobile agent with 300 ms of latency, dropping the <code>initialize</code> round trip also saves about a third of a second before the first useful answer.</p>` },
  moreQuiz: [
    { q: 'A tools/call needs to ask the user for confirmation, but this request\'s clientCapabilities is {}. What should the server do?',
      o: ['Return input_required with an elicitation/create request anyway', 'Return -32021 MissingRequiredClientCapability, listing elicitation in data.requiredCapabilities', 'Return -32602 Invalid params', 'Return HTTP 403 Forbidden'], a: 1,
      x: 'A server <b>MUST NOT</b> rely on capabilities the client did not declare on <em>this</em> request. If it can\'t proceed without one, it returns <b>-32021</b> (HTTP 400) and lists the missing capability in <code>data.requiredCapabilities</code>.' }
  ]
},
discover: {
  tldr: ['Servers MUST implement server/discover; clients MAY call it.', 'Returns supportedVersions, capabilities (incl. extensions), instructions, serverInfo, plus ttlMs/cacheScope.', 'On stdio it is the probe that tells a modern server from a legacy one.'],
  story: { title: 'Cataloguing 500 internal servers', html: `
    <p>Your platform team runs an internal "MCP marketplace" that lists every server the company runs: 500 of them, with their tools and whether they support Tasks.</p>
    <p>In the legacy world, the nightly crawler had to <code>initialize</code> each server, call three different list methods, and tear the session down. Some servers rate-limited it; others kept zombie sessions around.</p>
    <p><strong>Now it's one <code>server/discover</code> call per server.</strong> The answer is marked <code>cacheScope: "public"</code> with a one-hour TTL, so the company gateway serves repeat lookups from cache. The marketplace shows a green "2026-07-28" badge for servers whose <code>supportedVersions</code> include it, and flags the ones that still answer with a legacy error.</p>` },
  moreQuiz: [
    { q: 'A dual-era client sends server/discover over stdio and gets back "Method not found" from a server it has never seen. What should it do?',
      o: ['Retry server/discover with a different protocol version', 'Treat the server as legacy and fall back to initialize', 'Give up: the server is broken', 'Open a subscriptions/listen stream instead'], a: 1,
      x: 'A non-modern error (or a timeout) to the probe means a <b>legacy</b> server, so fall back to <code>initialize</code>. Only a recognised modern error such as -32022 means "modern, but pick another version". Cache the answer for that server process.' }
  ]
},
headers: {
  tldr: ['MCP-Protocol-Version must equal the _meta version; Mcp-Method on every POST; Mcp-Name on tools/call, resources/read, prompts/get.', 'x-mcp-header mirrors a primitive tool parameter into Mcp-Param-{Name}.', 'Any header/body mismatch: HTTP 400 with -32020 HeaderMismatch.'],
  story: { title: 'Data residency at the edge', html: `
    <p>A bank runs one MCP endpoint for analysts worldwide. European customer data must never leave the EU.</p>
    <p>Its <code>execute_sql</code> tool marks <code>region</code> with <code>x-mcp-header</code>, so every call arrives with <code>Mcp-Param-Region: eu-west1</code>. The edge gateway routes on that header alone and never parses the JSON body. A firewall rule blocks <code>Mcp-Name: drop_*</code> for contractor tokens.</p>
    <p>Then an attacker crafts a request whose header says <code>get_balance</code> but whose body says <code>transfer_funds</code>, hoping the gateway approves one while the server runs the other. <strong>The server compares the two, finds a mismatch, and returns 400 with -32020.</strong> That one rule is why the routing is safe to trust.</p>` },
  moreQuiz: [
    { q: 'Which tool parameter may carry an x-mcp-header annotation?',
      o: ['latitude, type "number"', 'region_id, type "integer", directly under properties', 'tags, an array of strings', 'a string inside a oneOf branch'], a: 1,
      x: 'Only <b>primitive types (string, integer, boolean, never number)</b>, reachable from the schema root through <code>properties</code> keys alone: no arrays, no composition keywords, no <code>$ref</code>. Clients must drop a tool whose annotation breaks these rules.' }
  ]
},
sessions: {
  tldr: ['No Mcp-Session-Id, no protocol sessions; modern-only servers SHOULD answer GET/DELETE with 405.', 'Cross-call state MUST be referenced by an explicit identifier, e.g. a server-minted handle passed as a tool argument.', 'Bind every handle to the authenticated user and check it on every call (state handle hijacking).'],
  story: { title: 'The order that survived a deploy', html: `
    <p>A food-delivery assistant builds an order over six tool calls in ten minutes: restaurant, two mains, a drink, an address, a tip. Halfway through, your Kubernetes cluster rolls out a new version and every pod is replaced.</p>
    <p>Legacy: the order lived in the old pod's session map. The user hears "Sorry, let's start again."</p>
    <p><strong>Now: the first call returned <code>orderId: "ord_7Kq…"</code>, stored in a database.</strong> The new pods look it up and carry on. Because the handle is visible to the model, the user can switch from phone to laptop and say "add fries to my order", and it still works.</p>
    <p>The twist: an attacker notices the handles look like <code>ord_0001</code>, <code>ord_0002</code>… and tries other people's orders. That's <em>state handle hijacking</em>. Unguessable IDs, plus an ownership check on every call, stop it.</p>` },
  moreQuiz: [
    { q: 'Your handles are random UUIDs. Is that enough to prevent state handle hijacking?',
      o: ['Yes: nobody can guess a UUID', 'No: handles can leak through logs, screenshots or a shared transcript, so the server must also check that the authenticated caller owns the handle on every call', 'Yes, if they expire after 24 hours', 'No: you also need an Mcp-Session-Id'], a: 1,
      x: 'Unguessable is necessary but not sufficient. Treat the handle as a <b>name, not a password</b>: bind it to the principal from the access token and verify ownership on every request.' }
  ]
},
mrtr: {
  tldr: ['Servers no longer send elicitation, sampling or roots requests; they return resultType "input_required" with inputRequests and/or requestState.', 'The client retries the same request with a NEW id, inputResponses, and the exact requestState.', 'Only tools/call, resources/read, prompts/get. requestState is attacker-controlled: protect it when it matters.'],
  story: { title: 'The deploy that waited for lunch', html: `
    <p>A developer tells their agent "deploy payments-service to production". The deploy tool needs a human confirmation: <em>type the service name to confirm</em>. The developer is already walking to lunch.</p>
    <p>Legacy: the server sent <code>elicitation/create</code> on an open stream and waited. A worker and a socket were held open, and after 60 seconds the corporate proxy killed the idle stream. When the developer came back, the deploy had silently failed.</p>
    <p><strong>2026-07-28: the server answers <code>input_required</code> and forgets about it.</strong> Nothing is held open. Forty minutes later the developer types "payments-service", the client retries with a new id, and whichever instance receives it reads the signed <code>requestState</code> and deploys.</p>
    <p>The security twist: a compromised client edits <code>requestState</code> to swap "staging" for "production". The signature check fails, and the server rejects it. That's why the spec calls requestState <em>attacker-controlled</em>.</p>` },
  moreQuiz: [
    { q: 'Spot the bug: after input_required, a client retries with "id": 1 (the same id as the first request), the same arguments, inputResponses, and the exact requestState.',
      o: ['Nothing; this is correct', 'The id must be different: the retry is a new, independent request', 'requestState must be omitted on the retry', 'inputResponses must be sent as a separate notification'], a: 1,
      x: 'The JSON-RPC <b>id MUST differ</b> between the initial request and the retry. They are two independent requests; reusing the id breaks correlation.' }
  ]
},
results: {
  tldr: ['Every result carries resultType: "complete", "input_required", or an extension value such as "task". Absent means complete.', 'Lists, reads and server/discover MUST carry ttlMs (≥ 0 ms) and cacheScope ("public" or "private").', 'A change notification invalidates a cached entry at once; MRTR interim results and retries are never cached.'],
  story: { title: 'Two thousand agents, one tool list', html: `
    <p>Your company gateway serves 2,000 employees' agents, and each calls <code>tools/list</code> at the start of every conversation. That's thousands of identical calls a minute hitting your servers.</p>
    <p><strong>With <code>ttlMs: 300000</code> and <code>cacheScope: "public"</code>, the gateway answers from cache.</strong> Your server sees one call every five minutes. Because the order is deterministic, the model's prompt prefix stays the same, so LLM prompt caching kicks in too.</p>
    <p>The cautionary tale: a developer marks <code>resources/read</code> of <code>app://me/payroll</code> as <code>"public"</code>. The gateway caches Alice's salary and serves it to Bob. <code>cacheScope</code> is a promise about the data, and the spec says plainly that it is not an access control.</p>` },
  moreQuiz: [
    { q: 'An older server returns a tools/list result with no ttlMs. How long should a modern client consider it fresh?',
      o: ['Five minutes, the default', 'Not at all: treat a missing ttlMs as 0 (immediately stale) and rely on its own heuristics or notifications', 'Forever, until a list_changed notification arrives', 'One hour, like server/discover'], a: 1,
      x: 'A missing <code>ttlMs</code> SHOULD be treated as <b>0</b>. A negative value is also treated as 0. Servers implementing 2026-07-28 MUST send a value ≥ 0.' }
  ]
},
listen: {
  tldr: ['GET streams and resources/subscribe are gone; use subscriptions/listen with an opt-in filter.', 'The first message is notifications/subscriptions/acknowledged; every notification carries subscriptionId = the listen request id.', 'Progress and log messages stay on their own request stream, never on the listen stream.'],
  story: { title: 'The tool palette that updates itself', html: `
    <p>Your IDE has an MCP tool palette. At 14:05 the docs team ships a new <code>search_changelog</code> tool on their server.</p>
    <p>The IDE opened one <code>subscriptions/listen</code> with <code>toolsListChanged: true</code> when it started. Seconds later <code>notifications/tools/list_changed</code> arrives, the IDE invalidates its cached list, and the new tool appears without a restart.</p>
    <p>Meanwhile a phone client listening only to <code>resourceSubscriptions: ["file:///team/oncall.json"]</code> gets nothing but on-call rota changes. Opting in by type keeps a phone's battery and data plan out of everyone else's noise.</p>` },
  moreQuiz: [
    { q: 'A client opens subscriptions/listen with only {"toolsListChanged": true}. A watched resource changes on the server. What should the client receive on that stream?',
      o: ['notifications/resources/updated, tagged with the subscriptionId', 'Nothing: the server MUST NOT send notification types the client did not request', 'A new acknowledgement', 'notifications/progress'], a: 1,
      x: 'The filter is strict: servers <b>MUST NOT</b> send notification types the client did not explicitly request.' }
  ]
},
streams: {
  tldr: ['No Last-Event-ID and no resumable SSE; a dropped stream loses the request, and the client re-issues it with a NEW id.', 'On Streamable HTTP, closing the response stream IS the cancellation; the server SHOULD stop and MUST NOT send more.', 'notifications/cancelled is still used on stdio. For work that must survive disconnects, use Tasks.'],
  story: { title: 'The laptop lid at minute two', html: `
    <p>A user asks their agent for a ten-minute "annual report with charts", then closes their laptop lid two minutes in.</p>
    <p>Legacy: nothing told the server. It spent eight more minutes of API credits on a report nobody would read, and if the tool ended with "email it to the team", it sent that too.</p>
    <p><strong>Now: the lid closes, the stream closes, and that is the cancellation.</strong> The server aborts and spends nothing more. If the report had to survive a closed lid, the server would have returned a Task handle instead, and the client could pick it up the next morning.</p>` }
},
removed: {
  tldr: ['ping and logging/setLevel are removed; the log level is per request via _meta io.modelcontextprotocol/logLevel.', 'Without logLevel, the server MUST NOT send notifications/message for that request.', 'Resource not found is now -32602 (accept -32002 from old servers); notifications/elicitation/complete, elicitationId and -32042 are gone.'],
  story: { title: '3 a.m., one failing call', html: `
    <p>It's 3 a.m. One customer's <code>build_report</code> call fails; everyone else is fine.</p>
    <p>Legacy: you send <code>logging/setLevel: debug</code>, and every user on that server now floods your log pipeline. The bill spikes and the one line you need is buried.</p>
    <p><strong>Now: you replay just that customer's call with <code>"io.modelcontextprotocol/logLevel": "debug"</code>.</strong> Debug lines come back on that one response stream and nowhere else.</p>
    <p>Meanwhile your Kubernetes liveness probe, which used <code>ping</code>, starts getting 404s and restarting healthy pods. Switch it to a plain <code>/healthz</code> endpoint, or to <code>server/discover</code>.</p>` },
  moreQuiz: [
    { q: 'Your container health check used MCP ping. After upgrading to 2026-07-28 it fails. What is the best replacement?',
      o: ['Send logging/setLevel as a probe', 'A plain HTTP health endpoint, or a cheap server/discover call', 'Keep ping; servers must still answer it', 'Open a subscriptions/listen stream and watch for keep-alives'], a: 1,
      x: '<code>ping</code> is <b>removed</b>. Use an ordinary HTTP health endpoint, or <code>server/discover</code>, which every modern server MUST implement and which is cheap and cacheable.' }
  ]
},
tasks: {
  tldr: ['Tasks is an opt-in extension (io.modelcontextprotocol/tasks), declared per request and advertised in server/discover.', 'The server may answer with resultType "task"; the client polls tasks/get, answers questions with tasks/update, and may send tasks/cancel.', 'tasks/result and tasks/list are removed. Statuses: working, input_required, completed, failed, cancelled (the last three are terminal).'],
  story: { title: 'The test suite on the train', html: `
    <p>On the train, an engineer asks their agent to "run the full integration suite and deploy to staging if it's green". It takes 25 minutes.</p>
    <p>The server answers with <code>resultType: "task"</code>, so the phone just stores <code>taskId</code>. The train enters a tunnel and the connection dies. Nothing is lost: the task lives on the server.</p>
    <p>At minute 18, the task moves to <code>input_required</code>: "3 flaky tests failed. Deploy anyway?" The engineer, now at their desk with a laptop, sees the question on the next <code>tasks/get</code> and answers "no" with <code>tasks/update</code>. Same task ID, different device, no session in sight.</p>` }
},
deprecated: {
  tldr: ['Deprecated (still working, at least 12 months to removal): Roots, Sampling, Logging, HTTP+SSE, includeContext "thisServer"/"allServers", Dynamic Client Registration.', 'Replacements: explicit path parameters (Roots), direct LLM API calls (Sampling), stderr or OpenTelemetry (Logging).', 'Lifecycle: Active → Deprecated → Removed, with a public registry.'],
  story: { title: 'The code-search tool on borrowed time', html: `
    <p>Your team's <code>search_code</code> tool asks the client which folders it may read, using Roots. It works today.</p>
    <p>But Roots is deprecated, so a future revision can remove it, no sooner than twelve months out. Migrating now is a one-line schema change: add a <code>path</code> parameter. As a bonus, the user sees and approves the exact folder in the tool call instead of a hidden list.</p>
    <p>Same story for Sampling. Your summariser used to borrow the client's model. Calling the LLM API directly lets you pick the model, set your own budget, and stop depending on whatever model the user happens to run.</p>` }
},
auth: {
  tldr: ['Client ID Metadata Documents (a client_id that is an HTTPS URL) replace Dynamic Client Registration as the preferred method when the client isn\'t pre-registered.', 'Validate iss before redeeming the code; if the authorization server advertises iss support and iss is missing, reject the response.', 'DCR and pre-registered credentials are bound to their issuer; CIMD client IDs are portable.'],
  story: { title: 'Ten thousand authorization servers', html: `
    <p>You ship an MCP client used by 10,000 companies, each with its own identity provider.</p>
    <p>With Dynamic Client Registration, that's 10,000 registrations to create, store per issuer, rotate and clean up. <strong>With a Client ID Metadata Document, it's one URL you host:</strong> <code>https://yourapp.com/oauth/client.json</code>. Every authorization server fetches it, and you update your redirect URIs in one place.</p>
    <p>The attack this closes: a user connects your client to a legitimate server and to a malicious one. The malicious authorization server tries to make your client send it a code meant for the legitimate one, a <em>mix-up attack</em>. Your client compares <code>iss</code> with the issuer it started with, sees a mismatch, and refuses to redeem the code.</p>` },
  moreQuiz: [
    { q: 'An authorization server\'s metadata advertises authorization_response_iss_parameter_supported: true, but a redirect arrives with no iss parameter. What must the client do?',
      o: ['Accept it: iss is optional', 'Reject the authorization response', 'Redeem the code, then check the token\'s issuer', 'Ask the user whether to continue'], a: 1,
      x: 'When the authorization server says it supports <code>iss</code>, a missing <code>iss</code> <b>MUST</b> be rejected, and a present one must match the recorded issuer by simple string comparison.' }
  ]
},
wrap: {
  tldr: ['Every request stands alone.', 'The server never initiates.', 'State is an explicit handle.']
}
};
