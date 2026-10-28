// ---------- floor plan shapes: geometry, drawing on the page, snaps, transforms ----------
// Shapes live per level in lv.shapes, in plan coordinates (sheet millimetres before the page's view transform).
// Angles are degrees counter-clockwise as seen on screen (Y up), like ptAngle and polarPt.
//   line    { a, b }
//   pline   { pts, b: [bulge per segment], wd: [[start width, end width] per segment] (real width in plan units), closed }
//   arc     { c, r, a0, a1 }              counter-clockwise from a0 to a1
//   circle  { c, r }
//   ellipse { c, rx, ry, rot }
//   spline  { pts, closed }               a smooth curve through the points
//   text    { p, text, h, rot }           h: text height on paper (mm)
// Every shape also has id, and optionally color, lw (line width on paper, mm), dash, fill, layer.
const D2R = Math.PI / 180;
const SHAPE_NAMES = { wall: 'Wall', opening: 'Opening', line: 'Line', pline: 'Polyline', arc: 'Arc', circle: 'Circle', ellipse: 'Ellipse', spline: 'Spline', text: 'Text' };
const SHAPE_LW = ['0.13', '0.18', '0.25', '0.35', '0.5', '0.7', '1', '1.4'];
const lvShapes = lv => lv ? (lv.shapes || (lv.shapes = [])) : [];
const n360 = a => ((a % 360) + 360) % 360;
const n180 = a => { a = n360(a); return a > 180 ? a - 360 : a; };
const rp = p => [r2(p[0]), r2(p[1])];
const midPt = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function findShape(id) { for (const lv of P.levels || []) { const s = lvShapes(lv).find(x => x.id === id); if (s) return { lv, s }; } return null; }

// ---------- arcs ----------
// arc of a polyline segment from a to b with bulge (tan of a quarter of the included angle; positive = counter-clockwise)
function bulgeArc(a, b, bu) {
  const L = ptDist(a, b); if (!L || !bu) return null;
  const th = 4 * Math.atan(bu);
  const ax = a[0], ay = -a[1], bx = b[0], by = -b[1];
  const dx = (bx - ax) / L, dy = (by - ay) / L, h = (L / 2) / Math.tan(th / 2);
  const c = [(ax + bx) / 2 - dy * h, -((ay + by) / 2 + dx * h)];
  return { c, r: Math.abs(L / (2 * Math.sin(th / 2))), a0: ptAngle(c, a), sweep: th / D2R };
}
function circ3(p1, p2, p3) {
  const ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)); if (Math.abs(d) < 1e-9) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const c = [ux, uy]; return { c, r: ptDist(c, p1) };
}
// sweep (degrees, signed) from a to b passing through m
function sweep3(c, a, m, b) {
  const s = n360(ptAngle(c, b) - ptAngle(c, a)), t = n360(ptAngle(c, m) - ptAngle(c, a));
  return t <= s ? s : s - 360;
}
function bulgeFrom3(a, m, b) { const k = circ3(a, m, b); if (!k) return 0; return Math.tan(sweep3(k.c, a, m, b) * D2R / 4); }
function arc3(a, m, b) {
  const k = circ3(a, m, b); if (!k) return null;
  const sw = sweep3(k.c, a, m, b); const s = ptAngle(k.c, a), e = ptAngle(k.c, b);
  return sw >= 0 ? { t: 'arc', c: rp(k.c), r: r2(k.r), a0: r2(s), a1: r2(e) } : { t: 'arc', c: rp(k.c), r: r2(k.r), a0: r2(e), a1: r2(s) };
}
const arcSweep = s => n360(s.a1 - s.a0) || 360;
const arcStart = s => polarPt(s.c, s.r, s.a0), arcEnd = s => polarPt(s.c, s.r, s.a1), arcMid = s => polarPt(s.c, s.r, s.a0 + arcSweep(s) / 2);
function tessArc(c, r, a0, sweep, step = 6) {
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / step)); const out = [];
  for (let i = 0; i <= n; i++) out.push(polarPt(c, r, a0 + sweep * i / n));
  return out;
}
// bulge of an arc leaving a in direction dir (degrees) and ending at b (tangent continuation)
function tangentBulge(dir, a, b) { const sw = 2 * n180(ptAngle(a, b) - dir); return Math.tan(sw * D2R / 4); }
function plSegs(s) { const n = s.pts.length; const segs = []; for (let i = 0; i < (s.closed ? n : n - 1); i++) segs.push([s.pts[i], s.pts[(i + 1) % n], (s.b || [])[i] || 0, i]); return segs; }
// direction (degrees) at the end of a polyline's last segment
function plEndDir(pts, b) {
  const n = pts.length; if (n < 2) return 0;
  const a = pts[n - 2], e = pts[n - 1], bu = b[n - 2] || 0; const ch = ptAngle(a, e);
  return bu ? ch + 2 * Math.atan(bu) / D2R : ch;
}

