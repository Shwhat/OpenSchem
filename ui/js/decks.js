// ---------- decks: span tables, footings, framing, decking, stairs and railings ----------
// A deck is a building with mode 'deck' in P.buildings, so it shares the framing pages, lumber list, cut list, cutting
// plan and building views. Plan coordinates are real mm: x along the house (or the back edge), y away from it; z is the
// height above grade. A deck is made of rectangular platforms { id, x, y, w, d, h (top of decking) }: platforms of one
// height side by side make an L-shape, platforms of different heights are joined by steps.
// Suggested sizes follow the AWC DCA 6 Prescriptive Residential Wood Deck Construction Guide (2012 IRC edition, 40 psf
// live load, 10 psf dead load, No. 2 grade, wet service) and IRC Table R507.7 for decking. They are suggestions that
// follow those tables, not an engineering approval; the local building department decides.
const DCA6 = {
  ft: (f, i = 0) => (f * 12 + i) * IN_MM,
  species: [['sp', 'Southern pine'], ['dfl', 'Douglas fir-larch'], ['hf', 'Hem-fir'], ['spf', 'Spruce-pine-fir']],
  // Table 2: joist span and overhang (inches) at 12, 16, 24 in on center, for 2x6, 2x8, 2x10, 2x12
  joist: {
    sp: { span: [[119, 108, 91], [157, 142, 116], [194, 168, 137], [216, 198, 162]], over: [[12, 13, 15], [22, 24, 28], [37, 41, 34], [54, 50, 40]] },
    dfl: { span: [[114, 100, 82], [150, 133, 109], [188, 163, 133], [216, 189, 154]], over: [[11, 12, 14], [20, 22, 26], [34, 38, 33], [52, 47, 39]] },
  },
  // Table 3A: beam span (inches) for joist spans of 6, 8, 10, 12, 14, 16, 18 ft; keys ply-size (size index 1 = 2x6 ... 4 = 2x12)
  beam: {
    sp: { '2-1': [80, 68, 61, 55, 51, 48, 45], '2-2': [102, 88, 78, 71, 66, 61, 57], '2-3': [121, 105, 93, 85, 78, 73, 69], '2-4': [143, 124, 110, 100, 93, 87, 81],
      '3-1': [95, 86, 77, 70, 65, 60, 57], '3-2': [127, 111, 99, 90, 83, 77, 73], '3-3': [153, 132, 117, 105, 99, 92, 87], '3-4': [180, 156, 139, 126, 117, 109, 103] },
    dfl: { '2-1': [62, 53, 47, 43, 39, 34, 30], '2-2': [79, 68, 61, 55, 51, 46, 41], '2-3': [97, 84, 75, 68, 63, 58, 53], '2-4': [113, 98, 87, 79, 73, 68, 64],
      '3-1': [85, 77, 69, 63, 58, 54, 51], '3-2': [113, 99, 88, 80, 74, 69, 65], '3-3': [141, 122, 109, 99, 91, 85, 80], '3-4': [164, 142, 126, 115, 106, 99, 94] },
  },
  // Table 4: 6x6 post height (ft; 0 = not permitted) for SP, DFL, HF, SPF and footing round diameter, square side, thickness (in),
  // by beam span 6 to 18 ft and joist span up to 10, 14 and 18 ft
  post: {
    6: [[14, 14, 14, 14, 18, 16, 7], [14, 14, 14, 14, 21, 18, 8], [14, 14, 12, 11, 24, 21, 10]],
    8: [[14, 14, 14, 14, 20, 18, 8], [14, 14, 14, 11, 24, 21, 10], [14, 13, 11, 8, 27, 24, 11]],
    10: [[14, 14, 14, 12, 23, 20, 9], [14, 13, 11, 8, 27, 24, 11], [12, 11, 8, 2, 31, 27, 13]],
    12: [[14, 14, 12, 10, 25, 22, 10], [13, 12, 9, 5, 30, 26, 13], [11, 9, 6, 2, 34, 30, 15]],
    14: [[14, 13, 11, 8, 27, 24, 11], [11, 10, 7, 2, 32, 29, 14], [9, 8, 2, 0, 37, 33, 16]],
    16: [[13, 12, 10, 6, 29, 26, 12], [10, 9, 5, 2, 35, 31, 15], [7, 5, 2, 0, 40, 35, 18]],
    18: [[12, 11, 8, 2, 31, 27, 13], [9, 8, 2, 0, 37, 33, 16], [5, 2, 2, 0, 42, 37, 19]],
  },
  // Table 5: ledger fastener spacing (in) into a 1 1/2" band for joist spans up to 6, 8, 10, 12, 14, 16, 18 ft
  ledger: { lag: [30, 23, 18, 15, 13, 11, 10], bolt: [36, 36, 34, 29, 24, 21, 19] },
  // IRC Table R507.7: joist spacing (in) for wood decking, perpendicular and diagonal
  decking: { '54': [16, 12], '2x6': [24, 16] },
  riser: 7.75, tread: 10, stairW: 36, stringerSpan: 72, stringerSp: 18, guardAt: 30, guardH: 36, sphere: 4, maxJoist: 216,
};
const sgrp = s => s === 'sp' ? 'sp' : 'dfl';
const spCol = sp => { const i = sp / IN_MM; return i <= 12.01 ? 0 : i <= 16.01 ? 1 : 2; };
const jspan = (sp, size, sp_) => DCA6.joist[sgrp(sp)].span[size - 1][spCol(sp_)] * IN_MM;
const jover = (sp, size, sp_) => DCA6.joist[sgrp(sp)].over[size - 1][spCol(sp_)] * IN_MM;
const jcol = J => Math.min(6, Math.max(0, Math.ceil((J / IN_MM / 12 - 6) / 2 - 1e-6)));
const beamMax = (sp, ply, size, J) => { const r = DCA6.beam[sgrp(sp)][ply + '-' + size]; return r && J <= DCA6.ft(18) + 1 ? r[jcol(J)] * IN_MM : 0; };
function postRow(LB, J) { const c = Math.min(18, Math.max(6, 2 * Math.ceil(LB / IN_MM / 24 - 1e-6))); const r = J <= DCA6.ft(10) + 1 ? 0 : J <= DCA6.ft(14) + 1 ? 1 : 2; return { LBc: c, Jr: [10, 14, 18][r], row: DCA6.post[c][r] }; }
const SPI = { sp: 0, dfl: 1, hf: 2, spf: 3 };
const DECK_MATS = { '54': ['5/4x6 wood decking', 1, 5.5], '2x6': ['2x6 wood decking', 1.5, 5.5], comp: ['Composite decking', 1, 5.5] };
const DECK_LAYS = [['square', 'Square to the joists'], ['diag', 'Diagonal (45°)'], ['frame', 'Picture frame border'], ['breaker', 'Breaker board']];
const DECK_KINDS = [['ledger', 'Attached to the house with a ledger'], ['free', 'Freestanding'], ['ground', 'Ground level (beams on footings)']];
const isDeck = b => b && b.mode === 'deck';

