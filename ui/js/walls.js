// ---------- walls, doors, windows and openings ----------
// A wall is a shape { t: 'wall', a, b, th, just, h, kind }: a reference line from a to b, a thickness th (plan units),
// the side the reference line is on (just: 'c' center, 'l' left face, 'r' right face, looking from a to b), a height
// (real mm, for elevations later) and the preset it came from. Walls that meet at their ends are mitered; walls that
// meet another wall's side form a clean tee, because all wall outlines are drawn first and all fills on top.
// Doors, windows and cased openings are shapes { t: 'opening', wall, c, w, kind, style, hinge, side, tag, h, sill }
// hosted on a wall: c is the center point (projected onto the wall), w the width, side the swing side (1 = left).
const WALL_PRESETS = [
  ['2x4 interior', 4.5 * IN_MM], ['2x6 exterior', 6.5 * IN_MM],
  ['Mobile home 2x3 interior', 3.5 * IN_MM], ['Mobile home 2x4 exterior', 4.5 * IN_MM],
];
const WALL_H = 96 * IN_MM;
const DOOR_STYLES = [['single', 'Single swing'], ['double', 'Double swing'], ['pocket', 'Pocket'], ['bifold', 'Bifold'], ['sliding', 'Sliding'], ['garage', 'Garage (overhead)']];
const DOOR_W = { single: 36, double: 60, pocket: 30, bifold: 48, sliding: 72, garage: 192 };
const OPEN_NAMES = { door: 'Door', window: 'Window', opening: 'Cased opening' };
const wallSettings = () => Object.assign({ preset: '2x4 interior', th: 4.5 * IN_MM, just: 'c', h: WALL_H }, PREFS.wall || {});
const JUST_NAMES = { c: 'Center', l: 'Left face', r: 'Right face' };
const isWall = s => s && s.t === 'wall';
const lvWalls = lv => lvShapes(lv).filter(isWall);
const wallById = (lv, id) => lvShapes(lv).find(s => s.id === id && s.t === 'wall');
function wallOfOpening(o) { for (const lv of P.levels || []) { const w = wallById(lv, o.wall); if (w) return w; } return null; }

// ---------- wall geometry ----------
function wallAxis(w) {
  const len = ptDist(w.a, w.b) || 1e-9, ang = ptAngle(w.a, w.b);
  const u = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len], n = [Math.cos((ang + 90) * D2R), -Math.sin((ang + 90) * D2R)];
  const off = w.just === 'l' ? [0, -w.th] : w.just === 'r' ? [w.th, 0] : [w.th / 2, -w.th / 2];
  return { len, ang, u, n, L: off[0], R: off[1] };
}
const axPt = (w, ax, s, off) => [w.a[0] + ax.u[0] * s + ax.n[0] * off, w.a[1] + ax.u[1] * s + ax.n[1] * off];
function wallPoly(w) { const ax = wallAxis(w); return [axPt(w, ax, 0, ax.L), axPt(w, ax, ax.len, ax.L), axPt(w, ax, ax.len, ax.R), axPt(w, ax, 0, ax.R)]; }
// mitered corners: { L0, R0, L1, R1 } per wall id
function wallCorners(lv) {
  const walls = lvWalls(lv), out = new Map();
  for (const w of walls) { const p = wallPoly(w); out.set(w.id, { L0: p[0], L1: p[1], R1: p[2], R0: p[3] }); }
  const faces = (w, rev) => { const ax = wallAxis(w); const L = [axPt(w, ax, 0, ax.L), axPt(w, ax, ax.len, ax.L)], R = [axPt(w, ax, 0, ax.R), axPt(w, ax, ax.len, ax.R)]; return rev ? { L: R, R: L } : { L, R }; };
  const near = (p, q) => ptDist(p, q) < 0.05;
  for (const w of walls) for (const end of ['a', 'b']) {
    const E = w[end]; const others = walls.filter(v => v !== w && (near(v.a, E) || near(v.b, E)));
    if (others.length !== 1) continue;
    const v = others[0];
    // orient w into E and v out of E (when w starts at E, flip the pair so the faces match up)
    const wIn = end === 'b'; const vOut = near(v.a, E);
    const fw = faces(w, false), fv = faces(v, wIn ? !vOut : vOut);
    const XL = lineLineX(fw.L[0], fw.L[1], fv.L[0], fv.L[1]), XR = lineLineX(fw.R[0], fw.R[1], fv.R[0], fv.R[1]);
    const lim = 6 * Math.max(w.th, v.th);
    if (!XL || !XR || ptDist(XL, E) > lim || ptDist(XR, E) > lim) continue;
    const c = out.get(w.id); if (end === 'b') { c.L1 = XL; c.R1 = XR; } else { c.L0 = XL; c.R0 = XR; }
  }
  return out;
}
const openingsOf = (lv, w) => lvShapes(lv).filter(s => s.t === 'opening' && s.wall === w.id);
function openingAt(o, w) { const ax = wallAxis(w); const s = (o.c[0] - w.a[0]) * ax.u[0] + (o.c[1] - w.a[1]) * ax.u[1]; return Math.max(o.w / 2, Math.min(ax.len - o.w / 2, s)); }
// polygons of a wall with the openings cut out
function wallPieces(lv, w, cr) {
  const ax = wallAxis(w); const gaps = openingsOf(lv, w).map(o => { const s = openingAt(o, w); return [s - o.w / 2, s + o.w / 2]; }).sort((a, b) => a[0] - b[0]);
  const runs = []; let s = 0;
  for (const [g0, g1] of gaps) { if (g0 > s + 1e-6) runs.push([s, g0]); s = Math.max(s, g1); }
  if (s < ax.len - 1e-6) runs.push([s, ax.len]);
  return runs.map(([s0, s1]) => {
    const L0 = s0 < 1e-6 ? cr.L0 : axPt(w, ax, s0, ax.L), R0 = s0 < 1e-6 ? cr.R0 : axPt(w, ax, s0, ax.R);
    const L1 = s1 > ax.len - 1e-6 ? cr.L1 : axPt(w, ax, s1, ax.L), R1 = s1 > ax.len - 1e-6 ? cr.R1 : axPt(w, ax, s1, ax.R);
    return [L0, L1, R1, R0];
  });
}
const polyAttr = p => p.map(q => r2(q[0]) + ',' + r2(q[1])).join(' ');

