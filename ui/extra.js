// ---------- theme (dark mode) ----------
let PRINTING = false;
const sheetDark = () => PREFS.sheet === 'dark' && !PRINTING;
const WIRECOL_DARK = { BK: '#cfd3d8', WH: '#e8ebef', GN: '#3cc760', RD: '#ff5c5c', BL: '#5b9bff', YL: '#f2d23c', BARE: '#e09a5c' };
const wireColor = c => (sheetDark() ? WIRECOL_DARK : WIRECOL)[c];
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const dark = PREFS.theme === 'dark' || (PREFS.theme === 'system' && mq && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.sheet = PREFS.sheet === 'dark' ? 'dark' : 'white';
}
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (PREFS.theme === 'system') applyTheme(); });
function toggleTheme() { PREFS.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; savePrefs(); applyTheme(); flash(PREFS.theme === 'dark' ? 'Dark theme' : 'Light theme'); }
function toggleSheet() { PREFS.sheet = PREFS.sheet === 'dark' ? 'white' : 'dark'; savePrefs(); applyTheme(); render(); flash(PREFS.sheet === 'dark' ? 'Dark sheet' : 'White sheet'); }

// ---------- inserting content (paste and macros) ----------
function insertContent(src, dx, dy, pg, assignFL) {
  const tagMap = new Map(), ns = new Set(), idMap = new Map();
  const tmp = [];
  for (const s0 of src.items || []) {
    const it = clone(s0); const oldId = it.id; it.id = uid(); idMap.set(oldId, it.id); it.x += dx; it.y += dy;
    const d = SYM[it.sym];
    if (assignFL && d && d.prefix) {
      if (!d.res || !it.loc) it.loc = pg.loc || '';
      it.fn = pg.fn || '';
    }
    if (d && d.prefix && it.tag && it.sym !== 'term' && d.role !== 'plc') {
      const k = devKey(s0) + (assignFL ? '|m' : '');
      if (!tagMap.has(k)) {
        const m = /^([A-Za-z]+)\d*$/.exec(it.tag);
        const nt = nextTag(it.fn, it.loc, m ? m[1] : d.prefix, d.res);
        tagMap.set(k, nt);
        const t = { id: '__tmp', sym: 'box', fn: it.fn, loc: it.loc, tag: nt, x: -999, y: -999 }; tmp.push(t); pg.items.push(t);
      }
      it.tag = tagMap.get(k);
    }
    if (d && d.brk) it.slot = nextSlot();
    if (it.sym === 'term') it.tn = nextTerminal(it.fn, it.loc, it.tag);
    pg.items.push(it); ns.add(it.id);
  }
  pg.items = pg.items.filter(i => i.id !== '__tmp');
  for (const s0 of src.wires || []) { const w = clone(s0); w.id = uid(); w.pts = w.pts.map(p => [r2(p[0] + dx), r2(p[1] + dy)]); delete w.no; pg.wires.push(w); ns.add(w.id); }
  pg.cables = pg.cables || [];
  for (const s0 of src.cables || []) {
    const c = clone(s0); c.id = uid(); c.x1 += dx; c.x2 += dx; c.y1 += dy; c.y2 += dy; c.tag = nextCableTag(); c.cond = {};
    if (assignFL) { c.fn = pg.fn || ''; c.loc = pg.loc || ''; }
    pg.cables.push(c); ns.add(c.id);
  }
  return ns;
}

