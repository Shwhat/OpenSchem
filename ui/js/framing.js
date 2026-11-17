// ---------- framing: buildings, walls, floors and roofs ----------
// A building lives in P.buildings: { id, name, mode: 'building' | 'wall', w, d (outside of framing) or len (single wall),
// studLen, plates (1 or 2), sp (stud spacing), stud (size index), walls: { front, right, back, left, single: { ops } },
// floor, roof, cover, stock: { pre, lens (stock length indexes) }, kerf }. All lengths are real millimetres. Lumber sizes
// are indexes into the project's lumber catalog (P.lumber: 'na' or 'metric'), so a project can switch catalogs.
// An opening is { id, type: 'door' | 'window', w, h, sill, x (rough opening left edge from the wall's left end), ctr
// (keep centered), hdr ('flat' or a size index for a doubled header) }. Walls are seen from outside: the front wall's
// left end is the left corner, the right wall starts at the front, the back wall at the right, the left wall at the back.
// The side walls fit between the front and back walls. Each building has framing pages (kind 'frame', bld, view).
const LUMBER = {
  na: {
    name: 'North American (2x4, 2x6...)', t: 1.5 * IN_MM,
    sizes: ['2x4', '2x6', '2x8', '2x10', '2x12'], depth: [3.5, 5.5, 7.25, 9.25, 11.25].map(v => v * IN_MM),
    posts: ['4x4', '4x6'], postD: [[3.5, 3.5], [3.5, 5.5]].map(a => a.map(v => v * IN_MM)),
    stock: [8, 10, 12, 14, 16, 18, 20].map(f => f * 12 * IN_MM), stockOn: [0, 1, 2, 3, 4],
    studs: [92.625, 104.625, 116.625, 70.625].map(v => v * IN_MM), sp: [12, 16, 24].map(v => v * IN_MM), spDef: 16 * IN_MM, rsp: 24 * IN_MM,
    sheetW: 48 * IN_MM, sheets: [96, 108, 120, 144].map(v => v * IN_MM), kerf: 0.125 * IN_MM, treated: 'PT', deck: 0.75 * IN_MM,
    spacer: '1/2" plywood', pre: true,
  },
  metric: {
    name: 'Metric (45x95, 45x145...)', t: 45,
    sizes: ['45x95', '45x145', '45x195', '45x220', '45x245'], depth: [95, 145, 195, 220, 245],
    posts: ['95x95', '95x145'], postD: [[95, 95], [95, 145]],
    stock: [2400, 3000, 3600, 4200, 4800, 5400, 6000], stockOn: [0, 1, 2, 3, 4],
    studs: [2265, 2565, 2865], sp: [300, 400, 600], spDef: 400, rsp: 600,
    sheetW: 1200, sheets: [2400, 2700, 3000], kerf: 3, treated: 'treated', deck: 18,
    spacer: '12 mm plywood', pre: false,
  },
};
const lumberKey = () => P && (P.lumber === 'metric' || P.lumber === 'na') ? P.lumber : unitsOf() === 'metric' ? 'metric' : 'na';
const LC = () => LUMBER[lumberKey()];
const sizeName = i => LC().sizes[Math.max(0, Math.min(4, +i || 0))];
const sizeDepth = i => LC().depth[Math.max(0, Math.min(4, +i || 0))];
const WALL_KEYS = ['front', 'right', 'back', 'left'];
const WALL_NAMES = { front: 'Front wall', right: 'Right wall', back: 'Back wall', left: 'Left wall', single: 'Wall' };
const FRAME_VIEWS = { plan: 'Framing plan', front: 'Front wall', right: 'Right wall', back: 'Back wall', left: 'Left wall', floor: 'Floor framing', roof: 'Roof framing', wall: 'Wall framing' };
const isFrame = pg => pg && pg.kind === 'frame';
const bldOf = pg => pg && (P.buildings || []).find(b => b.id === pg.bld);

