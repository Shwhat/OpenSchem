// ---------- the demo project ----------
// One project that shows every feature: the pump station control panel and the home wiring building blocks,
// plus pages for drives, PLC cards, boxes, graphics, a panel layout, a note card page, round and oval rooms,
// layers, parts with prices, loads and voltage drop, cables, revisions and to-dos.
// When a feature is added, add it here too and to the demo coverage test (tests/suites/05-demo.mjs).
function buildDemo() {
  const p = demoIndustrial(); const h = demoHome();
  p.name = 'OpenSchem demo'; p.desc = 'Pump station control panel and home wiring';
  p.pages.push(...h.pages); p.levels = h.levels; p.pool = h.pool; p.circuits = h.circuits || {};
  p.settings = Object.assign({}, DEF_SETTINGS);
  P = ensureProject(p);
  const pg1 = p.pages.find(x => x.fn === 'M01' && x.num === '1'), pg2 = p.pages.find(x => x.fn === 'M01' && x.num === '2');
  const W = (pg, ...pts) => { const w = { id: uid(), pts }; pg.wires.push(w); return w; };
  const add = (pg, sym, x, y, o = {}) => { const it = Object.assign(makeItem(sym, x, y, o.rot || 0, pg), o); pg.items.push(it); return it; };

  // ---- parts with prices and sizes (copies carried by the project) ----
  p.parts = Object.fromEntries([
    ['GV2ME10', 'Schneider Electric', 'Motor circuit breaker 4-6.3 A', 'Protection', '68.00', '45', '89'],
    ['LC1D09P7', 'Schneider Electric', 'Contactor 9 A, 230 V AC coil', 'Contactors', '42.50', '45', '77'],
    ['LRD10', 'Schneider Electric', 'Overload relay 4-6 A', 'Protection', '55.00', '45', '66'],
    ['DF101', 'Schneider Electric', 'Fuse holder 1P', 'Protection', '8.40', '18', '81'],
    ['ATV320U22N4B', 'Schneider Electric', 'Variable speed drive 2.2 kW', 'Drives', '690.00', '60', '230'],
    ['XB5AA31', 'Schneider Electric', 'Push button green', 'Command', '14.20'],
    ['PT 2.5', 'Phoenix Contact', 'Push-in terminal 2.5 mm²', 'Terminals', '0.95', '5.2', '48'],
    ['HOM2040M200PC', 'Square D', 'Load center 200 A, 40 spaces', 'Panels', '389.00'],
  ].map(([pn, mfr, desc, cat, price, w, h2]) => [pn, Object.assign({ pn, mfr, desc, cat, price }, w ? { w, h: h2 } : {})]));

  // ---- cable on the motor feed ----
  pg1.cables.push({ id: uid(), x1: 92, y1: 156, x2: 120, y2: 156, tag: 'W1', fn: 'M01', loc: 'CP1', ctype: 'H07RN-F 4G1.5', len: '12 m', cond: {} });

  // ---- page 3: drive (black box), PLC card, device box, graphics ----
  const pg3 = newPage('M01', 'CP1', '3', 'Drive, PLC and relay module'); p.pages.push(pg3);
  ['1', '2', '3'].forEach((n, i) => add(pg3, 'term', 48 + i * 8, 48, { tag: 'X2', tn: n, desc: i ? '' : 'Drive supply', part: 'PT 2.5' }));
  const vfd = add(pg3, 'bbox', 40, 60, { tag: 'U1', w: 48, h: 24, btext: 'VFD\n2.2 kW', desc: 'Pump drive', part: 'ATV320U22N4B',
    pins: [{ s: 't', o: 8 }, { s: 't', o: 16 }, { s: 't', o: 24 }, { s: 'b', o: 8 }, { s: 'b', o: 16 }, { s: 'b', o: 24 }], cl: ['L1', 'L2', 'L3', 'U', 'V', 'W'] });
  add(pg3, 'motor', 56, 130, { tag: 'M2', desc: 'Circulation pump', tech: '2.2 kW 400 V' });
  for (const x of [48, 56, 64]) { W(pg3, [x, 52], [x, 60]); W(pg3, [x, 84], [x, 118]); }
  pg3.cables.push({ id: uid(), x1: 44, y1: 100, x2: 68, y2: 100, tag: 'W2', fn: 'M01', loc: 'CP1', ctype: 'Shielded 4G1.5', len: '8 m', cond: {} });
  const card = add(pg3, 'plccard', 120, 140, { tag: 'A2', kind: 'DIO', ch: 8, cho: 4, a0: '%I1.0', a1: '%Q1.0', desc: 'Digital I/O card' }); card.cl = plcCl(card);
  add(pg3, 'pbno', 128, 112, { tag: 'S3', desc: 'Fault reset', part: 'XB5AA31' }); W(pg3, [128, 120], [128, 140]); W(pg3, [128, 96], [128, 104]);
  add(pg3, 'lamp', 128, 172, { tag: 'P2', desc: 'Drive fault' }); W(pg3, [128, 156], [128, 164]);
  const dbx = add(pg3, 'dbox', 240, 60, { tag: 'A3', w: 72, h: 40, desc: 'Interface relay module' });
  add(pg3, 'coil', 256, 80, { tag: 'A3' }); add(pg3, 'no', 280, 80, { tag: 'A3', cl: ['13', '14'] });
  add(pg3, 'nc', 296, 80, { tag: 'A3', cl: ['21', '22'] }); W(pg3, [296, 48], [296, 72]); W(pg3, [296, 88], [296, 112]);
  W(pg3, [256, 48], [256, 72]); W(pg3, [256, 88], [256, 112]); W(pg3, [280, 48], [280, 72]); W(pg3, [280, 88], [280, 112]);
  pg3.gfx.push({ id: uid(), t: 'rect', pts: [[112, 104], [204, 188]], w: 0.35, dash: 'dash', color: '#1f5fbf', fill: '' });
  pg3.gfx.push({ id: uid(), t: 'dim', pts: [[40, 92], [88, 92]], w: 0.25, color: '#555555' });
  pg3.gfx.push({ id: uid(), t: 'circle', pts: [[350, 80], [362, 80]], w: 0.35, color: '#b3261e' });
  pg3.gfx.push({ id: uid(), t: 'line', pts: [[320, 124], [380, 124]], w: 0.5, dash: 'dot', color: '#000000' });
  pg3.gfx.push({ id: uid(), t: 'poly', pts: [[320, 140], [340, 160], [360, 140], [380, 160]], w: 0.5, dash: 'dashdot', color: '#2f7d32' });
  pg3.items.push({ id: uid(), sym: 'text', x: 116, y: 100, text: 'PLC rack 1', size: 2.5 });
  pg3.items.push({ id: uid(), sym: 'text', x: 316, y: 108, text: 'Graphics: circle, polyline, rectangle and dimension', size: 2.5 });

  // ---- user layer with commissioning notes ----
  p.ulayers = [{ id: 'Lnotes', name: 'Commissioning notes' }];
  pg2.items.push({ id: uid(), sym: 'text', x: 252, y: 80, text: 'Check pump rotation before handover', size: 3, layer: 'Lnotes' });

  // ---- panel layout of +CP1 ----
  const lay = Object.assign(newPage('M01', 'CP1', 'L1', 'Control panel layout'), { kind: 'layout', encl: { w: 600, h: 800 }, scale: 5, lay: [], gfx: [] });
  p.pages.push(lay); buildIndex();
  lay.lay.push({ id: uid(), t: 'duct', x: 20, y: 20, w: 560, h: 40, label: 'Wire duct' }, { id: uid(), t: 'rail', x: 30, y: 90, w: 540, h: 35, label: 'DIN rail' },
    { id: uid(), t: 'duct', x: 20, y: 250, w: 560, h: 40, label: 'Wire duct' }, { id: uid(), t: 'rail', x: 30, y: 300, w: 540, h: 35, label: 'DIN rail' }, { id: uid(), t: 'duct', x: 20, y: 560, w: 560, h: 40, label: 'Wire duct' });
  // devices centered on the two rails, wrapping to the second rail when the first is full
  let x = 40, rail = 107.5;
  for (const d of layoutDevices(lay).sort((a, b) => (footprint(lay, a)[1] > 150) - (footprint(lay, b)[1] > 150))) {
    const [w, h2] = footprint(lay, d); if (x + w > 570 || (h2 > 150 && rail < 300)) { x = 40; rail = 317.5; }
    // tall devices (drives) mount on the plate below the rail line
    lay.lay.push({ id: uid(), t: 'dev', item: (d.main || d.items[0]).id, x, y: h2 > 150 ? 300 : Math.round(rail - h2 / 2), w, h: h2 }); x += w + 8;
  }
  lay.gfx.push({ id: uid(), t: 'dim', pts: [[LO.x + 30 / 5, LO.y + 640 / 5], [LO.x + 570 / 5, LO.y + 640 / 5]], w: 0.25, color: '#555555' });

  // ---- home: garage circuit on a 3 x 5 in note card, with load and voltage drop ----
  const card5 = newPage('CKT5', '', '1', 'Garage outlet'); card5.size = 'CARD'; p.pages.push(card5);
  const hb = (sym, x2, y2, o) => { const it = Object.assign({ id: uid(), sym, x: x2, y: y2, rot: 0, fn: 'CKT5', loc: '', tag: '', role: SYM[sym].role, cl: SYM[sym].conns.map(c => c[2]), desc: '' }, o); if (!SYM[sym].prefix) { delete it.fn; delete it.loc; } card5.items.push(it); return it; };
  hb('rbrk1', 20, 20, { tag: 'BRK5', slot: '4', amps: '20', panel: 'PNL1', run: '75 ft', desc: 'Garage outlet' });
  hb('rout', 60, 40, { tag: 'OUT5', loc: 'Garage', desc: 'Workbench', va: '1500' });
  hb('rnbar', 60, 56);
  Object.assign(W(card5, [20, 28], [20, 30], [60, 30], [60, 32]), { color: 'BK', awg: '12' });
  Object.assign(W(card5, [60, 48], [60, 56]), { color: 'WH', awg: '12' });
  // ---- home: garage, round foyer and oval sunroom on the floor plan ----
  const lv = p.levels[0];
  lv.rooms.push({ id: uid(), name: 'Garage', pts: [[360, 40], [410, 40], [410, 140], [360, 140]] });
  lv.rooms.push({ id: uid(), name: 'Foyer', shape: 'circle', pts: [[292, 64], [348, 64], [348, 120], [292, 120]] });
  lv.rooms.push({ id: uid(), name: 'Sunroom', shape: 'ellipse', pts: [[360, 150], [410, 150], [410, 226], [360, 226]] });
  const out5 = card5.items.find(i => i.tag === 'OUT5');
  lv.places.push({ id: uid(), item: out5.id, x: 385, y: 136, rot: 180 });
  // drawn shapes: furniture, appliances, a door swing and labels
  const SH = o => { lv.shapes = lv.shapes || []; lv.shapes.push(Object.assign({ id: uid() }, o)); };
  SH(Object.assign(rectPline([196, 74], [244, 104], 4, 0), { fill: '#efe6d8' }));
  SH({ t: 'text', p: [212, 92], text: 'Table', h: 2.5, rot: 0 });
  SH({ t: 'line', a: [60, 122], b: [140, 122], lw: '0.5' });
  SH({ t: 'text', p: [84, 129], text: 'Counter', h: 2.2, rot: 0 });
  SH({ t: 'circle', c: [140, 200], r: 7 }); SH({ t: 'circle', c: [176, 200], r: 7 });
  SH({ t: 'arc', c: [120, 222], r: 14, a0: 90, a1: 180, dash: 'dash' }); SH({ t: 'line', a: [120, 222], b: [120, 208] });
  SH({ t: 'pline', pts: [[226, 214], [226, 224], [300, 224], [300, 214]], wd: [[1.2, 1.2], [1.2, 1.2], [1.2, 1.2]] });
  SH({ t: 'ellipse', c: [263, 200], rx: 14, ry: 6, rot: 0, fill: '#e7edf5' });
  SH({ t: 'pline', pts: polygonPts([320, 92], 6, 9, 90, 'I'), closed: true });
  SH({ t: 'pline', pts: [[368, 60], [400, 60], [400, 100]], b: [0, 0.4142], color: '#1e7a3c' });
  SH({ t: 'spline', pts: [[368, 212], [378, 203], [390, 215], [402, 206]], color: '#1e7a3c', lw: '0.7' });
  SH({ t: 'ellipse', c: [263, 200], rx: 18, ry: 9, rot: 0, a0: 200, a1: 340, dash: 'hidden' });
  SH({ t: 'text', p: [320, 168], text: 'Open to\nliving room', h: 2.2, rot: 0, align: 'center' });
  SH({ t: 'line', a: [210, 150], b: [350, 150], dash: 'center', color: '#9aa5b3' });
  // walls, doors and windows around the rooms
  const I = 25.4 / 48, ext = 6.5 * I, int = 4.5 * I;
  const WL = (a, b, th, kind) => { const w = { id: uid(), t: 'wall', a, b, th: r2(th * 1000) / 1000, just: 'c', h: 96 * 25.4, kind }; lv.shapes.push(w); return w; };
  const top = WL([40, 40], [360, 40], ext, '2x6 exterior'), right = WL([360, 40], [360, 230], ext, '2x6 exterior'), bot = WL([360, 230], [40, 230], ext, '2x6 exterior'), left = WL([40, 230], [40, 40], ext, '2x6 exterior');
  const mid = WL([40, 140], [360, 140], int, '2x4 interior'), kd = WL([160, 40], [160, 140], int, '2x4 interior'), df = WL([280, 40], [280, 140], int, '2x4 interior');
  const bl = WL([120, 140], [120, 230], int, '2x4 interior'), ll = WL([200, 140], [200, 230], int, '2x4 interior');
  const g1 = WL([360, 40], [410, 40], ext, '2x6 exterior'), g2 = WL([410, 40], [410, 140], ext, '2x6 exterior'), g3 = WL([410, 140], [360, 140], ext, '2x6 exterior');
  const OP = (wall, c, wIn, kind, style, side) => { const o = { id: uid(), t: 'opening', wall: wall.id, c, w: r2(wIn * I * 1000) / 1000, kind, side, hinge: 'a', h: kind === 'window' ? 48 * 25.4 : style === 'garage' ? 84 * 25.4 : 80 * 25.4, tag: nextOpeningTag(kind) }; if (style) o.style = style; if (kind === 'window') o.sill = 36 * 25.4; lv.shapes.push(o); return o; };
  OP(top, [320, 40], 36, 'door', 'single', -1); OP(kd, [160, 70], 48, 'opening', null, 1); OP(mid, [80, 140], 30, 'door', 'pocket', -1);
  OP(ll, [200, 195], 32, 'door', 'single', 1); OP(mid, [160, 140], 48, 'door', 'bifold', -1); OP(bot, [300, 230], 72, 'door', 'sliding', 1); OP(df, [280, 100], 60, 'door', 'double', 1);
  OP(g2, [410, 90], 144, 'door', 'garage', 1);
  OP(top, [100, 40], 48, 'window', null, 1); OP(top, [220, 40], 48, 'window', null, 1); OP(bot, [250, 230], 36, 'window', null, -1); OP(left, [40, 185], 30, 'window', null, 1);
  // dimensions that follow the walls, a leader, a tiled bath floor, blocks with attributes
  lv.shapes.push({ id: uid(), t: 'dim', kind: 'lin', p1: [40, 40], p2: [360, 40], loc: [200, 30], dir: 'h', r1: { id: top.id, g: 0 }, r2: { id: top.id, g: 1 }, style: 'Standard' });
  lv.shapes.push({ id: uid(), t: 'dim', kind: 'lin', p1: [40, 230], p2: [40, 40], loc: [28, 135], dir: 'v', r1: { id: left.id, g: 0 }, r2: { id: left.id, g: 1 }, style: 'Standard' });
  lv.shapes.push({ id: uid(), t: 'dim', kind: 'ali', p1: [360, 40], p2: [410, 40], loc: [385, 30], r1: { id: g1.id, g: 0 }, r2: { id: g1.id, g: 1 }, style: 'Standard' });
  const hw = int / 2, he = ext / 2;
  lv.shapes.push({ id: uid(), t: 'hatch', loops: [[[40 + he, 140 + hw], [120 - hw, 140 + hw], [120 - hw, 230 - he], [40 + he, 230 - he]].map(rp)], pattern: 'cross', scale: 1.4, angle: 0, color: '#9aa5b3' });
  const blocks = starterBlocks(); p.blocks = {};
  const BI = (name, x, y, rot, vals = {}) => { const d = blocks.find(b => b.name === name); p.blocks[name] = clone(d); const v = {}; for (const a of d.attrs || []) v[a.tag] = a.def || ''; lv.shapes.push({ id: uid(), t: 'insert', name, p: [x, y], rot, k: 1, vals: Object.assign(v, vals) }); };
  BI('Range 30"', 100, 48, 180, { PART: 'RNG-30E', TAG: 'RANGE' }); BI('Refrigerator', 60, 52, 180); BI('Toilet', 52, 158, 270, { PART: 'WC-12R' }); BI('Bathtub 60x30', 80, 220, 0);
  BI('Water heater', 188, 158, 0, { CIRCUIT: 'CKT4', LOAD: '0', PART: 'WH-50E' }); BI('Queen bed', 335, 95, 0);
  lv.shapes.push({ id: uid(), t: 'leader', pts: [[100, 56], [128, 76]], text: 'Range on its own\n50 A circuit', style: 'Standard' });
  p.dimStyles = [clone(DIM_DEFAULT), Object.assign(clone(DIM_DEFAULT), { name: 'Arrows', arrow: 'arrow' })]; p.dimStyle = 'Standard';
  lv.shapes.find(x => x.t === 'dim' && x.dir === 'v').style = 'Arrows';

  // ---- a view sheet with the whole level and the kitchen at a larger scale ----
  const kit = lv.rooms.find(r => r.name === 'Kitchen');
  p.pages.push(newFloorPage(lv.id, '3', 'Views', 'sheet', { vps: [{ id: uid(), level: lv.id, show: 'level', rect: [30, 40, 250, 200], scale: 96, title: 'Main floor' }, { id: uid(), level: lv.id, show: 'room', room: kit && kit.id, rect: [270, 40, 400, 200], scale: 48, title: '' }] }));

  // ---- revision, to-dos ----
  p.revs = [{ rev: 'A', date: today(), desc: 'First issue', by: 'Engineering', closed: true }];
  for (const x2 of p.pages) x2.revs = ['A'];
  p.todos = [
    { id: uid(), text: 'Confirm the garage outlet needs GFCI protection', done: false, created: today(), link: out5.id },
    { id: uid(), text: 'Add the second pump to the panel layout', done: false, created: today(), link: 'page:' + lay.id },
    { id: uid(), text: 'Order spare fuses', done: true, created: today(), link: '' },
  ];
  // ---- custom reports: a parts list for one trade and the breakers for one job ----
  p.customs = [
    { id: uid(), base: 'bom', title: 'Electrician parts list', mode: 'live', start: 'all', filters: [{ col: 4, op: 'not', value: 'terminal' }], inc: [], exc: [], edits: {}, heads: { 6: 'Where' }, hide: [5], extra: [], notes: 'Bring these to site on day one.' },
    { id: uid(), base: 'panel', title: 'Breakers for the kitchen job', mode: 'live', start: 'all', filters: [{ col: 6, op: 'has', value: 'kitchen' }], inc: [], exc: [], edits: {}, heads: {}, hide: [], extra: [], notes: '' },
  ];
  sortPages();
  return p;
}
