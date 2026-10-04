/* ---------- page rendering (runs at build time and in the browser) ---------- */
const SITE_TITLE = 'MCP 2026-07-28 Walkthrough';
const slug = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const lessonUrl = l => '/' + l.id + '/';

const extrasOf = l => (typeof EXTRAS !== 'undefined' && EXTRAS[l.id]) || {};
const quizzesOf = l => (l.quiz || []).concat(extrasOf(l).moreQuiz || []);

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

function sectionsOf(l) {
  const s = [];
  if (extrasOf(l).story) s.push(['real-life', 'In real life']);
  if (l.what) s.push(['what', l.id === 'wrap' ? 'The migration, in order' : 'What changed']);
  if (l.why) s.push(['why', 'Why it changed']);
  if (l.seq) s.push(['wire', 'On the wire']);
  if (l.payloads) s.push(['payloads', 'Payloads, before and after']);
  if (l.impact) s.push(['impact', 'What it does to an existing server']);
  if (l.test) s.push(['test', 'How to test it']);
  if (quizzesOf(l).length) s.push(['quiz', 'Check yourself']);
  if (l.links) s.push(['spec', 'Read the spec']);
  return s;
}

function railHTML(cur) {
  return LESSONS.map((l, i) => {
    let li = '<li><a class="lesson" href="' + lessonUrl(l) + '" data-lesson="' + l.id + '"' + (i === cur ? ' aria-current="page"' : '') + '><span class="n">' + String(i).padStart(2, '0') +
      '</span><span><span class="dot ' + l.tag + '" title="' + esc(l.tagLabel) + '"><span class="sr-only">' + esc(l.tagLabel) + ': </span></span>' + esc(l.short) + '</span><span class="ok"></span></a>';
    if (i === cur) li += '<ul class="toc">' + sectionsOf(l).map(([k, t]) => '<li><a href="#' + k + '" data-toc="' + k + '">' + esc(t) + '</a></li>').join('') + '</ul>';
    return li + '</li>';
  }).join('');
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
    '</div>' + (answered ? '<p class="q-x">' + (picked === q.a ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.x + '</p><button type="button" class="q-reset" data-reset="' + qi + '">Try again</button>' : '') + '</div>';
}

function lessonBody(i) {
  const l = LESSONS[i];
  const T = Object.fromEntries(sectionsOf(l));
  let h = '<div class="kick"><span class="chip ' + l.tag + '">' + esc(l.tagLabel) + '</span><span class="chip domain">' + esc(l.domain) + '</span><span class="pos">' + (i + 1) + ' / ' + LESSONS.length + '</span></div>';
  h += '<h1 id="top">' + esc(l.title) + '</h1><p class="lede">' + esc(l.lede) + '</p>';
  const X = extrasOf(l);
  if (X.tldr) h += '<aside class="tldr" aria-label="Exam TL;DR"><p class="tldr-h">Exam TL;DR</p><ul>' + X.tldr.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></aside>';
  if (X.story) h += sec('real-life', 'In real life', '<div class="story"><p class="story-t">' + esc(X.story.title) + '</p><div class="prose">' + X.story.html + '</div></div>');
  if (l.what) h += sec('what', T.what, '<div class="prose">' + l.what + '</div>');
  if (l.extra) h += '<section class="sec">' + l.extra + '</section>';
  if (l.why) h += sec('why', T.why, '<div class="call why prose">' + l.why + '</div>');
  if (l.seq) {
    const s = l.seq, both = s.before && s.after;
    h += sec('wire', T.wire, '<figure class="fig" style="margin:0"><div class="fig-bar"><strong>' + (both ? 'Same job, two eras' : 'Message flow in 2026-07-28') + '</strong>' +
      (both ? '<div class="seg-wrap"><span class="seg-l" id="seg-l">Compare</span><div class="seg" role="group" aria-labelledby="seg-l"><button type="button" data-era="before" aria-pressed="true">Legacy</button><button type="button" data-era="after" aria-pressed="false">2026-07-28</button></div></div>' : '') +
      '</div>' + (both ? '<p class="fig-prompt">This is the old flow. Before you switch to <strong>2026-07-28</strong>, try to predict what disappears and what replaces it.</p>' : '') +
      '<div class="fig-scroll" tabindex="0" role="region" aria-label="Sequence diagram, scrolls sideways">' + (s.before ? '<div data-pane="before">' + seqSVG(s.before) + '</div>' : '') +
      (s.after ? '<div data-pane="after"' + (both ? ' hidden' : '') + '>' + seqSVG(s.after) + '</div>' : '') + '</div>' +
      '<figcaption class="fig-cap">Solid arrows are requests, dashed are responses or notifications. <span style="color:var(--del)">Red ✕</span> is gone; <span style="color:var(--add)">green</span> is new.</figcaption></figure>');
  }
  if (l.payloads) {
    h += sec('payloads', T.payloads, l.payloads.map(p => {
      const a = 'payload-' + slug(p.t);
      return '<div class="pay" id="' + a + '"><p class="pay-t"><a class="hl" href="#' + a + '">' + esc(p.t) + '</a>' + lnk(a, p.t) + '</p>' +
        (p.before ? codeBlock(p.before, 'before', 'legacy') : '') + (p.after ? codeBlock(p.after, p.before ? 'after' : '', 'modern') : '') +
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
  const prev = LESSONS[i - 1], next = LESSONS[i + 1];
  h += '<div class="nav">' +
    (prev ? '<a class="btn prev" rel="prev" href="' + lessonUrl(prev) + '"><small>← Previous</small>' + esc(prev.short) + '</a>' : '<a class="btn prev" href="/"><small>← Contents</small>All lessons</a>') +
    '<button type="button" class="btn learn" id="learnBtn" data-id="' + l.id + '">Mark as learned</button>' +
    (next ? '<a class="btn next" rel="next" href="' + lessonUrl(next) + '"><small>Next →</small>' + esc(next.short) + '</a>' : '<a class="btn next" href="/"><small>Done →</small>Contents</a>') +
    '</div><p class="kbd">Tip: ← and → move between lessons. Hover any heading and press # to copy a link to it.</p>';
  return h;
}

function indexBody() {
  return '<p class="eyebrow">Model Context Protocol · specification revision 2026-07-28</p>' +
    '<h1>What changed in MCP, one change at a time</h1>' +
    '<p class="lede">Fourteen short lessons on the July 2026 revision. Each one covers what changed, why, the wire flow, colour-coded payloads before and after, what breaks on an existing server, how to test it, and a quick self-check.</p>' +
    '<p class="cta"><a class="btn learn" href="' + lessonUrl(LESSONS[0]) + '">Start with lesson 00 →</a><span class="resume" id="resume" hidden></span></p>' +
    '<ol class="lesson-grid">' + LESSONS.map((l, i) =>
      '<li><a class="lcard" href="' + lessonUrl(l) + '" data-lesson="' + l.id + '"><span class="lc-top"><span class="n">' + String(i).padStart(2, '0') + '</span><span class="chip ' + l.tag + '">' + esc(l.tagLabel) + '</span><span class="ok"></span></span>' +
      '<strong>' + esc(l.short) + '</strong><span class="lc-d">' + esc(l.lede) + '</span></a></li>').join('') + '</ol>' +
    '<p class="foot">Built from the public <a href="https://modelcontextprotocol.io/specification/2026-07-28">MCP specification, revision 2026-07-28</a>. Payloads marked as verbatim come from the spec; others are labelled illustrative. When this page and the spec disagree, the spec wins.</p>';
}

function pageHTML(opts) {
  const cur = opts.cur ?? -1;
  const l = cur >= 0 ? LESSONS[cur] : null;
  const title = l ? l.short + ' · ' + SITE_TITLE : SITE_TITLE;
  const desc = l ? l.lede : 'A one-change-per-page walkthrough of MCP specification revision 2026-07-28, with diagrams, colour-coded payloads, tests and self-checks.';
  const prev = l && LESSONS[cur - 1], next = l && LESSONS[cur + 1];
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%232340B8%22/%3E%3Cpath d=%22M8 11h16M8 16h10M8 21h13%22 stroke=%22white%22 stroke-width=%222.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">' +
    '<link rel="stylesheet" href="/style.css">' +
    (prev ? '<link rel="prev" href="' + lessonUrl(prev) + '">' : '') + (next ? '<link rel="next" href="' + lessonUrl(next) + '">' : '') +
    '</head><body data-lesson="' + (l ? l.id : '') + '" data-prev="' + (prev ? lessonUrl(prev) : '') + '" data-next="' + (next ? lessonUrl(next) : '') + '">' +
    '<a class="skip" href="#main">Skip to content</a><header class="top"><div class="top-in"><a class="brand" href="/">MCP 2026-07-28 <small>one change per page</small></a>' +
    '<button type="button" class="here" id="hereBtn" title="Copy a link to the section you are reading">Copy link to here</button>' +
    '<div class="prog" aria-live="polite"><span id="progTxt">' + LESSONS.length + ' lessons</span><span class="bar"><i id="progBar"></i></span></div>' +
    (l ? '<div class="pick"><select id="lessonPick" aria-label="Jump to lesson">' + LESSONS.map((x, i) => '<option value="' + lessonUrl(x) + '"' + (i === cur ? ' selected' : '') + '>' + String(i).padStart(2, '0') + ' · ' + esc(x.short) + '</option>').join('') + '</select></div>' : '') +
    '</div></header>' +
    (l
      ? '<div class="shell"><nav class="rail" aria-label="Lessons"><h2><a href="/">Lessons</a></h2><ol id="railList">' + railHTML(cur) + '</ol>' +
        '<div class="legend" aria-hidden="true"><div><span class="dot breaking"></span>Breaks a running server</div><div><span class="dot quiet"></span>Fails quietly or needs a tweak</div><div><span class="dot new"></span>New or redesigned</div><div><span class="dot deprecated"></span>Deprecated or shifting</div><div><span class="dot orientation"></span>Orientation and review</div></div></nav>' +
        '<main id="main">' + lessonBody(cur) + '</main></div>'
      : '<main class="home" id="main">' + (opts.body || indexBody()) + '</main>') +
    '<div class="toast" id="toast" role="status" hidden></div><script src="/app.js" defer></script></body></html>';
}
