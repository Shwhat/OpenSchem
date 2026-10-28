'use strict';
/* OpenSchem: schematic editor with structured device tagging */

// ---------- constants ----------
const G = 4;                                   // grid in mm
const r2 = v => Math.round(v * 100) / 100;
// paper sizes: width, height, left margin, other margins, column header, title block height, columns
function makeSheet(name, w, h, left, m, hdrH, tbH, cols) {
  const s = { name, w, h, x0: left, x1: r2(w - m), y0: m, y1: r2(h - m), hdr: m + hdrH, tb: r2(h - m - tbH), cols, tbH, k: tbH / 30, compact: tbH < 15 };
  s.colw = (s.x1 - s.x0) / cols; return s;
}
const SHEETS = {
  A3L: makeSheet('A3 landscape', 420, 297, 15, 5, 6, 30, 10),
  A4L: makeSheet('A4 landscape', 297, 210, 15, 5, 6, 24, 8),
  A4P: makeSheet('A4 portrait', 210, 297, 15, 5, 6, 24, 6),
  A2L: makeSheet('A2 landscape', 594, 420, 15, 5, 6, 30, 12),
  TABL: makeSheet('Tabloid 11 × 17 in landscape', 431.8, 279.4, 15, 5, 6, 30, 10),
  LTRL: makeSheet('Letter 8.5 × 11 in landscape', 279.4, 215.9, 15, 5, 6, 24, 8),
  LTRP: makeSheet('Letter 8.5 × 11 in portrait', 215.9, 279.4, 15, 5, 6, 24, 6),
  CARD: makeSheet('Note card 3 × 5 in', 127, 76.2, 3, 3, 3, 8, 4),
};
let SH = SHEETS.A3L;
const sheetOf = pg => (!pg || pg.report) ? SHEETS.A3L : SHEETS[pg.size || (P && P.size) || 'A3L'] || SHEETS.A3L;
const useSheet = pg => { SH = sheetOf(pg); return SH; };
const SHEET_OPTS = () => Object.entries(SHEETS).map(([k, s]) => [k, s.name]);
const FS = 2.5, FSS = 2.2;                     // font sizes (mm)
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
// program-wide preferences (saved in the OpenSchem Data folder)
const PREFS = { snap: true, autoConnect: true, gridSch: 4, gridFp: 2, appVersion: null, ribbon: null, symOpen: {}, theme: 'light', sheet: 'white', ortho: true, polar: false, polarInc: 45, osnapOn: true, osnap: null, cmdline: false, dock: null, workspace: 'Schematic', workspaces: {} };
const gs = () => PREFS.gridSch || 4;
const snap = v => PREFS.snap ? r2(Math.round(v / gs()) * gs()) : Math.round(v * 4) / 4;
const clone = o => JSON.parse(JSON.stringify(o));
const natCmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
const colOf = (x, pg) => { const s = pg ? sheetOf(pg) : SH; return Math.max(1, Math.min(s.cols, Math.floor((x - s.x0) / s.colw) + 1)); };


// ---------- symbol library ----------
const dash = 'stroke-dasharray="1,0.8"';
const noC = x => `M${x},-8V-3M${x},8V3L${x - 3.5},-3.5`;
const ncC = x => `M${x},-8V-3H${x + 3}M${x},8V3L${x + 3.5},-4`;
const cbX = x => `M${x - 1.4},-4.4L${x + 1.4},-1.6M${x + 1.4},-4.4L${x - 1.4},-1.6`;
const btn = '<path d="M-8.5,-2H-7V2H-8.5"/>';

