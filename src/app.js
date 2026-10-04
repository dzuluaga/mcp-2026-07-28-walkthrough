/* ---------- browser behaviour (pages are pre-rendered at build time) ---------- */
const KEY = 'mcp-0728-walkthrough-v1';
let state = { learned: [], quiz: {}, last: null, review: {}, exams: [] };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') state = Object.assign(state, s); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

const body = document.body;
const lessonId = body.dataset.lesson;
const lesson = LESSONS.find(l => l.id === lessonId);

function paintProgress() {
  const done = LESSONS.filter(l => state.learned.includes(l.id)).length;
  const txt = document.getElementById('progTxt'), bar = document.getElementById('progBar');
  if (txt) txt.textContent = done + ' of ' + LESSONS.length + ' learned';
  if (bar) bar.style.width = (100 * done / LESSONS.length) + '%';
  document.querySelectorAll('[data-lesson] .ok').forEach(el => {
    const id = el.closest('[data-lesson]').dataset.lesson, l = LESSONS.find(x => x.id === id);
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
  const l = LESSONS.find(x => x.id === state.last);
  if (l) { resume.hidden = false; resume.innerHTML = 'or <a href="/' + l.id + '/">pick up where you left off: ' + esc(l.short) + '</a>'; }
}


/* ---------- spaced repetition (Leitner boxes: 1 → 3 → 7 days) ---------- */
const DAY = 86400000, GAPS = [0, DAY, 3 * DAY, 7 * DAY];
function addToReview(key) { state.review[key] = { box: 1, due: Date.now() }; }
function dueKeys() { const now = Date.now(); return Object.keys(state.review || {}).filter(k => state.review[k].due <= now && questionByKey(k)); }
function questionByKey(key) {
  const [lid, qi] = key.split('#'); const l = LESSONS.find(x => x.id === lid);
  const q = l && quizzesOf(l)[+qi];
  return q ? { l, q, qi: +qi } : null;
}
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function cardHTML(item, picked, n, total) {
  const { l, q, qi } = item, letters = 'ABCD', answered = picked !== undefined;
  const order = item.order || (item.order = shuffled([...q.o.keys()]));
  return '<div class="pq"><p class="pq-meta"><span>' + (n !== undefined ? 'Question ' + (n + 1) + ' of ' + total : '') + '</span><a href="/' + l.id + '/#q' + (qi + 1) + '">' + esc(l.short) + '</a></p>' +
    (total ? '<div class="pq-bar"><i style="width:' + (100 * (n + (answered ? 1 : 0)) / total) + '%"></i></div>' : '') +
    '<p class="q-t">' + esc(q.q) + '</p><div class="opts">' +
    order.map((oi, pos) => '<button type="button" class="opt' + (answered ? (oi === q.a ? ' right' : oi === picked ? ' wrong' : '') : '') + '" data-p="' + oi + '"' + (answered ? ' disabled' : '') + '><span class="opt-l" aria-hidden="true">' + letters[pos] + '</span>' + esc(q.o[oi]) + '</button>').join('') +
    '</div>' + (answered ? feedbackHTML(l, q, qi, picked) + '<p class="pq-next"><button type="button" class="btn learn" data-next="1">Next →</button></p>' : '') + '</div>';
}

/* ---------- final exam ---------- */
const examEl = document.getElementById('exam');
if (examEl) {
  const PLAN = { int: 5, sec: 5, use: 4, fun: 3, arc: 3 };   // 20 questions ≈ MCPA domain weights
  let run = null;
  const pool = d => LESSONS.filter(l => LESSON_DOMAIN[l.id] === d).flatMap(l => quizzesOf(l).map((q, qi) => ({ l, q, qi, d })));
  function start() {
    const qs = shuffled(Object.entries(PLAN).flatMap(([d, n]) => shuffled(pool(d)).slice(0, n)));
    run = { qs, i: 0, picks: [] };
    draw();
  }
  function intro() {
    const last = state.exams[state.exams.length - 1];
    examEl.innerHTML = '<p class="lede">20 questions, drawn fresh each time and weighted like the real MCPA domains. Every miss goes into your review deck.</p>' +
      '<ul class="dom-plan">' + DOMAINS.map(d => '<li><span>' + d.name + '</span><b>' + PLAN[d.key] + ' questions</b></li>').join('') + '</ul>' +
      (last ? '<p class="last">Last attempt: <b>' + last.score + '%</b> on ' + new Date(last.at).toLocaleDateString() + '.</p>' : '') +
      '<p class="cta"><button type="button" class="btn learn" data-start="1">Start the exam</button></p>';
  }
  function draw() {
    const it = run.qs[run.i];
    examEl.innerHTML = cardHTML(it, run.picks[run.i], run.i, run.qs.length);
    examEl.querySelector('.opt, [data-next]')?.focus({ preventScroll: true });
  }
  function finish() {
    const right = run.qs.filter((it, i) => run.picks[i] === it.q.a).length;
    const score = Math.round(100 * right / run.qs.length);
    state.exams.push({ at: Date.now(), score }); save(); paintProgress();
    const byD = DOMAINS.map(d => { const its = run.qs.map((it, i) => [it, i]).filter(([it]) => it.d === d.key); const ok = its.filter(([it, i]) => run.picks[i] === it.q.a).length; return { d, ok, n: its.length }; });
    const missed = run.qs.map((it, i) => [it, i]).filter(([it, i]) => run.picks[i] !== it.q.a);
    const verdict = score >= 85 ? ['ready', 'Ready for the 2026-07-28 questions.', 'You know the July changes. Now spend your time on security and core MCP: they make up most of the rest of the exam.']
      : score >= 70 ? ['close', 'Close.', 'Revisit the lessons below, clear your review deck for a few days, then take the exam again.']
      : ['not-yet', 'Not yet.', 'Work through the lessons you missed, then use the review deck daily for a week before retaking.'];
    examEl.innerHTML = '<div class="result ' + verdict[0] + '"><p class="score">' + score + '<small>%</small></p><div><p class="verdict">' + verdict[1] + '</p><p>' + verdict[2] + '</p></div></div>' +
      '<h2 class="sub">By domain</h2><ul class="dom-bars">' + byD.map(x => '<li><span>' + x.d.name + ' <small>(' + x.d.weight + '% of MCPA)</small></span><span class="db"><i style="width:' + (x.n ? 100 * x.ok / x.n : 0) + '%"></i></span><b>' + x.ok + '/' + x.n + '</b></li>').join('') + '</ul>' +
      (missed.length ? '<h2 class="sub">Revisit</h2><ul class="missed">' + missed.map(([it]) => '<li><a href="/' + it.l.id + '/#q' + (it.qi + 1) + '">' + esc(it.l.short) + '</a> ' + esc(it.q.q) + '</li>').join('') + '</ul><p class="note-sm">All ' + missed.length + ' are now in your <a href="/review/">review deck</a>.</p>' : '<p class="note-sm">A perfect run. Try again for a different set of questions.</p>') +
      '<p class="cta"><button type="button" class="btn learn" data-start="1">Take it again</button><a class="btn" href="/">Back to the lessons</a></p>';
    window.scrollTo(0, 0);
  }
  examEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.start) return start();
    if (b.dataset.p !== undefined) {
      const it = run.qs[run.i]; run.picks[run.i] = +b.dataset.p;
      if (+b.dataset.p !== it.q.a) { addToReview(it.l.id + '#' + it.qi); save(); paintProgress(); }
      return draw();
    }
    if (b.dataset.next) { run.i++; return run.i < run.qs.length ? draw() : finish(); }
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
        '<p class="cta"><a class="btn learn" href="/exam/">Take the final exam</a><a class="btn" href="/">Back to the lessons</a></p>';
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

paintQuizzes();
paintProgress();