// ---------- macros ----------
function saveMacro() {
  const pg = page(); if (isFloor(pg) || pg.report) { flash('Open a schematic page and select what to save'); return; }
  const items = pg.items.filter(i => sel.has(i.id)), wires = pg.wires.filter(w => sel.has(w.id)), cables = (pg.cables || []).filter(c => sel.has(c.id));
  if (!items.length && !wires.length) { flash('Select the symbols and connections to save as a macro first'); return; }
  const xs = [], ys = [];
  for (const it of items) { const b = itemBox(it); xs.push(b[0]); ys.push(b[1]); }
  for (const w of wires) for (const p of w.pts) { xs.push(p[0]); ys.push(p[1]); }
  const ox = Math.floor(Math.min(...xs) / 4) * 4, oy = Math.floor(Math.min(...ys) / 4) * 4;
  dialog('Save selection as macro', [['name', 'Macro name', ''], ['desc', 'Description', '']], v => {
    if (!v.name) { alert('Enter a name for the macro.'); return false; }
    const m = {
      id: 'm_' + uid(), name: v.name, desc: v.desc,
      items: items.map(i => { const c = clone(i); c.x = r2(c.x - ox); c.y = r2(c.y - oy); return c; }),
      wires: wires.map(w => { const c = clone(w); c.pts = c.pts.map(p => [r2(p[0] - ox), r2(p[1] - oy)]); delete c.no; return c; }),
      cables: cables.map(c0 => { const c = clone(c0); c.x1 -= ox; c.x2 -= ox; c.y1 -= oy; c.y2 -= oy; return c; }),
    };
    LIB.macros = LIB.macros || []; LIB.macros.push(m); saveLibrary();
    flash(`Saved macro "${v.name}"`);
  }, 'Save');
}
let placeMacro = null;
function macroPreview(m, w = 170, h = 110) {
  const xs = [], ys = [];
  for (const it of m.items) { const b = itemBox(it); xs.push(b[0], b[2]); ys.push(b[1], b[3]); }
  for (const wr of m.wires) for (const p of wr.pts) { xs.push(p[0]); ys.push(p[1]); }
  const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6, x1 = Math.max(...xs) + 6, y1 = Math.max(...ys) + 6;
  const fake = { fn: '', loc: '', items: [] };
  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" style="width:${w}px;height:${h}px;background:#fff;border:1px solid var(--line);border-radius:4px">${m.wires.map(wr => `<path class="wire" d="M${wr.pts.map(p => p.join(',')).join('L')}"/>`).join('')}${m.items.map(it => itemSVG(it, fake, false, true)).join('')}</svg>`;
}
function insertMacroDlg() {
  const ms = LIB.macros || [];
  const html = ms.length ? `<div class="macgrid">${ms.map(m => `<div class="maccard"><div>${macroPreview(m)}</div><b>${esc(m.name)}</b><span class="note">${esc(m.desc || '')}</span>
    <div class="btnrow"><button type="button" class="btn small primary" data-mac="ins:${m.id}">Insert</button><button type="button" class="btn small" data-mac="ren:${m.id}">Rename</button><button type="button" class="btn small" data-mac="del:${m.id}">Delete</button></div></div>`).join('')}</div>`
    : '<div class="note">No macros yet. Select part of a schematic and use Save selection as macro.</div>';
  dialog('Macros', [], null, 'OK', `<div class="sub">Macros are saved in the OpenSchem Data folder and are available in every project. Inserted devices get the next free tags and the page's ${home() ? 'circuit' : 'function and location'}.</div>${html}`);
  $('#dlg').style.width = '760px';
  $('#dlgbody').onclick = e => {
    const b = e.target.closest('[data-mac]'); if (!b) return;
    const [op, id] = b.dataset.mac.split(':'); const m = ms.find(x => x.id === id); if (!m) return;
    if (op === 'ins') {
      if (isFloor(page()) || page().report) { alert('Open a schematic page first.'); return; }
      $('#dlg').close(); placeMacro = m; setMode('macro'); flash(`Click to place "${m.name}". Esc to finish.`);
    } else if (op === 'ren') { const n = prompt('Macro name:', m.name); if (n) { m.name = n; saveLibrary(); $('#dlg').close(); insertMacroDlg(); } }
    else if (op === 'del') { if (confirm(`Delete macro "${m.name}"?`)) { LIB.macros = ms.filter(x => x !== m); saveLibrary(); $('#dlg').close(); insertMacroDlg(); } }
  };
}
function drawMacroGhost(mx, my) {
  if (!placeMacro) return;
  const dx = snap(mx), dy = snap(my); const fake = { fn: '', loc: '', items: [] };
  $('#overlay').innerHTML = `<g transform="translate(${dx},${dy})" opacity="0.75">${placeMacro.wires.map(w => `<path class="wprev" d="M${w.pts.map(p => p.join(',')).join('L')}"/>`).join('')}${placeMacro.items.map(it => itemSVG(it, fake, false, true)).join('')}</g>`;
}
function placeMacroAt(pg, mx, my) {
  const m = placeMacro; if (!m) return;
  commit(() => { sel = insertContent(m, snap(mx), snap(my), pg, true); });
  drawMacroGhost(mx, my);
}

