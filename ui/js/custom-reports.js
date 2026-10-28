// ---------- report settings, page order and custom reports ----------
// Project properties turn each generated report on or off (P.repOff) and set the order of the main sections of the
// page tree (P.order.sections) and of the generated reports (P.order.reports). The same order is used for the page
// tree, PDF export, printing and "Sheet X of Y".
// A custom report (P.customs) is an editable copy of a generated report: pick rows by ticking them and/or with
// filters, hide or rename columns, edit any cell, add rows and notes. Live reports follow the project: an edited
// cell keeps your value and gets a marker when the project value under it changes. Locked reports keep a frozen
// copy of the project data; unlocking keeps the frozen copy until you press Refresh.
const SECTION_DEFS = [['cover', 'Cover sheet'], ['toc', 'Table of contents'], ['sch', 'Schematic'], ['lay', 'Panel layouts'], ['fp', 'Floor plans'], ['custom', 'Custom reports'], ['rep', 'Reports']];
const REPORT_DEFS = [['panel', 'Panel schedules'], ['bom', 'Bill of materials'], ['term', 'Terminal diagrams'], ['conn', 'Connection list'], ['cables', 'Cable overview'], ['cabdiag', 'Cable diagrams'], ['doors', 'Door and window schedule'], ['rev', 'Revision overview']];
const CUSTOM_KINDS = [['bom', 'Bill of materials'], ['panel', 'Panel schedule'], ['term', 'Terminal diagrams'], ['conn', 'Connection list'], ['cables', 'Cable overview'], ['cabdiag', 'Cable diagrams'], ['doors', 'Door and window schedule'], ['rev', 'Revision overview'], ['toc', 'Table of contents'], ['cover', 'Cover sheet']];
const sectionLabel = k => k === 'sch' ? (home() ? 'Circuits' : 'Schematic') : (SECTION_DEFS.find(s => s[0] === k) || [k, k])[1];
const reportLabel = k => (REPORT_DEFS.find(s => s[0] === k) || CUSTOM_KINDS.find(s => s[0] === k) || [k, k])[1];
function keepOrder(saved, def) { const o = (saved || []).filter(k => def.includes(k)); return o.concat(def.filter(k => !o.includes(k))); }
const sectionOrder = () => keepOrder(P.order && P.order.sections, SECTION_DEFS.map(s => s[0]));
const reportOrder = () => keepOrder(P.order && P.order.reports, REPORT_DEFS.map(s => s[0]));
const repOn = k => !(P.repOff || {})[k];
const customs = () => (P.customs = P.customs || []);
const isCustom = pg => !!(pg && pg.custom);
const customOf = pg => pg && pg.custom ? customs().find(c => c.id === pg.custom) : null;

// every page in project order: P.pages plus the generated and custom report pages in `reports`
function orderedPages(reports) {
  const by = {
    cover: reports.filter(r => r.report === 'cover' && !r.custom), toc: reports.filter(r => r.report === 'toc' && !r.custom),
    sch: P.pages.filter(p => !p.kind), lay: P.pages.filter(p => p.kind === 'layout'), fp: P.pages.filter(p => p.kind === 'floor'),
    custom: reports.filter(r => r.custom), rep: reportOrder().flatMap(k => reports.filter(r => !r.custom && r.report === k)),
  };
  return sectionOrder().flatMap(k => by[k] || []);
}

