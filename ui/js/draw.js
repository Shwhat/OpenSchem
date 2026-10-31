// ---------- floor plan draw tools ----------
// Each tool takes clicked or typed points (with object snaps, ortho/polar and typed lengths) and builds shapes.
// Options are typed as words or letters while the tool runs (A arc, W width, C close, U undo...). Enter or right
// click finishes, Esc finishes or leaves the tool.
let DRAW = null;
const DRAW_TOOLS = {};
const drawTool = (id, def) => { DRAW_TOOLS[id] = def; };
function newDraw(id, sub) { const T = DRAW_TOOLS[id]; const D = { id, T, pts: [], stage: 0, want: 'point', cur: null, sub }; if (T.init) T.init(D); return D; }
function drawReset(m) {
  if (!m || !m.startsWith('d:')) { DRAW = null; return; }
  const [id, sub] = m.slice(2).split(':'); DRAW = DRAW_TOOLS[id] ? newDraw(id, sub) : null;
}
function drawRestart(D) { const keep = { sub: D.sub, keep: D.keep }; Object.assign(D, newDraw(D.id, keep.sub)); D.keep = keep.keep; if (D.T.init) D.T.init(D); $('#overlay').innerHTML = ''; cmdSync(); }
const drawLast = D => D.T.last ? D.T.last(D) : D.pts[D.pts.length - 1] || null;
const drawCtx = () => { const pg = page(); return { pg, lv: levelOf(pg) }; };
function commitShape(c, s) {
  let made = null;
  commit(() => { made = onActiveLayer(Object.assign({ id: uid() }, s)); lvShapes(c.lv).push(made); });
  $('#overlay').innerHTML = ''; return made;
}
const fmtLen = (lv, v) => formatLength(toRealMm(lv, v));

