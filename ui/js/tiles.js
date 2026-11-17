// ---------- tile layouts: surfaces, patterns, cuts and quantities ----------
// A tile layout in P.tiles: { id, name, surf: 'floor' | 'wall', src, last, z0, z1, adds, cuts, tile }.
// src says where the outline comes from and keeps it linked:
//   { kind: 'room', level, room }                floor of a floor plan room (blocks such as cabinets are left out)
//   { kind: 'wall', level, wall, side: 'L'|'R' }  one side of a floor plan wall (doors, windows and blocks left out)
//   { kind: 'fwall', bld, wall, face: 'out'|'in' } one face of a framing wall (doors and windows left out)
//   { kind: 'typed', pts }                        an outline typed in
// Surface coordinates are real mm with x to the right and y up; on a wall x runs along the wall as seen from the
// tiled side and y is the height from the floor. last keeps the last outline found, so a layout whose source is deleted
// keeps working. z0, z1 limit a wall to a height range (null: the whole wall). adds and cuts are areas drawn on the
// tile page ({ id, pts } in surface coordinates, kept relative to the source).
const isTile = pg => pg && pg.kind === 'tile';
const tileOf = pg => pg && (P.tiles || []).find(t => t.id === pg.tile);
const TILE_PATTERNS = [['grid', 'Straight grid'], ['bond', 'Running bond'], ['herring', 'Herringbone'], ['basket', 'Basketweave'], ['hex', 'Hexagon'], ['versailles', 'Versailles']];
const TILE_PATTERN_NAMES = Object.fromEntries(TILE_PATTERNS);
const TILECACHE = new Map();
const tmet = () => unitsOf() === 'metric';
function tileDefaults(surf) {
  const m = tmet(), I = v => v * IN_MM, wall = surf === 'wall';
  return { w: m ? (wall ? 150 : 300) : I(wall ? 6 : 12), h: m ? (wall ? 75 : 300) : I(wall ? 3 : 12), joint: m ? (wall ? 2 : 3) : I(wall ? 1 / 16 : 1 / 8),
    pattern: wall ? 'bond' : 'grid', bond: 0.5, rot: 0, start: 'center', corner: 'll', pt: null, on: 'joint', balance: true, minCut: 0,
    thick: m ? (wall ? 8 : 10) : I(wall ? 5 / 16 : 3 / 8), perBox: 0, waste: 0 };
}
function newTileLayout(name, surf, src) {
  return { id: uid(), name, surf, src, last: null, z0: null, z1: null, adds: [], cuts: [], tile: tileDefaults(surf) };
}
function syncTilePages(T) {
  let pg = P.pages.find(p => isTile(p) && p.tile === T.id);
  if (!pg) { pg = { id: uid(), kind: 'tile', tile: T.id, num: '1', desc: 'Tile layout', fn: '', loc: '', items: [], wires: [], cables: [], gfx: [] }; P.pages.push(pg); }
  pg.desc = 'Tile layout'; return pg;
}

