// ---------- the demo projects ----------
// Two projects, IEC and NFPA, that each show every feature: the pump station control panel and the home wiring
// building blocks, plus pages for drives, PLC cards, boxes, graphics, a panel layout, a note card page, round and
// oval rooms, layers, parts with prices, loads and voltage drop, cables, revisions and to-dos, the IEC or NFPA symbol
// library, a single-line page, pneumatic pages with tubes and the tubing list. The NFPA demo is the IEC demo converted
// to NFPA symbols and device letters.
// When a feature is added, add it here too and to the demo coverage test (tests/suites/05-demo.mjs).
function buildDemo(std = 'IEC') {
  const p = demoIndustrial(); const h = demoHome();
  p.name = 'OpenSchem demo (' + std + ')'; p.desc = 'Pump station control panel, clamp station pneumatics and home wiring';
  p.pages.push(...h.pages); p.levels = h.levels; p.pool = h.pool; p.circuits = h.circuits || {};
  p.settings = Object.assign({}, DEF_SETTINGS);
  P = ensureProject(p);
  const pg1 = p.pages.find(x => x.fn === 'M01' && x.num === '1'), pg2 = p.pages.find(x => x.fn === 'M01' && x.num === '2');
  const W = (pg, ...pts) => { const w = { id: uid(), pts }; pg.wires.push(w); return w; };
  const add = (pg, sym, x, y, o = {}) => { const it = Object.assign(makeItem(sym, x, y, o.rot || 0, pg), o); pg.items.push(it); return it; };

  // ---- parts with prices and sizes (copies carried by the project) ----
  p.parts = Object.fromEntries([
    ['SCH', 'GV2ME10', 'GV2ME10', 'Motor circuit breaker 4-6.3 A', 'Protection', '68.00', '45', '89'],
    ['SCH', 'LC1D09P7', 'TeSys D LC1D09', 'Contactor 9 A, 230 V AC coil', 'Contactors', '42.50', '45', '77'],
    ['SCH', 'LRD10', 'TeSys LRD10', 'Overload relay 4-6 A', 'Protection', '55.00', '45', '66'],
    ['SCH', 'DF101', 'DF101', 'Fuse holder 1P', 'Protection', '8.40', '18', '81'],
    ['SCH', 'ATV320U22N4B', 'Altivar ATV320', 'Variable speed drive 2.2 kW', 'Drives', '690.00', '60', '230'],
    ['SCH', 'XB5AA31', 'XB5AA31', 'Push button green', 'Command', '14.20'],
    ['PXC', '3209510', 'PT 2.5', 'Push-in terminal 2.5 mm²', 'Terminals', '0.95', '5.2', '48'],
    ['SQD', 'HOM2040M200PC', 'Homeline', 'Load center 200 A, 40 spaces', 'Panels', '389.00'],
  ].map(([mfr, ord, type, desc, cat, price, w, h2]) => [mfr + '.' + ord, Object.assign({ pn: mfr + '.' + ord, mfr, ord, type, desc, cat, price }, w ? { w, h: h2 } : {})]));

  // ---- cable on the motor feed ----
  pg1.cables.push({ id: uid(), x1: 92, y1: 156, x2: 120, y2: 156, tag: 'W1', fn: 'M01', loc: 'CP1', ctype: 'H07RN-F 4G1.5', len: '12 m', cond: {} });

  // ---- page 3: drive (black box), PLC card, device box, graphics ----
  const pg3 = newPage('M01', 'CP1', '3', 'Drive, PLC and relay module'); p.pages.push(pg3);
  ['1', '2', '3'].forEach((n, i) => add(pg3, 'term', 48 + i * 8, 48, { tag: 'X2', tn: n, desc: i ? '' : 'Drive supply', part: 'PXC.3209510' }));
  const vfd = add(pg3, 'bbox', 40, 60, { tag: 'U1', w: 48, h: 24, btext: 'VFD\n2.2 kW', desc: 'Pump drive', part: 'SCH.ATV320U22N4B',
    pins: [{ s: 't', o: 8 }, { s: 't', o: 16 }, { s: 't', o: 24 }, { s: 'b', o: 8 }, { s: 'b', o: 16 }, { s: 'b', o: 24 }], cl: ['L1', 'L2', 'L3', 'U', 'V', 'W'] });
  add(pg3, 'motor', 56, 130, { tag: 'M2', desc: 'Circulation pump', tech: '2.2 kW 400 V' });
  for (const x of [48, 56, 64]) { W(pg3, [x, 52], [x, 60]); W(pg3, [x, 84], [x, 118]); }
  pg3.cables.push({ id: uid(), x1: 44, y1: 100, x2: 68, y2: 100, tag: 'W2', fn: 'M01', loc: 'CP1', ctype: 'Shielded 4G1.5', len: '8 m', cond: {} });
  const card = add(pg3, 'plccard', 120, 140, { tag: 'A2', kind: 'DIO', ch: 8, cho: 4, a0: '%I1.0', a1: '%Q1.0', desc: 'Digital I/O card' }); card.cl = plcCl(card);
  add(pg3, 'pbno', 128, 112, { tag: 'S3', desc: 'Fault reset', part: 'SCH.XB5AA31' }); W(pg3, [128, 120], [128, 140]); W(pg3, [128, 96], [128, 104]);
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

  // ---- symbol library, single-line page and pneumatics ----
  demoStandards(p, add, W);

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
  if (std === 'NFPA') {
    // the same project drawn to NFPA 79: NFPA symbols and device letters (the pump contactor becomes a motor starter)
    p.std = 'NFPA';
    const items = p.pages.flatMap(pg => pg.items).concat(p.pool || []);
    const k1 = items.find(i => i.sym === 'coil' && i.tag === 'K1' && i.fn === 'M01');
    applyStdConversions(stdConversions(items, 'NFPA', it => it === k1 ? 'n_mcoil' : null));
    retagLetters(items, 'NFPA');
  }
  sortPages();
  return p;
}

