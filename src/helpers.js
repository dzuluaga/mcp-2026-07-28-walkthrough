/* ---------- helpers ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TOK = /("(?:[^"\\]|\\.)*")(\s*:)?|(\/\/.*$)|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g;
function hiJson(s) {
  let out = '', last = 0, m; TOK.lastIndex = 0;
  while ((m = TOK.exec(s))) {
    out += '<span class="tx">' + esc(s.slice(last, m.index)) + '</span>';
    if (m[1]) out += m[2] ? '<span class="tk-k">' + esc(m[1]) + '</span>' + esc(m[2]) : '<span class="tk-s">' + esc(m[1]) + '</span>';
    else if (m[3]) out += '<span class="tk-c">' + esc(m[3]) + '</span>';
    else if (m[4]) out += '<span class="tk-n">' + m[4] + '</span>';
    else out += '<span class="tk-b">' + m[5] + '</span>';
    last = TOK.lastIndex;
  }
  return out + '<span class="tx">' + esc(s.slice(last)) + '</span>';
}
function highlight(lines, lang) {
  let inBody = lang !== 'http', seenReq = false;
  return lines.map(({ cls, text }) => {
    let h;
    const t = text.trim();
    if (lang === 'sh') {
      h = /^\s*#/.test(text) ? '<span class="tk-c">' + esc(text) + '</span>' : esc(text);
    } else if (lang === 'text') {
      h = /^\s*\/\//.test(text) ? '<span class="tk-c">' + esc(text) + '</span>' : '<span class="tx">' + esc(text) + '</span>';
    } else if (/^\s*\/\//.test(text)) {
      h = '<span class="tk-c">' + esc(text) + '</span>';
    } else if (!inBody) {
      if (t === '') { inBody = true; h = ''; }
      else if (!seenReq) { seenReq = true; const sp = text.match(/^(\s*)(\S+)(.*)$/); h = esc(sp[1]) + '<span class="tk-m">' + esc(sp[2]) + '</span><span class="tx">' + esc(sp[3]) + '</span>'; }
      else { const hm = text.match(/^(\s*)([A-Za-z][\w-]*)(:\s?)(.*)$/); h = hm ? esc(hm[1]) + '<span class="tk-h">' + esc(hm[2]) + '</span>' + esc(hm[3]) + '<span class="tk-s">' + esc(hm[4]) + '</span>' : esc(text); }
    } else h = hiJson(text);
    return '<span class="ln' + (cls ? ' ' + cls : '') + '">' + (h || ' ') + '</span>';
  }).join('');
}
function parseBlock(b) {
  const raw = b.text.split('\n');
  return raw.map(l => {
    if (!b.d) return { cls: '', text: l };
    const g = l.slice(0, 2), text = l.slice(2);
    return { cls: g === '+ ' ? 'add' : g === '- ' ? 'del' : g === '* ' ? 'hl' : '', text };
  });
}
let codeStore = [];
function codeBlock(b, label, era, anchor) {
  const lines = parseBlock(b);
  const id = codeStore.push(lines.map(l => l.text).join('\n')) - 1;
  return '<div class="code-wrap"' + (anchor ? ' id="' + anchor + '"' : '') + '><div class="code-head">' + (era ? '<span class="era ' + era + '">' + (era === 'legacy' ? 'Legacy' : era === 'modern' ? '2026-07-28' : 'Shell') + '</span>' : '') +
    '<span>' + esc(label || '') + '</span>' + (anchor ? lnk(anchor, label) : '') + '<button class="copy" data-copy="' + id + '" type="button">Copy</button></div>' +
    '<pre class="code" tabindex="0" aria-label="' + esc((label ? label + ' ' : '') + 'code') + '"><code>' + highlight(lines, b.lang || 'json') + '</code></pre></div>';
}

/* ---------- sequence diagrams ---------- */
function seqSVG(d) {
  const n = d.actors.length, W = 640, m = 92;
  const xs = d.actors.map((_, i) => n === 1 ? W / 2 : m + i * (W - 2 * m) / (n - 1));
  let y = 50, body = '';
  for (const s of d.steps) {
    if (s.n !== undefined) {
      const a = xs[s.a ?? 0], b = xs[s.b ?? n - 1];
      const half = Math.max(80, s.n.length * 3.2);
      const xl = Math.max(4, Math.min(a, b) - (a === b ? half : 70)), xr = Math.min(W - 4, Math.max(a, b) + (a === b ? half : 70));
      body += '<rect class="sq-note ' + (s.k || '') + '" x="' + xl + '" y="' + (y - 2) + '" width="' + (xr - xl) + '" height="26" rx="4"/>' +
        '<text class="sq-nt" x="' + ((xl + xr) / 2) + '" y="' + (y + 15) + '" text-anchor="middle">' + esc(s.n) + '</text>';
      y += 36; continue;
    }
    const x1 = xs[s.f], x2 = xs[s.t], dir = x2 > x1 ? 1 : -1, k = s.k || '';
    const ly = y + 18;
    body += '<text class="sq-lb ' + k + '" x="' + ((x1 + x2) / 2) + '" y="' + (y + 10) + '" text-anchor="middle">' + (k === 'del' ? '✕ ' : '') + esc(s.l) + '</text>';
    body += '<line class="sq-ln ' + k + (s.d ? ' dash' : '') + '" x1="' + (x1 + dir * 4) + '" y1="' + ly + '" x2="' + (x2 - dir * 10) + '" y2="' + ly + '"/>';
    body += '<path class="sq-hd ' + k + '" d="M' + (x2 - dir * 2) + ' ' + ly + ' L' + (x2 - dir * 12) + ' ' + (ly - 5) + ' L' + (x2 - dir * 12) + ' ' + (ly + 5) + ' Z"/>';
    y += 42;
  }
  const H = y + 6;
  let head = '';
  xs.forEach((x, i) => {
    head += '<line class="sq-life" x1="' + x + '" y1="34" x2="' + x + '" y2="' + (H - 4) + '"/>' +
      '<rect class="sq-act" x="' + (x - 66) + '" y="6" width="132" height="28" rx="5"/>' +
      '<text class="sq-at" x="' + x + '" y="25" text-anchor="middle">' + esc(d.actors[i]) + '</text>';
  });
  return '<svg class="seq" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(d.alt || 'Sequence diagram') + '">' + head + body + '</svg>';
}