// ---------- polygon helpers (real mm) ----------
const pArea = pts => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return a / 2; };   // > 0 counter-clockwise (y up)
const ccw = pts => pArea(pts) >= 0 ? pts : pts.slice().reverse();
const tArea = pts => Math.abs(pArea(pts));
function hull(pts) {
  const p = pts.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));   // counter-clockwise (y up)
}
const bboxOf = list => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const pts of list) for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
// keep the part of a polygon on the left of the directed line a -> b (side > 0), or on the right (side < 0)
function clipLine(poly, a, b, side = 1) {
  const out = [], dx = b[0] - a[0], dy = b[1] - a[1];
  const f = p => side * (dx * (p[1] - a[1]) - dy * (p[0] - a[0]));
  for (let i = 0; i < poly.length; i++) {
    const P0 = poly[i], P1 = poly[(i + 1) % poly.length], f0 = f(P0), f1 = f(P1);
    if (f0 >= 0) out.push(P0);
    if ((f0 >= 0) !== (f1 >= 0)) { const t = f0 / (f0 - f1); out.push([P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t]); }
  }
  return out;
}
// subject (any simple polygon) inside a convex counter-clockwise polygon
function clipConvex(subject, clip) { let o = subject; for (let i = 0; i < clip.length && o.length; i++) o = clipLine(o, clip[i], clip[(i + 1) % clip.length]); return o; }
// pieces of a polygon outside a convex counter-clockwise polygon C, as polygons that do not overlap
function minusConvex(S, C) {
  const out = []; let rest = S;
  for (let i = 0; i < C.length && rest.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length];
    const o = clipLine(rest, a, b, -1); if (o.length >= 3 && tArea(o) > 1e-3) out.push(o);
    rest = clipLine(rest, a, b, 1);
  }
  return out;
}
const minusAll = (list, C) => list.flatMap(S => minusConvex(S, C));
// a line clipped to a box, or null
function lineInBox(p, d, bx) {
  let t0 = -Infinity, t1 = Infinity;
  for (const [pv, dv, lo, hi] of [[p[0], d[0], bx[0], bx[2]], [p[1], d[1], bx[1], bx[3]]]) {
    if (Math.abs(dv) < 1e-12) { if (pv < lo || pv > hi) return null; continue; }
    let a = (lo - pv) / dv, b = (hi - pv) / dv; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t1 > t0 ? [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]] : null;
}