// ---------- the data behind each kind of report: columns and keyed rows ----------
// rows: { key, cells, cls, goto, link, grp (key of the group row it belongs to), group: true for group headings }
function panelCells(r) { return [r.slot, r.circuit, r.brk, r.amps, r.poles, r.type, r.desc, r.rooms, r.load ? String(Math.round(r.load)) : '', r.load ? fmtPct(r.pct) : '', fmtPct(r.vd)]; }
function bomCells(r) { return [String(r.pos), String(r.qty), r.part || 'no part number', r.mfr, r.desc, r.tech, r.tags.join(', '), r.price == null ? '' : money(r.price), r.total == null ? '' : money(r.total)]; }
function customSource(kind, ctx = {}) {
  const blank = n => Array(n).fill('');
  if (kind === 'bom') return { cols: BOM_COLS_F(), rows: bomRows().map(r => ({ key: r.key, cells: bomCells(r), cls: r.missing ? 'missing' : '', goto: r.goto })) };
  if (kind === 'panel') {
    const cols = PS_COLS(), rows = [], groups = [...panelRows()];
    for (const [pn, list] of groups) {
      const gk = 'g:' + pn;
      if (groups.length > 1) rows.push({ key: gk, cells: ['', '', '', '', '', '', `Panel ${pn ? dispTag(pn) : ''}`.trim(), '', '', '', ''], cls: 'grp', group: true });
      for (const r of list) rows.push({ key: r.goto || pn + ':' + r.slot, cells: panelCells(r), cls: r.pct > 80 || r.vd > 3 ? 'over' : '', goto: r.goto, grp: groups.length > 1 ? gk : null });
    }
    return { cols, rows };
  }
  if (kind === 'term') {
    const cols = TERM_COLS_F(), rows = [];
    const strips = [...IX.dev.values()].filter(d => d.items.some(i => i.sym === 'term')).sort((a, b) => natCmp(a.fn, b.fn) || natCmp(a.loc, b.loc) || natCmp(a.tag, b.tag));
    for (const d of strips) {
      const gk = 'g:' + d.key; rows.push({ key: gk, cells: [`Terminal strip ${fl(d.fn, d.loc)}-${d.tag}`].concat(blank(cols.length - 1)), cls: 'grp', group: true });
      for (const r of terminalRows(d)) rows.push({ key: r.goto, cells: [r.intT, r.intW, r.tn, r.extW, r.extT, r.ref, r.desc, r.part], goto: r.goto, grp: gk });
    }
    return { cols, rows };
  }
  if (kind === 'conn') return { cols: CONN_COLS(), rows: connectionRows().map(r => Object.assign({ key: r.goto }, r)) };
  if (kind === 'cables' || kind === 'cabdiag') {
    const cd = cableData(), nm = c => home() ? 'Cable ' + c.tag.replace(/^W/, '') : fl(c.fn, c.loc) + '-' + c.tag;
    if (kind === 'cables') return { cols: CAB_COLS(), rows: cd.map(x => ({ key: x.c.id, cells: [nm(x.c), x.c.ctype || '', x.c.len || '', String(x.conds.length), x.from, x.to, pageName(x.pg)], goto: x.c.id, link: x.pg.id })) };
    const rows = [];
    for (const x of cd) {
      const gk = 'g:' + x.c.id;
      rows.push({ key: gk, cells: [(home() ? 'Cable ' + x.c.tag.replace(/^W/, '') : '-' + x.c.tag) + (x.c.ctype ? '  ' + x.c.ctype : ''), '', '', '', '', pageName(x.pg)], goto: x.c.id, link: x.pg.id, cls: 'grp', group: true });
      x.conds.forEach((k, i) => rows.push({ key: x.c.id + ':' + (i + 1), cells: [`  ${i + 1}`, k.color, k.wire, k.from, k.to, ''], goto: x.c.id, link: x.pg.id, grp: gk }));
    }
    return { cols: CABD_COLS(), rows };
  }
  if (kind === 'doors') { const rows = openingRows(); return { cols: OPEN_COLS(), rows: rows.map(r => ({ key: r.o.id, cells: r.cells, goto: r.o.id })) }; }
  if (kind === 'rev') return { cols: REV_COLS(), rows: (P.revs || []).map(r => ({ key: 'rev:' + r.rev, cells: [r.rev + (r.closed ? '' : ' (open)'), r.date || '', r.desc || '', r.by || '', P.pages.filter(p => (p.revs || []).includes(r.rev)).map(pageName).join(', ')] })) };
  if (kind === 'toc') return { cols: TOC_COLS(), rows: (ctx.toc || []).map(p => Object.assign({ key: 'page:' + p.id }, tocRowFor(p))) };
  if (kind === 'cover') {
    const n = ctx.total || 0;
    return { cols: [{ h: 'Field', w: 80 }, { h: 'Value', w: 200 }], rows: [['title', 'Title', P.name || ''], ['desc', 'Description', P.desc || ''], ['company', 'Company', P.company || ''], ['author', 'Drawn by', P.author || ''], ['created', 'Created', P.created || ''], ['modified', 'Last modified', P.modified || P.created || ''], ['pages', 'Pages', String(n)], ['rev', 'Current revision', ((P.revs || []).slice(-1)[0] || {}).rev || '-']].map(([k, l, v]) => ({ key: 'f:' + k, cells: [l, v] })) };
  }
  return { cols: [], rows: [] };
}
function tocRowFor(p) {
  if (p.report === 'toc' && p.stub) return { cells: [`Contents ${p.sheet}`, 'Table of contents', '', '', '', 'Report'] };
  return { cells: [pageName(p), p.report === 'cover' ? (p.coverTitle != null ? p.coverTitle : P.name || '') : p.desc || '', p.report || isFloor(p) ? '' : dispCkt(p.fn), p.report || isFloor(p) ? '' : (home() ? niceRoom(p.loc) : (p.loc ? '+' + p.loc : '')), lastRev(p), p.report ? (p.custom ? 'Custom report' : 'Report') : isFloor(p) ? 'Floor plan' : isLayout(p) ? 'Panel layout' : 'Schematic'], goto: 'page:' + p.id, link: p.id };
}