// ---------- door, window and opening symbols ----------
function openingGeom(o, w) {
  const ax = wallAxis(w), at = openingAt(o, w), s0 = at - o.w / 2, s1 = at + o.w / 2;
  const side = o.side >= 0 ? 1 : -1, f = side > 0 ? ax.L : ax.R, back = side > 0 ? ax.R : ax.L, mid = (ax.L + ax.R) / 2;
  return { ax, at, s0, s1, side, f, back, mid, P: (s, off) => axPt(w, ax, s, off), out: (p, d) => [p[0] + ax.n[0] * side * d, p[1] + ax.n[1] * side * d] };
}
function swingArc(H, J, E, r) { const m = unit([(J[0] - H[0]) + (E[0] - H[0]), (J[1] - H[1]) + (E[1] - H[1])]); return arc3(J, [H[0] + m[0] * r, H[1] + m[1] * r], E); }
function openingSVG(o, w, t, col, ghost) {
  const g = openingGeom(o, w), P2 = p => `${r2(p[0])},${r2(p[1])}`, sw = r2(0.25 / t * 1000) / 1000, thin = `stroke="${col}" stroke-width="${sw}" fill="none"`;
  const dsh = ` stroke-dasharray="${r2(1.2 / t)},${r2(0.8 / t)}"`;
  let s = '';
  const leaf = (sh, so, len) => {
    const H = g.P(sh, g.f), J = g.P(so, g.f), E = g.out(H, len); const a = swingArc(H, J, E, len);
    return `<path d="M${P2(H)}L${P2(E)}" stroke="${col}" stroke-width="${r2(sw * 2)}" fill="none"/>` + (a ? `<path d="${shapeD(a)}" ${thin}/>` : '');
  };
  if (o.kind === 'window') {
    s += `<path d="M${P2(g.P(g.s0, g.ax.L))}L${P2(g.P(g.s1, g.ax.L))}M${P2(g.P(g.s0, g.ax.R))}L${P2(g.P(g.s1, g.ax.R))}" ${thin}/>`;
    const d = Math.abs(g.ax.L - g.ax.R) * 0.12;
    s += `<path d="M${P2(g.P(g.s0, g.mid + d))}L${P2(g.P(g.s1, g.mid + d))}M${P2(g.P(g.s0, g.mid - d))}L${P2(g.P(g.s1, g.mid - d))}" ${thin}/>`;
  } else if (o.kind === 'opening') {
    s += `<path d="M${P2(g.P(g.s0, g.ax.L))}L${P2(g.P(g.s1, g.ax.L))}M${P2(g.P(g.s0, g.ax.R))}L${P2(g.P(g.s1, g.ax.R))}" ${thin}${dsh}/>`;
  } else {
    const st = o.style || 'single'; const hA = (o.hinge || 'a') === 'a';
    if (st === 'single') s += hA ? leaf(g.s0, g.s1, o.w) : leaf(g.s1, g.s0, o.w);
    else if (st === 'double') s += leaf(g.s0, g.at, o.w / 2) + leaf(g.s1, g.at, o.w / 2);
    else if (st === 'pocket') {
      const dir = hA ? -1 : 1, from = hA ? g.s0 : g.s1;
      s += `<path d="M${P2(g.P(from, g.mid))}L${P2(g.P(from + dir * o.w, g.mid))}" stroke="${col}" stroke-width="${r2(sw * 2)}"${dsh} fill="none"/>`;
      s += `<path d="M${P2(g.P(from, g.ax.L))}L${P2(g.P(from + dir * o.w, g.ax.L))}M${P2(g.P(from, g.ax.R))}L${P2(g.P(from + dir * o.w, g.ax.R))}" ${thin}${dsh}/>`;
    } else if (st === 'bifold') {
      const d = o.w / 5, q = o.w / 4;
      s += `<path d="M${P2(g.P(g.s0, g.f))}L${P2(g.out(g.P(g.s0 + q, g.f), d))}L${P2(g.P(g.at, g.f))}L${P2(g.out(g.P(g.s1 - q, g.f), d))}L${P2(g.P(g.s1, g.f))}" stroke="${col}" stroke-width="${r2(sw * 1.6)}" fill="none"/>`;
    } else if (st === 'sliding') {
      const e = Math.abs(g.ax.L - g.ax.R) * 0.18, ov = o.w * 0.04;
      s += `<path d="M${P2(g.P(g.s0, g.mid + e))}L${P2(g.P(g.at + ov, g.mid + e))}M${P2(g.P(g.at - ov, g.mid - e))}L${P2(g.P(g.s1, g.mid - e))}" stroke="${col}" stroke-width="${r2(sw * 2)}" fill="none"/>`;
      s += `<path d="M${P2(g.P(g.s0, g.ax.L))}L${P2(g.P(g.s1, g.ax.L))}M${P2(g.P(g.s0, g.ax.R))}L${P2(g.P(g.s1, g.ax.R))}" ${thin}/>`;
    } else if (st === 'garage') {
      const dep = Math.min(o.w * 0.75, toPlanMmGuess(w, 96 * IN_MM));
      const A = g.P(g.s0, g.f), B = g.P(g.s1, g.f), C = g.out(B, dep), D = g.out(A, dep);
      s += `<path d="M${P2(g.P(g.s0, g.mid))}L${P2(g.P(g.s1, g.mid))}" stroke="${col}" stroke-width="${r2(sw * 2)}" fill="none"/>`;
      s += `<path d="M${P2(A)}L${P2(D)}L${P2(C)}L${P2(B)}" ${thin}${dsh}/>`;
    }
  }
  return s;
}
// plan size of a real length on the wall's level
function toPlanMmGuess(w, mm) { for (const lv of P.levels || []) if (lvShapes(lv).includes(w)) return toPlanMm(lv, mm); return mm / 48; }
function openingTagSVG(o, w, t, col) {
  if (!o.tag || o.showTag === false || o.kind === 'opening') return '';
  const g = openingGeom(o, w); const r = 2.3 / t, gap = Math.abs(g.ax.L - g.ax.R) / 2 + r + 1.2 / t;
  const c = [w.a[0] + g.ax.u[0] * g.at + g.ax.n[0] * ((g.ax.L + g.ax.R) / 2 - g.side * gap), w.a[1] + g.ax.u[1] * g.at + g.ax.n[1] * ((g.ax.L + g.ax.R) / 2 - g.side * gap)];
  const sw = r2(0.2 / t * 1000) / 1000, fs = r2(1.9 / t * 100) / 100;
  const shape = o.kind === 'window' ? `<polygon points="${polyAttr(Array.from({ length: 6 }, (_, i) => polarPt(c, r * 1.05, 30 + i * 60)))}" fill="#fff" stroke="${col}" stroke-width="${sw}"/>` : `<circle cx="${r2(c[0])}" cy="${r2(c[1])}" r="${r2(r)}" fill="#fff" stroke="${col}" stroke-width="${sw}"/>`;
  return `<g class="otag">${shape}<text x="${r2(c[0])}" y="${r2(c[1] + fs * 0.36)}" font-size="${fs}" text-anchor="middle" fill="${col}" font-family="Arial, sans-serif">${esc(o.tag)}</text></g>`;
}
function openingPoly(o, w) { const g = openingGeom(o, w); return [g.P(g.s0, g.ax.L), g.P(g.s1, g.ax.L), g.P(g.s1, g.ax.R), g.P(g.s0, g.ax.R)]; }

