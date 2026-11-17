// ---------- building renders: framing, shell and exploded views in 3D ----------
// A solid is { faces: [[x, y, z]...][], c (center), color, alpha }: plan x (width), plan y (toward the back), z up, real mm,
// with z = 0 at the top of the floor deck. The renderer projects solids in parallel (axonometric) views, sorts them back
// to front and draws the faces that look at the camera, as vector polygons on a sheet or on a canvas.
const MCOL = { end: '#ecd3a6', common: '#ecd3a6', cripple: '#ecd3a6', lcripple: '#ecd3a6', fill: '#ecd3a6', king: '#d9b37a', jack: '#c4914f', header: '#9b6a33',
  plate: '#e2c48f', joist: '#ecd3a6', rim: '#d9b37a', skid: '#8a6a44', rafter: '#d8b98a', ridge: '#b88a4a', tie: '#e2c48f', deck: '#c9b68e', wall: '#e8e2d6', roof: '#8a6b4a', glass: '#bcdcec', door: '#9b6a33' };
const BV_KINDS = [['framing', 'Framing'], ['shell', 'Shell'], ['exploded', 'Exploded framing']];
const BV_VIEWS = [['front left', -0.62], ['front right', 0.62], ['back right', Math.PI - 0.62], ['back left', Math.PI + 0.62]];

function solidOf(faces, color, alpha) {
  const pts = faces.flat(); const c = [0, 0, 0]; pts.forEach(p => { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; });
  return { faces, c, color, alpha: alpha == null ? 1 : alpha };
}
// a prism: a polygon in a 2D (a, b) plane extruded between t0 and t1, placed by to3(a, b, t)
function prismSolid(poly, to3, t0, t1, color, alpha) {
  const f0 = poly.map(([a, b]) => to3(a, b, t0)), f1 = poly.map(([a, b]) => to3(a, b, t1)).reverse();
  const faces = [f0, f1]; const n = poly.length;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; faces.push([to3(a[0], a[1], t0), to3(b[0], b[1], t0), to3(b[0], b[1], t1), to3(a[0], a[1], t1)]); }
  return solidOf(faces, color, alpha);
}
const boxSolid = (x0, y0, z0, x1, y1, z1, color, alpha) => prismSolid([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], (a, b, t) => [a, t, b], y0, y1, color, alpha);

// where each wall sits: wall-local x along the wall, height z, thickness t from the outside face
function wallPlacer(M, fw, off) {
  const d = fw.def, WD = M.WD, W = M.W || M.L, D = M.D || WD, o = off || [0, 0, 0];
  return (x, z, t) => {
    const p = d.toPlan(x);
    let q;
    if (fw.key === 'single' || fw.key === 'front') q = [p, t, z];
    else if (fw.key === 'back') q = [p, D - t, z];
    else if (fw.key === 'right') q = [W - t, p, z];
    else q = [t, p, z];
    return [q[0] + o[0], q[1] + o[1], q[2] + o[2]];
  };
}
const wallOut = { front: [0, -1, 0], back: [0, 1, 0], right: [1, 0, 0], left: [-1, 0, 0], single: [0, -1, 0] };

