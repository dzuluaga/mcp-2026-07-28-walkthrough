/* ---------- browser behaviour (pages are pre-rendered at build time) ---------- */
const KEY = 'mcp-0728-walkthrough-v1';
let state = { learned: [], quiz: {}, last: null, review: {}, exams: [] };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') state = Object.assign(state, s); } catch (e) {}
let save = function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

const body = document.body;
const lessonId = body.dataset.lesson;
const lesson = ALL.find(l => l.id === lessonId);

function paintProgress() {
  const done = ALL.filter(l => state.learned.includes(l.id)).length;
  const txt = document.getElementById('progTxt'), bar = document.getElementById('progBar');
  if (txt) txt.textContent = done + ' of ' + ALL.length + ' learned';
  if (bar) bar.style.width = (100 * done / ALL.length) + '%';
  document.querySelectorAll('[data-lesson] .ok').forEach(el => {
    const id = el.closest('[data-lesson]').dataset.lesson, l = ALL.find(x => x.id === id);
    if (!l) return;
    const Q = quizzesOf(l), right = Q.filter((q, i) => state.quiz[id + ':' + i] === q.a).length;
    const done = state.learned.includes(id);
    el.textContent = done ? '✓' : right ? right + '/' + Q.length : '';
    el.title = done ? 'Learned' : right ? right + ' of ' + Q.length + ' questions correct' : '';
  });
  const due = dueKeys().length, badge = document.getElementById('dueBadge');
  if (badge) { badge.hidden = !due; badge.textContent = due; }
  const b = document.getElementById('learnBtn');
  if (b) { const on = state.learned.includes(b.dataset.id); b.classList.toggle('done', on); b.textContent = on ? '✓ Learned' : 'Mark as learned'; }
}

function paintQuizzes() {
  if (!lesson) return;
  quizzesOf(lesson).forEach((q, qi) => {
    const el = document.getElementById('q' + (qi + 1));
    const picked = state.quiz[lesson.id + ':' + qi];
    if (el && picked !== undefined) el.outerHTML = quizHTML(lesson, q, qi, picked);
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.hidden = true; }, 2200);
}
function copy(text, done) {
  const fail = () => toast(text);
  try { navigator.clipboard.writeText(text).then(done, fail); } catch (e) { fail(); }
}
const pageUrl = () => location.origin + location.pathname;

/* which section is on screen, for the rail and "Copy link to here" */
let here = null;
function markToc(id) {
  here = id;
  document.querySelectorAll('.toc a').forEach(a => a.classList.toggle('on', a.dataset.toc === id));
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) markToc(e.target.id); }), { rootMargin: '-90px 0px -65% 0px' });
  document.querySelectorAll('section.sec[id]').forEach(s => io.observe(s));
}

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.link) {
    const url = pageUrl() + '#' + t.dataset.link;
    history.replaceState(null, '', '#' + t.dataset.link);
    copy(url, () => { t.classList.add('copied'); t.textContent = '✓'; toast('Link copied: ' + url); setTimeout(() => { t.classList.remove('copied'); t.textContent = '#'; }, 1500); });
    return;
  }
  if (t.id === 'hereBtn') {
    const url = pageUrl() + (here && window.scrollY > 120 ? '#' + here : '');
    copy(url, () => toast('Link copied: ' + url));
    return;
  }
  if (t.dataset.era) {
    const fig = t.closest('.fig');
    fig.querySelectorAll('[data-era]').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
    fig.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.era; });
    return;
  }
  if (t.dataset.opt !== undefined && lesson && !t.closest('.practice-app')) {
    const qi = +t.closest('.q').dataset.q; state.quiz[lesson.id + ':' + qi] = +t.dataset.opt;
    if (+t.dataset.opt !== quizzesOf(lesson)[qi].a) addToReview(lesson.id + '#' + qi);
    save(); paintProgress();
    const box = t.closest('.q'), id = box.id;
    box.outerHTML = quizHTML(lesson, quizzesOf(lesson)[qi], qi, +t.dataset.opt);
    const nb = document.getElementById(id); if (nb) nb.querySelector('.q-reset')?.focus({ preventScroll: true });
    const Q = quizzesOf(lesson);
    const allRight = Q.every((q, i) => state.quiz[lesson.id + ':' + i] === q.a);
    if (allRight && !state.learned.includes(lesson.id)) {
      state.learned = state.learned.concat(lesson.id); save(); paintProgress();
      toast('All ' + Q.length + ' correct. Lesson marked as learned.');
    }
    return;
  }
  if (t.dataset.reset !== undefined && lesson) {
    const qi = +t.dataset.reset; delete state.quiz[lesson.id + ':' + qi]; save();
    t.closest('.q').outerHTML = quizHTML(lesson, quizzesOf(lesson)[qi], qi);
    return;
  }
  if (t.id === 'learnBtn') {
    const id = t.dataset.id;
    state.learned = state.learned.includes(id) ? state.learned.filter(x => x !== id) : state.learned.concat(id);
    save(); paintProgress();
    return;
  }
  if (t.classList.contains('copy')) {
    const pre = t.closest('.code-wrap').querySelector('pre');
    const text = [...pre.querySelectorAll('.ln')].map(x => x.textContent === ' ' ? '' : x.textContent).join('\n');
    copy(text, () => { t.textContent = 'Copied'; setTimeout(() => { t.textContent = 'Copy'; }, 1400); });
  }
});