// ---------- where the outline comes from ----------
// blocks that tile goes around: cabinets, counters, vanities, tubs, showers and appliances (tile runs under a toilet)
function tileBlockCut(sh) {
  const def = blockDef(sh.name), n = String(sh.name || '').toLowerCase();
  if (/toilet|rug|mat\b|chair|stool/.test(n)) return false;
  return /cabinet|counter|vanity|island|tub|bath|shower|range|fridge|refrigerator|dishwasher|washer|dryer|water heater/.test(n) || (def && (def.cat === 'appliances' || def.cat === 'fixtures'));
}
const tileSrcLabel = T => {
  const s = T.src || {};
  if (s.kind === 'room') { const lv = (P.levels || []).find(l => l.id === s.level), r = lv && lv.rooms.find(x => x.id === s.room); return 'Floor of ' + (r ? r.name || 'room' : 'a deleted room') + (lv ? ' (' + lv.name + ')' : ''); }
  if (s.kind === 'wall') { const lv = (P.levels || []).find(l => l.id === s.level); return 'Wall on ' + (lv ? lv.name : 'a deleted floor plan') + (s.label ? ', ' + s.label : ''); }
  if (s.kind === 'fwall') { const b = (P.buildings || []).find(x => x.id === s.bld); return (b ? b.name : 'A deleted building') + ', ' + (WALL_NAMES[s.wall] || 'wall').toLowerCase() + ', ' + (s.face === 'in' ? 'inside' : 'outside'); }
  return 'Typed outline';
};
// the wall side as seen when standing on that side: does x run with the wall's direction?
function wallSideFlip(w, side) {
  const ax = wallAxis(w), sg = side === 'L' ? 1 : -1;
  const ur = [ax.u[0], -ax.u[1]], nr = [ax.n[0], -ax.n[1]], f = [-sg * nr[0], -sg * nr[1]], right = [f[1], -f[0]];
  return right[0] * ur[0] + right[1] * ur[1] < 0;
}
function tileSourceGeom(T) {
  const s = T.src || {};
  if (s.kind === 'typed') return s.pts && s.pts.length >= 3 ? { outline: ccw(s.pts), holes: [] } : null;
  if (s.kind === 'room') {
    const lv = (P.levels || []).find(l => l.id === s.level), r = lv && lv.rooms.find(x => x.id === s.room); if (!r) return null;
    const k = lvScale(lv), R = p => [p[0] * k, -p[1] * k], poly = roomPoly(r);
    const holes = [];
    for (const sh of lvShapes(lv)) {
      if (sh.t !== 'insert' || !tileBlockCut(sh)) continue;
      const ol = insertOutline(sh).pts; if (ol.length < 3) continue;
      const c = [ol.reduce((a, p) => a + p[0], 0) / ol.length, ol.reduce((a, p) => a + p[1], 0) / ol.length];
      if (inPoly(c, poly)) holes.push({ pts: hull(ol.map(R)), label: sh.name });
    }
    return { outline: ccw(poly.map(R)), holes };
  }
  if (s.kind === 'wall') {
    const lv = (P.levels || []).find(l => l.id === s.level), w = lv && wallById(lv, s.wall); if (!w) return null;
    const k = lvScale(lv), ax = wallAxis(w), len = ax.len * k, H = w.h || WALL_H, flip = wallSideFlip(w, s.side);
    const X = x => flip ? len - x : x, holes = [];
    const box = (a, b, y0, y1, label) => { const x0 = Math.max(0, Math.min(X(a), X(b))), x1 = Math.min(len, Math.max(X(a), X(b))); if (x1 - x0 > 1 && y1 - y0 > 1) holes.push({ pts: rect4(x0, y0, x1, y1), label }); };
    for (const o of openingsOf(lv, w)) {
      const c = openingAt(o, w) * k, hw = o.w * k / 2;
      if (o.kind === 'window') { const y0 = o.sill || 36 * IN_MM; box(c - hw, c + hw, y0, y0 + (o.h || 48 * IN_MM), 'Window'); }
      else box(c - hw, c + hw, 0, Math.min(H, o.h || 80 * IN_MM), o.kind === 'door' ? 'Door' : 'Opening');
    }
    const fo = s.side === 'L' ? ax.L : ax.R, sg = s.side === 'L' ? 1 : -1, near = 60 / k;
    for (const sh of lvShapes(lv)) {
      if (sh.t !== 'insert' || !tileBlockCut(sh)) continue;
      const ol = insertOutline(sh).pts; if (ol.length < 3) continue;
      const d = ol.map(p => ((p[0] - w.a[0]) * ax.n[0] + (p[1] - w.a[1]) * ax.n[1] - fo) * sg), sa = ol.map(p => (p[0] - w.a[0]) * ax.u[0] + (p[1] - w.a[1]) * ax.u[1]);
      if (Math.min(...d) < -near || Math.min(...d) > near || Math.max(...sa) < 0 || Math.min(...sa) > ax.len) continue;
      box(Math.min(...sa) * k, Math.max(...sa) * k, 0, Math.min(H, blockHeight(blockDef(sh.name), sh.name)), sh.name);
    }
    return { outline: rect4(0, 0, len, H), holes, len, H };
  }
  if (s.kind === 'fwall') {
    const b = (P.buildings || []).find(x => x.id === s.bld); if (!b) return null;
    const M = frameModel(b); if (!M.walls) return null;
    const fw = M.walls.find(x => x.key === s.wall); if (!fw) return null;
    const inset = s.face === 'in' && b.mode === 'building' && (s.wall === 'front' || s.wall === 'back') ? M.WD : 0, L = fw.len - 2 * inset, H = fw.wallTop;
    const X = x => s.face === 'in' ? fw.len - x - inset : x, holes = [];
    for (const o of fw.ops) {
      const x0 = Math.max(0, Math.min(X(o.roL), X(o.roR))), x1 = Math.min(L, Math.max(X(o.roL), X(o.roR)));
      const y0 = o.type === 'door' ? 0 : o.sill, y1 = o.top;
      if (x1 - x0 > 1) holes.push({ pts: rect4(x0, y0, x1, y1), label: o.type === 'door' ? 'Door' : 'Window' });
    }
    return { outline: rect4(0, 0, L, H), holes, len: L, H };
  }
  return null;
}
// the surface to tile: positive areas (outline and added areas) and negative ones (left-out blocks, openings and cut-outs)
function tileGeom(T) {
  let g = tileSourceGeom(T), lost = false;
  if (g) { const j = JSON.stringify(g); if (JSON.stringify(T.last) !== j) T.last = JSON.parse(j); }
  else { g = T.last; lost = true; }
  if (!g) return null;
  let outline = g.outline;
  if (T.surf === 'wall' && (T.z0 != null || T.z1 != null)) {
    const bb = bboxOf([outline]), y0 = T.z0 != null ? Math.max(bb[1], T.z0) : bb[1], y1 = T.z1 != null ? Math.min(bb[3], T.z1) : bb[3];
    outline = y1 > y0 ? clipConvex(outline, ccwRect(bb[0] - 1, y0, bb[2] + 1, y1)) : [];
  }
  const pos = [outline].concat((T.adds || []).map(a => hull(a.pts))).filter(p => p.length >= 3);
  const neg = g.holes.map(h => ({ pts: hull(h.pts), label: h.label })).concat((T.cuts || []).map(c => ({ pts: hull(c.pts), label: 'Cut-out', id: c.id })));
  return { outline, pos, neg, lost, H: g.H, len: g.len };
}
const ccwRect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ---------- patterns ----------
// Each pattern makes tiles in its own frame around the lattice origin; the reference tile (ref) has the lower left
// corner of its box at (0, 0). Tiles: { pts (counter-clockwise), k (size name), w, h (full size), a (turn in degrees) }.
function tileSizes(t) {
  if (t.pattern === 'versailles') { const U = t.w + t.joint, g = t.joint; return { '2x3': [2 * U - g, 3 * U - g], '2x2': [2 * U - g, 2 * U - g], '2x1': [2 * U - g, U - g], '1x1': [U - g, U - g] }; }
  if (t.pattern === 'hex') return { hex: [t.w, 2 * t.w / Math.sqrt(3)] };
  return { main: [t.w, t.h] };
}
function patternRef(t) { const s = tileSizes(t); if (t.pattern === 'versailles') return s['2x3']; if (t.pattern === 'herring' || t.pattern === 'basket') { const L = Math.max(t.w, t.h), W = Math.min(t.w, t.h); return t.pattern === 'herring' ? [L, W] : [L, L]; } return s[Object.keys(s)[0]]; }
function patternTiles(t, bx) {
  const out = [], g = t.joint, [x0, y0, x1, y1] = bx;
  const rect = (x, y, w, h, k, a, ref) => out.push({ pts: ccwRect(x, y, x + w, y + h), k, w: a ? h : w, h: a ? w : h, a: a || 0, ref: !!ref, o: [x, y] });
  const range = (lo, hi, p) => [Math.floor(lo / p) - 1, Math.ceil(hi / p) + 1];
  if (t.pattern === 'grid' || t.pattern === 'bond') {
    const pw = t.w + g, ph = t.h + g, [j0, j1] = range(y0, y1, ph);
    for (let j = j0; j <= j1; j++) {
      const off = t.pattern === 'bond' ? ((j * (t.bond || 0.5) * pw) % pw + pw) % pw : 0, [i0, i1] = range(x0 - off, x1 - off, pw);
      for (let i = i0; i <= i1; i++) rect(i * pw + off, j * ph, t.w, t.h, 'main', 0, i === 0 && j === 0 && !off);
    }
  } else if (t.pattern === 'herring') {
    const L = Math.max(t.w, t.h), W = Math.min(t.w, t.h), Lp = L + g, Wp = W + g;
    const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], ks = cs.map(([x, y]) => (x + y) / (2 * Wp)), ms = cs.map(([x, y]) => (x - y) / (2 * Lp));
    for (let m = Math.floor(Math.min(...ms)) - 2; m <= Math.ceil(Math.max(...ms)) + 2; m++) for (let k = Math.floor(Math.min(...ks)) - 2 - Math.ceil(L / W); k <= Math.ceil(Math.max(...ks)) + 2; k++) {
      const bx0 = k * Wp + m * Lp, by0 = k * Wp - m * Lp;
      rect(bx0, by0, L, W, 'main', 0, k === 0 && m === 0); rect(bx0, by0 + Wp, W, L, 'main', 90);
    }
  } else if (t.pattern === 'basket') {
    const L = Math.max(t.w, t.h), W = Math.min(t.w, t.h), n = Math.max(1, Math.round((L + g) / (W + g))), B = n * (W + g);
    const [i0, i1] = range(x0, x1, B), [j0, j1] = range(y0, y1, B);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let q = 0; q < n; q++) {
      if ((i + j) % 2 === 0) rect(i * B, j * B + q * (W + g), L, W, 'main', 0, i === 0 && j === 0 && q === 0); else rect(i * B + q * (W + g), j * B, W, L, 'main', 90);
    }
  } else if (t.pattern === 'hex') {
    const F = t.w, R = F / Math.sqrt(3), dx = F + g, dy = (F + g) * Math.sqrt(3) / 2, [j0, j1] = range(y0, y1, dy);
    for (let j = j0; j <= j1; j++) {
      const off = j % 2 ? dx / 2 : 0, [i0, i1] = range(x0 - off, x1 - off, dx);
      for (let i = i0; i <= i1; i++) {
        const cx = i * dx + off + F / 2, cy = j * dy + R;
        out.push({ pts: Array.from({ length: 6 }, (_, q) => [cx + R * Math.cos((30 + 60 * q) * D2R), cy + R * Math.sin((30 + 60 * q) * D2R)]), k: 'hex', w: F, h: 2 * R, a: 0, ref: i === 0 && j === 0, o: [cx - F / 2, cy - R] });
      }
    }
  } else if (t.pattern === 'versailles') {
    const U = t.w + g, sz = tileSizes(t), cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const js = cs.map(([, y]) => y / (3 * U)); const [j0, j1] = [Math.floor(Math.min(...js)) - 1, Math.ceil(Math.max(...js)) + 1];
    for (let j = j0; j <= j1; j++) {
      const ox = j * 2 * U, oy = j * 3 * U, [i0, i1] = range(x0 - ox, x1 - ox, 5 * U);
      for (let i = i0; i <= i1; i++) {
        const bx0 = ox + i * 5 * U;
        rect(bx0, oy, ...sz['2x3'], '2x3', 0, i === 0 && j === 0); rect(bx0 + 2 * U, oy, ...sz['2x2'], '2x2'); rect(bx0 + 2 * U, oy + 2 * U, ...sz['2x1'], '2x1');
        rect(bx0 + 4 * U, oy, ...sz['1x1'], '1x1'); out.push({ pts: ccwRect(bx0 + 4 * U, oy + U, bx0 + 5 * U - g, oy + 3 * U - g), k: '2x1', w: sz['2x1'][0], h: sz['2x1'][1], a: 90, o: [bx0 + 4 * U, oy + U] });
      }
    }
  }
  return out;
}

