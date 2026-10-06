// Builds the static site into dist/: one pre-rendered page per lesson, plus a contents page.
// Usage: node build.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const files = ['lessons.js', 'extras.js', 'practice.js', 'core-lessons.js', 'audio.js', 'helpers.js', 'render.js'].filter(f => fs.existsSync(new URL('./src/' + f, import.meta.url)));
const shared = files.map(src).join('\n');

const ctx = vm.createContext({});
vm.runInContext(shared + '\nglobalThis.__ = { ALL, pageHTML, lessonUrl, BASE };', ctx);
const { ALL, pageHTML, lessonUrl, BASE } = ctx.__;

const out = new URL('./dist/', import.meta.url);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const write = (p, s) => { const u = new URL(p, out); fs.mkdirSync(new URL('.', u), { recursive: true }); fs.writeFileSync(u, s); };

const B = BASE.slice(1) + '/';   // e.g. 'mcpa/'
write(B + 'index.html', pageHTML({}));
ALL.forEach(l => write(lessonUrl(l).slice(1) + '/index.html', pageHTML({ lesson: l })));
write('404.html', pageHTML({ body: '<h1>That page isn\'t here</h1><p class="lede">The lesson may have been renamed. <a href="' + BASE + '/">Go to the contents</a>.</p>' }));
write(B + 'exam/index.html', pageHTML({ page: 'exam', body: '<p class="eyebrow">Final exam · MCP 2026-07-28</p><h1>Are you ready?</h1><div id="exam" class="practice-app"><noscript>The exam needs JavaScript.</noscript></div>' }));
write(B + 'progress/index.html', pageHTML({ page: 'progress', body: '<p class="eyebrow">Your results</p><h1>Progress</h1><div id="progress-app" class="practice-app"><noscript>The progress page needs JavaScript.</noscript></div><h2 class="sub">Sync across devices</h2><div id="sync-panel" class="sync-panel"></div>' }));
write(B + 'review/index.html', pageHTML({ page: 'review', body: '<p class="eyebrow">Review deck · spaced repetition</p><h1>Bring back what you missed</h1><div id="review" class="practice-app"><noscript>The review deck needs JavaScript.</noscript></div>' }));
write(B + 'reference-server.mjs', fs.readFileSync(new URL('./server/reference-server.mjs', import.meta.url), 'utf8'));
write(B + 'style.css', src('style.css'));
const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...ALL.map(lessonUrl).map(u => u.slice(BASE.length)), '/exam', '/review', '/progress'];
write(B + 'sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '  <url><loc>https://www.diegozuluaga.dev' + BASE + (u === '/' ? '/' : u) + '</loc><lastmod>' + today + '</lastmod></url>').join('\n') + '\n</urlset>\n');
write(B + 'app.js', '(() => {\n' + shared + '\n' + src('app.js') + '\n})();\n');

console.log('Built', ALL.length, 'lessons into dist/');
