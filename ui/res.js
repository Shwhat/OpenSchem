// ---------- residential: symbols, settings, display names, wire colors ----------
for (const k of Object.keys(SYM)) if (!['term', 'ip', 'pe'].includes(k)) SYM[k].ind = true;

const outletFace = '<circle cx="0" cy="0" r="4.5"/><path d="M-1.5,-2V0.2M1.5,-2V0.2"/><circle cx="0" cy="2.3" r="0.6"/>';
const RES = { res: true, fixed: true, role: 'main' };
Object.assign(SYM, {
  rpnl:   Object.assign({ name: 'Panel', cat: 'Home: panel', prefix: 'PNL', fp: true,
            conns: [[-12, 12, 'L1'], [-4, 12, 'L2'], [4, 12, 'N'], [12, 12, 'G']], box: [-16, -8, 16, 12],
            draw: () => '<rect x="-16" y="-8" width="32" height="16"/><path d="M-12,8V12M-4,8V12M4,8V12M12,8V12"/>',
            texts: () => [[0, 1, 'PANEL', 3, true]] }, RES),
  rbrk1:  Object.assign({ name: 'Breaker 1P', cat: 'Home: panel', prefix: 'BRK', brk: 'Standard', poles: 1, amps: '15',
            conns: [[0, -8, 'LINE'], [0, 8, 'LOAD']], box: [-4, -8, 2, 8], draw: () => `<path d="${noC(0)}${cbX(0)}"/>` }, RES),
  rbrk2:  Object.assign({ name: 'Breaker 2P (240V)', cat: 'Home: panel', prefix: 'BRK', brk: '2-pole', poles: 2, amps: '30',
            conns: [[-4, -8, 'L1'], [-4, 8, 'T1'], [4, -8, 'L2'], [4, 8, 'T2']], box: [-8, -8, 6, 8],
            draw: () => `<path d="${noC(-4)}${noC(4)}${cbX(-4)}${cbX(4)}"/><path d="M-5.75,-0.25H2.25" ${dash}/>` }, RES),
  rbrkgf: Object.assign({ name: 'GFCI breaker', cat: 'Home: panel', prefix: 'BRK', brk: 'GFCI', poles: 1, amps: '20',
            conns: [[0, -8, 'LINE'], [0, 8, 'LOAD'], [8, -8, 'PN'], [8, 8, 'N LOAD']], box: [-6, -8, 11, 8],
            draw: () => `<path d="${noC(0)}${cbX(0)}M8,-8V-4.5M8,4.5V8"/><rect x="-6" y="-4.5" width="17" height="9" stroke-width="0.25"/>`,
            texts: () => [[6.5, 0.8, 'GF', 2]] }, RES),
  rbrkaf: Object.assign({ name: 'AFCI breaker', cat: 'Home: panel', prefix: 'BRK', brk: 'AFCI', poles: 1, amps: '15',
            conns: [[0, -8, 'LINE'], [0, 8, 'LOAD'], [8, -8, 'PN'], [8, 8, 'N LOAD']], box: [-6, -8, 11, 8],
            draw: () => `<path d="${noC(0)}${cbX(0)}M8,-8V-4.5M8,4.5V8"/><rect x="-6" y="-4.5" width="17" height="9" stroke-width="0.25"/>`,
            texts: () => [[6.5, 0.8, 'AF', 2]] }, RES),
  rnbar:  { name: 'Neutral bar', cat: 'Home: panel', prefix: null, role: 'bar', pot: 'N', res: true,
            conns: [[-16, 0, 'N'], [-8, 0, 'N'], [0, 0, 'N'], [8, 0, 'N'], [16, 0, 'N']], box: [-18, -1, 18, 2],
            draw: () => '<rect x="-18" y="0" width="36" height="1.6" fill="#000"/>', texts: () => [[-21, 1.6, 'N', 3, true]] },
  rgbar:  { name: 'Ground bar', cat: 'Home: panel', prefix: null, role: 'bar', pot: 'G', res: true,
            conns: [[-16, 0, 'G'], [-8, 0, 'G'], [0, 0, 'G'], [8, 0, 'G'], [16, 0, 'G']], box: [-18, -1, 18, 2],
            draw: () => '<rect x="-18" y="0" width="36" height="1.6" fill="#000"/>', texts: () => [[-21, 1.6, 'G', 3, true]] },
  rswt:   Object.assign({ name: 'Switch', cat: 'Home: switches', prefix: 'SWT', fp: true, sw: [[0, 1]],
            conns: [[0, -8, 'COM'], [0, 8, 'SW'], [8, 0, 'G']], box: [-4, -8, 8, 8],
            draw: () => '<path d="M0,-8V-3M0,8V3L-3.5,-3.5M4,0H8"/>' }, RES),
  rsw3:   Object.assign({ name: '3-way switch', cat: 'Home: switches', prefix: 'SWT', fp: true, sw: [[0, 1], [0, 2]],
            conns: [[0, -8, 'COM'], [-4, 8, 'T1'], [4, 8, 'T2'], [8, 0, 'G']], box: [-5, -8, 8, 8],
            draw: () => '<path d="M0,-8V-4L-3.6,2.4M-4,8V3M4,8V3M5,0H8"/><circle cx="-4" cy="3" r="0.6"/><circle cx="4" cy="3" r="0.6"/>' }, RES),
  rsw4:   Object.assign({ name: '4-way switch', cat: 'Home: switches', prefix: 'SWT', fp: true, sw: [[0, 2], [0, 3], [1, 2], [1, 3]],
            conns: [[-4, -8, 'T1 IN'], [4, -8, 'T2 IN'], [-4, 8, 'T1 OUT'], [4, 8, 'T2 OUT'], [8, 0, 'G']], box: [-6, -8, 8, 8],
            draw: () => '<path d="M-4,-8V-3M4,-8V-3M-4,8V3M4,8V3M-4,-3L4,3M4,-3L-4,3M5.5,0H8"/>' }, RES),
  rdim:   Object.assign({ name: 'Dimmer', cat: 'Home: switches', prefix: 'DIM', fp: true, sw: [[0, 1]],
            conns: [[0, -8, 'LINE'], [0, 8, 'LOAD'], [8, 0, 'G']], box: [-4, -8, 8, 8],
            draw: () => '<path d="M0,-8V-4M0,4V8M3,0H8M-4,4L4,-4M4,-4l-1.7,0.3M4,-4l-0.3,1.7"/><rect x="-3" y="-4" width="6" height="8"/>' }, RES),
  rout:   Object.assign({ name: 'Outlet', cat: 'Home: outlets', prefix: 'OUT', fp: true,
            conns: [[0, -8, 'H'], [0, 8, 'N'], [8, 0, 'G']], box: [-5, -8, 8, 8],
            draw: () => `<path d="M0,-8V-4.5M0,4.5V8M4.5,0H8"/>${outletFace}` }, RES),
  routgf: Object.assign({ name: 'GFCI outlet', cat: 'Home: outlets', prefix: 'OUT', fp: true,
            conns: [[-4, -8, 'LINE H'], [4, -8, 'LOAD H'], [-4, 8, 'LINE N'], [4, 8, 'LOAD N'], [8, 0, 'G']], box: [-5, -8, 8, 8],
            draw: () => '<path d="M-4,-8V-2.1M4,-8V-2.1M-4,8V2.1M4,8V2.1M4.5,0H8"/><circle cx="0" cy="0" r="4.5"/>',
            texts: () => [[0, 0.7, 'GFCI', 1.8, true]] }, RES),
  routsw: Object.assign({ name: 'Half-switched outlet', cat: 'Home: outlets', prefix: 'OUT', fp: true,
            conns: [[-4, -8, 'H'], [4, -8, 'H SW'], [0, 8, 'N'], [8, 0, 'G']], box: [-5, -8, 8, 8],
            draw: () => '<path d="M-4,-8V-2.1M4,-8V-2.1M0,4.5V8M4.5,0H8"/><circle cx="0" cy="0" r="4.5"/><path d="M-1.5,-2V0.2M1.5,-2V0.2"/>',
            texts: () => [[0, 3.3, 'SW', 1.5]] }, RES),
  rout240:Object.assign({ name: '240V outlet', cat: 'Home: outlets', prefix: 'OUT', fp: true,
            conns: [[-4, -8, 'L1'], [4, -8, 'L2'], [0, 8, 'N'], [8, 0, 'G']], box: [-5, -8, 8, 8],
            draw: () => '<path d="M-4,-8V-2.1M4,-8V-2.1M0,4.5V8M4.5,0H8"/><circle cx="0" cy="0" r="4.5"/>',
            texts: () => [[0, 0.7, '240V', 1.8, true]] }, RES),
  rlgt:   Object.assign({ name: 'Light', cat: 'Home: lights and loads', prefix: 'LGT', fp: true, load: [0],
            conns: [[0, -8, 'H'], [0, 8, 'N'], [8, 0, 'G']], box: [-4, -8, 8, 8],
            draw: () => '<path d="M0,-8V-4M0,4V8M4,0H8M-2.83,-2.83L2.83,2.83M2.83,-2.83L-2.83,2.83"/><circle cx="0" cy="0" r="4"/>' }, RES),
  rfan:   Object.assign({ name: 'Ceiling fan', cat: 'Home: lights and loads', prefix: 'FAN', fp: true, load: [0, 1],
            conns: [[-4, -8, 'FAN H'], [4, -8, 'LIGHT H'], [0, 8, 'N'], [8, 0, 'G']], box: [-5, -8, 8, 8],
            draw: () => '<path d="M-4,-8V-2.1M4,-8V-2.1M0,4.5V8M4.5,0H8"/><circle cx="0" cy="0" r="4.5"/>',
            texts: () => [[0, 0.7, 'FAN', 2, true]] }, RES),
  rsmk:   Object.assign({ name: 'Smoke/CO detector', cat: 'Home: lights and loads', prefix: 'SMK', fp: true,
            conns: [[0, -8, 'H'], [0, 8, 'N'], [-8, 0, 'I']], box: [-8, -8, 4.5, 8],
            draw: () => '<path d="M0,-8V-4.5M0,4.5V8M-4.5,0H-8"/><circle cx="0" cy="0" r="4.5"/>',
            texts: () => [[0, 0.7, 'SD', 2.2, true]] }, RES),
  rjbx:   Object.assign({ name: 'Junction box', cat: 'Home: lights and loads', prefix: 'JBX', fp: true, splice: true,
            conns: [[0, -8, ''], [0, 8, ''], [-8, 0, ''], [8, 0, '']], box: [-8, -8, 8, 8],
            draw: () => '<path d="M0,-8V-4M0,4V8M-8,0H-4M4,0H8"/><rect x="-4" y="-4" width="8" height="8"/>',
            texts: () => [[0, 1, 'J', 3, true]] }, RES),
  rapp:   Object.assign({ name: 'Hardwired appliance', cat: 'Home: lights and loads', prefix: 'APP', fp: true,
            conns: [[-4, -8, 'L1'], [4, -8, 'L2/N'], [0, 8, 'G']], box: [-8, -8, 8, 8],
            draw: () => '<path d="M-4,-8V-4M4,-8V-4M0,4V8"/><rect x="-8" y="-4" width="16" height="8"/>',
            texts: () => [[0, 0.8, 'APPL', 2.2, true]] }, RES),
});
SYMORDER.push('rpnl', 'rbrk1', 'rbrk2', 'rbrkgf', 'rbrkaf', 'rnbar', 'rgbar', 'rswt', 'rsw3', 'rsw4', 'rdim', 'rout', 'routgf', 'routsw', 'rout240', 'rlgt', 'rfan', 'rsmk', 'rjbx', 'rapp');
const RES_QUICK = ['rbrk1', 'rbrkgf', 'rswt', 'rsw3', 'rdim', 'rout', 'routgf', 'rlgt', 'rfan', 'rsmk', 'rjbx', 'rnbar', 'rgbar'];
const FP_QUICK = ['rout', 'routgf', 'routsw', 'rout240', 'rlgt', 'rfan', 'rswt', 'rsw3', 'rsw4', 'rdim', 'rsmk', 'rjbx', 'rapp', 'rpnl'];
const BRK_LOAD = { rbrk1: [1], rbrkgf: [1, 3], rbrkaf: [1, 3], rbrk2: [1, 3] };