// ---------- the layout ----------
const tileWaste = t => t.waste > 0 ? t.waste : (t.pattern === 'herring' || Math.abs(((t.rot % 90) + 90) % 90) > 0.01 ? 15 : 10);
// where the start point is, and how the reference tile sits on it (sh: its lower left corner from the start point)
function tileStart(t, bb, onX, onY) {
  const [rw, rh] = patternRef(t), g = t.joint;
  if (t.start === 'corner') {
    const c = t.corner || 'll', O = [c[1] === 'r' ? bb[2] : bb[0], c[0] === 'u' ? bb[3] : bb[1]];
    return { O, sh: [c[1] === 'r' ? -rw : 0, c[0] === 'u' ? -rh : 0] };
  }
  const O = t.start === 'point' && t.pt ? t.pt : [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
  return { O, sh: [onX === 'tile' ? -rw / 2 : g / 2, onY === 'tile' ? -rh / 2 : g / 2] };
}
function tileLayout0(T, geom, onX, onY) {
  const t = T.tile, bb = bboxOf(geom.pos), rot = (t.rot || 0) * D2R, c = Math.cos(rot), s = Math.sin(rot);
  const { O, sh } = tileStart(t, bb, onX, onY);
  // surface -> pattern frame and back
  const toP = p => { const x = p[0] - O[0], y = p[1] - O[1]; return [c * x + s * y - sh[0], -s * x + c * y - sh[1]]; };
  const toS = p => { const x = p[0] + sh[0], y = p[1] + sh[1]; return [O[0] + c * x - s * y, O[1] + s * x + c * y]; };
  const pb = bboxOf(geom.pos.map(pp => pp.map(toP)));
  const est = (pb[2] - pb[0]) * (pb[3] - pb[1]) / Math.max(1, ...Object.values(tileSizes(t)).map(([a, b]) => (a + t.joint) * (b + t.joint)));
  if (est > 30000) return { err: `This layout would need about ${Math.round(est)} tiles. Use a larger tile or a smaller area.` };
  const gb = [pb[0] - 1, pb[1] - 1, pb[2] + 1, pb[3] + 1];
  const pos = geom.pos.map(pp => ({ pts: pp, bb: bboxOf([pp]) })), neg = geom.neg.map(n => ({ pts: n.pts, bb: bboxOf([n.pts]) }));
  const over = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const tiles = [];
  for (const pt of patternTiles(t, gb)) {
    const sp = pt.pts.map(toS), tb = bboxOf([sp]);
    if (!pos.some(p => over(p.bb, tb))) continue;
    // the parts of this tile inside the surface: added areas first, then the outline less the added areas, then the openings out
    const adds = pos.slice(1).filter(p => over(p.bb, tb)), negs = neg.filter(n => over(n.bb, tb));
    let pieces = [];
    adds.forEach((A, i) => { let q = [clipConvex(A.pts, sp)].filter(x => x.length >= 3); for (const B of adds.slice(0, i)) q = minusAll(q, B.pts); pieces.push(...q); });
    if (over(pos[0].bb, tb)) { let q = [clipConvex(pos[0].pts, sp)].filter(x => x.length >= 3); for (const A of adds) q = minusAll(q, A.pts); pieces.push(...q); }
    for (const N of negs) pieces = minusAll(pieces, N.pts);
    pieces = pieces.filter(q => q.length >= 3 && tArea(q) > 1);
    const area = pieces.reduce((a, q) => a + tArea(q), 0), full = tArea(sp);
    if (area < 1) continue;
    const tile = { pts: sp, k: pt.k, w: pt.w, h: pt.h, ref: pt.ref, area };
    if (area >= full * 0.999) tile.full = true;
    else {
      // cut size in the tile's own directions
      const ang = rot + pt.a * D2R, ca = Math.cos(ang), sa = Math.sin(ang), o = toS(pt.o);
      const L = p => { const x = p[0] - o[0], y = p[1] - o[1]; return [ca * x + sa * y, -sa * x + ca * y]; };
      const lb = bboxOf(pieces.map(q => q.map(L)));
      const lw = Math.min(pt.w, lb[2] - lb[0]), lh = Math.min(pt.h, lb[3] - lb[1]);
      const angled = pieces.some(q => q.some((p, i) => { const a = L(p), b = L(q[(i + 1) % q.length]); return Math.abs(a[0] - b[0]) > 0.5 && Math.abs(a[1] - b[1]) > 0.5; }));
      const hexT = t.pattern === 'hex';
      tile.lw = lw; tile.lh = lh; tile.pieces = pieces;
      tile.shape = hexT ? 'Cut hexagon' : pieces.length > 1 ? 'Two pieces' : angled ? 'Angled cut' : area >= lw * lh * 0.995 ? 'Straight cut' : 'Notched';
      const mw = t.minCut > 0 ? t.minCut : pt.w / 3, mh = t.minCut > 0 ? t.minCut : pt.h / 3;
      tile.sliver = tile.shape === 'Straight cut' || tile.shape === 'Notched' ? (lw < pt.w - 0.5 && lw < mw) || (lh < pt.h - 0.5 && lh < mh) : area < mw * mh;
    }
    tiles.push(tile);
  }
  // chalk lines on the joints at the start of the reference tile
  const C = toS([-t.joint / 2, -t.joint / 2]), ux = [c, s], uy = [-s, c];
  return { tiles, O, C, ux, uy, bb, onX, onY };
}
function tileScore(L) { const cuts = L.tiles.filter(x => !x.full); const sl = cuts.filter(x => x.sliver).length; const mn = cuts.reduce((m, x) => Math.min(m, Math.min(x.lw / x.w, x.lh / x.h)), 1); return [sl, -mn, cuts.length]; }
const scoreLess = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function tileLayout(T) {
  const geom = tileGeom(T); if (!geom) return { err: 'This tile layout has no outline.' };
  if (!geom.pos.length || !geom.pos[0].length) return { err: 'Nothing to tile: the height range leaves no wall.', geom };
  const t = T.tile; if (!(t.w > 0) || !(t.h > 0)) return { err: 'Enter a tile size.', geom };
  const key = JSON.stringify([geom.pos, geom.neg, t, geom.lost]);
  const hit = TILECACHE.get(T.id); if (hit && hit.key === key) return hit.L;
  let L;
  if (t.balance && t.start !== 'corner' && t.pattern !== 'herring' && t.pattern !== 'versailles') {
    for (const [ox, oy] of [['joint', 'joint'], ['tile', 'joint'], ['joint', 'tile'], ['tile', 'tile']]) { const c = tileLayout0(T, geom, ox, oy); if (c.err) { L = c; break; } if (!L || scoreLess(tileScore(c), tileScore(L)) < 0) L = c; }
  } else L = tileLayout0(T, geom, t.on, t.on);
  L.geom = geom;
  if (!L.err) {
    L.area = L.tiles.reduce((a, x) => a + x.area, 0);
    L.cuts = L.tiles.filter(x => !x.full); L.slivers = L.cuts.filter(x => x.sliver);
    L.start = L.tiles.find(x => x.ref) || null;
  }
  TILECACHE.set(T.id, { key, L });
  return L;
}

// ---------- quantities ----------
const tileSizeName = (w, h) => tmet() ? `${Math.round(w)} x ${Math.round(h)} mm` : `${fmtCut(w)} x ${fmtCut(h)}`;
function tileSizeLabel(t, k) { const s = tileSizes(t)[k]; return t.pattern === 'hex' ? (tmet() ? Math.round(s[0]) + ' mm hexagon' : fmtCut(s[0]) + ' hexagon') : tileSizeName(s[0], s[1]); }
// cut pieces with offcuts used again where a straight cut fits in the rest of a tile already cut
function tileCutPlan(T, L) {
  const t = T.tile, kerf = tmet() ? 2 : IN_MM / 16, sizes = tileSizes(t), out = [];
  const offcuts = [];   // { k, w, h, from }
  const list = L.cuts.slice().sort((a, b) => b.lw * b.lh - a.lw * a.lh);
  let n = 0;
  for (const c of list) {
    const [tw, th] = sizes[c.k], sq = Math.abs(tw - th) < 0.5, straight = c.shape === 'Straight cut';
    let from = null;
    if (straight) {
      const i = offcuts.findIndex(o => o.k === c.k && ((c.lw <= o.w + 0.01 && c.lh <= o.h + 0.01) || (sq && c.lh <= o.w + 0.01 && c.lw <= o.h + 0.01)));
      if (i >= 0) {
        const o = offcuts.splice(i, 1)[0], rotd = !(c.lw <= o.w + 0.01 && c.lh <= o.h + 0.01), pw = rotd ? c.lh : c.lw, ph = rotd ? c.lw : c.lh;
        from = 'Offcut of cut ' + o.from;
        if (o.w - pw - kerf > tw / 6 && Math.abs(ph - o.h) < 0.5) offcuts.push({ k: c.k, w: o.w - pw - kerf, h: o.h, from: o.from });
        else if (o.h - ph - kerf > th / 6 && Math.abs(pw - o.w) < 0.5) offcuts.push({ k: c.k, w: o.w, h: o.h - ph - kerf, from: o.from });
      }
    }
    if (!from) {
      n++; from = 'New tile';
      if (straight) {
        if (c.lw < tw - 0.5 && Math.abs(c.lh - th) < 0.5 && tw - c.lw - kerf > tw / 6) offcuts.push({ k: c.k, w: tw - c.lw - kerf, h: th, from: n });
        else if (c.lh < th - 0.5 && Math.abs(c.lw - tw) < 0.5 && th - c.lh - kerf > th / 6) offcuts.push({ k: c.k, w: tw, h: th - c.lh - kerf, from: n });
      }
      c.no = n;
    }
    out.push({ c, from });
  }
  return { rows: out, newTiles: n };
}
function tileOrder(T, L) {
  const t = T.tile, sizes = tileSizes(t), plan = tileCutPlan(T, L), w = tileWaste(t), rows = [];
  for (const k of Object.keys(sizes)) {
    const full = L.tiles.filter(x => x.full && x.k === k).length, cuts = L.cuts.filter(x => x.k === k).length, cutTiles = plan.rows.filter(r => r.c.k === k && r.from === 'New tile').length;
    if (!full && !cuts) continue;
    const need = full + cutTiles, order = Math.ceil(need * (1 + w / 100) - 1e-9);
    const [tw, th] = sizes[k], ta = tw * th;
    const per = t.perBox > 0 ? t.perBox : Math.max(1, Math.floor((tmet() ? 1e6 : 10 * 144 * IN_MM * IN_MM) / ta + 1e-9));
    rows.push({ k, label: tileSizeLabel(t, k), full, cuts, cutTiles, need, order, per, boxes: Math.ceil(order / per - 1e-9) });
  }
  // grout: joint volume per area = (w + h) / (w x h) x joint x depth; sanded grout about 1.75 kg per litre
  let groutKg = 0;
  for (const k of Object.keys(sizes)) { const a = L.tiles.filter(x => x.k === k).reduce((s, x) => s + x.area, 0); const [tw, th] = sizes[k]; groutKg += a * (tw + th) / (tw * th) * t.joint * t.thick / 1e6 * 1.75; }
  groutKg *= 1.1;
  // thinset by trowel notch for the largest tile side
  const side = Math.max(...Object.values(sizes).map(s => Math.max(...s)));
  const trowel = side <= 4.5 * IN_MM ? ['3/16" V-notch', '5 mm V-notch', 1.6] : side <= 8.5 * IN_MM ? ['1/4" x 1/4" square notch', '6 mm square notch', 2.5] : side <= 16.5 * IN_MM ? ['1/4" x 3/8" square notch', '10 mm square notch', 3.6] : ['1/2" x 1/2" square notch', '12 mm square notch', 5.5];
  const thinKg = L.area / 1e6 * trowel[2] * 1.1;
  return { rows, plan, waste: w, groutKg, thinKg, trowel: tmet() ? trowel[1] : trowel[0], area: L.area };
}
const fmtArea = a => tmet() ? (a / 1e6).toFixed(2) + ' m²' : (a / (144 * IN_MM * IN_MM)).toFixed(1) + ' sq ft';
const fmtWeight = kg => tmet() ? (kg < 10 ? kg.toFixed(1) : Math.round(kg)) + ' kg' : Math.max(1, Math.round(kg * 2.20462)) + ' lb';
const groutBags = kg => tmet() ? Math.max(1, Math.ceil(kg / 5 - 1e-9)) + ' x 5 kg bags' : Math.max(1, Math.ceil(kg * 2.20462 / 25 - 1e-9)) + ' x 25 lb bags';
const thinBags = kg => tmet() ? Math.max(1, Math.ceil(kg / 20 - 1e-9)) + ' x 20 kg bags' : Math.max(1, Math.ceil(kg * 2.20462 / 50 - 1e-9)) + ' x 50 lb bags';
function tileErrors() {
  const out = [];
  for (const T of P.tiles || []) { const L = tileLayout(T); if (L.err) out.push({ T, e: L.err, lvl: 'e' }); else { if (L.geom.lost) out.push({ T, e: 'The source is gone; the layout keeps its last outline.', lvl: 'w' }); if (L.slivers.length) out.push({ T, e: L.slivers.length + (L.slivers.length > 1 ? ' cut tiles are' : ' cut tile is') + ' thinner than the smallest cut.', lvl: 'w' }); } }
  return out;
}
