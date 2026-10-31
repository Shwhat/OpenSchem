// ---------- floor plan edit tools ----------
// Move, copy, rotate, scale, mirror, offset, trim, extend, fillet, chamfer, break, join, explode, arrays and draw
// order. They work on shapes, walls, rooms and devices. Tools that need a selection use the current one, or ask
// for objects first (click them or drag a window, then Enter).
const selShapes = lv => lvShapes(lv).filter(s => sel.has(s.id));
const selCount = lv => lv ? lvShapes(lv).filter(s => sel.has(s.id)).length + lv.rooms.filter(r => sel.has(r.id)).length + lv.places.filter(p => sel.has(p.id)).length : 0;
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function tCompose(A, B) { return { map: p => B.map(A.map(p)), rot: (A.rot || 0) + (B.rot || 0), k: (A.k || 1) * (B.k || 1), mir: A.mir ?? B.mir }; }
function drawExit() { const D = DRAW; setTimeout(() => { if (D && DRAW === D) setMode('select'); }, 0); }
// hosted objects (doors and windows) follow their wall; transformShape handles them through the wall
function selTransform(lv, T) {
  const ids = withHosted(lv, sel);
  for (const s of lvShapes(lv)) if (ids.has(s.id)) transformShape(s, T);
  for (const pl of lv.places) if (sel.has(pl.id)) transformPlace(pl, T);
  for (const r of lv.rooms) if (sel.has(r.id)) transformRoom(r, T);
  for (const pl of lv.places) autoRoom(lv, pl);
}
function uniqueRoomName(lv, name) { const names = new Set((P.levels || []).flatMap(l => l.rooms.map(r => r.name))); if (!names.has(name)) return name; let i = 2; const base = name.replace(/ \d+$/, ''); while (names.has(`${base} ${i}`)) i++; return `${base} ${i}`; }
function copyDevicePlace(lv, pl) {
  const it = itemById(pl.item); if (!it) return null;
  const nit = makeItem(it.sym, 0, 0, 0, { fn: '', loc: '' }); for (const k of ['desc', 'part', 'va']) if (it[k] != null) nit[k] = it[k];
  P.pool.push(nit); const np = { id: uid(), item: nit.id, x: pl.x, y: pl.y, rot: pl.rot || 0 }; lv.places.push(np); return np;
}
// copies of the selection moved by T; returns the new ids
function selCopy(lv, T) {
  const made = [], wallMap = new Map();
  const idMap = new Map();
  for (const s of lvShapes(lv).slice()) if (sel.has(s.id) && s.t !== 'opening') { const c = transformShape(Object.assign(clone(s), { id: uid() }), T); lvShapes(lv).push(c); made.push(c.id); idMap.set(s.id, c.id); if (s.t === 'wall') wallMap.set(s.id, c.id); }
  // copied dimensions follow the copied geometry
  for (const id of made) { const d = lvShapes(lv).find(x => x.id === id); if (!d || d.t !== 'dim') continue; for (const k of ['r1', 'r2']) if (d[k] && d[k].id) { if (idMap.has(d[k].id)) d[k].id = idMap.get(d[k].id); else delete d[k]; } if (d.ref) { if (idMap.has(d.ref)) d.ref = idMap.get(d.ref); else delete d.ref; } for (const k of ['l1', 'l2']) if (d[k]) { if (idMap.has(d[k].id)) d[k].id = idMap.get(d[k].id); else delete d[k]; } }
  for (const s of lvShapes(lv).slice()) if (s.t === 'opening' && (sel.has(s.id) || wallMap.has(s.wall))) { const c = transformShape(Object.assign(clone(s), { id: uid(), wall: wallMap.get(s.wall) || s.wall }), T); if (typeof nextOpeningTag === 'function') c.tag = nextOpeningTag(c.kind); lvShapes(lv).push(c); made.push(c.id); }
  for (const r of lv.rooms.slice()) if (sel.has(r.id)) { const c = Object.assign(clone(r), { id: uid(), name: uniqueRoomName(lv, r.name) }); transformRoom(c, T); lv.rooms.push(c); made.push(c.id); }
  for (const pl of lv.places.slice()) if (sel.has(pl.id)) { const np = copyDevicePlace(lv, pl); if (np) { transformPlace(np, T); autoRoom(lv, np); made.push(np.id); } }
  return made;
}
function selGhost(lv) {
  const out = selShapes(lv).filter(s => s.t !== 'opening').map(s => clone(s));
  for (const r of lv.rooms) if (sel.has(r.id)) out.push({ t: 'pline', pts: roomPoly(r).map(p => p.slice()), closed: true });
  for (const pl of lv.places) if (sel.has(pl.id)) out.push({ t: 'circle', c: [pl.x, pl.y], r: 3 });
  return out;
}
const ghostT = (D, T) => T ? D.ghostSet.map(s => transformShape(clone(s), T)) : [];
function selExtent(lv, base) {
  const pts = [];
  for (const g of selGhost(lv)) { const b = shapeBox(g); pts.push([b[0], b[1]], [b[2], b[3]], [b[0], b[3]], [b[2], b[1]]); }
  return Math.max(1, ...pts.map(p => ptDist(base, p)));
}
function selCenter(lv) { const pts = []; for (const g of selGhost(lv)) { const b = shapeBox(g); pts.push([b[0], b[1]], [b[2], b[3]]); } const b = bboxPts(pts); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
// picking one object (trim, offset, fillet...): the nearest shape (or room) outline near p
function pickShape(pg, lv, p, ok = () => true, rooms = false) {
  const tol = 8 / ((view.s || 1) * fpXform(pg).s); let best = null;
  for (const s of lvShapes(lv)) {
    if (!ok(s) || !selectable(s)) continue; const cv = s.t === 'text' ? null : curveOf(s); if (!cv) continue;
    const r = curveNearest(cv, p); if (r.d <= tol && (!best || r.d < best.d)) best = { s, cv, d: r.d, i: r.i, sPos: r.s, q: r.q };
  }
  if (rooms) for (const rm of lv.rooms) { const cv = roomCurve(rm); const r = curveNearest(cv, p); if (r.d <= tol && (!best || r.d < best.d)) best = { room: rm, cv, d: r.d, i: r.i, sPos: r.s, q: r.q }; }
  return best;
}
const tolPick = 'Click on the object';

// ---------- selection stage shared by the tools ----------
function drawPick(e, pg, lv, p) {
  const id = hitId(e);
  if (id) { if (e.shiftKey && sel.has(id)) sel.delete(id); else sel.add(id); render(); drawRefresh(); return; }
  fbox = { start: [fsnap(p[0]), fsnap(p[1])], cur: [fsnap(p[0]), fsnap(p[1])], select: true };
}
const selPrompt = 'Select objects (click or drag a window, Enter when done):';
function selInit(D, next) { D.next = next; D.stage = selCount(levelOf(page())) ? next : 'sel'; D.want = 'point'; }
function selEnter(D, c) { if (D.stage === 'sel') { if (selCount(c.lv)) { D.stage = D.next; if (D.T.afterSel) D.T.afterSel(D, c); } else drawExit(); return true; } return false; }

// ---------- move, copy, rotate, scale, mirror ----------
drawTool('move', {
  name: 'Move', init(D) { selInit(D, 'base'); }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : D.stage === 'base' ? 'Specify base point:' : 'Specify second point (or @dx,dy):',
  last: D => D.stage === 'to' ? D.base : null,
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  point(D, q, c) {
    if (D.stage === 'base') { D.base = q; D.stage = 'to'; D.ghostSet = selGhost(c.lv); return; }
    if (D.stage === 'to') { const T = tMove(vsub(q, D.base)); commit(() => selTransform(c.lv, T)); drawExit(); }
  },
  ghost: (D, q) => D.stage === 'to' ? ghostT(D, tMove(vsub(q, D.base))) : [],
});
drawTool('copy', {
  name: 'Copy', init(D) { selInit(D, 'base'); }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : D.stage === 'base' ? 'Specify base point:' : 'Specify second point (Enter to finish):',
  last: D => D.stage === 'to' ? D.base : null,
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  point(D, q, c) {
    if (D.stage === 'base') { D.base = q; D.stage = 'to'; D.ghostSet = selGhost(c.lv); return; }
    if (D.stage === 'to' && ptDist(q, D.base) > 0.01) { const keep = new Set(sel); commit(() => { selCopy(c.lv, tMove(vsub(q, D.base))); sel = keep; }); }
  },
  ghost: (D, q) => D.stage === 'to' ? ghostT(D, tMove(vsub(q, D.base))) : [],
});
drawTool('rotate', {
  name: 'Rotate', init(D) { selInit(D, 'base'); D.copy = false; }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : D.stage === 'base' ? 'Specify base point:' : `Specify rotation angle [Copy]${D.copy ? ' (copy)' : ''}:`,
  last: D => D.stage === 'ang' ? D.base : null,
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  apply(D, c, ang) { const T = tRotate(D.base, ang); commit(() => { if (D.copy) { const keep = new Set(sel); selCopy(c.lv, T); sel = keep; } else selTransform(c.lv, T); }); drawExit(); },
  point(D, q, c) {
    if (D.stage === 'base') { D.base = q; D.stage = 'ang'; D.want = 'angle'; D.ghostSet = selGhost(c.lv); return; }
    if (D.stage === 'ang' && ptDist(q, D.base) > 0.01) this.apply(D, c, ptAngle(D.base, q));
  },
  num(D, n, c) { if (D.stage === 'ang') this.apply(D, c, n); },
  opt(D, w) { if (D.stage === 'ang' && (w === 'C' || w === 'COPY')) { D.copy = !D.copy; return true; } return false; },
  ghost: (D, q) => D.stage === 'ang' && ptDist(q, D.base) > 0.01 ? ghostT(D, tRotate(D.base, ptAngle(D.base, q))) : [],
});
drawTool('scale', {
  name: 'Scale', init(D) { selInit(D, 'base'); D.copy = false; }, picking: D => D.stage === 'sel',
  prompt: (D, c) => D.stage === 'sel' ? selPrompt : D.stage === 'base' ? 'Specify base point:' : D.stage === 'r1' ? 'Reference length:' : D.stage === 'r2' ? `New length (reference ${fmtLen(c.lv, D.ref1)}):` : `Specify scale factor [Copy/Reference]${D.copy ? ' (copy)' : ''}:`,
  last: D => D.stage === 'k' ? D.base : null,
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  apply(D, c, k) { if (!(k > 0)) { flash('The scale factor must be above zero'); return; } const T = tScale(D.base, k); commit(() => { if (D.copy) { const keep = new Set(sel); selCopy(c.lv, T); sel = keep; } else selTransform(c.lv, T); }); drawExit(); },
  point(D, q, c) {
    if (D.stage === 'base') { D.base = q; D.stage = 'k'; D.want = 'number'; D.ghostSet = selGhost(c.lv); D.ext = selExtent(c.lv, q); return; }
    if (D.stage === 'k' && ptDist(q, D.base) > 0.01) this.apply(D, c, ptDist(D.base, q) / D.ext);
  },
  num(D, n, c) { if (D.stage === 'k') this.apply(D, c, n); },
  dist(D, v, c) { if (D.stage === 'r1') { D.ref1 = v; D.stage = 'r2'; } else if (D.stage === 'r2') this.apply(D, c, v / D.ref1); },
  opt(D, w) {
    if (D.stage !== 'k') return false;
    if (w === 'C' || w === 'COPY') { D.copy = !D.copy; return true; }
    if (w === 'R' || w === 'REFERENCE') { D.stage = 'r1'; D.want = 'dist'; return true; }
    return false;
  },
  ghost: (D, q) => D.stage === 'k' && ptDist(q, D.base) > 0.01 ? ghostT(D, tScale(D.base, ptDist(D.base, q) / D.ext)) : [],
});
drawTool('mirror', {
  name: 'Mirror', init(D) { selInit(D, 'p1'); D.erase = false; }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : D.stage === 'p1' ? 'Specify first point of the mirror line:' : `Specify second point [Erase source: ${D.erase ? 'Yes' : 'No'}]:`,
  last: D => D.stage === 'p2' ? D.p1 : null,
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  point(D, q, c) {
    if (D.stage === 'p1') { D.p1 = q; D.stage = 'p2'; D.ghostSet = selGhost(c.lv); return; }
    if (D.stage === 'p2' && ptDist(q, D.p1) > 0.01) { const T = tMirror(D.p1, ptAngle(D.p1, q)); commit(() => { if (D.erase) selTransform(c.lv, T); else { const keep = new Set(sel); selCopy(c.lv, T); sel = keep; } }); drawExit(); }
  },
  opt(D, w) { if (D.stage === 'p2' && (w === 'E' || w === 'ERASE' || w === 'Y' || w === 'N')) { D.erase = w === 'N' ? false : w === 'Y' ? true : !D.erase; return true; } return false; },
  ghost: (D, q) => D.stage === 'p2' && ptDist(q, D.p1) > 0.01 ? ghostT(D, tMirror(D.p1, ptAngle(D.p1, q))) : [],
});

// ---------- offset ----------
function offEl(e, d) {
  if (e.k === 'L') { const n = ptAngle(e.a, e.b) + 90; return { k: 'L', a: polarPt(e.a, d, n), b: polarPt(e.b, d, n) }; }
  const r = e.sw >= 0 ? e.r - d : e.r + d; return r > 1e-6 ? Object.assign({}, e, { r }) : null;
}
function lineX(e1, e2) { const x = elCross(e1, e2, { extend: true }); if (x.length) return x[0].p; const y = elCross({ k: 'L', a: e2.a, b: e2.b }, e1, { extend: true }); return y.length ? y[0].p : null; }
function lineLineX(a, b, c, d) { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]; const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den; return [a[0] + t * r[0], a[1] + t * r[1]]; }
function offsetEls(cv, d) {
  const o = cv.els.map(e => offEl(e, d)); if (o.some(x => !x)) return null;
  const out = []; const n = o.length;
  const join = (A, B) => {
    if (A.k === 'L' && B.k === 'L') { const X = lineLineX(A.a, A.b, B.a, B.b); if (X) { A.b = X; B.a = X; return null; } }
    const p = elEnd(A), q = elStart(B); return ptDist(p, q) > 1e-4 ? { k: 'L', a: p, b: q } : null;
  };
  const els = o.map(e => Object.assign({}, e));
  for (let i = 0; i < n; i++) { out.push(els[i]); if (i < n - 1) { const g = join(els[i], els[i + 1]); if (g) out.push(g); } }
  if (cv.closed && n > 1) { const g = join(els[n - 1], els[0]); if (g) out.push(g); }
  return out;
}
function sideSign(cv, p) { const nr = curveNearest(cv, p); const e = cv.els[nr.i]; const t = nr.s - nr.i; const dir = elDir(e, t) + 90; const v = [p[0] - nr.q[0], nr.q[1] - p[1]]; return v[0] * Math.cos(dir * D2R) + v[1] * Math.sin(dir * D2R) >= 0 ? 1 : -1; }
function offsetShape(pick, d, side) {
  const s = pick.s, cv = pick.cv; const sg = sideSign(cv, side);
  if (s && s.t === 'circle') { const r = s.r - sg * d; return r > 0.01 ? Object.assign(clone(s), { id: uid(), r: r2(r) }) : null; }
  if (s && s.t === 'ellipse') { const inside = sg > 0; const rx = s.rx + (inside ? -d : d), ry = s.ry + (inside ? -d : d); return rx > 0.01 && ry > 0.01 ? Object.assign(clone(s), { id: uid(), rx: r2(rx), ry: r2(ry) }) : null; }
  if (s && s.t === 'polygon') { const r = s.r - sg * d * (s.ic === 'C' ? 1 : 1 / Math.cos(Math.PI / s.n)); return r > 0.01 ? Object.assign(clone(s), { id: uid(), r: r2(r) }) : null; }
  if (s && s.t === 'rect' && !s.ch) { const w = s.w - 2 * sg * d, h = s.h - 2 * sg * d; const o = Object.assign(clone(s), { id: uid(), w: r2(w), h: r2(h) }); if (s.r) { const r = s.r - sg * d; if (r > 0.01) o.r = r2(r); else delete o.r; } return w > 0.01 && h > 0.01 ? o : null; }
  if (s && s.t === 'spline') {
    const o = clone(s); o.id = uid();
    o.pts = s.pts.map((p, i) => { const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)]; const dir = ptAngle(a, b) + 90 * sg; return rp(polarPt(p, d, dir)); });
    return o;
  }
  const els = offsetEls(cv, sg * d); if (!els) return null;
  const orig = s || { t: 'pline' };
  const r = shapeFromEls(s && s.t === 'wall' ? s : (s && s.t !== 'pline' && els.length > 1 ? { t: 'pline', color: orig.color, lw: orig.lw, dash: orig.dash, layer: orig.layer } : orig), els, cv.closed);
  if (r) { r.id = uid(); if (r.t === 'wall') delete r.tag; }
  return r;
}
const offsetable = s => ['line', 'wall', 'pline', 'arc', 'circle', 'ellipse', 'rect', 'polygon', 'spline'].includes(s.t);
drawTool('offset', {
  name: 'Offset',
  init(D) { D.stage = 'dist'; D.want = 'dist'; D.d = PREFS.offsetD ? toPlanMm(levelOf(page()), PREFS.offsetD) : 0; D.through = PREFS.offsetThrough || false; },
  prompt: (D, c) => D.stage === 'dist' ? `Specify offset distance [Through] <${D.through ? 'Through' : fmtLen(c.lv, D.d)}>:` : D.stage === 'pick' ? 'Select the object to offset (Enter to finish):' : D.through ? 'Specify the point to pass through:' : 'Specify the side to offset to:',
  setD(D, v, c) { D.d = v; D.through = false; PREFS.offsetD = r2(toRealMm(c.lv, v)); PREFS.offsetThrough = false; savePrefs(); D.stage = 'pick'; D.want = 'point'; },
  dist(D, v, c) { if (D.stage === 'dist' && v > 0) this.setD(D, v, c); },
  distPoint(D, q) { if (D.stage === 'dist') { if (!D.p0) D.p0 = q; else { this.setD(D, ptDist(D.p0, q), drawCtx()); D.p0 = null; } } },
  opt(D, w) { if (D.stage === 'dist' && (w === 'T' || w === 'THROUGH')) { D.through = true; PREFS.offsetThrough = true; savePrefs(); D.stage = 'pick'; D.want = 'point'; return true; } return false; },
  enter(D) { if (D.stage === 'dist' && (D.d > 0 || D.through)) { D.stage = 'pick'; D.want = 'point'; return; } drawExit(); },
  point(D, q, c) {
    if (D.stage === 'pick') { const pk = pickShape(c.pg, c.lv, c.raw || q, offsetable, true); if (!pk) { flash(tolPick); return; } D.pk = pk; D.stage = 'side'; sel = new Set([pk.s ? pk.s.id : pk.room.id]); render(); return; }
    if (D.stage === 'side') {
      const d = D.through ? curveNearest(D.pk.cv, q).d : D.d; if (!(d > 0.01)) return;
      const ns = offsetShape(D.pk, d, q); if (!ns) { flash('That offset does not fit'); D.stage = 'pick'; return; }
      commit(() => { lvShapes(c.lv).push(onActiveLayer(ns)); sel = new Set(); }); D.stage = 'pick';
    }
  },
  ghost(D, q) { if (D.stage !== 'side') return []; const d = D.through ? curveNearest(D.pk.cv, q).d : D.d; const ns = d > 0.01 && offsetShape(D.pk, d, q); return ns ? [ns] : []; },
});