// ---------- drawing all walls of a level ----------
function wallsSVG(lv, t, o = {}) {
  const walls = lvWalls(lv).filter(w => objShown(w, o)); if (!walls.length) return '';
  const cr = wallCorners(lv); const ink = sheetDark() ? '#d0d4da' : '#1d1d1d';
  let st = '', fl = '', hit = '', ops = '', tags = '', hl = '';
  for (const w of walls) {
    const sw = r2(((w.lw ? +w.lw : 0.5) / t) * 2 * 1000) / 1000; const fill = w.fill || (sheetDark() ? '#4a5260' : '#c9ced5');
    const pieces = wallPieces(lv, w, cr.get(w.id));
    for (const p of pieces) { st += `<polygon points="${polyAttr(p)}" fill="none" stroke="${w.color || ink}" stroke-width="${sw}" stroke-linejoin="miter"/>`; fl += `<polygon points="${polyAttr(p)}" fill="${fill}" stroke="${fill}" stroke-width="${r2(sw * 0.12 * 1000) / 1000}" stroke-linejoin="miter"/>`; }
    const c = cr.get(w.id); const full = [c.L0, c.L1, c.R1, c.R0];
    if (!o.print && !o.vp && !objLocked(w)) hit += `<polygon class="hit" data-id="${w.id}" points="${polyAttr(full)}"/>`;
    if (!o.print && !o.vp && sel.has(w.id)) hl += `<polygon points="${polyAttr(full)}" fill="rgba(31,111,255,.12)" stroke="var(--sel)" stroke-width="${r2(0.35 / t * 1000) / 1000}" stroke-dasharray="${r2(1.5 / t)},${r2(1 / t)}"/>`;
    for (const op of openingsOf(lv, w)) {
      const isSel = !o.print && !o.vp && sel.has(op.id); const col = isSel ? 'var(--sel)' : ink;
      ops += `<g data-id="${op.id}" class="opening${isSel ? ' osel' : ''}"><polygon class="hit" points="${polyAttr(openingPoly(op, w))}"/>${openingSVG(op, w, t, col)}</g>`;
      tags += openingTagSVG(op, w, t, isSel ? 'var(--sel)' : ink);
    }
  }
  return `<g class="walls"><g>${st}</g><g>${fl}</g>${hl}<g>${hit}</g>${ops}${tags}</g>`;
}

