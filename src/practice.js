/* Practice content: spot-the-bug questions for lessons that lacked one,
   and an explanation for every wrong option ("why not this one?"). */
const PRACTICE_QUIZ = {
  start: [
    { q: 'Spot the bug: on a stdio connection, a server reads clientCapabilities from the first request and reuses them for every later request on that connection.',
      o: ['Nothing; capabilities rarely change', 'Each request must be read on its own: requests on one connection may be unrelated, so capabilities come from that request\'s _meta', 'It should have called server/discover first', 'It should store them under an Mcp-Session-Id instead'], a: 1,
      x: 'Servers <b>MUST NOT</b> rely on prior requests over the same connection for context such as capabilities, version or client identity. Every request carries its own <code>_meta</code>.' }
  ],
  streams: [
    { q: 'Spot the bug: the SSE stream for tools/call id 7 drops. The client reconnects with GET /mcp and Last-Event-ID: 42 to pick up where it left off.',
      o: ['Nothing; this is how resumption works', 'Resumption is gone: re-issue the call as a NEW request with a new id', 'It should re-send the call with the same id 7', 'It should first send notifications/cancelled over HTTP'], a: 1,
      x: 'SSE resumability and <code>Last-Event-ID</code> were removed, and modern servers SHOULD answer GET with 405. A broken stream loses the in-flight request; the client <b>MUST</b> re-issue it as a new request with a new id.' }
  ],
  tasks: [
    { q: 'Spot the bug: a client that did NOT list io.modelcontextprotocol/tasks in its capabilities calls build_report, and the server answers with resultType "task".',
      o: ['Nothing; the server decides whether to create a task', 'The server must not return a task to a client that didn\'t declare the extension; it falls back to core behaviour or rejects the request', 'The client should start polling tasks/get anyway', 'The server should have returned input_required instead'], a: 1,
      x: 'The server decides per request, but <b>only for clients that declared the extension</b>. If one side doesn\'t support an extension, the other MUST revert to core protocol behaviour or reject the request with an error.' },
    { q: 'Your phone loses its connection while task t-123 is working. After reconnecting, what should the client do?',
      o: ['Call tasks/list to find its tasks', 'Call tasks/get with the taskId it stored', 'Re-send the original tools/call', 'Reconnect with Last-Event-ID to replay updates'], a: 1,
      x: 'The task ID is a <b>durable handle</b>: persist it and resume polling with <code>tasks/get</code>. <code>tasks/list</code> was removed, and re-sending the call would start the work a second time.' }
  ],
  deprecated: [
    { q: 'Spot the problem: a brand-new server built in 2026 uses MRTR to ask the client for roots, to learn which folders it may search.',
      o: ['Nothing; Roots is an active feature', 'It works, but builds on a deprecated feature; take the folder as an explicit tool parameter instead', 'It is forbidden: Roots was removed in 2026-07-28', 'It should listen for notifications/roots/list_changed instead'], a: 1,
      x: 'Roots is <b>deprecated, not removed</b>. It still works during the twelve-month window, but new implementations should not adopt it. <code>notifications/roots/list_changed</code> was removed outright.' }
  ]
};