// ---------- what a custom report shows ----------
// filters: { col, op: 'has' | 'is' | 'not', value }; start: 'all' (rows matching the filters) or 'none';
// inc / exc: rows ticked or unticked by hand; edits: { rowKey: { col: { v, src } } }; heads: renamed columns;
// hide: hidden columns; extra: rows you added; frozen: { cols, rows, date } while locked or until refreshed
function filterMatch(f, r) {
  const v = String(r.cells[f.col] ?? '').toLowerCase(), q = String(f.value ?? '').trim().toLowerCase();
  if (!q) return true;
  return f.op === 'is' ? v === q : f.op === 'not' ? !v.includes(q) : v.includes(q);
}
function customRowShown(cr, r) {
  if ((cr.inc || []).includes(r.key)) return true;
  if ((cr.exc || []).includes(r.key) || cr.start === 'none') return false;
  return (cr.filters || []).every(f => filterMatch(f, r));
}
function customData(cr, ctx) { return cr.frozen ? clone(cr.frozen) : customSource(cr.base, ctx); }
function customView(cr, ctx) {
  const src = customData(cr, ctx);
  const data = src.rows.filter(r => !r.group);
  const shown = new Set(data.filter(r => customRowShown(cr, r)).map(r => r.key));
  let rows = src.rows.filter(r => r.group ? data.some(d => d.grp === r.key && shown.has(d.key)) : shown.has(r.key));
  for (const x of cr.extra || []) rows.push({ key: x.key, cells: x.cells.slice(), extra: true });
  // totals of what is shown
  if (cr.base === 'bom') { const vis = rows.filter(r => !r.group && !r.extra); const tot = vis.reduce((a, r) => a + (r.cells[8] ? pnum(r.cells[8]) : 0), 0); if (vis.some(r => r.cells[8])) rows.push({ key: 't:total', cells: ['', '', '', '', 'Total', '', '', '', money(tot)], cls: 'grp', total: true }); }
  if (cr.base === 'panel') { const tot = rows.filter(r => !r.group && !r.extra).reduce((a, r) => a + pnum(r.cells[8]), 0); if (tot) rows.push({ key: 't:total', cells: ['', '', '', '', '', '', `Total: ${Math.round(tot)} VA, ${Math.round(tot / 240 * 10) / 10} A at 240 V`, '', String(Math.round(tot)), '', ''], cls: 'grp', total: true }); }
  // your edits on top, with a marker where the project value changed since you edited
  const ed = cr.edits || {};
  rows = rows.map(r => {
    const e = ed[r.key]; if (!e) return r;
    const o = Object.assign({}, r, { cells: r.cells.slice(), marks: [] });
    for (const [ci, x] of Object.entries(e)) { const i = +ci; if (i >= o.cells.length) continue; if (!r.extra && String(x.src ?? '') !== String(r.cells[i] ?? '')) o.marks.push(i); o.cells[i] = x.v; }
    return o;
  });
  // columns: renamed, hidden ones dropped, the rest stretched to the page width
  const hide = new Set(cr.hide || []);
  const idx = src.cols.map((c, i) => i).filter(i => !hide.has(i));
  const wsum = idx.reduce((a, i) => a + src.cols[i].w, 0) || 1, full = src.cols.reduce((a, c) => a + c.w, 0);
  const cols = idx.map(i => Object.assign({}, src.cols[i], { h: (cr.heads || {})[i] != null ? cr.heads[i] : src.cols[i].h, w: src.cols[i].w * full / wsum, src: i }));
  const out = rows.map(r => Object.assign({}, r, { cells: idx.map(i => r.cells[i] ?? ''), marks: (r.marks || []).map(i => idx.indexOf(i)).filter(i => i >= 0), colIdx: idx }));
  return { cols, rows: out, src };
}
// the report pages of one custom report
function customPages(cr, n, ctx) {
  const v = customView(cr, ctx);
  const base = { custom: cr.id, report: cr.base, fn: '', loc: '', desc: cr.title, title: cr.title, items: [], wires: [], notes: cr.notes || '', locked: cr.mode === 'locked' };
  if (cr.base === 'cover') {
    const f = k => { const r = v.rows.find(x => x.key === 'f:' + k); return r ? r.cells[r.colIdx.indexOf(1)] ?? '' : null; };
    const fields = v.rows.filter(r => !['f:title', 'f:desc'].includes(r.key)).map(r => [r.cells[r.colIdx.indexOf(0)] ?? '', r.cells[r.colIdx.indexOf(1)] ?? '', r.key, r.marks]);
    return [Object.assign({}, base, { id: `cus:${cr.id}:1`, num: `CR${n}.1`, cols: v.cols, rows: [], sheet: 1, sheets: 1, coverTitle: f('title'), coverDesc: f('desc'), coverFields: fields, coverMarks: v.rows })];
  }
  const rows = v.rows.map(r => ({ cells: r.cells, cls: r.cls, link: r.link || (r.goto ? linkOfId(r.goto) : ''), key: r.key, marks: r.marks }));
  if (cr.notes) rows.push({ cells: [cr.notes], full: true, key: 'n:notes' });
  const sh = paginate(v.cols, rows);
  return sh.map((rws, i) => Object.assign({}, base, { id: `cus:${cr.id}:${i + 1}`, num: `CR${n}.${i + 1}`, cols: v.cols, rows: rws, sheet: i + 1, sheets: sh.length }));
}

