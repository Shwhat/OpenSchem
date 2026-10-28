// ---------- dimensions, leaders and hatches ----------
// Dimensions { t: 'dim', kind: 'lin' | 'ali' | 'ang' | 'rad' | 'dia', ... } follow the geometry they were snapped to:
// each definition point keeps a reference { id, g } to a shape grip (or { room, v } to a room corner) and is read from
// it every time the dimension is drawn. Styles (text size, units, precision, ticks or arrowheads) live in P.dimStyles.
// Leaders { t: 'leader', pts, text } point at something with an arrow. Hatches { t: 'hatch', loops, pattern, scale,
// angle, color } fill an area picked by clicking inside it; closed shapes inside the area are left out (islands).
const DIM_DEFAULT = { name: 'Standard', textH: 2.5, arrow: 'tick', units: 'project', prec: 16, dec: 0, ext: 1.5, gap: 1, as: 2.5 };
function dimStyles() { if (!P.dimStyles || !P.dimStyles.length) P.dimStyles = [clone(DIM_DEFAULT)]; return P.dimStyles; }
const dimStyle = name => dimStyles().find(s => s.name === (name || P.dimStyle)) || dimStyles()[0];
const curDimStyle = () => dimStyle(P.dimStyle);
function shapeLevel(s) { for (const lv of P.levels || []) if (lvShapes(lv).includes(s)) return lv; return levelOf(page()) || (P.levels || [])[0]; }