function newDeck(o = {}) {
  const m = lumberKey() === 'metric', c = LC(), I = v => v * IN_MM;
  const w = o.w || (m ? 4800 : I(192)), d = o.d || (m ? 3600 : I(144)), h = o.h || (m ? 900 : I(36));
  return {
    id: uid(), name: o.name || 'Deck', mode: 'deck', kind: o.kind || 'ledger', species: 'sp',
    plats: o.plats || [{ id: uid(), x: 0, y: 0, w, d, h }],
    joist: -1, sp: -1, cant: -1, beam: { ply: -1, size: -1, posts: -1 },
    dk: { mat: '54', lay: 'square', gap: m ? 3 : I(1 / 8), compSp: I(16) },
    stairs: [], rail: { mode: 'auto', h: I(36), postSp: I(72) }, fast: 'lag', frost: m ? 300 : I(12),
    walls: {}, stock: { pre: false, lens: c.stockOn.slice() }, kerf: c.kerf, splice: spliceDefaults(), link: o.link || null,
  };
}
function newDeckStair(b, o = {}) { const m = lumberKey() === 'metric'; return Object.assign({ id: uid(), plat: 0, side: 'front', at: 0, w: m ? 1000 : 48 * IN_MM, to: 'grade' }, o); }
// linked decks: the size follows a floor plan room, a floor plan wall or a building wall
function deckSyncLink(b) {
  const L = b.link; if (!L || !b.plats.length) return; const p = b.plats[0]; b._lost = false;
  if (L.kind === 'room') {
    const lv = (P.levels || []).find(l => l.id === L.level), r = lv && lv.rooms.find(x => x.id === L.room); if (!r) { b._lost = true; return; }
    const k = lvScale(lv), bb = bboxPts(roomPoly(r)); p.w = Math.round((bb[2] - bb[0]) * k); p.d = Math.round((bb[3] - bb[1]) * k);
  } else if (L.kind === 'wall') {
    const lv = (P.levels || []).find(l => l.id === L.level), w = lv && wallById(lv, L.wall); if (!w) { b._lost = true; return; }
    p.w = Math.round(wallAxis(w).len * lvScale(lv));
  } else if (L.kind === 'bwall') {
    const bb = (P.buildings || []).find(x => x.id === L.bld); const M = bb && !isDeck(bb) ? frameModel(bb) : null; const fw = M && M.walls && M.walls.find(x => x.key === L.wall);
    if (!fw) { b._lost = true; return; } p.w = Math.round(fw.len + (L.wall === 'right' || L.wall === 'left' ? 2 * M.WD : 0));
  }
}