// ---------- making walls and openings ----------
function makeWall(lv, a, b, ws) { ws = ws || wallSettings(); return { t: 'wall', a, b, th: r2(toPlanMm(lv, ws.th) * 1000) / 1000, just: ws.just || 'c', h: ws.h || WALL_H, kind: ws.preset || 'Custom' }; }
function nextOpeningTag(kind) {
  if (kind === 'opening') return '';
  const pre = kind === 'window' ? 'W' : 'D'; let n = 0;
  for (const lv of P.levels || []) for (const s of lvShapes(lv)) if (s.t === 'opening' && s.tag) { const m = new RegExp('^' + pre + '(\\d+)$').exec(s.tag); if (m) n = Math.max(n, +m[1]); }
  return pre + (n + 1);
}
function wallSettingsDlg(after) {
  const ws = wallSettings(); const u = unitsOf();
  const presets = WALL_PRESETS.map(([n, th]) => [n, `${n} (${formatLength(th, u)})`]).concat([['Custom', 'Custom thickness']]);
  dialog('Wall settings', [['preset', 'Wall type', WALL_PRESETS.some(p => p[0] === ws.preset) ? ws.preset : 'Custom', 'select', presets], ['th', 'Custom thickness', formatLength(ws.th, u)],
    ['just', 'Reference line', ws.just, 'select', [['c', 'Center of the wall'], ['l', 'Left face (wall to the right)'], ['r', 'Right face (wall to the left)']]], ['h', 'Wall height', formatLength(ws.h, u)]], v => {
    const pr = WALL_PRESETS.find(p => p[0] === v.preset); const th = pr ? pr[1] : parseLength(v.th); const h = parseLength(v.h);
    if (!(th > 0)) { alert('Could not read the thickness.'); return false; }
    PREFS.wall = { preset: pr ? pr[0] : 'Custom', th, just: v.just, h: h > 0 ? h : WALL_H }; savePrefs(); renderStatus(); if (after) after();
  }, 'OK', '<div class="note">Looking along the wall from its start, the reference line is what you click: the middle of the wall, or one face. The height is kept for elevations.</div>');
}
const wallLabel = () => { const ws = wallSettings(); return `${ws.preset === 'Custom' ? formatLength(ws.th) : ws.preset}, ${JUST_NAMES[ws.just].toLowerCase()}`; };
drawTool('wall', {
  name: 'Wall', keepOnEsc: true,
  prompt: D => (D.pts.length ? 'Specify next point [Settings/Justify/Close/Undo]' : 'Specify start point [Settings/Justify]') + ` (${wallLabel()}):`,
  point(D, q, c) { const l = drawLast(D); if (l && ptDist(l, q) < 0.01) return; if (l) commitShape(c, makeWall(c.lv, l, q)); D.pts.push(q); },
  ghost: (D, q, c) => D.pts.length ? [makeWall(c.lv, drawLast(D), q)] : [],
  opt(D, w, c) {
    if (w === 'S' || w === 'SETTINGS') { wallSettingsDlg(() => drawRefresh()); return true; }
    if (w === 'J' || w === 'JUSTIFY') { const ws = wallSettings(); ws.just = { c: 'l', l: 'r', r: 'c' }[ws.just] || 'c'; PREFS.wall = ws; savePrefs(); flash('Reference line: ' + JUST_NAMES[ws.just]); return true; }
    if (w === 'C' || w === 'CLOSE') { if (D.pts.length >= 3) { commitShape(c, makeWall(c.lv, drawLast(D), D.pts[0])); drawRestart(D); } else flash('Close needs at least two walls'); return true; }
    if (w === 'U' || w === 'UNDO') { if (D.pts.length > 1) { undo(); D.pts.pop(); } else D.pts = []; return true; }
    return false;
  },
  enter(D) { drawRestart(D); },
});
// nearest wall to a point (within a few pixels or inside the wall)
function wallNear(pg, lv, p) {
  const tol = 10 / ((view.s || 1) * fpXform(pg).s); let best = null;
  for (const w of lvWalls(lv)) { if (!selectable(w)) continue; const r = distPtSeg(p, w.a, w.b); const lim = w.th + tol; if (r.d <= lim && (!best || r.d < best.d)) best = { w, d: r.d, q: r.q }; }
  return best;
}
function openingDefaults(kind, style) {
  const k = kind === 'door' ? 'door_' + style : kind; const saved = (PREFS.openW || {})[k];
  return { w: saved || (kind === 'window' ? 36 * IN_MM : kind === 'opening' ? 36 * IN_MM : DOOR_W[style] * IN_MM), h: kind === 'window' ? 48 * IN_MM : style === 'garage' ? 84 * IN_MM : 80 * IN_MM, sill: kind === 'window' ? 36 * IN_MM : 0 };
}
function newOpening(lv, near, kind, style, raw) {
  const d = openingDefaults(kind, style); const w = near.w; const ax = wallAxis(w);
  const side = ((raw[0] - near.q[0]) * ax.n[0] + (raw[1] - near.q[1]) * ax.n[1]) >= 0 ? 1 : -1;
  const ow = Math.min(toPlanMm(lv, d.w), ax.len); const o = { t: 'opening', wall: w.id, c: rp(near.q), w: r2(ow * 1000) / 1000, kind, side, hinge: 'a', h: d.h };
  if (kind === 'door') o.style = style; if (kind === 'window') o.sill = d.sill;
  return o;
}
function openingTool(kind, style) {
  return {
    name: kind === 'door' ? (DOOR_STYLES.find(s => s[0] === style) || [0, 'Door'])[1] + ' door' : OPEN_NAMES[kind],
    init(D) { D.kind = kind; D.style = style || D.sub || 'single'; if (kind === 'door' && D.sub) D.style = D.sub; },
    prompt: (D, c) => `Click a wall to place it (the side you click is the swing side) [Width] (${formatLength(openingDefaults(D.kind, D.style).w)}):`,
    stageWidth: false,
    point(D, q, c) {
      if (D.stage === 'w') return;
      const near = wallNear(c.pg, c.lv, c.raw || q); if (!near) { flash('Click on a wall'); return; }
      const o = newOpening(c.lv, near, D.kind, D.style, c.raw || q); o.tag = nextOpeningTag(D.kind);
      commitShape(c, o);
    },
    opt(D, w) { if (w === 'W' || w === 'WIDTH') { D.stage = 'w'; D.want = 'dist'; return true; } return false; },
    dist(D, v, c) { if (D.stage !== 'w') return; const k = D.kind === 'door' ? 'door_' + D.style : D.kind; PREFS.openW = Object.assign({}, PREFS.openW, { [k]: toRealMm(c.lv, v) }); savePrefs(); D.stage = 0; D.want = 'point'; },
    enter(D) { if (D.stage === 'w') { D.stage = 0; D.want = 'point'; return; } drawExit(); },
    ghost(D, q, c) {
      if (D.stage === 'w') return []; const near = wallNear(c.pg, c.lv, c.raw || q); if (!near) return [];
      const o = newOpening(c.lv, near, D.kind, D.style, c.raw || q); return [{ t: 'opghost', o, w: near.w }];
    },
  };
}
drawTool('door', openingTool('door', 'single'));
drawTool('window', openingTool('window'));
drawTool('opening', openingTool('opening'));