// ---------- cables ----------
function nextCableTag() {
  let max = 0; for (const pg of P.pages) for (const c of pg.cables || []) { const m = /^W(\d+)$/.exec(c.tag || ''); if (m) max = Math.max(max, +m[1]); }
  return 'W' + (max + 1);
}
function cableCrossings(pg, c) {
  const out = []; const horiz = c.y1 === c.y2;
  const lo = horiz ? Math.min(c.x1, c.x2) : Math.min(c.y1, c.y2), hi = horiz ? Math.max(c.x1, c.x2) : Math.max(c.y1, c.y2);
  for (const w of pg.wires) {
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      if (horiz && a[0] === b[0] && a[0] > lo && a[0] < hi && c.y1 > Math.min(a[1], b[1]) && c.y1 < Math.max(a[1], b[1])) { out.push({ w, x: a[0], y: c.y1, along: a[0] }); break; }
      if (!horiz && a[1] === b[1] && a[1] > lo && a[1] < hi && c.x1 > Math.min(a[0], b[0]) && c.x1 < Math.max(a[0], b[0])) { out.push({ w, x: c.x1, y: a[1], along: a[1] }); break; }
    }
  }
  return out.sort((a, b) => a.along - b.along);
}
function condColor(c, cr) { return (c.cond || {})[cr.w.id] || cr.w.color || ''; }
function defaultCableType(pg, c) {
  const cr = cableCrossings(pg, c); if (!cr.length) return '';
  const cols = cr.map(x => condColor(c, x)); const awg = cr.map(x => x.w.awg).find(Boolean);
  if (!awg) return `${cr.length}-conductor`;
  const n = cols.filter(k => k !== 'GN' && k !== 'BARE').length, g = cols.length - n;
  return `${awg}/${n}${g ? ' w/G' : ''}`;
}
function cableSVG(c, pg, isSel) {
  const cr = cableCrossings(pg, c); const horiz = c.y1 === c.y2;
  const col = isSel ? '#1f6fff' : (sheetDark() ? '#c8cdd4' : '#444');
  let s = `<g data-id="${c.id}" class="cable"><path class="wirehit" d="M${c.x1},${c.y1}L${c.x2},${c.y2}"/>`;
  s += `<path d="M${c.x1},${c.y1}L${c.x2},${c.y2}" stroke="${col}" stroke-width="0.3" stroke-dasharray="2,0.8,0.4,0.8" fill="none"/>`;
  const tick = (x, y) => horiz ? `M${x - 0.8},${y + 1.4}L${x + 0.8},${y - 1.4}` : `M${x - 1.4},${y - 0.8}L${x + 1.4},${y + 0.8}`;
  s += `<path d="${tick(c.x1, c.y1)}${tick(c.x2, c.y2)}" stroke="${col}" stroke-width="0.3" fill="none"/>`;
  for (const x of cr) s += `<circle cx="${x.x}" cy="${x.y}" r="0.55" fill="${col}"/>`;
  const label = [home() ? (c.tag ? 'Cable ' + c.tag.replace(/^W/, '') : 'Cable') : identOnPage(c, pg), c.ctype, c.len].filter(Boolean).join('  ');
  s += horiz ? txt(Math.min(c.x1, c.x2), c.y1 - 1.6, label, { size: FSS, cls: isSel ? 'tx' : '' })
             : txt(c.x1 - 1.6, Math.min(c.y1, c.y2), label, { size: FSS, anchor: 'end', rot: -90, cls: isSel ? 'tx' : '' });
  return s + '</g>';
}
function findCable(id) { for (const pg of P.pages) { const c = (pg.cables || []).find(x => x.id === id); if (c) return { c, pg }; } return null; }