// ---------- trim and extend ----------
function mergeEls(els) {
  const out = [];
  for (const e of els) {
    const l = out[out.length - 1];
    if (l && l.k === 'A' && e.k === 'A' && ptDist(l.c, e.c) < 1e-6 && Math.abs(l.r - e.r) < 1e-6 && Math.sign(l.sw) === Math.sign(e.sw) && ptDist(elEnd(l), elStart(e)) < 1e-5) { l.sw += e.sw; continue; }
    out.push(Object.assign({}, e));
  }
  return out;
}
const trimmable = s => ['line', 'wall', 'pline', 'arc', 'circle', 'ellipse', 'rect', 'polygon', 'spline'].includes(s.t);
// a rectangle or polygon becomes a plain closed polyline (same id) before its corners are edited
function toPlineInPlace(s) { if (!isParam(s)) return s; const p = asPline(s); for (const k of Object.keys(s)) delete s[k]; return Object.assign(s, p); }
function replaceShape(lv, s, pieces) {
  const i = lvShapes(lv).indexOf(s); const made = pieces.filter(Boolean).map(p => Object.assign(p, { id: uid() }));
  lv.shapes.splice(i, 1, ...made);
  if (s.t === 'wall' && typeof rehostOpenings === 'function') rehostOpenings(lv, s, made);
  return made;
}
function trimAt(pg, lv, raw) {
  const pk = pickShape(pg, lv, raw, trimmable); if (!pk) { flash(tolPick); return false; }
  const s = pk.s, cv = pk.cv, N = cv.els.length, sp = pk.sPos;
  const cuts = curveCuts(cv, levelEdges(lv, s.id, s.t === 'wall'));
  let parts;
  if (!cv.closed) {
    const inner = cuts.filter(t => t > 1e-6 && t < N - 1e-6);
    if (!inner.length) { commit(() => { replaceShape(lv, s, []); sel.delete(s.id); }); return true; }
    const lo = Math.max(0, ...inner.filter(t => t < sp)), hi = Math.min(N, ...inner.filter(t => t > sp));
    parts = []; if (lo > 1e-6) parts.push([0, lo]); if (hi < N - 1e-6) parts.push([hi, N]);
  } else {
    if (cuts.length < 2) { flash('A closed shape needs two cutting edges to trim'); return false; }
    const below = cuts.filter(t => t < sp), above = cuts.filter(t => t > sp);
    parts = [[above.length ? above[0] : cuts[0], below.length ? below[below.length - 1] : cuts[cuts.length - 1]]];
  }
  commit(() => { replaceShape(lv, s, parts.map(([a, b]) => shapeFromEls(s.t === 'circle' ? { t: 'arc', color: s.color, lw: s.lw, dash: s.dash, layer: s.layer } : s, mergeEls(curveSlice(cv, a, b)), false))); sel.delete(s.id); });
  return true;
}
function extendAt(pg, lv, raw) {
  const pk = pickShape(pg, lv, raw, s => ['line', 'wall', 'arc', 'pline'].includes(s.t) && !s.closed); if (!pk) { flash(tolPick); return false; }
  const s = pk.s, cv = pk.cv, N = cv.els.length; const atEnd = pk.sPos > N / 2;
  const e = atEnd ? cv.els[N - 1] : cv.els[0]; const edges = levelEdges(lv, s.id, s.t === 'wall');
  let best = null;
  if (e.k === 'L') {
    for (const f of edges) for (const x of elCross(e, f, { extend: true })) { const beyond = atEnd ? x.t - 1 : -x.t; if (beyond > 1e-6 && (!best || beyond < best.v)) best = { v: beyond, p: x.p }; }
  } else {
    const dirS = e.sw >= 0 ? 1 : -1; const endA = atEnd ? e.a0 + e.sw : e.a0; const room = 360 - Math.abs(e.sw);
    const full = { k: 'A', c: e.c, r: e.r, a0: 0, sw: 360 };
    for (const f of edges) for (const x of elCross(full, f)) { const ang = ptAngle(e.c, x.p); const da = atEnd ? n360(dirS * (ang - endA)) : n360(dirS * (endA - ang)); if (da > 1e-6 && da < room - 1e-6 && (!best || da < best.v)) best = { v: da, p: x.p }; }
  }
  if (!best) { flash('Nothing to extend to'); return false; }
  commit(() => {
    const p = rp(best.p);
    if (s.t === 'line' || s.t === 'wall') { if (atEnd) s.b = p; else s.a = p; }
    else if (s.t === 'arc') { if (e.sw >= 0 === atEnd) s.a1 = r2(n360(s.a1 + best.v)); else s.a0 = r2(n360(s.a0 - best.v)); }
    else if (s.t === 'pline') {
      const i = atEnd ? N - 1 : 0;
      if (e.k === 'A') { const sw = e.sw + (e.sw >= 0 ? best.v : -best.v); s.b = s.b || []; s.b[i] = r2(Math.tan(sw * D2R / 4) * 1e5) / 1e5; }
      if (atEnd) s.pts[s.pts.length - 1] = p; else s.pts[0] = p;
    }
    if (s.t === 'wall' && typeof rehostOpenings === 'function') rehostOpenings(lv, s, [s]);
  });
  return true;
}
drawTool('trim', {
  name: 'Trim', prompt: () => 'Click the part to remove (everything is a cutting edge; Enter to finish):',
  point(D, q, c) { trimAt(c.pg, c.lv, c.raw || q); }, enter() { drawExit(); },
});
drawTool('extend', {
  name: 'Extend', prompt: () => 'Click near the end to extend (Enter to finish):',
  point(D, q, c) { extendAt(c.pg, c.lv, c.raw || q); }, enter() { drawExit(); },
});