const SYM = {
  coil:   { name: 'Coil', cat: 'Coils and contacts', prefix: 'K', role: 'main', mirror: true,
            conns: [[0, -8, 'A1'], [0, 8, 'A2']], box: [-5, -8, 5, 8],
            draw: () => '<path d="M0,-8V-3M0,3V8"/><rect x="-5" y="-3" width="10" height="6"/>' },
  no:     { name: 'NO contact', cat: 'Coils and contacts', prefix: 'K', role: 'aux', contact: 'NO',
            conns: [[0, -8, '13'], [0, 8, '14']], box: [-4, -8, 2, 8], draw: () => `<path d="${noC(0)}"/>` },
  nc:     { name: 'NC contact', cat: 'Coils and contacts', prefix: 'K', role: 'aux', contact: 'NC',
            conns: [[0, -8, '21'], [0, 8, '22']], box: [-2, -8, 4, 8], draw: () => `<path d="${ncC(0)}"/>` },
  mc3:    { name: 'Main contacts 3P', cat: 'Coils and contacts', prefix: 'K', role: 'aux', fixed: true,
            conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-12, -8, 10, 8],
            draw: () => `<path d="${noC(-8)}${noC(0)}${noC(8)}"/><path d="M-9.75,-0.25H6.25" ${dash}/>` },
  pbno:   { name: 'Pushbutton NO', cat: 'Command devices', prefix: 'S', role: 'main', contact: 'NO',
            conns: [[0, -8, '13'], [0, 8, '14']], box: [-9, -8, 2, 8],
            draw: () => `<path d="${noC(0)}"/><path d="M-1.8,-0.2H-7" ${dash}/>${btn}` },
  pbnc:   { name: 'Pushbutton NC', cat: 'Command devices', prefix: 'S', role: 'main', contact: 'NC',
            conns: [[0, -8, '11'], [0, 8, '12']], box: [-9, -8, 4, 8],
            draw: () => `<path d="${ncC(0)}"/><path d="M1.6,-0.4H-7" ${dash}/>${btn}` },
  estop:  { name: 'Emergency stop', cat: 'Command devices', prefix: 'S', role: 'main', contact: 'NC',
            conns: [[0, -8, '11'], [0, 8, '12']], box: [-11, -8, 4, 8],
            draw: () => `<path d="${ncC(0)}"/><path d="M1.6,-0.4H-7" ${dash}/><path d="M-7,-3.5V3.5M-7,-3.5A3.5,3.5 0 0 0 -7,3.5"/>` },
  cb1:    { name: 'Circuit breaker 1P', cat: 'Protection', prefix: 'Q', role: 'main', fixed: true,
            conns: [[0, -8, '1'], [0, 8, '2']], box: [-4, -8, 2, 8], draw: () => `<path d="${noC(0)}${cbX(0)}"/>` },
  cb3:    { name: 'Circuit breaker 3P', cat: 'Protection', prefix: 'Q', role: 'main', fixed: true,
            conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-12, -8, 10, 8],
            draw: () => `<path d="${noC(-8)}${noC(0)}${noC(8)}${cbX(-8)}${cbX(0)}${cbX(8)}"/><path d="M-9.75,-0.25H6.25" ${dash}/>` },
  fuse:   { name: 'Fuse', cat: 'Protection', prefix: 'F', role: 'main', fixed: true,
            conns: [[0, -8, '1'], [0, 8, '2']], box: [-2, -8, 2, 8],
            draw: () => '<path d="M0,-8V8"/><rect x="-2" y="-5" width="4" height="10"/>' },
  ol3:    { name: 'Overload relay 3P', cat: 'Protection', prefix: 'F', role: 'main', fixed: true,
            conns: [[-8, -8, '1'], [-8, 8, '2'], [0, -8, '3'], [0, 8, '4'], [8, -8, '5'], [8, 8, '6']], box: [-11, -8, 11, 8],
            draw: () => [-8, 0, 8].map(x => `<path d="M${x},-8V-3H${x + 2}V0H${x}V8"/>`).join('') + '<rect x="-11" y="-4.5" width="22" height="9" stroke-width="0.25"/>' },
  olnc:   { name: 'Overload aux NC', cat: 'Protection', prefix: 'F', role: 'aux', contact: 'NC', fixed: true,
            conns: [[0, -8, '95'], [0, 8, '96']], box: [-10, -8, 4, 8],
            draw: () => `<path d="${ncC(0)}"/><path d="M1.6,-0.4H-7" ${dash}/><path d="M-7,-2H-9V0H-7V2"/>` },
  motor:  { name: 'Motor 3~', cat: 'Loads and sources', prefix: 'M', role: 'main', fixed: true,
            conns: [[-8, -12, 'U1'], [0, -12, 'V1'], [8, -12, 'W1'], [12, -12, 'PE']], box: [-9, -12, 12, 13],
            draw: () => '<path d="M-8,-12V0M0,-12V-5M8,-12V0M12,-12V4H9"/><circle cx="0" cy="4" r="9"/>',
            texts: () => [[0, 2.6, 'M', 3.4, true], [0, 7, '3~', 2.6]] },
  lamp:   { name: 'Indicator lamp', cat: 'Loads and sources', prefix: 'P', role: 'main', fixed: true,
            conns: [[0, -8, 'X1'], [0, 8, 'X2']], box: [-4, -8, 4, 8],
            draw: () => '<path d="M0,-8V-4M0,4V8M-2.83,-2.83L2.83,2.83M2.83,-2.83L-2.83,2.83"/><circle cx="0" cy="0" r="4"/>' },
  ps:     { name: 'Power supply', cat: 'Loads and sources', prefix: 'G', role: 'main', fixed: true,
            conns: [[-8, -12, 'L'], [0, -12, 'N'], [8, -12, 'PE'], [-4, 12, '+'], [4, 12, '-']], box: [-12, -12, 12, 12],
            draw: () => '<rect x="-12" y="-8" width="24" height="16"/><path d="M-8,-12V-8M0,-12V-8M8,-12V-8M-4,12V8M4,12V8"/>',
            texts: () => [[0, 0.9, 'AC/DC', 2.4]] },
  box:    { name: 'Generic device', cat: 'Loads and sources', prefix: 'A', role: 'main', fixed: true,
            conns: [[0, -8, '1'], [0, 8, '2']], box: [-6, -8, 6, 8],
            draw: () => '<path d="M0,-8V-4M0,4V8"/><rect x="-6" y="-4" width="12" height="8"/>' },
  plcin:  { name: 'PLC input', cat: 'PLC', prefix: 'A', role: 'plc', fixed: true,
            conns: [[0, -8, 'I']], box: [-8, -8, 8, 4],
            draw: () => '<path d="M0,-8V-4"/><rect x="-8" y="-4" width="16" height="8"/>' },
  plcout: { name: 'PLC output', cat: 'PLC', prefix: 'A', role: 'plc', fixed: true,
            conns: [[0, 8, 'Q']], box: [-8, -4, 8, 8],
            draw: () => '<path d="M0,8V4"/><rect x="-8" y="-4" width="16" height="8"/>' },
  term:   { name: 'Terminal', cat: 'Connections', prefix: 'X', role: 'term',
            conns: [[0, -4, ''], [0, 4, '']], box: [-1.6, -4, 1.6, 4],
            draw: () => '<path d="M0,-4V-1.2M0,1.2V4"/><circle cx="0" cy="0" r="1.2"/>' },
  ip:     { name: 'Interruption point', cat: 'Connections', prefix: null, role: 'ip',
            conns: [[0, 0, '']], box: [-2.4, -4, 2.4, 0.5],
            draw: () => '<path d="M-2.2,-3.6L0,0L2.2,-3.6" stroke-width="0.5"/>' },
  pe:     { name: 'PE / ground', cat: 'Connections', prefix: null, role: 'pe',
            conns: [[0, -4, '']], box: [-4, -4, 4, 3],
            draw: () => '<path d="M0,-4V0M-4,0H4M-2.6,1.4H2.6M-1.2,2.8H1.2"/>' },
};
const SYMORDER = ['coil', 'no', 'nc', 'mc3', 'pbno', 'pbnc', 'estop', 'cb1', 'cb3', 'fuse', 'ol3', 'olnc', 'motor', 'lamp', 'ps', 'box', 'plcin', 'plcout', 'term', 'ip', 'pe'];