// ---------- references to geometry ----------
function refFor(lv, p) {
  for (const s of lvShapes(lv)) { if (s.t === 'dim' || s.t === 'leader' || s.t === 'hatch') continue; const g = gripAt(s, p); if (g >= 0) return { id: s.id, g }; }
  for (const r of lv.rooms) { const v = r.pts.findIndex(q => ptDist(q, p) < 0.02); if (v >= 0 && !isRound(r)) return { room: r.id, v }; }
  return null;
}
function refPt(lv, ref, fb) {
  if (!ref || !lv) return fb;
  if (ref.room) { const r = lv.rooms.find(x => x.id === ref.room); return r && r.pts[ref.v] ? r.pts[ref.v] : fb; }
  const s = lvShapes(lv).find(x => x.id === ref.id); if (!s) return fb; const g = shapeGrips(s)[ref.g]; return g || fb;
}
// the definition points of a dimension as drawn now
function dimPts(d, lv) {
  if (d.kind === 'rad' || d.kind === 'dia') { const s = d.ref && lvShapes(lv).find(x => x.id === d.ref); return s && (s.t === 'circle' || s.t === 'arc') ? { c: s.c, r: s.r } : { c: d.c, r: d.r }; }
  if (d.kind === 'ang') {
    const L1 = d.l1 && lvShapes(lv).find(x => x.id === d.l1.id), L2 = d.l2 && lvShapes(lv).find(x => x.id === d.l2.id);
    if (L1 && L2) { const X = lineLineX(L1.a, L1.b, L2.a, L2.b); if (X) return { c: X, p1: L1[d.l1.e], p2: L2[d.l2.e] }; }
    return { c: d.c, p1: d.p1, p2: d.p2 };
  }
  return { p1: refPt(lv, d.r1, d.p1), p2: refPt(lv, d.r2, d.p2) };
}
function dimLabel(d, lv, value, isAng) {
  const st = dimStyle(d.style); let t;
  if (isAng) t = (Math.round(value * 10) / 10) + '°';
  else { const u = st.units === 'project' ? unitsOf() : st.units; t = formatLength(toRealMm(lv, value), u, u === 'metric' ? { dec: st.dec } : { den: +st.prec || 16 }); }
  return d.text ? d.text.replace('<>', t) : t;
}
// line geometry of linear and aligned dimensions: points on the dimension line, its direction
function dimLine(d, p1, p2) {
  const loc = d.loc;
  if (d.kind === 'lin') { if (d.dir === 'v') return { d1: [loc[0], p1[1]], d2: [loc[0], p2[1]] }; return { d1: [p1[0], loc[1]], d2: [p2[0], loc[1]] }; }
  const ang = ptAngle(p1, p2); const n = [Math.cos((ang + 90) * D2R), -Math.sin((ang + 90) * D2R)]; const off = (loc[0] - p1[0]) * n[0] + (loc[1] - p1[1]) * n[1];
  return { d1: [p1[0] + n[0] * off, p1[1] + n[1] * off], d2: [p2[0] + n[0] * off, p2[1] + n[1] * off] };
}
const readable = a => { a = n360(a); return a > 90 && a <= 270 ? a - 180 : a; };
function arrowSVG(tip, dirAng, st, t, col) {
  const as = st.as / t;
  if (st.arrow === 'arrow') { const b = polarPt(tip, as, dirAng + 180); const l = polarPt(b, as / 3.2, dirAng + 90), r = polarPt(b, as / 3.2, dirAng - 90); return `<polygon points="${polyAttr([tip, l, r])}" fill="${col}" stroke="none"/>`; }
  const a = polarPt(tip, as / 2, dirAng + 45), b = polarPt(tip, as / 2, dirAng + 225); return `<path d="M${r2(a[0])},${r2(a[1])}L${r2(b[0])},${r2(b[1])}" stroke="${col}" stroke-width="${r2(0.45 / t * 1000) / 1000}"/>`;
}
function textAt(p, ang, txt0, h, col, anchor = 'middle') { const a = readable(ang); return `<text x="${r2(p[0])}" y="${r2(p[1])}" font-size="${r2(h * 1000) / 1000}" text-anchor="${anchor}" fill="${col}" font-family="Arial, sans-serif" transform="rotate(${r2(-a)} ${r2(p[0])} ${r2(p[1])})">${esc(txt0)}</text>`; }
function dimSVGBody(d, lv, t, col) {
  const st = dimStyle(d.style); const sw = r2(0.18 / t * 1000) / 1000, h = st.textH / t, gap = st.gap / t, ext = st.ext / t;
  const line = (a, b) => `M${r2(a[0])},${r2(a[1])}L${r2(b[0])},${r2(b[1])}`; let path = '', out = '';
  const extLine = (p, q) => { const L = ptDist(p, q); if (L < gap + 1e-6) return; const u = unit([q[0] - p[0], q[1] - p[1]]); path += line([p[0] + u[0] * gap, p[1] + u[1] * gap], [q[0] + u[0] * ext, q[1] + u[1] * ext]); };
  const P = dimPts(d, lv);
  if (d.kind === 'lin' || d.kind === 'ali') {
    const { d1, d2 } = dimLine(d, P.p1, P.p2); const L = ptDist(d1, d2); const ang = ptAngle(d1, d2);
    extLine(P.p1, d1); extLine(P.p2, d2); path += line(d1, d2);
    const inside = L > 3 * st.as / t;
    out += arrowSVG(d1, inside ? ang + 180 : ang, st, t, col) + arrowSVG(d2, inside ? ang : ang + 180, st, t, col);
    if (!inside) { path += line(d1, polarPt(d1, 2 * st.as / t, ang + 180)) + line(d2, polarPt(d2, 2 * st.as / t, ang)); }
    const ra = readable(ang); const m = midPt(d1, d2); const tp = polarPt(m, h * 0.35, ra + 90);
    out += textAt(tp, ang, dimLabel(d, lv, L), h, col);
  } else if (d.kind === 'ang') {
    const c = P.c, r = Math.max(1e-3, ptDist(c, d.loc)); let a1 = ptAngle(c, P.p1), a2 = ptAngle(c, P.p2), al = ptAngle(c, d.loc);
    if (n360(al - a1) > n360(a2 - a1)) [a1, a2] = [a2, a1];
    const sweep = n360(a2 - a1); const arc = { t: 'arc', c, r, a0: a1, a1: a2 };
    path += shapeD(arc);
    for (const [p, a] of [[P.p1, ptAngle(c, P.p1)], [P.p2, ptAngle(c, P.p2)]]) { const onArc = polarPt(c, r, a); if (ptDist(c, p) < r) extLine(p, onArc); }
    out += arrowSVG(polarPt(c, r, a1), a1 - 90, st, t, col) + arrowSVG(polarPt(c, r, a2), a2 + 90, st, t, col);
    const am = a1 + sweep / 2; out += textAt(polarPt(c, r + h * 0.4, am), am - 90, dimLabel(d, lv, sweep, true), h, col);
  } else {
    const c = P.c, r = P.r; const ang = ptAngle(c, d.loc); const E = polarPt(c, r, ang); const far = ptDist(c, d.loc) > r;
    if (d.kind === 'dia') { const F = polarPt(c, r, ang + 180); path += line(F, far ? d.loc : E); out += arrowSVG(E, ang, st, t, col) + arrowSVG(F, ang + 180, st, t, col); }
    else { path += line(c, far ? d.loc : E); out += arrowSVG(E, ang, st, t, col); }
    const val = d.kind === 'dia' ? 2 * r : r; const pre = d.kind === 'dia' ? 'Ø' : 'R';
    const tp = far ? polarPt(d.loc, h * 0.35, readable(ang) + 90) : polarPt(polarPt(c, r / 2, ang), h * 0.35, readable(ang) + 90);
    out += textAt(tp, ang, pre + ' ' + dimLabel(d, lv, val), h, col);
  }
  return `<path d="${path}" stroke="${col}" stroke-width="${sw}" fill="none"/>` + out;
}
function leaderSVGBody(s, lv, t, col) {
  const st = dimStyle(s.style); const h = st.textH / t, sw = r2(0.18 / t * 1000) / 1000; const p = s.pts; if (p.length < 2) return '';
  const last = p[p.length - 1], prev = p[p.length - 2]; const right = last[0] >= prev[0]; const land = polarPt(last, 1.5 / t, right ? 0 : 180);
  let out = `<path d="M${p.map(q => r2(q[0]) + ',' + r2(q[1])).join('L')}L${r2(land[0])},${r2(land[1])}" stroke="${col}" stroke-width="${sw}" fill="none"/>`;
  out += arrowSVG(p[0], ptAngle(p[1], p[0]), Object.assign({}, st, { arrow: 'arrow' }), t, col);
  const lines = String(s.text || '').split('\n');
  lines.forEach((ln, i) => { const q = polarPt(land, 0.8 / t, right ? 0 : 180); out += `<text x="${r2(q[0])}" y="${r2(q[1] + h * 0.35 + i * h * 1.3)}" font-size="${r2(h * 1000) / 1000}" text-anchor="${right ? 'start' : 'end'}" fill="${col}" font-family="Arial, sans-serif">${esc(ln)}</text>`; });
  return out;
}

