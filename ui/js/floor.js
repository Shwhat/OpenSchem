// ---------- floor plans ----------
const DA = { get x0() { return SH.x0; }, get y0() { return SH.hdr; }, get x1() { return SH.x1; }, get y1() { return SH.tb; } };
let placeItemId = null, fdrag = null, fbox = null, fpoly = null;

function newFloorPage(level, num, desc, view, extra) {
  return Object.assign({ id: uid(), kind: 'floor', level, num: String(num), desc: desc || '', view: view || 'level', fn: '', loc: '', items: [], wires: [] }, extra || {});
}
const levelOf = pg => (P.levels || []).find(l => l.id === pg.level);
const isFloor = pg => pg && pg.kind === 'floor';
const fsnap = v => { const g = PREFS.gridFp || 2; return PREFS.snap ? r2(Math.round(v / g) * g) : Math.round(v * 4) / 4; };
function bboxPts(pts, m = 0) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m];
}
function fpXform(pg) {
  const lv = levelOf(pg); let a = null;
  if (lv && pg.view === 'room') { const r = lv.rooms.find(r => r.id === pg.room); if (r) a = bboxPts(r.pts, 10); }
  else if (pg.view === 'area' && pg.area) a = pg.area;
  if (!a) return { s: 1, tx: 0, ty: 0 };
  const dw = DA.x1 - DA.x0 - 16, dh = DA.y1 - DA.y0 - 16;
  const s = Math.min(dw / Math.max(1, a[2] - a[0]), dh / Math.max(1, a[3] - a[1]));
  return { s, tx: (DA.x0 + DA.x1) / 2 - s * (a[0] + a[2]) / 2, ty: (DA.y0 + DA.y1) / 2 - s * (a[1] + a[3]) / 2 };
}
function toPlan(pg, x, y) { const t = fpXform(pg); return [(x - t.tx) / t.s, (y - t.ty) / t.s]; }
function toSheet(pg, x, y) { const t = fpXform(pg); return [x * t.s + t.tx, y * t.s + t.ty]; }
function inPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// round and oval rooms keep their bounding rectangle in pts and shape 'circle' or 'ellipse'
const isRound = r => r && (r.shape === 'ellipse' || r.shape === 'circle');
const rectPts = b => [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
function roomPoly(r) {
  if (!isRound(r)) return r.pts;
  const [x0, y0, x1, y1] = bboxPts(r.pts); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  return Array.from({ length: 48 }, (_, i) => [cx + rx * Math.cos(i * Math.PI / 24), cy + ry * Math.sin(i * Math.PI / 24)]);
}
function roomSnapPts(r) { if (!isRound(r)) return r.pts; const [x0, y0, x1, y1] = bboxPts(r.pts); return [[(x0 + x1) / 2, y0], [x1, (y0 + y1) / 2], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2]]; }
function polyArea(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return Math.abs(a / 2); }
// snap a point to corners and walls of other rooms so rooms share walls
function roomSnap(pg, lv, p, skip) {
  const tol = 3 / fpXform(pg).s; const rooms = lv.rooms.filter(r => !skip || !skip.has(r.id));
  let best = null, bd = tol;
  for (const r of rooms) for (const v of roomSnapPts(r)) { const d = Math.hypot(v[0] - p[0], v[1] - p[1]); if (d < bd) { bd = d; best = v; } }
  if (best) return { p: [best[0], best[1]], hit: true };
  let x = p[0], y = p[1], hit = false;
  for (const r of rooms) if (!isRound(r)) for (let i = 0; i < r.pts.length; i++) {
    const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
    if (a[0] === b[0] && Math.abs(p[0] - a[0]) < tol && p[1] >= Math.min(a[1], b[1]) - tol && p[1] <= Math.max(a[1], b[1]) + tol) { x = a[0]; hit = true; }
    if (a[1] === b[1] && Math.abs(p[1] - a[1]) < tol && p[0] >= Math.min(a[0], b[0]) - tol && p[0] <= Math.max(a[0], b[0]) + tol) { y = a[1]; hit = true; }
  }
  return { p: [x, y], hit };
}
function snapMark(pg, p) { const s = toSheet(pg, p[0], p[1]); return `<circle class="cpt" cx="${s[0]}" cy="${s[1]}" r="1.6"/>`; }
function roomAt(lv, p) { let best = null; for (const r of lv.rooms) if (inPoly(p, roomPoly(r)) && (!best || polyArea(roomPoly(r)) < polyArea(roomPoly(best)))) best = r; return best; }
function placeOf(itemId) { for (const lv of P.levels || []) for (const pl of lv.places) if (pl.item === itemId) return { lv, pl }; return null; }
function findFp(id) {
  for (const lv of P.levels || []) {
    const pl = lv.places.find(p => p.id === id); if (pl) return { lv, pl, kind: 'place' };
    const r = lv.rooms.find(r => r.id === id); if (r) return { lv, r, kind: 'room' };
    if (id === 'img:' + lv.id) return { lv, kind: 'img' };
    const sh = lvShapes(lv).find(x => x.id === id); if (sh) return { lv, s: sh, kind: 'shape' };
  }
  return null;
}
const itemById = id => { const f = findItem(id); return f && f.it; };
function autoRoom(lv, pl) { const r = roomAt(lv, [pl.x, pl.y]); const it = itemById(pl.item); if (r && it) it.loc = r.name; }
function fpViewName(pg) {
  if (pg.view === 'room') { const lv = levelOf(pg); const r = lv && lv.rooms.find(r => r.id === pg.room); return r ? 'Room: ' + r.name : 'Room'; }
  return pg.view === 'area' ? 'Detail area' : pg.view === 'sheet' ? 'View sheet' : 'Whole level';
}