// ---------- splines (Catmull-Rom through the points, drawn as cubic Bezier pieces) ----------
function splineBez(s) {
  const p = s.pts, n = p.length; if (n < 2) return [];
  const at = i => s.closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))];
  const out = [];
  for (let i = 0; i < (s.closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
  }
  return out;
}
const bez = (q, t) => { const u = 1 - t; return [u * u * u * q[0][0] + 3 * u * u * t * q[1][0] + 3 * u * t * t * q[2][0] + t * t * t * q[3][0], u * u * u * q[0][1] + 3 * u * u * t * q[1][1] + 3 * u * t * t * q[2][1] + t * t * t * q[3][1]]; };

// ---------- outline points (selection, snaps, rooms) ----------
const isEArc = s => s.t === 'ellipse' && s.a0 != null;
function ellipsePt(s, t) { const x = s.rx * Math.cos(t), y = s.ry * Math.sin(t), r = (s.rot || 0) * D2R; return [s.c[0] + x * Math.cos(r) - y * Math.sin(r), s.c[1] - (x * Math.sin(r) + y * Math.cos(r))]; }
const textLines = s => String(s.text || '').split('\n');
function textBox(s) {
  const L = textLines(s); const w = Math.max(1, ...L.map(x => x.length)) * s.h * 0.6, h = s.h; const r = (s.rot || 0);
  const x0 = s.align === 'center' ? -w / 2 : s.align === 'right' ? -w : 0, y0 = -(L.length - 1) * h * 1.25;
  return [[x0, y0], [x0 + w, y0], [x0 + w, h], [x0, h]].map(([x, y]) => polarPt(s.p, Math.hypot(x, y), r + Math.atan2(y, x) / D2R));
}
// { pts, closed }: the outline as a list of points
function shapeOutline(s) {
  if (s.t === 'line') return { pts: [s.a, s.b], closed: false };
  if (s.t === 'pline') {
    const pts = [s.pts[0]];
    for (const [a, b, bu] of plSegs(s)) { const k = bu && bulgeArc(a, b, bu); if (k) pts.push(...tessArc(k.c, k.r, k.a0, k.sweep).slice(1)); else pts.push(b); }
    if (s.closed) pts.pop();
    return { pts, closed: !!s.closed };
  }
  if (s.t === 'arc') return { pts: tessArc(s.c, s.r, s.a0, arcSweep(s)), closed: false };
  if (s.t === 'circle') return { pts: tessArc(s.c, s.r, 0, 360, 7.5).slice(0, -1), closed: true };
  if (isEArc(s)) { let t0 = s.a0, t1 = s.a1; if (t1 <= t0) t1 += 360; const n = Math.max(4, Math.ceil((t1 - t0) / 5)); return { pts: Array.from({ length: n + 1 }, (_, i) => ellipsePt(s, (t0 + (t1 - t0) * i / n) * D2R)), closed: false }; }
  if (s.t === 'ellipse') return { pts: Array.from({ length: 64 }, (_, i) => ellipsePt(s, i * Math.PI / 32)), closed: true };
  if (s.t === 'spline') { const pts = [s.pts[0]]; for (const q of splineBez(s)) for (let i = 1; i <= 12; i++) pts.push(bez(q, i / 12)); if (s.closed) pts.pop(); return { pts, closed: !!s.closed }; }
  if (s.t === 'text') return { pts: textBox(s), closed: true };
  if (s.t === 'wall') return { pts: wallPoly(s), closed: true };
  if (s.t === 'opening') { const w = wallOfOpening(s); return { pts: w ? openingPoly(s, w) : [s.c], closed: true }; }
  if (typeof shapeOutlineMore === 'function') { const r = shapeOutlineMore(s); if (r) return r; }
  return { pts: [], closed: false };
}
const shapeClosed = s => s.t === 'circle' || (s.t === 'ellipse' && !isEArc(s)) || ((s.t === 'pline' || s.t === 'spline') && !!s.closed);
const shapeBox = s => bboxPts(shapeOutline(s).pts);
function outlineSegs(o) { const out = []; for (let i = 0; i < o.pts.length - (o.closed ? 0 : 1); i++) out.push([o.pts[i], o.pts[(i + 1) % o.pts.length]]); return out; }
function shapeLength(s) {
  if (s.t === 'circle') return 2 * Math.PI * s.r;
  if (s.t === 'arc') return s.r * arcSweep(s) * D2R;
  if (s.t === 'text') return 0;
  return outlineSegs(shapeOutline(s)).reduce((t, [a, b]) => t + ptDist(a, b), 0);
}
const shapeArea = s => s.t === 'circle' ? Math.PI * s.r * s.r : s.t === 'ellipse' ? Math.PI * s.rx * s.ry : polyArea(shapeOutline(s).pts);
// does an open or closed run of points touch a rectangle? (crossing selection)
function ptsTouchRect(pts, closed, r) {
  const inR = p => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
  if (pts.some(inR)) return true;
  const sides = [[[r[0], r[1]], [r[2], r[1]]], [[r[2], r[1]], [r[2], r[3]]], [[r[2], r[3]], [r[0], r[3]]], [[r[0], r[3]], [r[0], r[1]]]];
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; for (const sd of sides) if (segCross(a, b, sd[0], sd[1])) return true; }
  return false;
}
function shapeInRect(s, r, crossing) {
  const o = shapeOutline(s); if (!o.pts.length) return false;
  if (crossing) return ptsTouchRect(o.pts, o.closed, r);
  return o.pts.every(p => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3]);
}