// ---------- pointer and typed input ----------
// free: the next point sizes a shape (rectangle corner, radius), so Ortho and Polar do not lock its direction
const drawFree = D => !!(D.T.free && D.T.free(D));
function drawSnap(pg, lv, raw) { const D = DRAW; return fpPoint(pg, lv, raw, { last: drawLast(D), extra: D.pts, free: drawFree(D) }); }
function drawDown(pg, lv, raw) { if (!DRAW) return; const r = drawSnap(pg, lv, raw); DRAW.T.point(DRAW, rp(r.p), { pg, lv, raw }); drawRefresh(r); }
// press, drag and release: the release is the next point (click-click still works)
function drawPress(pg, lv, raw, cx, cy) { const D = DRAW; if (!D) return; const n = D.pts.length, st = D.stage; drawDown(pg, lv, raw); if (DRAW === D && (D.pts.length > n || D.stage !== st)) D.press = { cx, cy }; }
function drawUp(pg, lv, raw, cx, cy) {
  const D = DRAW; if (!D || !D.press) return false; const pr = D.press; D.press = null;
  if (Math.hypot(cx - pr.cx, cy - pr.cy) < 6) return true;
  drawDown(pg, lv, raw); return true;
}
function drawMove(pg, lv, raw) { if (!DRAW) return; const r = drawSnap(pg, lv, raw); DRAW.cur = r.p; fAim = r.p; drawPreview(pg, lv, r); }
function drawRefresh(r) { const { pg, lv } = drawCtx(); cmdSync(); renderStatus(); if (DRAW && DRAW.cur) drawPreview(pg, lv, r || { p: DRAW.cur }); }
function drawPreview(pg, lv, r) {
  const D = DRAW; if (!D) return; const t = fpXform(pg); const q = r.p;
  const gh = (D.T.ghost && D.T.ghost(D, q, { pg, lv })) || [];
  const last = drawLast(D);
  $('#overlay').innerHTML = `<g transform="translate(${t.tx},${t.ty}) scale(${t.s})">${gh.map(s => shapeSVG(s, t.s, { ghost: true })).join('')}</g>` + fpMark(pg, r) + (last && D.want === 'point' ? trackOverlay(pg, last, q, r.tracked) : '');
  dynUpdate(q);
}
// Enter or right click: returns true when the tool had something to finish
function drawEnter() { const D = DRAW; if (!D) return false; const had = D.pts.length > 0 || D.stage !== 0; if (D.T.enter) D.T.enter(D, drawCtx()); else drawRestart(D); drawRefresh(); return had; }
function drawEscape() { const D = DRAW; if (!D) return false; if (!(D.pts.length || D.stage !== 0)) return false; if (D.T.enter && D.T.keepOnEsc) D.T.enter(D, drawCtx()); else drawRestart(D); drawRefresh(); return true; }
const isOptionWord = t => /^[a-z]/i.test(t) || (/^[0-9][a-z]+$/i.test(t) && parseLength(t) == null);
function drawTyped(text) {
  const D = DRAW; if (!D) return false; const c = drawCtx(); const t = String(text || '').trim();
  if (!t) { drawEnter(); return true; }
  if (isOptionWord(t) && parseLength(t) == null) { if (D.T.opt && D.T.opt(D, t.toUpperCase(), c)) { drawRefresh(); return true; } return false; }
  if ((D.want === 'number' || D.want === 'angle') && /^-?\d*\.?\d+$/.test(t)) { D.T.num(D, parseFloat(t), c); drawRefresh(); return true; }
  if (D.want === 'dist' && !/[,<#@]/.test(t)) {
    const mm = parseLength(t); if (mm == null) { flash(`Could not read "${t}" as a length`); return true; }
    D.T.dist(D, toPlanMm(c.lv, Math.abs(mm)), c); drawRefresh(); return true;
  }
  const q = fpTypedPoint(c.pg, c.lv, { kind: (D.T.pointKind && D.T.pointKind(D)) || 'draw', last: drawLast(D) }, t);
  if (!q) { flash(`Could not read "${t}". Try 12'6", @12',8' or 10'<45`); return true; }
  if (D.want === 'dist' && D.T.distPoint) D.T.distPoint(D, rp(q), c); else D.T.point(D, rp(q), c);
  drawRefresh(); return true;
}
const drawPrompt = () => DRAW && DRAW.T.prompt ? DRAW.T.prompt(DRAW, drawCtx()) : 'Specify point:';

// ---------- line ----------
drawTool('line', {
  name: 'Line', keepOnEsc: true,
  prompt: D => D.pts.length ? 'Specify next point [Close/Undo] (Enter to finish):' : 'Specify first point:',
  point(D, q, c) { const l = drawLast(D); if (l && ptDist(l, q) < 0.01) return; if (l) commitShape(c, { t: 'line', a: l, b: q }); D.pts.push(q); },
  ghost: (D, q) => D.pts.length ? [{ t: 'line', a: drawLast(D), b: q }] : [],
  opt(D, w, c) {
    if (w === 'C' || w === 'CLOSE') { if (D.pts.length >= 3) { commitShape(c, { t: 'line', a: drawLast(D), b: D.pts[0] }); drawRestart(D); } else flash('Close needs at least two lines'); return true; }
    if (w === 'U' || w === 'UNDO') { if (D.pts.length > 1) { undo(); D.pts.pop(); } else if (D.pts.length) D.pts.pop(); return true; }
    return false;
  },
  enter(D) { drawRestart(D); },
});

// ---------- polyline (lines and arcs, with widths) ----------
drawTool('pline', {
  name: 'Polyline', keepOnEsc: true,
  init(D) { D.b = []; D.wd = []; D.arc = false; D.w = D.keep || [0, 0]; },
  prompt(D, c) {
    if (D.stage === 'w0') return `Starting width <${fmtLen(c.lv, D.w[0])}>:`;
    if (D.stage === 'w1') return `Ending width <${fmtLen(c.lv, D.nw0)}>:`;
    return D.pts.length ? `Specify next point [${D.arc ? 'Line' : 'Arc'}/Width/Close/Undo] (Enter to finish):` : 'Specify start point:';
  },
  segBulge(D, q) { if (!D.arc || !D.pts.length) return 0; const dir = D.pts.length >= 2 ? plEndDir(D.pts, D.b) : (D.lastDir ?? 0); return r2(tangentBulge(dir, drawLast(D), q) * 1e4) / 1e4; },
  point(D, q) {
    if (D.stage === 'w0' || D.stage === 'w1') return;
    const l = drawLast(D); if (l && ptDist(l, q) < 0.01) return;
    if (l) { D.b.push(this.segBulge(D, q)); D.wd.push([D.w[0], D.w[1]]); D.w = [D.w[1], D.w[1]]; }
    D.pts.push(q);
  },
  shape(D, closed) {
    const s = { t: 'pline', pts: D.pts.slice(), b: D.b.slice(), closed: !!closed };
    if (D.wd.some(w => w[0] || w[1])) s.wd = D.wd.slice();
    if (!s.b.some(x => x)) delete s.b;
    return s;
  },
  ghost(D, q) {
    if (!D.pts.length || D.stage) return [];
    const g = this.shape(Object.assign({}, D, { pts: D.pts.concat([q]), b: D.b.concat([this.segBulge(D, q)]), wd: D.wd.concat([[D.w[0], D.w[1]]]) }));
    return [g];
  },
  opt(D, w, c) {
    if (D.stage) return false;
    if (w === 'A' || w === 'ARC') { D.arc = true; return true; }
    if (w === 'L' || w === 'LINE') { D.arc = false; return true; }
    if (w === 'W' || w === 'WIDTH') { D.stage = 'w0'; D.want = 'dist'; return true; }
    if (w === 'U' || w === 'UNDO') { if (D.pts.length > 1) { D.pts.pop(); D.b.pop(); D.wd.pop(); } else D.pts = []; return true; }
    if (w === 'C' || w === 'CLOSE') {
      if (D.pts.length < 3 && !(D.arc && D.pts.length >= 2)) { flash('Close needs at least three points'); return true; }
      D.b.push(this.segBulge(D, D.pts[0])); D.wd.push([D.w[0], D.w[1]]);
      commitShape(c, this.shape(D, true)); D.keep = D.w; drawRestart(D); return true;
    }
    return false;
  },
  dist(D, v) {
    if (D.stage === 'w0') { D.nw0 = r2(v); D.stage = 'w1'; return; }
    if (D.stage === 'w1') { D.w = [D.nw0, r2(v)]; D.stage = 0; D.want = 'point'; }
  },
  enter(D, c) {
    if (D.stage === 'w0') { D.nw0 = D.w[0]; D.stage = 'w1'; return; }
    if (D.stage === 'w1') { D.w = [D.nw0, D.nw0]; D.stage = 0; D.want = 'point'; return; }
    if (D.pts.length >= 2) commitShape(c, this.shape(D, false));
    D.keep = D.w; drawRestart(D);
  },
});

// ---------- arc: 3 points, or center, start, end ----------
drawTool('arc', {
  name: 'Arc',
  init(D) { D.sub = D.sub || '3p'; D.want = D.sub === 'cse' && D.pts.length === 2 ? 'angle' : 'point'; },
  prompt(D) {
    if (D.sub === 'cse') return ['Specify center point [3-point]:', 'Specify start point:', 'Specify end point or angle:'][D.pts.length];
    return ['Specify start point [Center]:', 'Specify second point:', 'Specify end point:'][D.pts.length];
  },
  last(D) { return D.pts[D.pts.length - 1] || null; },
  make(D, q) {
    const [a, b] = D.pts;
    if (D.sub === 'cse') return ptDist(a, b) ? { t: 'arc', c: a, r: r2(ptDist(a, b)), a0: r2(ptAngle(a, b)), a1: r2(ptAngle(a, q)) } : null;
    return arc3(a, b, q);
  },
  point(D, q, c) {
    if (D.pts.length < 2) { D.pts.push(q); if (D.sub === 'cse' && D.pts.length === 2) D.want = 'angle'; return; }
    const s = this.make(D, q); if (s) commitShape(c, s); drawRestart(D);
  },
  num(D, ang, c) { if (D.sub !== 'cse' || D.pts.length !== 2) return; const [a, b] = D.pts; this.point(D, polarPt(a, ptDist(a, b), ang), c); },
  ghost(D, q) {
    if (D.pts.length === 1) return [{ t: 'line', a: D.pts[0], b: q, dash: 'dash' }];
    if (D.pts.length === 2) { const s = this.make(D, q); return s ? [s] : []; }
    return [];
  },
  opt(D, w) {
    if (D.pts.length) return false;
    if (w === 'C' || w === 'CE' || w === 'CENTER') { D.sub = 'cse'; return true; }
    if (w === '3P') { D.sub = '3p'; return true; }
    return false;
  },
});

// ---------- circle: center and radius or diameter, 2 points, 3 points ----------
drawTool('circle', {
  name: 'Circle',
  init(D) { D.sub = D.sub || 'cr'; D.want = (D.sub === 'cr' || D.sub === 'cd') && D.pts.length === 1 ? 'dist' : 'point'; },
  prompt(D) {
    if (D.sub === '2p') return D.pts.length ? 'Specify second end point of the diameter:' : 'Specify first end point of the diameter:';
    if (D.sub === '3p') return ['Specify first point on the circle:', 'Specify second point:', 'Specify third point:'][D.pts.length];
    if (!D.pts.length) return 'Specify center point [2P/3P]:';
    return D.sub === 'cd' ? 'Specify diameter [Radius]:' : 'Specify radius [Diameter]:';
  },
  make(D, q) {
    const p = D.pts;
    if (D.sub === '2p') return { t: 'circle', c: rp(midPt(p[0], q)), r: r2(ptDist(p[0], q) / 2) };
    if (D.sub === '3p') { if (p.length < 2) return null; const k = circ3(p[0], p[1], q); return k ? { t: 'circle', c: rp(k.c), r: r2(k.r) } : null; }
    const d = ptDist(p[0], q); return { t: 'circle', c: p[0], r: r2(D.sub === 'cd' ? d / 2 : d) };
  },
  need(D) { return D.sub === '3p' ? 2 : 1; },
  free: D => D.pts.length === 1 && (D.sub === 'cr' || D.sub === 'cd'),
  point(D, q, c) {
    if (D.pts.length < this.need(D)) { D.pts.push(q); this.init(D); return; }
    const s = this.make(D, q); if (s && s.r > 0) commitShape(c, s); drawRestart(D);
  },
  distPoint(D, q, c) { this.point(D, q, c); },
  dist(D, v, c) { const s = { t: 'circle', c: D.pts[0], r: r2(D.sub === 'cd' ? v / 2 : v) }; if (s.r > 0) commitShape(c, s); drawRestart(D); },
  ghost(D, q) { if (!D.pts.length) return []; const s = this.make(D, q); return s ? [s] : (D.pts.length ? [{ t: 'line', a: D.pts[D.pts.length - 1], b: q, dash: 'dash' }] : []); },
  opt(D, w) {
    if (!D.pts.length && (w === '2P' || w === '3P')) { D.sub = w.toLowerCase(); return true; }
    if (D.pts.length === 1 && (D.sub === 'cr' || D.sub === 'cd')) {
      if (w === 'D' || w === 'DIAMETER') { D.sub = 'cd'; return true; }
      if (w === 'R' || w === 'RADIUS') { D.sub = 'cr'; return true; }
    }
    if (!D.pts.length && (w === 'D' || w === 'DIAMETER')) { D.sub = 'cd'; return true; }
    return false;
  },
});

// ---------- ellipse: center, end of one axis, distance to the other axis ----------
drawTool('ellipse', {
  name: 'Ellipse',
  prompt: D => D.stage === 'a0' ? 'Specify start angle of the arc:' : D.stage === 'a1' ? 'Specify end angle of the arc:' : (['Specify center point [Arc]:', 'Specify end point of the first axis:', 'Specify distance to the other axis:'][D.pts.length] + (D.arc ? ' (elliptical arc)' : '')),
  make(D, ry) { const [c, a] = D.pts; const s = { t: 'ellipse', c, rx: r2(ptDist(c, a)), ry: r2(ry), rot: r2(ptAngle(c, a)) }; if (D.e0 != null) { s.a0 = r2(D.e0); s.a1 = r2(D.e1 != null ? D.e1 : D.e0 + 1e-3); } return s; },
  param(D, q) { const s = D.base; const r = -(s.rot || 0) * D2R; const vx = q[0] - s.c[0], vy = s.c[1] - q[1]; const lx = vx * Math.cos(r) - vy * Math.sin(r), ly = vx * Math.sin(r) + vy * Math.cos(r); return n360(Math.atan2(ly / s.ry, lx / s.rx) / D2R); },
  opt(D, w) { if (!D.pts.length && (w === 'A' || w === 'ARC')) { D.arc = true; return true; } return false; },
  free: D => D.pts.length === 2 && !D.stage,
  num(D, n, c) { if (D.stage === 'a0') { D.e0 = n360(n); D.stage = 'a1'; } else if (D.stage === 'a1') { D.e1 = n360(n); commitShape(c, Object.assign(this.make(D, D.base.ry), {})); drawRestart(D); } },
  arcStep(D, q, c) { if (D.stage === 'a0') { D.e0 = this.param(D, q); D.stage = 'a1'; return; } D.e1 = this.param(D, q); commitShape(c, this.make(D, D.base.ry)); drawRestart(D); },
  other(D, q) { const [c, a] = D.pts; const u = ptAngle(c, a) * D2R; const vx = q[0] - c[0], vy = c[1] - q[1]; return Math.abs(-vx * Math.sin(u) + vy * Math.cos(u)); },
  point(D, q, c) {
    if (D.stage === 'a0' || D.stage === 'a1') { this.arcStep(D, q, c); return; }
    if (D.pts.length < 2) { if (D.pts.length === 1 && ptDist(D.pts[0], q) < 0.01) return; D.pts.push(q); D.want = D.pts.length === 2 ? 'dist' : 'point'; return; }
    const ry = this.other(D, q); if (!(ry > 0.01)) return; this.done(D, ry, c);
  },
  done(D, ry, c) { if (D.arc) { D.base = this.make(D, ry); D.stage = 'a0'; D.want = 'angle'; return; } commitShape(c, this.make(D, ry)); drawRestart(D); },
  distPoint(D, q, c) { this.point(D, q, c); },
  dist(D, v, c) { if (v > 0) this.done(D, v, c); },
  ghost(D, q) {
    if (D.stage === 'a0') return [D.base, { t: 'line', a: D.base.c, b: q, dash: 'dash' }];
    if (D.stage === 'a1') return [Object.assign(clone(D.base), { a0: D.e0, a1: this.param(D, q) })];
    if (D.pts.length === 1) return [{ t: 'line', a: D.pts[0], b: q, dash: 'dash' }];
    if (D.pts.length === 2) { const ry = this.other(D, q); return ry > 0.01 ? [this.make(D, ry)] : []; }
    return [];
  },
});

// ---------- polygon: number of sides, center (inscribed or circumscribed) or edge ----------
function polygonPts(c, n, R, ang, ic) {
  const out = []; const vr = ic === 'C' ? R / Math.cos(Math.PI / n) : R; const a0 = ic === 'C' ? ang + 180 / n : ang;
  for (let i = 0; i < n; i++) out.push(rp(polarPt(c, vr, a0 + i * 360 / n)));
  return out;
}
function polygonShape(c, n, R, ang, ic) { return { t: 'polygon', c: rp(c), n, r: r2(R), rot: r2(n360(ang)), ic: ic === 'C' ? 'C' : 'I' }; }
function polygonEdge(a, b, n) {
  const L = ptDist(a, b), ap = L / (2 * Math.tan(Math.PI / n)); const c = polarPt(midPt(a, b), ap, ptAngle(a, b) + 90);
  return polygonShape(c, n, ptDist(c, a), ptAngle(c, a), 'I');
}
function polygonEdgePts(a, b, n) {
  const L = ptDist(a, b), ap = L / (2 * Math.tan(Math.PI / n)); const dir = ptAngle(a, b);
  const c = polarPt(midPt(a, b), ap, dir + 90); const R = ptDist(c, a); const a0 = ptAngle(c, a);
  return Array.from({ length: n }, (_, i) => rp(polarPt(c, R, a0 + i * 360 / n)));
}
drawTool('polygon', {
  name: 'Polygon',
  init(D) { D.n = PREFS.polySides || 6; D.ic = PREFS.polyIC || 'I'; D.stage = D.stage || 0; D.want = D.stage === 0 ? 'number' : D.stage === 'r' ? 'dist' : 'point'; },
  prompt(D) {
    if (D.stage === 0) return `Number of sides <${D.n}>, or specify center point [Edge]:`;
    if (D.stage === 'e') return D.pts.length ? 'Specify second end point of the edge:' : 'Specify first end point of the edge:';
    return `Specify radius [${D.ic === 'I' ? 'Circumscribed' : 'Inscribed'}] (now ${D.ic === 'I' ? 'inscribed in' : 'circumscribed about'} the circle):`;
  },
  num(D, n) { if (D.stage !== 0) return; n = Math.round(n); if (n < 3 || n > 64) { flash('A polygon needs 3 to 64 sides'); return; } D.n = PREFS.polySides = n; savePrefs(); },
  point(D, q, c) {
    if (D.stage === 0) { D.pts = [q]; D.stage = 'r'; D.want = 'dist'; return; }
    if (D.stage === 'e') { if (!D.pts.length) { D.pts.push(q); return; } if (ptDist(D.pts[0], q) > 0.01) commitShape(c, polygonEdge(D.pts[0], q, D.n)); drawRestart(D); return; }
    const R = ptDist(D.pts[0], q); if (R > 0.01) commitShape(c, polygonShape(D.pts[0], D.n, R, ptAngle(D.pts[0], q), D.ic)); drawRestart(D);
  },
  distPoint(D, q, c) { this.point(D, q, c); },
  dist(D, v, c) { const aim = D.cur && ptDist(D.cur, D.pts[0]) > 0.01 ? ptAngle(D.pts[0], D.cur) : 90; if (v > 0) commitShape(c, polygonShape(D.pts[0], D.n, v, aim, D.ic)); drawRestart(D); },
  last(D) { return D.stage === 'r' || D.stage === 'e' ? D.pts[D.pts.length - 1] || null : null; },
  ghost(D, q) {
    if (D.stage === 'r') { const R = ptDist(D.pts[0], q); return R > 0.01 ? [polygonShape(D.pts[0], D.n, R, ptAngle(D.pts[0], q), D.ic)] : []; }
    if (D.stage === 'e' && D.pts.length && ptDist(D.pts[0], q) > 0.01) return [polygonEdge(D.pts[0], q, D.n)];
    return [];
  },
  opt(D, w) {
    if (D.stage === 0 && (w === 'E' || w === 'EDGE')) { D.stage = 'e'; D.want = 'point'; return true; }
    if (D.stage === 'r' && (w === 'I' || w === 'INSCRIBED' || w === 'C' || w === 'CIRCUMSCRIBED')) { D.ic = PREFS.polyIC = w[0]; savePrefs(); return true; }
    return false;
  },
});

// ---------- rectangle with optional rounded or cut corners ----------
function rectPline(a, b, r, ch) {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const m = Math.min(x1 - x0, y1 - y0) / 2; const k = Math.min(r || ch || 0, m);
  if (!(k > 0.01)) return { t: 'pline', pts: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]].map(rp), closed: true };
  const pts = [[x0 + k, y1], [x1 - k, y1], [x1, y1 - k], [x1, y0 + k], [x1 - k, y0], [x0 + k, y0], [x0, y0 + k], [x0, y1 - k]].map(rp);
  const s = { t: 'pline', pts, closed: true };
  if (r) { const q = r2(Math.tan(Math.PI / 8) * 1e6) / 1e6; s.b = [0, q, 0, q, 0, q, 0, q]; }
  return s;
}
drawTool('rect', {
  name: 'Rectangle',
  init(D) { D.r = (D.keep || {}).r || 0; D.ch = (D.keep || {}).ch || 0; },
  prompt(D, c) {
    if (D.stage === 'f') return `Corner radius <${fmtLen(c.lv, D.r)}>:`;
    if (D.stage === 'ch') return `Corner cut <${fmtLen(c.lv, D.ch)}>:`;
    const corner = D.r ? `, rounded ${fmtLen(c.lv, D.r)}` : D.ch ? `, cut ${fmtLen(c.lv, D.ch)}` : '';
    return D.pts.length ? 'Specify other corner (width,height or @dx,dy):' : `Specify first corner [Fillet/Chamfer]${corner}:`;
  },
  pointKind: D => D.pts.length ? 'box' : 'draw',
  free: D => D.pts.length > 0 && !D.stage,
  point(D, q, c) {
    if (D.stage) return;
    if (!D.pts.length) { D.pts.push(q); return; }
    const a = D.pts[0]; if (Math.abs(q[0] - a[0]) < 0.01 || Math.abs(q[1] - a[1]) < 0.01) { flash('The rectangle needs a width and a height'); return; }
    commitShape(c, rectFrom(a, q, D.r, D.ch)); D.keep = { r: D.r, ch: D.ch }; drawRestart(D);
  },
  ghost: (D, q) => D.pts.length && !D.stage && Math.abs(q[0] - D.pts[0][0]) > 0.01 && Math.abs(q[1] - D.pts[0][1]) > 0.01 ? [rectFrom(D.pts[0], q, D.r, D.ch)] : [],
  opt(D, w) {
    if (D.pts.length || D.stage) return false;
    if (w === 'F' || w === 'FILLET') { D.stage = 'f'; D.want = 'dist'; return true; }
    if (w === 'C' || w === 'CHAMFER') { D.stage = 'ch'; D.want = 'dist'; return true; }
    return false;
  },
  dist(D, v) { if (D.stage === 'f') { D.r = r2(v); D.ch = 0; } else if (D.stage === 'ch') { D.ch = r2(v); D.r = 0; } D.keep = { r: D.r, ch: D.ch }; D.stage = 0; D.want = 'point'; },
  enter(D) { if (D.stage) { D.stage = 0; D.want = 'point'; return; } drawRestart(D); },
});

