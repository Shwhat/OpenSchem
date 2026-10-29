// ---------- pneumatics (ISO 1219-1) ----------
// Pneumatic symbols are the same in IEC and NFPA projects; only their device letters follow the project standard.
// Ports are connection points numbered to ISO 5599 (1 supply, 2 and 4 outlets, 3 and 5 exhaust, 12 and 14 pilots).
// Tubes are their own line type: a connection with tube: true, drawn on pneumatic pages (page type 'pneu') with the
// Tube tool, with outside diameter, color, length and part number. Valve solenoids on electrical pages carry the
// valve's tag and cross-reference it.
const PN_CAT = { air: 'Pneumatic: air supply', valve: 'Pneumatic: valves', act: 'Pneumatic: actuators', vac: 'Pneumatic: vacuum and sensors' };
const PSYM = o => Object.assign({ pneu: true, ind: true, fixed: true }, o);
const tri = (x, y, dir, filled) => { const d = dir === 'up' ? `M${x},${y - 2}L${x - 1.8},${y + 1.2}L${x + 1.8},${y + 1.2}Z` : `M${x},${y + 2}L${x - 1.8},${y - 1.2}L${x + 1.8},${y - 1.2}Z`; return `<path d="${d}"${filled ? ' fill="#000"' : ''}/>`; };
const arrowHead = (a, b, s = 1.4) => { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const p = d => [r2(b[0] - s * Math.cos(ang + d)), r2(b[1] - s * Math.sin(ang + d))]; const l = p(0.45), r = p(-0.45); return `M${b[0]},${b[1]}L${l[0]},${l[1]}L${r[0]},${r[1]}Z`; };