// ---------- floor-plan symbols ----------
const bladeP = 'M0,0C-1.3,-1.6,-1.2,-3.8,0,-4.4C1.2,-3.8,1.3,-1.6,0,0Z';
const FP_SIMPLE = {
  outlet: '<rect x="-3.5" y="-4" width="7" height="8" rx="1.4" fill="#fff"/><path d="M-1.2,-2.3V-0.5M1.2,-2.3V-0.5"/><circle cx="0" cy="1.7" r="0.55"/>',
  light: '<circle cx="0" cy="-1" r="3" fill="#fff"/><path d="M-1.4,2V3.7H1.4V2M-1,1.9L0,-0.6L1,1.9"/>',
  fan: [0, 120, 240].map(a => `<path d="${bladeP}" transform="rotate(${a})" fill="#fff"/>`).join('') + '<circle r="0.9" fill="currentColor"/>',
  sw: '<rect x="-2.6" y="-4" width="5.2" height="8" rx="1" fill="#fff"/><rect x="-1" y="-2.6" width="2" height="2.8" rx="0.5"/>',
  dim: '<rect x="-2.6" y="-4" width="5.2" height="8" rx="1" fill="#fff"/><path d="M0,-2.6V2.6"/><rect x="-1.3" y="-0.8" width="2.6" height="1.6" rx="0.4" fill="currentColor"/>',
  smoke: '<circle r="3.8" fill="#fff"/><circle r="1.6"/><path d="M-2.6,-2.6L-1.6,-1.6M2.6,-2.6L1.6,-1.6M-2.6,2.6L-1.6,1.6M2.6,2.6L1.6,1.6"/>',
  jbox: '<rect x="-3" y="-3" width="6" height="6" fill="#fff"/>',
  app: '<rect x="-4" y="-3" width="8" height="6" rx="0.8" fill="#fff"/>',
  panel: '<rect x="-3.5" y="-5" width="7" height="10" fill="#fff"/><path d="M-1.8,-3H1.8M-1.8,-1H1.8M-1.8,1H1.8M-1.8,3H1.8"/>',
};
const dup = '<circle r="2" fill="#fff"/><path d="M-3.6,-0.8H3.6M-3.6,0.8H3.6"/>';
const FP_ARCH = {
  outlet: dup, outletsw: '<circle r="2" fill="#fff"/><path d="M-2,0A2,2 0 0 0 2,0Z" fill="currentColor"/><path d="M-3.6,-0.8H3.6M-3.6,0.8H3.6"/>',
  out240: '<circle r="2.4" fill="#fff"/><path d="M0,-1.4L1.3,1H-1.3Z" fill="currentColor"/>',
  light: '<circle r="2.2" fill="#fff"/><path d="M0,-2.2V-3.8M0,2.2V3.8M-2.2,0H-3.8M2.2,0H3.8"/>',
  fan: '<circle r="1.4" fill="#fff"/><path d="M-4.2,0H-1.4M1.4,0H4.2M0,-4.2V-1.4M0,1.4V4.2" stroke-width="0.9"/>',
  sw: '', smoke: '<circle r="2.6" fill="#fff"/>', jbox: '<circle r="2.6" fill="#fff"/>',
  app: '<rect x="-3.6" y="-2.6" width="7.2" height="5.2" fill="#fff"/>',
  panel: '<rect x="-5" y="-2" width="10" height="4" fill="#fff"/><path d="M-5,2L5,-2V2Z" fill="currentColor"/>',
};
// [shape key, center text, center size, badge above]
const FP_MAP = {
  simple: { rout: ['outlet'], routgf: ['outlet', '', 0, 'GFCI'], routsw: ['outlet', '', 0, 'SW'], rout240: ['outlet', '', 0, '240V'],
    rlgt: ['light'], rfan: ['fan'], rswt: ['sw'], rsw3: ['sw', '', 0, '3-way'], rsw4: ['sw', '', 0, '4-way'], rdim: ['dim'],
    rsmk: ['smoke'], rjbx: ['jbox', 'J', 3], rapp: ['app', 'APP', 2], rpnl: ['panel'] },
  arch: { rout: ['outlet'], routgf: ['outlet', '', 0, 'GFI'], routsw: ['outletsw'], rout240: ['out240'],
    rlgt: ['light'], rfan: ['fan'], rswt: ['sw', 'S', 5], rsw3: ['sw', 'S3', 4.4], rsw4: ['sw', 'S4', 4.4], rdim: ['sw', 'SD', 4.4],
    rsmk: ['smoke', 'SD', 2], rjbx: ['jbox', 'J', 2.6], rapp: ['app', 'APP', 1.8], rpnl: ['panel'] },
};
function fpGlyph(sym, style) {
  const m = (FP_MAP[style] || FP_MAP.simple)[(SYM[sym] && SYM[sym].fpAs) || sym] || ['jbox', '?', 3];
  const set = style === 'arch' ? FP_ARCH : FP_SIMPLE;
  return { shape: set[m[0]] || '', text: m[1] || '', size: m[2] || 3, badge: m[3] || '' };
}
function fpPlaceSVG(pl, it, isSel, ghost) {
  const g = fpGlyph(it.sym, S().fpSymbols);
  const col = isSel ? '#1f6fff' : (S().circuitColors && it.fn && it.sym !== 'rpnl' ? circuitColor(it.fn) : (sheetDark() ? '#d0d4da' : '#2b2b2b'));
  let s = `<g ${ghost ? '' : `data-id="${pl.id}" `}class="fpp${ghost ? ' ghost' : ''}" style="color:${col}" transform="translate(${r2(pl.x)},${r2(pl.y)})">`;
  s += '<circle r="5.5" class="hit"/>';
  s += `<g class="fps" transform="rotate(${pl.rot || 0})">${g.shape}</g>`;
  if (g.text) s += `<text class="fpt" y="${r2(g.size * 0.36)}" font-size="${g.size}" text-anchor="middle" font-weight="bold">${esc(g.text)}</text>`;
  if (g.badge) s += `<text class="fpt" y="-5.4" font-size="1.9" text-anchor="middle" font-weight="bold">${esc(g.badge)}</text>`;
  if (isSel) s += '<circle r="6" fill="none" stroke="#1f6fff" stroke-width="0.3" stroke-dasharray="1,0.8"/>';
  if (!ghost && it.id && openTodosFor(it.id).length) s += todoFlag(4.5, -3);
  if (it.tag) s += `<text class="fpt fptag" y="7.8" font-size="2.2" text-anchor="middle">${esc(dispTag(it.tag))}</text>`;
  return s + '</g>';
}
function fpIcon(sym) {
  const g = fpGlyph(sym, S().fpSymbols);
  return `<svg viewBox="-6.5 -7 13 13" style="width:20px;height:20px;color:#2b2b2b"><g class="fps">${g.shape}</g>${g.text ? `<text class="fpt" y="${g.size * 0.36}" font-size="${g.size}" text-anchor="middle" font-weight="bold">${esc(g.text)}</text>` : ''}${g.badge ? `<text class="fpt" y="-5" font-size="2.4" text-anchor="middle" font-weight="bold">${esc(g.badge)}</text>` : ''}</svg>`;
}