// ---------- geometry ----------
function rotPt(x, y, rot) {
  switch (((rot % 360) + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
// variants A-H: A-D rotations 0/90/180/270, E-H the same mirrored
function xf(it, x, y) { return rotPt(it.mir ? -x : x, y, it.rot || 0); }
const variantOf = it => 'ABCDEFGH'[((it.rot || 0) / 90) % 4 + (it.mir ? 4 : 0)];
const symConns = it => { const d = SYM[it.sym]; return d.connsOf ? d.connsOf(it) : d.conns; };
const symBox = it => { const d = SYM[it.sym]; return d.boxOf ? d.boxOf(it) : d.box; };
function connPts(it) {
  const d = SYM[it.sym]; if (!d) return [];
  return symConns(it).map(([cx, cy], i) => { const [rx, ry] = xf(it, cx, cy); return { x: r2(it.x + rx), y: r2(it.y + ry), i }; });
}
function itemBox(it) {
  if (it.sym === 'text') {
    const lines = String(it.text || '').split('\n'); const s = it.size || 3.5;
    const w = Math.max(...lines.map(l => l.length)) * s * 0.55;
    return [it.x, it.y - s, it.x + Math.max(w, 2), it.y + (lines.length - 1) * s * 1.25 + s * 0.3];
  }
  const [a, b, c, e] = symBox(it);
  const pts = [xf(it, a, b), xf(it, c, e)];
  return [Math.min(pts[0][0], pts[1][0]) + it.x, Math.min(pts[0][1], pts[1][1]) + it.y,
          Math.max(pts[0][0], pts[1][0]) + it.x, Math.max(pts[0][1], pts[1][1]) + it.y];
}
function onSeg(p, a, b) {
  if (a[0] === b[0] && p[0] === a[0]) return p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  if (a[1] === b[1] && p[1] === a[1]) return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]);
  return false;
}
function onPoly(p, pts, interiorOnly) {
  for (let i = 0; i < pts.length - 1; i++) if (onSeg(p, pts[i], pts[i + 1])) {
    if (interiorOnly) {
      const last = pts[pts.length - 1];
      if ((p[0] === pts[0][0] && p[1] === pts[0][1]) || (p[0] === last[0] && p[1] === last[1])) return false;
    }
    return true;
  }
  return false;
}
function simplify(pts) {
  const out = [];
  for (const p of pts) { const q = [r2(p[0]), r2(p[1])]; const l = out[out.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q); }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(i, 1);
  }
  return out;
}