// ---------- directional valves ----------
// boxes are 12 x 12 mm. 2-position valves: actuated box at x -12, normal box (with the ports) at x 0.
// 3-position valves: boxes at -12, 0 (center, with the ports) and 12. Flows use port positions in the box:
// top T-4 / T0 / T4 and bottom B-4 / B0 / B4.
const VALVES = {
  pn_v22: { name: 'Valve 2/2', n: 2, ports: [['T0', '2'], ['B0', '1']], pos: [[['a', 'B0', 'T0']], [['t', 'B0'], ['t', 'T0']]], pilot: ['12', '10'] },
  pn_v32: { name: 'Valve 3/2', n: 2, ports: [['T-4', '2'], ['B-4', '1'], ['B4', '3']], pos: [[['a', 'B-4', 'T-4'], ['t', 'B4']], [['a', 'T-4', 'B4'], ['t', 'B-4']]], pilot: ['12', '10'] },
  pn_v52: { name: 'Valve 5/2', n: 2, ports: [['T-4', '4'], ['T4', '2'], ['B-4', '5'], ['B0', '1'], ['B4', '3']],
    pos: [[['a', 'B0', 'T-4'], ['a', 'T4', 'B4'], ['t', 'B-4']], [['a', 'B0', 'T4'], ['a', 'T-4', 'B-4'], ['t', 'B4']]], pilot: ['14', '12'] },
  pn_v53c: { name: 'Valve 5/3, closed center', n: 3, ports: [['T-4', '4'], ['T4', '2'], ['B-4', '5'], ['B0', '1'], ['B4', '3']],
    pos: [[['a', 'B0', 'T-4'], ['a', 'T4', 'B4'], ['t', 'B-4']], [['t', 'T-4'], ['t', 'T4'], ['t', 'B-4'], ['t', 'B0'], ['t', 'B4']], [['a', 'B0', 'T4'], ['a', 'T-4', 'B-4'], ['t', 'B4']]], pilot: ['14', '12'] },
  pn_v53e: { name: 'Valve 5/3, exhaust center', n: 3, ports: [['T-4', '4'], ['T4', '2'], ['B-4', '5'], ['B0', '1'], ['B4', '3']],
    pos: [[['a', 'B0', 'T-4'], ['a', 'T4', 'B4'], ['t', 'B-4']], [['a', 'T-4', 'B-4'], ['a', 'T4', 'B4'], ['t', 'B0']], [['a', 'B0', 'T4'], ['a', 'T-4', 'B-4'], ['t', 'B4']]], pilot: ['14', '12'] },
  pn_v53p: { name: 'Valve 5/3, pressure center', n: 3, ports: [['T-4', '4'], ['T4', '2'], ['B-4', '5'], ['B0', '1'], ['B4', '3']],
    pos: [[['a', 'B0', 'T-4'], ['a', 'T4', 'B4'], ['t', 'B-4']], [['a', 'B0', 'T-4'], ['a', 'B0', 'T4'], ['t', 'B-4'], ['t', 'B4']], [['a', 'B0', 'T4'], ['a', 'T-4', 'B-4'], ['t', 'B4']]], pilot: ['14', '12'] },
};
const ACTUATORS = [['sol', 'Solenoid'], ['spring', 'Spring'], ['pilot', 'Pilot (air)'], ['manual', 'Manual (lever)'], ['push', 'Push button'], ['none', 'None']];
const portXY = (cx, p) => [cx + Number(p.slice(1)), p[0] === 'T' ? -6 : 6];
function valveBoxSVG(cx, flows) {
  let s = `<rect x="${cx - 6}" y="-6" width="12" height="12"/>`; let fl = '';
  for (const f of flows) {
    if (f[0] === 'a') { const a = portXY(cx, f[1]), b = portXY(cx, f[2]); const b2 = [b[0], b[1] + (b[1] < 0 ? 0.6 : -0.6)]; s += `<path d="M${a[0]},${a[1]}L${b2[0]},${b2[1]}"/>`; fl += arrowHead(a, b2); }
    else { const [x, y] = portXY(cx, f[1]); const y2 = y < 0 ? y + 2.4 : y - 2.4; s += `<path d="M${x},${y}V${y2}M${x - 1.4},${y2}H${x + 1.4}"/>`; }
  }
  return s + (fl ? `<path d="${fl}" fill="#000" stroke-width="0.2"/>` : '');
}
// an actuator drawn outward from the valve edge at x = e; dir -1 to the left, +1 to the right
function actuatorSVG(kind, e, dir) {
  const X = v => r2(e + dir * v);
  if (kind === 'sol') return `<path d="M${X(0)},-2.5H${X(4)}V2.5H${X(0)}M${X(0.6)},2.5L${X(3.4)},-2.5"/>`;
  if (kind === 'spring') return `<path d="M${X(0)},0L${X(0.8)},-2.4L${X(1.6)},2.4L${X(2.4)},-2.4L${X(3.2)},2.4L${X(4)},0"/>`;
  if (kind === 'pilot') return `<path d="M${X(4)},0H${X(10)}" stroke-dasharray="1,0.8"/><path d="M${X(0.4)},0L${X(3.4)},-1.8V1.8Z"/>`;
  if (kind === 'manual') return `<path d="M${X(0)},0H${X(3)}M${X(3)},-2.4L${X(5)},2.4"/>`;
  if (kind === 'push') return `<path d="M${X(0)},0H${X(3)}M${X(3)},-2.4V2.4"/>`;
  return '';
}
const valveEdges = v => v.n === 3 ? [-18, 18] : [-18, 6];
const valveDefaults = v => v.n === 3 ? { actL: 'sol', actR: 'sol' } : { actL: 'sol', actR: 'spring' };
function valveConns(v, it) {
  const out = v.ports.map(([p, lab]) => { const [x, y] = portXY(0, p); return [x, y < 0 ? -8 : 8, lab]; });
  const [l, r] = valveEdges(v); const a = Object.assign(valveDefaults(v), it || {});
  if (a.actL === 'pilot') out.push([l - 10, 0, v.pilot[0]]);
  if (a.actR === 'pilot') out.push([r + 10, 0, v.pilot[1]]);
  return out;
}
for (const [k, v] of Object.entries(VALVES)) {
  SYM[k] = PSYM({ name: v.name, cat: PN_CAT.valve, ip: 'QM', np: 'SOL', role: 'main', valve: v,
    conns: valveConns(v), box: [-29, -8, valveEdges(v)[1] + 11, 8],
    connsOf: it => valveConns(v, it).map((c, i) => [c[0], c[1], (it.cl || [])[i] ?? c[2]]),
    init: it => Object.assign(it, valveDefaults(v)),
    draw: it => {
      const a = Object.assign(valveDefaults(v), it || {}); const xs = v.n === 3 ? [-12, 0, 12] : [-12, 0]; const [l, r] = valveEdges(v);
      // the positions are drawn left to right; the normal position (with the ports) is the right box of a 2-position valve
      let s = xs.map((cx, i) => valveBoxSVG(cx, v.pos[i])).join('');
      s += v.ports.map(([p]) => { const [x, y] = portXY(0, p); return `<path d="M${x},${y}V${y < 0 ? -8 : 8}"/>`; }).join('');
      s += actuatorSVG(a.actL, l, -1) + actuatorSVG(a.actR, r, 1);
      if (v.n === 3) s += actuatorSVG('spring', l - (a.actL === 'none' ? 0 : 4.6), -1).replace(/^<path/, '<path stroke-width="0.25"') + actuatorSVG('spring', r + (a.actR === 'none' ? 0 : 4.6), 1).replace(/^<path/, '<path stroke-width="0.25"');
      if (a.detent) { const y = -7.6, x0 = l - 6; s += `<path d="M${x0},${y}H${x0 + 7}M${x0 + 1.4},${y}L${x0 + 2.4},${y - 1.4}L${x0 + 3.4},${y}M${x0 + 3.8},${y}L${x0 + 4.8},${y - 1.4}L${x0 + 5.8},${y}"/>`; }
      return s;
    },
    propsHTML: (it, row) => {
      const a = Object.assign(valveDefaults(v), it); const opt = cur => ACTUATORS.map(([k2, l2]) => `<option value="${k2}" ${cur === k2 ? 'selected' : ''}>${l2}</option>`).join('');
      return row('it.actL', `Left actuator (${v.pilot[0]})`, '', 'select', opt(a.actL)) + row('it.actR', `Right actuator (${v.pilot[1]})`, '', 'select', opt(a.actR)) +
        `<div class="prow"><label>Detent</label><input type="checkbox" data-k="it.detent" ${it.detent ? 'checked' : ''} style="width:auto"></div>`;
    },
    // a pilot actuator adds a pilot port
    onChange: (it, key) => { if (key === 'actL' || key === 'actR') it.cl = valveConns(v, it).map(c => c[2]); if (key === 'detent') it.detent = it.detent === true || it.detent === 'true' || undefined; },
  });
}