// ---------- floor-plan page rendering ----------
function floorSVG(pg, o = {}) {
  const all = allPages();
  let s = frameSVG(pg, all.indexOf(pg), all.length);
  if (pg.view === 'sheet') return s + sheetViewsSVG(pg, o);
  const lv = levelOf(pg); if (!lv) return s;
  const t = fpXform(pg);
  s += `<defs><clipPath id="fpc-${pg.id}"><rect x="${DA.x0}" y="${DA.y0}" width="${DA.x1 - DA.x0}" height="${DA.y1 - DA.y0}"/></clipPath></defs>`;
  s += `<g clip-path="url(#fpc-${pg.id})"><g transform="translate(${r2(t.tx)},${r2(t.ty)}) scale(${r2(t.s * 1000) / 1000})">`;
  if (opts.grid && !o.print) {
    const g = PREFS.gridFp || 2, a = toPlan(pg, DA.x0, DA.y0), b = toPlan(pg, DA.x1, DA.y1);
    s += `<defs><pattern id="fgp-${pg.id}" x="${-g / 2}" y="${-g / 2}" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><circle cx="${g / 2}" cy="${g / 2}" r="${0.12 / Math.max(1, t.s / 2)}" class="grid"/></pattern></defs>`;
    s += `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" fill="url(#fgp-${pg.id})" pointer-events="none"/>`;
  }
  s += floorContentSVG(pg, lv, t, o);
  s += '</g></g>';
  // circuit legend
  if (S().circuitColors && lyOn('legend', o)) {
    const ckAll = allCircuits(); const ck = [...new Set(lv.places.map(pl => (itemById(pl.item) || {}).fn).filter(f => f && ckAll.includes(f)))].sort(natCmp);
    if (ck.length) {
      const w = 64, lh = 4.6, x = DA.x1 - w - 4, y = DA.y0 + 4;
      s += `<rect class="legendbox" x="${x}" y="${y}" width="${w}" height="${ck.length * lh + 7}" fill="#fff" stroke="#999" stroke-width="0.25"/>`;
      s += txt(x + 2.5, y + 4.2, home() ? 'Circuits' : 'Circuits (=)', { size: 2.6, bold: true });
      ck.forEach((fn, i) => {
        const yy = y + 7 + i * lh;
        const cp = P.pages.find(p => p.kind !== 'floor' && p.fn === fn);
        s += `<rect x="${x + 2.5}" y="${yy}" width="5" height="3" fill="${circuitColor(fn)}"/>`;
        s += txt(x + 9.5, yy + 2.5, dispCkt(fn) + (cp && cp.desc ? '  ' + cp.desc : ''), { size: 2.4 });
      });
    }
  }
  return s;
}

// the drawing of a level: image, rooms, walls, shapes, switch legs and devices (t: view transform)
function floorContentSVG(pg, lv, t, o) {
  let s = '';
  const im = lv.image;
  if (im && P.assets[im.asset]) {
    const isSel = !o.print && !o.vp && sel.has('img:' + lv.id);
    s += `<image href="${P.assets[im.asset]}" x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}" opacity="${im.opacity ?? 0.5}" preserveAspectRatio="none" ${im.locked ? 'pointer-events="none"' : `data-id="img:${lv.id}"`}/>`;
    if (isSel) s += `<rect x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}" fill="none" stroke="#1f6fff" stroke-width="0.5" stroke-dasharray="2,1.5" pointer-events="none"/>`;
  }
  for (const r of lv.rooms) {
    const isSel = !o.print && !o.vp && sel.has(r.id);
    if (isRound(r)) { const [x0, y0, x1, y1] = bboxPts(r.pts); s += `<g data-id="${r.id}" class="room${isSel ? ' rsel' : ''}"><ellipse class="roomp" cx="${r2((x0 + x1) / 2)}" cy="${r2((y0 + y1) / 2)}" rx="${r2((x1 - x0) / 2)}" ry="${r2((y1 - y0) / 2)}"/></g>`; }
    else s += `<g data-id="${r.id}" class="room${isSel ? ' rsel' : ''}"><polygon class="roomp" points="${r.pts.map(p => p.join(',')).join(' ')}"/></g>`;
  }
  for (const r of lv.rooms) {
    const b = bboxPts(r.pts); const c = [(b[0] + b[2]) / 2, isRound(r) ? (b[1] + b[3]) / 2 + 1.4 : b[1] + Math.min(9, (b[3] - b[1]) / 2)];
    s += `<text class="roomname" x="${r2(c[0])}" y="${r2(c[1])}" font-size="4" text-anchor="middle" pointer-events="none">${esc(r.name)}</text>`;
  }
  s += wallsSVG(lv, t.s, o);
  s += fpShapesSVG(lv, t.s, o);
  const pmap = new Map(lv.places.map(pl => [pl.item, pl]));
  if (S().switchLegs && lyOn('legs', o)) {
    for (const [a, b] of computeLegs()) {
      const p1 = pmap.get(a), p2 = pmap.get(b); if (!p1 || !p2) continue;
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, dx = p2.x - p1.x, dy = p2.y - p1.y;
      const cx = mx - dy * 0.25, cy = my + dx * 0.25;
      const it = itemById(a); const col = S().circuitColors && it && it.fn ? circuitColor(it.fn) : '#666';
      s += `<path class="leg" d="M${r2(p1.x)},${r2(p1.y)}Q${r2(cx)},${r2(cy)} ${r2(p2.x)},${r2(p2.y)}" stroke="${col}"/>`;
    }
  }
  for (const pl of lv.places) { const it = itemById(pl.item); if (it) s += fpPlaceSVG(pl, it, !o.print && !o.vp && sel.has(pl.id)); }
  // resize handles on a single selected room: corners and wall midpoints
  const rs = !o.print && !o.vp && sel.size === 1 && lv.rooms.find(r => sel.has(r.id));
  if (rs) {
    const hr = r2(1.3 / t.s), n = rs.pts.length;
    rs.pts.forEach((a, i) => {
      const b = rs.pts[(i + 1) % n]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      s += `<rect class="rhandle redge" data-rh="e:${rs.id}:${i}" x="${r2(mx - hr)}" y="${r2(my - hr)}" width="${r2(hr * 2)}" height="${r2(hr * 2)}" style="cursor:${a[1] === b[1] ? 'ns-resize' : a[0] === b[0] ? 'ew-resize' : 'move'}"/>`;
    });
    rs.pts.forEach((a, i) => { s += `<circle class="rhandle" data-rh="v:${rs.id}:${i}" cx="${a[0]}" cy="${a[1]}" r="${hr}"/>`; });
  }
  if (!o.print && !o.vp) s += gripsSVG(lv, t);
  return s;
}

// ---------- floor-plan interaction ----------
let fAim = null;           // last cursor point after snapping, in plan coordinates (typed lengths aim at it)
// One drawing point from a mouse position: grid, direction lock (ortho or polar), object snap, shared walls.
// o.last previous point, o.skip rooms to leave out, o.extra points of the shape being drawn, o.walls false to skip wall sharing.
function fpPoint(pg, lv, raw, o = {}) {
  const sp = [fsnap(raw[0]), fsnap(raw[1])];
  const tr = trackPoint(o.last, sp);
  const hit = osnapFind(pg, lv, raw, { last: o.last, skip: o.skip, extra: o.extra });
  if (hit) return { p: hit.p, hit, sp };
  let q = tr.p;
  if (o.walls !== false && !tr.tracked) {
    const rs = roomSnap(pg, lv, q, o.skip);
    if (rs.hit) {
      q = rs.p;
      if (o.last && PREFS.ortho) q = Math.abs(sp[0] - o.last[0]) >= Math.abs(sp[1] - o.last[1]) ? [q[0], o.last[1]] : [o.last[0], q[1]];
      return { p: q, wall: true, sp };
    }
  }
  return { p: q, tracked: tr.tracked, sp };
}
const fpMark = (pg, r) => r.hit ? osnapMarker(pg, r.hit) : r.wall ? snapMark(pg, r.p) : '';
const BOX_MODES = ['room', 'roomoval', 'roomcirc', 'area'];