// ---------- snap points ----------
function shapeSnapGeom(s, pts, segs) {
  const add = (p, k) => pts.push({ p, k });
  if (s.t === 'line') { add(s.a, 'end'); add(s.b, 'end'); add(midPt(s.a, s.b), 'mid'); }
  else if (s.t === 'pline') {
    s.pts.forEach(p => add(p, 'end'));
    for (const [a, b, bu] of plSegs(s)) { const k = bu && bulgeArc(a, b, bu); if (k) { add(polarPt(k.c, k.r, k.a0 + k.sweep / 2), 'mid'); add(k.c, 'cen'); } else add(midPt(a, b), 'mid'); }
  } else if (s.t === 'arc') {
    add(arcStart(s), 'end'); add(arcEnd(s), 'end'); add(arcMid(s), 'mid'); add(s.c, 'cen');
    for (const q of [0, 90, 180, 270]) if (n360(q - s.a0) <= arcSweep(s)) add(polarPt(s.c, s.r, q), 'qua');
  } else if (s.t === 'circle') { add(s.c, 'cen'); for (const q of [0, 90, 180, 270]) add(polarPt(s.c, s.r, q), 'qua'); }
  else if (isEArc(s)) { add(s.c, 'cen'); const o = shapeOutline(s); add(o.pts[0], 'end'); add(o.pts[o.pts.length - 1], 'end'); }
  else if (s.t === 'ellipse') { add(s.c, 'cen'); for (let i = 0; i < 4; i++) add(ellipsePt(s, i * Math.PI / 2), 'qua'); }
  else if (s.t === 'spline') s.pts.forEach(p => add(p, 'end'));
  else if (s.t === 'text') { add(s.p, 'end'); return; }
  else if (s.t === 'wall') { add(s.a, 'end'); add(s.b, 'end'); add(midPt(s.a, s.b), 'mid'); wallPoly(s).forEach(p => add(p, 'end')); }
  else if (s.t === 'opening') { const w = wallOfOpening(s); if (!w) return; const g = openingGeom(s, w); add(g.P(g.s0, g.mid), 'end'); add(g.P(g.s1, g.mid), 'end'); add(g.P(g.at, g.mid), 'mid'); return; }
  else if (typeof shapeSnapMore === 'function' && shapeSnapMore(s, add, segs)) return;
  segs.push(...outlineSegs(shapeOutline(s)));
}

