// ---------- reports: bill of materials and terminal diagrams ----------
let REPORTS = [];
const RP = { top: 30, bottom: 256, lh: 4.2, pad: 1.6, fs: 2.7 };

function linkOfId(id) {
  if (String(id).startsWith('page:')) return id.slice(5);
  const f = findItem(id); return f && f.pg ? f.pg.id : '';
}
function wrapText(text, width, fs) {
  const max = Math.max(3, Math.floor(width / (fs * 0.56)));
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/(?<=[ ,])/)) {
      if ((line + word).length > max && line) { out.push(line.trimEnd()); line = ''; }
      let w = word;
      while (w.length > max) { out.push(w.slice(0, max)); w = w.slice(max); }
      line += w;
    }
    out.push(line.trimEnd());
  }
  return out.length ? out : [''];
}

// paginate rows into sheets; each row = array of cell strings
function paginate(cols, rows) {
  const avail = RP.bottom - RP.top - (RP.lh + RP.pad * 2);
  const sheets = []; let cur = [], used = 0;
  for (const r of rows) {
    const fullW = cols.reduce((a, c) => a + c.w, 0);
    const cells = r.full ? [wrapText(r.cells[0], fullW - 2.4, RP.fs)] : r.cells.map((c, i) => wrapText(c, cols[i].w - 2.4, RP.fs));
    const h = Math.max(...cells.map(c => c.length)) * RP.lh + RP.pad * 2;
    if (used + h > avail && cur.length) { sheets.push(cur); cur = []; used = 0; }
    cur.push({ cells, h, cls: r.cls, goto: r.goto, link: r.link, key: r.key, marks: r.marks, full: r.full }); used += h;
  }
  sheets.push(cur);
  return sheets;
}

function bomRows() {
  const groups = new Map();
  const add = (key, data, tag) => {
    if (!groups.has(key)) groups.set(key, Object.assign({ qty: 0, tags: [], key }, data));
    const g = groups.get(key); g.qty++; if (tag && !g.tags.includes(tag)) g.tags.push(tag);
  };
  for (const d of IX.dev.values()) {
    const isTerm = d.items.some(i => i.sym === 'term');
    const ident = dispFull(d.fn, d.loc, d.tag);
    if (isTerm) {
      for (const t of d.items) {
        const part = t.part || '';
        add(part ? 'p:' + part : 't:' + ident, { part, desc: part ? 'Terminal' : `Terminal strip ${ident}`, tech: t.tech || '', missing: !part, first: t }, ident + ':' + (t.tn || ''));
      }
      continue;
    }
    const src = d.main || d.items[0];
    const part = (d.items.find(i => i === d.main && i.part) || d.items.find(i => i.part) || {}).part || '';
    const tech = (d.items.find(i => i.tech) || {}).tech || '';
    const name = SYM[src.sym].name;
    const desc = src.desc ? `${name}, ${src.desc}` : name;
    if (part) add('p:' + part, { part, desc, tech, missing: false, first: src }, ident);
    else add('d:' + d.key, { part: '', desc, tech, missing: true, first: src }, ident);
  }
  blockBomAdd(add);
  for (const pg of P.pages) for (const c of pg.cables || []) {
    const part = c.part || ''; const type = c.ctype || 'unspecified';
    add(part ? 'p:' + part : 'cab:' + type, { part, desc: 'Cable, ' + type, tech: '', missing: !part, first: { id: c.id } }, (home() ? 'Cable ' + c.tag.replace(/^W/, '') : '-' + c.tag) + (c.len ? ' (' + c.len + ')' : ''));
  }
  // tubes with a part number (tubes without one are listed on the tubing list only)
  for (const pg of P.pages) for (const w of pg.wires) if (w.tube && w.part) add('p:' + w.part, { part: w.part, desc: 'Tube, ' + tubeOdLabel(w.od), tech: '', missing: false, first: { id: w.id } }, w.tag + (w.len ? ' (' + w.len + ')' : ''));
  const list = [...groups.values()].sort((a, b) => (a.missing - b.missing) || natCmp(a.part, b.part) || natCmp(a.tags[0], b.tags[0]));
  return list.map((g, i) => { const pd = partOf(g.part) || {}; const price = pd.price ? pnum(pd.price) : null; return { key: g.key, pos: i + 1, qty: g.qty, part: g.part, mfr: pd.mfr || '', desc: g.desc, tech: g.tech || pd.tech || '', tags: g.tags, missing: g.missing, price, total: price == null ? null : price * g.qty, goto: g.first.id }; });
}