function fpPlaceAt(pg, lv, q) {
  const keep = placeItemId;
  commit(() => {
    let it;
    if (keep) it = itemById(keep);
    else { it = makeItem(placeSym, 0, 0, 0, { fn: '', loc: '' }); P.pool.push(it); }
    if (!it) return;
    const old = placeOf(it.id); if (old) old.lv.places = old.lv.places.filter(x => x !== old.pl);
    const pl = { id: uid(), item: it.id, x: q[0], y: q[1], rot: placeRot }; lv.places.push(pl); autoRoom(lv, pl); sel = new Set([pl.id]);
  });
  if (keep) setMode('select'); else { const s = toSheet(pg, q[0], q[1]); drawFpGhost(pg, ...s); }
}
// adds a corner to the room shape being drawn; closing on the first corner finishes it
function fpPolyAdd(pg, q, sp) {
  if (!fpoly) fpoly = [q];
  else {
    const f = fpoly[0], l = fpoly[fpoly.length - 1];
    if (fpoly.length > 2 && (ptDist(q, f) < 3 || (sp && ptDist(sp, f) < 3))) { finishPoly(pg); return; }
    if (ptDist(q, l) < 0.01) return;
    fpoly.push(q);
  }
  drawPolyPrev(pg, q);
}
function fpBoxStart(pg, q) { fbox = { start: q, cur: q, armed: false }; fAim = q; }

