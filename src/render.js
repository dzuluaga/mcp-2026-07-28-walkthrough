/* ---------- page rendering (runs at build time and in the browser) ---------- */
const SITE_TITLE = 'MCP 2026-07-28 Walkthrough';
const BASE = '/mcpa';   // served at diegozuluaga.dev/mcpa/
const slug = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

/* Two tracks share one site: the July changes, then core MCP & security */
const TRACKS = [
  { id: 'core', name: 'Core MCP & Security', label: 'Track 1', base: BASE + '/core/', blurb: 'Start here. How MCP works today, with no legacy content: hosts, clients and servers, the primitives, a tool call end to end, transports, authorization, the named attacks, consent, and the ecosystem.' },
  { id: 'changes', name: 'What changed in 2026-07-28', label: 'Track 2', base: BASE + '/', blurb: 'Then this. Each lesson takes one July 2026 change, shows the 2026-07-28 behaviour first, and keeps the old version folded away, so habits from earlier versions get replaced, not reinforced.' },
];
const ALL = (typeof CORE_LESSONS !== 'undefined' ? CORE_LESSONS.map(l => Object.assign(l, { track: 'core' })) : [])
  .concat(LESSONS.map(l => Object.assign(l, { track: l.track || 'changes' })));
const trackOf = l => TRACKS.find(t => t.id === l.track);
const inTrack = l => ALL.filter(x => x.track === l.track);
const lessonUrl = l => trackOf(l).base + l.id;   // no trailing slash: the diegozuluaga.dev router's :path* rule doesn't match one
const numOf = l => String(inTrack(l).indexOf(l)).padStart(2, '0');

const extrasOf = l => (typeof EXTRAS !== 'undefined' && EXTRAS[l.id]) || l.extras || {};
const quizzesOf = l => (l.quiz || []).concat(extrasOf(l).moreQuiz || [], (typeof PRACTICE_QUIZ !== 'undefined' && PRACTICE_QUIZ[l.id]) || []);
const whyWrong = (l, qi) => (typeof WHY_WRONG !== 'undefined' && WHY_WRONG[l.id + '#' + qi]) || (l.whyWrong && l.whyWrong[qi]) || {};

/* Primary MCPA domain for each lesson, with the exam's weights */
const DOMAINS = [
  { key: 'int', name: 'Interactions & Execution', weight: 26 },
  { key: 'sec', name: 'Security & Governance', weight: 24 },
  { key: 'use', name: 'Use Cases & Ecosystem', weight: 20 },
  { key: 'fun', name: 'MCP Fundamentals', weight: 16 },
  { key: 'arc', name: 'Architecture & Components', weight: 14 },
];
const LESSON_DOMAIN = { start: 'fun', handshake: 'fun', discover: 'arc', headers: 'arc', sessions: 'sec', mrtr: 'int', results: 'int', listen: 'int', streams: 'int', removed: 'int', tasks: 'int', deprecated: 'use', auth: 'sec', wrap: 'use' };
ALL.forEach(l => { if (l.examDomain) LESSON_DOMAIN[l.id] = l.examDomain; });

/* Deterministic shuffle so the correct answer isn't always in the same slot.
   Seeded by lesson + question, so the order is stable between visits. */
