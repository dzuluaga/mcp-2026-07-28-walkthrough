/* ---------- browser behaviour (pages are pre-rendered at build time) ---------- */
const KEY = 'mcp-0728-walkthrough-v1';
let state = { learned: [], quiz: {}, last: null };
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
    el.textContent = state.learned.includes(el.closest('[data-lesson]').dataset.lesson) ? '✓' : '';
  });
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
  if (t.dataset.opt !== undefined && lesson) {
    const qi = +t.closest('.q').dataset.q; state.quiz[lesson.id + ':' + qi] = +t.dataset.opt; save();
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
paintQuizzes();
paintProgress();