function fpDown(e, pg, mx, my) {
  if (isSheet(pg)) { sheetDown(e, pg, mx, my); return; }
  const lv = levelOf(pg); if (!lv) return;
  const p = toPlan(pg, mx, my); const sp = [fsnap(p[0]), fsnap(p[1])];
  if (gripOp) { if (gripOp.lv !== lv) gripCancel(); else { gripDown(pg, lv, p); return; } }
  if (mode.startsWith('d:')) { if (DRAW && DRAW.T.picking && DRAW.T.picking(DRAW)) drawPick(e, pg, lv, p); else drawDown(pg, lv, p); return; }
  if (mode === 'fpplace') { fpPlaceAt(pg, lv, fpPoint(pg, lv, p, { walls: false }).p); return; }
  if (BOX_MODES.includes(mode)) {
    const r = fpPoint(pg, lv, p, { walls: mode !== 'area' });
    if (fbox && fbox.armed) { fbox.cur = mode === 'roomcirc' ? squareFrom(fbox.start, r.p) : r.p; fpFinishBox(pg); return; }
    fpBoxStart(pg, r.p); return;
  }
  if (mode === 'roompoly') {
    const r = fpPoint(pg, lv, p, { last: fpoly && fpoly[fpoly.length - 1], extra: fpoly || [] });
    fpPolyAdd(pg, r.p, sp); return;
  }
  const gp = e.target.closest('[data-grip]');
  // a device grip: dragging moves the device as before, a click makes the grip hot
  const isDevMove = gp && /^p:.*:0$/.test(gp.dataset.grip);
  if (gp && !e.shiftKey && !e.ctrlKey && !isDevMove) { gripStart(pg, lv, gp.dataset.grip); return; }
  const devGrip = isDevMove ? gp.dataset.grip : null;
  const rh = e.target.closest('[data-rh]');
  if (rh) {
    const [kind, rid, i] = rh.dataset.rh.split(':'); const rm = lv.rooms.find(r => r.id === rid);
    if (rm) { fdrag = { start: p, pre: snapshot(), handle: { kind, rm, i: +i, orig: clone(rm.pts) }, lv, moved: false }; return; }
  }
  const id = devGrip ? devGrip.split(":")[1] : hitId(e);
  if (id) {
    if (e.shiftKey || e.ctrlKey) { sel.has(id) ? sel.delete(id) : sel.add(id); render(); return; }
    if (!sel.has(id)) { sel = new Set([id]); render(); }
    fdrag = { start: p, pre: snapshot(), orig: clone({ rooms: lv.rooms, places: lv.places, image: lv.image, shapes: lvShapes(lv) }), lv, moved: false, d: [0, 0], devGrip };
  } else {
    if (!e.shiftKey) { sel.clear(); render(); }
    fbox = { start: sp, cur: sp, select: true };
  }
}
function fpMove(pg, mx, my) {
  if (isSheet(pg)) { sheetMove(pg, mx, my); return; }
  const p = toPlan(pg, mx, my); const lv = levelOf(pg);
  $('#st-pos').textContent = `${fmtXY(pg, [fsnap(p[0]), fsnap(p[1])])}  |  Page ${pageName(pg)}`;
  if (gripOp) { gripMove(pg, lv, p); return; }
  if (mode.startsWith('d:') && !(fbox && fbox.select)) { drawMove(pg, lv, p); return; }
  if (mode === 'fpplace') { drawFpGhost(pg, mx, my); return; }
  if (mode === 'roompoly') {
    const r = fpPoint(pg, lv, p, { last: fpoly && fpoly[fpoly.length - 1], extra: fpoly || [] }); fAim = r.p;
    if (fpoly) drawPolyPrev(pg, r.p, r); else $('#overlay').innerHTML = fpMark(pg, r);
    return;
  }
  if (fdrag && fdrag.handle) { resizeRoom(pg, fdrag, p); return; }
  if (fdrag) {
    const d = [fsnap(p[0] - fdrag.start[0]), fsnap(p[1] - fdrag.start[1])];
    if (d[0] === fdrag.d[0] && d[1] === fdrag.d[1]) return;
    fdrag.d = d; fdrag.moved = true;
    const lv = fdrag.lv, o = clone(fdrag.orig);
    lv.rooms = o.rooms; lv.places = o.places; lv.image = o.image; lv.shapes = o.shapes;
    for (const pl of lv.places) if (sel.has(pl.id)) { pl.x += d[0]; pl.y += d[1]; }
    const moving = new Set(lv.rooms.filter(r => sel.has(r.id)).map(r => r.id));
    if (moving.size) {
      let cx = null, cy = null;
      for (const r of o.rooms) if (moving.has(r.id)) for (const q of r.pts) {
        const v = [q[0] + d[0], q[1] + d[1]]; const rs = roomSnap(pg, lv, v, moving); if (!rs.hit) continue;
        const ex = rs.p[0] - v[0], ey = rs.p[1] - v[1];
        if (ex && (cx === null || Math.abs(ex) < Math.abs(cx))) cx = ex;
        if (ey && (cy === null || Math.abs(ey) < Math.abs(cy))) cy = ey;
      }
      d[0] += cx || 0; d[1] += cy || 0;
    }
    for (const r of lv.rooms) if (sel.has(r.id)) r.pts = r.pts.map(q => [r2(q[0] + d[0]), r2(q[1] + d[1])]);
    if (lv.image && sel.has('img:' + lv.id)) { lv.image.x += d[0]; lv.image.y += d[1]; }
    const T = tMove(d); for (const sh of lv.shapes) if (sel.has(sh.id)) transformShape(sh, T);
    renderCanvas(); return;
  }
  if (fbox) {
    let mark = '';
    if (fbox.select) fbox.cur = [fsnap(p[0]), fsnap(p[1])];
    else {
      const r = fpPoint(pg, lv, p, { walls: mode !== 'area' }); fbox.cur = r.p; mark = fpMark(pg, r);
      if (mode === 'roomcirc') fbox.cur = squareFrom(fbox.start, fbox.cur);
    }
    fAim = fbox.cur; fpBoxOverlay(pg, mark); return;
  }
  if (BOX_MODES.includes(mode) || mode === 'roompoly') { const r = fpPoint(pg, lv, p, { walls: mode !== 'area' }); fAim = r.p; $('#overlay').innerHTML = fpMark(pg, r); }
}
// rubber band for boxes: room shapes, selection windows (solid, left to right) and crossings (dashed, right to left)
function fpBoxOverlay(pg, mark) {
  const lv = levelOf(pg), a = fbox.start, b = fbox.cur; const A = toSheet(pg, ...a), B = toSheet(pg, ...b);
  const x = Math.min(A[0], B[0]), y = Math.min(A[1], B[1]), w = Math.abs(B[0] - A[0]), h = Math.abs(B[1] - A[1]); const u = 1 / (view.s || 1);
  let s;
  if (fbox.select) s = `<rect class="selbox ${b[0] < a[0] ? 'cross' : 'win'}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  else {
    s = mode === 'roomoval' || mode === 'roomcirc' ? `<rect class="selbox" x="${x}" y="${y}" width="${w}" height="${h}" style="stroke-opacity:.35"/><ellipse class="selbox" cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"/>` : `<rect class="selbox" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    const W = formatLength(toRealMm(lv, Math.abs(b[0] - a[0]))), H = formatLength(toRealMm(lv, Math.abs(b[1] - a[1])));
    s += `<text class="rdout" x="${B[0] + 8 * u}" y="${B[1] - 8 * u}" font-size="${11 * u}" style="stroke-width:${2.5 * u}">${esc(mode === 'roomcirc' ? 'Ø ' + W : W + ' × ' + H)}</text>`;
  }
  $('#overlay').innerHTML = s + mark;
}
const squareFrom = (a, b) => { const s = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); return [a[0] + Math.sign(b[0] - a[0] || 1) * s, a[1] + Math.sign(b[1] - a[1] || 1) * s]; };
// does a polygon outline touch a rectangle [x0, y0, x1, y1]? (crossing selection)
function polyTouchesRect(pts, r) {
  const sides = [[[r[0], r[1]], [r[2], r[1]]], [[r[2], r[1]], [r[2], r[3]]], [[r[2], r[3]], [r[0], r[3]]], [[r[0], r[3]], [r[0], r[1]]]];
  for (const p of pts) if (p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3]) return true;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; for (const s of sides) if (segCross(a, b, s[0], s[1])) return true; }
  return false;
}
function fpUp(pg) {
  if (isSheet(pg)) { sheetUp(pg); return; }
  if (gripOp) { gripUp(pg); return; }
  if (fdrag && !fdrag.moved && fdrag.devGrip) { const k = fdrag.devGrip; fdrag = null; gripStart(pg, levelOf(pg), k); gripOp.pressed = false; return; }
  if (fdrag) {
    if (fdrag.moved) {
      const lv = fdrag.lv; for (const pl of lv.places) if (sel.has(pl.id) || fdrag.handle) autoRoom(lv, pl);
      pushUndo(fdrag.pre); markDirty(); render();
    }
    fdrag = null; return;
  }
  if (!fbox) return;
  const [a, b] = [fbox.start, fbox.cur]; const r = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  if (fbox.select) {
    const was = fbox; fbox = null; $('#overlay').innerHTML = '';
    const lv = levelOf(pg); const crossing = was.cur[0] < was.start[0];
    if (r[2] - r[0] > 1 || r[3] - r[1] > 1) {
      for (const pl of lv.places) {
        const dx = Math.max(r[0] - pl.x, 0, pl.x - r[2]), dy = Math.max(r[1] - pl.y, 0, pl.y - r[3]);
        if (crossing ? Math.hypot(dx, dy) <= 5.5 : !dx && !dy) sel.add(pl.id);
      }
      for (const rm of lv.rooms) {
        if (crossing) { if (polyTouchesRect(roomPoly(rm), r)) sel.add(rm.id); }
        else { const bb = bboxPts(rm.pts); if (bb[0] >= r[0] && bb[2] <= r[2] && bb[1] >= r[1] && bb[3] <= r[3]) sel.add(rm.id); }
      }
      for (const sh of lvShapes(lv)) if (selectable(sh) && shapeInRect(sh, r, crossing)) sel.add(sh.id);
    }
    render(); return;
  }
  // a click without dragging keeps the first corner, so the second corner can be clicked or typed
  if (!fbox.armed && (r[2] - r[0] < 4 || r[3] - r[1] < 4)) { fbox.armed = true; return; }
  fpFinishBox(pg);
}
function fpFinishBox(pg) {
  const was = fbox; fbox = null; $('#overlay').innerHTML = '';
  const [a, b] = [was.start, was.cur]; const r = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  if (r[2] - r[0] < 4 || r[3] - r[1] < 4) return;
  if (mode === 'area') { commit(() => { pg.area = r; }); setMode('select'); zoomFit(); return; }
  if (mode === 'room') addRoom(pg, rectPts(r));
  if (mode === 'roomoval') addRoom(pg, rectPts(r), 'ellipse');
  if (mode === 'roomcirc') addRoom(pg, rectPts(r), 'circle');
}
// drag a corner (neighbouring walls stay square) or a wall (moves both of its corners)
function resizeRoom(pg, fd, p) {
  const { kind, rm, i, orig } = fd.handle; const lv = fd.lv; const n = orig.length;
  const skip = new Set([rm.id]); const q = fpPoint(pg, lv, p, { skip }).p;
  const pts = clone(orig);
  if (kind === 'v') {
    const v = orig[i];
    for (const j of [(i - 1 + n) % n, (i + 1) % n]) { if (orig[j][0] === v[0]) pts[j][0] = q[0]; else if (orig[j][1] === v[1]) pts[j][1] = q[1]; }
    pts[i] = q;
  } else {
    const a = orig[i], b = orig[(i + 1) % n]; const j = (i + 1) % n;
    if (a[1] === b[1]) { pts[i][1] = q[1]; pts[j][1] = q[1]; }
    else if (a[0] === b[0]) { pts[i][0] = q[0]; pts[j][0] = q[0]; }
    else { const dx = q[0] - (a[0] + b[0]) / 2, dy = q[1] - (a[1] + b[1]) / 2; pts[i] = [r2(a[0] + dx), r2(a[1] + dy)]; pts[j] = [r2(b[0] + dx), r2(b[1] + dy)]; }
  }
  if (rm.shape === 'circle') {
    // round rooms stay round: the dragged wall or corner sets the size, the opposite side stays put
    const ob = bboxPts(orig); let [x0, y0, x1, y1] = bboxPts(pts);
    if (kind === 'v') { const an = orig[(i + 2) % 4]; const s = Math.max(Math.abs(q[0] - an[0]), Math.abs(q[1] - an[1])); const sx = Math.sign(q[0] - an[0]) || 1, sy = Math.sign(q[1] - an[1]) || 1; [x0, y0, x1, y1] = [Math.min(an[0], an[0] + sx * s), Math.min(an[1], an[1] + sy * s), Math.max(an[0], an[0] + sx * s), Math.max(an[1], an[1] + sy * s)]; }
    else if (orig[i][1] === orig[(i + 1) % n][1]) { const s = y1 - y0, cx = (ob[0] + ob[2]) / 2; x0 = cx - s / 2; x1 = cx + s / 2; }
    else { const s = x1 - x0, cy = (ob[1] + ob[3]) / 2; y0 = cy - s / 2; y1 = cy + s / 2; }
    pts.splice(0, 4, ...rectPts([x0, y0, x1, y1]));
  }
  const bb = bboxPts(pts); if (bb[2] - bb[0] < 2 || bb[3] - bb[1] < 2) return;
  rm.pts = pts.map(x => [r2(x[0]), r2(x[1])]); delete rm.auto; fd.moved = true; renderCanvas();
}
function addRoom(pg, pts, shape, onMade) {
  dialog('New room', [['name', 'Room name', '']], v => {
    if (!v.name) return false;
    const lv = levelOf(pg);
    commit(() => {
      const rm = { id: uid(), name: v.name, pts }; if (shape) rm.shape = shape; lv.rooms.push(rm); if (onMade) onMade(rm);
      for (const pl of lv.places) if (inPoly([pl.x, pl.y], roomPoly(rm))) autoRoom(lv, pl);
      sel = new Set([rm.id]);
    });
  });
}
function finishPoly(pg) {
  const pts = fpoly; fpoly = null; $('#overlay').innerHTML = '';
  if (pts && pts.length >= 3) addRoom(pg, pts);
}
function drawPolyPrev(pg, cur, r = {}) {
  if (!fpoly) return;
  const pts = fpoly.concat([cur]).map(q => toSheet(pg, ...q));
  const f = toSheet(pg, ...fpoly[0]);
  $('#overlay').innerHTML = `<path class="wprev" d="M${pts.map(q => q.join(',')).join('L')}"/><circle class="cpt" cx="${f[0]}" cy="${f[1]}" r="1.6"/>` + fpMark(pg, Object.assign({ p: cur }, r)) + trackOverlay(pg, fpoly[fpoly.length - 1], cur, r.tracked);
}
function drawFpGhost(pg, mx, my) {
  const sym = placeItemId ? (itemById(placeItemId) || {}).sym : placeSym; if (!sym) return;
  const lv = levelOf(pg); const p = toPlan(pg, mx, my); const t = fpXform(pg);
  const r = lv ? fpPoint(pg, lv, p, { walls: false }) : { p: [fsnap(p[0]), fsnap(p[1])] }; fAim = r.p;
  $('#overlay').innerHTML = `<g transform="translate(${t.tx},${t.ty}) scale(${t.s})">${fpPlaceSVG({ x: r.p[0], y: r.p[1], rot: placeRot }, { sym, tag: '' }, false, true)}</g>` + fpMark(pg, r);
}
function fpDelete() {
  const pg = page(); if (isSheet(pg)) { if ((pg.vps || []).some(v => sel.has(v.id))) commit(() => { pg.vps = pg.vps.filter(v => !sel.has(v.id)); sel.clear(); }); return; }
  const lv = levelOf(pg); if (!lv || !sel.size) return;
  commit(() => {
    const gone = lv.places.filter(pl => sel.has(pl.id)).map(pl => pl.item);
    lv.places = lv.places.filter(pl => !sel.has(pl.id));
    P.pool = P.pool.filter(it => !gone.includes(it.id));
    lv.rooms = lv.rooms.filter(r => !sel.has(r.id));
    const goneS = withHosted(lv, sel); lv.shapes = lvShapes(lv).filter(s => !goneS.has(s.id));
    if (lv.image && sel.has('img:' + lv.id)) { delete P.assets[lv.image.asset]; lv.image = null; }
    sel.clear();
  });
}
function fpRotate() {
  const lv = levelOf(page()); if (!lv) return;
  const pls = lv.places.filter(pl => sel.has(pl.id)); const shs = lvShapes(lv).filter(s => sel.has(s.id));
  if (!pls.length && !shs.length) return;
  commit(() => {
    pls.forEach(pl => pl.rot = ((pl.rot || 0) + 90) % 360);
    if (shs.length) { const b = bboxPts(shs.flatMap(s => { const x = shapeBox(s); return [[x[0], x[1]], [x[2], x[3]]]; })); const T = tRotate(rp(midPt([b[0], b[1]], [b[2], b[3]])), 90); shs.forEach(s => transformShape(s, T)); }
  });
}