// openings follow their wall when it is trimmed or split: each one moves to the piece it sits on, or goes away
function rehostOpenings(lv, old, made) {
  for (const o of lvShapes(lv).filter(s => s.t === 'opening' && s.wall === old.id)) {
    const host = made.filter(isWall).find(w => { const r = distPtSeg(o.c, w.a, w.b); const ax = wallAxis(w); const s = (o.c[0] - w.a[0]) * ax.u[0] + (o.c[1] - w.a[1]) * ax.u[1]; return r.d < w.th + 0.01 && s > -0.01 && s < ax.len + 0.01; });
    if (host) o.wall = host.id; else lv.shapes = lv.shapes.filter(s => s !== o);
  }
}
// ids plus the openings hosted on the walls among them
function withHosted(lv, ids) { const out = new Set(ids); for (const s of lvShapes(lv)) if (s.t === 'opening' && out.has(s.wall)) out.add(s.id); return out; }

// ---------- rooms from walls: find the enclosed area around a point ----------
function boundaryEdges(lv, o = {}) {
  const segs = []; const cr = wallCorners(lv);
  for (const w of lvWalls(lv)) { const c = cr.get(w.id); const p = [c.L0, c.L1, c.R1, c.R0]; for (let i = 0; i < 4; i++) segs.push([p[i], p[(i + 1) % 4]]); }
  for (const s of lvShapes(lv)) {
    if (s.t === 'wall' || s.t === 'opening' || s.t === 'text' || s.t === 'insert' || s.t === 'dim' || s.t === 'leader' || s.t === 'hatch' || (o.skip && o.skip.has(s.id)) || !objShown(s)) continue;
    const ol = typeof shapeOutlineFull === 'function' ? shapeOutlineFull(s) : shapeOutline(s); segs.push(...outlineSegs(ol));
  }
  if (o.rooms) for (const r of lv.rooms) { const p = roomPoly(r); for (let i = 0; i < p.length; i++) segs.push([p[i], p[(i + 1) % p.length]]); }
  return segs;
}
// the smallest closed loop of edges around p (plan coordinates), or null
function regionAt(segs, p) {
  // split every edge where it meets another
  const cuts = segs.map(() => [0, 1]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [a, b] = segs[i], [c, d] = segs[j];
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]; const den = r[0] * s[1] - r[1] * s[0];
    const bx = Math.min(a[0], b[0]) - 1e-6 > Math.max(c[0], d[0]) || Math.max(a[0], b[0]) + 1e-6 < Math.min(c[0], d[0]) || Math.min(a[1], b[1]) - 1e-6 > Math.max(c[1], d[1]) || Math.max(a[1], b[1]) + 1e-6 < Math.min(c[1], d[1]);
    if (bx) continue;
    if (Math.abs(den) > 1e-12) {
      const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      if (t > -1e-7 && t < 1 + 1e-7 && u > -1e-7 && u < 1 + 1e-7) { cuts[i].push(Math.max(0, Math.min(1, t))); cuts[j].push(Math.max(0, Math.min(1, u))); }
    } else {
      // collinear overlap: split at the other edge's ends
      const on = (q, a2, b2) => distPtSeg(q, a2, b2).d < 1e-6; const tOf = (q, a2, b2) => { const L2 = (b2[0] - a2[0]) ** 2 + (b2[1] - a2[1]) ** 2 || 1; return ((q[0] - a2[0]) * (b2[0] - a2[0]) + (q[1] - a2[1]) * (b2[1] - a2[1])) / L2; };
      for (const q of [c, d]) if (on(q, a, b)) cuts[i].push(tOf(q, a, b));
      for (const q of [a, b]) if (on(q, c, d)) cuts[j].push(tOf(q, c, d));
    }
  }
  const key = q => Math.round(q[0] * 1e4) + ',' + Math.round(q[1] * 1e4);
  const nodes = new Map(), adj = new Map(), seen = new Set();
  const node = q => { const k = key(q); if (!nodes.has(k)) { nodes.set(k, [q[0], -q[1]]); adj.set(k, []); } return k; };
  segs.forEach(([a, b], i) => {
    const ts = [...new Set(cuts[i].map(t => Math.round(t * 1e9) / 1e9))].sort((x, y) => x - y);
    for (let k = 0; k < ts.length - 1; k++) {
      const p0 = [a[0] + (b[0] - a[0]) * ts[k], a[1] + (b[1] - a[1]) * ts[k]], p1 = [a[0] + (b[0] - a[0]) * ts[k + 1], a[1] + (b[1] - a[1]) * ts[k + 1]];
      const k0 = node(p0), k1 = node(p1); if (k0 === k1) continue; const ek = k0 < k1 ? k0 + '|' + k1 : k1 + '|' + k0; if (seen.has(ek)) continue; seen.add(ek);
      adj.get(k0).push(k1); adj.get(k1).push(k0);
    }
  });
  // edges crossed by a ray from p to the right (y up inside the graph), nearest first; islands are skipped
  const P0 = [p[0], -p[1]]; const hits = [];
  for (const ek of seen) {
    const [k0, k1] = ek.split('|'); const A = nodes.get(k0), B = nodes.get(k1);
    if ((A[1] > P0[1]) === (B[1] > P0[1])) continue;
    const x = A[0] + (P0[1] - A[1]) * (B[0] - A[0]) / (B[1] - A[1]); if (x > P0[0]) hits.push([x, k0, k1]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  for (const [, k0, k1] of hits.slice(0, 40)) { const r = traceLoop(nodes, adj, k0, k1, P0, p); if (r) return r; }
  return null;
}
function traceLoop(nodes, adj, s0, s1, P0, p) {
  let u = s0, v = s1; { const A = nodes.get(u), B = nodes.get(v); if ((B[0] - A[0]) * (P0[1] - A[1]) - (B[1] - A[1]) * (P0[0] - A[0]) < 0) [u, v] = [v, u]; }
  const loop = [u]; const u0 = u, v0 = v;
  for (let step = 0; step < 20000; step++) {
    loop.push(v); const V = nodes.get(v), U = nodes.get(u); const back = Math.atan2(U[1] - V[1], U[0] - V[0]);
    let best = null, ba = Infinity;
    for (const w of adj.get(v)) {
      const W = nodes.get(w); let cw = back - Math.atan2(W[1] - V[1], W[0] - V[0]); while (cw <= 1e-9) cw += 2 * Math.PI; while (cw > 2 * Math.PI + 1e-9) cw -= 2 * Math.PI;
      if (w === u && adj.get(v).length > 1) cw = 2 * Math.PI + 1;
      if (cw < ba) { ba = cw; best = w; }
    }
    if (best == null) return null;
    u = v; v = best; if (u === u0 && v === v0) break;
  }
  loop.pop();
  let pts = loop.map(k => { const q = nodes.get(k); return [q[0], -q[1]]; });
  // drop spikes (dead ends) and straight-through points
  for (let pass = 0; pass < 4; pass++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      if (ptDist(a, c) < 1e-6 && pts.length > 3) { i++; continue; }
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
      if (Math.abs(cross) < 1e-7 && dot > 0) continue;
      out.push(b);
    }
    pts = out; if (pts.length < 3) return null;
  }
  // a hole: the loop runs clockwise (seen with y up) when p is outside everything
  let A2 = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A2 += a[0] * (-b[1]) - b[0] * (-a[1]); }
  if (A2 <= 0 || !inPoly(p, pts)) return null;
  return pts.map(rp);
}
drawTool('roompick', {
  name: 'Room from walls',
  prompt: () => 'Click inside an area closed in by walls (or lines) to make it a room:',
  point(D, q, c) {
    const raw = c.raw || q; const pts = regionAt(boundaryEdges(c.lv), raw);
    if (!pts) { flash('No closed area found there. Close the gaps with walls or lines first.'); return; }
    addRoom(c.pg, pts, null, rm => { rm.auto = true; });
  },
  ghost(D, q, c) { return []; },
});