const pick = document.getElementById('lessonPick');
if (pick) pick.addEventListener('change', () => { location.href = pick.value; });

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  if (e.target !== document.body && e.target.closest('input, select, textarea, pre, .fig-scroll, button, a, [tabindex], details')) return;
  if (e.key === 'ArrowRight' && body.dataset.next) location.href = body.dataset.next;
  if (e.key === 'ArrowLeft' && body.dataset.prev) location.href = body.dataset.prev;
});

if (lesson) { state.last = lesson.id; save(); }
const resume = document.getElementById('resume');
if (resume && state.last) {
  const l = ALL.find(x => x.id === state.last);
  if (l) { resume.hidden = false; resume.innerHTML = 'or <a href="' + lessonUrl(l) + '">pick up where you left off: ' + esc(l.short) + '</a>'; }
}


/* ---------- spaced repetition (Leitner boxes: 1 → 3 → 7 days) ---------- */
const DAY = 86400000, GAPS = [0, DAY, 3 * DAY, 7 * DAY];
function addToReview(key) { state.review[key] = { box: 1, due: Date.now() }; }
function dueKeys() { const now = Date.now(); return Object.keys(state.review || {}).filter(k => state.review[k].due <= now && questionByKey(k)); }
function questionByKey(key) {
  const [lid, qi] = key.split('#'); const l = ALL.find(x => x.id === lid);
  const q = l && quizzesOf(l)[+qi];
  return q ? { l, q, qi: +qi } : null;
}
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function cardHTML(item, picked, n, total) {
  const { l, q, qi } = item, letters = 'ABCD', answered = picked !== undefined;
  const order = item.order || (item.order = shuffled([...q.o.keys()]));
  return '<div class="pq"><p class="pq-meta"><span>' + (n !== undefined ? 'Question ' + (n + 1) + ' of ' + total : '') + '</span><a href="' + lessonUrl(l) + '#q' + (qi + 1) + '">' + esc(l.short) + '</a></p>' +
    (total ? '<div class="pq-bar"><i style="width:' + (100 * (n + (answered ? 1 : 0)) / total) + '%"></i></div>' : '') +
    '<p class="q-t">' + esc(q.q) + '</p><div class="opts">' +
    order.map((oi, pos) => '<button type="button" class="opt' + (answered ? (oi === q.a ? ' right' : oi === picked ? ' wrong' : '') : '') + '" data-p="' + oi + '"' + (answered ? ' disabled' : '') + '><span class="opt-l" aria-hidden="true">' + letters[pos] + '</span>' + esc(q.o[oi]) + '</button>').join('') +
    '</div>' + (answered ? feedbackHTML(l, q, qi, picked) + '<p class="pq-next"><button type="button" class="btn learn" data-next="1">Next →</button></p>' : '') + '</div>';
}