// ---------- fillet and chamfer ----------
const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
// corner geometry between two straight runs meeting at X, keeping the far ends FA and FB
function cornerCut(X, FA, FB, o) {
  const uA = unit(vsub(FA, X)), uB = unit(vsub(FB, X));
  const cos = Math.max(-1, Math.min(1, uA[0] * uB[0] + uA[1] * uB[1])); const th = Math.acos(cos);
  if (th < 1e-4 || th > Math.PI - 1e-4) return null;
  if (o.chamfer) { const TA = [X[0] + uA[0] * o.d1, X[1] + uA[1] * o.d1], TB = [X[0] + uB[0] * o.d2, X[1] + uB[1] * o.d2]; return { TA, TB, ok: o.d1 <= ptDist(X, FA) + 1e-6 && o.d2 <= ptDist(X, FB) + 1e-6 }; }
  const r = o.r; if (!(r > 0)) return { TA: X, TB: X, ok: true };
  const td = r / Math.tan(th / 2); const TA = [X[0] + uA[0] * td, X[1] + uA[1] * td], TB = [X[0] + uB[0] * td, X[1] + uB[1] * td];
  const bis = unit([uA[0] + uB[0], uA[1] + uB[1]]); const cd = r / Math.sin(th / 2); const C = [X[0] + bis[0] * cd, X[1] + bis[1] * cd];
  const M = [C[0] - bis[0] * r, C[1] - bis[1] * r];
  return { TA, TB, arc: arc3(TA, M, TB), ok: td <= ptDist(X, FA) + 1e-6 && td <= ptDist(X, FB) + 1e-6 };
}
function farEnd(a, b, X, pick) { const d = vsub(b, a); const L2 = d[0] * d[0] + d[1] * d[1] || 1; const tX = ((X[0] - a[0]) * d[0] + (X[1] - a[1]) * d[1]) / L2, tp = ((pick[0] - a[0]) * d[0] + (pick[1] - a[1]) * d[1]) / L2; return tp >= tX ? 'b' : 'a'; }
function plCorner(s, v, o) {
  const n = s.pts.length; const segIn = (v - 1 + n) % n, segOut = v % n; const b = s.b || [];
  if (!s.closed && (v <= 0 || v >= n - 1)) return false;
  if (b[segIn] || b[segOut]) return false;
  if (!o.chamfer && !(o.r > 0)) return false;
  const X = s.pts[v], FA = s.pts[(v - 1 + n) % n], FB = s.pts[(v + 1) % n];
  const k = cornerCut(X, FA, FB, o); if (!k || !k.ok) return false;
  const bulge = o.chamfer ? 0 : r2(Math.tan(n180(ptAngle(X, FB) - ptAngle(FA, X)) * D2R / 4) * 1e5) / 1e5;
  const nb = (s.b || s.pts.map(() => 0)).slice(); while (nb.length < (s.closed ? n : n - 1)) nb.push(0);
  s.pts.splice(v, 1, rp(k.TA), rp(k.TB)); nb.splice(v, 0, bulge);
  s.b = nb; if (!s.b.some(x => x)) delete s.b;
  if (s.wd) { const w = s.wd[segIn] || [0, 0]; s.wd.splice(v, 0, [w[1], w[1]]); }
  return true;
}
function corner(pg, lv, A, pa, B, pb, o) {
  // two segments of the same polyline that meet
  if (A.s === B.s && (A.s.t === 'pline' || isParam(A.s))) {
    const s = A.s; if (isParam(s)) { const t0 = asPline(s), n0 = t0.pts.length, i0 = Math.min(A.i, B.i), j0 = Math.max(A.i, B.i); const v0 = j0 - i0 === 1 ? j0 : (i0 === 0 && j0 === n0 - 1 ? 0 : -1); if (v0 < 0 || !plCorner(t0, v0, o)) { flash(o.chamfer ? 'That chamfer does not fit' : 'That radius does not fit (or a segment is an arc)'); return false; } commit(() => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, t0); }); return true; }
    const n = s.pts.length; const i = Math.min(A.i, B.i), j = Math.max(A.i, B.i);
    let v = j - i === 1 ? j : (s.closed && i === 0 && j === n - 1 ? 0 : -1);
    if (v < 0) { flash('Pick two segments that meet'); return false; }
    const t = clone(s); if (!plCorner(t, v, o)) { flash(o.chamfer ? 'That chamfer does not fit' : 'That radius does not fit (or a segment is an arc)'); return false; }
    commit(() => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, t); }); return true;
  }
  const lineLike = x => x.s.t === 'line' || x.s.t === 'wall';
  if (!lineLike(A) || !lineLike(B)) { flash('Fillet and chamfer work on lines, walls and polyline corners'); return false; }
  const X = lineLineX(A.s.a, A.s.b, B.s.a, B.s.b); if (!X) { flash('The lines are parallel'); return false; }
  const ea = farEnd(A.s.a, A.s.b, X, pa), eb = farEnd(B.s.a, B.s.b, X, pb);
  const walls = A.s.t === 'wall' || B.s.t === 'wall'; const oo = walls ? { r: 0 } : o;
  const k = cornerCut(X, A.s[ea], B.s[eb], oo); if (!k) { flash('Those lines do not make a corner'); return false; }
  if (!k.ok) { flash(o.chamfer ? 'That chamfer does not fit' : 'That radius does not fit'); return false; }
  commit(() => {
    A.s[ea === 'b' ? 'a' : 'b'] = rp(k.TA); B.s[eb === 'b' ? 'a' : 'b'] = rp(k.TB);
    const style = { color: A.s.color, lw: A.s.lw, dash: A.s.dash, layer: A.s.layer };
    if (k.arc) lvShapes(lv).push(Object.assign({ id: uid() }, style, k.arc));
    else if (o.chamfer && !walls) lvShapes(lv).push(Object.assign({ id: uid(), t: 'line' }, style, { a: rp(k.TA), b: rp(k.TB) }));
    for (const w of [A.s, B.s]) if (w.t === 'wall' && typeof rehostOpenings === 'function') rehostOpenings(lv, w, [w]);
  });
  return true;
}
const cornerPick = s => ['line', 'wall', 'pline', 'rect', 'polygon'].includes(s.t);
function cornerTool(name, chamfer) {
  return {
    name,
    init(D) { D.stage = 'a'; D.r = PREFS.filletR ? toPlanMm(levelOf(page()), PREFS.filletR) : 0; D.d1 = PREFS.chamD1 ? toPlanMm(levelOf(page()), PREFS.chamD1) : 0; D.d2 = PREFS.chamD2 ? toPlanMm(levelOf(page()), PREFS.chamD2) : D.d1; },
    prompt(D, c) {
      if (D.stage === 'r') return `Fillet radius <${fmtLen(c.lv, D.r)}>:`;
      if (D.stage === 'd1') return `First chamfer distance <${fmtLen(c.lv, D.d1)}>:`;
      if (D.stage === 'd2') return `Second chamfer distance <${fmtLen(c.lv, D.d2)}>:`;
      if (D.stage === 'pl') return 'Select the polyline (every corner):';
      const now = chamfer ? `distances ${fmtLen(c.lv, D.d1)}, ${fmtLen(c.lv, D.d2)}` : `radius ${fmtLen(c.lv, D.r)}`;
      return D.stage === 'a' ? `Select first object [${chamfer ? 'Distance' : 'Radius'}/Polyline] (${now}):` : 'Select second object:';
    },
    o: D => chamfer ? { chamfer: true, d1: D.d1, d2: D.d2 } : { r: D.r },
    opt(D, w) {
      if (D.stage !== 'a') return false;
      if (!chamfer && (w === 'R' || w === 'RADIUS')) { D.stage = 'r'; D.want = 'dist'; return true; }
      if (chamfer && (w === 'D' || w === 'DISTANCE')) { D.stage = 'd1'; D.want = 'dist'; return true; }
      if (w === 'P' || w === 'POLYLINE') { D.stage = 'pl'; return true; }
      return false;
    },
    dist(D, v, c) {
      if (D.stage === 'r') { D.r = v; PREFS.filletR = r2(toRealMm(c.lv, v)); }
      else if (D.stage === 'd1') { D.d1 = v; PREFS.chamD1 = r2(toRealMm(c.lv, v)); D.stage = 'd2'; savePrefs(); return; }
      else if (D.stage === 'd2') { D.d2 = v; PREFS.chamD2 = r2(toRealMm(c.lv, v)); }
      savePrefs(); D.stage = 'a'; D.want = 'point';
    },
    enter(D) { if (D.stage === 'r' || D.stage === 'd2') { D.stage = 'a'; D.want = 'point'; return; } if (D.stage === 'd1') { D.stage = 'd2'; return; } drawExit(); },
    point(D, q, c) {
      const raw = c.raw || q;
      if (D.stage === 'pl') {
        const pk = pickShape(c.pg, c.lv, raw, s => s.t === 'pline' || isParam(s)); if (!pk) { flash(tolPick); return; }
        let n = 0; commit(() => { toPlineInPlace(pk.s); for (let v = pk.s.pts.length - 1; v >= 0; v--) if (plCorner(pk.s, v, this.o(D))) n++; });
        flash(`${n} corner(s) done`); D.stage = 'a'; return;
      }
      const pk = pickShape(c.pg, c.lv, raw, cornerPick); if (!pk) { flash(tolPick); return; }
      if (D.stage === 'a') { D.A = pk; D.pa = raw; D.stage = 'b'; sel = new Set([pk.s.id]); render(); return; }
      corner(c.pg, c.lv, D.A, D.pa, pk, raw, this.o(D)); sel = new Set(); render(); D.stage = 'a';
    },
  };
}
drawTool('fillet', cornerTool('Fillet', false));
drawTool('chamfer', cornerTool('Chamfer', true));