// targets reached from a point, following wires but not passing through devices
function traverse(pg, start, skipWire) {
  const seen = new Set([start.join(',')]), q = [start], used = new Set(skipWire ? [skipWire] : []), targets = [];
  while (q.length) {
    const p = q.shift();
    for (const it of pg.items) for (const c of connPts(it)) {
      if (c.x !== p[0] || c.y !== p[1]) continue;
      const d = SYM[it.sym]; let t;
      if (d.role === 'ip') t = '> ' + (it.ipName || '?');
      else if (d.role === 'pe') t = 'PE';
      else if (d.role === 'bar') t = d.pot + ' bar';
      else if (d.role === 'term') t = dispOnPage(it, pg) + ':' + (it.tn || '');
      else t = dispOnPage(it, pg) + ':' + ((it.cl || [])[c.i] || c.i + 1);
      if (!targets.includes(t)) targets.push(t);
    }
    for (const w of pg.wires) {
      if (used.has(w.id) || !onPoly(p, w.pts)) continue;
      used.add(w.id);
      const ends = [w.pts[0], w.pts[w.pts.length - 1]];
      for (const w2 of pg.wires) if (w2 !== w) for (const e of [w2.pts[0], w2.pts[w2.pts.length - 1]]) if (onPoly(e, w.pts)) ends.push(e);
      for (const e of ends) { const k = e.join(','); if (!seen.has(k)) { seen.add(k); q.push(e); } }
    }
  }
  return targets;
}
function wireEnds(pg, w) {
  const a = w.pts[0], b = w.pts[w.pts.length - 1];
  return [traverse(pg, a, w.id).join(', '), traverse(pg, b, w.id).join(', ')];
}

// ---------- extra reports: connection list, cables, cover, contents, revisions ----------
const CONN_COLS = () => S().reportCols === 'plain'
  ? [{ h: 'Wire', w: 26, a: 'middle' }, { h: 'From', w: 112 }, { h: 'To', w: 112 }, { h: 'Color', w: 26, a: 'middle' }, { h: 'Size', w: 30, a: 'middle' }, { h: 'Cable', w: 34 }, { h: 'Page', w: 60 }]
  : [{ h: 'Wire no.', w: 26, a: 'middle' }, { h: 'Source', w: 112 }, { h: 'Target', w: 112 }, { h: 'Color', w: 26, a: 'middle' }, { h: 'Cross-section', w: 30, a: 'middle' }, { h: 'Cable', w: 34 }, { h: 'Page / column', w: 60 }];
