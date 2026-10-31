// ---------- grips ----------
// Selected shapes and devices show grips (small squares at their key points). Click a grip to make it hot, then click
// where it goes, or drag it. While a grip is hot, Space or Enter steps through Stretch, Move, Rotate, Scale and
// Mirror around it; type B to pick another base point, C to keep copies, a number for an exact angle or scale.
let gripOp = null;
const GRIP_MODES = ['stretch', 'move', 'rotate', 'scale', 'mirror'];
const GRIP_NAMES = { stretch: 'Stretch', move: 'Move', rotate: 'Rotate', scale: 'Scale', mirror: 'Mirror' };
const GRIP_MAX = 200;

function shapeGrips(s) {
  if (s.t === 'line') return [s.a, s.b, midPt(s.a, s.b)];
  if (s.t === 'pline') return s.pts.concat(plSegs(s).map(([a, b, bu]) => { const k = bu && bulgeArc(a, b, bu); return k ? polarPt(k.c, k.r, k.a0 + k.sweep / 2) : midPt(a, b); }));
  if (s.t === 'arc') return [arcStart(s), arcEnd(s), arcMid(s), s.c];
  if (s.t === 'circle') return [s.c, ...[0, 90, 180, 270].map(a => polarPt(s.c, s.r, a))];
  if (s.t === 'ellipse') return [s.c, ...[0, 1, 2, 3].map(i => ellipsePt(s, i * Math.PI / 2))];
  if (s.t === 'rect') { const c = rectCorners(s); return c.concat(c.map((p, i) => midPt(p, c[(i + 1) % 4])), [s.c]); }
  if (s.t === 'polygon') return [s.c, ...polyVerts(s)];
  if (s.t === 'spline') return s.pts.slice();
  if (s.t === 'text') return [s.p];
  if (s.t === 'wall') return [s.a, s.b, midPt(s.a, s.b)];
  if (s.t === 'opening') { const w = wallOfOpening(s); if (!w) return [s.c]; const g = openingGeom(s, w); return [g.P(g.at, g.mid), g.P(g.s0, g.mid), g.P(g.s1, g.mid)]; }
  if (typeof shapeGripsMore === 'function') return shapeGripsMore(s) || [];
  return [];
}
const shiftPt = (p, d) => rp([p[0] + d[0], p[1] + d[1]]);
// moves grip i of shape s to q (center and middle grips move the whole shape)
function gripStretch(s, i, q) {
  q = rp(q);
  if (s.t === 'line') { if (i === 0) s.a = q; else if (i === 1) s.b = q; else { const m = midPt(s.a, s.b), d = [q[0] - m[0], q[1] - m[1]]; s.a = shiftPt(s.a, d); s.b = shiftPt(s.b, d); } }
  else if (s.t === 'pline') {
    const n = s.pts.length;
    if (i < n) s.pts[i] = q;
    else {
      const j = i - n, a = s.pts[j], b = s.pts[(j + 1) % n], bu = (s.b || [])[j] || 0;
      if (bu) { const nb = bulgeFrom3(a, q, b); if (nb) s.b[j] = r2(nb * 1e4) / 1e4; }
      else { const m = midPt(a, b), d = [q[0] - m[0], q[1] - m[1]]; s.pts[j] = shiftPt(a, d); s.pts[(j + 1) % n] = shiftPt(b, d); }
    }
  } else if (s.t === 'arc') {
    if (i === 3) { s.c = q; return s; }
    const st = arcStart(s), en = arcEnd(s), mi = arcMid(s);
    const k = i === 0 ? arc3(q, mi, en) : i === 1 ? arc3(st, mi, q) : arc3(st, q, en);
    if (k) Object.assign(s, { c: k.c, r: k.r, a0: k.a0, a1: k.a1 });
  } else if (s.t === 'circle') { if (i === 0) s.c = q; else if (ptDist(s.c, q) > 0.01) s.r = r2(ptDist(s.c, q)); }
  else if (s.t === 'ellipse') {
    if (i === 0) s.c = q;
    else if (ptDist(s.c, q) > 0.01) { if (i === 1 || i === 3) { s.rx = r2(ptDist(s.c, q)); s.rot = r2(n360(ptAngle(s.c, q) + (i === 3 ? 180 : 0))); } else s.ry = r2(ptDist(s.c, q)); }
  } else if (s.t === 'rect') rectGrip(s, i, q);
  else if (s.t === 'polygon') {
    if (i === 0) s.c = q;
    else if (ptDist(s.c, q) > 0.01) { const d = ptDist(s.c, q); s.r = r2(s.ic === 'C' ? d * Math.cos(Math.PI / s.n) : d); const a0 = ptAngle(s.c, q) - (i - 1) * 360 / s.n; s.rot = r2(n360(a0 - (s.ic === 'C' ? 180 / s.n : 0))); }
  } else if (s.t === 'spline') s.pts[i] = q;
  else if (s.t === 'text') s.p = q;
  else if (s.t === 'wall') { if (i === 0) s.a = q; else if (i === 1) s.b = q; else { const m = midPt(s.a, s.b), d = [q[0] - m[0], q[1] - m[1]]; s.a = shiftPt(s.a, d); s.b = shiftPt(s.b, d); } }
  else if (s.t === 'opening') {
    const w = wallOfOpening(s); if (!w) return s; const ax = wallAxis(w); const sq = (q[0] - w.a[0]) * ax.u[0] + (q[1] - w.a[1]) * ax.u[1];
    if (i === 0) s.c = rp(axPt(w, ax, sq, 0)); else { const at = openingAt(s, w); const nw = 2 * Math.abs(sq - at); if (nw > 0.5) s.w = r2(Math.min(nw, ax.len) * 1000) / 1000; }
  } else if (typeof gripStretchMore === 'function') gripStretchMore(s, i, q);
  return s;
}
// rectangle grips: 0-3 corners (the opposite corner stays), 4-7 side middles (the opposite side stays), 8 center (moves)
function rectGrip(s, i, q) {
  if (i === 8) { s.c = q; return; }
  const p = rectLocal(s, q), hw = s.w / 2, hh = s.h / 2;
  let x0 = -hw, x1 = hw, y0 = -hh, y1 = hh;
  if (i < 4) { const [sx, sy] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i]; if (sx < 0) x0 = p[0]; else x1 = p[0]; if (sy < 0) y0 = p[1]; else y1 = p[1]; }
  else if (i === 4) y0 = p[1]; else if (i === 5) x1 = p[0]; else if (i === 6) y1 = p[1]; else x0 = p[0];
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); if (w < 0.01 || h < 0.01) return;
  s.c = rp(rectAt(s, (x0 + x1) / 2, (y0 + y1) / 2)); s.w = r2(w); s.h = r2(h);
}
const gripAt = (s, p) => shapeGrips(s).findIndex(g => ptDist(g, p) < 0.02);

