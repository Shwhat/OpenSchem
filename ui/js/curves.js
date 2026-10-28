// ---------- curve elements for editing: intersections, nearest points, pieces ----------
// A shape's path is a list of elements: { k: 'L', a, b } or { k: 'A', c, r, a0, sw } (sw signed degrees, counter-
// clockwise positive). A position on the path is s = element index + t (0..1). Ellipses and splines are approximated
// by short lines (they come back as polylines when cut).
const EPS = 1e-7;
function elStart(e) { return e.k === 'L' ? e.a : polarPt(e.c, e.r, e.a0); }
function elEnd(e) { return e.k === 'L' ? e.b : polarPt(e.c, e.r, e.a0 + e.sw); }
function elPt(e, t) { return e.k === 'L' ? [e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t] : polarPt(e.c, e.r, e.a0 + e.sw * t); }
const elLen = e => e.k === 'L' ? ptDist(e.a, e.b) : Math.abs(e.sw) * D2R * e.r;
// direction of travel (degrees) at t
function elDir(e, t) { if (e.k === 'L') return ptAngle(e.a, e.b); return e.a0 + e.sw * t + (e.sw >= 0 ? 90 : -90); }
function elPart(e, t0, t1) {
  if (e.k === 'L') return { k: 'L', a: elPt(e, t0), b: elPt(e, t1) };
  return { k: 'A', c: e.c, r: e.r, a0: e.a0 + e.sw * t0, sw: e.sw * (t1 - t0) };
}
const elRev = e => e.k === 'L' ? { k: 'L', a: e.b, b: e.a } : { k: 'A', c: e.c, r: e.r, a0: e.a0 + e.sw, sw: -e.sw };
const elBulge = e => e.k === 'L' ? 0 : r2(Math.tan(e.sw * D2R / 4) * 1e5) / 1e5;
// parameter on an arc element for an angle (null when outside the sweep)
function arcT(e, ang, tol = 1e-6) {
  const d = e.sw >= 0 ? n360(ang - e.a0) : n360(e.a0 - ang); const sw = Math.abs(e.sw);
  if (sw >= 360 - 1e-9) return d / 360;
  if (d <= sw + tol) return Math.min(1, d / sw);
  if (d >= 360 - tol) return 0;
  return null;
}
function elNearest(e, p) {
  if (e.k === 'L') { const r = distPtSeg(p, e.a, e.b); const L2 = ptDist(e.a, e.b) ** 2; const t = L2 ? ((p[0] - e.a[0]) * (e.b[0] - e.a[0]) + (p[1] - e.a[1]) * (e.b[1] - e.a[1])) / L2 : 0; return { t: Math.max(0, Math.min(1, t)), d: r.d, q: r.q }; }
  const t = arcT(e, ptAngle(e.c, p));
  if (t != null) { const q = elPt(e, t); return { t, d: ptDist(p, q), q }; }
  const a = elStart(e), b = elEnd(e); return ptDist(p, a) <= ptDist(p, b) ? { t: 0, d: ptDist(p, a), q: a } : { t: 1, d: ptDist(p, b), q: b };
}

// ---------- paths of shapes ----------
function curveOf(s) {
  if (s.t === 'line' || s.t === 'wall') return { els: [{ k: 'L', a: s.a, b: s.b }], closed: false };
  if (s.t === 'arc') return { els: [{ k: 'A', c: s.c, r: s.r, a0: s.a0, sw: arcSweep(s) }], closed: false };
  if (s.t === 'circle') return { els: [{ k: 'A', c: s.c, r: s.r, a0: 0, sw: 360 }], closed: true };
  if (s.t === 'pline') return { els: plSegs(s).map(([a, b, bu]) => { const k = bu && bulgeArc(a, b, bu); return k ? { k: 'A', c: k.c, r: k.r, a0: k.a0, sw: k.sweep } : { k: 'L', a, b }; }), closed: !!s.closed };
  if (s.t === 'ellipse' || s.t === 'spline') { const o = shapeOutline(s); return { els: outlineSegs(o).map(([a, b]) => ({ k: 'L', a, b })), closed: o.closed, approx: true }; }
  return null;
}
function roomCurve(r) { const p = roomPoly(r); return { els: p.map((a, i) => ({ k: 'L', a, b: p[(i + 1) % p.length] })), closed: true }; }
const curvePt = (cv, s) => { const i = Math.min(cv.els.length - 1, Math.max(0, Math.floor(s))); return elPt(cv.els[i], s - i); };
const curveLen = cv => cv.els.reduce((t, e) => t + elLen(e), 0);
function curveNearest(cv, p) { let best = null; cv.els.forEach((e, i) => { const r = elNearest(e, p); if (!best || r.d < best.d) best = { s: i + r.t, d: r.d, q: r.q, i }; }); return best; }
// point and direction at a distance along the path
function curveAtLen(cv, L) {
  let acc = 0;
  for (let i = 0; i < cv.els.length; i++) { const e = cv.els[i], l = elLen(e); if (acc + l >= L - 1e-9 || i === cv.els.length - 1) { const t = l ? Math.max(0, Math.min(1, (L - acc) / l)) : 0; return { p: elPt(e, t), dir: elDir(e, t) }; } acc += l; }
  return null;
}