// one wall of the finished shell as a single solid with its doors and windows cut out. The wall is split into bands at
// the opening edges; only faces that are really on the outside are made (the two wall faces, the top, the sides, head
// and sill of each opening, and the wall ends at building corners), so touching pieces never show their joints.
function wallShellSolid(M, fw, at) {
  const WD = M.WD, H = fw.wallTop, L = fw.len;
  const cuts = [...new Set([0, L, ...fw.ops.flatMap(o => [o.roL, o.roR])])].sort((a, b) => a - b);
  const bands = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const x0 = cuts[i], x1 = cuts[i + 1]; if (x1 - x0 < 0.5) continue;
    const op = fw.ops.find(o => o.roL <= x0 + 0.5 && o.roR >= x1 - 0.5);
    const iv = !op ? [[0, H]] : op.type === 'door' ? [[op.top, H]] : [[0, op.sill], [op.top, H]];
    bands.push({ x0, x1, iv: iv.filter(([a, b]) => b - a > 0.5) });
  }
  // the side walls fit between the front and back walls, so their ends are hidden up to the height of those walls
  const through = M.walls.filter(w => w.key === 'front' || w.key === 'back').map(w => w.wallTop);
  const hidden = fw.key === 'left' || fw.key === 'right' ? Math.min(H, ...through) : 0;
  const minus = (iv, cover) => { let out = [iv]; for (const [c0, c1] of cover) out = out.flatMap(([a, b]) => c1 <= a || c0 >= b ? [[a, b]] : [[a, Math.max(a, c0)], [Math.min(b, c1), b]].filter(([p, q]) => q - p > 0.5)); return out; };
  const faces = [];
  const quadX = (x, z0, z1) => [at(x, z0, 0), at(x, z0, WD), at(x, z1, WD), at(x, z1, 0)];
  bands.forEach((b, i) => {
    const prev = bands[i - 1], next = bands[i + 1];
    for (const [z0, z1] of b.iv) {
      // each face knows a point inside its piece, so it can tell which way is out
      const ref = at((b.x0 + b.x1) / 2, (z0 + z1) / 2, WD / 2), add = f => { f.ref = ref; faces.push(f); };
      add([at(b.x0, z0, 0), at(b.x1, z0, 0), at(b.x1, z1, 0), at(b.x0, z1, 0)]);
      add([at(b.x0, z0, WD), at(b.x0, z1, WD), at(b.x1, z1, WD), at(b.x1, z0, WD)]);
      add([at(b.x0, z1, 0), at(b.x1, z1, 0), at(b.x1, z1, WD), at(b.x0, z1, WD)]);
      if (z0 > 0.5) add([at(b.x0, z0, 0), at(b.x0, z0, WD), at(b.x1, z0, WD), at(b.x1, z0, 0)]);
      for (const [x, nb] of [[b.x0, prev], [b.x1, next]]) {
        const cover = nb ? nb.iv : (hidden ? [[0, hidden]] : []);
        for (const [a, c] of minus([z0, z1], cover)) add(quadX(x, a, c));
      }
    }
  });
  return solidOf(faces, MCOL.wall);
}