// ---------- hatch patterns ----------
const HATCH_PATTERNS = [['solid', 'Solid fill'], ['diagonal', 'Diagonal lines'], ['cross', 'Crosshatch'], ['dots', 'Dots'], ['brick', 'Brick'], ['concrete', 'Concrete'], ['wood', 'Wood grain'], ['insulation', 'Insulation (batt)']];
const hatchSettings = () => Object.assign({ pattern: 'diagonal', scale: 1, angle: 0, color: '#5d6775' }, PREFS.hatch || {});
function hatchPattern(s, t) {
  const u = Math.max(0.05, (s.scale || 1) * 2.5 / t), col = s.color || '#5d6775', sw = r2(0.15 / t * 1000) / 1000; const f = x => r2(x * u * 1000) / 1000; const id = 'hp-' + s.id;
  const pat = (w, h, body, rot = 0) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f(w)}" height="${f(h)}" patternTransform="rotate(${r2(-(s.angle || 0) - rot)})"><g stroke="${col}" stroke-width="${sw}" fill="none">${body}</g></pattern>`;
  switch (s.pattern) {
    case 'diagonal': return pat(1, 1, `<path d="M0,${f(.5)}H${f(1)}"/>`, 45);
    case 'cross': return pat(1, 1, `<path d="M0,${f(.5)}H${f(1)}M${f(.5)},0V${f(1)}"/>`, 45);
    case 'dots': return pat(1, 1, `<circle cx="${f(.5)}" cy="${f(.5)}" r="${f(.1)}" fill="${col}" stroke="none"/>`);
    case 'brick': return pat(2, 2, `<path d="M0,${f(.5)}H${f(2)}M0,${f(1.5)}H${f(2)}M${f(.5)},${f(.5)}V${f(1.5)}M${f(1.5)},${f(1.5)}V${f(2)}M${f(1.5)},0V${f(.5)}"/>`);
    case 'concrete': return pat(3, 3, `<circle cx="${f(.4)}" cy="${f(.6)}" r="${f(.07)}" fill="${col}"/><circle cx="${f(2.1)}" cy="${f(1.9)}" r="${f(.07)}" fill="${col}"/><circle cx="${f(1.3)}" cy="${f(2.6)}" r="${f(.06)}" fill="${col}"/><path d="M${f(1.6)},${f(.5)}l${f(.3)},${f(.45)}h${f(-.55)}z M${f(.5)},${f(1.8)}l${f(.25)},${f(.38)}h${f(-.45)}z M${f(2.4)},${f(.9)}l${f(.2)},${f(.3)}h${f(-.36)}z"/>`);
    case 'wood': return pat(4, 1, `<path d="M0,${f(.5)}Q${f(1)},${f(.15)} ${f(2)},${f(.5)}T${f(4)},${f(.5)}"/>`);
    case 'insulation': return pat(2, 2, `<path d="M0,${f(1)}C0,${f(.2)} ${f(1)},${f(.2)} ${f(1)},${f(1)}C${f(1)},${f(1.8)} ${f(2)},${f(1.8)} ${f(2)},${f(1)}"/>`);
    default: return '';
  }
}
const loopsD = loops => loops.map(l => 'M' + l.map(q => r2(q[0]) + ',' + r2(q[1])).join('L') + 'Z').join('');
function hatchSVGBody(s, t) {
  const d = loopsD(s.loops || []); if (!d) return '';
  if (s.pattern === 'solid') return `<path d="${d}" fill="${s.color || '#5d6775'}" fill-rule="evenodd" stroke="none"/>`;
  return `<defs>${hatchPattern(s, t)}</defs><path d="${d}" fill="url(#hp-${s.id})" fill-rule="evenodd" stroke="none"/>`;
}
function hatchLoopsAt(lv, p) {
  const outer = regionAt(boundaryEdges(lv, { rooms: true }), p); if (!outer) return null;
  const loops = [outer];
  const closedOutlines = lvShapes(lv).filter(s => shapeClosed(s) && s.t !== 'hatch').map(s => shapeOutline(s).pts).concat(lv.rooms.map(roomPoly));
  for (const pts of closedOutlines) {
    if (pts.length < 3 || inPoly(p, pts)) continue;
    if (pts.every(q => inPoly(q, outer)) && Math.abs(polyArea(pts) - polyArea(outer)) > 1e-3) loops.push(pts.map(rp));
  }
  return loops;
}