// ---------- floor-plan pages, levels, images ----------
function addFloorPage() {
  const lvs = P.levels || [];
  const rooms = []; for (const lv of lvs) for (const r of lv.rooms) rooms.push([r.id, `${lv.name}: ${r.name}`]);
  const cur = isFloor(page()) ? page().level : (lvs[0] || {}).id;
  dialog('New floor plan page', [
    ['level', 'Level', cur || '__new', 'select', lvs.map(l => [l.id, l.name]).concat([['__new', 'New level...']])],
    ['newLevel', 'New level name', lvs.length ? '' : 'Main floor'],
    ['view', 'Shows', 'level', 'select', [['level', 'Whole level'], ...(rooms.length ? [['room', 'Single room']] : []), ['area', 'Custom area (drag a box)'], ['sheet', 'Several views (view sheet)']]],
    ...(rooms.length ? [['room', 'Room (single room view)', rooms[0][0], 'select', rooms]] : []),
    ['desc', 'Description', ''],
  ], v => {
    let lvId = v.level;
    if (v.view === 'room' && !v.room) v.view = 'level';
    if (v.view === 'room') {
      const owner = lvs.find(l => l.rooms.some(r => r.id === v.room));
      if (!owner) { alert('Draw a room first, then add a single-room page.'); return false; }
      lvId = owner.id;
    }
    if (lvId === '__new' && !v.newLevel) { alert('Enter a name for the new level.'); return false; }
    let np;
    commit(() => {
      if (lvId === '__new') { const lv = { id: uid(), name: v.newLevel, rooms: [], places: [], image: null, scale: defaultScale() }; P.levels.push(lv); lvId = lv.id; }
      const lv = P.levels.find(l => l.id === lvId);
      const num = Math.max(0, ...P.pages.filter(p => p.kind === 'floor' && p.level === lvId).map(p => parseInt(p.num, 10) || 0)) + 1;
      const rm = lv.rooms.find(r => r.id === v.room);
      const desc = v.desc || (v.view === 'room' && rm ? rm.name : v.view === 'area' ? lv.name + ' detail' : lv.name);
      np = newFloorPage(lvId, num, v.view === 'sheet' && !v.desc ? 'Views' : desc, v.view, v.view === 'room' ? { room: v.room } : v.view === 'sheet' ? { vps: [] } : {});
      P.pages.push(np); sortPages(); curId = np.id; sel.clear();
    });
    zoomFit();
    if (v.view === 'area') { setMode('area'); flash('Drag a box around the area this page should show'); }
    if (v.view === 'sheet') addView();
  });
}
function importImage() {
  const pg = page(); const lv = levelOf(pg); if (!lv) return;
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => {
    const f = i.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 2400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        const id = uid(); P.assets[id] = c.toDataURL('image/jpeg', 0.85);
        commit(() => {
          if (lv.image) delete P.assets[lv.image.asset];
          const aw = DA.x1 - DA.x0 - 8, ah = DA.y1 - DA.y0 - 8, r = Math.min(aw / c.width, ah / c.height);
          lv.image = { asset: id, x: DA.x0 + 4, y: DA.y0 + 4, w: r2(c.width * r), h: r2(c.height * r), opacity: 0.5, locked: false };
          sel = new Set(['img:' + lv.id]);
        });
        flash('Image imported. Drag it to line up, then lock it in the properties.');
      };
      img.onerror = () => alert('That file could not be read as an image. Use PNG or JPG (for a PDF, export the page as an image first).');
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  i.click();
}
function fitImage() {
  const lv = levelOf(page()); if (!lv || !lv.image) return;
  commit(() => { const im = lv.image; const aw = DA.x1 - DA.x0 - 8, ah = DA.y1 - DA.y0 - 8, r = Math.min(aw / im.w, ah / im.h); im.w = r2(im.w * r); im.h = r2(im.h * r); im.x = DA.x0 + 4; im.y = DA.y0 + 4; });
}
function removeImage() { const lv = levelOf(page()); if (lv && lv.image && confirm('Remove the background image?')) commit(() => { delete P.assets[lv.image.asset]; lv.image = null; }); }

