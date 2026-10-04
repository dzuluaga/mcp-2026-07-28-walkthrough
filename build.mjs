// Builds the static site into dist/: one pre-rendered page per lesson, plus a contents page.
// Usage: node build.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const files = ['lessons.js', 'extras.js', 'practice.js', 'core-lessons.js', 'audio.js', 'helpers.js', 'render.js'].filter(f => fs.existsSync(new URL('./src/' + f, import.meta.url)));
const shared = files.map(src).join('\n');

const ctx = vm.createContext({});
vm.runInContext(shared + '\nglobalThis.__ = { ALL, pageHTML, lessonUrl };', ctx);
const { ALL, pageHTML, lessonUrl } = ctx.__;

const out = new URL('./dist/', import.meta.url);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const write = (p, s) => { const u = new URL(p, out); fs.mkdirSync(new URL('.', u), { recursive: true }); fs.writeFileSync(u, s); };

write('index.html', pageHTML({}));
ALL.forEach(l => write(lessonUrl(l).slice(1) + 'index.html', pageHTML({ lesson: l })));
write('404.html', pageHTML({ body: '<h1>That page isn\'t here</h1><p class="lede">The lesson may have been renamed. <a href="/">Go to the contents</a>.</p>' }));
write('exam/index.html', pageHTML({ page: 'exam', body: '<p class="eyebrow">Final exam · MCP 2026-07-28</p><h1>Are you ready?</h1><div id="exam" class="practice-app"><noscript>The exam needs JavaScript.</noscript></div>' }));
write('review/index.html', pageHTML({ page: 'review', body: '<p class="eyebrow">Review deck · spaced repetition</p><h1>Bring back what you missed</h1><div id="review" class="practice-app"><noscript>The review deck needs JavaScript.</noscript></div>' }));
write('reference-server.mjs', fs.readFileSync(new URL('./server/reference-server.mjs', import.meta.url), 'utf8'));
write('style.css', src('style.css'));
write('app.js', '(() => {\n' + shared + '\n' + src('app.js') + '\n})();\n');

console.log('Built', ALL.length, 'lessons into dist/');