// ---------- hooks into shapes.js ----------
function shapeOutlineMore(s) {
  if (s.t === 'dim') { const lv = shapeLevel(s); const P2 = dimPts(s, lv); const pts = [s.loc]; if (P2.p1) pts.push(P2.p1, P2.p2); if (P2.c) pts.push(P2.c); if (s.kind === 'lin' || s.kind === 'ali') { const k = dimLine(s, P2.p1, P2.p2); pts.push(k.d1, k.d2); } return { pts, closed: false }; }
  if (s.t === 'leader') return { pts: s.pts, closed: false };
  if (s.t === 'hatch') return { pts: (s.loops || [[]])[0] || [], closed: true };
  if (s.t === 'insert' && typeof insertOutline === 'function') return insertOutline(s);
  return null;
}
function shapeSnapMore(s, add, segs) {
  if (s.t === 'dim' || s.t === 'hatch') return true;
  if (s.t === 'leader') { add(s.pts[0], 'end'); return true; }
  if (s.t === 'insert' && typeof insertSnaps === 'function') { insertSnaps(s, add, segs); return true; }
  return false;
}
function transformMore(s, T, m) {
  if (s.t === 'dim') { for (const k of ['p1', 'p2', 'loc', 'c']) if (s[k]) s[k] = m(s[k]); if (s.r) s.r = r2(s.r * T.k); if (s.kind === 'lin' && T.rot && Math.abs(n180(T.rot)) % 180 > 45 && Math.abs(n180(T.rot)) % 180 < 135) s.dir = s.dir === 'v' ? 'h' : 'v'; }
  else if (s.t === 'leader') s.pts = s.pts.map(m);
  else if (s.t === 'hatch') { s.loops = s.loops.map(l => l.map(m)); if (T.k !== 1) s.scale = r2((s.scale || 1) * T.k * 1000) / 1000; }
  else if (s.t === 'insert' && typeof transformInsert === 'function') transformInsert(s, T, m);
}
function shapeSVGMore(s, t, o, col) {
  if (s.t !== 'dim' && s.t !== 'leader' && s.t !== 'hatch' && s.t !== 'insert') return null;
  const lv = o.lv || shapeLevel(s); const c = o.sel ? 'var(--sel)' : o.ghost ? '#1f6fff' : (s.color || (s.t === 'hatch' ? '#5d6775' : sheetDark() ? '#d0d4da' : '#1d1d1d'));
  let body;
  if (s.t === 'dim') body = dimSVGBody(s, lv, t, c);
  else if (s.t === 'leader') body = leaderSVGBody(s, lv, t, c);
  else if (s.t === 'hatch') body = hatchSVGBody(o.sel || o.ghost ? Object.assign({}, s, { color: c }) : s, t);
  else body = insertSVGBody(s, lv, t, o, c);
  const ol = shapeOutlineMore(s);
  const hit = s.t === 'hatch' ? `<path class="hit" d="${loopsD(s.loops || [])}" fill-rule="evenodd"/>` : s.t === 'insert' ? `<polygon class="hit" points="${polyAttr(insertOutline(s).pts)}"/>` : `<path class="wirehit" d="M${ol.pts.map(q => r2(q[0]) + ',' + r2(q[1])).join('L')}" style="stroke-width:${r2(3 / t)}"/>`;
  if (o.ghost) return `<g class="shpghost" opacity="0.75">${body}</g>`;
  return `<g ${o.locked ? '' : `data-id="${s.id}" `}class="shp${o.sel ? ' ssel' : ''}">${o.locked ? '' : hit}${body}</g>`;
}
function shapeGripsMore(s) {
  if (s.t === 'dim') { const P2 = dimPts(s, shapeLevel(s)); if (s.kind === 'rad' || s.kind === 'dia' || s.kind === 'ang') return [s.loc]; return [P2.p1, P2.p2, s.loc]; }
  if (s.t === 'leader') return s.pts.slice();
  if (s.t === 'insert') return [s.p];
  return [];
}
function gripStretchMore(s, i, q) {
  if (s.t === 'dim') {
    if (s.kind === 'rad' || s.kind === 'dia' || s.kind === 'ang' || i === 2) { s.loc = q; return; }
    const lv = shapeLevel(s); const k = i === 0 ? 'p1' : 'p2', rk = i === 0 ? 'r1' : 'r2'; s[k] = q; const r = refFor(lv, q); if (r && r.id !== s.id) s[rk] = r; else delete s[rk];
  } else if (s.t === 'leader') s.pts[i] = q;
  else if (s.t === 'insert') s.p = q;
}
function explodeOther(lv, s) {
  if (s.t === 'insert' && typeof insertShapes === 'function') return insertShapes(s, lv, true).map(x => Object.assign(x, { id: uid() }));
  if (s.t === 'dim') {
    const t = fpXform(page()).s; const out = []; const st = dimStyle(s.style); const P2 = dimPts(s, lv); const h = st.textH / t;
    if (s.kind === 'lin' || s.kind === 'ali') { const k = dimLine(s, P2.p1, P2.p2); out.push({ t: 'line', a: rp(k.d1), b: rp(k.d2) }, { t: 'line', a: rp(P2.p1), b: rp(k.d1) }, { t: 'line', a: rp(P2.p2), b: rp(k.d2) }, { t: 'text', p: rp(polarPt(midPt(k.d1, k.d2), h * 0.35, readable(ptAngle(k.d1, k.d2)) + 90)), text: dimLabel(s, lv, ptDist(k.d1, k.d2)), h: r2(h * 1000) / 1000, rot: r2(readable(ptAngle(k.d1, k.d2))) }); }
    else return null;
    return out.map(x => Object.assign(x, { id: uid(), layer: s.layer }));
  }
  return null;
}