function connectionRows() {
  const rows = [];
  const cabOf = new Map();
  for (const pg of P.pages) for (const c of pg.cables || []) for (const cr of cableCrossings(pg, c)) cabOf.set(cr.w.id, c.tag);
  for (const pg of P.pages) {
    if (isFloor(pg)) continue;
    for (const w of pg.wires) {
      const [f, t] = wireEnds(pg, w);
      if (!f && !t) continue;
      rows.push({ cells: [WN.get(w.id) || '', f, t, w.color || '', w.awg ? w.awg + ' AWG' : (w.cs || ''), cabOf.get(w.id) || '', pageName(pg) + '.' + colOf(w.pts[0][0])], goto: w.id, link: pg.id });
    }
  }
  return rows;
}
const CAB_COLS = () => [{ h: home() ? 'Cable' : 'Cable (-W)', w: 40 }, { h: 'Type', w: 50 }, { h: 'Length', w: 26, a: 'middle' }, { h: 'Cond.', w: 18, a: 'middle' }, { h: 'From', w: 112 }, { h: 'To', w: 112 }, { h: 'Page', w: 42 }];
const CABD_COLS = () => [{ h: 'Cable / conductor', w: 60 }, { h: 'Color', w: 26, a: 'middle' }, { h: 'Wire', w: 26, a: 'middle' }, { h: 'From', w: 130 }, { h: 'To', w: 130 }, { h: 'Page', w: 28 }];
function cableData() {
  const out = [];
  for (const pg of P.pages) for (const c of pg.cables || []) {
    const cr = cableCrossings(pg, c);
    const conds = cr.map(x => { const e = wireEnds(pg, x.w); const flip = (c.y1 === c.y2) ? x.w.pts[0][1] > x.w.pts[x.w.pts.length - 1][1] : x.w.pts[0][0] > x.w.pts[x.w.pts.length - 1][0]; return { color: condColor(c, x), wire: WN.get(x.w.id) || '', from: flip ? e[1] : e[0], to: flip ? e[0] : e[1] }; });
    const dev = s => [...new Set(s.split(', ').map(t => t.split(':')[0]).filter(Boolean))].join(', ');
    out.push({ c, pg, conds, from: dev(conds.map(x => x.from).join(', ')), to: dev(conds.map(x => x.to).join(', ')) });
  }
  return out.sort((a, b) => natCmp(a.c.tag, b.c.tag));
}
const TOC_COLS = () => [{ h: 'Page', w: 56 }, { h: 'Description', w: 170 }, { h: home() ? 'Circuit' : 'Function (=)', w: 56 }, { h: home() ? 'Room' : 'Location (+)', w: 56 }, { h: 'Rev', w: 22, a: 'middle' }, { h: 'Type', w: 40 }];
const REV_COLS = () => [{ h: 'Rev', w: 20, a: 'middle' }, { h: 'Date', w: 34 }, { h: 'Description', w: 170 }, { h: 'By', w: 46 }, { h: 'Pages changed', w: 130 }];
function lastRev(pg) { return (pg.revs || []).slice(-1)[0] || ''; }
function mkReport(list, base, rows, cols, extra) {
  const sh = paginate(cols, rows);
  sh.forEach((rws, i) => list.push(Object.assign({ id: `${base.id}:${i + 1}`, fn: '', loc: '', num: `${base.num}.${i + 1}`, cols, rows: rws, sheet: i + 1, sheets: sh.length, items: [], wires: [] }, base, { id: `${base.id}:${i + 1}`, num: `${base.num}.${i + 1}` }, extra || {})));
}
function buildExtraReports(reps) {
  // connection list
  const cr = connectionRows();
  if (cr.length) mkReport(reps, { id: 'rep:conn', report: 'conn', num: 'CON', desc: 'Connection list', title: 'Connection list' }, cr, CONN_COLS());
  // cables
  const cd = cableData();
  if (cd.length) {
    mkReport(reps, { id: 'rep:cab', report: 'cables', num: 'CAB', desc: 'Cable overview', title: 'Cable overview' },
      cd.map(x => ({ cells: [home() ? 'Cable ' + x.c.tag.replace(/^W/, '') : fl(x.c.fn, x.c.loc) + '-' + x.c.tag, x.c.ctype || '', x.c.len || '', String(x.conds.length), x.from, x.to, pageName(x.pg)], goto: x.c.id, link: x.pg.id })), CAB_COLS());
    const rows = [];
    for (const x of cd) {
      rows.push({ cells: [(home() ? 'Cable ' + x.c.tag.replace(/^W/, '') : '-' + x.c.tag) + (x.c.ctype ? '  ' + x.c.ctype : ''), '', '', '', '', pageName(x.pg)], goto: x.c.id, link: x.pg.id, cls: 'grp' });
      x.conds.forEach((k, i) => rows.push({ cells: [`  ${i + 1}`, k.color, k.wire, k.from, k.to, ''], goto: x.c.id, link: x.pg.id }));
    }
    mkReport(reps, { id: 'rep:cabd', report: 'cabdiag', num: 'CABD', desc: 'Cable diagrams', title: 'Cable diagrams' }, rows, CABD_COLS());
  }
  // revisions
  if ((P.revs || []).length) {
    const all = P.pages;
    mkReport(reps, { id: 'rep:rev', report: 'rev', num: 'REV', desc: 'Revision overview', title: 'Revision overview' },
      P.revs.map(r => ({ cells: [r.rev + (r.closed ? '' : ' (open)'), r.date || '', r.desc || '', r.by || '', all.filter(p => (p.revs || []).includes(r.rev)).map(pageName).join(', ')] })), REV_COLS());
  }
}
function buildFrontPages(reps) {
  const front = [];
  if (P.cover !== false) front.push({ id: 'rep:cover:1', report: 'cover', front: true, fn: '', loc: '', num: 'COVER.1', desc: 'Cover sheet', title: 'Cover sheet', cols: [], rows: [], sheet: 1, sheets: 1, items: [], wires: [] });
  if (P.toc !== false) {
    const later = P.pages.concat(reps);
    const rowFor = p => ({ cells: [pageName(p), p.desc || '', p.report || isFloor(p) ? '' : dispCkt(p.fn), p.report || isFloor(p) ? '' : (home() ? niceRoom(p.loc) : (p.loc ? '+' + p.loc : '')), lastRev(p), p.report ? 'Report' : isFloor(p) ? 'Floor plan' : 'Schematic'], goto: 'page:' + p.id, link: p.id });
    let n = 1, sheets;
    for (let pass = 0; pass < 4; pass++) {
      const tocRows = []; for (let i = 0; i < n; i++) tocRows.push({ cells: [`Contents ${i + 1}`, 'Table of contents', '', '', '', 'Report'] });
      const coverRow = P.cover !== false ? [{ cells: ['Cover sheet', P.name || '', '', '', '', 'Report'], goto: 'page:rep:cover:1', link: 'rep:cover:1' }] : [];
      sheets = paginate(TOC_COLS(), coverRow.concat(tocRows, later.map(rowFor)));
      if (sheets.length === n) break; n = sheets.length;
    }
    sheets.forEach((rws, i) => front.push({ id: `rep:toc:${i + 1}`, report: 'toc', front: true, fn: '', loc: '', num: `TOC.${i + 1}`, desc: 'Table of contents', title: 'Table of contents', cols: TOC_COLS(), rows: rws, sheet: i + 1, sheets: sheets.length, items: [], wires: [] }));
  }
  return front;
}
function coverSVG(pg) {
  const all = allPages();
  let s = frameSVG(pg, all.indexOf(pg), all.length);
  const cx = (SH.x0 + SH.x1) / 2;
  s += `<text class="t" x="${cx}" y="70" font-size="12" font-weight="bold" text-anchor="middle">${esc(P.name || '')}</text>`;
  if (P.desc) String(P.desc).split('\n').forEach((l, i) => { s += `<text class="t" x="${cx}" y="${88 + i * 7}" font-size="5" text-anchor="middle">${esc(l)}</text>`; });
  const rows = [['Company', P.company], ['Drawn by', P.author], ['Created', P.created], ['Last modified', P.modified || P.created], ['Pages', String(all.length)], ['Current revision', ((P.revs || []).slice(-1)[0] || {}).rev || '-']];
  rows.forEach(([k, v], i) => {
    const y = 140 + i * 11;
    s += `<text class="t tc" x="${cx - 6}" y="${y}" font-size="4" text-anchor="end">${esc(k)}</text><text class="t" x="${cx + 6}" y="${y}" font-size="4.4" font-weight="bold">${esc(v || '')}</text>`;
  });
  s += `<line class="frame2" x1="${cx - 90}" y1="${126}" x2="${cx + 90}" y2="${126}"/>`;
  return s;
}

