// Checks on the source itself (no browser interaction).
import fs from 'fs';
import path from 'path';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.git', 'build', 'vendor'].includes(e.name)) walk(p, out); }
    else if (/\.(js|mjs|go|md|html|css|txt|py|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

export const tests = {
  'no third-party product names in source or docs': async t => {
    const banned = [['E', 'PLAN'].join('')];
    const hits = [];
    for (const f of walk(t.root)) {
      const s = fs.readFileSync(f, 'utf8');
      for (const w of banned) if (new RegExp(w, 'i').test(s)) hits.push(path.relative(t.root, f));
    }
    t.eq(hits, [], 'banned names found in');
  },
  'About guide: bundle is current, links resolve, newest release note is this version, no em dashes': async t => {
    const dir = path.join(t.root, 'ui', 'about'), files = fs.readdirSync(dir).filter(f => /^\d+-.+\.md$/.test(f)).sort();
    const src = fs.readFileSync(path.join(t.root, 'ui', 'js', 'about-pages.js'), 'utf8');
    const pages = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
    t.eq(pages.map(p => p.slug), files.map(f => f.replace(/^\d+-/, '').replace(/\.md$/, '')), 'pages in order (run python3 tools/about.py)');
    files.forEach((f, i) => { const body = fs.readFileSync(path.join(dir, f), 'utf8'); t.eq(pages[i].body === body, true, f + ' bundled (run python3 tools/about.py)'); t.ok(/^# .+/.test(body), f + ' starts with a heading'); t.ok(!body.includes('\u2014'), f + ' has no em dash'); });
    const slugs = new Set(pages.map(p => p.slug)), links = pages.flatMap(p => [...p.body.matchAll(/\(\/about\/([a-z0-9-]+)\)/g)].map(m => m[1]));
    t.eq(links.filter(l => !slugs.has(l)), [], 'links to missing pages');
    t.eq(pages[pages.length - 1].slug, 'release-notes', 'release notes last');
    const ver = fs.readFileSync(path.join(t.root, 'ui', 'js', 'migrate.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
    t.eq(pages[pages.length - 1].body.match(/^## (\S+) /m)[1], ver, 'newest release note');
  },
  'manifest lists every script exactly once': async t => {
    const m = fs.readFileSync(path.join(t.root, 'ui', 'manifest.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    const js = fs.readdirSync(path.join(t.root, 'ui', 'js')).map(f => 'js/' + f);
    t.eq(js.filter(f => !m.includes(f)), [], 'scripts missing from manifest');
    t.eq(m.filter((f, i) => m.indexOf(f) !== i), [], 'duplicate manifest entries');
    t.eq(m[m.length - 1], 'js/files.js', 'files.js must be last');
  },
  'app starts without errors': async t => {
    await t.open();
    t.eq(await t.eval(() => P.pages.length), 1);
    t.eq(await t.eval(() => [...document.querySelectorAll('.rtab')].map(x => x.textContent)), ['Home', 'Insert', 'Pneumatics', 'View', 'Project']);
  },
};