// ---------- the model ----------
function deckModel0(b) {
  const C = LC(), T = C.t, errs = [], warns = [], notes = [];
  const lens = (b.stock.lens || []).map(i => C.stock[i]).filter(Boolean).sort((a, c) => a - c);
  if (!lens.length) return { errs: ['Pick at least one board length in the deck\'s lumber settings.'] };
  if (!b.plats.length) return { errs: ['The deck has no sections.'] };
  const maxLen = lens[lens.length - 1], kerf = Math.max(0, b.kerf || 0), SP = spliceOf(b), sp_ = b.species || 'sp';
  const mat = DECK_MATS[b.dk.mat] || DECK_MATS['54'], dt = mat[1] * IN_MM, bw = mat[2] * IN_MM, gap = Math.max(0, b.dk.gap || 0);
  const diag = b.dk.lay === 'diag';
  const dkMax = b.dk.mat === 'comp' ? (diag ? Math.min(12 * IN_MM, b.dk.compSp) : b.dk.compSp) : DCA6.decking[b.dk.mat][diag ? 1 : 0] * IN_MM;
  const sp = b.sp > 0 ? b.sp : Math.min(16 * IN_MM, dkMax);
  if (sp > dkMax + 0.5) warns.push(`${mat[0]} ${diag ? 'laid diagonally ' : ''}needs joists at ${fmtCut(dkMax)} on center or closer; the joists are at ${fmtCut(sp)}.`);
  const M = { b, mode: 'deck', _concrete: 0, T, dt, bw, gap, sp, maxLen, kerf, SP, plats: [], pieces: [], sheets: [], hw: [], errs, warns, notes, walls: [], stairs: [] };
  const P0 = (sec, name, size, len, note, need) => M.pieces.push({ sec, name, size, len, note: note || '', need: need === undefined ? len : need });
  const pt = ' ' + C.treated, sz = i => sizeName(i) + pt;
  const postName = C === LUMBER.na ? '6x6' : '145x145', rpName = C === LUMBER.na ? '4x4' : '95x95', balName = C === LUMBER.na ? '2x2' : '45x45';
  const HW = new Map(); const hw = (item, size, qty, note = '') => { if (!(qty > 0)) return; const k = item + '|' + size + '|' + note; HW.set(k, Object.assign(HW.get(k) || { item, size, note, qty: 0 }, {})); HW.get(k).qty += qty; };
  const ledgerOf = p => b.kind === 'ledger' && p.y < 1;
  b.plats.forEach((p, pi) => {
    const pre = b.plats.length > 1 ? `Section ${pi + 1}: ` : '';
    if (!(p.w >= 900 && p.d >= 900)) { errs.push(pre + 'A deck section must be at least ' + formatLength(900) + ' wide and deep.'); return; }
    if (!(p.h > 0)) { errs.push(pre + 'Enter the deck height.'); return; }
    const led = ledgerOf(p), D = p.d;
    // joists: the smallest size that spans with the table's cantilever
    const fit = size => {
      const LO = jover(sp_, size, sp), Lmax = jspan(sp_, size, sp);
      const ends = led ? 1 : 2, room = D - (led ? T : 0);
      let c = b.cant >= 0 ? b.cant : Math.min(LO, room / (ends === 1 ? 5 : 6)); c = Math.floor(c / (IN_MM / 2)) * (IN_MM / 2);
      const span = room - ends * c, n = Math.max(1, Math.ceil(span / Lmax - 1e-6)), bay = span / n;
      return { size, LO, Lmax, c, span, n, bay, ok: n === 1 && c <= Math.min(LO, span / 4) + 0.5 && span <= DCA6.ft(18) + 1 };
    };
    let J = b.joist >= 1 ? fit(b.joist) : [1, 2, 3, 4].map(fit).find(f => f.ok);
    if (!J) { J = fit(4); notes.push(pre + `the joists need ${J.n} spans (${fmtCut(J.bay)} each) with a beam under each joint; DCA 6 covers single spans only.`); }
    if (b.joist >= 1 && J.n > 1) warns.push(pre + `${sizeName(J.size)} joists at ${fmtCut(sp)} on center span ${fmtCut(J.Lmax)} at most (DCA 6 Table 2), so the joists get ${J.n} spans with a beam under each joint; DCA 6 covers single spans only.`);
    if (b.joist >= 1 && J.bay > J.Lmax + 0.5) warns.push(pre + `${sizeName(J.size)} joists at ${fmtCut(sp)} on center span ${fmtCut(J.bay)}, over the ${fmtCut(J.Lmax)} in DCA 6 Table 2.`);
    if (J.c > Math.min(J.LO, J.bay / 4) + 0.5) warns.push(pre + `the ${fmtCut(J.c)} cantilever is over the ${fmtCut(Math.min(J.LO, J.bay / 4))} allowed (DCA 6 Table 2, and a quarter of the span).`);
    const js = J.size, jd = sizeDepth(js);
    if (js < 2 && (led || p.h > DCA6.guardAt * IN_MM)) notes.push(pre + (led ? 'the ledger and the rim joists are 2x8 (DCA 6 minimum with a ledger).' : 'the rim and end joists are 2x8 (DCA 6 minimum with guards).'));
    const rimSize = Math.max(js, led || p.h > DCA6.guardAt * IN_MM ? 2 : js);
    // joist positions along x (left faces), doubled under a breaker board
    const xs = layoutPositions(p.w, sp, T);
    if (b.dk.lay === 'breaker') { const mid = p.w / 2 - T; if (!xs.some(x => Math.abs(x - mid) < 1)) xs.push(mid); xs.push(mid + T); xs.sort((a, c) => a - c); }
    // beam lines (y centers)
    const yB = []; const y0 = led ? T : 0;
    if (led) for (let k = 1; k <= J.n; k++) yB.push(y0 + k * J.bay); else for (let k = 0; k <= J.n; k++) yB.push(J.c + k * J.bay);
    // beams: fewest posts, then the smallest beam (DCA 6 Table 3A)
    const Jtrib = (k) => (led ? (k === J.n - 1 ? J.bay + J.c : 2 * J.bay) : (k === 0 || k === J.n ? J.bay + J.c : 2 * J.bay));
    const Jmax = Math.max(...yB.map((_, k) => Jtrib(led ? k : k)));
    // a low deck only takes beams that fit under it (flush with the joists)
    const room = p.h - dt - 2 * IN_MM, all = [[2, 1], [2, 2], [2, 3], [2, 4], [3, 2], [3, 3], [3, 4]], fitIn = all.filter(([, z]) => sizeDepth(z) <= room + 0.5);
    const opts = b.beam.ply > 0 && b.beam.size > 0 ? [[b.beam.ply, b.beam.size]] : (fitIn.length ? fitIn : all).filter(([, z]) => z >= 2 || !fitIn.some(([, q]) => q >= 2));
    let best = null;
    for (const [ply, size] of opts) {
      const LBmax = beamMax(sp_, ply, size, Jmax);
      for (let n = 2; n <= 40; n++) {
        if (b.beam.posts >= 2 && n !== b.beam.posts) continue;
        const e = Math.min(IN_MM * 12, p.w / (4 * (n - 1) + 2)), LB = (p.w - 2 * e) / (n - 1);
        if (LB <= LBmax + 0.5 || b.beam.posts >= 2) { const cand = { ply, size, n, e, LB, LBmax }; if (!best || n < best.n) best = cand; break; }
      }
    }
    if (!best) { errs.push(pre + `no beam in DCA 6 Table 3A carries joists spanning ${fmtCut(Jmax)} (18' is the most in the table). Add a section or shorten the joists.`); return; }
    if (best.LB > best.LBmax + 0.5) warns.push(pre + `the ${best.ply}-${sizeName(best.size)} beam spans ${fmtCut(best.LB)} between posts, over the ${fmtCut(best.LBmax)} in DCA 6 Table 3A.`);
    const bd = sizeDepth(best.size), postXs = Array.from({ length: best.n }, (_, i) => best.e + i * best.LB);
    // heights: decking on joists on a drop beam on posts; ground level decks set the beams on the footings
    // low decks hang the joists from the beam (flush beam), and set the beam on the piers when there is no room for a post
    const zTop = p.h, zJ = zTop - dt, pier = 2 * IN_MM, minPost = 6 * IN_MM;
    const flush = zJ - jd - bd - pier < (b.kind === 'ground' ? 0 : minPost);
    const zBeamTop = flush ? zJ : zJ - jd, zBeamBot = zBeamTop - bd;
    const ground = b.kind === 'ground' || zBeamBot - pier < minPost, postH = ground ? 0 : zBeamBot - pier;
    if (zBeamBot < pier - 0.5) errs.push(pre + `the deck is too low: decking and a ${sizeName(best.size)} beam need ${fmtCut(dt + bd + pier)} above grade.`);
    if (flush) notes.push(pre + `the joists hang from the side of the beam${ground && b.kind !== 'ground' ? ' and the beam sits on the piers' : ''} to keep the deck low.`);
    const pr = postRow(best.LB, Jmax), lim = pr.row[SPI[sp_] || 0] * 12 * IN_MM;
    if (!ground && (lim === 0 || postH > lim + 0.5)) warns.push(pre + (lim === 0 ? `DCA 6 Table 4 does not permit 6x6 ${DCA6.species.find(s => s[0] === sp_)[1].toLowerCase()} posts with these spans.` : `posts are ${fmtCut(postH)} tall, over the ${pr.row[SPI[sp_] || 0]}' in DCA 6 Table 4.`));
    const foot = { round: pr.row[4] * IN_MM, square: pr.row[5] * IN_MM, thick: pr.row[6] * IN_MM, depth: Math.max(12 * IN_MM, b.frost || 0) };
    const beams = yB.map(y => ({ y, ply: best.ply, size: best.size, bd, posts: postXs.map(x => ({ x, y })) }));
    const Pm = { p, pi, led, J, js, jd, rimSize, xs, beams, best, zTop, zJ, zBeamTop, zBeamBot, postH, foot, pr, ground, flush, x0: p.x, y0: p.y };
    M.plats.push(Pm);
    // ---- pieces: posts and footings, beams, ledger, joists, rims, blocking
    const posts = beams.flatMap(B => B.posts);
    if (!ground) posts.forEach(() => P0('Posts', 'Post', postName + pt, postH, 'square cut, post base and post cap'));
    hw('Concrete footing', `${fmtCut(foot.round)} round x ${fmtCut(foot.thick)} thick`, posts.length, `bottom ${fmtCut(foot.depth)} or more below grade`);
    const vol = posts.length * (Math.PI * (foot.round / 2) ** 2 * foot.thick + Math.PI * (5 * IN_MM) ** 2 * Math.max(0, foot.depth - foot.thick + pier)) / 1e9;
    M._concrete = (M._concrete || 0) + vol;
    if (!ground) { hw('Post base', postName, posts.length, 'standoff, set in the pier'); hw('Post cap', `${postName} to ${best.ply}-ply beam`, posts.length); }
    else hw('Beam bracket on pier', `${best.ply}-ply ${sizeName(best.size)}`, posts.length);
    beams.forEach((B, k) => {
      for (let ply = 0; ply < B.ply; ply++) {
        const run = splitRun(0, p.w, postXs, maxLen, ply ? beams[k]._spl || [] : [], ply ? 1 : 0, SP.min);
        if (!ply) B._spl = run.splices; B.splices = (B.splices || []).concat(run.splices);
        const nt = partNotes(run, 'joint over a post');
        run.pieces.forEach((q, i) => P0('Beams', 'Beam ply', sz(B.size), q.len, nt[i]));
      }
      hw('Beam bolts', '1/2" x ' + (B.ply === 3 ? '6"' : '4"') + ' carriage bolt', Math.ceil(p.w / (16 * IN_MM)) * 2, 'two every 16"');
    });
    if (led) {
      const run = splitRun(0, p.w, xs.map(x => x + T / 2), maxLen, [], 0, SP.min); Pm.ledgerSplices = run.splices;
      const nt = partNotes(run, 'joint at a joist'); run.pieces.forEach((q, i) => P0('Joists', 'Ledger', sz(rimSize), q.len, nt[i]));
      const sp2 = DCA6.ledger[b.fast === 'bolt' ? 'bolt' : 'lag'][Math.min(6, Math.max(0, Math.ceil(J.bay / IN_MM / 24 - 1e-6) - 3))];
      Pm.ledgerSp = sp2 * IN_MM;
      hw(b.fast === 'bolt' ? 'Ledger bolts' : 'Ledger lag screws', b.fast === 'bolt' ? '1/2" through-bolt with washers' : '1/2" x 4" lag screw with washer', Math.ceil(p.w / (sp2 * IN_MM)) + 1, `${sp2}" on center, staggered (DCA 6 Table 5)`);
      hw('Ledger flashing', 'corrosion-resistant metal', Math.ceil(p.w / (10 * 12 * IN_MM)), "10' lengths");
      hw('Lateral load tension device', '1500 lb', 2, 'ties the deck joists to the house floor joists');
      hw('Joist hanger', sizeName(js), xs.length, 'at the ledger');
    }
    // joists: one piece per span over the beams (lapped over interior beams)
    const lap = 12 * IN_MM;
    const jl = [];
    if (led) { for (let k = 0; k < J.n; k++) jl.push(J.bay + (k === J.n - 1 ? J.c - T : lap / 2) + (k ? lap / 2 : 0)); }
    else { for (let k = 0; k < J.n; k++) jl.push(J.bay + (k === 0 ? J.c : lap / 2) + (k === J.n - 1 ? J.c - T : lap / 2)); }
    Pm.joistLens = jl;
    xs.forEach((x, i) => jl.forEach((L, k) => P0('Joists', i === 0 || i === xs.length - 1 ? 'End joist' : 'Joist', sz(i === 0 || i === xs.length - 1 ? rimSize : js), L, J.n > 1 ? `span ${k + 1} of ${J.n}, lapped over the beam` : '')));
    const rim = splitRun(0, p.w, xs.map(x => x + T / 2), maxLen, [], 0, SP.min); Pm.rimSplices = rim.splices;
    const rn = partNotes(rim, 'joint over a joist'); rim.pieces.forEach((q, i) => P0('Joists', 'Rim joist', sz(rimSize), q.len, rn[i]));
    if (!led) rim.pieces.forEach((q, i) => P0('Joists', 'Rim joist', sz(rimSize), q.len, (rn[i] ? rn[i] + ', ' : '') + 'back'));
    // blocking over each beam between the joists
    let blocks = 0; beams.forEach(() => { for (let i = 0; i < xs.length - 1; i++) { const L = xs[i + 1] - xs[i] - T; if (L > 10) { P0('Joists', 'Blocking', sz(js), L, 'over the beam'); blocks++; } } });
    if (flush) hw('Joist hanger', sizeName(js), xs.length * beams.reduce((n, B, k) => n + ((led ? k < beams.length - 1 : k > 0 && k < beams.length - 1) ? 2 : 1), 0), 'at the flush beams'); else hw('Joist-to-beam clip', 'hurricane tie, 100 lb uplift and lateral', xs.length * beams.length);
    hw('Rim joist screws', 'No. 10 x 3" structural screw', xs.length * (led ? 3 : 6), 'three into each joist end');
    // ---- decking
    deckBoards(M, Pm, P0, hw);
  });
  if (errs.length) return { errs };
  // ---- stairs (to grade, or steps between sections of different heights) and railings
  deckStairs(M, P0, hw);
  deckRails(M, P0, hw);
  if (errs.length) return { errs };
  const bag = C === LUMBER.na ? 0.6 * 0.0283168 : 0.0115;
  hw('Concrete mix', C === LUMBER.na ? '80 lb bag' : '25 kg bag', Math.ceil((M._concrete || 0) / bag - 1e-9), (M._concrete || 0).toFixed(2) + ' m³ for footings and piers');
  M.hw = [...HW.values()];
  // ---- boards
  const stocks = (comp) => (comp ? (C === LUMBER.na ? [12, 16, 20].map(f => f * 12 * IN_MM) : [3660, 4880, 6100]) : lens).map(n => ({ len: n, label: C === LUMBER.na ? Math.round(n / IN_MM / 12) + "'" : (+(n / 1000).toFixed(1)) + ' m', ft: true }));
  M.boards = [];
  for (const size of [...new Set(M.pieces.map(p => p.size))]) {
    const res = packBoards(M.pieces.filter(p => p.size === size), stocks(/^Composite/.test(size)), kerf);
    if (res.error) { errs.push('A ' + size + ' ' + res.error.name.toLowerCase() + ' needs ' + fmtCut(res.error.need) + ' of board, longer than any board length picked. Turn on a longer board length.'); continue; }
    res.boards.forEach(x => M.boards.push(Object.assign(x, { size })));
  }
  if (errs.length) return { errs };
  const xs = M.plats.flatMap(m => [m.p.x, m.p.x + m.p.w]), ys = M.plats.flatMap(m => [m.p.y, m.p.y + m.p.d]);
  M.X0 = Math.min(...xs); M.Y0 = Math.min(...ys); M.W = Math.max(...xs) - M.X0; M.D = Math.max(...ys) - M.Y0;
  M.top = Math.max(...M.plats.map(m => m.zTop)); M.wallTop = M.top + (M.rails.length ? b.rail.h : 0);
  M.peakFromGround = M.wallTop;
  return M;
}