function optionOrder(seedText, n) {
  let h = 2166136261;
  for (const c of seedText) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

function lnk(anchor, label) {
  return '<button type="button" class="lnk" data-link="' + anchor + '" aria-label="Copy link to ' + esc(label || 'this section') + '" title="Copy link">#</button>';
}

/* Section headings differ by track: track 1 is about change, track 2 about how things work */
function sectionsOf(l) {
  const core = l.track === 'core', s = [];
  if (extrasOf(l).story) s.push(['real-life', 'In real life']);
  if (l.what) s.push(['what', l.id === 'wrap' ? 'The migration, in order' : core ? 'How it works' : 'What changed']);
  if (l.why) s.push(['why', core ? 'Why it matters' : 'Why it changed']);
  if (l.seq) s.push(['wire', 'On the wire']);
  if (l.payloads) s.push(['payloads', 'Payloads']);
  if (l.impact) s.push(['impact', core ? 'What goes wrong in practice' : 'What it does to an existing server']);
  if (l.test) s.push(['test', 'How to test it']);
  if (quizzesOf(l).length) s.push(['quiz', 'Check yourself']);
  if (l.links) s.push(['spec', 'Read the spec']);
  return s;
}

function railHTML(cur) {
  const t = trackOf(cur);
  return '<p class="rail-track">' + esc(t.label) + ' · ' + esc(t.name) + '</p><ol id="railList">' + inTrack(cur).map(l => {
    let li = '<li><a class="lesson" href="' + lessonUrl(l) + '" data-lesson="' + l.id + '"' + (l === cur ? ' aria-current="page"' : '') + '><span class="n">' + numOf(l) +
      '</span><span><span class="dot ' + l.tag + '" title="' + esc(l.tagLabel) + '"><span class="sr-only">' + esc(l.tagLabel) + ': </span></span>' + esc(l.short) + '</span><span class="ok"></span></a>';
    if (l === cur) li += '<ul class="toc">' + sectionsOf(l).map(([k, tt]) => '<li><a href="#' + k + '" data-toc="' + k + '">' + esc(tt) + '</a></li>').join('') + '</ul>';
    return li + '</li>';
  }).join('') + '</ol>' +
  TRACKS.filter(x => x.id !== t.id && ALL.some(l => l.track === x.id)).map(x => '<p class="rail-other"><a href="' + lessonUrl(ALL.find(l => l.track === x.id)) + '">' + esc(x.label) + ': ' + esc(x.name) + ' →</a></p>').join('');
}

/* Feedback address: written obfuscated in the HTML, assembled in the browser (see app.js) */
const REPO = 'https://github.com/dzuluaga/mcp-2026-07-28-walkthrough';
const SITE = 'https://www.diegozuluaga.dev';
function feedbackLine(subject, path) {
  const url = SITE + (path || BASE + '/');
  const issue = REPO + '/issues/new?title=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent('Page: ' + url + '\n\nWhat is wrong or unclear:\n\nWhat the spec says (link if you have one):\n');
  return '<p class="fb-line">Feedback or a correction? Email <a class="fb-mail" data-subject="' + esc(subject) + '">diego [at] diegozuluaga [dot] dev</a>' +
    ' or <a href="' + issue + '" target="_blank" rel="noopener">open an issue on GitHub</a>.</p>';
}

function sec(key, title, html) {
  return '<section class="sec" id="' + key + '"><div class="sec-h"><h2><a class="hl" href="#' + key + '">' + title + '</a></h2>' + lnk(key, title) + '</div>' + html + '</section>';
}

function quizHTML(l, q, qi, picked) {
  const answered = picked !== undefined && picked !== null;
  const a = 'q' + (qi + 1);
  const letters = 'ABCD';
  return '<div class="q" id="' + a + '" data-q="' + qi + '"><p class="q-t"><span class="q-n">Q' + (qi + 1) + '</span>' + esc(q.q) + lnk(a, 'question ' + (qi + 1)) + '</p><div class="opts">' +
    optionOrder(l.id + ':' + qi + ':' + q.q, q.o.length).map((oi, pos) => '<button type="button" class="opt' + (answered ? (oi === q.a ? ' right' : oi === picked ? ' wrong' : '') : '') + '" data-opt="' + oi + '"' + (answered ? ' disabled' : '') + '><span class="opt-l" aria-hidden="true">' + letters[pos] + '</span>' + esc(q.o[oi]) + '</button>').join('') +
    '</div>' + (answered ? feedbackHTML(l, q, qi, picked) + '<button type="button" class="q-reset" data-reset="' + qi + '">Try again</button>' : '') + '</div>';
}

function feedbackHTML(l, q, qi, picked) {
  const ww = whyWrong(l, qi);
  let h = '<div class="q-x">';
  if (picked === q.a) h += '<p><b>Correct.</b> ' + q.x + '</p>';
  else h += '<p><b>Not quite.</b> ' + (ww[picked] ? esc(ww[picked]) + ' ' : '') + '</p><p><b>The answer:</b> ' + esc(q.o[q.a]) + '. ' + q.x + '</p>';
  const others = q.o.map((o, i) => [o, i]).filter(([, i]) => i !== q.a && i !== picked && ww[i]);
  if (others.length) h += '<details class="why-not"><summary>Why not the other options?</summary><ul>' + others.map(([o, i]) => '<li><span class="wn-o">' + esc(o) + '</span> ' + esc(ww[i]) + '</li>').join('') + '</ul></details>';
  return h + '</div>';
}

function lessonBody(l) {
  const T = Object.fromEntries(sectionsOf(l)), list = inTrack(l), i = list.indexOf(l);
  let h = '<div class="kick"><span class="chip ' + l.tag + '">' + esc(l.tagLabel) + '</span><span class="chip domain">' + esc(l.domain) + '</span><span class="pos">' + esc(trackOf(l).label) + ' · ' + (i + 1) + ' / ' + list.length + '</span></div>';
  h += '<h1 id="top">' + esc(l.title) + '</h1><p class="lede">' + esc(l.lede) + '</p>';
  const au = typeof audioUrl === 'function' && audioUrl(l);
  if (au) h += '<p class="listen"><a class="listen-btn" href="' + au + '" target="_blank" rel="noopener"><span class="listen-ico" aria-hidden="true">🎧</span><span><strong>Listen to this lesson</strong><small>Audio overview in Gemini Notebook · about 15–25 min · opens in a new tab</small></span></a></p>';
  const X = extrasOf(l);
  if (X.tldr) h += '<aside class="tldr" aria-label="Exam TL;DR"><p class="tldr-h">Exam TL;DR</p><ul>' + X.tldr.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></aside>';
  if (X.story) h += sec('real-life', 'In real life', '<div class="story"><p class="story-t">' + esc(X.story.title) + '</p><div class="prose">' + X.story.html + '</div></div>');
  if (l.what) h += sec('what', T.what, '<div class="prose">' + l.what + '</div>');
  if (l.extra) h += '<section class="sec">' + l.extra + '</section>';
  if (l.why) h += sec('why', T.why, '<div class="call why prose">' + l.why + '</div>');
  if (l.seq) {
    const s = l.seq, both = s.before && s.after;
    const labels = s.labels || ['Legacy', '2026-07-28'];
    const eraDiagram = !s.labels;                     // legacy vs current: show current first
    const showFirst = eraDiagram ? 'after' : 'before';
    const prompt = s.prompt || 'This is how it works in <strong>2026-07-28</strong>. Switch to <em>Legacy</em> only to see what it replaced.';
    h += sec('wire', T.wire, '<figure class="fig" style="margin:0"><div class="fig-bar"><strong>' + esc(s.title || (both ? 'Same job, two eras' : 'Message flow in 2026-07-28')) + '</strong>' +
      (both ? '<div class="seg-wrap"><span class="seg-l" id="seg-l">Compare</span><div class="seg" role="group" aria-labelledby="seg-l"><button type="button" data-era="before" aria-pressed="' + (showFirst === 'before') + '">' + esc(labels[0]) + '</button><button type="button" data-era="after" aria-pressed="' + (showFirst === 'after') + '">' + esc(labels[1]) + '</button></div></div>' : '') +
      '</div>' + (both ? '<p class="fig-prompt">' + prompt + '</p>' : '') +
      '<div class="fig-scroll" tabindex="0" role="region" aria-label="Sequence diagram, scrolls sideways">' + (s.before ? '<div data-pane="before"' + (both && showFirst !== 'before' ? ' hidden' : '') + '>' + seqSVG(s.before) + '</div>' : '') +
      (s.after ? '<div data-pane="after"' + (both && showFirst !== 'after' ? ' hidden' : '') + '>' + seqSVG(s.after) + '</div>' : '') + '</div>' +
      '<figcaption class="fig-cap">Solid arrows are requests, dashed are responses or notifications. <span style="color:var(--del)">Red ✕</span> ' + (l.track === 'core' ? 'is the unsafe or failing step' : 'is gone') + '; <span style="color:var(--add)">green</span> ' + (l.track === 'core' ? 'is the step that keeps you safe' : 'is new') + '.</figcaption></figure>');
  }
  if (l.payloads) {
    h += sec('payloads', T.payloads, l.payloads.map(p => {
      const a = 'payload-' + slug(p.t), eras = p.eras || ['legacy', 'modern'];
      return '<div class="pay" id="' + a + '"><p class="pay-t"><a class="hl" href="#' + a + '">' + esc(p.t) + '</a>' + lnk(a, p.t) + '</p>' +
        (eras[0] === 'legacy' && p.after
          ? codeBlock(p.after, p.after.label || '', eras[1]) + (p.before ? '<details class="legacy-fold"><summary>What it used to look like (legacy, for comparison only)</summary>' + codeBlock(p.before, p.before.label || 'before', eras[0]) + '</details>' : '')
          : (p.before ? codeBlock(p.before, p.before.label || 'before', eras[0]) : '') + (p.after ? codeBlock(p.after, p.after.label || (p.before ? 'after' : ''), eras[1]) : '')) +
        (p.cap ? '<p class="pay-cap">' + esc(p.cap) + '</p>' : '') + '</div>';
    }).join(''));
  }
  if (l.impact) h += sec('impact', T.impact, '<div class="call impact prose">' + l.impact + '</div>');
  if (l.test) h += sec('test', T.test,
    '<details class="setup"' + (l.id === 'handshake' ? ' open' : '') + '><summary>' + (l.id === 'handshake' ? 'Set up the test helper (once per terminal)' : 'First time here? Set up the test helper (once per terminal)') + '</summary>' +
      codeBlock({ text: TEST_SETUP, lang: 'sh' }, 'Setup', 'shell', 'test-setup') + '</details>' +
    (l.test.intro ? '<div class="prose">' + l.test.intro + '</div>' : '') +
    l.test.blocks.map(b => codeBlock({ text: b.text, lang: 'sh' }, b.label, 'shell', 'test-' + slug(b.label))).join(''));
  const Q = quizzesOf(l);
  if (Q.length) h += sec('quiz', T.quiz, '<p class="quiz-note">Answer all ' + Q.length + ' correctly and this lesson is marked as learned.</p>' + Q.map((q, qi) => quizHTML(l, q, qi)).join(''));
  if (l.links) h += sec('spec', T.spec, '<div class="links">' + l.links.map(([t, u]) => '<a href="' + u + '" target="_blank" rel="noopener">' + esc(t) + ' ↗</a>').join('') + '</div>');
  h += feedbackLine('[MCPA course] ' + trackOf(l).label + ' · ' + l.short, lessonUrl(l));
  const k = ALL.indexOf(l), prev = ALL[k - 1], next = ALL[k + 1];
  const crossNext = next && next.track !== l.track, crossPrev = prev && prev.track !== l.track;
  h += '<div class="nav">' +
    (prev ? '<a class="btn prev" rel="prev" href="' + lessonUrl(prev) + '"><small>← ' + (crossPrev ? 'Back to ' + esc(trackOf(prev).label) : 'Previous') + '</small>' + esc(prev.short) + '</a>' : '<a class="btn prev" href="' + BASE + '/"><small>← Contents</small>All lessons</a>') +
    '<button type="button" class="btn learn" id="learnBtn" data-id="' + l.id + '">Mark as learned</button>' +
    (next ? '<a class="btn next" rel="next" href="' + lessonUrl(next) + '"><small>' + (crossNext ? 'Start ' + esc(trackOf(next).label) + ' →' : 'Next →') + '</small>' + esc(crossNext ? trackOf(next).name : next.short) + '</a>' : '<a class="btn next" href="' + BASE + '/exam"><small>Done →</small>Take the final exam</a>') +
    '</div><p class="kbd">Tip: ← and → move between lessons. Hover any heading and press # to copy a link to it.</p>';
  return h;
}

function trackGrid(t) {
  return '<section class="track" id="' + t.id + '"><div class="track-h"><p class="eyebrow">' + esc(t.label) + '</p><h2>' + esc(t.name) + '</h2><p>' + esc(t.blurb) + '</p></div>' +
    '<ol class="lesson-grid">' + ALL.filter(l => l.track === t.id).map(l =>
      '<li><a class="lcard" href="' + lessonUrl(l) + '" data-lesson="' + l.id + '"><span class="lc-top"><span class="n">' + numOf(l) + '</span><span class="chip ' + l.tag + '">' + esc(l.tagLabel) + '</span><span class="ok"></span></span>' +
      '<strong>' + esc(l.short) + (typeof audioUrl === 'function' && audioUrl(l) ? ' <span class="lc-audio" title="Has an audio overview">🎧</span>' : '') + '</strong><span class="lc-d">' + esc(l.lede) + '</span></a></li>').join('') + '</ol></section>';
}

function indexBody() {
  const changes = ALL.find(l => l.track === 'changes');
  return '<p class="eyebrow">Model Context Protocol · specification revision 2026-07-28 · MCPA prep</p>' +
    '<h1>Learn MCP the way you\'ll use it</h1>' +
    '<p class="lede">Two tracks, one lesson per page. Every lesson starts with a real incident, shows the messages on the wire, and ends with tests you can run and questions that catch the classic mistakes.</p>' +
    '<p class="cta"><a class="btn learn" href="' + lessonUrl(ALL[0]) + '">Start: ' + esc(trackOf(ALL[0]).name) + ' →</a>' + (changes ? '<a class="btn" href="' + lessonUrl(changes) + '">Then: what changed in July →</a>' : '') + '<span class="resume" id="resume" hidden></span></p>' +
    '<p class="order-note">Recommended order: Track 1 teaches MCP as it is today, with no legacy content. Track 2 then shows each July 2026 change with the current behaviour first and the old version folded away, so you replace old habits instead of reinforcing them.</p>' +
    '<div class="practice">' +
      '<a class="pcard" href="' + BASE + '/exam"><strong>Final exam</strong><span>20 questions weighted like the real MCPA domains, drawn from both tracks, with a readiness score and links back to every weak spot.</span></a>' +
      '<a class="pcard" href="' + BASE + '/review"><strong>Review deck</strong><span>Every question you miss comes back after 1, 3 and 7 days until it sticks.</span></a>' +
      '<a class="pcard" href="' + BASE + '/reference-server.mjs" download><strong>Reference server</strong><span>One Node file, no dependencies. Every test command in the course runs against it: <code>node reference-server.mjs</code></span></a>' +
    '</div>' +
    TRACKS.filter(t => ALL.some(l => l.track === t.id)).map(trackGrid).join('') +
    '<p class="foot">Built from the public <a href="https://modelcontextprotocol.io/specification/2026-07-28">MCP specification, revision 2026-07-28</a>. Source on <a href="' + REPO + '">GitHub</a>. Payloads marked as verbatim come from the spec; others are labelled illustrative. Stories are hypothetical scenarios. When this site and the spec disagree, the spec wins.</p>' +
    feedbackLine('[MCPA course] General feedback');
}

function pageHTML(opts) {
  const l = opts.lesson || null;
  const title = l ? l.short + ' · ' + SITE_TITLE : SITE_TITLE;
  const desc = l ? l.lede : 'Learn MCP specification revision 2026-07-28 one lesson per page: real-world stories, diagrams, colour-coded payloads, runnable tests, a final exam and spaced review.';
  const k = l ? ALL.indexOf(l) : -1, prev = l && ALL[k - 1], next = l && ALL[k + 1];
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%232340B8%22/%3E%3Cpath d=%22M8 11h16M8 16h10M8 21h13%22 stroke=%22white%22 stroke-width=%222.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">' +
    '<link rel="stylesheet" href="' + BASE + '/style.css">' +
    (prev ? '<link rel="prev" href="' + lessonUrl(prev) + '">' : '') + (next ? '<link rel="next" href="' + lessonUrl(next) + '">' : '') +
    '</head><body data-page="' + (opts.page || (l ? 'lesson' : 'home')) + '" data-lesson="' + (l ? l.id : '') + '" data-prev="' + (prev ? lessonUrl(prev) : '') + '" data-next="' + (next ? lessonUrl(next) : '') + '">' +
    '<a class="skip" href="#main">Skip to content</a><header class="top"><div class="top-in"><a class="brand" href="' + BASE + '/">MCP 2026-07-28 <small>one lesson per page</small></a>' +
    '<nav class="toplinks" aria-label="Practice"><a href="' + BASE + '/exam"' + (opts.page === 'exam' ? ' aria-current="page"' : '') + '>Final exam</a><a href="' + BASE + '/review"' + (opts.page === 'review' ? ' aria-current="page"' : '') + '>Review <span id="dueBadge" class="due" hidden></span></a></nav>' +
    (l ? '<button type="button" class="here" id="hereBtn" title="Copy a link to the section you are reading">Copy link to here</button>' : '') +
    '<div class="prog" aria-live="polite"><span id="progTxt">' + ALL.length + ' lessons</span><span class="bar"><i id="progBar"></i></span></div>' +
    (l ? '<div class="pick"><select id="lessonPick" aria-label="Jump to lesson">' + TRACKS.map(t => '<optgroup label="' + esc(t.label + ' · ' + t.name) + '">' + ALL.filter(x => x.track === t.id).map(x => '<option value="' + lessonUrl(x) + '"' + (x === l ? ' selected' : '') + '>' + numOf(x) + ' · ' + esc(x.short) + '</option>').join('') + '</optgroup>').join('') + '</select></div>' : '') +
    '</div></header>' +
    (l
      ? '<div class="shell"><nav class="rail" aria-label="Lessons">' + railHTML(l) +
        '<div class="legend" aria-hidden="true">' + (l.track === 'core'
          ? '<div><span class="dot breaking"></span>Security-critical</div><div><span class="dot quiet"></span>Common source of bugs</div><div><span class="dot new"></span>Core concept</div><div><span class="dot deprecated"></span>Ecosystem</div><div><span class="dot orientation"></span>Orientation</div>'
          : '<div><span class="dot breaking"></span>Breaks a running server</div><div><span class="dot quiet"></span>Fails quietly or needs a tweak</div><div><span class="dot new"></span>New or redesigned</div><div><span class="dot deprecated"></span>Deprecated or shifting</div><div><span class="dot orientation"></span>Orientation and review</div>') + '</div></nav>' +
        '<main id="main">' + lessonBody(l) + '</main></div>'
      : '<main class="home" id="main">' + (opts.body || indexBody()) + '</main>') +
    '<div class="toast" id="toast" role="status" hidden></div><script src="' + BASE + '/app.js" defer></script></body></html>';
}