// ---------- making, copying, deleting ----------
function newCustomReport(base) {
  dialog('New custom report', [['base', 'Copy of', base || 'bom', 'select', CUSTOM_KINDS], ['title', 'Title', ''], ['start', 'Start with', 'all', 'select', [['all', 'All rows (narrow it down with filters)'], ['none', 'No rows (tick the rows you want)']]]], v => {
    makeCustomReport(v.base, v.title, v.start);
  }, 'Create', '<div class="note">The copy follows the project (live) until you lock it. Pick rows, hide columns and edit any cell in Properties.</div>');
}
function makeCustomReport(base, title, start) {
  const cr = { id: uid(), base, title: title || 'Custom ' + reportLabel(base).toLowerCase(), mode: 'live', start: start || 'all', filters: [], inc: [], exc: [], edits: {}, heads: {}, hide: [], extra: [], notes: '' };
  commit(() => { customs().push(cr); });
  goPage(`cus:${cr.id}:1`); CUSSEL = null; render();
  flash('Custom report added. Set it up in Properties.');
  return cr;
}
function makeCustomCopy() { const pg = page(); if (!pg.report || pg.custom) return; makeCustomReport(pg.report, (pg.title || reportLabel(pg.report)).replace(/ \d+$/, '') + ' (custom)', 'all'); }
function deleteCustom(cr) {
  if (!confirm(`Delete the custom report "${cr.title}"?`)) return;
  commit(() => { P.customs = customs().filter(c => c !== cr); });
  const first = allPages().find(p => !p.custom); if (first) goPage(first.id);
}
function duplicateCustom(cr) {
  const c = Object.assign(clone(cr), { id: uid(), title: cr.title + ' (copy)' });
  commit(() => { customs().splice(customs().indexOf(cr) + 1, 0, c); }); goPage(`cus:${c.id}:1`);
}
function lockCustom(cr, lock) {
  commit(() => {
    if (lock) { const ctx = customCtx(); const src = customSource(cr.base, ctx); cr.frozen = { cols: src.cols, rows: src.rows, date: today() }; cr.mode = 'locked'; }
    else cr.mode = 'live';
  });
  flash(lock ? 'Locked: this report keeps its current values' : 'Unlocked: press Refresh to bring in the latest project data');
}
function refreshCustom(cr) {
  commit(() => { if (cr.mode === 'locked') { const src = customSource(cr.base, customCtx()); cr.frozen = { cols: src.cols, rows: src.rows, date: today() }; } else delete cr.frozen; });
  flash('Refreshed from the project');
}
// context for sources that need the finished page list (contents, page count)
function customCtx() { const all = allPages(); return { toc: all.filter(p => !(p.report === 'toc' && !p.custom && p.stub)), total: all.length }; }

