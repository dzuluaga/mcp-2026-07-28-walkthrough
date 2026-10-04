// Builds the static site into dist/: one pre-rendered page per lesson, plus a contents page.
// Usage: node build.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const shared = src('lessons.js') + '\n' + src('extras.js') + '\n' + src('helpers.js') + '\n' + src('render.js');

const ctx = vm.createContext({});
vm.runInContext(shared + '\nglobalThis.__ = { LESSONS, pageHTML, lessonUrl };', ctx);
const { LESSONS, pageHTML } = ctx.__;

const out = new URL('./dist/', import.meta.url);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const write = (p, s) => { const u = new URL(p, out); fs.mkdirSync(new URL('.', u), { recursive: true }); fs.writeFileSync(u, s); };

write('index.html', pageHTML({}));
LESSONS.forEach((l, i) => write(l.id + '/index.html', pageHTML({ cur: i })));
write('404.html', pageHTML({ body: '<h1>That page isn\'t here</h1><p class="lede">The lesson may have been renamed. <a href="/">Go to the contents</a>.</p>' }));
write('style.css', src('style.css'));
write('app.js', '(() => {\n' + shared + '\n' + src('app.js') + '\n})();\n');

console.log('Built', LESSONS.length, 'lessons into dist/');