// targets reached from one side of a terminal (follows wires on the page, not through devices)
function sideTargets(pg, term, ci) {
  const start = connPts(term)[ci]; if (!start) return { targets: [], wire: '' };
  const seen = new Set([start.x + ',' + start.y]); const queue = [[start.x, start.y]];
  const used = new Set(); const targets = []; let wire = '';
  while (queue.length) {
    const p = queue.shift();
    for (const it of pg.items) for (const c of connPts(it)) {
      if (c.x !== p[0] || c.y !== p[1]) continue;
      if (it === term) continue;
      const d = SYM[it.sym]; let t;
      if (d.role === 'ip') t = '> ' + (it.ipName || '?');
      else if (d.role === 'pe') t = 'PE';
      else if (d.role === 'term') t = identOnPage(it, pg) + ':' + (it.tn || '');
      else t = identOnPage(it, pg) + ':' + ((it.cl || [])[c.i] || c.i + 1);
      if (!targets.includes(t)) targets.push(t);
    }
    for (const w of pg.wires) {
      if (used.has(w.id) || !onPoly(p, w.pts)) continue;
      used.add(w.id); if (!wire) wire = WN.get(w.id) || '';
      const ends = [w.pts[0], w.pts[w.pts.length - 1]];
      for (const w2 of pg.wires) if (w2 !== w) for (const e of [w2.pts[0], w2.pts[w2.pts.length - 1]]) if (onPoly(e, w.pts)) ends.push(e);
      for (const e of ends) { const k = e[0] + ',' + e[1]; if (!seen.has(k)) { seen.add(k); queue.push(e); } }
    }
  }
  return { targets, wire };
}

function terminalRows(dev) {
  const terms = dev.items.slice().sort((a, b) => natCmp(a.tn, b.tn) || cmpKey(orderKey(a), orderKey(b)));
  return terms.map(t => {
    const pg = IX.pos.get(t.id).pg;
    const a = sideTargets(pg, t, 0), b = sideTargets(pg, t, 1);
    return { tn: t.tn || '', intT: a.targets.join(', '), intW: a.wire, extT: b.targets.join(', '), extW: b.wire, ref: pageName(pg) + '.' + colOf(t.x), desc: t.desc || '', part: t.part || '', goto: t.id };
  });
}

const BOM_COLS_ENG = [{ h: 'Pos', w: 12, a: 'middle' }, { h: 'Qty', w: 12, a: 'middle' }, { h: 'Part number', w: 50 }, { h: 'Manufacturer', w: 38 }, { h: 'Description', w: 90 }, { h: 'Technical data', w: 50 }, { h: 'Device tags', w: 100 }, { h: 'Unit price', w: 23, a: 'end' }, { h: 'Total', w: 25, a: 'end' }];
const TERM_COLS_ENG = [{ h: 'Internal target', w: 92 }, { h: 'Wire', w: 26, a: 'middle' }, { h: 'Terminal', w: 24, a: 'middle' }, { h: 'Wire', w: 26, a: 'middle' }, { h: 'External target', w: 92 }, { h: 'Page / column', w: 40 }, { h: 'Function text', w: 60 }, { h: 'Part number', w: 40 }];