// ---------- floor-plan properties ----------
function roomNames() { const s = new Set(); for (const lv of P.levels || []) for (const r of lv.rooms) s.add(r.name); for (const it of allItems()) if (it.loc && SYM[it.sym] && SYM[it.sym].res) s.add(it.loc); return [...s].sort(natCmp); }
function unplacedDevices() {
  const placed = new Set(); for (const lv of P.levels || []) for (const pl of lv.places) placed.add(pl.item);
  return [...allItems()].filter(it => SYM[it.sym] && SYM[it.sym].fp && !placed.has(it.id)).sort((a, b) => natCmp(a.tag, b.tag));
}
function roomRealInfo(lv, r) {
  const k = lvScale(lv), bb = bboxPts(r.pts);
  return `${formatLength((bb[2] - bb[0]) * k)} x ${formatLength((bb[3] - bb[1]) * k)}, ${formatArea(polyArea(roomPoly(r)) * k * k)}`;
}
function renderFloorProps(pg) {
  if (isSheet(pg)) { renderSheetProps(pg); return; }
  const el = $('#props'); const lv = levelOf(pg); const ids = [...sel];
  if (!lv) { el.innerHTML = '<div class="note">This page has no level.</div>'; return; }
  const ckRows = () => {
    const ck = allCircuits(); if (!ck.length) return '<div class="note">No circuits yet.</div>';
    return ck.map(fn => { const cp = P.pages.find(p => p.kind !== 'floor' && p.fn === fn); return `<div class="prow"><label>${esc(dispCkt(fn))}</label><span class="ckrow"><input type="color" data-k="ckt.${esc(fn)}" value="${circuitColor(fn)}"><span class="note">${esc(cp ? cp.desc : '')}</span></span></div>`; }).join('');
  };
  if (ids.length === 1) {
    const f = findFp(ids[0]);
    if (f && f.kind === 'place') {
      const it = itemById(f.pl.item); if (!it) { el.innerHTML = ''; return; }
      const onSchem = IX.pos.get(it.id) && IX.pos.get(it.id).pg;
      el.innerHTML = `<div class="ident">${esc(dispFull(it.fn, it.loc, it.tag))}</div><div class="sub">${esc(SYM[it.sym].name)}${onSchem ? '' : ' (floor plan only, not on a schematic yet)'}</div>
        <div class="pgrp"><h4>Device</h4>${row('fpi.tag', L('tag'), it.tag)}${row('fpi.fn', L('fn'), it.fn, 'text', 'list="dl-ckt"')}<datalist id="dl-ckt">${allCircuits().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        ${row('fpi.loc', L('loc'), it.loc, 'text', 'list="dl-room"')}<datalist id="dl-room">${roomNames().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <div class="note">The room fills in automatically from where the device sits on the floor plan.</div>
        ${row('fpi.desc', L('desc'), it.desc || '', 'textarea')}${row('fpi.part', 'Part number', it.part || '', 'text', 'list="dl-parts"')}${partDatalist()}${partInfoHTML(it.part)}${hasLoad(SYM[it.sym]) ? row('fpi.va', 'Load (VA)', it.va ?? '', 'text', `placeholder="${deviceLoad(Object.assign({}, it, { va: '' }))} (default)"`) : ''}</div>
        ${it.fn ? `<div class="pgrp"><h4>Circuit color</h4><div class="prow"><label>${esc(dispCkt(it.fn))}</label><input type="color" data-k="ckt.${esc(it.fn)}" value="${circuitColor(it.fn)}"></div></div>` : ''}
        ${todoPanelHTML(it.id)}
        <div class="btnrow">${onSchem ? `<button class="btn" data-goto="${it.id}">Show on schematic</button>` : `<button class="btn primary" data-act="placeOnSchematic">Place on schematic</button>`}<button class="btn" data-act="rotateSel">Rotate (R)</button><button class="btn" data-act="delSel">Remove from floor plan</button></div>`;
      return;
    }
    if (f && f.kind === 'room') {
      const n = lv.places.filter(pl => inPoly([pl.x, pl.y], roomPoly(f.r))).length;
      el.innerHTML = `<div class="ident">${esc(f.r.name)}</div><div class="sub">Room, ${n} device(s), ${esc(roomRealInfo(lv, f.r))}</div><div class="pgrp"><h4>Room</h4>${row('room.name', 'Name', f.r.name)}${f.r.pts.length === 4 ? row('room.shape', 'Shape', '', 'select', [['', 'Rectangle'], ['ellipse', 'Oval'], ['circle', 'Round']].map(([k, l]) => `<option value="${k}" ${(f.r.shape || '') === k ? 'selected' : ''}>${l}</option>`).join('')) : ''}<div class="note">Drag a corner or the square on a wall to resize the room. Renaming a room updates the room of every device in it.</div></div><div class="btnrow"><button class="btn" data-act="delSel">Delete room</button></div>`;
      return;
    }
  }
  const shs = lvShapes(lv).filter(s => sel.has(s.id));
  if (shs.length && shs.length === ids.length) { el.innerHTML = shapePropsHTML(pg, lv, shs); return; }
  if (ids.length > 1) { el.innerHTML = `<div class="ident">${ids.length} objects selected</div><div class="btnrow"><button class="btn" data-act="rotateSel">Rotate (R)</button><button class="btn" data-act="delSel">Delete</button></div>`; return; }
  const im = lv.image;
  const un = unplacedDevices();
  el.innerHTML = `<div class="ident">${esc(pageName(pg))}</div><div class="sub">${esc(pg.desc)} · ${esc(fpViewName(pg))}</div>
    <div class="pgrp"><h4>Page</h4>${row('fpg.desc', 'Description', pg.desc)}${row('lv.name', 'Level name', lv.name)}${row('lv.scale', 'Drawing scale', formatScale(lvScale(lv)), 'text', 'list="dl-scale"')}<datalist id="dl-scale">${scaleOptions(unitsOf()).map(o => `<option value="${esc(o[0])}">`).join('')}</datalist>${pg.view === 'area' ? '<div class="btnrow"><button class="btn small" data-act="setArea">Redraw area</button></div>' : ''}</div>
    <div class="pgrp"><h4>Background image</h4>${im ? `${row('img.opacity', 'Opacity', Math.round((im.opacity ?? 0.5) * 100), 'number', 'min="5" max="100" step="5"')}${row('img.w', 'Width (mm)', im.w, 'number', 'step="1"')}
      <div class="prow"><label>Locked</label><input type="checkbox" data-k="img.locked" ${im.locked ? 'checked' : ''} style="width:auto"></div>
      <div class="btnrow"><button class="btn small" data-act="importImage">Replace</button><button class="btn small" data-act="fitImage">Fit to page</button><button class="btn small" data-act="removeImage">Remove</button></div>`
      : '<div class="note">Import a photo or scan of your floor plan (PNG or JPG) and trace rooms over it.</div><div class="btnrow"><button class="btn small" data-act="importImage">Import image...</button></div>'}</div>
    <div class="pgrp"><h4>Rooms</h4><div class="note">${lv.rooms.length} room(s). Use Room (box) or Room (shape) in the toolbar to draw.</div></div>
    <div class="pgrp"><h4>Circuit colors</h4>${ckRows()}</div>
    <div class="pgrp"><h4>Not on a floor plan yet</h4><div class="fnlist">${un.length ? un.map(it => `<div data-fpplace="${it.id}"><span>${esc(dispFull(it.fn, it.loc, it.tag))}</span><span class="r">place</span></div>`).join('') : '<span class="note">Every device is placed.</span>'}</div></div>`;
}
function fpPropChange(scope, key, v) {
  const pg = page(); const lv = levelOf(pg);
  if (scope === 'shp') { const list = lvShapes(lv).filter(s => sel.has(s.id)); if (list.length) commit(() => { for (const s of list) applyShapeProp(pg, lv, s, key, v); }); return true; }
  if (scope === 'vp') { vpPropChange(pg, key, v); return true; }
  if (scope === 'fpg') { commit(() => { pg[key] = v; }, { props: false }); return true; }
  if (scope === 'lv' && lv && key === 'scale') { const r = parseScale(v); if (!r) { flash('Could not read that scale. Try 1/4 in = 1 ft or 1:50'); renderProps(); return true; } setLevelScale(lv, r); return true; }
  if (scope === 'lv' && lv) { commit(() => { lv[key] = v; }, { props: false }); return true; }
  if (scope === 'img' && lv && lv.image) {
    commit(() => {
      const im = lv.image;
      if (key === 'opacity') im.opacity = Math.max(0.05, Math.min(1, (parseFloat(v) || 50) / 100));
      else if (key === 'w') { const w = Math.max(10, parseFloat(v) || im.w); im.h = r2(im.h * w / im.w); im.w = w; }
      else if (key === 'locked') { im.locked = !!v; if (im.locked) sel.delete('img:' + lv.id); }
    });
    return true;
  }
  if (scope === 'ckt') { commit(() => { P.circuits[key] = Object.assign(P.circuits[key] || {}, { color: v }); }, { props: false }); return true; }
  if (scope === 'room') {
    const f = findFp([...sel][0]); if (!f || f.kind !== 'room') return true;
    if (key === 'shape') { commit(() => { const b = bboxPts(f.r.pts); f.r.pts = rectPts(b); if (v === 'circle') { const s = Math.max(b[2] - b[0], b[3] - b[1]); f.r.pts = rectPts([b[0], b[1], b[0] + s, b[1] + s]); } if (v) f.r.shape = v; else delete f.r.shape; for (const pl of f.lv.places) autoRoom(f.lv, pl); }); return true; }
    commit(() => { const old = f.r.name; for (const it of allItems()) if (it.loc === old) it.loc = v; f.r.name = v; });
    return true;
  }
  if (scope === 'fpi') {
    const f = findFp([...sel][0]); if (!f || f.kind !== 'place') return true;
    const it = itemById(f.pl.item); if (it) commit(() => applyItemChange(it, key, v));
    return true;
  }
  return false;
}
function placeOnSchematic() {
  const f = findFp([...sel][0]); if (!f || f.kind !== 'place') return;
  const it = itemById(f.pl.item); if (!it) return;
  const target = P.pages.find(p => !p.kind && it.fn && p.fn === it.fn) || P.pages.find(p => p.id === lastSchemId && !p.kind) || P.pages.find(p => !p.kind);
  if (!target) { flash('Add a schematic page first'); return; }
  goPage(target.id); placeRot = 0; setMode('place', it.sym, it.id);
  flash('Click on the schematic to place ' + dispTag(it.tag));
}
function placeOnFloor() {
  const f = findItem([...sel][0]); if (!f || !f.it) return;
  const fp = (isFloor(page()) ? page() : null) || P.pages.find(p => p.kind === 'floor');
  if (!fp) { flash('Add a floor plan page first (Page > New floor plan page)'); return; }
  const id = f.it.id; goPage(fp.id); placeRot = 0; setMode('fpplace', null, id);
  flash('Click on the floor plan to place ' + dispTag(f.it.tag));
}
function showOnFloor(itemId) {
  const p = placeOf(itemId); if (!p) return;
  const pg = (isFloor(page()) && page().level === p.lv.id ? page() : null) || P.pages.find(x => x.kind === 'floor' && x.level === p.lv.id && x.view === 'level') || P.pages.find(x => x.kind === 'floor' && x.level === p.lv.id);
  if (!pg) return;
  curId = pg.id; sel = new Set([p.pl.id]); render(); const s = toSheet(pg, p.pl.x, p.pl.y); centerOn(s[0], s[1]);
}
function showShape(lv, s) {
  const pg = (isFloor(page()) && page().level === lv.id && page().view !== 'sheet' ? page() : null) || P.pages.find(x => x.kind === 'floor' && x.level === lv.id && x.view === 'level') || P.pages.find(x => x.kind === 'floor' && x.level === lv.id);
  if (!pg) return;
  curId = pg.id; sel = new Set([s.id]); render(); const b = shapeBox(s); const c = toSheet(pg, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2); centerOn(c[0], c[1]);
}