// ---------- building the report list (called by buildReports) ----------
function assembleReports(gen) {
  gen = gen.filter(r => repOn(r.report));
  const cs = customs();
  // contents and cover need the final order, which depends on how many pages the contents take: settle it in a few passes
  let tocN = 1, cusPages = [], front = [];
  for (let pass = 0; pass < 5; pass++) {
    const cover = repOn('cover') ? [{ id: 'rep:cover:1', report: 'cover', front: true, fn: '', loc: '', num: 'COVER.1', desc: 'Cover sheet', title: 'Cover sheet', cols: [], rows: [], sheet: 1, sheets: 1, items: [], wires: [] }] : [];
    const stubs = repOn('toc') ? Array.from({ length: tocN }, (_, i) => ({ id: `rep:toc:${i + 1}`, report: 'toc', front: true, stub: true, fn: '', loc: '', num: `TOC.${i + 1}`, desc: 'Table of contents', title: 'Table of contents', sheet: i + 1, sheets: tocN, cols: [], rows: [], items: [], wires: [] })) : [];
    const provisional = orderedPages(cover.concat(stubs, cusPages, gen));
    const ctx = { toc: provisional, total: provisional.length };
    cusPages = []; cs.forEach((cr, i) => { cusPages.push(...customPages(cr, i + 1, ctx)); });
    const list = orderedPages(cover.concat(stubs, cusPages, gen));
    let toc = [];
    if (repOn('toc')) {
      const sheets = paginate(TOC_COLS(), list.map(tocRowFor));
      toc = sheets.map((rws, i) => ({ id: `rep:toc:${i + 1}`, report: 'toc', front: true, fn: '', loc: '', num: `TOC.${i + 1}`, desc: 'Table of contents', title: 'Table of contents', cols: TOC_COLS(), rows: rws, sheet: i + 1, sheets: sheets.length, items: [], wires: [] }));
      if (sheets.length !== tocN) { tocN = sheets.length; continue; }
    }
    front = cover.concat(toc);
    const again = orderedPages(front.concat(cusPages, gen)); const ctx2 = { toc: again, total: again.length };
    const cus2 = []; cs.forEach((cr, i) => cus2.push(...customPages(cr, i + 1, ctx2)));
    if (cus2.length === cusPages.length) { cusPages = cus2; break; }
    cusPages = cus2;
  }
  return front.concat(cusPages, gen);
}

// ---------- drawing ----------
let CUSSEL = null; // { cr: id, key, col } the selected cell of a custom report
function customCellsSVG(rp, r, y, x0) {
  if (!rp.custom || r.full) return '';
  let s = '', x = x0;
  r.cells.forEach((_, i) => {
    const c = rp.cols[i], on = CUSSEL && CUSSEL.cr === rp.custom && CUSSEL.key === r.key && CUSSEL.col === c.src;
    if (!PRINTING) s += `<rect class="ccell${on ? ' on' : ''}" data-ccell="${esc(rp.custom)}|${esc(r.key)}|${c.src}" x="${r2(x)}" y="${r2(y)}" width="${r2(c.w)}" height="${r2(r.h)}" fill="${on ? 'rgba(31,111,255,.14)' : 'rgba(0,0,0,0)'}" stroke="${on ? '#1f6fff' : 'none'}" stroke-width="0.3"/>`;
    if (!PRINTING && (r.marks || []).includes(i)) s += `<path class="cmark" data-ccell="${esc(rp.custom)}|${esc(r.key)}|${c.src}" d="M${r2(x + c.w - 3)},${r2(y)}h3v3z" fill="#f59e0b"><title>The project value changed since you edited this cell</title></path>`;
    x += c.w;
  });
  return s;
}