const plainCols = (cols, names) => cols.map((c, i) => Object.assign({}, c, { h: names[i] }));
const BOM_COLS_F = () => S().reportCols === 'plain' ? plainCols(BOM_COLS_ENG, ['#', 'Qty', 'Part number', 'Brand', 'Description', 'Details', 'Devices', 'Each', 'Total']) : BOM_COLS_ENG;
const TERM_COLS_F = () => S().reportCols === 'plain' ? plainCols(TERM_COLS_ENG, ['Inside', 'Wire', 'Terminal', 'Wire', 'Outside', 'Page', 'Description', 'Part number']) : TERM_COLS_ENG;
function buildReports() {
  const reps = [];
  for (const [pn, list] of panelRows()) {
    const cols = PS_COLS();
    const prow = list.map(r => ({ cells: [r.slot, r.circuit, r.brk, r.amps, r.poles, r.type, r.desc, r.rooms, r.load ? String(Math.round(r.load)) : '', r.load ? fmtPct(r.pct) : '', fmtPct(r.vd)], cls: r.pct > 80 || r.vd > 3 ? 'over' : '', goto: r.goto }));
    const tot = list.reduce((a, r) => a + (r.load || 0), 0);
    if (tot) prow.push({ cells: ['', '', '', '', '', '', `Panel total: ${Math.round(tot)} VA, ${Math.round(tot / 240 * 10) / 10} A at 240 V`, '', String(Math.round(tot)), '', ''], cls: 'grp' });
    const sh = paginate(cols, prow);
    const nm = pn ? dispTag(pn) : '';
    sh.forEach((rws, i) => reps.push({ id: `rep:pnl:${pn}:${i + 1}`, report: 'panel', fn: '', loc: '', num: `${pn || 'PNL'}.${i + 1}`, desc: `Panel schedule ${nm}`.trim(), title: `Panel schedule ${nm}`.trim(), cols, rows: rws, sheet: i + 1, sheets: sh.length, items: [], wires: [] }));
  }
  // BOM
  const bom = bomRows();
  const BOM_COLS = BOM_COLS_F();
  const bomCost = bom.reduce((a, r) => a + (r.total || 0), 0); const priced = bom.filter(r => r.total != null).length;
  const bomList = bom.map(r => ({ cells: [String(r.pos), String(r.qty), r.part || 'no part number', r.mfr, r.desc, r.tech, r.tags.join(', '), r.price == null ? '' : money(r.price), r.total == null ? '' : money(r.total)], cls: r.missing ? 'missing' : '', goto: r.goto }));
  if (priced) bomList.push({ cells: ['', '', '', '', priced < bom.length ? `Total (${bom.length - priced} position(s) without a price)` : 'Total', '', '', '', money(bomCost)], cls: 'grp' });
  const bomSheets = paginate(BOM_COLS, bomList);
  bomSheets.forEach((rows, i) => reps.push({ id: 'rep:bom:' + (i + 1), report: 'bom', fn: '', loc: '', num: 'BOM.' + (i + 1), desc: 'Bill of materials', title: 'Bill of materials', cols: BOM_COLS, rows, sheet: i + 1, sheets: bomSheets.length, items: [], wires: [] }));
  // terminal diagrams
  const strips = [...IX.dev.values()].filter(d => d.items.some(i => i.sym === 'term')).sort((a, b) => natCmp(a.fn, b.fn) || natCmp(a.loc, b.loc) || natCmp(a.tag, b.tag));
  for (const d of strips) {
    const ident = fl(d.fn, d.loc) + '-' + d.tag;
    const rows = terminalRows(d).map(r => ({ cells: [r.intT, r.intW, r.tn, r.extW, r.extT, r.ref, r.desc, r.part], goto: r.goto }));
    const TERM_COLS = TERM_COLS_F();
    const sh = paginate(TERM_COLS, rows);
    sh.forEach((rws, i) => reps.push({ id: `rep:term:${d.key}:${i + 1}`, report: 'term', fn: d.fn, loc: d.loc, num: `${d.tag}.${i + 1}`, desc: `Terminal diagram ${ident}`, title: `Terminal diagram ${ident}`, cols: TERM_COLS, rows: rws, sheet: i + 1, sheets: sh.length, items: [], wires: [], strip: d }));
  }
  buildExtraReports(reps);
  return assembleReports(reps);
}