// ---------- decking boards ----------
function deckBoards(M, Pm, P0, hw) {
  const b = M.b, p = Pm.p, T = M.T, bw = M.bw, g = M.gap, pitch = bw + g, mat = DECK_MATS[b.dk.mat], comp = b.dk.mat === 'comp';
  const size = comp ? 'Composite ' + (lumberKey() === 'na' ? '1x6' : '25x140') : (lumberKey() === 'na' ? (b.dk.mat === '54' ? '5/4x6' : '2x6') : (b.dk.mat === '54' ? '28x140' : '45x145')) + ' ' + LC().treated;
  const jc = Pm.xs.map(x => x + T / 2), minP = Math.max(2 * M.sp + T, M.SP.min);
  const boards = []; let crossings = 0;
  const run = (x0, x1, y, avoid, name, note) => {
    const r = splitRun(x0, x1, jc.filter(c => c > x0 + 1 && c < x1 - 1), M.maxLen, avoid, 2 * M.sp - 1, minP);
    const nt = partNotes(r, 'butt joint over a joist', note);
    r.pieces.forEach((q, i) => { P0('Decking', name, size, q.len, nt[i]); boards.push({ pts: ccwRect(q.x0, y, q.x1, y + bw), name }); crossings += jc.filter(c => c > q.x0 && c < q.x1).length; });
    return r.splices;
  };
  const lay = b.dk.lay, inset = lay === 'frame' ? pitch : 0;
  if (lay === 'diag') {
    // boards at 45 degrees: strips clipped to the section, joints over the joists
    const s2 = Math.SQRT2, rect = ccwRect(0, 0, p.w, p.d); const n = Math.ceil((p.w + p.d) / (pitch * s2)) + 1; let prev = [];
    for (let i = 0; i < n; i++) {
      const c0 = -p.d + i * pitch * s2, a = [c0, 0], dir = [1, 1];
      let strip = clipLine(rect, a, [a[0] + dir[0], a[1] + dir[1]], -1); strip = clipLine(strip, [c0 + bw * s2, 0], [c0 + bw * s2 + 1, 1], 1);
      if (strip.length < 3 || tArea(strip) < bw * 50) continue;
      // the board's centerline runs from (u0) to (u1) along x; joints where it crosses a joist
      const xsA = strip.map(q => q[0]); const u0 = Math.min(...xsA), u1 = Math.max(...xsA);
      const r = splitRun(u0, u1, jc.filter(c => c > u0 + 1 && c < u1 - 1), M.maxLen / s2, prev, (2 * M.sp - 1), minP / s2);
      prev = r.splices;
      const nt = partNotes(r, 'butt joint over a joist', '45° ends');
      r.pieces.forEach((q, k) => { const len = q.len * s2 + bw; P0('Decking', 'Decking', size, len, nt[k]); crossings += jc.filter(c => c > q.x0 && c < q.x1).length;
        boards.push({ pts: clipLine(clipLine(strip, [q.x0, 0], [q.x0, 1], -1), [q.x1, 0], [q.x1, 1], 1), name: 'Decking' }); });
    }
  } else {
    const rows = Math.ceil((p.d - 2 * inset + g) / pitch - 1e-6); let prev = [];
    for (let i = 0; i < rows; i++) {
      const y = inset + i * pitch, last = i === rows - 1 && p.d - inset - y < bw - 1, note = last ? 'ripped to ' + fmtCut(p.d - inset - y) : '';
      if (lay === 'breaker') { const mid = p.w / 2; const s1 = run(0, mid - bw / 2 - g, y, prev, 'Decking', note); const s2 = run(mid + bw / 2 + g, p.w, y, prev, 'Decking', note); prev = s1.concat(s2); }
      else prev = run(inset, p.w - inset, y, prev, 'Decking', note);
    }
    if (lay === 'breaker') { const r = splitRun(0, p.d, [], M.maxLen, [], 0, M.SP.min); r.pieces.forEach(q => { P0('Decking', 'Breaker board', size, q.len, 'over the doubled joists'); boards.push({ pts: ccwRect(p.w / 2 - bw / 2, q.x0, p.w / 2 + bw / 2, q.x1), name: 'Breaker board' }); }); }
    if (lay === 'frame') {
      for (const yy of [0, p.d - bw]) { const r = splitRun(0, p.w, jc, M.maxLen, [], 0, minP); r.pieces.forEach(q => { P0('Decking', 'Border board', size, q.len, '45° miters at the corners'); boards.push({ pts: ccwRect(q.x0, yy, q.x1, yy + bw), name: 'Border board' }); }); }
      for (const xx of [0, p.w - bw]) { const r = splitRun(bw, p.d - bw, [], M.maxLen, [], 0, M.SP.min); r.pieces.forEach(q => { P0('Decking', 'Border board', size, q.len + 2 * bw, '45° miters at the corners'); boards.push({ pts: ccwRect(xx, q.x0, xx + bw, q.x1), name: 'Border board' }); }); }
      // border boards along the end joists need blocking between the end joist and the next joist
      const nB = Math.ceil(p.d / M.sp) + 1, L = Pm.xs.length > 1 ? Pm.xs[1] - Pm.xs[0] - T : 0;
      for (let k = 0; k < 2 * nB; k++) if (L > 10) P0('Joists', 'Border blocking', sizeName(Pm.js) + ' ' + LC().treated, L, 'flush with the joist tops, under the border');
    }
  }
  Pm.boards = boards;
  if (comp) { hw('Hidden fastener clip', mat[0], crossings, 'one at each joist'); hw('Starter clip', mat[0], Math.ceil(p.w / (16 * IN_MM)) + 2); }
  else hw('Deck screws', '#10 x ' + (b.dk.mat === '54' ? '2 1/2"' : '3"') + ' coated', crossings * 2, 'two at each joist');
}