/* ---------- final exam ---------- */
/* An attempt in progress lives in state.examRun (saved after every answer), so a refresh resumes it.
   Finished attempts are stored in full in state.exams, so results stay viewable on /exam and /progress. */
const EXAM_PLAN = { int: 5, sec: 5, use: 4, fun: 3, arc: 3 };   // 20 questions ≈ MCPA domain weights

function examVerdict(score) {
  return score >= 85 ? ['ready', 'Ready.', 'You know the material. Keep the review deck clear for a few days before the real exam.']
    : score >= 70 ? ['close', 'Close.', 'Revisit the lessons below, clear your review deck for a few days, then take the exam again.']
    : ['not-yet', 'Not yet.', 'Work through the lessons you missed, then use the review deck daily for a week before retaking.'];
}

/* Full results for one stored attempt: { at, score, byDomain: { key: [ok, n] }, missed: ['lesson#qi'] } */
function examResultHTML(x) {
  const v = examVerdict(x.score), missed = (x.missed || []).map(questionByKey).filter(Boolean);
  return '<div class="result ' + v[0] + '"><p class="score">' + x.score + '<small>%</small></p><div><p class="verdict">' + v[1] + '</p><p>' + v[2] + '</p><p class="note-sm">Taken ' + new Date(x.at).toLocaleString() + '</p></div></div>' +
    (x.byDomain ? '<h2 class="sub">By domain</h2><ul class="dom-bars">' + DOMAINS.map(d => { const [ok, n] = x.byDomain[d.key] || [0, 0]; return '<li><span>' + d.name + ' <small>(' + d.weight + '% of MCPA)</small></span><span class="db"><i style="width:' + (n ? 100 * ok / n : 0) + '%"></i></span><b>' + ok + '/' + n + '</b></li>'; }).join('') + '</ul>' : '') +
    (missed.length ? '<h2 class="sub">Revisit</h2><ul class="missed">' + missed.map(it => '<li><a href="' + lessonUrl(it.l) + '#q' + (it.qi + 1) + '">' + esc(it.l.short) + '</a> ' + esc(it.q.q) + '</li>').join('') + '</ul><p class="note-sm">These are in your <a href="' + BASE + '/review">review deck</a>.</p>'
      : x.byDomain ? '<p class="note-sm">A perfect run.</p>' : '');
}