function reportSVG(rp) {
  const all = allPages();
  let s = frameSVG(rp, all.indexOf(rp), all.length);
  const x0 = SH.x0;
  s += `<text class="t" x="${x0 + 3}" y="${SH.hdr + 10}" font-size="5" font-weight="bold">${esc(rp.title)}</text>`;
  if (rp.sheets > 1) s += `<text class="t" x="${SH.x1 - 3}" y="${SH.hdr + 10}" font-size="3" text-anchor="end">Sheet ${rp.sheet} of ${rp.sheets}</text>`;
  if (rp.custom && rp.locked && !PRINTING) s += `<text class="t tc" x="${SH.x1 - 3}" y="${SH.hdr + 15.5}" font-size="2.6" text-anchor="end">Locked</text>`;
  if (rp.report === 'term') {
    const d = rp.strip; const n = d.items.length;
    s += `<text class="t" x="${x0 + 3}" y="${SH.hdr + 15.5}" font-size="2.8" fill="#555">${n} terminal(s). Internal target = connection point 1 side, external target = connection point 2 side.</text>`;
  }
  let y = RP.top;
  const hh = RP.lh + RP.pad * 2;
  s += `<rect class="rhead" x="${x0}" y="${y}" width="${SH.x1 - x0}" height="${hh}" fill="#eef1f5" stroke="none"/>`;
  let x = x0;
  for (const c of rp.cols) { s += txt(c.a === 'middle' ? x + c.w / 2 : c.a === 'end' ? x + c.w - 1.2 : x + 1.2, y + RP.pad + RP.lh - 1.1, c.h, { size: RP.fs, bold: true, anchor: c.a || 'start' }); x += c.w; }
  s += `<line class="frame" x1="${x0}" y1="${y}" x2="${SH.x1}" y2="${y}"/>`;
  y += hh;
  s += `<line class="frame" x1="${x0}" y1="${y}" x2="${SH.x1}" y2="${y}"/>`;
  for (const r of rp.rows) {
    x = x0;
    const lk = r.link || (r.goto ? linkOfId(r.goto) : '');
    s += `<g ${rp.custom ? '' : `data-goto="${r.goto || ''}" `}class="reprow"><rect x="${x0}" y="${y}" width="${SH.x1 - x0}" height="${r.h}" class="hit"${lk ? ` data-link="${esc(lk)}"` : ''}/>`;
    if (r.full) { r.cells[0].forEach((l, k) => { s += txt(x0 + 1.2, y + RP.pad + RP.lh * (k + 1) - 1.1, l, { size: RP.fs }); }); s += '</g>'; y += r.h; continue; }
    r.cells.forEach((lines, i) => {
      const c = rp.cols[i];
      lines.forEach((l, k) => { s += txt(c.a === 'middle' ? x + c.w / 2 : c.a === 'end' ? x + c.w - 1.2 : x + 1.2, y + RP.pad + RP.lh * (k + 1) - 1.1, l, { size: RP.fs, anchor: c.a || 'start', bold: r.cls === 'grp', cls: r.cls === 'missing' && i === 2 ? 'tw' : r.cls === 'over' && i >= 8 ? 'tw' : '' }); });
      x += c.w;
    });
    s += customCellsSVG(rp, r, y, x0);
    s += '</g>';
    y += r.h;
    s += `<line class="frame2" x1="${x0}" y1="${y}" x2="${SH.x1}" y2="${y}"/>`;
  }
  x = x0; const yEnd = y - rp.rows.filter(r => r.full).reduce((a, r) => a + r.h, 0);
  for (const c of rp.cols.slice(0, -1)) { x += c.w; s += `<line class="frame2" x1="${x}" y1="${RP.top}" x2="${x}" y2="${yEnd}"/>`; }
  if (!rp.rows.length) s += txt(x0 + 3, y + 6, rp.custom ? 'No rows picked yet. Pick rows in Properties.' : rp.report === 'bom' ? 'No devices in the project yet.' : 'No terminals.', { size: 3, cls: 'tc' });
  return s;
}