// ---------- project settings ----------
const DEF_SETTINGS = { terms: 'eng', tagStyle: 'eng', numbering: 'house', fpSymbols: 'simple', connLabels: true, industrial: true,
  reportCols: 'eng', circuitColors: true, switchLegs: true, defAwg: '14' };
function S() { if (!P.settings) P.settings = Object.assign({}, DEF_SETTINGS); return P.settings; }
function ensureProject(p) {
  p.settings = Object.assign({}, DEF_SETTINGS, p.settings || {});
  p.levels = p.levels || []; p.pool = p.pool || []; p.circuits = p.circuits || {}; p.assets = p.assets || {};
  for (const pg of p.pages) { pg.items = pg.items || []; pg.wires = pg.wires || []; pg.cables = pg.cables || []; }
  p.revs = p.revs || []; p.todos = p.todos || [];
  return p;
}
function* allItems() { for (const pg of P.pages) yield* pg.items; yield* (P.pool || []); }

const LABELS = {
  fn: ['Function (=)', 'Circuit'], loc: ['Location (+)', 'Room'], tag: ['Device tag (-)', 'Name'],
  desc: ['Function text', 'Description'], tech: ['Technical data', 'Details'], nofl: ['(no function / location)', '(no circuit)'],
};
const L = k => LABELS[k][S().terms === 'home' ? 1 : 0];
const FRIENDLY = { BRK: 'Breaker', PNL: 'Panel', LGT: 'Light', SWT: 'Switch', DIM: 'Dimmer', OUT: 'Outlet', FAN: 'Fan', SMK: 'Smoke', JBX: 'J-box', APP: 'Appliance' };
function friendlyTag(tag) { const m = /^([A-Za-z]+)(\d+)$/.exec(tag || ''); return m && FRIENDLY[m[1].toUpperCase()] ? FRIENDLY[m[1].toUpperCase()] + ' ' + m[2] : (tag || ''); }
function friendlyCkt(fn) { return String(fn || '').replace(/^([A-Za-z]+)(\d)/, '$1 $2'); }
function niceRoom(loc) {
  if (!loc) return '';
  return loc === loc.toUpperCase() ? loc.toLowerCase().split(/[_ ]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : loc;
}
const home = () => S().tagStyle === 'home';
function dispFull(fn, loc, tag) {
  if (home()) return [fn && friendlyCkt(fn), loc && niceRoom(loc), friendlyTag(tag)].filter(Boolean).join(' · ');
  return fl(fn, loc) + '-' + tag;
}
function dispOnPage(it, pg) {
  if (!home()) return identOnPage(it, pg);
  const parts = [];
  if (it.fn && it.fn !== pg.fn) parts.push(friendlyCkt(it.fn));
  if (it.loc && it.loc !== pg.loc) parts.push(niceRoom(it.loc));
  parts.push(friendlyTag(it.tag));
  return parts.join(' · ');
}
const dispTag = tag => home() ? friendlyTag(tag) : tag;
const dispCkt = fn => !fn ? '' : home() ? friendlyCkt(fn) : '=' + fn;

// ---------- circuits and colors ----------
const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#2aa7c9', '#f032e6', '#9a6324', '#469990', '#800000', '#808000', '#000075'];
function allCircuits() {
  const s = new Set();
  const real = it => { const d = SYM[it.sym]; return d && d.res && d.prefix && d.prefix !== 'PNL'; };
  for (const it of allItems()) if (real(it) && it.fn) s.add(it.fn);
  for (const pg of P.pages) if (pg.kind !== 'floor' && pg.fn && pg.items.some(real)) s.add(pg.fn);
  return [...s].sort(natCmp);
}
function circuitColor(fn) {
  if (!fn) return '#555';
  if (P.circuits[fn] && P.circuits[fn].color) return P.circuits[fn].color;
  const i = allCircuits().indexOf(fn); return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

// ---------- wire colors (US) ----------
const WIRECOL = { BK: '#1a1a1a', WH: '#9aa1a9', GN: '#1f8a3a', RD: '#d22b2b', BL: '#1f5fbf', YL: '#c9a400', BARE: '#b87333' };
function wireColorFor(lab) {
  lab = String(lab || '').toUpperCase();
  if (/^(N|PN|LINE N|LOAD N|N LOAD)$/.test(lab)) return 'WH';
  if (/^(G|PE)$/.test(lab)) return 'GN';
  if (/^(T1|T2|I|T1 IN|T2 IN|T1 OUT|T2 OUT)$/.test(lab)) return 'RD';
  return null;
}
function autoWire(pg, pts) {
  let res = false, col = null;
  for (const p of [pts[0], pts[pts.length - 1]]) {
    for (const it of pg.items) {
      const d = SYM[it.sym]; if (!d) continue;
      for (const c of connPts(it)) if (c.x === p[0] && c.y === p[1]) {
        if (d.res) res = true;
        const k = wireColorFor(d.role === 'bar' ? d.pot : (it.cl || [])[c.i]); if (k && !col) col = k;
      }
    }
    for (const w of pg.wires) if (onPoly(p, w.pts) && w.color) { if (!col) col = w.color; if (w.awg) res = true; }
  }
  return res ? { color: col || 'BK', awg: S().defAwg } : null;
}

// ---------- switch legs (switch -> light) from the schematic ----------
function computeLegs() {
  const net = (it, i) => NETS.find(`c:${it.id}:${i}`);
  const feed = new Set(), adj = new Map(), loads = new Map(), switches = [];
  for (const pg of P.pages) for (const it of pg.items) {
    const d = SYM[it.sym]; if (!d) continue;
    if (BRK_LOAD[it.sym]) for (const i of BRK_LOAD[it.sym]) if (!/N/.test((it.cl || [])[i] || '')) feed.add(net(it, i));
    if (d.sw) { switches.push(it); for (const [a, b] of d.sw) { const na = net(it, a), nb = net(it, b); for (const [x, y] of [[na, nb], [nb, na]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); } } }
    const ld = d.load || (it.sym === 'routsw' ? [1] : null);
    if (ld) for (const i of ld) { const n = net(it, i); if (!loads.has(n)) loads.set(n, []); loads.get(n).push(it); }
  }
  const legs = [];
  for (const s of switches) {
    const d = SYM[s.sym]; const seen = new Set(feed); const q = [];
    for (const [a, b] of d.sw) for (const i of [a, b]) { const n = net(s, i); if (!seen.has(n)) { seen.add(n); q.push(n); } }
    const got = new Set();
    while (q.length) {
      const n = q.shift();
      for (const l of loads.get(n) || []) if (!got.has(l.id)) { got.add(l.id); legs.push([s.id, l.id]); }
      for (const m of adj.get(n) || []) if (!seen.has(m)) { seen.add(m); q.push(m); }
    }
  }
  return legs;
}

// ---------- panel schedule ----------
const PS_COLS = () => S().reportCols === 'plain'
  ? [{ h: 'Slot', w: 16, a: 'middle' }, { h: 'Circuit', w: 34 }, { h: 'Breaker', w: 34 }, { h: 'Amps', w: 14, a: 'middle' }, { h: 'Poles', w: 16, a: 'middle' }, { h: 'Type', w: 30 }, { h: 'What it powers', w: 110 }, { h: 'Rooms', w: 146 }]
  : [{ h: 'Slot', w: 16, a: 'middle' }, { h: 'Circuit (=)', w: 34 }, { h: 'Breaker', w: 34 }, { h: 'A', w: 14, a: 'middle' }, { h: 'Poles', w: 16, a: 'middle' }, { h: 'Type', w: 30 }, { h: 'Description', w: 110 }, { h: 'Locations (+)', w: 146 }];
function panelRows() {
  const panels = [...IX.dev.values()].filter(d => d.items.some(i => i.sym === 'rpnl')).map(d => d.tag).sort(natCmp);
  const groups = new Map();
  for (const it of allItems()) {
    const d = SYM[it.sym]; if (!d || !d.brk) continue;
    const pn = it.panel || panels[0] || ''; if (!groups.has(pn)) groups.set(pn, []);
    const fn = it.fn || '';
    const rooms = new Set();
    for (const o of allItems()) { const od = SYM[o.sym]; if (o.fn === fn && fn && od && od.res && !od.brk && od.prefix !== 'PNL' && o.loc) rooms.add(niceRoom(o.loc)); }
    const cpage = P.pages.find(p => p.kind !== 'floor' && p.fn === fn && fn);
    groups.get(pn).push({ slot: it.slot || '', circuit: fn ? (home() || S().reportCols === 'plain' ? friendlyCkt(fn) : '=' + fn) : '-', brk: dispTag(it.tag),
      amps: it.amps || d.amps, poles: String(d.poles), type: d.brk, desc: it.desc || (cpage ? cpage.desc : ''), rooms: [...rooms].sort(natCmp).join(', '), goto: it.id });
  }
  for (const l of groups.values()) l.sort((a, b) => natCmp(a.slot, b.slot) || natCmp(a.circuit, b.circuit));
  return groups;
}
async function exportPanel() {
  buildIndex();
  const rows = [];
  for (const [pn, list] of panelRows()) for (const r of list) rows.push([pn, r.slot, r.circuit, r.brk, r.amps, r.poles, r.type, r.desc, r.rooms]);
  const csv = toCSV(['Panel', 'Slot', 'Circuit', 'Breaker', 'Amps', 'Poles', 'Type', 'Description', 'Rooms'], rows);
  const p = await host.saveText(csv, (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' panel schedule.csv');
  if (p) flash('Exported ' + p);
}

// ---------- settings dialog ----------
function settingsDlg() {
  const s = S();
  dialog('Display settings', [
    ['terms', 'Labels', s.terms, 'select', [['eng', 'Engineering (Function, Location, Device tag)'], ['home', 'Homeowner (Circuit, Room, Name)']]],
    ['tagStyle', 'Tag display', s.tagStyle, 'select', [['eng', 'Engineering (=CKT12+KITCHEN-OUT1)'], ['home', 'Homeowner (CKT 12 · Kitchen · Outlet 1)']]],
    ['numbering', 'Home device numbering', s.numbering, 'select', [['house', 'Whole house (OUT1 to OUT40)'], ['room', 'Per room (restarts in each room)']]],
    ['fpSymbols', 'Floor-plan symbols', s.fpSymbols, 'select', [['simple', 'Simple icons'], ['arch', 'Architectural']]],
    ['reportCols', 'Report column names', s.reportCols, 'select', [['eng', 'Engineering'], ['plain', 'Plain']]],
    ['defAwg', 'Default wire size (home)', s.defAwg, 'select', [['14', '14 AWG'], ['12', '12 AWG'], ['10', '10 AWG'], ['8', '8 AWG'], ['6', '6 AWG']]],
    ['connLabels', 'Show connection point numbers', s.connLabels, 'check'],
    ['industrial', 'Show industrial symbols', s.industrial, 'check'],
    ['circuitColors', 'Circuit colors on floor plans', s.circuitColors, 'check'],
    ['switchLegs', 'Switch legs on floor plans', s.switchLegs, 'check'],
    ['theme', 'Theme', PREFS.theme, 'select', [['light', 'Light'], ['dark', 'Dark'], ['system', 'Follow Windows']]],
    ['sheet', 'Drawing sheet', PREFS.sheet, 'select', [['white', 'White (paper)'], ['dark', 'Dark']]],
    ['snap', 'Snap to grid (all pages)', PREFS.snap, 'check'],
    ['gridSch', 'Schematic grid', String(PREFS.gridSch), 'select', [['1', '1 mm'], ['2', '2 mm'], ['4', '4 mm (symbol grid)'], ['8', '8 mm']]],
    ['gridFp', 'Floor plan grid', String(PREFS.gridFp), 'select', [['1', '1 mm'], ['2', '2 mm'], ['4', '4 mm'], ['8', '8 mm']]],
  ], v => {
    PREFS.snap = v.snap; PREFS.gridSch = +v.gridSch; PREFS.gridFp = +v.gridFp; PREFS.theme = v.theme; PREFS.sheet = v.sheet; savePrefs(); applyTheme();
    delete v.snap; delete v.gridSch; delete v.gridFp; delete v.theme; delete v.sheet;
    commit(() => Object.assign(S(), v)); symKey = ''; renderSymbols(); renderToolbar();
  }, 'OK', '<div class="note">Snap and grid sizes apply to every project. Symbols always keep their 4 mm connection spacing.</div>');
}
function newResidential() {
  if (!confirmDiscard()) return;
  const p = newProject(); p.name = 'My home';
  p.settings = Object.assign({}, DEF_SETTINGS, { terms: 'home', tagStyle: 'home', industrial: false, reportCols: 'plain' });
  p.pages = [newPage('PANEL', '', '1', 'Main panel'), newPage('CKT1', '', '1', 'Circuit 1')];
  const lv = { id: uid(), name: 'Main floor', rooms: [], places: [], image: null }; p.levels = [lv];
  p.pages.push(newFloorPage(lv.id, '1', 'Main floor', 'level'));
  loadProject(p, '');
}
