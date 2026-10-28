// ---------- object snaps, ortho and polar tracking (floor plans) ----------
// Object snaps catch the corners, midpoints, centers, crossings and quadrants of rooms and devices (plus the points of the
// shape being drawn), with a marker and a name next to the cursor. Ortho keeps new points on the horizontal or vertical
// through the last point; polar tracking locks onto angle steps (15, 30, 45 or 90 degrees).
const OSNAP_KINDS = [['end', 'Endpoint'], ['mid', 'Midpoint'], ['cen', 'Center'], ['int', 'Intersection'], ['per', 'Perpendicular'], ['nea', 'Nearest'], ['qua', 'Quadrant']];
const OSNAP_DEFAULT = { end: true, mid: true, cen: true, int: true, per: true, nea: false, qua: true };
const OSNAP_RANK = { end: 0, int: 1, mid: 2, cen: 3, qua: 4, per: 5, nea: 6 };
const osnapMaster = () => PREFS.osnapOn !== false;
const osnapFlag = k => (PREFS.osnap && PREFS.osnap[k] != null) ? !!PREFS.osnap[k] : OSNAP_DEFAULT[k];
const osnapKind = k => osnapMaster() && osnapFlag(k);
const osnapAny = () => OSNAP_KINDS.some(([k]) => osnapKind(k));
const osnapName = k => (OSNAP_KINDS.find(x => x[0] === k) || [0, k])[1];

function distPtSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}
function segCross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return [a[0] + t * r[0], a[1] + t * r[1]];
}

// snap targets on a level: room corners and wall midpoints, round room centers and quadrants, device centers
function osnapGeom(pg, lv, o = {}) {
  const pts = [], segs = [];
  for (const r of lv.rooms) {
    if (o.skip && o.skip.has(r.id)) continue;
    if (isRound(r)) {
      const [x0, y0, x1, y1] = bboxPts(r.pts); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      pts.push({ p: [cx, cy], k: 'cen' }, { p: [cx, y0], k: 'qua' }, { p: [x1, cy], k: 'qua' }, { p: [cx, y1], k: 'qua' }, { p: [x0, cy], k: 'qua' });
      const poly = roomPoly(r); for (let i = 0; i < poly.length; i++) segs.push([poly[i], poly[(i + 1) % poly.length]]);
    } else {
      const n = r.pts.length;
      for (let i = 0; i < n; i++) { const a = r.pts[i], b = r.pts[(i + 1) % n]; pts.push({ p: a, k: 'end' }, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], k: 'mid' }); segs.push([a, b]); }
    }
  }
  for (const pl of lv.places) if (!(o.skip && o.skip.has(pl.id))) pts.push({ p: [pl.x, pl.y], k: 'cen' });
  for (const s of lvShapes(lv)) if (!(o.skip && o.skip.has(s.id)) && objShown(s)) shapeSnapGeom(s, pts, segs);
  // points of the shape being drawn
  const ex = o.extra || [];
  for (let i = 0; i < ex.length; i++) { pts.push({ p: ex[i], k: 'end' }); if (i) segs.push([ex[i - 1], ex[i]]); }
  return { pts, segs };
}
// the best snap near p (plan coordinates): { p, k } or null. o.last is the previous point (for perpendicular).
function osnapFind(pg, lv, p, o = {}) {
  if (!osnapMaster() || !osnapAny() || !lv) return null;
  const tol = (o.tolPx || 9) / ((view.s || 1) * fpXform(pg).s);
  const g = osnapGeom(pg, lv, o);
  let best = null, bs = Infinity;
  const consider = (q, k, d) => { if (d > tol || !osnapKind(k)) return; const sc = d + OSNAP_RANK[k] * tol * 0.01; if (sc < bs) { bs = sc; best = { p: [r2(q[0]), r2(q[1])], k }; } };
  for (const t of g.pts) consider(t.p, t.k, Math.hypot(t.p[0] - p[0], t.p[1] - p[1]));
  const near = g.segs.filter(s => distPtSeg(p, s[0], s[1]).d <= tol * 1.5);
  if (osnapKind('int')) for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
    const A = near[i], B = near[j]; if (A.some(u => B.some(v => Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6))) continue;
    const x = segCross(A[0], A[1], B[0], B[1]); if (x) consider(x, 'int', Math.hypot(x[0] - p[0], x[1] - p[1]));
  }
  if (o.last && osnapKind('per')) for (const s of g.segs) {
    const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1], l2 = dx * dx + dy * dy; if (!l2) continue;
    const t = ((o.last[0] - s[0][0]) * dx + (o.last[1] - s[0][1]) * dy) / l2; if (t < 0 || t > 1) continue;
    const f = [s[0][0] + t * dx, s[0][1] + t * dy]; consider(f, 'per', Math.hypot(f[0] - p[0], f[1] - p[1]));
  }
  if (!best && osnapKind('nea')) for (const s of near) { const r = distPtSeg(p, s[0], s[1]); consider(r.q, 'nea', r.d); }
  return best;
}
function osnapMarker(pg, hit) {
  if (!hit) return '';
  const s = toSheet(pg, hit.p[0], hit.p[1]); const u = 1 / (view.s || 1), h = 4.5 * u, sw = 1.5 * u;
  const shape = {
    end: `<rect x="${-h}" y="${-h}" width="${2 * h}" height="${2 * h}"/>`,
    mid: `<path d="M0,${-h}L${h},${h}H${-h}Z"/>`,
    cen: `<circle r="${h}"/>`,
    int: `<path d="M${-h},${-h}L${h},${h}M${-h},${h}L${h},${-h}"/>`,
    per: `<path d="M${-h},${-h}V${h}H${h}M${-h},0H0V${h}"/>`,
    nea: `<path d="M${-h},${-h}H${h}L${-h},${h}H${h}Z"/>`,
    qua: `<path d="M0,${-h}L${h},0L0,${h}L${-h},0Z"/>`,
  }[hit.k] || '';
  return `<g class="osm" data-os="${hit.k}" transform="translate(${s[0]},${s[1]})" style="stroke-width:${sw}">${shape}<text x="${h + 2 * u}" y="${-h}" font-size="${10 * u}" style="stroke-width:${0.8 * u}">${esc(osnapName(hit.k))}</text></g>`;
}

