// ---------- demo project ----------
function buildDemo() {
  const p = newProject(); p.name = 'Pump station demo'; p.company = 'OpenSchem'; p.author = 'Engineering';
  const pg1 = newPage('M01', 'CP1', '1', 'Main power'); const pg2 = newPage('M01', 'CP1', '2', 'Pump control');
  p.pages = [pg1, pg2]; P = p;
  const I = (pg, sym, x, y, o = {}) => { const d = SYM[sym]; const it = Object.assign({ id: uid(), sym, x, y, rot: 0, fn: 'M01', loc: 'CP1', tag: '', role: d.role, cl: d.conns.map(c => c[2]), desc: '' }, o); if (sym === 'ip' || sym === 'pe') { delete it.fn; delete it.loc; } pg.items.push(it); return it; };
  const W = (pg, ...pts) => pg.wires.push({ id: uid(), pts });
  // page 1: power
  [['L1', 96], ['L2', 104], ['L3', 112], ['PE', 128]].forEach(([t, x]) => I(pg1, 'term', x, 44, { tag: 'X0', rot: 180, tn: t, desc: 'Incoming supply', part: t === 'PE' ? 'PT 4-PE' : 'PT 4' }));
  I(pg1, 'cb3', 104, 72, { tag: 'Q1', desc: 'Main breaker', part: 'GV2ME10', tech: '4-6.3 A' });
  I(pg1, 'mc3', 104, 104, { tag: 'K1' });
  I(pg1, 'ol3', 104, 136, { tag: 'F1', desc: 'Overload', tech: '4-6 A', part: 'LRD10' });
  I(pg1, 'motor', 104, 172, { tag: 'M1', desc: 'Pump motor', tech: '2.2 kW 400 V' });
  for (const x of [96, 104, 112]) { W(pg1, [x, 48], [x, 64]); W(pg1, [x, 80], [x, 96]); W(pg1, [x, 112], [x, 128]); W(pg1, [x, 144], [x, 160]); }
  W(pg1, [128, 48], [128, 152], [116, 152], [116, 160]);
  I(pg1, 'fuse', 176, 72, { tag: 'F2', desc: 'Control fuse', tech: '2 A', part: 'DF101' }); I(pg1, 'fuse', 200, 72, { tag: 'F3', desc: 'Control fuse', tech: '2 A', part: 'DF101' });
  W(pg1, [96, 60], [176, 60], [176, 64]); W(pg1, [104, 56], [200, 56], [200, 64]);
  W(pg1, [176, 80], [176, 96]); W(pg1, [200, 80], [200, 96]);
  I(pg1, 'ip', 176, 96, { ipName: 'L11', rot: 180 }); I(pg1, 'ip', 200, 96, { ipName: 'L21', rot: 180 });
  // page 2: control
  I(pg2, 'ip', 40, 40, { ipName: 'L11', rot: 270 }); W(pg2, [40, 40], [168, 40]);
  I(pg2, 'ip', 40, 232, { ipName: 'L21', rot: 270 }); W(pg2, [40, 232], [136, 232]);
  W(pg2, [72, 40], [72, 72]);
  I(pg2, 'estop', 72, 80, { tag: 'S0', desc: 'Emergency stop', part: 'XB5AS8445' });
  W(pg2, [72, 88], [72, 96]);
  I(pg2, 'pbnc', 72, 104, { tag: 'S1', desc: 'Stop', part: 'XB5AA42' });
  W(pg2, [72, 112], [72, 120]);
  I(pg2, 'pbno', 72, 128, { tag: 'S2', desc: 'Start', part: 'XB5AA31' });
  I(pg2, 'no', 104, 128, { tag: 'K1', cl: ['13', '14'] });
  W(pg2, [72, 116], [104, 116], [104, 120]);
  W(pg2, [104, 136], [104, 144], [72, 144]);
  W(pg2, [72, 136], [72, 152]);
  I(pg2, 'coil', 72, 160, { tag: 'K1', desc: 'Pump contactor', part: 'LC1D09P7', tech: '230 V AC' });
  W(pg2, [72, 168], [72, 176]);
  I(pg2, 'olnc', 72, 184, { tag: 'F1' });
  W(pg2, [72, 192], [72, 232]);
  W(pg2, [136, 40], [136, 72]);
  I(pg2, 'no', 136, 80, { tag: 'K1', cl: ['23', '24'] });
  I(pg2, 'term', 136, 92, { tag: 'X1', tn: '1', desc: 'Door lamp', part: 'PT 2.5' });
  I(pg2, 'lamp', 136, 104, { tag: 'P1', desc: 'Pump running', part: 'XB5AVB3', tech: '24 V' });
  I(pg2, 'term', 136, 116, { tag: 'X1', tn: '2', desc: 'Door lamp', part: 'PT 2.5' });
  W(pg2, [136, 120], [136, 232]);
  W(pg2, [168, 40], [200, 40], [200, 72]);
  I(pg2, 'no', 200, 80, { tag: 'K1', cl: ['33', '34'] });
  W(pg2, [200, 88], [200, 92]);
  I(pg2, 'plcin', 200, 100, { tag: 'A1', addr: '%I0.0', desc: 'Pump running fb' });
  pg2.items.push({ id: uid(), sym: 'text', x: 252, y: 60, text: 'Pump P-101 local start/stop\nE-stop wired in safety circuit', size: 3.5 });
  return p;
}