// ---------- dimension and leader tools ----------
function commitDim(c, d) { d.style = curDimStyle().name; return commitShape(c, d); }
function linDir(p1, p2, loc) { const x0 = Math.min(p1[0], p2[0]), x1 = Math.max(p1[0], p2[0]), y0 = Math.min(p1[1], p2[1]), y1 = Math.max(p1[1], p2[1]); if (loc[0] > x0 && loc[0] < x1) return 'h'; if (loc[1] > y0 && loc[1] < y1) return 'v'; return Math.abs(loc[1] - (y0 + y1) / 2) - (y1 - y0) / 2 > Math.abs(loc[0] - (x0 + x1) / 2) - (x1 - x0) / 2 ? 'h' : 'v'; }
function dimTwoPoint(kind) {
  return {
    name: kind === 'lin' ? 'Linear dimension' : 'Aligned dimension',
    prompt: D => ['Specify first extension line origin:', 'Specify second extension line origin:', 'Specify dimension line location:'][D.pts.length],
    make(D, q) { const [p1, p2] = D.pts; const d = { t: 'dim', kind, p1, p2, loc: q, style: curDimStyle().name }; if (kind === 'lin') d.dir = linDir(p1, p2, q); if (D.r1) d.r1 = D.r1; if (D.r2) d.r2 = D.r2; return d; },
    point(D, q, c) {
      if (D.pts.length < 2) { if (D.pts.length && ptDist(D.pts[0], q) < 0.01) return; const r = refFor(c.lv, q); if (D.pts.length === 0) D.r1 = r; else D.r2 = r; D.pts.push(q); return; }
      commitDim(c, this.make(D, q)); drawRestart(D);
    },
    ghost(D, q) { if (D.pts.length === 1) return [{ t: 'line', a: D.pts[0], b: q, dash: 'dash' }]; if (D.pts.length === 2) return [this.make(Object.assign({}, D, { r1: null, r2: null }), q)]; return []; },
  };
}
drawTool('dimlin', dimTwoPoint('lin'));
drawTool('dimali', dimTwoPoint('ali'));
const lineish = s => s.t === 'line' || s.t === 'wall';
drawTool('dimang', {
  name: 'Angular dimension',
  prompt: D => D.stage === 0 ? 'Select the first line:' : D.stage === 1 ? 'Select the second line:' : 'Specify the arc location:',
  point(D, q, c) {
    const raw = c.raw || q;
    if (D.stage < 2) {
      const pk = pickShape(c.pg, c.lv, raw, lineish); if (!pk) { flash('Click on a line or wall'); return; }
      if (D.stage === 0) { D.L1 = pk.s; D.pk1 = raw; D.stage = 1; return; }
      const X = lineLineX(D.L1.a, D.L1.b, pk.s.a, pk.s.b); if (!X) { flash('The lines are parallel'); return; }
      D.L2 = pk.s; D.pk2 = raw; D.X = X; D.e1 = farEnd(D.L1.a, D.L1.b, X, D.pk1); D.e2 = farEnd(pk.s.a, pk.s.b, X, raw); D.stage = 2; return;
    }
    commitDim(c, this.make(D, q)); drawRestart(D);
  },
  make(D, q) { return { t: 'dim', kind: 'ang', c: D.X, p1: D.L1[D.e1], p2: D.L2[D.e2], loc: q, l1: { id: D.L1.id, e: D.e1 }, l2: { id: D.L2.id, e: D.e2 }, style: curDimStyle().name }; },
  ghost(D, q) { return D.stage === 2 ? [Object.assign(this.make(D, q), { l1: null, l2: null })] : []; },
});
function dimRound(kind) {
  return {
    name: kind === 'rad' ? 'Radius dimension' : 'Diameter dimension',
    prompt: D => D.stage === 0 ? 'Select a circle or arc:' : 'Specify the dimension line location:',
    point(D, q, c) {
      if (D.stage === 0) { const pk = pickShape(c.pg, c.lv, c.raw || q, s => s.t === 'circle' || s.t === 'arc'); if (!pk) { flash('Click on a circle or arc'); return; } D.S = pk.s; D.stage = 1; return; }
      commitDim(c, this.make(D, q)); drawRestart(D);
    },
    make(D, q) { return { t: 'dim', kind, ref: D.S.id, c: D.S.c, r: D.S.r, loc: q, style: curDimStyle().name }; },
    ghost(D, q) { return D.stage === 1 ? [Object.assign(this.make(D, q), { ref: null })] : []; },
  };
}
drawTool('dimrad', dimRound('rad'));
drawTool('dimdia', dimRound('dia'));
drawTool('leader', {
  name: 'Leader', keepOnEsc: true,
  prompt: D => D.pts.length ? 'Specify next point (Enter for the text):' : 'Specify the arrow point:',
  point(D, q) { const l = drawLast(D); if (l && ptDist(l, q) < 0.01) return; D.pts.push(q); },
  ghost: (D, q) => D.pts.length ? [{ t: 'leader', pts: D.pts.concat([q]), text: '' }] : [],
  enter(D, c) {
    if (D.pts.length < 2) { drawRestart(D); return; }
    const pts = D.pts.slice(); drawRestart(D);
    dialog('Leader text', [['text', 'Text (use | for a new line)', '']], v => { commitShape(c, { t: 'leader', pts, text: v.text.replace(/\|/g, '\n'), style: curDimStyle().name }); });
  },
});