const examEl = document.getElementById('exam');
if (examEl) {
  const pool = d => ALL.filter(l => LESSON_DOMAIN[l.id] === d).flatMap(l => quizzesOf(l).map((q, qi) => l.id + '#' + qi));
  const item = (run, i) => { const it = questionByKey(run.keys[i]); it.order = run.orders[i]; it.d = LESSON_DOMAIN[it.l.id]; return it; };
  function start() {
    const keys = shuffled(Object.entries(EXAM_PLAN).flatMap(([d, n]) => shuffled(pool(d)).slice(0, n)));
    state.examRun = { keys, orders: keys.map(k => shuffled([...questionByKey(k).q.o.keys()])), picks: [], i: 0, startedAt: Date.now() };
    save(); draw();
  }
  function intro() {
    const run = state.examRun, last = state.exams[state.exams.length - 1];
    const live = run && run.keys && run.keys.every(questionByKey);
    examEl.innerHTML = (live
      ? '<div class="resume-box"><p><strong>You have an exam in progress:</strong> question ' + (run.i + 1) + ' of ' + run.keys.length + ', started ' + new Date(run.startedAt).toLocaleString() + '.</p><p class="cta"><button type="button" class="btn learn" data-resume="1">Resume the exam</button><button type="button" class="btn" data-start="1">Start a new one</button></p></div>'
      : '<p class="lede">20 questions, drawn fresh each time and weighted like the real MCPA domains. Every miss goes into your review deck. Your progress is saved after every answer.</p>' +
        '<ul class="dom-plan">' + DOMAINS.map(d => '<li><span>' + d.name + '</span><b>' + EXAM_PLAN[d.key] + ' questions</b></li>').join('') + '</ul>' +
        '<p class="cta"><button type="button" class="btn learn" data-start="1">Start the exam</button><a class="btn" href="' + BASE + '/progress">All attempts</a></p>') +
      (last && !live ? '<h2 class="sub">Your last attempt</h2>' + examResultHTML(last) : '');
  }
  function draw() {
    const run = state.examRun, it = item(run, run.i);
    examEl.innerHTML = cardHTML(it, run.picks[run.i], run.i, run.keys.length);
    examEl.querySelector('.opt, [data-next]')?.focus({ preventScroll: true });
  }
  function finish() {
    const run = state.examRun, its = run.keys.map((k, i) => item(run, i));
    const right = its.filter((it, i) => run.picks[i] === it.q.a).length;
    const byDomain = {};
    DOMAINS.forEach(d => { const idx = its.map((it, i) => i).filter(i => its[i].d === d.key); byDomain[d.key] = [idx.filter(i => run.picks[i] === its[i].q.a).length, idx.length]; });
    const entry = { at: Date.now(), score: Math.round(100 * right / its.length), byDomain, missed: run.keys.filter((k, i) => run.picks[i] !== its[i].q.a) };
    state.exams.push(entry); delete state.examRun; save(); paintProgress();
    examEl.innerHTML = examResultHTML(entry) +
      '<p class="cta"><button type="button" class="btn learn" data-start="1">Take it again</button><a class="btn" href="' + BASE + '/progress">See all attempts</a></p>';
    window.scrollTo(0, 0);
  }
  examEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.start) return start();
    if (b.dataset.resume) return draw();
    const run = state.examRun; if (!run) return;
    if (b.dataset.p !== undefined) {
      const it = item(run, run.i); run.picks[run.i] = +b.dataset.p;
      if (+b.dataset.p !== it.q.a) addToReview(it.l.id + '#' + it.qi);
      save(); paintProgress();
      return draw();
    }
    if (b.dataset.next) { run.i++; save(); return run.i < run.keys.length ? draw() : finish(); }
  });
  intro();
}

/* ---------- review deck ---------- */
const revEl = document.getElementById('review');
if (revEl) {
  let queue = [], cur = null, picked;
  function show() {
    queue = shuffled(dueKeys());
    const all = Object.keys(state.review).filter(questionByKey);
    if (!queue.length) {
      const next = all.map(k => state.review[k].due).sort((a, b) => a - b)[0];
      revEl.innerHTML = '<p class="lede">' + (all.length ? 'Nothing due right now. ' + all.length + ' question' + (all.length > 1 ? 's are' : ' is') + ' in your deck; the next comes back on <b>' + new Date(next).toLocaleDateString() + '</b>.' : 'Your deck is empty. Every question you miss, in a lesson or the final exam, lands here and comes back after 1, 3 and 7 days until you get it right three times in a row.') + '</p>' +
        '<p class="cta"><a class="btn learn" href="' + BASE + '/exam">Take the final exam</a><a class="btn" href="' + BASE + '/">Back to the lessons</a></p>';
      return;
    }
    revEl.innerHTML = '<p class="lede">' + queue.length + ' due today. Get one right and it comes back later; get it wrong and it returns tomorrow.</p><div id="card"></div>';
    nextCard();
  }
  function nextCard() {
    const key = queue.shift();
    if (!key) return show();
    cur = { key, ...questionByKey(key) }; picked = undefined;
    const box = state.review[key].box;
    document.getElementById('card').innerHTML = '<p class="boxes" aria-label="Box ' + box + ' of 3">' + [1, 2, 3].map(b => '<span class="' + (b <= box ? 'on' : '') + '"></span>').join('') + '</p>' + cardHTML(cur, picked);
  }
  revEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p !== undefined && picked === undefined) {
      picked = +b.dataset.p;
      const r = state.review[cur.key];
      if (picked === cur.q.a) { r.box++; if (r.box > 3) delete state.review[cur.key]; else r.due = Date.now() + GAPS[r.box]; }
      else { r.box = 1; r.due = Date.now() + GAPS[1]; }
      save(); paintProgress();
      const card = document.getElementById('card');
      card.innerHTML = card.querySelector('.boxes').outerHTML + cardHTML(cur, picked);
      return;
    }
    if (b.dataset.next) nextCard();
  });
  show();
}