// ---------- door and window schedule ----------
function openingRows() {
  const rows = [];
  for (const lv of P.levels || []) for (const o of lvShapes(lv)) {
    if (o.t !== 'opening' || o.kind === 'opening') continue;
    const w = wallById(lv, o.wall); if (!w) continue;
    const g = openingGeom(o, w); const off = Math.abs(g.ax.L - g.ax.R) / 2 + 2;
    const mid = [w.a[0] + g.ax.u[0] * g.at + g.ax.n[0] * (g.ax.L + g.ax.R) / 2, w.a[1] + g.ax.u[1] * g.at + g.ax.n[1] * (g.ax.L + g.ax.R) / 2];
    const rooms = [1, -1].map(sg => roomAt(lv, [mid[0] + g.ax.n[0] * off * sg, mid[1] + g.ax.n[1] * off * sg])).filter(Boolean).map(r => r.name);
    rows.push({ o, lv, cells: [o.tag || '', OPEN_NAMES[o.kind], o.kind === 'door' ? (DOOR_STYLES.find(s => s[0] === (o.style || 'single')) || [0, ''])[1] : '', formatLength(toRealMm(lv, o.w)), formatLength(o.h || 0), o.kind === 'window' ? formatLength(o.sill || 0) : '', lv.name, [...new Set(rooms)].join(' / '), o.notes || ''] });
  }
  return rows.sort((a, b) => (a.o.kind === b.o.kind ? 0 : a.o.kind === 'door' ? -1 : 1) || natCmp(a.cells[0], b.cells[0]));
}
const OPEN_COLS = () => [{ h: 'Tag', w: 18, a: 'middle' }, { h: 'Type', w: 24 }, { h: 'Style', w: 36 }, { h: 'Width', w: 26, a: 'middle' }, { h: 'Height', w: 26, a: 'middle' }, { h: 'Sill', w: 22, a: 'middle' }, { h: 'Level', w: 36 }, { h: 'Rooms', w: 90 }, { h: 'Notes', w: 96 }];
function buildOpeningReport(reps) {
  const rows = openingRows(); if (!rows.length) return;
  mkReport(reps, { id: 'rep:doors', report: 'doors', num: 'DWS', desc: 'Door and window schedule', title: 'Door and window schedule' }, rows.map(r => ({ cells: r.cells, goto: r.o.id })), OPEN_COLS());
}