// ---------- revisions ----------
function activeRev() { const r = (P.revs || []).slice(-1)[0]; return r && !r.closed ? r.rev : null; }
function revisionsDlg() {
  const revs = P.revs || [];
  const nextL = String.fromCharCode(65 + revs.length);
  const rows = revs.length ? revs.map(r => `<div class="msg" style="cursor:default"><span class="lv">${esc(r.rev)}</span><span style="flex:1">${esc(r.date)} · ${esc(r.desc || '')} <span class="note">${esc(r.by || '')}</span></span><span class="note">${r.closed ? 'closed' : '<b>open</b>, changes are being marked'}</span></div>`).join('') : '<div class="note">No revisions yet.</div>';
  const open = activeRev();
  dialog('Revisions', [], null, 'OK', `<div class="sub">While a revision is open, every page you change is marked with its letter in the title block, the table of contents and the revision overview report.</div>${rows}
    <div class="btnrow" style="margin-top:10px">${open ? `<button type="button" class="btn small primary" data-rev="close">Close revision ${esc(open)}</button>` : `<button type="button" class="btn small primary" data-rev="new">Start revision ${nextL}</button>`}</div>`);
  $('#dlgbody').onclick = e => {
    const b = e.target.closest('[data-rev]'); if (!b) return;
    if (b.dataset.rev === 'close') { commit(() => { P.revs[P.revs.length - 1].closed = true; }); $('#dlg').close(); flash('Revision closed'); return; }
    $('#dlg').close();
    dialog(`Start revision ${nextL}`, [['desc', 'Description', ''], ['by', 'Changed by', P.author || '']], v => {
      commit(() => { P.revs = P.revs || []; P.revs.push({ rev: nextL, date: today(), desc: v.desc, by: v.by, closed: false }); });
      flash(`Revision ${nextL} started`);
    }, 'Start');
  };
}