// ---------- spline ----------
drawTool('spline', {
  name: 'Spline', keepOnEsc: true,
  prompt: D => D.pts.length ? 'Specify next point [Close/Undo] (Enter to finish):' : 'Specify first point:',
  point(D, q) { const l = drawLast(D); if (l && ptDist(l, q) < 0.01) return; D.pts.push(q); },
  ghost: (D, q) => D.pts.length ? [{ t: 'spline', pts: D.pts.concat([q]) }] : [],
  opt(D, w, c) {
    if (w === 'C' || w === 'CLOSE') { if (D.pts.length >= 3) { commitShape(c, { t: 'spline', pts: D.pts.slice(), closed: true }); drawRestart(D); } else flash('Close needs at least three points'); return true; }
    if (w === 'U' || w === 'UNDO') { D.pts.pop(); return true; }
    return false;
  },
  enter(D, c) { if (D.pts.length >= 2) commitShape(c, { t: 'spline', pts: D.pts.slice() }); drawRestart(D); },
});

// ---------- text ----------
drawTool('text', {
  name: 'Text',
  prompt: () => 'Specify start point of the text:',
  point(D, q, c) {
    dialog('Text', [['text', 'Text (use | for a new line)', ''], ['h', 'Height on paper (mm)', String(PREFS.textH || 2.5), 'number'], ['rot', 'Rotation (degrees)', '0', 'number'], ['align', 'Alignment', PREFS.textAlign || 'left', 'select', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']]]], v => {
      if (!v.text) return false;
      const h = Math.max(0.5, parseFloat(v.h) || 2.5); PREFS.textH = h; PREFS.textAlign = v.align; savePrefs();
      const s = { t: 'text', p: q, text: v.text.replace(/\|/g, '\n'), h: r2(h / fpXform(c.pg).s * 1000) / 1000, rot: n360(parseFloat(v.rot) || 0) }; if (v.align !== 'left') s.align = v.align;
      commitShape(c, s);
    });
  },
});

// ---------- turning shapes into rooms ----------
function shapeRoomPts(s) {
  if (s.t === 'circle') return { pts: rectPts([s.c[0] - s.r, s.c[1] - s.r, s.c[0] + s.r, s.c[1] + s.r]), shape: 'circle' };
  if (s.t === 'ellipse' && Math.abs(n180(s.rot || 0)) % 90 < 0.01) { const sw = Math.abs(n180(s.rot || 0)) === 90; const hx = sw ? s.ry : s.rx, hy = sw ? s.rx : s.ry; return { pts: rectPts([s.c[0] - hx, s.c[1] - hy, s.c[0] + hx, s.c[1] + hy]), shape: 'ellipse' }; }
  if (!shapeClosed(s)) return null;
  const pts = []; for (const p of shapeOutline(s).pts.map(rp)) if (!pts.length || ptDist(pts[pts.length - 1], p) > 0.05) pts.push(p);
  return pts.length >= 3 ? { pts } : null;
}
function shapeToRoom() {
  const pg = page(), lv = levelOf(pg); if (!lv) return;
  const s = lvShapes(lv).find(x => sel.has(x.id) && shapeRoomPts(x));
  if (!s) { flash('Select a closed shape (closed polyline, rectangle, polygon, circle or ellipse) first'); return; }
  const r = shapeRoomPts(s);
  addRoom(pg, r.pts, r.shape, () => { lv.shapes = lvShapes(lv).filter(x => x.id !== s.id); });
}

// ---------- commands ----------
const drawMode = m => () => { if (needFloor()) setMode('d:' + m); };
registerCommand('LINE', ['L'], 'Draw lines', drawMode('line'));
registerCommand('PLINE', ['PL'], 'Draw a polyline (lines and arcs, with widths)', drawMode('pline'));
registerCommand('ARC', ['A'], 'Draw an arc (3 points, or C for center, start, end)', drawMode('arc'));
registerCommand('CIRCLE', ['C'], 'Draw a circle (center and radius, D diameter, 2P, 3P)', drawMode('circle'));
registerCommand('ELLIPSE', ['EL'], 'Draw an ellipse', drawMode('ellipse'));
registerCommand('POLYGON', ['POL'], 'Draw a regular polygon', drawMode('polygon'));
registerCommand('RECTANGLE', ['REC', 'RECTANG'], 'Draw a rectangle (F rounded corners, C cut corners)', drawMode('rect'));
registerCommand('SPLINE', ['SPL'], 'Draw a smooth curve through points', drawMode('spline'));
registerCommand('TEXT', ['T', 'DT'], 'Place text', drawMode('text'));
registerCommand('MAKEROOM', ['MR'], 'Turn the selected closed shape into a room', () => { if (needFloor()) shapeToRoom(); });