// ---------- project model ----------
let P, curId, IX, NETS, WN;
let sel = new Set();
let undoStack = [], redoStack = [];
let dirty = false, filePath = '';
let mode = 'select', placeSym = null, placeRot = 0;
let view = { x: 0, y: 0, s: 3 };
let opts = { grid: true, connLabels: true };
const lastMain = {};
let clip = null;

function newProject() {
  return { app: 'OpenSchem', ver: FORMAT_VERSION, name: 'New project', company: '', author: '', created: today(),
           wireScheme: 'seq', wireStart: 1, potNames: true,
           pages: [newPage('', '', '1', 'Cover / main power')] };
}
function newPage(fn, loc, num, desc) { return { id: uid(), fn, loc, num: String(num), desc: desc || '', items: [], wires: [], cables: [], gfx: [] }; }
function today() { return new Date().toISOString().slice(0, 10); }
const page = () => P.pages.find(p => p.id === curId) || REPORTS.find(p => p.id === curId) || P.pages[0];
const allPages = () => REPORTS.filter(r => r.front).concat(P.pages, REPORTS.filter(r => !r.front));
const pageIdx = pg => P.pages.indexOf(pg);
function sortPages() {
  const li = id => (P.levels || []).findIndex(l => l.id === id);
  const kr = p => p.kind === 'floor' ? 2 : p.kind === 'layout' ? 1 : 0;
  P.pages.sort((a, b) => (kr(a) - kr(b)) ||
    (a.kind === 'floor' ? (li(a.level) - li(b.level)) || natCmp(a.num, b.num) : natCmp(a.fn, b.fn) || natCmp(a.loc, b.loc) || natCmp(a.num, b.num)));
}
const fl = (fn, loc) => (fn ? '=' + fn : '') + (loc ? '+' + loc : '');
const pageName = pg => pg.report ? pg.title + (pg.sheets > 1 ? ' ' + pg.sheet : '')
  : pg.kind === 'floor' ? ((levelOf(pg) || {}).name || 'Floor') + '/' + pg.num
  : home() ? ([friendlyCkt(pg.fn), niceRoom(pg.loc)].filter(Boolean).join(' · ') || 'Page') + '/' + pg.num
  : fl(pg.fn, pg.loc) + '/' + pg.num;