// ---------- hatch tool ----------
drawTool('hatch', {
  name: 'Hatch',
  prompt: D => { const h = hatchSettings(); return D.stage === 'sel' ? 'Select a closed shape to hatch:' : `Click inside the area to hatch [Select object/Pattern] (${(HATCH_PATTERNS.find(p => p[0] === h.pattern) || [0, h.pattern])[1]}, scale ${h.scale}):`; },
  point(D, q, c) {
    const raw = c.raw || q; let loops;
    if (D.stage === 'sel') {
      const pk = pickShape(c.pg, c.lv, raw, s => shapeClosed(s), true); if (!pk) { flash('Click on a closed shape'); return; }
      const outer = (pk.s ? shapeOutline(pk.s).pts : roomPoly(pk.room)).map(rp); loops = [outer]; D.stage = 0;
    } else { loops = hatchLoopsAt(c.lv, raw); if (!loops) { flash('No closed area found there'); return; } }
    const h = hatchSettings(); commitShape(c, { t: 'hatch', loops, pattern: h.pattern, scale: h.scale, angle: h.angle, color: h.color });
  },
  opt(D, w) {
    if (w === 'S' || w === 'SELECT') { D.stage = 'sel'; return true; }
    if (w === 'P' || w === 'PATTERN') { hatchSettingsDlg(() => drawRefresh()); return true; }
    return false;
  },
  enter() { drawExit(); },
});
function hatchSettingsDlg(after) {
  const h = hatchSettings();
  dialog('Hatch settings', [['pattern', 'Pattern', h.pattern, 'select', HATCH_PATTERNS], ['scale', 'Scale', String(h.scale), 'number'], ['angle', 'Angle (degrees)', String(h.angle), 'number'], ['color', 'Color', h.color]], v => {
    PREFS.hatch = { pattern: v.pattern, scale: Math.max(0.05, parseFloat(v.scale) || 1), angle: parseFloat(v.angle) || 0, color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : h.color }; savePrefs(); renderStatus(); if (after) after();
  }, 'OK', '<div class="note">Islands: closed shapes inside the area are left unhatched. The scale makes the pattern bigger or smaller.</div>');
}