// ---------- transforms (move, rotate, scale, mirror) ----------
// T = { map(p), rot: degrees added, k: scale factor, mir: mirror axis angle or null }
const tMove = d => ({ map: p => [p[0] + d[0], p[1] + d[1]], rot: 0, k: 1, mir: null });
const tRotate = (c, ang) => ({ map: p => polarPt(c, ptDist(c, p), ptAngle(c, p) + ang), rot: ang, k: 1, mir: null });
const tScale = (c, k) => ({ map: p => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k], rot: 0, k, mir: null });
function tMirror(c, phi) {
  const cs = Math.cos(2 * phi * D2R), sn = Math.sin(2 * phi * D2R);
  return { map: p => { const vx = p[0] - c[0], vy = c[1] - p[1]; return [c[0] + cs * vx + sn * vy, c[1] - (sn * vx - cs * vy)]; }, rot: 0, k: 1, mir: phi };
}
function transformShape(s, T) {
  const m = p => rp(T.map(p));
  if (s.t === 'line') { s.a = m(s.a); s.b = m(s.b); }
  else if (s.t === 'pline') {
    s.pts = s.pts.map(m);
    if (T.mir != null && s.b) s.b = s.b.map(x => -x || 0);
    if (s.wd && T.k !== 1) s.wd = s.wd.map(w => w && [r2(w[0] * T.k), r2(w[1] * T.k)]);
  } else if (s.t === 'arc') {
    s.c = m(s.c); s.r = r2(s.r * T.k);
    if (T.mir != null) { const a0 = n360(2 * T.mir - s.a1), a1 = n360(2 * T.mir - s.a0); s.a0 = r2(a0); s.a1 = r2(a1); }
    else { s.a0 = r2(n360(s.a0 + T.rot)); s.a1 = r2(n360(s.a1 + T.rot)); }
  } else if (s.t === 'circle') { s.c = m(s.c); s.r = r2(s.r * T.k); }
  else if (s.t === 'ellipse') { s.c = m(s.c); s.rx = r2(s.rx * T.k); s.ry = r2(s.ry * T.k); s.rot = r2(n360(T.mir != null ? 2 * T.mir - (s.rot || 0) : (s.rot || 0) + T.rot)); if (T.mir != null && isEArc(s)) { const a0 = n360(-s.a1), a1 = n360(-s.a0); s.a0 = r2(a0); s.a1 = r2(a1); } }
  else if (s.t === 'spline') s.pts = s.pts.map(m);
  else if (s.t === 'text') { s.p = m(s.p); s.h = r2(s.h * T.k * 1000) / 1000; if (T.mir == null) s.rot = r2(n360((s.rot || 0) + T.rot)); }
  else if (s.t === 'wall') { s.a = m(s.a); s.b = m(s.b); s.th = r2(s.th * T.k * 1000) / 1000; if (T.mir != null) s.just = { l: 'r', r: 'l' }[s.just] || s.just; }
  else if (s.t === 'opening') { s.c = m(s.c); s.w = r2(s.w * T.k * 1000) / 1000; if (T.mir != null) s.side = -(s.side || 1); }
  else if (typeof transformMore === 'function') transformMore(s, T, m);
  return s;
}
function transformPlace(pl, T) {
  const q = rp(T.map([pl.x, pl.y])); pl.x = q[0]; pl.y = q[1];
  if (T.mir != null) pl.rot = r2(n360(-(2 * T.mir + (pl.rot || 0)))); else if (T.rot) pl.rot = r2(n360((pl.rot || 0) - T.rot));
}
function transformRoom(r, T) {
  if (isRound(r)) {
    const b = bboxPts(r.pts); const c = rp(T.map([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])); let hw = (b[2] - b[0]) / 2 * T.k, hh = (b[3] - b[1]) / 2 * T.k;
    const turn = T.mir != null ? n360(2 * T.mir) : n360(T.rot); if (Math.abs(n180(turn - 90)) < 45 || Math.abs(n180(turn - 270)) < 45) [hw, hh] = [hh, hw];
    r.pts = rectPts([c[0] - hw, c[1] - hh, c[0] + hw, c[1] + hh]).map(rp); return;
  }
  r.pts = r.pts.map(p => rp(T.map(p))); if (T.mir != null) r.pts.reverse();
}