// ---------- cylinders ----------
const cylBody = '<rect x="-17" y="-4" width="25" height="8"/>';
const cylPorts = two => '<path d="M-12,8V4' + (two ? 'M4,8V4' : '') + '"/>';
Object.assign(SYM, {
  pn_cyl_sa: PSYM({ name: 'Cylinder, single acting', cat: PN_CAT.act, ip: 'MM', np: 'CYL', role: 'main',
    conns: [[-12, 8, 'A']], box: [-17, -5, 15, 8],
    draw: () => `${cylBody}${cylPorts(false)}<path d="M-9,-4V4M-9,0H14M-8,0L-7,-2.4L-5.4,2.4L-3.8,-2.4L-2.2,2.4L-0.6,-2.4L1,2.4L2.6,-2.4L4.2,2.4L5.8,-2.4L7,0"/>` }),
  pn_cyl_da: PSYM({ name: 'Cylinder, double acting', cat: PN_CAT.act, ip: 'MM', np: 'CYL', role: 'main',
    conns: [[-12, 8, 'A'], [4, 8, 'B']], box: [-17, -5, 15, 8],
    draw: () => `${cylBody}${cylPorts(true)}<path d="M-9,-4V4M-9,0H14"/>` }),
  pn_cyl_dac: PSYM({ name: 'Cylinder, cushioned', cat: PN_CAT.act, ip: 'MM', np: 'CYL', role: 'main',
    conns: [[-12, 8, 'A'], [4, 8, 'B']], box: [-17, -7, 15, 8],
    draw: () => `${cylBody}${cylPorts(true)}<path d="M-9,-4V4M-9,0H14"/><rect x="-12" y="-1.6" width="3" height="3.2"/><rect x="-9" y="-1.6" width="3" height="3.2"/><path d="M-15,-6L-11,-2M4,-6L8,-2M-11,-2L-12.6,-2.2M-11,-2L-11.2,-3.6M8,-2L6.4,-2.2M8,-2L7.8,-3.6"/>` }),
  pn_cyl_mag: PSYM({ name: 'Cylinder, magnetic piston', cat: PN_CAT.act, ip: 'MM', np: 'CYL', role: 'main',
    conns: [[-12, 8, 'A'], [4, 8, 'B']], box: [-17, -5, 15, 8],
    draw: () => `${cylBody}${cylPorts(true)}<path d="M-9,-4V4M-9,0H14"/><rect x="-10.6" y="-4" width="1.2" height="8" fill="#000"/>` }),
  pn_cyl_rl: PSYM({ name: 'Cylinder, rodless', cat: PN_CAT.act, ip: 'MM', np: 'CYL', role: 'main',
    conns: [[-12, 8, 'A'], [4, 8, 'B']], box: [-17, -8, 9, 8],
    draw: () => `<rect x="-17" y="-3" width="25" height="7"/>${cylPorts(true)}<path d="M-5,-3V4"/><rect x="-8" y="-7" width="6" height="4"/>` }),
});