/* ---------- storage health: warn when this browser can't keep progress ---------- */
const storageOK = (() => { try { localStorage.setItem('mcp-0728-probe', '1'); localStorage.removeItem('mcp-0728-probe'); return true; } catch (e) { return false; } })();
if (!storageOK) {
  const w = document.createElement('div');
  w.className = 'store-warn'; w.setAttribute('role', 'alert');
  w.innerHTML = '<strong>This browser isn\'t saving your progress</strong> (private browsing or blocked site data). Answers will be lost when you leave. Use a normal window, or turn on sync on the <a href="' + BASE + '/progress">Progress</a> page.';
  document.body.prepend(w);
}

/* ---------- sync across devices (short code, no account) ---------- */
const SYNC_KEY = 'mcp-0728-sync';
const SYNC_API = BASE + '/api/sync';
let sync = {};
try { sync = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') || {}; } catch (e) {}
const saveSync = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) {} };

/* Merge two progress states without losing anything either device learned. */
function mergeState(a, b) {
  const out = Object.assign({}, a);
  out.learned = [...new Set([...(a.learned || []), ...(b.learned || [])])];
  out.quiz = Object.assign({}, b.quiz || {}, a.quiz || {});
  for (const k of Object.keys(b.quiz || {})) {                     // keep a correct answer if either device has one
    const [lid, qi] = k.split(':'), l = ALL.find(x => x.id === lid), q = l && quizzesOf(l)[+qi];
    if (q && b.quiz[k] === q.a) out.quiz[k] = q.a;
  }
  out.review = Object.assign({}, b.review || {}, a.review || {});
  for (const k of Object.keys(b.review || {})) if (a.review && a.review[k] && b.review[k].box > a.review[k].box) out.review[k] = b.review[k];
  const seen = new Set(); out.exams = [...(a.exams || []), ...(b.exams || [])].filter(x => !seen.has(x.at) && seen.add(x.at)).sort((x, y) => x.at - y.at);
  if (!a.examRun && b.examRun) out.examRun = b.examRun;
  return out;
}
const syncable = () => { const s = Object.assign({}, state); delete s.last; return s; };

async function syncNow(quiet) {
  if (!sync.code) return;
  try {
    const r = await fetch(SYNC_API + '?code=' + encodeURIComponent(sync.code));
    if (r.ok) { const remote = (await r.json()).state; if (remote) { state = mergeState(state, remote); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} } }
    else if (r.status !== 404) throw new Error('HTTP ' + r.status);
    const w = await fetch(SYNC_API + '?code=' + encodeURIComponent(sync.code), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: syncable() }) });
    if (!w.ok) throw new Error('HTTP ' + w.status);
    sync.at = Date.now(); sync.err = null; saveSync();
  } catch (e) { sync.err = String(e.message || e); saveSync(); if (!quiet) toast('Sync failed: ' + sync.err); }
  paintProgress(); paintSyncPanel(); paintProgressPage();
}
let syncTimer = null;
const scheduleSync = () => { if (!sync.code) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), 1500); };
const _save = save;
save = function () { _save(); scheduleSync(); };   // every saved change is pushed shortly after