// ---------- drawing on the page ----------
const shapeColor = s => s.color || (sheetDark() ? '#d0d4da' : '#1d1d1d');
function shapeD(s) {
  const P2 = p => `${r2(p[0])},${r2(p[1])}`;
  if (s.t === 'line') return `M${P2(s.a)}L${P2(s.b)}`;
  if (s.t === 'pline') {
    let d = 'M' + P2(s.pts[0]);
    for (const [a, b, bu] of plSegs(s)) {
      const k = bu && bulgeArc(a, b, bu);
      d += k ? `A${r2(k.r)},${r2(k.r)} 0 ${Math.abs(k.sweep) > 180 ? 1 : 0} ${k.sweep > 0 ? 0 : 1} ${P2(b)}` : 'L' + P2(b);
    }
    return d + (s.closed ? 'Z' : '');
  }
  if (s.t === 'arc') { const sw = arcSweep(s); if (sw >= 359.99) return shapeD({ t: 'circle', c: s.c, r: s.r }); return `M${P2(arcStart(s))}A${r2(s.r)},${r2(s.r)} 0 ${sw > 180 ? 1 : 0} 0 ${P2(arcEnd(s))}`; }
  if (s.t === 'circle') { const a = [s.c[0] + s.r, s.c[1]], b = [s.c[0] - s.r, s.c[1]]; return `M${P2(a)}A${r2(s.r)},${r2(s.r)} 0 1 0 ${P2(b)}A${r2(s.r)},${r2(s.r)} 0 1 0 ${P2(a)}Z`; }
  if (isEArc(s)) return 'M' + shapeOutline(s).pts.map(P2).join('L');
  if (s.t === 'ellipse') { const a = ellipsePt(s, 0), b = ellipsePt(s, Math.PI); const rot = -(s.rot || 0); return `M${P2(a)}A${r2(s.rx)},${r2(s.ry)} ${r2(rot)} 1 0 ${P2(b)}A${r2(s.rx)},${r2(s.ry)} ${r2(rot)} 1 0 ${P2(a)}Z`; }
  if (s.t === 'spline') { const bz = splineBez(s); if (!bz.length) return ''; return 'M' + P2(bz[0][0]) + bz.map(q => `C${P2(q[1])} ${P2(q[2])} ${P2(q[3])}`).join('') + (s.closed ? 'Z' : ''); }
  if (s.t === 'wall') return 'M' + wallPoly(s).map(P2).join('L') + 'Z';
  return '';
}
// polyline segments with a width are drawn as filled bands
function plWideSVG(s, col) {
  let out = '';
  for (const [a, b, bu, i] of plSegs(s)) {
    const w = (s.wd || [])[i]; if (!w || (!w[0] && !w[1])) { out += `<path d="M${r2(a[0])},${r2(a[1])}${(() => { const k = bu && bulgeArc(a, b, bu); return k ? `A${r2(k.r)},${r2(k.r)} 0 ${Math.abs(k.sweep) > 180 ? 1 : 0} ${k.sweep > 0 ? 0 : 1} ${r2(b[0])},${r2(b[1])}` : `L${r2(b[0])},${r2(b[1])}`; })()}" fill="none" stroke="${col}"/>`; continue; }
    const k = bu && bulgeArc(a, b, bu); const run = k ? tessArc(k.c, k.r, k.a0, k.sweep, 3) : [a, b];
    const L = [], R = [];
    run.forEach((p, j) => {
      const q = run[Math.min(j + 1, run.length - 1)], o = run[Math.max(j - 1, 0)]; const dir = ptAngle(o, q);
      const hw = (w[0] + (w[1] - w[0]) * j / (run.length - 1)) / 2;
      L.push(polarPt(p, hw, dir + 90)); R.push(polarPt(p, hw, dir - 90));
    });
    out += `<polygon points="${L.concat(R.reverse()).map(p => r2(p[0]) + ',' + r2(p[1])).join(' ')}" fill="${col}" stroke="none"/>`;
    if (i > 0 || s.closed) out += `<circle cx="${r2(a[0])}" cy="${r2(a[1])}" r="${r2(w[0] / 2)}" fill="${col}" stroke="none"/>`;
  }
  return out;
}
const plHasWidth = s => s.t === 'pline' && (s.wd || []).some(w => w && (w[0] || w[1]));
// t: view scale of the page (line widths and dashes stay the same size on paper)
function shapeSVG(s, t, o = {}) {
  const col = o.sel ? 'var(--sel)' : o.ghost ? '#1f6fff' : shapeColor(s);
  const sw = r2(((s.lw ? +s.lw : 0.35) / t) * 1000) / 1000; const da = DASH[s.dash || 'solid'];
  const dash = da ? ` stroke-dasharray="${da.split(',').map(x => r2(x * 2 / t)).join(',')}"` : '';
  const st = `stroke="${col}" stroke-width="${sw}"${dash} stroke-linecap="round" stroke-linejoin="round"`;
  let body = '', hit = '';
  if (s.t === 'opghost') return `<g class="shpghost" opacity="0.8"><polygon points="${polyAttr(openingPoly(s.o, s.w))}" fill="#fff" stroke="none"/>${openingSVG(s.o, s.w, t, '#1f6fff', true)}</g>`;
  if (typeof shapeSVGMore === 'function') { const r = shapeSVGMore(s, t, o, col, sw, st); if (r != null) return r; }
  if (s.t === 'text') {
    const ang = -(s.rot || 0);
    const L = textLines(s), anc = s.align === 'center' ? 'middle' : s.align === 'right' ? 'end' : 'start';
    body = `<text x="${r2(s.p[0])}" y="${r2(s.p[1] - (L.length - 1) * s.h * 1.25)}" font-size="${s.h}" fill="${col}" text-anchor="${anc}" transform="rotate(${r2(ang)} ${r2(s.p[0])} ${r2(s.p[1])})" font-family="Arial, sans-serif">${L.length === 1 ? esc(L[0]) : L.map((x, i) => `<tspan x="${r2(s.p[0])}" dy="${i ? r2(s.h * 1.25 * 1000) / 1000 : 0}">${esc(x)}</tspan>`).join('')}</text>`;
    hit = `<polygon class="hit" points="${textBox(s).map(p => r2(p[0]) + ',' + r2(p[1])).join(' ')}"/>`;
  } else {
    const d = shapeD(s); const fill = s.fill && shapeClosed(s) ? s.fill : 'none';
    body = plHasWidth(s) ? `<g ${st}>${plWideSVG(s, col)}</g>` : `<path d="${d}" fill="${fill}" ${st}/>`;
    hit = `<path class="${fill === 'none' ? 'wirehit' : 'hit'}" d="${d}" style="stroke-width:${r2(3 / t)}"/>`;
  }
  if (o.ghost) return `<g class="shpghost" opacity="0.75">${body}</g>`;
  return `<g ${o.locked ? '' : `data-id="${s.id}" `}class="shp${o.sel ? ' ssel' : ''}">${o.locked ? '' : hit}${body}</g>`;
}
function fpShapesSVG(lv, t, o) {
  let s = '';
  const list = lvShapes(lv).filter(sh => sh.t !== 'wall' && sh.t !== 'opening' && objShown(sh, o));
  for (const sh of list.filter(x => x.t === 'hatch').concat(list.filter(x => x.t !== 'hatch'))) s += shapeSVG(sh, t, { sel: !o.print && !o.vp && sel.has(sh.id), locked: o.vp || (!o.print && objLocked(sh)), lv });
  return s;
}