// ---------- air supply, air preparation, flow and pressure devices, vacuum ----------
Object.assign(SYM, {
  pn_sup: PSYM({ name: 'Air supply', cat: PN_CAT.air, prefix: null, role: 'mark',
    conns: [[0, -4, '']], box: [-3.4, -4, 3.4, 3.4], draw: () => `<circle cx="0" cy="0" r="3.4"/><path d="M0,-4V-3.4"/>${tri(0, -0.2, 'up', false)}` }),
  pn_exh: PSYM({ name: 'Exhaust', cat: PN_CAT.air, prefix: null, role: 'mark',
    conns: [[0, -4, '']], box: [-2.4, -4, 2.4, 2], draw: () => '<path d="M0,-4V-1M0,2L-2.2,-1H2.2Z"/>' }),
  pn_sil: PSYM({ name: 'Silencer', cat: PN_CAT.air, ip: 'RZ', np: 'MUF', role: 'main',
    conns: [[0, -4, '']], box: [-2.6, -4, 2.6, 4], draw: () => '<path d="M0,-4V-1.6M-2.4,-1.6H2.4L0,4Z"/><path d="M-1.6,0H1.6M-0.8,1.6H0.8" stroke-width="0.25"/>' }),
  pn_frl: PSYM({ name: 'Filter, regulator, lubricator', cat: PN_CAT.air, ip: 'AZ', np: 'FRL', role: 'main',
    conns: [[0, 12, '1'], [0, -12, '2']], box: [-6, -12, 6, 12],
    draw: () => '<rect x="-5.4" y="-9.6" width="10.8" height="19.2" stroke-dasharray="1.2,0.8" stroke-width="0.25"/><path d="M0,12V8.4M0,2.6V1.8M0,-1.8V-2.6M0,-8.4V-12M0,8.4L-2.9,5.5L0,2.6L2.9,5.5ZM0,-2.6L-2.9,-5.5L0,-8.4L2.9,-5.5Z"/><path d="M-2.9,5.5H2.9" stroke-dasharray="0.8,0.6" stroke-width="0.25"/><rect x="-1.8" y="-1.8" width="3.6" height="3.6"/><path d="M-1.4,1.4L1.6,-1.6" stroke-width="0.25"/><path d="M0,-7.1L-0.8,-5.3H0.8Z" fill="#000" stroke-width="0.2"/>' }),
  pn_gauge: PSYM({ name: 'Pressure gauge', cat: PN_CAT.air, ip: 'PG', np: 'PG', role: 'main',
    conns: [[0, 8, '1']], box: [-3.6, -4.6, 3.6, 8], draw: () => `<circle cx="0" cy="-1" r="3.6"/><path d="M0,8V2.6M-1.8,0.6L1.8,-2.6"/><path d="${arrowHead([-1.8, 0.6], [1.8, -2.6], 1.1)}" fill="#000" stroke-width="0.2"/>` }),
  pn_shut: PSYM({ name: 'Shut-off valve', cat: PN_CAT.valve, ip: 'QM', np: 'V', role: 'main',
    conns: [[0, -8, '2'], [0, 8, '1']], box: [-2.6, -8, 2.6, 8], draw: () => '<path d="M0,-8V-4M0,8V4M-2.6,-4H2.6L-2.6,4H2.6Z"/>' }),
  pn_check: PSYM({ name: 'Check valve', cat: PN_CAT.valve, ip: 'RM', np: 'CV', role: 'main',
    conns: [[0, -8, '2'], [0, 8, '1']], box: [-3, -8, 3, 8], draw: () => '<path d="M0,-8V-2.6M0,8V1.6M-2.8,-3.4L0,1.6L2.8,-3.4"/><circle cx="0" cy="-0.8" r="1.8"/>' }),
  pn_fc: PSYM({ name: 'One-way flow control', cat: PN_CAT.valve, ip: 'RN', np: 'FC', role: 'main',
    conns: [[0, -8, '2'], [0, 8, '1']], box: [-5, -8, 9, 8],
    draw: () => `<rect x="-4.4" y="-6.4" width="12.8" height="12.8" stroke-dasharray="1.2,0.8" stroke-width="0.25"/><path d="M0,-8V-3M0,8V3M-1.6,-3A5,5 0 0 1 -1.6,3M1.6,-3A5,5 0 0 0 1.6,3M0,-5.4H5.6V-2.8M0,5.4H5.6V2M3.4,-3.4L5.6,1L7.8,-3.4M-3.4,3.4L3,-3"/><circle cx="5.6" cy="-1.4" r="1.4"/><path d="${arrowHead([-3.4, 3.4], [3, -3], 1.2)}" fill="#000" stroke-width="0.2"/>` }),
  pn_qe: PSYM({ name: 'Quick exhaust valve', cat: PN_CAT.valve, ip: 'QN', np: 'QEV', role: 'main',
    conns: [[0, -8, '2'], [0, 8, '1'], [8, 0, '3']], box: [-4.4, -8, 8, 8],
    draw: () => '<rect x="-4.4" y="-4.4" width="8.8" height="8.8"/><path d="M0,-8V-4.4M0,8V4.4M4.4,0H8M-2.6,-1.4H2.6M-2.6,1.4H2.6"/><circle cx="0" cy="0" r="1.2"/>' }),
  pn_vac: PSYM({ name: 'Vacuum generator', cat: PN_CAT.vac, ip: 'GP', np: 'VG', role: 'main',
    conns: [[0, 8, '1'], [0, -8, '2'], [8, 0, '3']], box: [-5, -8, 8, 8],
    draw: () => `<rect x="-5" y="-5" width="10" height="10"/><path d="M0,8V5M0,-8V-5M5,0H8M0,5V1.4M-1.6,-1.4L1.6,-1.4L0,1.4ZM0,-1.4V-5M1.6,0H5"/>` }),
  pn_cup: PSYM({ name: 'Suction cup', cat: PN_CAT.vac, ip: 'UQ', np: 'SC', role: 'main',
    conns: [[0, -8, '1']], box: [-5, -8, 5, 4], draw: () => '<path d="M0,-8V0M-5,4L-2,0H2L5,4"/>' }),
  pn_psw: PSYM({ name: 'Pressure switch (pneumatic)', cat: PN_CAT.vac, ip: 'B', np: 'PS', role: 'sl',
    conns: [[0, 8, '1']], box: [-5, -5, 7, 8],
    draw: () => '<rect x="-5" y="-5" width="10" height="9"/><path d="M0,8V4M-3,2V-0.6H-1.4M-3,-3V-0.8L-0.6,-2.4M1.4,-1.6H5.4" stroke-width="0.3"/>', texts: () => [[2.6, 2.6, 'p', 2.2]] }),
  pn_psens: PSYM({ name: 'Pressure sensor', cat: PN_CAT.vac, ip: 'BP', np: 'PT', role: 'main',
    conns: [[0, 8, '1']], box: [-5, -5, 7, 8],
    draw: () => '<rect x="-5" y="-5" width="10" height="9"/><path d="M0,8V4M5,-0.5H7.6M-3,2.4L3,-3.2"/>', texts: () => [[-1.8, -1.2, 'p', 2.2], [2, 2.6, 'U', 2]] }),
  pn_res: PSYM({ name: 'Reservoir', cat: PN_CAT.air, ip: 'CM', np: 'RES', role: 'main',
    conns: [[0, 8, '1']], box: [-9, -4.4, 9, 8], draw: () => '<rect x="-9" y="-4.4" width="18" height="8.8" rx="4.2"/><path d="M0,8V4.4"/>' }),
});
const PN_ORDER = ['pn_sup', 'pn_exh', 'pn_sil', 'pn_frl', 'pn_gauge', 'pn_res', 'pn_v22', 'pn_v32', 'pn_v52', 'pn_v53c', 'pn_v53e', 'pn_v53p', 'pn_shut', 'pn_check', 'pn_fc', 'pn_qe',
  'pn_cyl_sa', 'pn_cyl_da', 'pn_cyl_dac', 'pn_cyl_mag', 'pn_cyl_rl', 'pn_vac', 'pn_cup', 'pn_psw', 'pn_psens'];