// ---------- stairs and steps ----------
function deckStairList(b) {
  const out = b.stairs.map(s => Object.assign({}, s));
  // steps between touching sections of different heights
  b.plats.forEach((A, i) => b.plats.forEach((B2, j) => {
    if (i === j || A.h <= B2.h + 25) return;
    const ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
    const tol = 2; let side = null, o = null;
    if (Math.abs(A.y + A.d - B2.y) < tol) { side = 'front'; o = ov(A.x, A.x + A.w, B2.x, B2.x + B2.w); }
    else if (Math.abs(B2.y + B2.d - A.y) < tol) { side = 'back'; o = ov(A.x, A.x + A.w, B2.x, B2.x + B2.w); }
    else if (Math.abs(A.x + A.w - B2.x) < tol) { side = 'right'; o = ov(A.y, A.y + A.d, B2.y, B2.y + B2.d); }
    else if (Math.abs(B2.x + B2.w - A.x) < tol) { side = 'left'; o = ov(A.y, A.y + A.d, B2.y, B2.y + B2.d); }
    if (!side || o[1] - o[0] < 900) return;
    const s0 = side === 'front' || side === 'back' ? A.x : A.y;
    out.push({ id: 'steps:' + A.id + ':' + B2.id, plat: i, side, at: o[0] - s0, w: o[1] - o[0], to: j, auto: true });
  }));
  return out;
}
function deckStairs(M, P0, hw) {
  const b = M.b, T = M.T, C = LC(), rs = [];
  for (const s of deckStairList(b)) {
    const Pm = M.plats[s.plat]; if (!Pm) continue; const p = Pm.p;
    const toH = s.to === 'grade' ? 0 : (M.plats[s.to] ? M.plats[s.to].zTop : 0), rise = Pm.zTop - toH;
    if (rise < 50) continue;
    const n = Math.ceil(rise / (DCA6.riser * IN_MM) - 1e-6), riser = rise / n;
    const per = 2 * M.bw + M.gap >= DCA6.tread * IN_MM ? 2 : 3, tread = per * M.bw + (per - 1) * M.gap;
    const run = (n - 1) * tread, w = Math.max(s.w, 0);
    if (w < DCA6.stairW * IN_MM - 0.5) M.warns.push(`Stairs ${rs.length + 1} are ${fmtCut(w)} wide; the least is ${DCA6.stairW}".`);
    const nStr = Math.max(3, Math.ceil(w / (DCA6.stringerSp * IN_MM) - 1e-6) + 1);
    const strLen = Math.hypot(run + tread, rise) + 2 * IN_MM, supports = run > DCA6.stringerSpan * IN_MM + 0.5 ? Math.ceil(run / (DCA6.stringerSpan * IN_MM)) - 1 : 0;
    if (rise > 12 * 12 * IN_MM) M.warns.push(`Stairs ${rs.length + 1} rise more than 12'; DCA 6 asks for a landing part way.`);
    // where the stairs start: on the section's edge
    const along = s.side === 'front' || s.side === 'back';
    const e0 = (along ? p.x : p.y) + (s.at || 0);
    const R = { s, Pm, rise, n, riser, tread, per, run, w, nStr, strLen, supports, side: s.side, e0, toH, auto: !!s.auto, name: s.auto ? 'Steps' : 'Stairs' };
    rs.push(R);
    const sec = 'Stairs', label = `${R.name} ${rs.length}`;
    for (let i = 0; i < nStr; i++) P0(sec, 'Stringer', sizeName(4) + ' ' + C.treated, strLen, `${label}: ${n} risers of ${fmtCut(riser)}, ${n - 1} treads of ${fmtCut(tread)}`);
    for (let i = 0; i < (n - 1) * per; i++) P0(sec, 'Tread', M.pieces.find(q => q.sec === 'Decking').size, w, label);
    hw('Stair stringer connector', sizeName(4), nStr, label);
    if (supports) { for (let k = 0; k < supports * 2; k++) P0(sec, 'Stair post', (C === LUMBER.na ? '4x4' : '95x95') + ' ' + C.treated, Math.max(300, riser * n / 2), label + ', support under the stringers'); hw('Concrete footing', '12" round x 6" thick', supports * 2, label + ', stringer support posts'); M._concrete += supports * 2 * Math.PI * (6 * IN_MM) ** 2 * 6 * IN_MM / 1e9; }
    if (s.to === 'grade') { hw('Landing', `${fmtCut(Math.max(w, 36 * IN_MM))} x 36" concrete or pavers`, 1, label + ', at the bottom'); }
    if (n >= 4 && rise <= DCA6.guardAt * IN_MM) { P0(sec, 'Handrail', '2x4 ' + C.treated, Math.hypot(run, rise) + 12 * IN_MM, label + ', 34" to 38" over the nosings'); hw('Handrail bracket', '', Math.ceil(Math.hypot(run, rise) / (48 * IN_MM)) + 1, label); }
  }
  M.stairs = rs;
}