// ---------- the solids for one view kind ----------
function frameSolids(M, kind) {
  M._solids = M._solids || {}; if (M._solids[kind]) return M._solids[kind];
  const S = [], T = M.T, WD = M.WD, W = M.W || M.L, D = M.D || WD, F = M.floor, R = M.roof;
  const ex = kind === 'exploded' ? Math.max(600, 0.3 * Math.max(W, D)) : 0, lift = kind === 'exploded' ? Math.max(900, 0.45 * M.wallTop) : 0;
  const labels = [];
  // floor (drawn under everything else)
  const n0 = S.length;
  if (F) {
    const dz = -F.deckT;
    if (kind === 'shell') S.push(boxSolid(0, 0, dz, W, D, 0, MCOL.deck));
    if (F.longAxis === 'x') {
      S.push(boxSolid(0, 0, dz - F.jd, W, T, dz, MCOL.rim), boxSolid(0, D - T, dz - F.jd, W, D, dz, MCOL.rim));
      if (kind !== 'shell') F.pos.forEach(x => S.push(boxSolid(x, T, dz - F.jd, x + T, D - T, dz, MCOL.joist)));
      F.skidPos.forEach(p => S.push(boxSolid(0, p, -F.height, W, p + F.skidW, dz - F.jd, MCOL.skid)));
    } else {
      S.push(boxSolid(0, 0, dz - F.jd, T, D, dz, MCOL.rim), boxSolid(W - T, 0, dz - F.jd, W, D, dz, MCOL.rim));
      if (kind !== 'shell') F.pos.forEach(y => S.push(boxSolid(T, y, dz - F.jd, W - T, y + T, dz, MCOL.joist)));
      F.skidPos.forEach(p => S.push(boxSolid(p, 0, -F.height, p + F.skidW, D, dz - F.jd, MCOL.skid)));
    }
  }
  for (let i = n0; i < S.length; i++) S[i].floor = true;
  // walls
  for (const fw of M.walls) {
    const out = wallOut[fw.key]; const off = [out[0] * ex, out[1] * ex, 0]; const at = wallPlacer(M, fw, off);
    const rect = (x0, x1, z0, z1, color, t0 = 0, t1 = WD, alpha) => { if (x1 - x0 > 0.5 && z1 - z0 > 0.5) S.push(prismSolid([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], at, t0, t1, color, alpha)); };
    if (kind === 'shell') {
      const H = fw.wallTop;
      // each wall carries its doors and window glass, drawn right after it so they cover the opening sides behind them
      const ws = wallShellSolid(M, fw, at); ws.after = []; S.push(ws);
      for (const op of fw.ops) ws.after.push(op.type === 'window' ? prismSolid([[op.roL, op.sill], [op.roR, op.sill], [op.roR, op.top], [op.roL, op.top]], at, WD / 2 - 3, WD / 2 + 3, MCOL.glass, 0.55)
        : prismSolid([[op.roL + 12, 0], [op.roR - 12, 0], [op.roR - 12, op.top - 12], [op.roL + 12, op.top - 12]], at, 6, 46, MCOL.door));
      if (R && fw.def.fill) {
        const n = 24, poly = [[0, H], [fw.len, H]];
        for (let i = n; i >= 0; i--) { const x = fw.len * i / n; poly.push([x, H + Math.max(0, R.f(fw.def.toPlan(x)))]); }
        S.push(prismSolid(poly, at, 0, WD, MCOL.wall));
      }
    } else {
      fw.members.forEach(q => rect(q.x, q.x + T, q.y0, q.y1, MCOL[q.kind] || MCOL.common));
      fw.fill.forEach(q => rect(q.x, q.x + T, q.y0, q.y1, MCOL.fill));
      fw.ops.forEach(op => { rect(op.roL - T, op.roR + T, op.top, op.hTop, MCOL.header); if (op.type === 'window') rect(op.roL, op.roR, op.sill - T, op.sill, MCOL.plate); });
      fw.bottom.pieces.forEach(p => { let a = p.x0; for (const op of fw.ops.filter(o => o.type === 'door')) { if (op.roL > a && op.roL < p.x1) rect(a, op.roL, 0, T, MCOL.plate); if (op.roR > a && op.roL < p.x1) a = Math.max(a, op.roR); } rect(a, p.x1, 0, T, MCOL.plate); });
      fw.topP.pieces.forEach(p => rect(p.x0, p.x1, fw.top, fw.top + T, MCOL.plate));
      if (fw.cap) fw.cap.pieces.forEach(p => rect(p.x0, p.x1, fw.top + T, fw.top + 2 * T, MCOL.plate));
    }
    labels.push({ text: fw.name.replace(' wall', '').toUpperCase(), p: at(fw.len / 2, fw.wallTop * 0.45, -350), n: out });
  }
  // roof
  if (R) {
    const top = M.wallTop + lift, vd = R.rd * R.sf, zb = u => top + R.f(u);
    const to3 = (u, z, v) => R.axis === 'x' ? [u, v, z] : [v, u, z];
    const v0 = -R.rake, v1 = R.Lr + R.rake;
    if (kind === 'shell') {
      const slab = (u0, u1) => { const sl = prismSolid([[u0, zb(u0) + vd], [u1, zb(u1) + vd], [u1, zb(u1) + vd + 25], [u0, zb(u0) + vd + 25]], to3, v0, v1, MCOL.roof); sl.last = true; S.push(sl); };
      if (R.type === 'gable') { slab(-R.eave, R.B / 2); slab(R.B / 2, R.B + R.eave); } else slab(-R.eave, R.B + R.eave);
    } else {
      const raf = (u0, u1, a, b, color) => S.push(prismSolid([[u0, zb(u0)], [u1, zb(u1)], [u1, zb(u1) + vd], [u0, zb(u0) + vd]], to3, a, b, color));
      const pair = (a, b) => { if (R.type === 'gable') { raf(-R.eave, R.B / 2 - T / 2, a, b, MCOL.rafter); raf(R.B / 2 + T / 2, R.B + R.eave, a, b, MCOL.rafter); } else raf(-R.eave, R.B + R.eave, a, b, MCOL.rafter); };
      R.pos.forEach(p => pair(p, p + T));
      if (R.rake > 0.5) { pair(v0, v0 + T); pair(v1 - T, v1); }
      if (R.type === 'gable') { const zt = zb(R.B / 2 - T / 2) + vd; S.push(prismSolid([[R.B / 2 - T / 2, zt - R.ridgeD], [R.B / 2 + T / 2, zt - R.ridgeD], [R.B / 2 + T / 2, zt], [R.B / 2 - T / 2, zt]], to3, v0, v1, MCOL.ridge)); }
      if (R.ties) { const every = R.ties >= R.n ? 1 : 2; R.pos.forEach((p, i) => { if (i % every) return; const a = Math.min(p + T, R.Lr - T); S.push(prismSolid([[0, top], [R.B, top], [R.B, top + sizeDepth(0)], [0, top + sizeDepth(0)]], to3, a, a + T, MCOL.tie)); }); }
    }
  }
  const all = S.flatMap(s => s.faces.flat());
  const res = { solids: S, labels, lift, ex, bounds: [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.min(...all.map(p => p[2])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1])), Math.max(...all.map(p => p[2]))] };
  M._solids[kind] = res; return res;
}