// ---------- PDF export ----------
const PDF_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-weight', 'text-anchor', 'opacity', 'fill-opacity', 'stroke-opacity'];
async function exportPDF() {
  if (!window.jspdf || !window.svg2pdf) { alert('PDF export is not available in this build.'); return; }
  flash('Creating PDF...');
  PRINTING = true; const keep = sel; sel = new Set();
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-6000px;top:0;width:1680px;height:1188px;overflow:hidden';
  document.body.appendChild(box);
  try {
    buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
    const pages = allPages(); const num = new Map(pages.map((p, i) => [p.id, i + 1]));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [420, 297], compress: true });
    doc.setProperties({ title: P.name || 'OpenSchem project', creator: 'OpenSchem', author: P.author || '' });
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i]; if (i) doc.addPage([420, 297], 'landscape');
      box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SH.w} ${SH.h}" width="1680" height="1188">${pageSVG(pg, { print: true }).replace(/id="(gp|fpc-[^"]+|fgp-[^"]+)"/g, 'id="$1-pdf"').replace(/url\(#(gp|fpc-[^)]+|fgp-[^)]+)\)/g, 'url(#$1-pdf)')}</svg>`;
      const el = box.firstElementChild;
      const links = [];
      el.querySelectorAll('[data-link]').forEach(n => { const p = num.get(n.dataset.link); if (!p || p === i + 1) return; try { const b = n.getBBox(); links.push([b.x, b.y, b.width, b.height, p]); } catch (e) {} });
      el.querySelectorAll('.hit,.wirehit').forEach(n => n.remove());
      el.querySelectorAll('[fill^="url(#gp"],[fill^="url(#fgp"]').forEach(n => n.remove());
      el.querySelectorAll('*').forEach(n => {
        const cs = getComputedStyle(n);
        for (const a of PDF_ATTRS) { const v = cs.getPropertyValue(a); if (v && v !== 'normal') n.setAttribute(a, v.replace(/px/g, '')); }
        if (n.tagName === 'text') n.setAttribute('font-family', 'helvetica');
      });
      await window.svg2pdf.svg2pdf(el, doc, { x: 0, y: 0, width: 420, height: 297 });
      for (const [x, y, w, h, p] of links) doc.link(x, y, Math.max(w, 2), Math.max(h, 2), { pageNumber: p });
      doc.outline.add(null, `${pageName(pg)}${pg.desc && !pg.report ? '  ' + pg.desc : ''}`, { pageNumber: i + 1 });
    }
    const b64 = doc.output('datauristring').split(',')[1];
    const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
    const p = await host.saveBinary(b64, name, 'PDF document', 'pdf');
    if (p) flash('Exported ' + p);
  } catch (e) { alert('PDF export failed: ' + e.message); }
  finally { box.remove(); PRINTING = false; sel = keep; render(); }
}