const devKey = it => `${it.fn || ''}\u0001${it.loc || ''}\u0001${it.tag || ''}`;
const fullIdent = it => fl(it.fn, it.loc) + '-' + it.tag;
function identOnPage(it, pg) {
  return (it.fn && it.fn !== pg.fn ? '=' + it.fn : '') + (it.loc && it.loc !== pg.loc ? '+' + it.loc : '') + '-' + it.tag;
}
const pageObjs = pg => [...pg.items, ...pg.wires, ...(pg.cables || []), ...(pg.gfx || []), ...(pg.lay || [])];
const objOf = f => f && (f.it || f.w || f.cab || f.g || f.lo);
function findItem(id) {
  for (const pg of P.pages) { const it = pg.items.find(i => i.id === id); if (it) return { it, pg }; const w = pg.wires.find(i => i.id === id); if (w) return { w, pg }; const cab = (pg.cables || []).find(i => i.id === id); if (cab) return { cab, pg }; const g = (pg.gfx || []).find(i => i.id === id); if (g) return { g, pg }; const lo = (pg.lay || []).find(i => i.id === id); if (lo) return { lo, pg }; }
  const pi = (P.pool || []).find(i => i.id === id); if (pi) return { it: pi, pg: null };
  return null;
}

// ---------- index (devices, positions, interruption points) ----------
function orderKey(it) { const p = IX.pos.get(it.id); return [p.pi, p.col, it.y, it.x]; }
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
function buildIndex() {
  const dev = new Map(), pos = new Map(), ips = new Map();
  P.pages.forEach((pg, pi) => pg.items.forEach(it => {
    pos.set(it.id, { pg, pi, col: colOf(it.x, pg) });
    const d = SYM[it.sym]; if (!d) return;
    if (d.prefix && it.tag) {
      const k = devKey(it);
      if (!dev.has(k)) dev.set(k, { key: k, fn: it.fn || '', loc: it.loc || '', tag: it.tag, items: [] });
      dev.get(k).items.push(it);
    }
    if (it.sym === 'ip' && it.ipName) { if (!ips.has(it.ipName)) ips.set(it.ipName, []); ips.get(it.ipName).push(it); }
  }));
  for (const it of P.pool || []) {
    pos.set(it.id, { pg: null, pi: 1e6, col: 0 });
    const d = SYM[it.sym]; if (!d || !d.prefix || !it.tag) continue;
    const k = devKey(it); if (!dev.has(k)) dev.set(k, { key: k, fn: it.fn || '', loc: it.loc || '', tag: it.tag, items: [] });
    dev.get(k).items.push(it);
  }
  IX = { dev, pos, ips };
  for (const d of dev.values()) {
    d.items.sort((a, b) => cmpKey(orderKey(a), orderKey(b)));
    d.mains = d.items.filter(i => i.role === 'main');
    d.main = d.mains[0] || null;
  }
  for (const l of ips.values()) l.sort((a, b) => cmpKey(orderKey(a), orderKey(b)));
}
function ref(fromPg, it) {
  const p = IX.pos.get(it.id); if (!p || !p.pg) return '';
  const diff = p.pg.fn !== fromPg.fn || p.pg.loc !== fromPg.loc;
  if (home()) return `${diff ? [friendlyCkt(p.pg.fn), niceRoom(p.pg.loc)].filter(Boolean).join(' · ') + ' ' : ''}p.${p.pg.num}.${p.col}`;
  return `${diff ? fl(p.pg.fn, p.pg.loc) : ''}/${p.pg.num}.${p.col}`;
}