// ---------- projection ----------
function viewAxes(yaw, pitch) {
  const cp = Math.cos(pitch), c = [Math.sin(yaw) * cp, -Math.cos(yaw) * cp, Math.sin(pitch)];   // toward the camera
  const fwd = [-c[0], -c[1], -c[2]];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nz = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  const right = nz(cr(fwd, [0, 0, 1])), up = cr(right, fwd);
  return { c, fwd, right, up };
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function shadeRGB(hex, k) { const n = parseInt(String(hex).replace('#', ''), 16); const g = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${g(n >> 16 & 255)},${g(n >> 8 & 255)},${g(n & 255)})`; }
// visible faces in drawing order, in view coordinates (x right, y up)
function projectSolids(solids, ax) {
  const L = (() => { const l = [ax.c[0] - ax.right[0] * 0.5, ax.c[1] - ax.right[1] * 0.5, ax.c[2] + 1.2]; const n = Math.hypot(...l); return l.map(v => v / n); })();
  // roof surfaces go last: every view looks down on them
  // the floor goes first and the roof last
  const rank = x => x.last ? 1 : x.floor ? -1 : 0;
  const order = solids.map(s => ({ s, d: dot3(s.c, ax.fwd) })).sort((a, b) => (rank(a.s) - rank(b.s)) || b.d - a.d);
  const out = [];
  for (const { s: s0 } of order) for (const s of [s0, ...(s0.after || [])]) for (const F of s.faces) {
    let n = [0, 0, 0];   // Newell's method: works when some corners are in line
    for (let i = 0; i < F.length; i++) { const p = F[i], q = F[(i + 1) % F.length]; n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); }
    const ln = Math.hypot(...n); if (ln < 1e-9) continue; n = n.map(v => v / ln);
    const fc = [0, 0, 0]; F.forEach(p => { fc[0] += p[0] / F.length; fc[1] += p[1] / F.length; fc[2] += p[2] / F.length; });
    const ref = F.ref || s.c; if (dot3(n, [fc[0] - ref[0], fc[1] - ref[1], fc[2] - ref[2]]) < 0) n = n.map(v => -v);
    if (dot3(n, ax.c) <= 1e-6) continue;
    out.push({ pts: F.map(p => [dot3(p, ax.right), dot3(p, ax.up)]), fill: shadeRGB(s.color, 0.62 + 0.38 * Math.max(0, dot3(n, L))), alpha: s.alpha });
  }
  return out;
}
const projPt = (p, ax) => [dot3(p, ax.right), dot3(p, ax.up)];

// one view as sheet SVG inside a cell [x0, y0, x1, y1]
function bviewSVG(M, kind, yaw, cell, withDims) {
  const ax = viewAxes(yaw, 0.52), sc = frameSolids(M, kind);
  const faces = projectSolids(sc.solids, ax);
  const W = M.W || M.L, D = M.D || M.WD, zg = M.floor ? -M.floor.height : 0, peakZ = M.roof ? M.wallTop + M.roof.peak : M.wallTop;
  const off = 500 + sc.ex;
  const dims = withDims ? [
    { a: [0, -off, zg], b: [W, -off, zg], t: 'Width ' + formatLength(W) },
    ...(M.mode === 'wall' ? [] : [{ a: [-off, 0, zg], b: [-off, D, zg], t: 'Depth ' + formatLength(D) }]),
    (() => { const cs = [[0, 0, -1, -1], [W, 0, 1, -1], [W, D, 1, 1], [0, D, -1, 1]].map(([x, y, sx, sy]) => [x + sx * off, y + sy * off]); const c = cs.sort((p, q) => projPt([p[0], p[1], 0], ax)[0] - projPt([q[0], q[1], 0], ax)[0])[0];
      return { a: [c[0], c[1], zg], b: [c[0], c[1], peakZ + sc.lift], t: (M.roof ? 'Peak ' : 'Height ') + formatLength(peakZ - zg) }; })(),
  ] : [];
  const pts2 = faces.flatMap(f => f.pts).concat(dims.flatMap(d => [projPt(d.a, ax), projPt(d.b, ax)]));
  const xs = pts2.map(p => p[0]), ys = pts2.map(p => p[1]);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
  const cw = cell[2] - cell[0] - 16, ch = cell[3] - cell[1] - 16; const k = Math.min(cw / Math.max(1, bx1 - bx0), ch / Math.max(1, by1 - by0));
  const ox = (cell[0] + cell[2]) / 2 - k * (bx0 + bx1) / 2, oy = (cell[1] + cell[3]) / 2 + k * (by0 + by1) / 2;
  const S = p => [r2(ox + p[0] * k), r2(oy - p[1] * k)];
  let s = '';
  for (const f of faces) s += `<polygon points="${f.pts.map(p => S(p).join(',')).join(' ')}" fill="${f.fill}"${f.alpha < 1 ? ` fill-opacity="${f.alpha}"` : ''} stroke="#4a3a28" stroke-width="0.06" stroke-linejoin="round"/>`;
  for (const lb of sc.labels) {
    if (dot3(lb.n, ax.c) <= 0.05) continue;
    const [x, y] = S(projPt(lb.p, ax)); s += `<text class="t bvlbl" x="${x}" y="${y}" font-size="2.6" font-weight="bold" text-anchor="middle">${esc(lb.text)}</text>`;
  }
  for (const d of dims) {
    const a = S(projPt(d.a, ax)), b = S(projPt(d.b, ax)); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; const rot = ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    s += `<path class="frdim frdima" d="M${a[0]},${a[1]}L${b[0]},${b[1]}"/><circle class="frarrowh" cx="${a[0]}" cy="${a[1]}" r="0.5"/><circle class="frarrowh" cx="${b[0]}" cy="${b[1]}" r="0.5"/>`;
    s += `<text class="t frta" x="${r2(mx)}" y="${r2(my - 1)}" font-size="2.3" text-anchor="middle" transform="rotate(${r2(rot)} ${r2(mx)} ${r2(my)})">${esc(d.t)}</text>`;
  }
  return s;
}
// ---------- the Building views report ----------
function buildBuildingViewReports(reps) {
  (P.buildings || []).forEach((b, bi) => {
    const M = frameModel(b); if (!M.walls || !M.walls.length || (M.errs && M.errs.length)) return;
    const kinds = b.mode === 'wall' ? BV_KINDS.slice(0, 2) : BV_KINDS;
    kinds.forEach(([k, name], i) => reps.push({ id: `rep:bviews:${b.id}:${i + 1}`, report: 'bviews', bld: b.id, view3: k, fn: '', loc: '', num: `BV${bi + 1}.${i + 1}`, desc: `Building views ${b.name}`, title: `Building views ${b.name}`, sub: name, cols: [], rows: [], sheet: i + 1, sheets: kinds.length, items: [], wires: [] }));
  });
}
function buildingViewsSVG(rp) {
  const all = allPages(); let s = frameSVG(rp, all.indexOf(rp), all.length);
  const b = (P.buildings || []).find(x => x.id === rp.bld); const M = b && frameModel(b);
  s += `<text class="t" x="${SH.x0 + 3}" y="${SH.hdr + 10}" font-size="5" font-weight="bold">${esc(rp.title)}: ${esc(rp.sub)}</text>`;
  if (rp.sheets > 1) s += `<text class="t" x="${SH.x1 - 3}" y="${SH.hdr + 10}" font-size="3" text-anchor="end">Sheet ${rp.sheet} of ${rp.sheets}</text>`;
  if (!M || !M.walls) return s;
  const notes = { framing: 'Every stud, plate, header, joist and rafter as built, seen from the four corners.', shell: 'Walls, roof, doors and windows as finished surfaces, seen from the four corners.', exploded: 'The framing with the walls pulled out from the corners and the roof lifted, seen from the four corners.' };
  s += `<text class="t tc" x="${SH.x0 + 3}" y="${SH.hdr + 16}" font-size="2.8">${esc(notes[rp.view3])}</text>`;
  if (rp.view3 !== 'shell') {
    const leg = [['Studs', MCOL.common], ['King studs', MCOL.king], ['Jack studs', MCOL.jack], ['Headers', MCOL.header], ['Plates', MCOL.plate], ...(M.floor ? [['Joists', MCOL.joist], ['Skids', MCOL.skid]] : []), ...(M.roof ? [['Rafters', MCOL.rafter], ['Ridge', MCOL.ridge]] : [])];
    let x = SH.x1 - 3; for (const [t, c] of leg.reverse()) { const w = t.length * 1.45 + 6; x -= w; s += `<rect x="${r2(x)}" y="${SH.hdr + 13.6}" width="3" height="3" fill="${c}" stroke="#4a3a28" stroke-width="0.1"/><text class="t" x="${r2(x + 4)}" y="${SH.hdr + 16.2}" font-size="2.4">${esc(t)}</text>`; }
  }
  const x0 = SH.x0 + 2, x1 = SH.x1 - 2, y0 = SH.hdr + 20, y1 = SH.tb - 2, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  const cells = [[x0, y0, xm, ym], [xm, y0, x1, ym], [xm, ym, x1, y1], [x0, ym, xm, y1]];
  s += `<path class="frext" d="M${xm},${y0}V${y1}M${x0},${ym}H${x1}"/>`;
  BV_VIEWS.forEach(([name, yaw], i) => { s += bviewSVG(M, rp.view3, yaw, cells[i], i === 0); });
  return s;
}

// ---------- the 3D window: framing and exploded modes ----------
function drawSolidsCanvas(cv, M, kind) {
  const wpx = cv.clientWidth || 900, hpx = Math.round(Math.max(320, Math.min(620, wpx * 0.62))), dpr = window.devicePixelRatio || 1;
  cv.style.height = hpx + 'px'; cv.width = Math.round(wpx * dpr); cv.height = Math.round(hpx * dpr);
  const ctx = cv.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement); ctx.fillStyle = (css.getPropertyValue('--panel2') || '#fff').trim() || '#fff'; ctx.fillRect(0, 0, wpx, hpx);
  const ax = viewAxes(V3.yaw, V3.pitch), sc = frameSolids(M, kind), faces = projectSolids(sc.solids, ax);
  const corners = []; const [a0, b0, c0, a1, b1, c1] = sc.bounds; for (const x of [a0, a1]) for (const y of [b0, b1]) for (const z of [c0, c1]) corners.push(projPt([x, y, z], ax));
  const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
  const k = Math.min(wpx / (Math.max(...xs) - Math.min(...xs)), hpx / (Math.max(...ys) - Math.min(...ys))) * 0.86 * V3.zoom;
  const ox = wpx / 2 - k * (Math.min(...xs) + Math.max(...xs)) / 2, oy = hpx / 2 + k * (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const f of faces) {
    ctx.globalAlpha = f.alpha; ctx.beginPath(); f.pts.forEach((p, i) => { const X = ox + p[0] * k, Y = oy - p[1] * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath();
    ctx.fillStyle = f.fill; ctx.fill(); ctx.strokeStyle = 'rgba(60,40,20,.55)'; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
  }
}
