// ---------- framing pages: drawings on the sheet ----------
// Each view is drawn in real millimetres (x to the right, y up) and placed on the sheet at a standard scale that fits
// the drawing area. FRAME_XF keeps the last placement per page so the mouse can be turned back into real lengths.
const FRAME_XF = new Map();
const FSCALES = { imperial: [8, 12, 16, 24, 32, 48, 64, 96, 128, 192], metric: [10, 20, 25, 50, 75, 100, 200] };
function frameCanvas(pg, bx, margins) {
  const [x0, y0, x1, y1] = bx, m = margins || [24, 26, 24, 18];   // left, bottom, right, top (sheet mm)
  const aw = SH.x1 - SH.x0 - m[0] - m[2], ah = SH.tb - SH.hdr - 8 - m[1] - m[3];
  const list = FSCALES[unitsOf()];
  const need = Math.max((x1 - x0) / aw, (y1 - y0) / ah);
  const k = list.find(s => s >= need) || need;
  const cx = SH.x0 + m[0] + aw / 2, cy = SH.hdr + 8 + m[3] + ah / 2;
  const ox = cx - (x0 + x1) / 2 / k, oy = cy + (y0 + y1) / 2 / k;
  const xf = { k, ox, oy, X: x => r2(ox + x / k), Y: y => r2(oy - y / k) };
  FRAME_XF.set(pg.id, xf); return xf;
}
function frameDraw(xf) {
  const out = [], { X, Y } = xf;
  const D = {
    out, X, Y,
    rect(a0, b0, a1, b1, cls, extra = '') { out.push(`<rect class="${cls}" x="${X(Math.min(a0, a1))}" y="${Y(Math.max(b0, b1))}" width="${r2(Math.abs(a1 - a0) / xf.k)}" height="${r2(Math.abs(b1 - b0) / xf.k)}" ${extra}/>`); },
    poly(pts, cls) { out.push(`<polygon class="${cls}" points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>`); },
    line(a0, b0, a1, b1, cls) { out.push(`<line class="${cls}" x1="${X(a0)}" y1="${Y(b0)}" x2="${X(a1)}" y2="${Y(b1)}"/>`); },
    text(sx, sy, t, o = {}) { out.push(`<text class="t ${o.cls || ''}" x="${r2(sx)}" y="${r2(sy)}" font-size="${o.size || 2.5}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${r2(sx)} ${r2(sy)})"` : ''}${o.bold ? ' font-weight="bold"' : ''}>${esc(t)}</text>`); },
    // horizontal dimension between sheet x positions at sheet y
    dimH(px0, px1, py, label, acc) {
      const c = acc ? 'frdim frdima' : 'frdim', room = (px1 - px0) > label.length * 1.25 + 2;
      out.push(`<path class="${c}" d="M${r2(px0)},${r2(py)}H${r2(px1)}M${r2(px0)},${r2(py - 1.2)}V${r2(py + 1.2)}M${r2(px1)},${r2(py - 1.2)}V${r2(py + 1.2)}"/>`);
      D.text((px0 + px1) / 2, room ? py - 1 : py + 3.2, label, { size: 2.2, anchor: 'middle', cls: acc ? 'frta' : '' });
    },
    dimV(px, py0, py1, label, acc) {
      const c = acc ? 'frdim frdima' : 'frdim';
      out.push(`<path class="${c}" d="M${r2(px)},${r2(py0)}V${r2(py1)}M${r2(px - 1.2)},${r2(py0)}H${r2(px + 1.2)}M${r2(px - 1.2)},${r2(py1)}H${r2(px + 1.2)}"/>`);
      D.text(px - 1, (py0 + py1) / 2, label, { size: 2.2, anchor: 'middle', rot: -90, cls: acc ? 'frta' : '' });
    },
    ext(px0, py0, px1, py1) { out.push(`<path class="frext" d="M${r2(px0)},${r2(py0)}L${r2(px1)},${r2(py1)}"/>`); },
  };
  return D;
}
function framingPageSVG(pg, o = {}) {
  const all = allPages(); let s = frameSVG(pg, all.indexOf(pg), all.length);
  const b = bldOf(pg); if (!b) return s + txt(SH.x0 + 10, SH.hdr + 20, 'This page belongs to a building that no longer exists.', { size: 3.5 });
  const M = frameModel(b);
  if (M.errs && M.errs.length) {
    s += txt(SH.x0 + 6, SH.hdr + 12, b.name + ': the framing cannot be drawn yet', { size: 4, cls: 'tw' });
    M.errs.forEach((e, i) => { s += txt(SH.x0 + 6, SH.hdr + 22 + i * 6, e, { size: 3 }); });
    return s;
  }
  let body = '', head = '';
  const v = pg.view;
  if (v === 'plan') ({ body, head } = frameTopSVG(pg, M));
  else if (v === 'floor') ({ body, head } = frameFloorSVG(pg, M));
  else if (v === 'roof') ({ body, head } = frameRoofSVG(pg, M));
  else { const fw = M.walls.find(w => w.key === (v === 'wall' ? 'single' : v)); if (fw) ({ body, head } = frameWallSVG(pg, M, fw, o)); }
  s += txt(SH.x0 + 4, SH.hdr + 6, `${b.name}  ·  ${FRAME_VIEWS[v]}${head ? '  ·  ' + head : ''}`, { size: 3, cls: 'tc' });
  return s + body;
}
const scaleText = k => 'Scale ' + formatScale(k);

// ---------- wall elevation ----------
function frameWallSVG(pg, M, fw, o) {
  const d = fw.def, L = fw.len, R = M.roof, F = M.floor, T = M.T;
  let x0 = Math.min(0, d.capStart), x1 = Math.max(L, d.capEnd), y0 = 0, y1 = fw.wallTop;
  fw.fill.forEach(q => { y1 = Math.max(y1, q.y1); });
  let roofPoly = null;
  if (R && d.fill) {
    const wt = M.wallTop; const cs = R.type === 'gable' ? [-R.eave, R.B / 2, R.B + R.eave] : [-R.eave, R.B + R.eave];
    const bot = cs.map(c => [d.toLocal(c), wt + R.f(c)]); const topL = bot.slice().reverse().map(p => [p[0], p[1] + R.rd * R.sf]);
    roofPoly = bot.concat(topL); roofPoly.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); y0 = Math.min(y0, p[1]); });
  }
  let fx0 = 0, fx1 = L;
  if (F) { const full = d.axis === 'x' ? M.W : M.D; fx0 = Math.min(d.toLocal(0), d.toLocal(full)); fx1 = Math.max(d.toLocal(0), d.toLocal(full)); x0 = Math.min(x0, fx0); x1 = Math.max(x1, fx1); y0 = Math.min(y0, -F.height); }
  const xf = frameCanvas(pg, [x0, y0, x1, y1], [22, 30, 14, 20]); const Dr = frameDraw(xf), { X, Y } = xf;
  if (F) {
    Dr.rect(fx0, -F.deckT, fx1, 0, 'frdeck');
    Dr.rect(fx0, -F.deckT - F.jd, fx1, -F.deckT, 'frrim');
    if (F.skids) {
      if (d.axis === F.longAxis) Dr.rect(fx0, -F.height, fx1, -F.deckT - F.jd, 'frskid');
      else F.skidPos.forEach(p => { const a = d.toLocal(p), c = d.toLocal(p + F.skidW); Dr.rect(Math.min(a, c), -F.height, Math.max(a, c), -F.deckT - F.jd, 'frskid'); });
    }
  }
  if (roofPoly) Dr.poly(roofPoly, 'frraf');
  const cls = { end: 'frstud', common: 'frstud', king: 'frking', jack: 'frjack', cripple: 'frstud', lcripple: 'frstud' };
  fw.members.forEach(q => Dr.rect(q.x, q.y0, q.x + T, q.y1, cls[q.kind]));
  fw.fill.forEach(q => Dr.rect(q.x, q.y0, q.x + T, q.y1, 'frstud'));
  fw.ops.forEach(op => {
    Dr.rect(op.roL - T, op.top, op.roR + T, op.hTop, 'frhdr');
    if (op.hd.depth / xf.k >= 2.2) Dr.text(X((op.roL + op.roR) / 2), Y(op.top + op.hd.depth / 2) + 0.8, op.hd.name + ' header', { size: 1.8, anchor: 'middle', cls: 'frhl' });
    if (op.type === 'window') Dr.rect(op.roL, op.sill - T, op.roR, op.sill, 'frplate');
  });
  const doors = fw.ops.filter(op => op.type === 'door'); let cur = 0;
  doors.forEach(op => { if (op.roL > cur) Dr.rect(cur, 0, op.roL, T, 'frplate'); Dr.rect(op.roL, 0, op.roR, T, 'frcut'); cur = op.roR; });
  Dr.rect(cur, 0, L, T, 'frplate');
  fw.topP.pieces.forEach(p => Dr.rect(p.x0, fw.top, p.x1, fw.top + T, 'frplate'));
  if (fw.cap) fw.cap.pieces.forEach(p => Dr.rect(p.x0, fw.top + T, p.x1, fw.top + 2 * T, 'frplate'));
  Dr.line(x0 - 150, F ? -F.height : 0, x1 + 150, F ? -F.height : 0, 'frground');
  // openings: click and drag targets
  fw.ops.forEach(op => {
    const on = !o.print && sel.has(op.id);
    Dr.out.push(`<g data-id="${op.id}" class="frop${on ? ' on' : ''}"><rect x="${X(op.roL)}" y="${Y(op.top)}" width="${r2(op.w / xf.k)}" height="${r2((op.top - op.sill) / xf.k)}"/>`);
    Dr.text(X((op.roL + op.roR) / 2), Y((op.sill + op.top) / 2) + 1, (op.type === 'door' ? 'Door ' : 'Window ') + (op.i + 1), { size: 2.2, anchor: 'middle', cls: 'frta' });
    Dr.out.push('</g>');
  });
  // dimensions
  const top = Y(y1) - 8, base = Y(F ? -F.height : 0);
  Dr.ext(X(0), top - 1.5, X(0), Y(fw.wallTop) - 1); Dr.ext(X(L), top - 1.5, X(L), Y(fw.wallTop) - 1);
  Dr.dimH(X(0), X(L), top, fmtLong(L));
  fw.members.filter(q => q.kind !== 'lcripple').forEach(q => Dr.text(X(q.x + T / 2) + 0.6, base + 2, fmtNum(q.x), { size: 1.6, anchor: 'end', rot: -90, cls: 'tc' }));
  if (fw.ops.length) {
    const yb = base + 21, pts = [0]; fw.ops.forEach(op => pts.push(op.roL, op.roR)); pts.push(L);
    pts.forEach(x => Dr.ext(X(x), Y(0) + 1, X(x), yb + 1.5));
    for (let i = 0; i < pts.length - 1; i++) { const ro = i % 2 === 1; Dr.dimH(X(pts[i]), X(pts[i + 1]), yb, (ro ? 'RO ' : '') + fmtCut(pts[i + 1] - pts[i]), ro); }
  }
  Dr.dimV(X(x0) - 7, Y(0), Y(fw.wallTop), 'Wall ' + fmtCut(fw.wallTop));
  fw.ops.forEach(op => {
    const vx = X(op.roL) + 4;
    if (op.type === 'door') Dr.dimV(vx, Y(0), Y(op.top), 'RO ' + fmtCut(op.h), true);
    else { Dr.dimV(vx, Y(0), Y(op.sill), 'Sill ' + fmtCut(op.sill), true); Dr.dimV(vx, Y(op.sill), Y(op.top), fmtCut(op.h), true); }
  });
  const studs = fw.members.filter(q => q.kind !== 'lcripple' && q.kind !== 'cripple').length;
  return { body: Dr.out.join(''), head: `${scaleText(xf.k)}  ·  viewed from outside  ·  ${fmtLong(L)} long, ${sizeName(M.b.stud)} studs ${fmtCut(fw.S)} at ${fmtCut(M.sp)} on center  ·  ${studs} full-height studs` };
}

// ---------- framing plan ----------
function frameTopSVG(pg, M) {
  const W = M.W, D = M.D, R = M.roof, WD = M.WD;
  let rx0 = 0, rx1 = W, ry0 = 0, ry1 = D;
  if (R) { const ex = R.axis === 'x' ? R.eave : R.rake, ey = R.axis === 'x' ? R.rake : R.eave; rx0 = -ex; rx1 = W + ex; ry0 = -ey; ry1 = D + ey; }
  const xf = frameCanvas(pg, [rx0, ry0, rx1, ry1], [30, 24, 30, 16]); const Dr = frameDraw(xf), { X, Y } = xf;
  if (R) Dr.rect(rx0, ry0, rx1, ry1, 'froof');
  Dr.rect(0, 0, W, WD, 'frwall'); Dr.rect(0, D - WD, W, D, 'frwall'); Dr.rect(0, WD, WD, D - WD, 'frwall'); Dr.rect(W - WD, WD, W, D - WD, 'frwall');
  M.walls.forEach(fw => {
    const d = fw.def;
    fw.ops.forEach(op => {
      const a = d.toPlan(op.roL), c = d.toPlan(op.roR), lo = Math.min(a, c), hi = Math.max(a, c);
      const lab = (op.type === 'door' ? 'Door ' : 'Window ') + fmtCut(op.w) + (op.type === 'window' ? ' x ' + fmtCut(op.h) : '');
      if (d.axis === 'x') {
        const yy = d.key === 'front' ? 0 : D - WD; Dr.rect(lo, yy, hi, yy + WD, 'frgap');
        if (op.type === 'door') Dr.line(lo, yy + WD / 2, hi, yy + WD / 2, 'frdoor'); else { Dr.line(lo, yy + WD * 0.3, hi, yy + WD * 0.3, 'frwin'); Dr.line(lo, yy + WD * 0.7, hi, yy + WD * 0.7, 'frwin'); }
        Dr.text(X((lo + hi) / 2), d.key === 'front' ? Y(yy) + 4 : Y(yy + WD) - 2, lab, { size: 2.2, anchor: 'middle', cls: 'frta' });
      } else {
        const xx = d.key === 'left' ? 0 : W - WD; Dr.rect(xx, lo, xx + WD, hi, 'frgap');
        if (op.type === 'door') Dr.line(xx + WD / 2, lo, xx + WD / 2, hi, 'frdoor'); else { Dr.line(xx + WD * 0.3, lo, xx + WD * 0.3, hi, 'frwin'); Dr.line(xx + WD * 0.7, lo, xx + WD * 0.7, hi, 'frwin'); }
        Dr.text(d.key === 'left' ? X(xx + WD) + 1.5 : X(xx) - 1.5, Y((lo + hi) / 2) + 0.8, lab, { size: 2.2, anchor: d.key === 'left' ? 'start' : 'end', cls: 'frta' });
      }
    });
  });
  if (R) {
    if (R.type === 'gable') { if (R.axis === 'x') Dr.line(W / 2, ry0, W / 2, ry1, 'frridge'); else Dr.line(rx0, D / 2, rx1, D / 2, 'frridge'); Dr.text(R.axis === 'x' ? X(W / 2) + 1.5 : X(W * 0.72), R.axis === 'x' ? Y(D * 0.7) : Y(D / 2) - 1.5, 'Ridge', { size: 2.2, cls: 'frta' }); }
    else {
      const dir = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }[M.b.roof.low], len = Math.min(W, D) * 0.22;
      const ax = W / 2 - dir[0] * len, ay = D / 2 - dir[1] * len, bx = W / 2 + dir[0] * len, by = D / 2 + dir[1] * len;
      Dr.line(ax, ay, bx, by, 'frarrow');
      const hx = X(bx), hy = Y(by), ux = dir[0], uy = -dir[1];
      Dr.out.push(`<polygon class="frarrowh" points="${r2(hx + ux * 2.5)},${r2(hy + uy * 2.5)} ${r2(hx - uy * 1.5)},${r2(hy + ux * 1.5)} ${r2(hx + uy * 1.5)},${r2(hy - ux * 1.5)}"/>`);
      Dr.text(X(W / 2) + 2, Y(D / 2) - 2, 'Slopes down ' + pitchName(R.p), { size: 2.2, cls: 'frta' });
    }
  }
  const lab = (t, sx, sy, rot) => Dr.text(sx, sy, t, { size: 3, anchor: 'middle', bold: true, rot });
  lab('FRONT', X(W / 2), Y(ry0) + 6); lab('BACK', X(W / 2), Y(ry1) - 3); lab('LEFT', X(rx0) - 4, Y(D / 2), -90); lab('RIGHT', X(rx1) + 4, Y(D / 2), 90);
  Dr.dimH(X(0), X(W), Y(ry0) + 13, 'Width ' + formatLength(W));
  Dr.dimV(X(rx1) + 11, Y(0), Y(D), 'Depth ' + formatLength(D));
  return { body: Dr.out.join(''), head: `${scaleText(xf.k)}  ·  outside of framing ${formatLength(W)} x ${formatLength(D)}${R ? '  ·  ' + (R.type === 'gable' ? 'gable' : 'shed') + ' roof ' + pitchName(R.p) : ''}` };
}

// ---------- floor framing ----------
function frameFloorSVG(pg, M) {
  const F = M.floor, W = M.W, D = M.D, T = M.T;
  const xf = frameCanvas(pg, [0, 0, W, D], [24, 24, 80, 14]); const Dr = frameDraw(xf), { X, Y } = xf;
  const along = F.longAxis;
  if (F.skids) F.skidPos.forEach(p => { if (along === 'x') Dr.rect(0, p, W, p + F.skidW, 'frskidp'); else Dr.rect(p, 0, p + F.skidW, D, 'frskidp'); });
  F.pos.forEach(x => { if (along === 'x') Dr.rect(x, T, x + T, D - T, 'frstud'); else Dr.rect(T, x, W - T, x + T, 'frstud'); });
  if (along === 'x') { Dr.rect(0, 0, W, T, 'frrim'); Dr.rect(0, D - T, W, D, 'frrim'); } else { Dr.rect(0, 0, T, D, 'frrim'); Dr.rect(W - T, 0, W, D, 'frrim'); }
  Dr.text(X(0), Y(0) + 5, 'FRONT', { size: 3, bold: true });
  Dr.dimH(X(0), X(W), Y(0) + 12, formatLength(W));
  Dr.dimV(X(W) + 8, Y(0), Y(D), formatLength(D));
  const tx = X(W) + 16; let ty = Y(D) + 2;
  const line = (k, v) => { Dr.text(tx, ty, k, { size: 2.3, cls: 'tc' }); Dr.text(tx + 26, ty, v, { size: 2.3 }); ty += 5; };
  line('Joists', `${F.pos.length} x ${F.size} at ${fmtCut(F.joistLen)}`);
  line('Spacing', fmtCut(F.sp) + ' on center');
  line('Rim joists', `2 x ${F.size} at ${fmtCut(F.Lf)}`);
  line('Skids', F.skids ? `${F.skids} x ${F.skidSize} at ${fmtCut(F.Lf)}` : 'None');
  line('Decking', `${F.deckSheets} sheets, ${F.deck}`);
  line('Floor height', fmtCut(F.height));
  ty += 2; Dr.text(tx, ty, 'Joist layout from the ' + (along === 'x' ? 'left' : 'front') + ' edge:', { size: 2.2, cls: 'tc' }); ty += 4.5;
  const marks = F.pos.map(fmtNum); for (let i = 0; i < marks.length; i += 6) { Dr.text(tx, ty, marks.slice(i, i + 6).join(', '), { size: 2.2 }); ty += 4; }
  return { body: Dr.out.join(''), head: `${scaleText(xf.k)}  ·  ${F.size} joists at ${fmtCut(F.sp)} on center${F.skids ? ', ' + F.skids + ' skids below' : ''}` };
}

// ---------- roof framing: one rafter in detail ----------
function frameRoofSVG(pg, M) {
  const R = M.roof, s = R.slope, rd = R.rd, vd = rd * R.sf, WD = M.WD, T = M.T;
  const y = c => (c - WD) * s; let pts, xEnd;
  if (R.type === 'gable') { xEnd = R.B / 2 - T / 2; pts = [[-R.eave, y(-R.eave)], [0, y(0)], [0, 0], [WD, 0], [xEnd, y(xEnd)], [xEnd, y(xEnd) + vd], [-R.eave, y(-R.eave) + vd]]; }
  else { const B = R.B, hp = R.delta; xEnd = B + R.eave; pts = [[-R.eave, y(-R.eave)], [0, y(0)], [0, 0], [WD, 0], [B - WD, y(B - WD)], [B - WD, hp], [B, hp], [xEnd, y(xEnd)], [xEnd, y(xEnd) + vd], [-R.eave, y(-R.eave) + vd]]; }
  const ymin = Math.min(y(-R.eave), -300), ymax = Math.max(...pts.map(p => p[1])) + 60, xmax = R.type === 'gable' ? R.B / 2 + 60 : xEnd;
  const xf = frameCanvas(pg, [-R.eave - 50, ymin, xmax + 50, ymax], [24, 30, 100, 16]); const Dr = frameDraw(xf), { X, Y } = xf;
  Dr.rect(0, -300, WD, 0, 'frplate');
  if (R.type === 'shed') Dr.rect(R.B - WD, R.delta - 300, R.B, R.delta, 'frplate');
  Dr.poly(pts, 'frraf');
  if (R.type === 'gable') { const yt = y(xEnd) + vd; Dr.rect(xEnd, yt - R.ridgeD, xEnd + T, yt, 'frhdr'); }
  const by = Y(ymin) + 10;
  Dr.ext(X(-R.eave), Y(y(-R.eave)) + 1, X(-R.eave), by + 1.5); Dr.ext(X(0), Y(-300) + 1, X(0), by + 1.5);
  if (R.type === 'gable') { Dr.ext(X(R.B / 2), Y(0), X(R.B / 2), by + 1.5); Dr.dimH(X(-R.eave), X(0), by, 'Eave ' + fmtCut(R.eave)); Dr.dimH(X(0), X(R.B / 2), by, 'Run ' + fmtCut(R.B / 2) + ' to center', true); }
  else { Dr.ext(X(R.B), Y(R.delta - 300) + 1, X(R.B), by + 1.5); Dr.ext(X(xEnd), Y(y(xEnd)) + 1, X(xEnd), by + 1.5); Dr.dimH(X(-R.eave), X(0), by, 'Eave ' + fmtCut(R.eave)); Dr.dimH(X(0), X(R.B), by, 'Span ' + fmtCut(R.B), true); Dr.dimH(X(R.B), X(xEnd), by, 'Eave ' + fmtCut(R.eave)); }
  const ax = X(-R.eave), ay = Y(y(-R.eave) + vd), ex = X(xEnd), ey = Y(y(xEnd) + vd), ang = Math.atan2(ey - ay, ex - ax) * 180 / Math.PI;
  Dr.text((ax + ex) / 2, (ay + ey) / 2 - 2, `Rafter ${fmtCut(R.rafterLen)} along the edge, ${pitchName(R.p)} (${R.ang.toFixed(1)}°)`, { size: 2.4, anchor: 'middle', rot: ang, cls: 'frta' });
  Dr.text(X(WD / 2), Y(-300) + 4, 'seat ' + fmtCut(WD), { size: 2, anchor: 'middle', cls: 'tc' });
  const tx = SH.x1 - 96; let ty = SH.hdr + 22;
  const line = (k, v) => { Dr.text(tx, ty, k, { size: 2.3, cls: 'tc' }); Dr.text(tx + 34, ty, v, { size: 2.3 }); ty += 5; };
  line('Style', (R.type === 'gable' ? 'Gable' : 'Shed') + ', ' + pitchName(R.p) + ' (' + R.ang.toFixed(1) + '°)');
  line('Rafters', `${R.type === 'gable' ? 2 * R.n : R.n} x ${R.rsize} at ${fmtCut(R.sp)} on center`);
  line('Rafter length', fmtCut(R.rafterLen) + ' along the edge');
  line('Board needed', fmtCut(R.need) + ' per rafter');
  line('Plumb cut', R.ang.toFixed(1) + '° from square');
  line('Notch over wall', 'seat ' + fmtCut(WD) + ', heel ' + fmtCut(R.heel));
  line('Height above plate', fmtCut(R.hap));
  if (R.type === 'gable') { line('Ridge board', `${R.ridgeSize} at ${fmtCut(R.ridgeLen)}`); line('Rafter ties', `${R.ties} x ${sizeName(0)} at ${fmtCut(R.B)}`); }
  else line('High wall', `${WALL_NAMES[R.high]}, studs ${fmtCut(M.S + R.delta)}`);
  line('Peak height', formatLength(M.peakFromFloor) + ' from the floor');
  if (R.area) line('Roof area', formatArea(R.area));
  ty += 2; Dr.text(tx, ty, 'Rafter layout:', { size: 2.2, cls: 'tc' }); ty += 4.5;
  const marks = R.pos.map(fmtNum); for (let i = 0; i < marks.length; i += 6) { Dr.text(tx, ty, marks.slice(i, i + 6).join(', '), { size: 2.2 }); ty += 4; }
  return { body: Dr.out.join(''), head: `${scaleText(xf.k)}  ·  one rafter, ${R.type === 'gable' ? 'eave to ridge' : 'low wall to high wall'}` };
}