// ---------- break, join, explode ----------
function breakShape(lv, s, cv, s1, s2) {
  const N = cv.els.length; let parts;
  const base = s.t === 'circle' ? { t: 'arc', color: s.color, lw: s.lw, dash: s.dash, layer: s.layer } : s;
  if (!cv.closed) { const a = Math.min(s1, s2), b = Math.max(s1, s2); parts = []; if (a > 1e-6) parts.push([0, a]); if (b < N - 1e-6) parts.push([b, N]); }
  else parts = [[s2, s1]];
  commit(() => { replaceShape(lv, s, parts.map(([a, b]) => shapeFromEls(base, mergeEls(curveSlice(cv, a, b)), false))); sel.delete(s.id); });
}
drawTool('break', {
  name: 'Break',
  prompt: D => D.stage === 0 ? 'Select the object (the click is the first break point):' : D.stage === 'f1' ? 'Specify first break point:' : 'Specify second break point [First point]:',
  point(D, q, c) {
    if (D.stage === 0) { const pk = pickShape(c.pg, c.lv, c.raw || q, trimmable); if (!pk) { flash(tolPick); return; } D.pk = pk; D.s1 = curveNearest(pk.cv, q).s; D.stage = 'p2'; sel = new Set([pk.s.id]); render(); return; }
    if (D.stage === 'f1') { D.s1 = curveNearest(D.pk.cv, q).s; D.stage = 'p2'; return; }
    const s2 = curveNearest(D.pk.cv, q).s; if (Math.abs(s2 - D.s1) < 1e-6) { flash('Pick a second point away from the first'); return; }
    breakShape(c.lv, D.pk.s, D.pk.cv, D.s1, s2); drawRestart(D);
  },
  last: D => D.stage === 'p2' && D.pk ? curvePt(D.pk.cv, D.s1) : null,
  opt(D, w) { if (D.stage === 'p2' && (w === 'F' || w === 'FIRST')) { D.stage = 'f1'; return true; } return false; },
});
drawTool('breakat', {
  name: 'Break at point',
  prompt: D => D.stage === 0 ? 'Select the object:' : 'Specify the break point:',
  point(D, q, c) {
    if (D.stage === 0) { const pk = pickShape(c.pg, c.lv, c.raw || q, trimmable); if (!pk) { flash(tolPick); return; } if (pk.s.t === 'circle') { flash('Use Break with two points on a circle'); return; } D.pk = pk; D.stage = 1; sel = new Set([pk.s.id]); render(); return; }
    const cv = D.pk.cv, N = cv.els.length, sp = curveNearest(cv, q).s, s = D.pk.s;
    commit(() => {
      if (cv.closed) replaceShape(c.lv, s, [shapeFromEls(s, mergeEls(curveSlice(cv, sp, sp + N)), false)]);
      else if (sp > 1e-6 && sp < N - 1e-6) replaceShape(c.lv, s, [shapeFromEls(s, mergeEls(curveSlice(cv, 0, sp)), false), shapeFromEls(s, mergeEls(curveSlice(cv, sp, N)), false)]);
      sel = new Set();
    });
    drawRestart(D);
  },
});
const elsRev = els => els.slice().reverse().map(elRev);
function joinSel(lv) {
  const near = (a, b) => ptDist(a, b) < 0.05;
  const pool = selShapes(lv).filter(s => ['line', 'arc', 'pline'].includes(s.t) && !s.closed).map(s => ({ s, els: curveOf(s).els.map(e => Object.assign({}, e)) }));
  if (pool.length < 2) { flash('Select two or more lines, arcs or open polylines that meet'); return 0; }
  const chains = [];
  while (pool.length) {
    const cur = pool.shift(); let els = cur.els; const used = [cur.s]; let found = true;
    while (found) {
      found = false;
      for (let k = 0; k < pool.length; k++) {
        const o = pool[k], st = elStart(els[0]), en = elEnd(els[els.length - 1]), os = elStart(o.els[0]), oe = elEnd(o.els[o.els.length - 1]);
        if (near(en, os)) els = els.concat(o.els); else if (near(en, oe)) els = els.concat(elsRev(o.els));
        else if (near(st, oe)) els = o.els.concat(els); else if (near(st, os)) els = elsRev(o.els).concat(els); else continue;
        used.push(o.s); pool.splice(k, 1); found = true; break;
      }
    }
    chains.push({ els, used });
  }
  let n = 0;
  commit(() => {
    for (const ch of chains) {
      if (ch.used.length < 2) continue;
      const els = mergeEls(ch.els); const closed = near(elStart(els[0]), elEnd(els[els.length - 1]));
      const f = ch.used[0]; const style = { t: 'pline', color: f.color, lw: f.lw, dash: f.dash, layer: f.layer };
      let ns;
      const straight = els.every(e => e.k === 'L') && !closed && els.every(e => Math.abs(n180(ptAngle(e.a, e.b) - ptAngle(els[0].a, els[0].b))) < 0.01);
      if (straight) ns = Object.assign({}, style, { t: 'line', a: rp(els[0].a), b: rp(els[els.length - 1].b) });
      else ns = shapeFromEls(style, els, closed);
      ns.id = uid(); const i = lvShapes(lv).indexOf(f); lv.shapes.splice(i, 0, ns);
      const gone = new Set(ch.used.map(s => s.id)); lv.shapes = lv.shapes.filter(s => !gone.has(s.id)); sel = new Set([ns.id]); n++;
    }
  });
  if (!n) flash('Nothing to join: the ends must touch'); return n;
}
function explodeSel(lv) {
  let n = 0;
  commit(() => {
    const out = [];
    for (const s of lvShapes(lv)) {
      if (!sel.has(s.id)) { out.push(s); continue; }
      const parts = typeof explodeOther === 'function' ? explodeOther(lv, s) : null;
      if (parts) { out.push(...parts); n++; continue; }
      if (isParam(s)) { out.push(Object.assign(asPline(s), { id: uid() })); n++; continue; }
      if (s.t !== 'pline') { out.push(s); continue; }
      for (const e of curveOf(s).els) { const p = shapeFromEls({ t: 'line', color: s.color, lw: s.lw, dash: s.dash, layer: s.layer }, [e], false); p.id = uid(); out.push(p); }
      n++;
    }
    lv.shapes = out; sel = new Set();
  });
  if (!n) flash('Select rectangles, polygons, polylines, blocks or dimensions to explode'); return n;
}
const immediateTool = (name, fn) => ({
  name, init(D) { selInit(D, 'go'); if (D.stage === 'go') { fn(levelOf(page())); drawExit(); } }, picking: D => D.stage === 'sel',
  prompt: () => selPrompt, enter(D, c) { if (D.stage === 'sel' && selCount(c.lv)) { fn(c.lv); } drawExit(); }, point() {},
});
drawTool('join', immediateTool('Join', joinSel));
drawTool('explode', immediateTool('Explode', explodeSel));