// ---------- ortho and polar tracking ----------
const ptDist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ptAngle = (a, b) => { let d = Math.atan2(a[1] - b[1], b[0] - a[0]) * 180 / Math.PI; if (d < 0) d += 360; return d; };   // degrees, counter-clockwise, Y up
const polarPt = (a, dist, deg) => [a[0] + dist * Math.cos(deg * Math.PI / 180), a[1] - dist * Math.sin(deg * Math.PI / 180)];
function trackPoint(last, q) {
  if (!last) return { p: q, tracked: false };
  if (PREFS.ortho) return { p: Math.abs(q[0] - last[0]) >= Math.abs(q[1] - last[1]) ? [q[0], last[1]] : [last[0], q[1]], tracked: false };
  if (PREFS.polar) {
    const inc = PREFS.polarInc || 45; const d = ptDist(last, q); if (d < 1e-6) return { p: q, tracked: false };
    const ang = ptAngle(last, q); const snapA = Math.round(ang / inc) * inc; const diff = Math.abs(ang - snapA);
    if (diff <= Math.min(inc / 2, 5)) { const proj = d * Math.cos(diff * Math.PI / 180); const p = polarPt(last, proj, snapA); return { p: [r2(p[0]), r2(p[1])], tracked: true, ang: snapA % 360 }; }
  }
  return { p: q, tracked: false };
}
// dashed tracking line (polar) and a length < angle readout at the cursor
function trackOverlay(pg, last, p, tracked) {
  if (!last) return '';
  const lv = levelOf(pg), a = toSheet(pg, last[0], last[1]), b = toSheet(pg, p[0], p[1]); const u = 1 / (view.s || 1);
  const len = formatLength(toRealMm(lv, ptDist(last, p))); const ang = Math.round(ptAngle(last, p) * 10) / 10;
  let s = '';
  if (tracked) { const dx = b[0] - a[0], dy = b[1] - a[1], k = 40 * u / (Math.hypot(dx, dy) || 1); s += `<path class="trk" d="M${a[0]},${a[1]}L${b[0] + dx * k},${b[1] + dy * k}" style="stroke-width:${1.2 * u}"/>`; }
  return s + `<text class="rdout" x="${b[0] + 8 * u}" y="${b[1] - 8 * u}" font-size="${11 * u}" style="stroke-width:${2.5 * u}">${esc(len)} &lt; ${ang}°</text>`;
}

// ---------- toggles and settings ----------
function osnapState() { savePrefs(); renderToolbar(); renderStatus(); }
function toggleOsnap() { PREFS.osnapOn = PREFS.osnapOn === false; osnapState(); flash('Object snap ' + (osnapMaster() ? 'on' : 'off')); }
function toggleOrtho() { PREFS.ortho = !PREFS.ortho; if (PREFS.ortho) PREFS.polar = false; osnapState(); flash('Ortho ' + (PREFS.ortho ? 'on' : 'off')); }
function togglePolar() { PREFS.polar = !PREFS.polar; if (PREFS.polar) PREFS.ortho = false; osnapState(); flash('Polar tracking ' + (PREFS.polar ? 'on (' + (PREFS.polarInc || 45) + '° steps)' : 'off')); }
function osnapDlg() {
  const f = [['on', 'Object snap on', osnapMaster(), 'check']].concat(OSNAP_KINDS.map(([k, n]) => ['k_' + k, n, osnapFlag(k), 'check']));
  f.push(['mode', 'Direction lock', PREFS.ortho ? 'ortho' : PREFS.polar ? 'polar' : 'off', 'select', [['ortho', 'Ortho (horizontal and vertical)'], ['polar', 'Polar tracking (angle steps)'], ['off', 'Off (any direction)']]]);
  f.push(['inc', 'Polar angle step', String(PREFS.polarInc || 45), 'select', [['15', '15°'], ['30', '30°'], ['45', '45°'], ['90', '90°']]]);
  dialog('Drafting settings', f, v => {
    PREFS.osnapOn = v.on; PREFS.osnap = {}; for (const [k] of OSNAP_KINDS) PREFS.osnap[k] = v['k_' + k];
    PREFS.ortho = v.mode === 'ortho'; PREFS.polar = v.mode === 'polar'; PREFS.polarInc = +v.inc || 45; osnapState();
  }, 'OK', '<div class="note">Object snaps catch corners, midpoints, centers, crossings and quadrants while you draw. F3 turns them on and off, F8 toggles ortho, F10 toggles polar tracking.</div>');
}