// ---------- properties ----------
function customPropsHTML(pg) {
  const cr = customOf(pg); if (!cr) return '';
  const ctx = customCtx(); const src = customData(cr, ctx); const v = customView(cr, ctx);
  const o = (pairs, cur) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const inp = (k, val, extra = '') => `<input data-ck="${k}" value="${esc(val ?? '')}" ${extra}>`;
  const prow = (label, html) => `<div class="prow"><label>${label}</label>${html}</div>`;
  let s = `<div class="ident">${esc(cr.title)}</div><div class="sub">Custom report from ${esc(reportLabel(cr.base).toLowerCase())}, sheet ${pg.sheet} of ${pg.sheets}</div>`;
  s += `<div class="pgrp"><h4>Report</h4>${prow('Title', inp('title', cr.title))}${prow('Notes', `<textarea data-ck="notes" rows="3">${esc(cr.notes || '')}</textarea>`)}
    ${prow('Updates', `<select data-ck="mode">${o([['live', 'Live (follows the project)'], ['locked', 'Locked (frozen)']], cr.mode)}</select>`)}
    ${cr.mode === 'locked' ? `<div class="note">Frozen on ${esc((cr.frozen || {}).date || '')}. Refresh takes a new copy of the project data.</div>` : cr.frozen ? `<div class="note">Showing the values frozen on ${esc(cr.frozen.date || '')}. Refresh brings in the latest project data.</div>` : ''}
    <div class="btnrow">${cr.frozen ? '<button class="btn" data-cb="refresh">Refresh</button>' : ''}<button class="btn" data-cb="dup">Duplicate</button><button class="btn" data-cb="del">Delete</button></div></div>`;
  // selected cell
  const sc = CUSSEL && CUSSEL.cr === cr.id ? CUSSEL : null;
  if (sc) {
    const srow = src.rows.find(r => r.key === sc.key) || (cr.extra || []).find(r => r.key === sc.key) || v.rows.find(r => r.key === sc.key);
    const vrow = v.rows.find(r => r.key === sc.key);
    const e = ((cr.edits || {})[sc.key] || {})[sc.col];
    const cur = vrow ? vrow.cells[vrow.colIdx.indexOf(sc.col)] : (e ? e.v : '');
    const now = srow && srow.cells ? srow.cells[sc.col] ?? '' : '';
    const colName = ((cr.heads || {})[sc.col]) ?? (src.cols[sc.col] || {}).h ?? '';
    s += `<div class="pgrp"><h4>Selected cell</h4>${prow(esc(colName || 'Value'), `<textarea data-ck="cell" rows="2">${esc(cur ?? '')}</textarea>`)}`;
    if (e && srow && !srow.extra) {
      s += `<div class="note">Edited. Project value when you edited it: ${esc(e.src || '(empty)')}</div>`;
      if (String(e.src ?? '') !== String(now)) s += `<div class="note warnnote">The project now says: ${esc(now || '(empty)')}</div><div class="btnrow"><button class="btn primary" data-cb="accept">Use the new value</button></div>`;
      s += '<div class="btnrow"><button class="btn" data-cb="clearedit">Clear my edit</button></div>';
    }
    s += `<div class="btnrow">${srow && srow.goto ? '<button class="btn" data-cb="goto">Go to it</button>' : ''}${srow && srow.extra ? '<button class="btn" data-cb="delrow">Delete this row</button>' : !sc.key.startsWith('t:') ? '<button class="btn" data-cb="droprow">Leave this row out</button>' : ''}</div></div>`;
  }
  if (cr.base === 'cover') { s += '<div class="note">Click a line on the cover to edit it.</div>'; }
  // columns
  s += `<div class="pgrp"><h4>Columns</h4>${src.cols.map((c, i) => `<div class="prow ccol"><label><input type="checkbox" data-ck="show.${i}" ${(cr.hide || []).includes(i) ? '' : 'checked'}> ${esc(c.h)}</label>${inp('head.' + i, (cr.heads || {})[i] ?? c.h)}</div>`).join('')}</div>`;
  // rows: start, filters, ticks
  {
    const colOpts = src.cols.map((c, i) => [String(i), c.h]);
    s += `<div class="pgrp"><h4>Rows</h4>${prow('Start with', `<select data-ck="start">${o([['all', 'All rows that match the filters'], ['none', 'Only the rows I tick']], cr.start || 'all')}</select>`)}`;
    (cr.filters || []).forEach((f, i) => {
      s += `<div class="cfilter"><select data-ck="f.${i}.col">${o(colOpts, f.col)}</select><select data-ck="f.${i}.op">${o([['has', 'contains'], ['is', 'is'], ['not', 'does not contain']], f.op || 'has')}</select>${inp(`f.${i}.value`, f.value, 'placeholder="text"')}<button class="btn small" data-cb="fdel.${i}" title="Remove filter">×</button></div>`;
    });
    s += `<div class="btnrow"><button class="btn small" data-cb="fadd">Add filter</button><button class="btn small" data-cb="addrow">Add a row</button></div>`;
    const data = src.rows.filter(r => !r.group);
    const label = r => r.cells.filter(c => String(c || '').trim()).slice(0, 3).join(' · ') || r.key;
    s += `<input class="search" data-cq="1" placeholder="Find rows" value="${esc(CUSQ)}" style="margin:4px 0">`;
    const q = CUSQ.trim().toLowerCase();
    s += `<div class="crows">${data.filter(r => !q || label(r).toLowerCase().includes(q)).map(r => `<label class="crow"><input type="checkbox" data-ck="row.${esc(r.key)}" ${customRowShown(cr, r) ? 'checked' : ''}> <span>${esc(label(r))}</span></label>`).join('') || '<div class="note">No rows in this report yet.</div>'}</div>`;
    s += `<div class="note">${v.rows.filter(r => !r.group && !r.total).length} of ${data.length + (cr.extra || []).length} rows shown. New rows that match the filters are added automatically.</div></div>`;
  }
  s += `<div class="btnrow"><button class="btn" data-act="exportPDF">Export PDF</button><button class="btn" data-act="printAll">Print / PDF</button></div>`;
  return s;
}
let CUSQ = '';
function customEdit(cr, key, col, val) {
  const ctx = customCtx(); const src = customData(cr, ctx);
  const ex = (cr.extra || []).find(r => r.key === key);
  commit(() => {
    if (ex) { ex.cells[col] = val; return; }
    const srow = src.rows.find(r => r.key === key) || customView(cr, ctx).rows.find(r => r.key === key);
    const orig = srow ? String(srow.cells[srow.colIdx ? srow.colIdx.indexOf(col) : col] ?? '') : '';
    cr.edits = cr.edits || {}; const e = cr.edits[key] = cr.edits[key] || {};
    if (val === orig && !e[col]) return;
    e[col] = { v: val, src: e[col] ? e[col].src : orig };
    if (val === String(e[col].src)) { delete e[col]; if (!Object.keys(e).length) delete cr.edits[key]; }
  }, { props: false });
  renderProps();
}
function customPropChange(k, v, cr) {
  if (k === 'cell') { if (CUSSEL) customEdit(cr, CUSSEL.key, CUSSEL.col, v); return; }
  if (k === 'mode') { lockCustom(cr, v === 'locked'); return; }
  commit(() => {
    const [a, b, c] = k.split('.');
    if (a === 'title') cr.title = v || cr.title;
    else if (a === 'notes') cr.notes = v;
    else if (a === 'start') { cr.start = v; cr.inc = []; cr.exc = []; }
    else if (a === 'show') { const i = +b; cr.hide = (cr.hide || []).filter(x => x !== i); if (!v) cr.hide.push(i); }
    else if (a === 'head') { cr.heads = cr.heads || {}; const src = customData(cr, customCtx()); if (v === src.cols[+b].h) delete cr.heads[b]; else cr.heads[b] = v; }
    else if (a === 'f') { const f = cr.filters[+b]; if (f) f[c] = c === 'col' ? +v : v; }
    else if (a === 'row') {
      const key = k.slice(4); const src = customData(cr, customCtx()); const r = src.rows.find(x => x.key === key); if (!r) return;
      cr.inc = (cr.inc || []).filter(x => x !== key); cr.exc = (cr.exc || []).filter(x => x !== key);
      const byRule = cr.start !== 'none' && (cr.filters || []).every(f => filterMatch(f, r));
      if (v && !byRule) cr.inc.push(key); if (!v && byRule) cr.exc.push(key);
    }
  });
}
function customButton(op, cr) {
  const ctx = customCtx();
  if (op === 'refresh') return refreshCustom(cr);
  if (op === 'dup') return duplicateCustom(cr);
  if (op === 'del') return deleteCustom(cr);
  if (op === 'fadd') return commit(() => { cr.filters = cr.filters || []; cr.filters.push({ col: 0, op: 'has', value: '' }); });
  if (op.startsWith('fdel.')) return commit(() => { cr.filters.splice(+op.slice(5), 1); });
  if (op === 'addrow') { const src = customData(cr, ctx); const key = 'x:' + uid(); commit(() => { cr.extra = cr.extra || []; cr.extra.push({ key, cells: src.cols.map(() => '') }); }); CUSSEL = { cr: cr.id, key, col: (customView(cr, ctx).cols[0] || { src: 0 }).src }; renderCanvas(); renderProps(); return; }
  if (!CUSSEL) return;
  const { key, col } = CUSSEL;
  if (op === 'accept' || op === 'clearedit') { commit(() => { const e = (cr.edits || {})[key]; if (e) { delete e[col]; if (!Object.keys(e).length) delete cr.edits[key]; } }); return; }
  if (op === 'goto') { const r = customData(cr, ctx).rows.find(x => x.key === key); if (r && r.goto) gotoItem(r.goto); return; }
  if (op === 'delrow') { commit(() => { cr.extra = (cr.extra || []).filter(x => x.key !== key); }); CUSSEL = null; renderProps(); return; }
  if (op === 'droprow') { commit(() => { cr.inc = (cr.inc || []).filter(x => x !== key); if (!(cr.exc || []).includes(key)) (cr.exc = cr.exc || []).push(key); }); CUSSEL = null; renderProps(); }
}
$('#props').addEventListener('change', e => {
  const k = e.target.dataset.ck; if (!k) return; const cr = customOf(page()); if (!cr) return;
  customPropChange(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value, cr);
});
$('#props').addEventListener('click', e => {
  const b = e.target.closest('[data-cb]'); if (!b) return; const cr = customOf(page()); if (!cr) return;
  customButton(b.dataset.cb, cr);
});
$('#props').addEventListener('input', e => {
  if (!e.target.dataset.cq) return; CUSQ = e.target.value; renderProps();
  const n = $('#props [data-cq]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
});
// click a cell to select it; double-click (or Enter) puts the cursor in its value
document.addEventListener('click', e => {
  const c = e.target.closest('#content [data-ccell]'); if (!c) return;
  const [cr, key, col] = c.dataset.ccell.split('|'); CUSSEL = { cr, key, col: +col }; renderCanvas(); renderProps();
});
document.addEventListener('dblclick', e => {
  const c = e.target.closest('#content [data-ccell]'); if (!c) return;
  const t = $('#props [data-ck="cell"]'); if (t) { t.focus(); t.select(); }
});

// ---------- project properties: reports on or off and page order ----------
function reportSettingsHTML() {
  const sec = sectionOrder(), rep = reportOrder();
  const row = (list, k, label, i, n, check) => `<div class="ordrow" data-ord="${list}:${k}">${check ? `<input type="checkbox" data-repon="${k}" ${repOn(k) ? 'checked' : ''}>` : '<span class="ordsp"></span>'}<span class="ordl">${esc(label)}</span><button type="button" class="btn small" data-ordmv="${list}:${i}:-1" ${i ? '' : 'disabled'} title="Move up">▲</button><button type="button" class="btn small" data-ordmv="${list}:${i}:1" ${i < n - 1 ? '' : 'disabled'} title="Move down">▼</button></div>`;
  return `<div class="ordbox"><h4>Page order</h4><div class="note">The order of the page tree, PDF export, printing and sheet numbers. Untick a report to leave it out.</div>
    <div data-ordlist="sec">${sec.map((k, i) => row('sec', k, sectionLabel(k), i, sec.length, k === 'cover' || k === 'toc')).join('')}</div>
    <h4>Reports</h4><div data-ordlist="rep">${rep.map((k, i) => row('rep', k, reportLabel(k), i, rep.length, true)).join('')}</div></div>`;
}
// reads the order and switches back out of the dialog before it closes
function readReportSettings() {
  const sec = [...document.querySelectorAll('[data-ordlist="sec"] [data-ord]')].map(e => e.dataset.ord.split(':')[1]);
  const rep = [...document.querySelectorAll('[data-ordlist="rep"] [data-ord]')].map(e => e.dataset.ord.split(':')[1]);
  const off = {}; document.querySelectorAll('[data-repon]').forEach(e => { if (!e.checked) off[e.dataset.repon] = true; });
  return { order: { sections: sec, reports: rep }, off };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ordmv]'); if (!b) return;
  const [list, i, d] = b.dataset.ordmv.split(':'); const box = $(`[data-ordlist="${list}"]`); const rows = [...box.children];
  const a = rows[+i], c = rows[+i + +d]; if (!a || !c) return;
  if (+d < 0) box.insertBefore(a, c); else box.insertBefore(c, a);
  [...box.children].forEach((r, j, all) => { const [up, dn] = r.querySelectorAll('[data-ordmv]'); up.dataset.ordmv = `${list}:${j}:-1`; dn.dataset.ordmv = `${list}:${j}:1`; up.disabled = !j; dn.disabled = j === all.length - 1; });
});