SYMORDER.push(...PN_ORDER);
for (const k of PN_ORDER) stdLetters(SYM[k]);

// ---------- page types: schematic, single-line, pneumatic ----------
const PAGE_TYPES = [['', 'Schematic'], ['sl', 'Single-line'], ['pneu', 'Pneumatic']];

// ---------- tubes ----------
const TUBE_OD = [['4', '4 mm'], ['6', '6 mm'], ['8', '8 mm'], ['10', '10 mm'], ['12', '12 mm'], ['1/8', '1/8 in'], ['1/4', '1/4 in'], ['3/8', '3/8 in'], ['1/2', '1/2 in']];
const TUBE_COLORS = [['', '(none)'], ['BL', 'Blue'], ['BK', 'Black'], ['NA', 'Natural'], ['RD', 'Red'], ['GN', 'Green'], ['YL', 'Yellow'], ['WH', 'White'], ['SI', 'Silver']];
const TUBE_RGB = { BL: '#1f5fbf', BK: '#222', NA: '#b9a77c', RD: '#c62828', GN: '#2e7d32', YL: '#c9a400', WH: '#9aa5b3', SI: '#8a96a3' };
const isPneuPage = pg => !!pg && !pg.kind && !pg.report && pg.type === 'pneu';
const tubeOdMm = od => { const s = String(od || ''); if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return a / b * 25.4; } return parseFloat(s) || 0; };
const tubeOdLabel = od => (TUBE_OD.find(o => o[0] === String(od)) || [od, od ? od + ' mm' : '(no size)'])[1];
function nextTubeTag() { let max = 0; for (const pg of P.pages) for (const w of pg.wires) if (w.tube) { const m = /^T(\d+)$/.exec(w.tag || ''); if (m) max = Math.max(max, +m[1]); } return 'T' + (max + 1); }
function newTubeProps() { return { tube: true, tag: nextTubeTag(), od: PREFS.tubeOd || '6', color: PREFS.tubeColor || 'BL' }; }
function tubeEndName(pg, w, i) {
  const t = traverse(pg, i ? w.pts[w.pts.length - 1] : w.pts[0], w.id);
  return t.join(', ');
}
// the tubing list: one row per tube, grouped by outside diameter
function tubeData() {
  const out = [];
  for (const pg of P.pages) for (const w of pg.wires) if (w.tube) out.push({ w, pg, from: tubeEndName(pg, w, 0), to: tubeEndName(pg, w, 1) });
  return out.sort((a, b) => (tubeOdMm(a.w.od) - tubeOdMm(b.w.od)) || natCmp(a.w.tag, b.w.tag));
}
const TUBE_COLS = () => [{ h: 'Tube', w: 20, a: 'middle' }, { h: 'From', w: 92 }, { h: 'To', w: 92 }, { h: 'Tube OD', w: 26, a: 'middle' }, { h: 'Color', w: 26, a: 'middle' }, { h: 'Length', w: 26, a: 'middle' }, { h: 'Part number', w: 56 }, { h: 'Page', w: 46 }];
function tubeRows() {
  const rows = []; const td = tubeData(); const groups = [...new Set(td.map(x => String(x.w.od || '')))];
  const colorName = c => (TUBE_COLORS.find(k => k[0] === c) || ['', c || ''])[1].replace('(none)', '');
  for (const g of groups) {
    const list = td.filter(x => String(x.w.od || '') === g); const gk = 'g:od:' + g;
    const lens = list.map(x => parseFloat(String(x.w.len || '').replace(',', '.'))).filter(n => isFinite(n));
    rows.push({ key: gk, cells: ['', `Tube ${tubeOdLabel(g)}: ${list.length} tube(s)${lens.length ? ', ' + r2(lens.reduce((a, b) => a + b, 0)) + ' total length' : ''}`, '', '', '', '', '', ''], cls: 'grp', group: true });
    for (const x of list) rows.push({ key: x.w.id, cells: [x.w.tag || '', x.from, x.to, tubeOdLabel(x.w.od), colorName(x.w.color), x.w.len || '', x.w.part || '', pageName(x.pg) + '.' + colOf(x.w.pts[0][0], x.pg)], goto: x.w.id, link: x.pg.id, grp: gk });
  }
  return rows;
}
function tubePropsHTML(w, row) {
  return `<div class="ident">Tube ${esc(w.tag || '')}</div><div class="sub">Pneumatic tube</div>
    <div class="pgrp"><h4>Tube</h4>${row('w.tag', 'Tube number', w.tag || '')}
    ${row('w.od', 'Outside diameter', '', 'select', TUBE_OD.map(([v, l]) => `<option value="${v}" ${String(w.od || '') === v ? 'selected' : ''}>${l}</option>`).join(''))}
    ${row('w.color', 'Color', '', 'select', TUBE_COLORS.map(([v, l]) => `<option value="${v}" ${(w.color || '') === v ? 'selected' : ''}>${l}</option>`).join(''))}
    ${row('w.len', 'Length', w.len || '', 'text', 'placeholder="e.g. 1.5 m"')}${row('w.part', 'Part number', w.part || '', 'text', 'list="dl-parts"')}${partDatalist()}${partInfoHTML(w.part)}
    ${(userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(w.layer)) : '')}<div class="note">New tubes take the size and color last chosen here.</div></div>
    <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
}