// ---------- properties panel ----------
function shapePropsHTML(pg, lv, list) {
  if (list.every(isWall)) return wallPropsHTML(pg, lv, list);
  if (list.length === 1 && list[0].t === 'opening') return openingPropsHTML(pg, lv, list[0]);
  if (typeof shapePropsMore === 'function') { const r = shapePropsMore(pg, lv, list); if (r) return r; }
  const one = list.length === 1 ? list[0] : null, f = list[0];
  const L = v => formatLength(toRealMm(lv, v)), A = v => formatArea(v * lvScale(lv) * lvScale(lv)), ts = fpXform(pg).s;
  const opt = (pairs, cur) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const allClosed = list.every(shapeClosed), noText = list.every(s => s.t !== 'text');
  let sub = '', geo = '';
  if (one) {
    const s = one;
    if (s.t === 'line') { sub = `${L(ptDist(s.a, s.b))} at ${r2(ptAngle(s.a, s.b))}°`; geo = row('shp.len', 'Length', L(ptDist(s.a, s.b))); }
    else if (s.t === 'circle') { sub = `Radius ${L(s.r)}, area ${A(shapeArea(s))}`; geo = row('shp.r', 'Radius', L(s.r)) + row('shp.d', 'Diameter', L(2 * s.r)); }
    else if (s.t === 'arc') { sub = `Radius ${L(s.r)}, ${r2(arcSweep(s))}°, length ${L(shapeLength(s))}`; geo = row('shp.r', 'Radius', L(s.r)); }
    else if (s.t === 'ellipse') { sub = `${L(2 * s.rx)} x ${L(2 * s.ry)}, area ${A(shapeArea(s))}`; geo = row('shp.rx', 'First half axis', L(s.rx)) + row('shp.ry', 'Second half axis', L(s.ry)); }
    else if (s.t === 'pline' || s.t === 'spline') {
      sub = `${s.pts.length} points, length ${L(shapeLength(s))}${s.closed ? ', area ' + A(shapeArea(s)) : ''}`;
      geo = `<div class="prow"><label>Closed</label><input type="checkbox" data-k="shp.closed" ${s.closed ? 'checked' : ''} style="width:auto"></div>`;
      if (s.t === 'pline') { const w = (s.wd || []).find(x => x && (x[0] || x[1])); geo += row('shp.width', 'Width', w ? L(w[0]) : L(0)); }
    } else if (s.t === 'text') { geo = row('shp.text', 'Text', s.text, 'textarea') + row('shp.align', 'Alignment', '', 'select', opt([['left', 'Left'], ['center', 'Center'], ['right', 'Right']], s.align || 'left')) + row('shp.h', 'Height on paper (mm)', r2(s.h * ts * 100) / 100, 'number', 'step="0.5" min="0.5"') + row('shp.rot', 'Rotation (degrees)', r2(s.rot || 0), 'number'); }
  }
  let st = `<div class="prow"><label>Color</label><input type="color" data-k="shp.color" value="${esc(f.color || (sheetDark() ? '#d0d4da' : '#1d1d1d'))}"></div>`;
  if (noText) {
    st += row('shp.lw', 'Line width (mm)', '', 'select', opt(SHAPE_LW.map(w => [w, w]), f.lw || '0.35'));
    st += row('shp.dash', 'Line type', '', 'select', opt([['solid', 'Solid'], ['dash', 'Dashed'], ['hidden', 'Hidden'], ['center', 'Center'], ['dot', 'Dotted'], ['dashdot', 'Dash dot']], f.dash || 'solid'));
  }
  if (allClosed && noText) st += `<div class="prow"><label>Filled</label><input type="checkbox" data-k="shp.filled" ${f.fill ? 'checked' : ''} style="width:auto"></div>${f.fill ? `<div class="prow"><label>Fill color</label><input type="color" data-k="shp.fill" value="${esc(f.fill)}"></div>` : ''}`;
  if (userLayers().length) st += row('shp.layer', 'Layer', '', 'select', layerOptions(f.layer));
  const roomOK = list.some(s => shapeRoomPts(s));
  return `<div class="ident">${one ? SHAPE_NAMES[one.t] : list.length + ' shapes'}</div><div class="sub">${esc(sub)}</div>
    ${geo ? `<div class="pgrp"><h4>Geometry</h4>${geo}</div>` : ''}<div class="pgrp"><h4>Style</h4>${st}</div>
    <div class="note">Drag a grip (square) to reshape. Click a grip, then press Space to switch between stretch, move, rotate, scale and mirror.</div>
    <div class="btnrow">${roomOK ? '<button class="btn" data-act="shapeToRoom">Make room</button>' : ''}<button class="btn" data-act="rotateSel">Rotate 90°</button><button class="btn" data-act="delSel">Delete</button></div>`;
}
function applyShapeProp(pg, lv, s, key, v) {
  if (applyWallProp(pg, lv, s, key, v)) return;
  if (typeof applyPropMore === 'function' && applyPropMore(pg, lv, s, key, v)) return;
  const len = () => { const mm = parseLength(v); return mm == null || mm <= 0 ? null : toPlanMm(lv, mm); };
  if (key === 'color') s.color = v;
  else if (key === 'lw') { if (v === '0.35') delete s.lw; else s.lw = v; }
  else if (key === 'dash') { if (v === 'solid') delete s.dash; else s.dash = v; }
  else if (key === 'filled') { if (!shapeClosed(s)) return; if (v) s.fill = s.fill || '#d9dde3'; else delete s.fill; }
  else if (key === 'fill') { if (shapeClosed(s)) s.fill = v; }
  else if (key === 'layer') { if (v === '__') return; if (v) s.layer = v; else delete s.layer; }
  else if (key === 'len' && s.t === 'line') { const d = len(); if (d) s.b = rp(polarPt(s.a, d, ptAngle(s.a, s.b))); }
  else if (key === 'r' && (s.t === 'circle' || s.t === 'arc')) { const d = len(); if (d) s.r = r2(d); }
  else if (key === 'd' && s.t === 'circle') { const d = len(); if (d) s.r = r2(d / 2); }
  else if ((key === 'rx' || key === 'ry') && s.t === 'ellipse') { const d = len(); if (d) s[key] = r2(d); }
  else if (key === 'closed' && (s.t === 'pline' || s.t === 'spline')) { if (s.pts.length >= 3 || !v) s.closed = !!v; }
  else if (key === 'width' && s.t === 'pline') { const mm = parseLength(v); if (mm == null) return; const w = r2(toPlanMm(lv, Math.abs(mm))); if (w) s.wd = plSegs(s).map(() => [w, w]); else delete s.wd; }
  else if (key === 'text' && s.t === 'text') { if (v) s.text = v; }
  else if (key === 'h' && s.t === 'text') { const h = parseFloat(v); if (h > 0) s.h = r2(h / fpXform(pg).s * 1000) / 1000; }
  else if (key === 'rot' && s.t === 'text') s.rot = n360(parseFloat(v) || 0);
  else if (key === 'align' && s.t === 'text') { if (v === 'left') delete s.align; else s.align = v; }
}