// ---------- arrays ----------
function arrayRectDlg(lv) {
  const b = selGhost(lv).map(shapeBox); const bb = bboxPts(b.flatMap(x => [[x[0], x[1]], [x[2], x[3]]]));
  const w = toRealMm(lv, (bb[2] - bb[0]) * 1.5 || 20), h = toRealMm(lv, (bb[3] - bb[1]) * 1.5 || 20);
  dialog('Rectangular array', [['rows', 'Rows', '1', 'number'], ['cols', 'Columns', '3', 'number'], ['dy', 'Row spacing (up)', formatLength(h)], ['dx', 'Column spacing (right)', formatLength(w)]], v => {
    const R = Math.max(1, Math.min(100, parseInt(v.rows, 10) || 1)), C = Math.max(1, Math.min(100, parseInt(v.cols, 10) || 1));
    const dx = parseLength(v.dx), dy = parseLength(v.dy); if (dx == null || dy == null) { alert('Could not read the spacing.'); return false; }
    if (R * C > 1000) { alert('That is more than 1000 copies.'); return false; }
    commit(() => { const keep = new Set(sel); for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (r || c) selCopy(lv, tMove([toPlanMm(lv, dx) * c, -toPlanMm(lv, dy) * r])); sel = keep; });
  }, 'Create', '<div class="note">Negative spacing goes left or down. The selection is the first item.</div>');
}
function arrayPolarDlg(lv, c) {
  dialog('Polar array', [['n', 'Number of items (including the original)', '6', 'number'], ['fill', 'Angle to fill (degrees)', '360', 'number'], ['rot', 'Rotate items as they are copied', true, 'check']], v => {
    const n = Math.max(2, Math.min(360, parseInt(v.n, 10) || 2)); const fill = parseFloat(v.fill) || 360; const step = Math.abs(fill) >= 360 ? fill / n : fill / (n - 1);
    const cen = selCenter(lv);
    commit(() => { const keep = new Set(sel); for (let i = 1; i < n; i++) { const a = step * i; selCopy(lv, v.rot ? tRotate(c, a) : tMove(vsub(polarPt(c, ptDist(c, cen), ptAngle(c, cen) + a), cen))); } sel = keep; });
  }, 'Create');
}
function arrayPathDlg(lv, pk) {
  dialog('Path array', [['n', 'Number of items (including the original)', '5', 'number'], ['align', 'Turn items to follow the path', true, 'check']], v => {
    const n = Math.max(2, Math.min(500, parseInt(v.n, 10) || 2)); const cv = pk.cv; const L = curveLen(cv); const step = cv.closed ? L / n : L / (n - 1);
    const b0 = curveAtLen(cv, 0);
    commit(() => { const keep = new Set(sel); for (let i = 1; i < n; i++) { const q = curveAtLen(cv, step * i); let T = tMove(vsub(q.p, b0.p)); if (v.align) T = tCompose(T, tRotate(q.p, q.dir - b0.dir)); selCopy(lv, T); } sel = keep; });
  }, 'Create', '<div class="note">Items are spaced evenly along the path, starting where it starts.</div>');
}
drawTool('arrayrect', { name: 'Rectangular array', init(D) { selInit(D, 'go'); if (D.stage === 'go') { arrayRectDlg(levelOf(page())); drawExit(); } }, picking: D => D.stage === 'sel', prompt: () => selPrompt, enter(D, c) { if (D.stage === 'sel' && selCount(c.lv)) arrayRectDlg(c.lv); drawExit(); }, point() {} });
drawTool('arraypolar', {
  name: 'Polar array', init(D) { selInit(D, 'c'); }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : 'Specify the center point of the array:',
  enter(D, c) { if (!selEnter(D, c)) drawExit(); }, point(D, q, c) { if (D.stage === 'c') { arrayPolarDlg(c.lv, q); drawExit(); } },
});
drawTool('arraypath', {
  name: 'Path array', init(D) { selInit(D, 'path'); }, picking: D => D.stage === 'sel',
  prompt: D => D.stage === 'sel' ? selPrompt : 'Select the path (line, arc, polyline, spline...):',
  enter(D, c) { if (!selEnter(D, c)) drawExit(); },
  point(D, q, c) { if (D.stage !== 'path') return; const pk = pickShape(c.pg, c.lv, c.raw || q, s => !sel.has(s.id) && trimmable(s)); if (!pk) { flash(tolPick); return; } arrayPathDlg(c.lv, pk); drawExit(); },
});