function csvCell(v) { v = String(v ?? ''); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCSV(head, rows) { return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'); }
async function exportBOM() {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers();
  const rows = bomRows().map(r => [r.pos, r.qty, r.part, r.mfr, r.desc, r.tech, r.tags.join(' '), r.price == null ? '' : r.price.toFixed(2), r.total == null ? '' : r.total.toFixed(2)]);
  const csv = toCSV(['Pos', 'Qty', 'Part number', 'Manufacturer', 'Description', 'Technical data', 'Device tags', 'Unit price', 'Total'], rows);
  const p = await host.saveText(csv, (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' BOM.csv');
  if (p) flash('Exported ' + p);
}
async function exportTerminals() {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers();
  const rows = [];
  for (const d of [...IX.dev.values()].filter(d => d.items.some(i => i.sym === 'term')).sort((a, b) => natCmp(a.tag, b.tag))) {
    const ident = fl(d.fn, d.loc) + '-' + d.tag;
    for (const r of terminalRows(d)) rows.push([ident, r.tn, r.intT, r.intW, r.extW, r.extT, r.ref, r.desc, r.part]);
  }
  const csv = toCSV(['Strip', 'Terminal', 'Internal target', 'Internal wire', 'External wire', 'External target', 'Page / column', 'Function text', 'Part number'], rows);
  const p = await host.saveText(csv, (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' terminals.csv');
  if (p) flash('Exported ' + p);
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
    if (isFloor(pg) || pg.type === 'sl') continue;
    for (const w of pg.wires) {
      if (w.tube) continue;
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
  buildOpeningReport(reps);
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
  // tubing list
  const tr = tubeRows();
  if (tr.length) mkReport(reps, { id: 'rep:tubes', report: 'tubes', num: 'TUB', desc: 'Tubing list', title: 'Tubing list' }, tr, TUBE_COLS());
  // revisions
  if ((P.revs || []).length) {
    const all = P.pages;
    mkReport(reps, { id: 'rep:rev', report: 'rev', num: 'REV', desc: 'Revision overview', title: 'Revision overview' },
      P.revs.map(r => ({ cells: [r.rev + (r.closed ? '' : ' (open)'), r.date || '', r.desc || '', r.by || '', all.filter(p => (p.revs || []).includes(r.rev)).map(pageName).join(', ')] })), REV_COLS());
  }
}
function coverSVG(pg) {
  const all = allPages();
  let s = frameSVG(pg, all.indexOf(pg), all.length);
  const cx = (SH.x0 + SH.x1) / 2, cu = pg.custom;
  const hit = (key, y, h, w = 180) => cu && !PRINTING ? `<rect class="ccell${CUSSEL && CUSSEL.cr === cu && CUSSEL.key === key ? ' on' : ''}" data-ccell="${esc(cu)}|${esc(key)}|1" x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" fill="${CUSSEL && CUSSEL.cr === cu && CUSSEL.key === key ? 'rgba(31,111,255,.14)' : 'transparent'}"/>` : '';
  const title = cu ? pg.coverTitle : P.name || '', desc = cu ? pg.coverDesc : P.desc;
  if (title != null) s += hit('f:title', 58, 16, 260) + `<text class="t" x="${cx}" y="70" font-size="12" font-weight="bold" text-anchor="middle" pointer-events="none">${esc(title || '')}</text>`;
  if (desc != null) { const ls = String(desc || '').split('\n'); s += hit('f:desc', 82, Math.max(1, ls.length) * 7 + 2, 260); ls.forEach((l, i) => { s += `<text class="t" x="${cx}" y="${88 + i * 7}" font-size="5" text-anchor="middle" pointer-events="none">${esc(l)}</text>`; }); }
  const rows = cu ? pg.coverFields : [['Company', P.company], ['Drawn by', P.author], ['Created', P.created], ['Last modified', P.modified || P.created], ['Pages', String(all.length)], ['Current revision', ((P.revs || []).slice(-1)[0] || {}).rev || '-']];
  rows.forEach(([k, v, key], i) => {
    const y = 140 + i * 11;
    s += hit(key, y - 6, 9) + `<text class="t tc" x="${cx - 6}" y="${y}" font-size="4" text-anchor="end" pointer-events="none">${esc(k)}</text><text class="t" x="${cx + 6}" y="${y}" font-size="4.4" font-weight="bold" pointer-events="none">${esc(v || '')}</text>`;
  });
  if (cu && pg.notes) String(pg.notes).split('\n').forEach((l, i) => { s += `<text class="t" x="${cx}" y="${140 + rows.length * 11 + 8 + i * 6}" font-size="3.6" text-anchor="middle">${esc(l)}</text>`; });
  s += `<line class="frame2" x1="${cx - 90}" y1="${126}" x2="${cx + 90}" y2="${126}"/>`;
  return s;
}