function paintSyncPanel() {
  const el = document.getElementById('sync-panel'); if (!el) return;
  el.innerHTML = sync.code
    ? '<p>Sync is on. Your sync code:</p><p class="sync-code" id="syncCode">' + esc(sync.code) + '</p>' +
      '<p class="note-sm">Enter it on another device or browser (Progress page → "I have a sync code") to share your results. ' +
      (sync.err ? '<span class="sync-err">Last sync failed: ' + esc(sync.err) + '</span>' : sync.at ? 'Last synced ' + new Date(sync.at).toLocaleString() + '.' : '') + '</p>' +
      '<p class="cta"><button type="button" class="btn" data-sync="now">Sync now</button><button type="button" class="btn" data-sync="copy">Copy code</button><button type="button" class="btn" data-sync="off">Turn off on this device</button></p>'
    : '<p>Results are saved only in this browser. Turn on sync to keep them across your phone, laptop and other browsers. You get a short code; no account, no email.</p>' +
      '<p class="cta"><button type="button" class="btn learn" data-sync="create">Turn on sync</button></p>' +
      '<form class="sync-join" id="syncJoin"><label for="syncInput">I have a sync code</label><div><input id="syncInput" autocomplete="off" spellcheck="false" placeholder="mcpa-XXXX-XXXX"><button type="submit" class="btn">Use code</button></div></form>';
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-sync]'); if (!b) return;
  const act = b.dataset.sync;
  if (act === 'create') {
    b.disabled = true;
    try {
      const r = await fetch(SYNC_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: syncable() }) });
      if (!r.ok) throw new Error(r.status === 503 ? 'sync storage is not configured yet' : 'HTTP ' + r.status);
      sync = { code: (await r.json()).code, at: Date.now() }; saveSync(); toast('Sync is on.');
    } catch (err) { toast('Could not turn on sync: ' + (err.message || err)); }
    paintSyncPanel();
  }
  if (act === 'now') syncNow();
  if (act === 'copy') copy(sync.code, () => toast('Sync code copied'));
  if (act === 'off') { sync = {}; saveSync(); paintSyncPanel(); toast('Sync turned off on this device. Your results stay here and on the server.'); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'syncJoin') return;
  e.preventDefault();
  const code = document.getElementById('syncInput').value.trim().toLowerCase();
  if (!/^mcpa-[a-z0-9]{4}-[a-z0-9]{4}$/.test(code)) return toast('That doesn\'t look like a sync code (mcpa-XXXX-XXXX).');
  const r = await fetch(SYNC_API + '?code=' + encodeURIComponent(code)).catch(() => null);
  if (!r || !r.ok) return toast(r && r.status === 404 ? 'No progress found for that code.' : 'Could not reach the sync service.');
  sync = { code }; saveSync(); await syncNow(); toast('Synced. Your results from the other device are here.');
});