// ---------- properties ----------
function wallPropsHTML(pg, lv, list) {
  const f = list[0], L = v => formatLength(toRealMm(lv, v)); const u = unitsOf();
  const opt = (pairs, cur) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const presets = WALL_PRESETS.map(([n, th]) => [n, `${n} (${formatLength(th, u)})`]).concat([['Custom', 'Custom']]);
  const len = list.reduce((t, w) => t + ptDist(w.a, w.b), 0); const nOpen = list.reduce((t, w) => t + openingsOf(lv, w).length, 0);
  return `<div class="ident">${list.length === 1 ? 'Wall' : list.length + ' walls'}</div><div class="sub">${esc(L(len))} long${nOpen ? `, ${nOpen} opening(s)` : ''}</div>
    <div class="pgrp"><h4>Wall</h4>${row('shp.wpreset', 'Type', '', 'select', opt(presets, WALL_PRESETS.some(p => p[0] === f.kind) ? f.kind : 'Custom'))}${row('shp.th', 'Thickness', L(f.th))}
    ${row('shp.just', 'Reference line', '', 'select', opt([['c', 'Center'], ['l', 'Left face'], ['r', 'Right face']], f.just || 'c'))}${row('shp.wh', 'Height', formatLength(f.h || WALL_H))}
    ${list.length === 1 ? row('shp.len', 'Length', L(len)) : ''}</div>
    <div class="pgrp"><h4>Style</h4><div class="prow"><label>Line color</label><input type="color" data-k="shp.color" value="${esc(f.color || '#1d1d1d')}"></div><div class="prow"><label>Fill color</label><input type="color" data-k="shp.fill" value="${esc(f.fill || '#c9ced5')}"></div>${userLayers().length ? row('shp.layer', 'Layer', '', 'select', layerOptions(f.layer)) : ''}</div>
    <div class="note">Walls that meet at their ends are joined with clean corners. Drag the end grips to stretch a wall; doors and windows stay where they are.</div>
    <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
}
function openingPropsHTML(pg, lv, o) {
  const w = wallById(lv, o.wall); const L = v => formatLength(toRealMm(lv, v));
  const opt = (pairs, cur) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const kinds = [['door', 'Door'], ['window', 'Window'], ['opening', 'Cased opening']];
  return `<div class="ident">${esc((o.tag ? o.tag + '  ' : '') + OPEN_NAMES[o.kind])}</div><div class="sub">${w ? 'In a ' + esc(w.kind || 'wall') + ' wall' : 'Not in a wall'}</div>
    <div class="pgrp"><h4>${OPEN_NAMES[o.kind]}</h4>${row('shp.okind', 'Kind', '', 'select', opt(kinds, o.kind))}${o.kind === 'door' ? row('shp.ostyle', 'Style', '', 'select', opt(DOOR_STYLES, o.style || 'single')) : ''}
    ${o.kind !== 'opening' ? row('shp.otag', 'Tag', o.tag || '') : ''}${row('shp.ow', 'Width', L(o.w))}${row('shp.oh', 'Height', formatLength(o.h || 0))}${o.kind === 'window' ? row('shp.osill', 'Sill height', formatLength(o.sill || 0)) : ''}
    ${o.kind !== 'opening' ? `<div class="prow"><label>Show tag</label><input type="checkbox" data-k="shp.oshow" ${o.showTag === false ? '' : 'checked'} style="width:auto"></div>` : ''}${row('shp.onotes', 'Notes', o.notes || '', 'textarea')}</div>
    <div class="note">Drag the middle grip to slide it along the wall, the end grips to change its width.</div>
    <div class="btnrow">${o.kind === 'door' ? '<button class="btn" data-act="flipSwing">Flip swing</button><button class="btn" data-act="flipHinge">Flip hinge</button>' : '<button class="btn" data-act="flipSwing">Flip side</button>'}<button class="btn" data-act="delSel">Delete</button></div>`;
}
function applyWallProp(pg, lv, s, key, v) {
  const len = () => { const mm = parseLength(v); return mm == null || mm <= 0 ? null : mm; };
  if (s.t === 'wall') {
    if (key === 'wpreset') { const p = WALL_PRESETS.find(x => x[0] === v); s.kind = v; if (p) s.th = r2(toPlanMm(lv, p[1]) * 1000) / 1000; return true; }
    if (key === 'th') { const mm = len(); if (mm) { s.th = r2(toPlanMm(lv, mm) * 1000) / 1000; s.kind = (WALL_PRESETS.find(p => Math.abs(p[1] - mm) < 0.5 && p[0] === s.kind) || [0])[0] || 'Custom'; } return true; }
    if (key === 'just') { s.just = v; return true; }
    if (key === 'wh') { const mm = len(); if (mm) s.h = mm; return true; }
    if (key === 'len') { const mm = len(); if (mm) s.b = rp(polarPt(s.a, toPlanMm(lv, mm), ptAngle(s.a, s.b))); return true; }
    return false;
  }
  if (s.t === 'opening') {
    if (key === 'okind') { s.kind = v; if (v === 'door') s.style = s.style || 'single'; if (v === 'opening') delete s.tag; else if (!s.tag || s.tag[0] !== (v === 'window' ? 'W' : 'D')) s.tag = nextOpeningTag(v); return true; }
    if (key === 'ostyle') { s.style = v; return true; }
    if (key === 'otag') { s.tag = v; return true; }
    if (key === 'ow') { const mm = len(); if (mm) s.w = r2(toPlanMm(lv, mm) * 1000) / 1000; return true; }
    if (key === 'oh') { const mm = len(); if (mm) s.h = mm; return true; }
    if (key === 'osill') { const mm = parseLength(v); if (mm != null && mm >= 0) s.sill = mm; return true; }
    if (key === 'oshow') { if (v) delete s.showTag; else s.showTag = false; return true; }
    if (key === 'onotes') { s.notes = v; return true; }
  }
  return false;
}
function flipOpening(what) {
  const lv = levelOf(page()); if (!lv) return; const list = lvShapes(lv).filter(s => sel.has(s.id) && s.t === 'opening'); if (!list.length) return;
  commit(() => list.forEach(o => { if (what === 'swing') o.side = -(o.side || 1); else o.hinge = (o.hinge || 'a') === 'a' ? 'b' : 'a'; }));
}

registerCommand('WALL', ['WA'], 'Draw walls (S settings, J reference line)', () => { if (needFloor()) setMode('d:wall'); });
registerCommand('WALLSETTINGS', ['WS'], 'Wall type, thickness, reference line and height', () => wallSettingsDlg());
registerCommand('DOOR', ['DO'], 'Place a door in a wall', () => { if (needFloor()) setMode('d:door:single'); });
registerCommand('WINDOW', ['WIN'], 'Place a window in a wall', () => { if (needFloor()) setMode('d:window'); });
registerCommand('OPENING', ['OP'], 'Place a cased opening in a wall', () => { if (needFloor()) setMode('d:opening'); });
registerCommand('ROOMPICK', ['RP'], 'Make a room by clicking inside walls', () => { if (needFloor()) setMode('d:roompick'); });

// rooms made from walls follow them: when a level's walls change, each such room is traced again from inside
const WALL_SIG = new Map();
function polyInside(pts) {
  let a = 0, cx = 0, cy = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; const f = p[0] * q[1] - q[0] * p[1]; a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; }
  if (Math.abs(a) > 1e-9) { const c = [cx / (3 * a), cy / (3 * a)]; if (inPoly(c, pts)) return c; }
  for (let i = 0; i < pts.length; i++) for (let j = i + 2; j < pts.length; j++) { const m = midPt(pts[i], pts[j]); if (inPoly(m, pts)) return m; }
  return null;
}
function refreshAutoRooms() {
  for (const lv of P.levels || []) {
    if (!lv.rooms.some(r => r.auto)) continue;
    const sig = JSON.stringify(lvShapes(lv).filter(s => s.t !== 'opening' && s.t !== 'dim' && s.t !== 'text' && s.t !== 'hatch' && s.t !== 'insert' && s.t !== 'leader').map(s => [s.t, s.a, s.b, s.th, s.just, s.pts, s.c, s.r, s.closed]));
    if (WALL_SIG.get(lv.id) === sig) continue; const first = !WALL_SIG.has(lv.id); WALL_SIG.set(lv.id, sig); if (first) continue;
    const edges = boundaryEdges(lv);
    for (const r of lv.rooms) {
      if (!r.auto) continue; const seed = polyInside(r.pts); if (!seed) continue;
      const pts = regionAt(edges, seed); if (pts && JSON.stringify(pts) !== JSON.stringify(r.pts)) r.pts = pts;
    }
    for (const pl of lv.places) autoRoom(lv, pl);
  }
}