// ---------- dimension styles ----------
function dimStyleDlg() {
  const st = curDimStyle(); const names = dimStyles().map(s => [s.name, s.name]);
  dialog('Dimension style', [['use', 'Current style', st.name, 'select', names], ['textH', 'Text height on paper (mm)', String(st.textH), 'number'], ['arrow', 'Ends', st.arrow, 'select', [['tick', 'Architectural ticks'], ['arrow', 'Arrowheads']]],
    ['units', 'Units', st.units, 'select', [['project', 'Same as the project'], ['imperial', 'Feet and inches'], ['metric', 'Metric']]], ['prec', 'Smallest fraction (feet and inches)', String(st.prec), 'select', [['1', '1"'], ['2', '1/2"'], ['4', '1/4"'], ['8', '1/8"'], ['16', '1/16"'], ['32', '1/32"']]],
    ['dec', 'Decimals (metric)', String(st.dec), 'select', [['0', '0'], ['1', '0.0'], ['2', '0.00'], ['3', '0.000']]], ['newName', 'Save as a new style named', '']], v => {
    commit(() => {
      let target = dimStyle(v.use);
      if (v.newName) { if (dimStyles().some(s => s.name === v.newName)) { alert('A style with that name exists.'); return; } target = Object.assign(clone(target), { name: v.newName }); P.dimStyles.push(target); }
      Object.assign(target, { textH: Math.max(0.5, parseFloat(v.textH) || 2.5), arrow: v.arrow, units: v.units, prec: +v.prec || 16, dec: +v.dec || 0 });
      P.dimStyle = target.name;
    });
  }, 'OK', '<div class="note">The settings apply to every dimension that uses the style. New dimensions use the current style.</div>');
}
function toggleDimArrows() { commit(() => { const s = curDimStyle(); s.arrow = s.arrow === 'tick' ? 'arrow' : 'tick'; }); flash('Dimension ends: ' + (curDimStyle().arrow === 'tick' ? 'architectural ticks' : 'arrowheads')); }