// ---------- drawing the grips ----------
function gripsSVG(lv, t) {
  if (mode !== 'select') return '';
  const h = r2(1.1 / t.s * 1000) / 1000; let out = '', n = 0;
  const hot = p => gripOp && ptDist(p, gripOp.base) < 0.02;
  const g = (p, key) => { n++; return `<rect class="grip${hot(p) ? ' hot' : ''}" data-grip="${key}" x="${r2(p[0] - h)}" y="${r2(p[1] - h)}" width="${r2(2 * h)}" height="${r2(2 * h)}" style="stroke-width:${r2(0.25 / t.s * 1000) / 1000}"/>`; };
  for (const s of lvShapes(lv)) if (sel.has(s.id) && !objLocked(s) && n < GRIP_MAX) shapeGrips(s).forEach((p, i) => { out += g(p, `s:${s.id}:${i}`); });
  for (const pl of lv.places) if (sel.has(pl.id) && n < GRIP_MAX) { out += g([pl.x, pl.y], `p:${pl.id}:0`); out += g(devRotGrip(pl), `p:${pl.id}:1`).replace('class="grip', 'class="grip grot'); }
  return out;
}

// ---------- the hot grip ----------
function gripStart(pg, lv, key) {
  const [kind, id, i] = key.split(':');
  let base = null;
  if (kind === 's') { const s = lvShapes(lv).find(x => x.id === id); if (s) base = shapeGrips(s)[+i]; }
  else { const pl = lv.places.find(x => x.id === id); if (pl) base = [pl.x, pl.y]; if (pl && i === '1') { const op0 = { rot: true, ref: ptAngle(base, devRotGrip(pl)) }; gripStart.rotOnly = op0; } }
  if (!base) return;
  const hits = [];
  for (const s of lvShapes(lv)) if (sel.has(s.id)) { const gi = gripAt(s, base); if (gi >= 0) hits.push({ kind: 's', id: s.id, i: gi }); }
  for (const pl of lv.places) if (sel.has(pl.id) && ptDist([pl.x, pl.y], base) < 0.02) hits.push({ kind: 'p', id: pl.id });
  const boxPts = [];
  for (const s of lvShapes(lv)) if (sel.has(s.id)) { const b = shapeBox(s); boxPts.push([b[0], b[1]], [b[2], b[3]]); }
  for (const pl of lv.places) if (sel.has(pl.id)) boxPts.push([pl.x, pl.y]);
  for (const r of lv.rooms) if (sel.has(r.id)) boxPts.push(...r.pts);
  const ref = Math.max(1, ...boxPts.map(p => ptDist(base, p)));
  gripOp = { mode: 'stretch', base: rp(base), hits, lv, pre: snapshot(), orig: clone({ shapes: lvShapes(lv), places: lv.places, rooms: lv.rooms }), pressed: true, moved: false, copy: false, copies: 0, ref, cur: base, downAt: base };
  if (gripStart.rotOnly) { gripOp.mode = 'rotate'; gripOp.rotRef = gripStart.rotOnly.ref; gripStart.rotOnly = null; }
  renderCanvas(); gripStatus();
}
// the rotate grip of a device, beside the symbol in the direction it faces
function devRotGrip(pl) { return rp(polarPt([pl.x, pl.y], 8, -(pl.rot || 0))); }
function gripSkip(op) {
  const skip = new Set();
  if (op.mode === 'stretch') for (const h of op.hits) skip.add(h.id); else for (const id of sel) skip.add(id);
  return skip;
}
function gripT(op, q) {
  const b = op.base;
  if (op.mode === 'move') return tMove([q[0] - b[0], q[1] - b[1]]);
  if (op.mode === 'rotate') return tRotate(b, op.num ?? (ptDist(b, q) < 1e-6 ? 0 : ptAngle(b, q) - (op.rotRef || 0)));
  if (op.mode === 'scale') { const k = op.num ?? ptDist(b, q) / op.ref; return k > 1e-6 ? tScale(b, k) : null; }
  if (op.mode === 'mirror') return ptDist(b, q) < 1e-6 ? null : tMirror(b, ptAngle(b, q));
  return null;
}
// what the selected shapes become with the cursor at q (copies of the originals)
function gripResult(op, q) {
  const o = clone(op.orig);
  if (op.mode === 'stretch') {
    for (const h of op.hits) {
      if (h.kind === 's') { const s = o.shapes.find(x => x.id === h.id); if (s) gripStretch(s, h.i, q); }
      else { const pl = o.places.find(x => x.id === h.id); if (pl) { pl.x = r2(q[0]); pl.y = r2(q[1]); } }
    }
    return o;
  }
  const T = gripT(op, q); if (!T) return o;
  const ids = withHosted({ shapes: o.shapes }, sel);
  for (const s of o.shapes) if (ids.has(s.id)) transformShape(s, T);
  for (const pl of o.places) if (sel.has(pl.id)) transformPlace(pl, T);
  for (const r of o.rooms) if (sel.has(r.id)) transformRoom(r, T);
  return o;
}
const gripCopyIds = op => op.mode === 'stretch' ? new Set(op.hits.filter(h => h.kind === 's').map(h => h.id)) : sel;
function gripPreview(pg, q, r) {
  const op = gripOp, lv = op.lv; op.cur = q;
  const o = gripResult(op, q);
  if (op.copy) { lv.shapes = clone(op.orig.shapes); lv.places = clone(op.orig.places); lv.rooms = clone(op.orig.rooms); }
  else { lv.shapes = o.shapes; lv.places = o.places; lv.rooms = o.rooms; }
  renderCanvas();
  const t = fpXform(pg), a = toSheet(pg, ...op.base), b = toSheet(pg, ...q), u = 1 / (view.s || 1);
  let s = `<path class="trk" d="M${a[0]},${a[1]}L${b[0]},${b[1]}" style="stroke-width:${1.2 * u}"/>`;
  if (op.copy) s += `<g transform="translate(${t.tx},${t.ty}) scale(${t.s})">${o.shapes.filter(x => gripCopyIds(op).has(x.id)).map(x => shapeSVG(x, t.s, { ghost: true })).join('')}</g>`;
  let label = GRIP_NAMES[op.mode] + (op.copy ? ' (copy)' : '');
  if (op.mode === 'rotate') label += ' ' + r2(ptDist(op.base, q) < 1e-6 ? 0 : ptAngle(op.base, q)) + '°';
  else if (op.mode === 'scale') label += ' x' + (Math.round(ptDist(op.base, q) / op.ref * 100) / 100);
  else label += ' ' + formatLength(toRealMm(lv, ptDist(op.base, q)));
  $('#overlay').innerHTML = s + (r ? fpMark(pg, r) : '');
}
function gripPoint(pg, lv, raw) { return fpPoint(pg, lv, raw, { last: gripOp.base, skip: gripSkip(gripOp) }); }
function gripDown(pg, lv, raw) { const r = gripPoint(pg, lv, raw); gripClick(pg, r.p); }
function gripMove(pg, lv, raw) {
  const r = gripPoint(pg, lv, raw); fAim = r.p;
  if (gripOp.pressed && ptDist(r.p, gripOp.downAt) > 0.5) gripOp.moved = true;
  gripPreview(pg, r.p, r);
}
function gripUp(pg) { const op = gripOp; if (!op || !op.pressed) return; op.pressed = false; if (op.moved) gripClick(pg, op.cur); }
// a click (or the end of a drag, or a typed point) with the grip hot
function gripClick(pg, q) {
  const op = gripOp; if (!op) return; q = rp(q);
  if (op.wantBase) { op.wantBase = false; op.base = q; op.downAt = q; gripPreview(pg, q); gripStatus(); return; }
  const o = gripResult(op, q);
  if (op.copy) {
    const made = o.shapes.filter(x => gripCopyIds(op).has(x.id)).map(x => Object.assign(clone(x), { id: uid() }));
    op.orig.shapes.push(...made); op.copies += made.length; op.num = undefined; gripPreview(pg, q); return;
  }
  const lv = op.lv; lv.shapes = o.shapes; lv.places = o.places; lv.rooms = o.rooms;
  for (const pl of lv.places) if (sel.has(pl.id)) autoRoom(lv, pl);
  gripOp = null; pushUndo(op.pre); markDirty(); $('#overlay').innerHTML = ''; render(); gripStatus();
}
function gripCycle() { const op = gripOp; if (!op) return; op.mode = GRIP_MODES[(GRIP_MODES.indexOf(op.mode) + 1) % GRIP_MODES.length]; op.num = undefined; gripPreview(page(), op.cur || op.base); gripStatus(); flash('Grip: ' + GRIP_NAMES[op.mode]); }
function gripCancel() {
  const op = gripOp; if (!op) return false;
  const lv = op.lv; lv.shapes = op.orig.shapes; lv.places = op.orig.places; lv.rooms = op.orig.rooms; gripOp = null;
  if (op.copies) { pushUndo(op.pre); markDirty(); }
  $('#overlay').innerHTML = ''; render(); gripStatus(); return true;
}
const gripEscape = () => gripCancel();
function gripStatus() { renderStatus(); }
function gripPrompt() {
  const op = gripOp; const what = op.wantBase ? 'base point' : op.mode === 'rotate' ? 'rotation angle' : op.mode === 'scale' ? 'scale factor' : op.mode === 'mirror' ? 'second point of the mirror line' : op.mode === 'move' ? 'move point' : 'stretch point';
  return `** ${GRIP_NAMES[op.mode].toUpperCase()} ** Specify ${what} [Base point/Copy/eXit] (Space for the next mode):`;
}
function gripTyped(text) {
  const op = gripOp; if (!op) return false; const pg = page(), lv = levelOf(pg); const t = String(text || '').trim(); const w = t.toUpperCase();
  if (!t) { gripCycle(); return true; }
  const modes = { ST: 'stretch', STRETCH: 'stretch', MO: 'move', MOVE: 'move', RO: 'rotate', ROTATE: 'rotate', SC: 'scale', SCALE: 'scale', MI: 'mirror', MIRROR: 'mirror' };
  if (modes[w]) { op.mode = modes[w]; gripPreview(pg, op.cur || op.base); gripStatus(); return true; }
  if (w === 'B' || w === 'BASE') { op.wantBase = true; gripStatus(); return true; }
  if (w === 'C' || w === 'COPY') { op.copy = !op.copy; gripPreview(pg, op.cur || op.base); gripStatus(); return true; }
  if (w === 'X' || w === 'EXIT') { gripCancel(); return true; }
  if ((op.mode === 'rotate' || op.mode === 'scale') && !op.wantBase && /^-?\d*\.?\d+$/.test(t)) {
    const n = parseFloat(t); if (op.mode === 'scale' && !(n > 0)) { flash('The scale factor must be above zero'); return true; }
    op.num = n; gripClick(pg, op.base); return true;
  }
  const q = fpTypedPoint(pg, lv, { kind: 'draw', last: op.base }, t);
  if (!q) { flash(`Could not read "${t}"`); return true; }
  gripClick(pg, q); return true;
}