// ---------- intersections (parameters on element e of crossings with element f) ----------
// o.extend: treat e as unbounded (infinite line or full circle)
function lineCircle(a, b, c, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - c[0], fy = a[1] - c[1];
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r; const D = B * B - 4 * A * C;
  if (A < EPS || D < -EPS) return [];
  const sq = Math.sqrt(Math.max(0, D)); return D < EPS ? [-B / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
}
function circleCircle(c1, r1, c2, r2_) {
  const d = ptDist(c1, c2); if (d < EPS || d > r1 + r2_ + EPS || d < Math.abs(r1 - r2_) - EPS) return [];
  const a = (r1 * r1 - r2_ * r2_ + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + a * (c2[0] - c1[0]) / d, my = c1[1] + a * (c2[1] - c1[1]) / d;
  const ox = -(c2[1] - c1[1]) / d * h, oy = (c2[0] - c1[0]) / d * h;
  return h < EPS ? [[mx, my]] : [[mx + ox, my + oy], [mx - ox, my - oy]];
}
function elCross(e, f, o = {}) {
  const out = []; const inF = p => f.k === 'L' ? distPtSeg(p, f.a, f.b).d < 1e-5 : arcT(f, ptAngle(f.c, p), 1e-6) != null && Math.abs(ptDist(f.c, p) - f.r) < 1e-4;
  const pushT = (t, p) => { if (!inF(p)) return; if (!o.extend && (t < -1e-9 || t > 1 + 1e-9)) return; out.push({ t, p }); };
  if (e.k === 'L') {
    if (f.k === 'L') {
      const r = [e.b[0] - e.a[0], e.b[1] - e.a[1]], s = [f.b[0] - f.a[0], f.b[1] - f.a[1]]; const den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < EPS) return out;
      const t = ((f.a[0] - e.a[0]) * s[1] - (f.a[1] - e.a[1]) * s[0]) / den; pushT(t, [e.a[0] + t * r[0], e.a[1] + t * r[1]]);
    } else for (const t of lineCircle(e.a, e.b, f.c, f.r)) pushT(t, elPt(e, t));
  } else {
    const full = { k: 'A', c: e.c, r: e.r, a0: e.a0, sw: e.sw >= 0 ? 360 : -360 };
    const pts = f.k === 'L' ? lineCircle(f.a, f.b, e.c, e.r).filter(t => t > -1e-9 && t < 1 + 1e-9).map(t => elPt(f, t)) : circleCircle(e.c, e.r, f.c, f.r);
    for (const p of pts) {
      if (f.k === 'A' && !inF(p)) continue;
      let t = arcT(e, ptAngle(e.c, p));
      if (t == null) { if (!o.extend) continue; t = (e.sw >= 0 ? n360(ptAngle(e.c, p) - e.a0) : n360(e.a0 - ptAngle(e.c, p))) / Math.abs(e.sw); }
      out.push({ t, p });
    }
    void full;
  }
  return out;
}
// every element on the level other than the shape itself (cutting and boundary edges)
function levelEdges(lv, skipId, forWall) {
  const els = [];
  for (const s of lvShapes(lv)) { if (s.id === skipId || !objShown(s) || s.t === 'text' || s.t === 'opening') continue; const cv = s.t === 'wall' ? (forWall ? curveOf(s) : wallEdgeCurve(s)) : curveOf(s); if (cv) els.push(...cv.els); }
  for (const r of lv.rooms) els.push(...roomCurve(r).els);
  return els;
}
// wall faces count as edges as well as the reference line
function wallEdgeCurve(w) { const els = [{ k: 'L', a: w.a, b: w.b }]; if (typeof wallPoly === 'function') { const p = wallPoly(w); for (let i = 0; i < p.length; i++) els.push({ k: 'L', a: p[i], b: p[(i + 1) % p.length] }); } return { els, closed: false }; }
function curveCuts(cv, edges, o = {}) {
  const ts = [];
  cv.els.forEach((e, i) => { for (const f of edges) for (const x of elCross(e, f, o)) ts.push(i + Math.max(0, Math.min(1, x.t))); });
  ts.sort((a, b) => a - b); const out = []; for (const t of ts) if (!out.length || t - out[out.length - 1] > 1e-6) out.push(t);
  return out;
}

// ---------- building shapes back from pieces ----------
// the elements between path positions s0 and s1 (s1 may wrap past the end on closed paths)
function curveSlice(cv, s0, s1) {
  const n = cv.els.length, out = [];
  if (s1 < s0) s1 += n;
  let s = s0;
  while (s < s1 - 1e-9) {
    const i = Math.floor(s + 1e-9) % n, base = Math.floor(s + 1e-9); const t0 = s - base, t1 = Math.min(1, s1 - base);
    if (t1 - t0 > 1e-9) out.push(elPart(cv.els[i], t0, t1));
    s = base + 1;
  }
  return out;
}
function shapeFromEls(orig, els, closed) {
  const style = {}; for (const k of ['color', 'lw', 'dash', 'layer']) if (orig[k] != null) style[k] = orig[k];
  if (!els.length) return null;
  if (els.length === 1 && !closed) {
    const e = els[0];
    if (e.k === 'L') return Object.assign(orig.t === 'wall' ? Object.assign(clone(orig), { id: undefined }) : { t: 'line' }, style, { a: rp(e.a), b: rp(e.b) });
    if (orig.t !== 'pline') { const a0 = e.sw >= 0 ? e.a0 : e.a0 + e.sw, a1 = e.sw >= 0 ? e.a0 + e.sw : e.a0; return Object.assign({ t: 'arc' }, style, { c: rp(e.c), r: r2(e.r), a0: r2(n360(a0)), a1: r2(n360(a1)) }); }
  }
  const pts = [rp(elStart(els[0]))]; const b = [];
  for (const e of els) { pts.push(rp(elEnd(e))); b.push(elBulge(e)); }
  if (closed) pts.pop();
  const s = Object.assign({ t: 'pline' }, style, { pts, closed: !!closed }); if (b.some(x => x)) s.b = b;
  if (orig.t === 'pline' && orig.wd) { const w = orig.wd.find(x => x && (x[0] || x[1])); if (w) s.wd = b.map(() => [w[0], w[0]]); }
  return s;
}