/* WHY_WRONG['lesson#index'] = { optionIndex: 'why that option is wrong' } */
const WHY_WRONG = {
  'start#0': { 0: 'That was the legacy model. Now no request may rely on an earlier one on the same connection.', 2: 'stdio is still one of the two standard transports.', 3: 'A subscription is a specific request (subscriptions/listen), not the connection itself.' },
  'start#1': { 0: 'Capabilities can differ per request, and requests on one pipe may come from unrelated conversations.', 2: 'server/discover is optional for clients and doesn\'t create shared context either.', 3: 'Mcp-Session-Id no longer exists in 2026-07-28.' },
  'handshake#0': { 0: 'clientInfo is only a SHOULD, and it\'s for display and logs.', 2: 'clientInfo is recommended, not required.', 3: '_meta is mandatory: a request without the required fields gets -32602.' },
  'handshake#1': { 0: '-32601 is for an unknown method; here the method exists but the version doesn\'t.', 1: '-32602 is for missing or malformed parameters, such as a missing _meta field.', 3: 'Silent fallback is exactly what the error prevents: the client must choose a version from the supported list.' },
  'handshake#2': { 0: 'A server MUST NOT send input requests for capabilities the client didn\'t declare.', 2: '-32602 means malformed parameters; the request itself is fine.', 3: '403 is about authorization (scope or Origin), not missing client capabilities.' },
  'discover#0': { 0: 'Nothing replaced initialize as a mandatory first call; there is no first call.', 2: 'The rule is the same on stdio and HTTP.', 3: 'Extensions are advertised in discover, but calling it is still optional.' },
  'discover#1': { 0: 'A different version only helps when the error is a modern one, such as -32022.', 2: 'The server is fine; it just speaks the legacy protocol.', 3: 'Listening needs a modern server too, and doesn\'t answer the question.' },
  'headers#0': { 0: 'That is the very split the rule exists to prevent.', 1: 'The server must not run anything on a mismatched request.', 3: '404 with -32601 is for an unknown method, not a header mismatch.' },
  'headers#1': { 0: 'type "number" is explicitly not allowed (integers only).', 2: 'Arrays aren\'t primitives, and the path may not pass through items.', 3: 'The path may not pass through composition keywords such as oneOf.' },
  'sessions#0': { 0: 'Mcp-Session-Id is gone in 2026-07-28.', 1: 'Connection identity must never stand in for conversation identity.', 3: 'clientInfo is self-reported display data, not a place for state.' },
  'sessions#1': { 0: 'The standalone GET stream was removed; notifications come through subscriptions/listen.', 2: 'The endpoint exists; the method is what\'s no longer allowed, which is why it\'s 405.', 3: 'subscriptions/listen is a POST request; there is no redirect.' },
  'sessions#2': { 0: 'Unguessable isn\'t the same as secret: handles leak through logs and shared transcripts.', 2: 'Expiry shrinks the window but doesn\'t stop another user replaying a leaked handle.', 3: 'Sessions no longer exist, and wouldn\'t prove ownership anyway.' },
  'mrtr#0': { 0: 'The id MUST differ: the retry is a new, independent request.', 2: 'Answers travel in the retried request\'s params, not in a notification.', 3: 'MRTR needs no stream; the retry itself returns the result.' },
  'mrtr#1': { 0: 'Servers MUST NOT send input_required on any other request.', 2: 'resources/read and prompts/get may use it too.', 3: 'tools/list is never allowed to ask for input.' },
  'mrtr#2': { 0: 'MRTR results and retries are never cached.', 2: 'The format is up to the server: JWT, base64 JSON, or anything else.', 3: 'Clients MUST NOT inspect or parse requestState.' },
  'mrtr#3': { 0: 'Reusing the id breaks correlation; the retry is a separate request.', 2: 'The client MUST echo requestState exactly when one was sent.', 3: 'inputResponses go in the retried request\'s params.' },
  'results#0': { 0: '"public" lets shared gateways serve this user\'s data to other users.', 2: 'cacheScope is required on resources/read results.', 3: 'Being authenticated doesn\'t make data shareable; "public" means no user-specific data at all.' },
  'results#1': { 0: 'Only an unrecognised value is invalid; a missing one means an older server.', 2: 'input_required must be stated explicitly.', 3: 'There\'s nothing to retry: the result is complete.' },
  'results#2': { 0: 'There is no five-minute default.', 2: 'Without a TTL, the client can\'t assume freshness at all.', 3: 'Each result carries its own TTL; there is no shared default.' },
  'listen#0': { 0: 'The listen stream carries only the change notifications you opted in to.', 2: 'The GET stream was removed.', 3: 'Progress notifications still exist; they\'re request-scoped.' },
  'listen#1': { 0: 'It isn\'t random: it\'s the id of the listen request.', 2: 'Sessions are gone.', 3: 'The URI is the content of a notification, not its subscription.' },
  'listen#2': { 0: 'Only requested notification types may be sent.', 2: 'The acknowledgement is sent once, first.', 3: 'Progress belongs to individual requests.' },
  'streams#0': { 0: 'On HTTP, closing the stream is the signal; notifications/cancelled is for stdio.', 2: 'There are no sessions, and DELETE gets 405.', 3: 'tasks/cancel only applies to Tasks.' },
  'streams#1': { 0: 'Resumption via Last-Event-ID was removed.', 2: 'Re-issued requests MUST use a new id.', 3: 'On HTTP, closing the stream is the cancellation; there\'s nothing to send.' },
  'removed#0': { 0: 'There is no default level: no logLevel means no log notifications.', 1: 'logging/setLevel was removed, and nothing global persists.', 3: 'Log messages are request-scoped and never go on the listen stream.' },
  'removed#1': { 0: 'logging/setLevel was removed too.', 2: 'ping was removed; modern servers return 404 with -32601.', 3: 'Keep-alive comments don\'t prove the server can answer requests.' },
  'tasks#0': { 0: 'tasks/result was removed; clients poll with tasks/get.', 1: 'tasks/list was removed.', 3: 'No per-request flag: the client opts in once, and the server decides.' },
  'tasks#1': { 0: 'Only for clients that declared the extension.', 2: 'A client that didn\'t opt in can\'t be expected to handle tasks.', 3: 'input_required is MRTR, a different mechanism.' },
  'tasks#2': { 0: 'tasks/list was removed: persist your task IDs.', 2: 'That would start the work a second time.', 3: 'Last-Event-ID resumption was removed.' },
  'deprecated#0': { 0: 'Removal can only happen at least twelve months after deprecation.', 1: 'The window is twelve months, not six.', 3: 'The lifecycle policy guarantees a minimum.' },
  'deprecated#1': { 0: 'MRTR is how Sampling is now carried, not a replacement for it.', 2: 'Tasks is for long-running work.', 3: 'Elicitation asks the user, not a model.' },
  'deprecated#2': { 0: 'Roots is deprecated in 2026-07-28.', 2: 'It is deprecated, not removed: it still works during the window.', 3: 'That notification was removed outright.' },
  'auth#0': { 0: 'Origin validation stops DNS rebinding, not mix-up.', 2: 'cacheScope is about caching, not OAuth.', 3: 'PKCE alone doesn\'t stop a mix-up attack; the issuer check does.' },
  'auth#1': { 0: 'Once the authorization server advertises iss support, a missing iss must be rejected.', 2: 'The check must happen before the code is redeemed.', 3: 'This is a hard MUST, not a user choice.' },
  'wrap#0': { 0: 'A modern-only server has no sessions to create.', 2: 'Legacy clients can\'t follow it; they have no way forward.', 3: 'A fake success hides the real problem.' },
  'wrap#1': { 0: 'Servers may no longer send requests on response streams.', 2: 'Resumption was removed.', 3: 'Sessions were removed.' }
};
