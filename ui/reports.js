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
    const cells = r.cells.map((c, i) => wrapText(c, cols[i].w - 2.4, RP.fs));
    const h = Math.max(...cells.map(c => c.length)) * RP.lh + RP.pad * 2;
    if (used + h > avail && cur.length) { sheets.push(cur); cur = []; used = 0; }
    cur.push({ cells, h, cls: r.cls, goto: r.goto, link: r.link }); used += h;
  }
  sheets.push(cur);
  return sheets;
}

function bomRows() {
  const groups = new Map();
  const add = (key, data, tag) => {
    if (!groups.has(key)) groups.set(key, Object.assign({ qty: 0, tags: [] }, data));
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
  for (const pg of P.pages) for (const c of pg.cables || []) {
    const part = c.part || ''; const type = c.ctype || 'unspecified';
    add(part ? 'p:' + part : 'cab:' + type, { part, desc: 'Cable, ' + type, tech: '', missing: !part, first: { id: c.id } }, (home() ? 'Cable ' + c.tag.replace(/^W/, '') : '-' + c.tag) + (c.len ? ' (' + c.len + ')' : ''));
  }
  const list = [...groups.values()].sort((a, b) => (a.missing - b.missing) || natCmp(a.part, b.part) || natCmp(a.tags[0], b.tags[0]));
  return list.map((g, i) => ({ pos: i + 1, qty: g.qty, part: g.part, desc: g.desc, tech: g.tech, tags: g.tags, missing: g.missing, goto: g.first.id }));
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

const BOM_COLS_ENG = [{ h: 'Pos', w: 14, a: 'middle' }, { h: 'Qty', w: 14, a: 'middle' }, { h: 'Part number', w: 66 }, { h: 'Description', w: 104 }, { h: 'Technical data', w: 62 }, { h: 'Device tags', w: 140 }];
const TERM_COLS_ENG = [{ h: 'Internal target', w: 92 }, { h: 'Wire', w: 26, a: 'middle' }, { h: 'Terminal', w: 24, a: 'middle' }, { h: 'Wire', w: 26, a: 'middle' }, { h: 'External target', w: 92 }, { h: 'Page / column', w: 40 }, { h: 'Function text', w: 60 }, { h: 'Part number', w: 40 }];

const plainCols = (cols, names) => cols.map((c, i) => Object.assign({}, c, { h: names[i] }));
const BOM_COLS_F = () => S().reportCols === 'plain' ? plainCols(BOM_COLS_ENG, ['#', 'Qty', 'Part number', 'Description', 'Details', 'Devices']) : BOM_COLS_ENG;
const TERM_COLS_F = () => S().reportCols === 'plain' ? plainCols(TERM_COLS_ENG, ['Inside', 'Wire', 'Terminal', 'Wire', 'Outside', 'Page', 'Description', 'Part number']) : TERM_COLS_ENG;
function buildReports() {
  const reps = [];
  for (const [pn, list] of panelRows()) {
    const cols = PS_COLS();
    const sh = paginate(cols, list.map(r => ({ cells: [r.slot, r.circuit, r.brk, r.amps, r.poles, r.type, r.desc, r.rooms], goto: r.goto })));
    const nm = pn ? dispTag(pn) : '';
    sh.forEach((rws, i) => reps.push({ id: `rep:pnl:${pn}:${i + 1}`, report: 'panel', fn: '', loc: '', num: `${pn || 'PNL'}.${i + 1}`, desc: `Panel schedule ${nm}`.trim(), title: `Panel schedule ${nm}`.trim(), cols, rows: rws, sheet: i + 1, sheets: sh.length, items: [], wires: [] }));
  }
  // BOM
  const bom = bomRows();
  const BOM_COLS = BOM_COLS_F();
  const bomSheets = paginate(BOM_COLS, bom.map(r => ({ cells: [String(r.pos), String(r.qty), r.part || 'no part number', r.desc, r.tech, r.tags.join(', ')], cls: r.missing ? 'missing' : '', goto: r.goto })));
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
  return buildFrontPages(reps).concat(reps);
}

function reportSVG(rp) {
  const all = allPages();
  let s = frameSVG(rp, all.indexOf(rp), all.length);
  const x0 = SH.x0;
  s += `<text class="t" x="${x0 + 3}" y="${SH.hdr + 10}" font-size="5" font-weight="bold">${esc(rp.title)}</text>`;
  if (rp.sheets > 1) s += `<text class="t" x="${SH.x1 - 3}" y="${SH.hdr + 10}" font-size="3" text-anchor="end">Sheet ${rp.sheet} of ${rp.sheets}</text>`;
  if (rp.report === 'term') {
    const d = rp.strip; const n = d.items.length;
    s += `<text class="t" x="${x0 + 3}" y="${SH.hdr + 15.5}" font-size="2.8" fill="#555">${n} terminal(s). Internal target = connection point 1 side, external target = connection point 2 side.</text>`;
  }
  let y = RP.top;
  const hh = RP.lh + RP.pad * 2;
  s += `<rect class="rhead" x="${x0}" y="${y}" width="${SH.x1 - x0}" height="${hh}" fill="#eef1f5" stroke="none"/>`;
  let x = x0;
  for (const c of rp.cols) { s += txt(c.a === 'middle' ? x + c.w / 2 : x + 1.2, y + RP.pad + RP.lh - 1.1, c.h, { size: RP.fs, bold: true, anchor: c.a || 'start' }); x += c.w; }
  s += `<line class="frame" x1="${x0}" y1="${y}" x2="${SH.x1}" y2="${y}"/>`;
  y += hh;
  s += `<line class="frame" x1="${x0}" y1="${y}" x2="${SH.x1}" y2="${y}"/>`;
  for (const r of rp.rows) {
    x = x0;
    const lk = r.link || (r.goto ? linkOfId(r.goto) : '');
    s += `<g data-goto="${r.goto || ''}" class="reprow"><rect x="${x0}" y="${y}" width="${SH.x1 - x0}" height="${r.h}" class="hit"${lk ? ` data-link="${esc(lk)}"` : ''}/>`;
    r.cells.forEach((lines, i) => {
      const c = rp.cols[i];
      lines.forEach((l, k) => { s += txt(c.a === 'middle' ? x + c.w / 2 : x + 1.2, y + RP.pad + RP.lh * (k + 1) - 1.1, l, { size: RP.fs, anchor: c.a || 'start', bold: r.cls === 'grp', cls: r.cls === 'missing' && i === 2 ? 'tw' : '' }); });
      x += c.w;
    });
    s += '</g>';
    y += r.h;
    s += `<line class="frame2" x1="${x0}" y1="${y}" x2="${SH.x1}" y2="${y}"/>`;
  }
  x = x0;
  for (const c of rp.cols.slice(0, -1)) { x += c.w; s += `<line class="frame2" x1="${x}" y1="${RP.top}" x2="${x}" y2="${y}"/>`; }
  if (!rp.rows.length) s += txt(x0 + 3, y + 6, rp.report === 'bom' ? 'No devices in the project yet.' : 'No terminals.', { size: 3, cls: 'tc' });
  return s;
}

function csvCell(v) { v = String(v ?? ''); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCSV(head, rows) { return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'); }
async function exportBOM() {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers();
  const rows = bomRows().map(r => [r.pos, r.qty, r.part, r.desc, r.tech, r.tags.join(' ')]);
  const csv = toCSV(['Pos', 'Qty', 'Part number', 'Description', 'Technical data', 'Device tags'], rows);
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