// ---------- draw order ----------
function drawOrder(where) {
  const lv = levelOf(page()); if (!lv) return; const s = selShapes(lv); if (!s.length) { flash('Select shapes first'); return; }
  commit(() => { const rest = lvShapes(lv).filter(x => !sel.has(x.id)); lv.shapes = where === 'front' ? rest.concat(s) : s.concat(rest); });
}

// ---------- commands ----------
const editMode = m => () => { if (needFloor()) setMode('d:' + m); };
registerCommand('MOVE', ['M'], 'Move objects', editMode('move'));
registerCommand('COPY', ['CO', 'CP'], 'Copy objects (floor plans); copy to the clipboard elsewhere', () => isFloor(page()) ? setMode('d:copy') : copySel());
registerCommand('ROTATE', ['RO'], 'Rotate objects', () => isFloor(page()) ? setMode('d:rotate') : rotateSel());
registerCommand('MIRROR', ['MI'], 'Mirror objects', () => isFloor(page()) ? setMode('d:mirror') : mirrorSel());
registerCommand('SCALE', ['SC'], 'Scale objects (SCALE 1/4"=1\' sets the drawing scale)', a => {
  if (String(a || '').trim()) { if (!needFloor()) return; const r = parseScale(a); if (!r) { flash('Could not read that scale. Try 1/4"=1\' or 1:50'); return; } setLevelScale(levelOf(page()), r); flash('Scale ' + formatScale(r)); return; }
  if (needFloor()) setMode('d:scale');
});
registerCommand('DRAWINGSCALE', ['DSC'], 'Drawing scale of the level: DRAWINGSCALE 1/4"=1\' or 1:50', a => {
  if (!needFloor()) return; const lv = levelOf(page());
  if (!String(a || '').trim()) { scaleDlg(lv); return; }
  const r = parseScale(a); if (!r) { flash('Could not read that scale'); return; } setLevelScale(lv, r); flash('Scale ' + formatScale(r));
});
registerCommand('OFFSET', ['O'], 'Offset a line, arc, circle, polyline, wall or room outline', editMode('offset'));
registerCommand('TRIM', ['TR'], 'Trim objects at the edges they cross', editMode('trim'));
registerCommand('EXTEND', ['EX'], 'Extend objects to the next edge', editMode('extend'));
registerCommand('FILLET', ['F'], 'Round or square a corner between two lines, walls or polyline segments', editMode('fillet'));
registerCommand('CHAMFER', ['CHA'], 'Cut a corner between two lines or polyline segments', editMode('chamfer'));
registerCommand('BREAK', ['BR'], 'Break a gap out of an object', editMode('break'));
registerCommand('BREAKATPOINT', ['BRP'], 'Split an object in two at a point', editMode('breakat'));
registerCommand('JOIN', ['J'], 'Join lines, arcs and polylines that touch', editMode('join'));
registerCommand('EXPLODE', ['X'], 'Break polylines, blocks and dimensions into parts', editMode('explode'));
registerCommand('ARRAYRECT', ['AR', 'ARRAY'], 'Copy the selection in rows and columns', editMode('arrayrect'));
registerCommand('ARRAYPOLAR', ['ARP'], 'Copy the selection around a center', editMode('arraypolar'));
registerCommand('ARRAYPATH', ['ARPA'], 'Copy the selection along a path', editMode('arraypath'));
registerCommand('BRINGTOFRONT', ['BTF', 'DR'], 'Draw the selected shapes on top', () => drawOrder('front'));
registerCommand('SENDTOBACK', ['STB'], 'Draw the selected shapes underneath', () => drawOrder('back'));