// ---------- properties ----------
function annotPropsHTML(pg, lv, list) {
  const f = list[0]; const opt = (pairs, cur) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  if (list.every(s => s.t === 'dim' || s.t === 'leader')) {
    const one = list.length === 1;
    const names = { lin: 'Linear dimension', ali: 'Aligned dimension', ang: 'Angular dimension', rad: 'Radius dimension', dia: 'Diameter dimension' };
    return `<div class="ident">${one ? (f.t === 'leader' ? 'Leader' : names[f.kind]) : list.length + ' annotations'}</div>
      <div class="pgrp"><h4>Annotation</h4>${row('shp.dstyle', 'Style', '', 'select', opt(dimStyles().map(s => [s.name, s.name]), f.style || curDimStyle().name))}
      ${one && f.t === 'dim' ? row('shp.dtext', 'Text (<> is the measurement)', f.text || '', 'text', 'placeholder="<>"') : ''}${one && f.t === 'leader' ? row('shp.ltext', 'Text', f.text || '', 'textarea') : ''}
      <div class="prow"><label>Color</label><input type="color" data-k="shp.color" value="${esc(f.color || '#1d1d1d')}"></div></div>
      ${one && f.t === 'dim' && (f.r1 || f.r2 || f.ref || f.l1) ? '<div class="note">This dimension follows the geometry it was drawn on.</div>' : ''}
      <div class="btnrow"><button class="btn" data-act="dimStyleDlg">Styles...</button><button class="btn" data-act="toggleDimArrows">Ticks / arrows</button><button class="btn" data-act="delSel">Delete</button></div>`;
  }
  if (list.every(s => s.t === 'hatch')) {
    return `<div class="ident">${list.length === 1 ? 'Hatch' : list.length + ' hatches'}</div><div class="sub">Area ${esc(formatArea(polyArea(f.loops[0]) * lvScale(lv) * lvScale(lv)))}</div>
      <div class="pgrp"><h4>Hatch</h4>${row('shp.hpat', 'Pattern', '', 'select', opt(HATCH_PATTERNS, f.pattern))}${row('shp.hscale', 'Scale', f.scale || 1, 'number', 'step="0.25" min="0.05"')}${row('shp.hangle', 'Angle', f.angle || 0, 'number')}
      <div class="prow"><label>Color</label><input type="color" data-k="shp.color" value="${esc(f.color || '#5d6775')}"></div>${userLayers().length ? row('shp.layer', 'Layer', '', 'select', layerOptions(f.layer)) : ''}</div>
      <div class="btnrow"><button class="btn" data-act="eBack">Send to back</button><button class="btn" data-act="delSel">Delete</button></div>`;
  }
  return null;
}
function applyAnnotProp(pg, lv, s, key, v) {
  if (key === 'dstyle' && (s.t === 'dim' || s.t === 'leader')) { s.style = v; return true; }
  if (key === 'dtext' && s.t === 'dim') { if (v) s.text = v; else delete s.text; return true; }
  if (key === 'ltext' && s.t === 'leader') { s.text = v; return true; }
  if (s.t === 'hatch') {
    if (key === 'hpat') { s.pattern = v; return true; }
    if (key === 'hscale') { const k = parseFloat(v); if (k > 0) s.scale = k; return true; }
    if (key === 'hangle') { s.angle = parseFloat(v) || 0; return true; }
  }
  return false;
}

registerCommand('DIMLINEAR', ['DLI', 'DIM'], 'Horizontal or vertical dimension', () => { if (needFloor()) setMode('d:dimlin'); });
registerCommand('DIMALIGNED', ['DAL'], 'Dimension along the measured line', () => { if (needFloor()) setMode('d:dimali'); });
registerCommand('DIMANGULAR', ['DAN'], 'Angle between two lines', () => { if (needFloor()) setMode('d:dimang'); });
registerCommand('DIMRADIUS', ['DRA'], 'Radius of a circle or arc', () => { if (needFloor()) setMode('d:dimrad'); });
registerCommand('DIMDIAMETER', ['DDI'], 'Diameter of a circle or arc', () => { if (needFloor()) setMode('d:dimdia'); });
registerCommand('DIMSTYLE', ['D', 'DST'], 'Dimension styles', () => dimStyleDlg());
registerCommand('DIMARROWS', ['DAR'], 'Switch dimension ends between ticks and arrowheads', () => toggleDimArrows());
registerCommand('LEADER', ['LE', 'MLEADER'], 'Leader with text', () => { if (needFloor()) setMode('d:leader'); });
registerCommand('HATCH', ['H', 'BH'], 'Hatch an area (click inside it)', () => { if (needFloor()) setMode('d:hatch'); });
registerCommand('HATCHSETTINGS', ['HS'], 'Hatch pattern, scale, angle and color', () => hatchSettingsDlg());