// IEC symbols beyond the pump circuit, a single-line page, and two pneumatic pages with tubes
function demoStandards(p, add, W) {
  const items = (pg, list) => list.forEach(([sym, x, y, o]) => add(pg, sym, x, y, o || {}));
  const rails = pg => { add(pg, 'ip', 24, 40, { ipName: 'L11', rot: 270 }); W(pg, [24, 40], [400, 40]); add(pg, 'ip', 24, 232, { ipName: 'L21', rot: 270 }); W(pg, [24, 232], [400, 232]); };
  // ---- page 4: supply, control transformer and an auxiliary pump on a drive ----
  const pg4 = newPage('M01', 'CP1', '4', 'Supply, control power and auxiliary pump'); p.pages.push(pg4);
  items(pg4, [['disc3', 64, 60, { tag: 'Q0', desc: 'Main disconnect', tech: '40 A' }], ['mpcb', 64, 100, { tag: 'Q2', desc: 'Auxiliary pump protection', tech: '1-1.6 A' }],
    ['vfd', 64, 132, { tag: 'U3', desc: 'Auxiliary pump drive' }], ['motor', 64, 172, { tag: 'M3', desc: 'Auxiliary pump', tech: '0.37 kW' }],
    ['xfmr', 200, 112, { tag: 'T1', desc: 'Control transformer', tech: '400/24 V 100 VA' }], ['fuse', 196, 140, { tag: 'F5', desc: 'Control circuit fuse', tech: '4 A', part: 'SCH.DF101' }]]);
  for (const x of [56, 64, 72]) { W(pg4, [x, 36], [x, 52]); W(pg4, [x, 68], [x, 92]); W(pg4, [x, 108], [x, 120]); W(pg4, [x, 144], [x, 160]); }
  W(pg4, [56, 76], [196, 76], [196, 100]); W(pg4, [64, 80], [204, 80], [204, 100]); W(pg4, [196, 124], [196, 132]);
  add(pg4, 'ip', 196, 160, { ipName: 'L11', rot: 180 }); W(pg4, [196, 148], [196, 160]);
  add(pg4, 'ip', 228, 160, { ipName: 'L21', rot: 180 }); W(pg4, [204, 124], [204, 128], [228, 128], [228, 160]);
  // ---- page 5: heater, socket, fan and damper motors, timers with timed and changeover contacts ----
  const pg5 = newPage('M01', 'CP1', '5', 'Heater, fans, alarm and timers'); p.pages.push(pg5); rails(pg5);
  items(pg5, [['cb2', 44, 72, { tag: 'Q3', desc: 'Panel heater' }], ['tsw', 40, 104, { tag: 'B2', desc: 'Panel thermostat', tech: 'closes below 5 °C' }],
    ['heater', 40, 136, { tag: 'E1', desc: 'Panel heater', tech: '100 W' }], ['plug', 72, 136, { tag: 'X3', desc: 'Service socket' }]]);
  W(pg5, [40, 40], [40, 64]); W(pg5, [48, 40], [48, 64]); W(pg5, [40, 80], [40, 96]); W(pg5, [40, 112], [40, 128]); W(pg5, [40, 144], [40, 232]);
  W(pg5, [48, 80], [48, 88], [72, 88], [72, 128]); W(pg5, [72, 144], [72, 232]);
  items(pg5, [['sel', 112, 72, { tag: 'S4', desc: 'Fan off / on' }], ['motor1', 116, 128, { tag: 'M5', desc: 'Cabinet fan' }], ['motordc', 164, 128, { tag: 'M4', desc: 'Damper actuator' }]]);
  W(pg5, [112, 40], [112, 64]); W(pg5, [112, 80], [112, 116]); W(pg5, [120, 116], [120, 108], [136, 108], [136, 232]);
  W(pg5, [160, 40], [160, 116]); W(pg5, [168, 116], [168, 108], [176, 108], [176, 232]);
  // on-delay timer K2 and off-delay timer K3 with timed contacts and pilot lights; K2's changeover contact
  items(pg5, [['lsno', 212, 72, { tag: 'S5', desc: 'Door closed' }], ['tdon', 212, 120, { tag: 'K2', desc: 'Alarm delay', tech: '10 s' }],
    ['tno_on', 248, 72, { tag: 'K2', cl: ['17', '18'] }], ['horn', 248, 176, { tag: 'P3', desc: 'Alarm horn' }],
    ['tnc_on', 276, 72, { tag: 'K2', cl: ['15', '16'] }], ['lamp', 276, 176, { tag: 'P4', desc: 'Door open' }],
    ['lsnc', 304, 72, { tag: 'S6', desc: 'Guard open' }], ['tdoff', 304, 120, { tag: 'K3', desc: 'Run-on timer', tech: '30 s' }],
    ['tno_off', 340, 72, { tag: 'K3', cl: ['17', '18'] }], ['lamp', 340, 176, { tag: 'P5', desc: 'Run-on' }],
    ['tnc_off', 368, 72, { tag: 'K3', cl: ['15', '16'] }], ['lamp', 368, 176, { tag: 'P6', desc: 'Ready' }],
    ['co', 396, 72, { tag: 'K2', rot: 180, cl: ['21', '22', '24'] }], ['lamp', 392, 184, { tag: 'P7', desc: 'Normal' }], ['lamp', 400, 136, { tag: 'P8', desc: 'Alarm' }]]);
  for (const x of [212, 304]) { W(pg5, [x, 40], [x, 64]); W(pg5, [x, 80], [x, 112]); W(pg5, [x, 128], [x, 232]); }
  for (const x of [248, 276, 340, 368]) { W(pg5, [x, 40], [x, 64]); W(pg5, [x, 80], [x, 168]); W(pg5, [x, 184], [x, 232]); }
  W(pg5, [396, 40], [396, 64]); W(pg5, [392, 80], [392, 176]); W(pg5, [392, 192], [392, 232]); W(pg5, [400, 80], [400, 128]); W(pg5, [400, 144], [400, 232]);
  // ---- page 7: sensors into the PLC, and the solenoids of the pneumatic valves (cross-referenced to the valves) ----
  const pg7 = newPage('M01', 'CP1', '7', 'PLC inputs and valve solenoids'); p.pages.push(pg7); rails(pg7);
  const ins = [['prox', 'B1', 'Clamp closed'], ['psw', 'B3', 'Air pressure OK'], ['lvl', 'B4', 'Sump level'], ['flow', 'B5', 'Cooling flow']];
  ins.forEach(([sym, tag, desc], i) => { const x = 60 + i * 40; add(pg7, sym, x, 80, { tag, desc }); add(pg7, 'plcin', x, 112, { tag: 'A4', addr: '%I2.' + i, desc: '' }); W(pg7, [x, 40], [x, 72]); W(pg7, [x, 88], [x, 104]); });
  const outs = [['QM2', 'Clamp', ['A1', 'A2']], ['QM3', 'Slide extend', ['A1', 'A2']], ['QM3', 'Slide retract', ['A3', 'A4']]];
  outs.forEach(([tag, desc, cl], i) => { const x = 260 + i * 44; add(pg7, 'plcout', x, 160, { tag: 'A4', addr: '%Q2.' + i, desc: '' }); add(pg7, 'solc', x, 184, { tag, fn: 'M02', loc: 'PN1', desc, cl }); W(pg7, [x, 168], [x, 176]); W(pg7, [x, 192], [x, 232]); });
  // ---- page 6: single-line diagram; each symbol is a view of a device drawn on the other pages ----
  const sl = newPage('M01', 'CP1', '6', 'Single-line diagram'); sl.type = 'sl'; p.pages.push(sl);
  items(sl, [['sl_disc', 120, 48, { tag: 'Q0' }], ['sl_cb', 80, 96, { tag: 'Q1' }], ['sl_k', 80, 128, { tag: 'K1' }], ['sl_ol', 80, 160, { tag: 'F1' }], ['sl_motor', 80, 200, { tag: 'M1' }],
    ['sl_mpcb', 160, 96, { tag: 'Q2' }], ['sl_vfd', 160, 136, { tag: 'U3' }], ['sl_motor', 160, 184, { tag: 'M3' }], ['sl_xfmr', 240, 104, { tag: 'T1' }], ['sl_fuse', 240, 140, { tag: 'F5' }], ['sl_vfd', 320, 100, { tag: 'U1' }], ['sl_motor', 320, 144, { tag: 'M2' }]]);
  W(sl, [120, 56], [120, 72]); W(sl, [80, 72], [320, 72]); W(sl, [80, 72], [80, 88]); W(sl, [80, 104], [80, 120]); W(sl, [80, 136], [80, 152]); W(sl, [80, 168], [80, 192]);
  W(sl, [160, 72], [160, 88]); W(sl, [160, 104], [160, 128]); W(sl, [160, 144], [160, 176]); W(sl, [240, 72], [240, 96]); W(sl, [240, 112], [240, 132]); W(sl, [320, 72], [320, 92]); W(sl, [320, 108], [320, 136]);

  // ---- pneumatics: tubes with size, color, length and part number ----
  const T = (pg, od, len, ...pts) => { const w = Object.assign({ id: uid(), pts }, newTubeProps(), { od, color: od === '4' ? 'NA' : 'BL', len }); w.part = { 4: 'SMC.TU0425N-20', 6: 'SMC.TU0604B-20', 8: 'SMC.TU0805B-20' }[od]; pg.wires.push(w); return w; };
  Object.assign(p.parts, Object.fromEntries([['TU0604B-20', 'TU0604', 'Polyurethane tubing 6 mm, blue, 20 m', '38.00'], ['TU0805B-20', 'TU0805', 'Polyurethane tubing 8 mm, blue, 20 m', '52.00'], ['TU0425N-20', 'TU0425', 'Polyurethane tubing 4 mm, natural, 20 m', '29.00'], ['SY5120-5LZD-01', 'SY5120', 'Solenoid valve 5/2, 24 V DC', '96.00']]
    .map(([ord, type, desc, price]) => ['SMC.' + ord, { pn: 'SMC.' + ord, mfr: 'SMC', ord, type, desc, cat: 'Pneumatics', price }])));
  // supply column on the left: air supply, shut-off or check valve, then the header along y 200
  const supply = (pg, valve) => {
    items(pg, [['pn_sup', 32, 252], valve]);
    T(pg, '8', '0.3 m', [32, 248], [32, 244]);
  };
  // ---- pneumatic page 1: air preparation and the clamp station ----
  const pn = newPage('M02', 'PN1', '1', 'Air preparation and clamp station'); pn.type = 'pneu'; p.pages.push(pn);
  supply(pn, ['pn_shut', 32, 236, { tag: 'QM1', desc: 'Main shut-off' }]);
  items(pn, [['pn_frl', 32, 212, { tag: 'AZ1', desc: 'Air preparation', tech: '6 bar' }], ['pn_gauge', 56, 192, { tag: 'PG1', desc: 'Supply' }], ['pn_res', 80, 208, { tag: 'CM1', rot: 180, desc: 'Buffer tank', tech: '5 l' }],
    ['pn_v52', 136, 176, { tag: 'QM2', desc: 'Clamp valve', part: 'SMC.SY5120-5LZD-01' }], ['pn_sil', 132, 188, { tag: 'RZ1' }], ['pn_exh', 140, 188],
    ['pn_fc', 132, 136, { tag: 'RN1', desc: 'Clamp speed' }], ['pn_fc', 176, 136, { tag: 'RN2', desc: 'Release speed' }], ['pn_cyl_da', 164, 84, { tag: 'MM1', desc: 'Clamp', tech: '32 x 50' }],
    ['pn_v53c', 236, 176, { tag: 'QM3', desc: 'Slide valve' }], ['pn_exh', 232, 188], ['pn_exh', 240, 188], ['pn_cyl_dac', 244, 84, { tag: 'MM2', desc: 'Slide', tech: '25 x 160' }],
    ['pn_v32', 320, 176, { tag: 'QM4', desc: 'Ejector valve', actL: 'manual', detent: true }], ['pn_exh', 324, 188], ['pn_qe', 316, 136, { tag: 'QN1', desc: 'Fast release' }], ['pn_exh', 320, 136, { rot: 90 }], ['pn_cyl_sa', 328, 84, { tag: 'MM3', desc: 'Ejector', tech: '16 x 25' }]]);
  T(pn, '8', '0.2 m', [32, 228], [32, 224]); T(pn, '8', '0.3 m', [32, 200], [56, 200]); T(pn, '8', '0.3 m', [56, 200], [80, 200]); T(pn, '8', '0.6 m', [80, 200], [136, 200]);
  T(pn, '8', '1.2 m', [136, 200], [236, 200]); T(pn, '8', '0.9 m', [236, 200], [320, 200]);
  for (const x of [136, 236, 320]) T(pn, '6', '0.2 m', [x, 184], [x, 200]);
  T(pn, '6', '1.5 m', [132, 168], [132, 144]); T(pn, '6', '0.4 m', [132, 128], [132, 104], [152, 104], [152, 92]);
  T(pn, '6', '1.5 m', [140, 168], [140, 156], [176, 156], [176, 144]); T(pn, '6', '0.4 m', [176, 128], [176, 112], [168, 112], [168, 92]);
  T(pn, '6', '2 m', [232, 168], [232, 92]); T(pn, '6', '2 m', [240, 168], [240, 152], [248, 152], [248, 92]);
  T(pn, '4', '1 m', [316, 168], [316, 144]); T(pn, '4', '0.3 m', [316, 128], [316, 92]);
  // ---- pneumatic page 2: handling with vacuum and a rodless slide; pressure switch and sensor on the supply ----
  const pn2 = newPage('M02', 'PN1', '2', 'Handling: vacuum and rodless slide'); pn2.type = 'pneu'; p.pages.push(pn2);
  supply(pn2, ['pn_check', 32, 236, { tag: 'RM1', desc: 'Non-return' }]);
  items(pn2, [['pn_psw', 64, 208, { tag: 'B3', fn: 'M01', loc: 'CP1', rot: 180 }], ['pn_psens', 112, 208, { tag: 'BP1', rot: 180, desc: 'Supply pressure' }],
    ['pn_v22', 168, 176, { tag: 'QM5', desc: 'Vacuum on', actL: 'pilot' }], ['pn_vac', 168, 140, { tag: 'GP1', desc: 'Vacuum generator' }], ['pn_sil', 180, 140, { tag: 'RZ2', rot: 270 }], ['pn_cup', 200, 112, { tag: 'UQ1', desc: 'Suction cup', tech: '30 mm' }],
    ['pn_v53p', 260, 176, { tag: 'QM7', desc: 'Slide valve', actL: 'push', actR: 'sol' }], ['pn_exh', 256, 188], ['pn_exh', 264, 188], ['pn_cyl_rl', 268, 100, { tag: 'MM5', desc: 'Rodless slide', tech: '25 x 300' }],
    ['pn_v53e', 360, 176, { tag: 'QM6', desc: 'Stop valve' }], ['pn_exh', 356, 188], ['pn_exh', 364, 188], ['pn_cyl_mag', 368, 84, { tag: 'MM4', desc: 'Stop', tech: '20 x 25' }]]);
  const v22 = pn2.items.find(i => i.tag === 'QM5'); v22.cl = valveConns(VALVES.pn_v22, v22).map(c => c[2]);
  T(pn2, '8', '0.6 m', [32, 228], [32, 200], [64, 200]); T(pn2, '8', '0.5 m', [64, 200], [112, 200]); T(pn2, '8', '0.3 m', [112, 200], [140, 200]);
  T(pn2, '8', '0.3 m', [140, 200], [168, 200]); T(pn2, '8', '0.9 m', [168, 200], [260, 200]); T(pn2, '8', '0.9 m', [260, 200], [360, 200]); T(pn2, '4', '0.4 m', [140, 200], [140, 176]);
  T(pn2, '6', '0.2 m', [168, 184], [168, 200]); T(pn2, '6', '0.2 m', [260, 184], [260, 200]); T(pn2, '6', '0.2 m', [360, 184], [360, 200]); T(pn2, '6', '0.4 m', [168, 168], [168, 148]);
  T(pn2, '6', '0.6 m', [168, 132], [168, 96], [200, 96], [200, 104]);
  T(pn2, '6', '2.5 m', [256, 168], [256, 108]); T(pn2, '6', '2.5 m', [264, 168], [264, 152], [272, 152], [272, 108]);
  T(pn2, '6', '1.8 m', [356, 168], [356, 92]); T(pn2, '6', '1.8 m', [364, 168], [364, 152], [372, 152], [372, 92]);
  pn2.items.push({ id: uid(), sym: 'text', x: 32, y: 36, text: 'The pressure switch on this page is the same device as its contact on page =M01+CP1/7.', size: 2.5 });
}