// ---------- nets and wire numbering ----------
function computeNets() {
  const par = new Map();
  const find = n => { if (!par.has(n)) par.set(n, n); let r = n; while (par.get(r) !== r) r = par.get(r); let c = n; while (par.get(c) !== r) { const nx = par.get(c); par.set(c, r); c = nx; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) par.set(ra, rb); };
  const junctions = new Map();
  for (const pg of P.pages) {
    const pm = new Map();
    const add = (x, y, n, isWireEnd) => { const k = x + ',' + y; if (!pm.has(k)) pm.set(k, { n: [], we: 0 }); const e = pm.get(k); e.n.push(n); if (isWireEnd) e.we++; find(n); };
    for (const it of pg.items) {
      const d = SYM[it.sym]; if (!d) continue;
      connPts(it).forEach(c => {
        const n = `c:${it.id}:${c.i}`; add(c.x, c.y, n);
        if (it.sym === 'ip' && it.ipName) union(n, 'ip:' + it.ipName);
        if (it.sym === 'pe') union(n, 'ip:PE');
        if (it.sym === 'term' || d.splice) union(n, `c:${it.id}:0`);
        if (d.role === 'bar') union(n, 'ip:' + d.pot);
      });
    }
    for (const w of pg.wires) {
      const n = 'w:' + w.id; const a = w.pts[0], b = w.pts[w.pts.length - 1];
      add(a[0], a[1], n, true); add(b[0], b[1], n, true);
    }
    for (const e of pm.values()) for (let i = 1; i < e.n.length; i++) union(e.n[0], e.n[i]);
    const jd = [];
    for (const w of pg.wires) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) for (const w2 of pg.wires) {
      if (w2 === w) continue;
      if (onPoly(p, w2.pts, false)) { union('w:' + w.id, 'w:' + w2.id); if (onPoly(p, w2.pts, true)) jd.push(p); }
    }
    for (const [k, e] of pm) if (e.we >= 3) jd.push(k.split(',').map(Number));
    junctions.set(pg.id, jd);
  }
  return { find, junctions };
}
function computeWireNumbers() {
  const nets = new Map();
  P.pages.forEach((pg, pi) => pg.wires.forEach(w => {
    const r = NETS.find('w:' + w.id);
    if (!nets.has(r)) nets.set(r, { wires: [], first: null });
    const n = nets.get(r); n.wires.push({ w, pg, pi });
    const k = [pi, colOf(w.pts[0][0], pg), Math.min(...w.pts.map(p => p[1])), Math.min(...w.pts.map(p => p[0]))];
    if (!n.first || cmpKey(k, n.first.k) < 0) n.first = { k, pg, w };
  }));
  const potOf = new Map();
  for (const name of [...IX.ips.keys(), 'PE', 'N', 'G']) { const r = NETS.find('ip:' + name); if (!potOf.has(r)) potOf.set(r, name); }
  const list = [...nets.entries()].sort((a, b) => cmpKey(a[1].first.k, b[1].first.k));
  const res = new Map(); let seq = Number(P.wireStart) || 1; const perPage = new Map(); const used = new Map();
  for (const [r, n] of list) {
    let num = '';
    const ov = n.wires.map(x => x.w.no).find(v => v);
    if (ov) num = ov;
    else if (P.potNames && potOf.has(r)) num = potOf.get(r);
    else if (P.wireScheme === 'seq') num = String(seq++);
    else if (P.wireScheme === 'page') { const pg = n.first.pg; const c = (perPage.get(pg.id) || 0) + 1; perPage.set(pg.id, c); num = pg.num + String(c).padStart(2, '0'); }
    else if (P.wireScheme === 'pagecol') {
      const base = `${n.first.pg.num}.${n.first.k[1]}`; const c = used.get(base) || 0; used.set(base, c + 1);
      num = c ? base + String.fromCharCode(96 + c) : base;
    }
    for (const x of n.wires) res.set(x.w.id, num);
  }
  return res;
}