// lengths for framing: cut lengths in inches (92 5/8") or millimetres
function fmtCut(mm) {
  if (!isFinite(mm)) return '';
  if (unitsOf() === 'metric') return Math.round(mm) + ' mm';
  const den = (P && P.prec) || 16; const n = Math.round(Math.abs(mm) / IN_MM * den); const sg = mm < 0 && n ? '-' : '';
  const whole = Math.floor(n / den), fr = n % den; const g = fr ? gcd(fr, den) : 1;
  return sg + (whole || !fr ? whole : '') + (fr ? (whole ? ' ' : '') + fr / g + '/' + den / g : '') + '"';
}
const fmtLong = mm => unitsOf() === 'metric' ? fmtCut(mm) : fmtCut(mm) + (Math.abs(mm) >= 24 * IN_MM ? ' (' + formatLength(mm) + ')' : '');
const fmtNum = mm => fmtCut(mm).replace(/"$/, '').replace(/ mm$/, '');
const pitchName = p => (+(+p).toFixed(2)) + '/12';

// ---------- new buildings ----------
function newFrameOpening(type, wallLen) {
  const m = lumberKey() === 'metric';
  const o = type === 'door' ? { type, w: m ? 950 : 38 * IN_MM, h: m ? 2100 : 82.5 * IN_MM, sill: 0 } : { type: 'window', w: m ? 900 : 36.5 * IN_MM, h: m ? 600 : 24.5 * IN_MM, sill: m ? 1200 : 48 * IN_MM };
  return Object.assign(o, { id: uid(), ctr: true, x: Math.max(0, ((wallLen || o.w) - o.w) / 2), hdr: 1 });
}
function newBuilding(mode, o = {}) {
  const c = LC(), m = lumberKey() === 'metric';
  const b = {
    id: uid(), name: o.name || (mode === 'wall' ? 'Wall' : 'Shed'), mode,
    w: o.w || (m ? 3000 : 120 * IN_MM), d: o.d || (m ? 2400 : 96 * IN_MM), len: o.len || (m ? 2880 : 113.5 * IN_MM),
    studLen: o.studLen || c.studs[0], plates: 2, sp: c.spDef, stud: 0,
    walls: { front: { ops: [] }, right: { ops: [] }, back: { ops: [] }, left: { ops: [] }, single: { ops: [] } },
    floor: { on: mode === 'building', joist: 1, sp: c.spDef, pt: true, skids: 3, skid: 0, deck: m ? '18 mm plywood' : '3/4" T&G plywood' },
    roof: { on: mode === 'building', type: 'gable', ends: 'frontback', low: 'back', pitch: 6, rafter: 1, sp: c.rsp, eave: m ? 300 : 12 * IN_MM, rake: m ? 150 : 6 * IN_MM, ties: 'every' },
    cover: { wall: true, wallMat: m ? '11 mm OSB' : '7/16" OSB', wallSheet: 0, roof: true, roofMat: m ? '11 mm OSB' : '7/16" OSB', roofSheet: 0, roofDir: 'along' },
    stock: { pre: c.pre, lens: c.stockOn.slice() }, kerf: c.kerf, splice: spliceDefaults(),
  };
  if (mode === 'building' && !o.bare) b.walls.front.ops.push(newFrameOpening('door', b.w));
  if (mode === 'wall' && !o.bare) b.walls.single.ops.push(newFrameOpening('door', b.len));
  return b;
}
// splicing: rafter ties lap or get a scab where they are longer than the longest board; plates, rims, ridge boards and
// skids always join over a support. len is the lap (or the scab length), min the shortest piece allowed.
const spliceDefaults = (metric = lumberKey() === 'metric') => metric ? { tie: 'lap', len: 600, min: 600 } : { tie: 'lap', len: 24 * IN_MM, min: 24 * IN_MM };
const spliceOf = b => Object.assign(spliceDefaults(), b.splice || {});
// "part 1 of 2" notes for a run cut into pieces
const partNotes = (run, joint, extra) => run.pieces.map((p, i, a) => [a.length > 1 ? `part ${i + 1} of ${a.length}, ${joint}` : '', extra || ''].filter(Boolean).join(', '));
function frameViews(b) {
  if (b.mode === 'wall') return ['wall'];
  return ['plan', 'front', 'right', 'back', 'left'].concat(b.floor.on ? ['floor'] : [], b.roof.on ? ['roof'] : []);
}
// keeps a building's pages in step with its views (adds missing ones, removes ones no longer used)
function syncFramePages(b) {
  const want = frameViews(b);
  P.pages = P.pages.filter(p => !(isFrame(p) && p.bld === b.id && !want.includes(p.view)));
  want.forEach((v, i) => {
    let pg = P.pages.find(p => isFrame(p) && p.bld === b.id && p.view === v);
    if (!pg) { pg = { id: uid(), kind: 'frame', bld: b.id, view: v, num: '', desc: '', fn: '', loc: '', items: [], wires: [], cables: [], gfx: [] }; P.pages.push(pg); }
    pg.num = String(i + 1); pg.desc = FRAME_VIEWS[v];
  });
}

// ---------- framing math helpers ----------
function layoutPositions(L, sp, T) {
  const xs = [0];
  for (let k = 1; k < 100000; k++) { const x = k * sp - T / 2; if (x + T > L - T + 0.01) break; xs.push(x); }
  if (L - T > 0.01) xs.push(L - T);
  return xs;
}
// splices a run longer than the longest board: joints land on the supports (centers), leave no piece shorter than
// minPiece where the supports allow, and keep minGap away from the joints of the layer below (avoid)
function splitRun(x0, x1, centers, maxLen, avoid, minGap, minPiece) {
  const splices = []; let start = x0; const mp = minPiece == null ? 300 : minPiece;
  while (x1 - start > maxLen + 0.01) {
    const reach = centers.filter(c => c > start + 1 && c - start <= maxLen + 0.01 && c < x1 - 1);
    let cands = reach.filter(c => c - start >= mp - 0.01 && x1 - c >= mp - 0.01); if (!cands.length) cands = reach;
    const ok = cands.filter(c => avoid.every(a => Math.abs(a - c) >= minGap - 0.01));
    let pick = (ok.length ? ok : cands).slice(-1)[0];
    if (pick === undefined) pick = start + maxLen;
    splices.push(pick); start = pick;
  }
  const pts = [x0, ...splices, x1]; const pieces = [];
  for (let i = 0; i < pts.length - 1; i++) pieces.push({ x0: pts[i], x1: pts[i + 1], len: pts[i + 1] - pts[i] });
  return { splices, pieces };
}
function packOnce(pieces, stocks, kerf, pref) {
  const ps = [...pieces].sort((a, b) => b.need - a.need); const boards = [];
  for (const p of ps) {
    let best = null, bestRem = Infinity;
    for (const b of boards) if (b.used + p.need <= b.stock.len + 0.01) { const rem = b.stock.len - (b.used + p.need); if (rem < bestRem) { bestRem = rem; best = b; } }
    if (!best) {
      const fits = stocks.filter(s => s.len >= p.need - 0.01).sort((a, b) => a.len - b.len);
      if (!fits.length) return { error: p };
      const st = fits.find(s => s.len >= pref - 0.01) || fits[fits.length - 1];
      best = { stock: st, used: 0, cuts: [] }; boards.push(best);
    }
    best.cuts.push(p); best.used += p.need + kerf;
  }
  for (const b of boards) {
    const need = b.used - kerf; const st = stocks.filter(s => s.len >= need - 0.01).sort((a, b) => a.len - b.len)[0];
    if (st) b.stock = st; b.offcut = Math.max(0, b.stock.len - need);
  }
  return { boards };
}
// fewest boards: tries each stock length as the preferred one for new boards and keeps the plan with the least lumber
function packBoards(pieces, stocks, kerf) {
  let best = null;
  for (const pref of [0, ...stocks.map(s => s.len)]) {
    const res = packOnce(pieces, stocks, kerf, pref); if (res.error) return res;
    const total = res.boards.reduce((a, b) => a + b.stock.len, 0);
    if (!best || total < best.total - 0.01 || (Math.abs(total - best.total) < 0.01 && res.boards.length < best.boards.length)) best = { boards: res.boards, total };
  }
  return { boards: best.boards };
}

// ---------- the framing of one building ----------
const FRAMECACHE = new Map();
function frameModel(b) {
  const key = JSON.stringify(b) + lumberKey() + unitsOf() + (P.prec || 16);
  const c = FRAMECACHE.get(b.id); if (c && c.key === key) return c.M;
  let M; try { M = frameModel0(b); } catch (e) { M = { errs: ['Could not work out the framing: ' + e.message] }; }
  FRAMECACHE.set(b.id, { key, M }); return M;
}
function frameModel0(b) {
  const C = LC(), T = C.t, WD = sizeDepth(b.stud), errs = [];
  const S = b.studLen, sp = b.sp, tp = b.plates === 1 ? 1 : 2;
  const lens = (b.stock.lens || []).map(i => C.stock[i]).filter(Boolean).sort((a, b2) => a - b2);
  if (!(S > 300)) errs.push('The stud length must be at least ' + fmtCut(300) + '.');
  if (!lens.length) errs.push('Pick at least one board length in the building\'s lumber settings.');
  if (errs.length) return { errs };
  const maxLen = lens[lens.length - 1], kerf = Math.max(0, b.kerf || 0), SP = spliceOf(b);
  const M = { b, T, WD, S, sp, tp, maxLen, kerf, SP, walls: [], floor: null, roof: null, pieces: [], sheets: [], errs, mode: b.mode };
  const defs = [];
  if (b.mode === 'wall') {
    const L = b.len; if (!(L > 6 * T)) return { errs: ['The wall is too short to frame.'] };
    M.L = L;
    defs.push({ key: 'single', name: 'Wall', len: L, S, capStart: 0, capEnd: L, toPlan: x => x, toLocal: x => x, axis: 'x', coverLen: L, outToPlan: u => u, fill: null });
  } else {
    const W = b.w, D = b.d;
    if (!(W >= 600) || !(D >= 600)) return { errs: ['The building must be at least ' + formatLength(600) + ' wide and deep.'] };
    M.W = W; M.D = D;
    const base = {
      front: { axis: 'x', len: W, toPlan: x => x, toLocal: c => c, coverLen: W, outToPlan: u => u },
      right: { axis: 'y', len: D - 2 * WD, toPlan: x => x + WD, toLocal: c => c - WD, coverLen: D, outToPlan: u => u },
      back: { axis: 'x', len: W, toPlan: x => W - x, toLocal: c => W - c, coverLen: W, outToPlan: u => W - u },
      left: { axis: 'y', len: D - 2 * WD, toPlan: x => D - WD - x, toLocal: c => D - WD - c, coverLen: D, outToPlan: u => D - u },
    };
    const heights = { front: S, right: S, back: S, left: S };
    const r = b.roof;
    if (r.on) {
      const p = +r.pitch; if (!(p > 0.4)) { errs.push('Enter a roof pitch of at least 1/2 in 12.'); return { errs }; }
      const slope = p / 12, sf = Math.sqrt(1 + slope * slope), ang = Math.atan(slope) * 180 / Math.PI;
      const rsize = sizeName(r.rafter), rd = sizeDepth(r.rafter), eave = Math.max(0, r.eave || 0), rake = Math.max(0, r.rake || 0);
      let axis, lowAt0 = true, high = null;
      if (r.type === 'gable') axis = r.ends === 'leftright' ? 'y' : 'x';
      else { axis = (r.low === 'front' || r.low === 'back') ? 'y' : 'x'; lowAt0 = r.low === 'front' || r.low === 'left'; high = { front: 'back', back: 'front', left: 'right', right: 'left' }[r.low]; }
      const B = axis === 'x' ? W : D, Lr = axis === 'x' ? D : W;
      const f = r.type === 'gable' ? cc => (Math.min(cc, B - cc) - WD) * slope : cc => ((lowAt0 ? cc : B - cc) - WD) * slope;
      const delta = r.type === 'shed' ? (B - WD) * slope : 0;
      if (high) heights[high] = S + delta;
      const pos = layoutPositions(Lr, r.sp, T), n = pos.length;
      let rafterLen, run;
      if (r.type === 'gable') { run = B / 2 - T / 2; rafterLen = (run + eave) * sf; } else { run = B; rafterLen = (B + 2 * eave) * sf; }
      const ridgeSize = sizeName(Math.min(4, (+r.rafter || 0) + 1)), ridgeD = sizeDepth(Math.min(4, (+r.rafter || 0) + 1));
      const ridgeLen = Lr + 2 * rake;
      const ridge = r.type === 'gable' ? splitRun(0, ridgeLen, pos.map(x => x + T / 2 + rake), maxLen, [], 0, SP.min) : null;
      const ties = r.type === 'gable' ? (r.ties === 'every' ? n : r.ties === 'other' ? Math.ceil(n / 2) : 0) : 0;
      const peak = r.type === 'gable' ? f(B / 2) + rd * sf : delta + rd * sf;
      M.roof = { type: r.type, p, slope, sf, ang, rsize, rd, axis, B, Lr, eave, rake, f, lowAt0, high, delta, pos, n, run, rafterLen, need: rafterLen + rd * slope, ridgeLen, ridge, ridgeSize, ridgeD, ties, peak, sp: r.sp, heel: WD * slope, hap: rd * sf - WD * slope };
      if (M.roof.heel > rd / 3 + 0.01) errs.push('The rafter notch over the wall would cut more than a third of a ' + rsize + ' rafter at ' + pitchName(p) + '. Use a deeper rafter or a lower pitch.');
    }
    const eq = (a, c) => Math.abs(heights[a] - heights[c]) < 0.01;
    const capOf = {
      front: [eq('front', 'left') ? WD : 0, W - (eq('front', 'right') ? WD : 0)],
      back: [eq('back', 'right') ? WD : 0, W - (eq('back', 'left') ? WD : 0)],
      right: [eq('right', 'front') ? -WD : 0, (D - 2 * WD) + (eq('right', 'back') ? WD : 0)],
      left: [eq('left', 'back') ? -WD : 0, (D - 2 * WD) + (eq('left', 'front') ? WD : 0)],
    };
    for (const k of WALL_KEYS) {
      const bs = base[k]; const d = Object.assign({ key: k, name: WALL_NAMES[k], S: heights[k], capStart: capOf[k][0], capEnd: capOf[k][1], fill: null }, bs);
      if (M.roof && bs.axis === M.roof.axis) { const R = M.roof; d.fill = (x0, x1) => Math.max(R.f(bs.toPlan(x0)), R.f(bs.toPlan(x1))); d.fillName = R.type === 'gable' ? 'Gable stud' : 'Rake wall stud'; }
      defs.push(d);
    }
    const fl = b.floor;
    if (fl.on) {
      const jd = sizeDepth(fl.joist), Lf = Math.max(W, D), Sf = Math.min(W, D), longAxis = W >= D ? 'x' : 'y';
      const pos = layoutPositions(Lf, fl.sp, T);
      const pd = C.postD[fl.skid ? 1 : 0], skidH = fl.skids ? pd[1] : 0, skidW = pd[0];
      const skidPos = []; for (let i = 0; i < fl.skids; i++) skidPos.push(fl.skids === 1 ? (Sf - skidW) / 2 : i * (Sf - skidW) / (fl.skids - 1));
      const size = sizeName(fl.joist) + (fl.pt ? ' ' + C.treated : '');
      const rims = splitRun(0, Lf, pos.map(x => x + T / 2), maxLen, [], 0, SP.min);
      const sheetL = C.sheets[0];
      M.floor = { jd, size, sp: fl.sp, Lf, Sf, longAxis, pos, joistLen: Sf - 2 * T, rims, skids: fl.skids, skidSize: C.posts[fl.skid ? 1 : 0] + ' ' + C.treated, skidH, skidW, skidPos,
        height: skidH + jd + C.deck, deckT: C.deck, deck: fl.deck, deckSheets: Math.ceil(Lf / sheetL - 1e-6) * Math.ceil(Sf / C.sheetW - 1e-6), sheetL };
      if (Sf - 2 * T < 300) errs.push('The floor is too small to frame.');
    }
  }
  if (errs.length) return { errs };
  for (const d of defs) {
    const ops = resolveFrameOpenings(d, b.walls[d.key].ops, errs);
    const fw = frameWall(d, ops, M, errs); if (fw) M.walls.push(fw);
  }
  if (errs.length) return { errs };

  // pieces
  M.walls.forEach(fw => fw.pieces.forEach(p => M.pieces.push(p)));
  const P0 = (sec, name, size, len, note, need) => M.pieces.push({ sec, name, size, len, note: note || '', need: need === undefined ? len : need });
  if (M.floor) {
    const F = M.floor;
    const rn = partNotes(F.rims, 'joint over a joist');
    for (let k = 0; k < 2; k++) F.rims.pieces.forEach((p, i) => P0('Floor', 'Rim joist', F.size, p.len, rn[i]));
    F.pos.forEach(() => P0('Floor', 'Floor joist', F.size, F.joistLen));
    const sn = partNotes(F.rims, 'joint under a joist');
    for (let i = 0; i < F.skids; i++) F.rims.pieces.forEach((p, j) => P0('Floor', 'Skid', F.skidSize, p.len, sn[j]));
    M.sheets.push({ sec: 'Floor', mat: F.deck, w: C.sheetW, l: F.sheetL, count: F.deckSheets });
  }
  if (M.roof) {
    const R = M.roof, note = 'plumb cuts ' + pitchName(R.p);
    const count = R.type === 'gable' ? 2 * R.n : R.n;
    for (let i = 0; i < count; i++) P0('Roof', 'Rafter', R.rsize, R.rafterLen, note + ', notch over the wall', R.need);
    const barge = R.rake > 0.5 ? (R.type === 'gable' ? 4 : 2) : 0;
    for (let i = 0; i < barge; i++) P0('Roof', 'Barge rafter', R.rsize, R.rafterLen, note, R.need);
    if (R.ridge) { const rn = partNotes(R.ridge, 'joint over a rafter'); R.ridge.pieces.forEach((p, i) => P0('Roof', 'Ridge board', R.ridgeSize, p.len, rn[i])); }
    // rafter ties longer than the longest board: two pieces lapped at the middle, or butted with a scab across the joint
    const tieNote = 'at the top plates, ends cut to the roof slope';
    R.tieSplice = null;
    for (let i = 0; i < R.ties; i++) {
      if (R.B <= maxLen + 0.01 || SP.tie === 'none') { P0('Roof', 'Rafter tie', sizeName(0), R.B, tieNote); continue; }
      if (SP.tie === 'scab') {
        R.tieSplice = { how: 'scab', piece: R.B / 2, len: SP.len };
        for (let k = 1; k <= 2; k++) P0('Roof', 'Rafter tie', sizeName(0), R.B / 2, `part ${k} of 2, butt joint at the middle, ${tieNote}`);
        P0('Roof', 'Tie scab', sizeName(0), SP.len, 'nailed across the rafter tie joint');
      } else {
        R.tieSplice = { how: 'lap', piece: R.B / 2 + SP.len / 2, len: SP.len };
        for (let k = 1; k <= 2; k++) P0('Roof', 'Rafter tie', sizeName(0), R.B / 2 + SP.len / 2, `part ${k} of 2, lapped ${fmtCut(SP.len)} at the middle, ${tieNote}`);
      }
    }
  }
  // sheathing and panels
  const cv = b.cover;
  if (cv.wall) {
    const L = C.sheets[cv.wallSheet] || C.sheets[0], SW = C.sheetW; let total = 0; const strips = [];
    M.walls.forEach(fw => {
      const d = fw.def, drop = M.floor ? M.floor.jd + M.floor.deckT : 0, baseH = fw.wallTop + drop;
      const cols = Math.ceil(d.coverLen / SW - 1e-6); let cnt = 0;
      for (let i = 0; i < cols; i++) {
        let extra = 0;
        if (M.roof && d.fill) {
          const a = d.outToPlan(i * SW), e = d.outToPlan(Math.min((i + 1) * SW, d.coverLen)); const lo = Math.min(a, e), hi = Math.max(a, e), R = M.roof;
          let mx = Math.max(R.f(lo), R.f(hi)); if (R.type === 'gable' && lo < R.B / 2 && hi > R.B / 2) mx = Math.max(mx, R.f(R.B / 2));
          extra = Math.max(0, mx + R.rd * R.sf);
        }
        const h = baseH + extra, whole = Math.floor(h / L + 1e-6), rem = h - whole * L;
        cnt += whole; if (rem > 12) strips.push(rem);
      }
      total += cnt;
    });
    const bins = []; strips.sort((a, e) => e - a).forEach(h => { const i = bins.findIndex(x => x + h <= L + 0.01); if (i >= 0) bins[i] += h; else bins.push(h); });
    M.sheets.push({ sec: 'Walls', mat: cv.wallMat, w: SW, l: L, count: total + bins.length });
  }
  if (M.roof && cv.roof) {
    const R = M.roof, L = C.sheets[cv.roofSheet] || C.sheets[0], SW = C.sheetW;
    const slopeLen = R.type === 'gable' ? (R.B / 2 + R.eave) * R.sf : (R.B + 2 * R.eave) * R.sf;
    const along = R.Lr + 2 * R.rake, planes = R.type === 'gable' ? 2 : 1;
    const per = cv.roofDir === 'down' ? Math.ceil(along / SW - 1e-6) * Math.ceil(slopeLen / L - 1e-6) : Math.ceil(slopeLen / SW - 1e-6) * Math.ceil(along / L - 1e-6);
    R.slopeLen = slopeLen; R.along = along; R.planes = planes; R.area = slopeLen * along * planes;
    M.sheets.push({ sec: 'Roof', mat: cv.roofMat, w: SW, l: L, count: per * planes });
  }
  // boards
  const stocksFor = size => {
    const s = lens.map(n => ({ len: n, label: C === LUMBER.na ? Math.round(n / IN_MM / 12) + "'" : (+(n / 1000).toFixed(1)) + ' m', ft: true }));
    if (size === sizeName(b.stud) && b.stock.pre) s.push({ len: S, label: 'precut stud ' + fmtCut(S), ft: false });
    return s;
  };
  const lumber = M.pieces.filter(p => !p.ply), sizes = [...new Set(lumber.map(p => p.size))];
  M.boards = [];
  for (const size of sizes) {
    const res = packBoards(lumber.filter(p => p.size === size), stocksFor(size), kerf);
    if (res.error) { errs.push('A ' + size + ' ' + res.error.name.toLowerCase() + ' needs ' + fmtCut(res.error.need) + ' of board, longer than any board length picked. Turn on a longer board length.'); continue; }
    res.boards.forEach(x => M.boards.push(Object.assign(x, { size })));
  }
  if (errs.length) return { errs };
  M.wallTop = T + S + T * tp;
  M.peakFromFloor = M.roof ? M.wallTop + M.roof.peak : M.wallTop;
  M.peakFromGround = M.peakFromFloor + (M.floor ? M.floor.height : 0);
  return M;
}
function resolveFrameOpenings(d, list, errs) {
  const out = [];
  (list || []).forEach((o, i) => {
    const lab = (o.type === 'door' ? 'door ' : 'window ') + (i + 1), pre = d.name + ', ' + lab + ': ';
    if (!(o.w > 0) || !(o.h > 0)) { errs.push(pre + 'enter a rough opening width and height.'); return; }
    const sill = o.type === 'window' ? (o.sill || 0) : 0;
    if (o.type === 'window' && sill < 2 * LC().t - 0.01) { errs.push(pre + 'the sill height must be at least ' + fmtCut(2 * LC().t) + ' to fit the bottom plate and sill plate.'); return; }
    const roL = o.ctr ? (d.len - o.w) / 2 : (o.x || 0);
    const hdr = o.hdr === 'flat' ? { name: 'Flat ' + sizeName(0), size: sizeName(0), plies: 1, depth: LC().t, spacer: false } : { name: 'Double ' + sizeName(o.hdr), size: sizeName(o.hdr), plies: 2, depth: sizeDepth(o.hdr), spacer: true };
    out.push({ i, id: o.id, type: o.type, label: lab, w: o.w, h: o.h, sill, roL, roR: roL + o.w, top: o.type === 'door' ? o.h : sill + o.h, hd: hdr });
  });
  return out;
}
const FKIND = { end: 'End stud', common: 'Stud', king: 'King stud', jack: 'Jack stud', cripple: 'Cripple over header', lcripple: 'Cripple under sill' };
function frameWall(d, ops, M, errs) {
  const T = M.T, L = d.len, S = d.S, tp = M.tp, sp = M.sp, top = T + S, wallTop = top + T * tp;
  const pre = d.name + ', ', before = errs.length;
  if (L < 6 * T) { errs.push(d.name + ' is too short to frame.'); return null; }
  ops.sort((a, b) => a.roL - b.roL);
  ops.forEach((o, j) => {
    if (o.roL - 2 * T < T - 0.01) errs.push(pre + o.label + ' starts ' + fmtCut(o.roL) + ' from the left end. It needs at least ' + fmtCut(3 * T) + ' for the end stud, king stud and jack stud.');
    if (o.roR + 2 * T > L - T + 0.01) errs.push(pre + o.label + ' ends ' + fmtCut(L - o.roR) + ' from the right end. It needs at least ' + fmtCut(3 * T) + ' for the end stud, king stud and jack stud.');
    if (j > 0) { const p = ops[j - 1]; if (p.roR + 2 * T > o.roL - 2 * T + 0.01) errs.push(pre + p.label + ' and ' + o.label + ' overlap. Leave at least ' + fmtCut(4 * T) + ' between openings for their king and jack studs.'); }
    o.hTop = o.top + o.hd.depth; o.crip = top - o.hTop; o.lower = o.type === 'window' ? o.sill - 2 * T : 0;
    if (o.crip < -0.01) errs.push(pre + o.label + ': the ' + o.hd.name.toLowerCase() + ' header does not fit under the top plate. Lower the opening by ' + fmtCut(-o.crip) + ' or pick a smaller header.');
  });
  if (errs.length > before) return null;
  const m = []; const add = (kind, x, y0, y1, op) => m.push({ kind, x, y0, y1, op });
  add('end', 0, T, top); add('end', L - T, T, top);
  ops.forEach(o => { add('king', o.roL - 2 * T, T, top, o.id); add('jack', o.roL - T, T, o.top, o.id); add('jack', o.roR, T, o.top, o.id); add('king', o.roR + T, T, top, o.id); });
  for (let k = 1; k < 100000; k++) {
    const x = k * sp - T / 2; if (x + T > L - T + 0.01) break;
    const hit = ops.find(o => x + T > o.roL - 2 * T + 0.01 && x < o.roR + 2 * T - 0.01);
    if (!hit) { add('common', x, T, top); continue; }
    if (x >= hit.roL - T - 0.01 && x + T <= hit.roR + T + 0.01 && hit.crip >= 12) add('cripple', x, hit.hTop, top, hit.id);
    if (hit.type === 'window' && x >= hit.roL - 0.01 && x + T <= hit.roR + 0.01 && hit.lower >= 12) add('lcripple', x, T, hit.sill - T, hit.id);
  }
  ops.forEach(o => {
    if (o.type === 'window' && o.lower >= 12) [o.roL, o.roR - T].forEach(x => { if (x >= o.roL - 0.01 && !m.some(q => q.kind === 'lcripple' && Math.abs(q.x - x) < T - 0.01)) add('lcripple', x, T, o.sill - T, o.id); });
  });
  m.sort((a, b) => a.x - b.x || a.y0 - b.y0);
  const fill = [];
  if (d.fill) {
    const xs = [0]; for (let k = 1; k < 100000; k++) { const x = k * sp - T / 2; if (x + T > L - T + 0.01) break; xs.push(x); } xs.push(L - T);
    xs.forEach(x => { const h = d.fill(x, x + T); if (h >= 76) fill.push({ kind: 'fill', x, y0: wallTop, y1: wallTop + h }); });
  }
  const centers = m.filter(q => q.kind === 'end' || q.kind === 'common' || q.kind === 'king').map(q => q.x + T / 2).sort((a, b) => a - b);
  const mp = M.SP ? M.SP.min : 300;
  const bottom = splitRun(0, L, centers, M.maxLen, [], 0, mp), topP = splitRun(0, L, centers, M.maxLen, [], 0, mp);
  const cap = tp === 2 ? splitRun(d.capStart, d.capEnd, centers, M.maxLen, topP.splices, 610, mp) : null;
  const stud = sizeName(M.b.stud), sec = d.name, pieces = [];
  const P0 = (name, size, len, note, extra) => pieces.push(Object.assign({ sec, name, size, len, note: note || '', need: len }, extra || {}));
  const bn = partNotes(bottom, 'joint under a stud', ops.some(o => o.type === 'door') ? 'cut out at doors after the wall stands' : ''), tn = partNotes(topP, 'joint over a stud');
  bottom.pieces.forEach((p, i) => P0('Bottom plate', stud, p.len, bn[i]));
  topP.pieces.forEach((p, i) => P0('Top plate', stud, p.len, tn[i]));
  if (cap) { const cn = partNotes(cap, 'joints 24" from the top plate joints'.replace('24"', fmtCut(610))); cap.pieces.forEach((p, i) => P0('Cap plate', stud, p.len, cn[i])); }
  m.forEach(q => P0(FKIND[q.kind], stud, q.y1 - q.y0));
  ops.forEach(o => {
    for (let i = 0; i < o.hd.plies; i++) P0('Header', o.hd.size, o.w + 2 * T, o.label);
    if (o.hd.spacer) P0('Header spacer', LC().spacer, o.w + 2 * T, fmtCut(o.hd.depth) + ' wide, ' + o.label, { ply: true, wide: o.hd.depth });
    if (o.type === 'window') P0('Sill plate', stud, o.w, o.label);
  });
  if (M.roof) fill.forEach(q => P0(d.fillName, stud, q.y1 - q.y0, 'long point, top cut ' + pitchName(M.roof.p)));
  return { def: d, key: d.key, name: d.name, len: L, S, top, wallTop, ops, members: m, fill, bottom, topP, cap, pieces };
}
const frameErrors = () => (P.buildings || []).map(b => ({ b, M: frameModel(b) })).filter(x => x.M.errs && x.M.errs.length);

// a project that changes lumber catalog keeps its buildings: standard spacings, stud lengths and sheet sizes move to the
// nearest ones in the new catalog, everything else keeps its size
function convertBuildingsLumber(from, to) {
  const A = LUMBER[from], B = LUMBER[to]; if (!A || !B || A === B) return;
  const near = (list, v) => { let bi = 0; list.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(list[bi] - v)) bi = i; }); return bi; };
  const sp = v => B.sp[Math.min(B.sp.length - 1, near(A.sp, v))];
  for (const b of P.buildings || []) {
    b.sp = sp(b.sp); b.floor.sp = sp(b.floor.sp); b.roof.sp = sp(b.roof.sp);
    const si = A.studs.findIndex(x => Math.abs(x - b.studLen) < 1); if (si >= 0) b.studLen = B.studs[Math.min(si, B.studs.length - 1)];
    b.cover.wallSheet = Math.min(b.cover.wallSheet, B.sheets.length - 1); b.cover.roofSheet = Math.min(b.cover.roofSheet, B.sheets.length - 1);
    b.stock.pre = B.pre && b.stock.pre; b.stock.lens = (b.stock.lens || []).filter(i => i < B.stock.length); if (!b.stock.lens.length) b.stock.lens = B.stockOn.slice();
    b.kerf = B.kerf; FRAMECACHE.delete(b.id);
  }
}