// ---------- guards ----------
function deckRails(M, P0, hw) {
  const b = M.b, C = LC(), rails = [], H = b.rail.h || 36 * IN_MM, psp = b.rail.postSp || 72 * IN_MM, rpost = (C === LUMBER.na ? '4x4' : '95x95') + ' ' + C.treated, bal = (C === LUMBER.na ? '2x2' : '45x45') + ' ' + C.treated;
  const need = Pm => b.rail.mode === 'on' || (b.rail.mode === 'auto' && Pm.zTop > DCA6.guardAt * IN_MM);
  M.plats.forEach(Pm => {
    const p = Pm.p;
    if (b.rail.mode === 'off' && Pm.zTop > DCA6.guardAt * IN_MM) M.warns.push(`The deck is more than 30" above grade and needs guards (railings).`);
    if (!need(Pm)) return;
    const edges = [
      { side: 'back', a: [p.x, p.y], b: [p.x + p.w, p.y], fixed: p.y, along: 'x', lo: p.x, hi: p.x + p.w },
      { side: 'front', a: [p.x, p.y + p.d], b: [p.x + p.w, p.y + p.d], fixed: p.y + p.d, along: 'x', lo: p.x, hi: p.x + p.w },
      { side: 'left', a: [p.x, p.y], b: [p.x, p.y + p.d], fixed: p.x, along: 'y', lo: p.y, hi: p.y + p.d },
      { side: 'right', a: [p.x + p.w, p.y], b: [p.x + p.w, p.y + p.d], fixed: p.x + p.w, along: 'y', lo: p.y, hi: p.y + p.d },
    ];
    for (const E of edges) {
      if (E.side === 'back' && Pm.led) continue;
      // parts of the edge that touch another section of about the same height, or a lower one less than 30" down, need no guard
      let gaps = [[E.lo, E.hi]];
      const cut = (a, c) => { gaps = gaps.flatMap(([x, y]) => c <= x || a >= y ? [[x, y]] : [[x, Math.min(y, a)], [Math.max(x, c), y]].filter(q => q[1] - q[0] > 1)); };
      M.plats.forEach(O => { if (O === Pm) return; const q = O.p, dz = Pm.zTop - O.zTop; if (dz > DCA6.guardAt * IN_MM) return;
        const touch = E.along === 'x' ? (Math.abs(E.fixed - (E.side === 'front' ? q.y : q.y + q.d)) < 2 ? [q.x, q.x + q.w] : null) : (Math.abs(E.fixed - (E.side === 'right' ? q.x : q.x + q.w)) < 2 ? [q.y, q.y + q.d] : null);
        if (touch) cut(touch[0], touch[1]); });
      M.stairs.filter(R => R.Pm === Pm && R.side === E.side).forEach(R => cut(R.e0, R.e0 + R.w));
      for (const [lo, hi] of gaps) {
        const L = hi - lo; if (L < 150) continue;
        const bays = Math.max(1, Math.ceil(L / psp - 1e-6)), bay = L / bays;
        rails.push({ Pm, side: E.side, along: E.along, fixed: E.fixed, lo, hi, bays, bay });
      }
    }
  });
  const bw = 1.5 * IN_MM, maxGap = 3.5 * IN_MM;
  let posts = 0, balTotal = 0;
  rails.forEach(R => {
    const Pm = R.Pm; posts += R.bays + 1;
    const run = splitRun(R.lo, R.hi, Array.from({ length: R.bays + 1 }, (_, i) => R.lo + i * R.bay), M.maxLen, [], 0, 300);
    const nt = partNotes(run, 'joint over a post');
    run.pieces.forEach((q, i) => { P0('Railing', 'Rail cap', sizeName(1) + ' ' + C.treated, q.len, nt[i]); P0('Railing', 'Top rail', sizeName(0) + ' ' + C.treated, q.len, nt[i]); P0('Railing', 'Bottom rail', sizeName(0) + ' ' + C.treated, q.len, nt[i]); });
    const clear = R.bay - 3.5 * IN_MM, nb = Math.max(0, Math.ceil((clear - maxGap) / (bw + maxGap) - 1e-6)); R.bal = nb; R.balGap = (clear - nb * bw) / (nb + 1);
    for (let i = 0; i < nb * R.bays; i++) P0('Railing', 'Baluster', bal, b.rail.h - 3.5 * IN_MM, 'screwed to the top and bottom rails');
    balTotal += nb * R.bays;
    R.postLen = b.rail.h + sizeDepth(Pm.rimSize) - 1.5 * IN_MM;
  });
  for (let i = 0; i < posts; i++) P0('Railing', 'Railing post', rpost, rails.length ? rails[0].postLen : 0, 'bolted inside the rim or end joist');
  hw('Guard post bolts', '1/2" x 8" carriage bolt with washers', posts * 2, 'two through the rim at each post');
  hw('Guard post hold-down', '1800 lb', posts, 'DCA 6 minimum at each guard post');
  hw('Baluster screws', '#8 x 2 1/2" coated', balTotal * 4);
  M.rails = rails;
}