// ---------- contact numbering & tags ----------
function nextTag(fn, loc, prefix, res) {
  let max = 0; const re = new RegExp('^' + prefix + '(\\d+)$');
  const scope = res ? S().numbering : 'fl';
  for (const it of allItems()) {
    if (!it.tag) continue;
    if (scope === 'fl' && ((it.fn || '') !== (fn || '') || (it.loc || '') !== (loc || ''))) continue;
    if (scope === 'room' && (it.loc || '') !== (loc || '')) continue;
    const m = re.exec(it.tag); if (m) max = Math.max(max, +m[1]);
  }
  return prefix + (max + 1);
}
function nextSlot() {
  let max = 0;
  for (const it of allItems()) if (SYM[it.sym] && SYM[it.sym].brk) { const n = parseInt(it.slot, 10); if (!isNaN(n)) max = Math.max(max, n); }
  return String(max + 1);
}
function nextTerminal(fn, loc, strip) {
  let max = 0;
  for (const it of allItems()) if (it.sym === 'term' && it.tag === strip && (it.fn || '') === (fn || '') && (it.loc || '') === (loc || '')) {
    const n = parseInt(it.tn, 10); if (!isNaN(n)) max = Math.max(max, n);
  }
  return String(max + 1);
}
function assignContactNumbers(it) {
  const d = SYM[it.sym]; if (!d.contact || d.fixed || it.role === 'main') return;
  let maxSeq = 0; const k = devKey(it);
  for (const o of allItems()) {
    if (o === it || devKey(o) !== k) continue;
    const od = SYM[o.sym]; if (!od || !od.contact || od.fixed) continue;
    const s = parseInt(String((o.cl || [])[0] || '').slice(0, -1), 10); if (!isNaN(s)) maxSeq = Math.max(maxSeq, s);
  }
  const s = maxSeq + 1;
  it.cl = d.contact === 'NO' ? [s + '3', s + '4'] : [s + '1', s + '2'];
}
function makeItem(sym, x, y, rot, pg) {
  const d = SYM[sym];
  const it = onActiveLayer({ id: uid(), sym, x, y, rot: rot || 0, fn: pg.fn || '', loc: pg.loc || '', tag: '', role: d.role, cl: d.conns.map(c => c[2]), desc: '' });
  if (d.init) d.init(it);
  if (sym === 'ip') { it.ipName = P._lastIp || 'L1'; delete it.fn; delete it.loc; }
  else if (sym === 'pe') { delete it.fn; delete it.loc; }
  else if (sym === 'term') { it.tag = lastMain.X || 'X1'; it.tn = nextTerminal(it.fn, it.loc, it.tag); }
  else if (d.role === 'aux') {
    const lm = lastMain[d.prefix];
    it.tag = lm && IX.dev.has(`${it.fn}\u0001${it.loc}\u0001${lm}`) ? lm : nextTag(it.fn, it.loc, d.prefix);
    assignContactNumbers(it);
  } else if (d.role === 'plc') { it.tag = lastMain.A_plc || 'A1'; it.addr = sym === 'plcin' ? '%I0.0' : '%Q0.0'; }
  else if (d.prefix) { it.tag = nextTag(it.fn, it.loc, d.prefix, d.res); lastMain[d.prefix] = it.tag; }
  else { delete it.fn; delete it.loc; }
  if (d.brk) {
    it.amps = d.amps; it.slot = nextSlot();
    const pn = [...allItems()].find(o => o.sym === 'rpnl'); if (pn) it.panel = pn.tag;
  }
  return it;
}
