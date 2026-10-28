// ---------- demo building block: home wiring (also a test fixture) ----------
function demoHome() {
  const p = newProject(); p.name = 'Home wiring demo'; p.author = 'Homeowner';
  p.settings = Object.assign({}, DEF_SETTINGS, { terms: 'home', tagStyle: 'home', industrial: false, reportCols: 'plain' });
  const pnl = newPage('PANEL', '', '1', 'Main panel');
  const c1 = newPage('CKT1', '', '1', 'Kitchen and dining lights');
  const c2 = newPage('CKT2', '', '1', 'Kitchen and dining outlets');
  const c3 = newPage('CKT3', '', '1', 'Bathroom');
  const c4 = newPage('CKT4', '', '1', 'Dryer');
  p.pages = [pnl, c1, c2, c3, c4]; P = ensureProject(p);
  const I = (pg, sym, x, y, o = {}) => {
    const d = SYM[sym];
    const it = Object.assign({ id: uid(), sym, x, y, rot: 0, fn: pg.fn, loc: '', tag: '', role: d.role, cl: d.conns.map(c => c[2]), desc: '' }, o);
    if (!d.prefix) { delete it.fn; delete it.loc; }
    if (d.brk) { it.amps = it.amps || d.amps; it.panel = 'PNL1'; }
    pg.items.push(it); return it;
  };
  const W = (pg, ...pts) => pg.wires.push({ id: uid(), pts });
  // panel
  I(pnl, 'rpnl', 100, 80, { tag: 'PNL1', desc: 'Main panel, 200 A', part: 'HOM2040M200PC' });
  I(pnl, 'rnbar', 96, 140); I(pnl, 'rgbar', 168, 140);
  W(pnl, [104, 92], [104, 140]); W(pnl, [112, 92], [112, 124], [168, 124], [168, 140]);
  pnl.items.push({ id: uid(), sym: 'text', x: 220, y: 70, text: 'Service: 200 A, 120/240 V\nMain bonding jumper at panel', size: 3.5 });
  // circuit 1: lights, 3-way between kitchen and dining
  I(c1, 'rbrk1', 40, 48, { tag: 'BRK1', slot: '1', amps: '15' });
  W(c1, [40, 56], [40, 64], [160, 64]);
  I(c1, 'rswt', 80, 96, { tag: 'SWT1', loc: 'Kitchen', desc: 'Kitchen light' });
  W(c1, [80, 64], [80, 88]);
  I(c1, 'rlgt', 80, 136, { tag: 'LGT1', loc: 'Kitchen', desc: 'Ceiling light' });
  W(c1, [80, 104], [80, 128]);
  I(c1, 'rsw3', 140, 96, { tag: 'SWT2', loc: 'Kitchen', desc: 'Dining light' });
  W(c1, [140, 64], [140, 88]);
  I(c1, 'rsw3', 140, 152, { tag: 'SWT3', loc: 'Dining', rot: 180, desc: 'Dining light' });
  W(c1, [136, 104], [136, 144]); W(c1, [144, 104], [144, 144]);
  I(c1, 'rlgt', 140, 184, { tag: 'LGT2', loc: 'Dining', desc: 'Chandelier' });
  W(c1, [140, 160], [140, 176]);
  I(c1, 'rnbar', 40, 212);
  W(c1, [56, 212], [180, 212]); W(c1, [80, 144], [80, 212]); W(c1, [140, 192], [140, 212]);
  // circuit 2: GFCI protecting kitchen and dining outlets
  I(c2, 'rbrk1', 40, 48, { tag: 'BRK2', slot: '2', amps: '20' });
  W(c2, [40, 56], [40, 64], [76, 64], [76, 92]);
  I(c2, 'routgf', 80, 100, { tag: 'OUT1', loc: 'Kitchen', desc: 'Counter, left of sink' });
  I(c2, 'rout', 120, 100, { tag: 'OUT2', loc: 'Kitchen', desc: 'Counter, right of sink' });
  W(c2, [84, 92], [84, 80], [120, 80], [120, 92]);
  W(c2, [84, 108], [84, 120], [120, 120], [120, 108]);
  I(c2, 'rout', 160, 100, { tag: 'OUT3', loc: 'Dining', desc: 'Buffet wall' });
  W(c2, [160, 92], [160, 84], [120, 84]); W(c2, [160, 108], [160, 116], [120, 116]);
  I(c2, 'rnbar', 40, 212);
  W(c2, [56, 212], [100, 212]); W(c2, [76, 108], [76, 212]);
  // circuit 3: bathroom on a GFCI breaker
  I(c3, 'rbrkgf', 40, 48, { tag: 'BRK3', slot: '3', amps: '20' });
  W(c3, [40, 56], [40, 64], [160, 64]);
  W(c3, [48, 56], [48, 52], [176, 52], [176, 212], [64, 212]);
  I(c3, 'rswt', 80, 96, { tag: 'SWT4', loc: 'Bath', desc: 'Vanity light' });
  W(c3, [80, 64], [80, 88]);
  I(c3, 'rlgt', 80, 136, { tag: 'LGT3', loc: 'Bath', desc: 'Vanity light' });
  W(c3, [80, 104], [80, 128]); W(c3, [80, 144], [80, 212]);
  I(c3, 'rswt', 132, 96, { tag: 'SWT5', loc: 'Bath', desc: 'Exhaust fan' });
  W(c3, [132, 64], [132, 88]);
  I(c3, 'rfan', 132, 136, { tag: 'FAN1', loc: 'Bath', desc: 'Exhaust fan with light' });
  W(c3, [132, 104], [132, 112], [128, 112], [128, 128]); W(c3, [132, 112], [136, 112], [136, 128]);
  W(c3, [132, 144], [132, 212]);
  // circuit 4: dryer, 240 V
  I(c4, 'rbrk2', 40, 48, { tag: 'BRK4', slot: '5', amps: '30' });
  I(c4, 'rout240', 100, 100, { tag: 'OUT4', loc: 'Laundry', desc: 'Dryer, NEMA 14-30' });
  W(c4, [36, 56], [36, 72], [96, 72], [96, 92]); W(c4, [44, 56], [44, 64], [104, 64], [104, 92]);
  I(c4, 'rnbar', 40, 212);
  W(c4, [56, 212], [100, 212]); W(c4, [100, 108], [100, 212]);
  // US wire colors
  for (let pass = 0; pass < 3; pass++) for (const pg of p.pages) for (const w of pg.wires) { const a = autoWire(pg, w.pts); if (a) { w.color = a.color === 'BK' && w.color ? w.color : a.color; w.awg = pg === c4 ? '10' : pg === c2 || pg === c3 ? '12' : '14'; } }
  // floor plan
  const lv = { id: uid(), name: 'Main floor', rooms: [], places: [], image: null, scale: 48 }; p.levels = [lv];
  const R = (name, x0, y0, x1, y1) => { const r = { id: uid(), name, pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }; lv.rooms.push(r); return r; };
  const kitchen = R('Kitchen', 40, 40, 160, 140); R('Dining', 160, 40, 280, 140); R('Bath', 40, 140, 120, 230); R('Laundry', 120, 140, 200, 230); R('Living', 200, 140, 360, 230);
  const byTag = t => [...allItems()].find(i => i.tag === t);
  const PL = (tag, x, y, rot = 0) => { const it = byTag(tag); if (it) lv.places.push({ id: uid(), item: it.id, x, y, rot }); };
  PL('SWT1', 44, 58, 90); PL('SWT2', 44, 82, 90); PL('LGT1', 100, 90); PL('SWT3', 276, 76, 270); PL('LGT2', 220, 90);
  PL('OUT1', 70, 136); PL('OUT2', 130, 136); PL('OUT3', 252, 44, 180);
  PL('LGT3', 80, 176); PL('FAN1', 80, 206); PL('SWT4', 116, 150, 270); PL('SWT5', 116, 170, 270);
  PL('OUT4', 160, 226); PL('PNL1', 128, 222);
  const smk = { id: uid(), sym: 'rsmk', x: 0, y: 0, rot: 0, fn: '', loc: 'Living', tag: 'SMK1', role: 'main', cl: SYM.rsmk.conns.map(c => c[2]), desc: 'Hallway smoke/CO' };
  p.pool.push(smk); lv.places.push({ id: uid(), item: smk.id, x: 280, y: 185, rot: 0 });
  p.pages.push(newFloorPage(lv.id, '1', 'Main floor', 'level'));
  p.pages.push(newFloorPage(lv.id, '2', 'Kitchen', 'room', { room: kitchen.id }));
  return p;
}