/* ---------- progress page ---------- */
function paintProgressPage() {
  const el = document.getElementById('progress-app'); if (!el) return;
  const qAll = ALL.flatMap(l => quizzesOf(l).map((q, i) => ({ l, q, k: l.id + ':' + i })));
  const answered = qAll.filter(x => state.quiz[x.k] !== undefined), right = answered.filter(x => state.quiz[x.k] === x.q.a);
  const exams = state.exams || [], best = exams.reduce((m, x) => Math.max(m, x.score), 0), due = dueKeys().length;
  const dom = DOMAINS.map(d => { const qs = qAll.filter(x => LESSON_DOMAIN[x.l.id] === d.key); const r = qs.filter(x => state.quiz[x.k] === x.q.a).length; return { d, r, n: qs.length }; });
  const weakest = dom.filter(x => x.n).sort((a, b) => a.r / a.n - b.r / b.n)[0];
  el.innerHTML =
    '<div class="tiles">' +
      '<div class="tile"><b>' + ALL.filter(l => state.learned.includes(l.id)).length + '<small>/' + ALL.length + '</small></b><span>lessons learned</span></div>' +
      '<div class="tile"><b>' + right.length + '<small>/' + qAll.length + '</small></b><span>questions right</span></div>' +
      '<div class="tile"><b>' + exams.length + '</b><span>exam attempts' + (exams.length ? ' · best ' + best + '%' : '') + '</span></div>' +
      '<div class="tile"><b>' + due + '</b><span><a href="' + BASE + '/review">due for review</a></span></div>' +
    '</div>' +
    '<h2 class="sub">Readiness by exam domain <small>(lesson questions answered correctly)</small></h2><ul class="dom-bars">' + dom.map(x => '<li><span>' + x.d.name + ' <small>(' + x.d.weight + '% of MCPA)</small></span><span class="db"><i style="width:' + (x.n ? 100 * x.r / x.n : 0) + '%"></i></span><b>' + x.r + '/' + x.n + '</b></li>').join('') + '</ul>' +
    (weakest && answered.length ? '<p class="note-sm">Weakest area: <strong>' + weakest.d.name + '</strong>. Start there.</p>' : '') +
    '<h2 class="sub">Exam attempts</h2>' + (exams.length
      ? '<table class="attempts"><thead><tr><th>Date</th><th>Score</th>' + DOMAINS.map(d => '<th title="' + esc(d.name) + '">' + d.key.toUpperCase() + '</th>').join('') + '<th></th></tr></thead><tbody>' +
        exams.slice().reverse().map((x, i) => '<tr><td>' + new Date(x.at).toLocaleString() + '</td><td><b>' + x.score + '%</b></td>' + DOMAINS.map(d => '<td>' + (x.byDomain && x.byDomain[d.key] ? x.byDomain[d.key].join('/') : '–') + '</td>').join('') + '<td>' + (x.byDomain ? '<button type="button" class="linkish" data-attempt="' + (exams.length - 1 - i) + '">Details</button>' : '') + '</td></tr>').join('') +
        '</tbody></table><div id="attempt-detail"></div>'
      : '<p class="note-sm">No attempts yet. <a href="' + BASE + '/exam">Take the final exam</a>.</p>') +
    '<p class="note-sm">Domains: INT Interactions &amp; Execution · SEC Security &amp; Governance · USE Use Cases &amp; Ecosystem · FUN Fundamentals · ARC Architecture.</p>' +
    TRACKS.map(t => '<h2 class="sub">' + esc(t.label + ' · ' + t.name) + '</h2><ul class="lesson-scores">' + ALL.filter(l => l.track === t.id).map(l => {
      const Q = quizzesOf(l), r = Q.filter((q, i) => state.quiz[l.id + ':' + i] === q.a).length, a = Q.filter((q, i) => state.quiz[l.id + ':' + i] !== undefined).length;
      return '<li><a href="' + lessonUrl(l) + '">' + esc(l.short) + '</a><span class="ls-bar"><i style="width:' + (Q.length ? 100 * r / Q.length : 0) + '%"></i></span><span class="ls-n">' + r + '/' + Q.length + (a > r ? ' <small>(' + (a - r) + ' wrong)</small>' : '') + '</span><span class="ls-ok">' + (state.learned.includes(l.id) ? '✓' : '') + '</span></li>';
    }).join('') + '</ul>').join('') +
    '<h2 class="sub">Backup</h2><p class="cta"><button type="button" class="btn" data-backup="export">Copy progress as text</button><button type="button" class="btn" data-backup="import">Paste progress</button></p><textarea id="backupBox" class="backup-box" hidden aria-label="Progress backup"></textarea>';
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-attempt]');
  if (a) { const x = state.exams[+a.dataset.attempt]; const d = document.getElementById('attempt-detail'); d.innerHTML = examResultHTML(x); d.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const b = e.target.closest('[data-backup]'); if (!b) return;
  const box = document.getElementById('backupBox'); box.hidden = false;
  if (b.dataset.backup === 'export') { box.value = JSON.stringify(state); box.select(); copy(box.value, () => toast('Progress copied. Paste it into a note or another browser.')); }
  else {
    if (!box.value.trim()) { box.placeholder = 'Paste your progress text here, then press "Paste progress" again.'; box.focus(); return; }
    try { state = mergeState(state, JSON.parse(box.value)); save(); paintProgress(); paintProgressPage(); toast('Progress merged.'); } catch (err) { toast('That text isn\'t valid progress data.'); }
  }
});

paintSyncPanel();
paintProgressPage();
if (sync.code) syncNow(true);

/* feedback links: build the address here so it isn't plain text in the HTML */
document.querySelectorAll('.fb-mail').forEach(a => {
  const addr = ['diego', 'diegozuluaga.dev'].join('@');
  a.textContent = addr;
  a.href = 'mailto:' + addr + '?subject=' + encodeURIComponent(a.dataset.subject || '[MCPA course]') +
    '&body=' + encodeURIComponent('Page: ' + location.href + '\n\n');
});

paintQuizzes();
paintProgress();
