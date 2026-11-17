// ---------- decks: pages, 3D solids and the hardware list ----------
// Plans are drawn with the house (or the back edge) at the top: drawing y = -plan y.
const DKCOL = { footing: '#bdbdbd', post: '#c49a63', beam: '#d9b37a', joist: '#ecd3a6', rim: '#e0bf8a', ledger: '#c4914f', block: '#e5c58f', deck: '#b07a4a', comp: '#8d8f8a', rail: '#e2c79a', stair: '#d9b37a', house: '#e8e2d6' };
function deckPageSVG(pg, M, v) {
  const b = M.b, T = M.T, X0 = M.X0, Y0 = M.Y0, W = M.W, D = M.D;
  const lines = [];
  const plan = (margins) => { const xf = frameCanvas(pg, [X0, -(Y0 + D), X0 + W, -Y0 + (M.plats.some(m => m.led) ? 600 : 0)], margins || [34, 40, 30, 24]); return { xf, Dr: frameDraw(xf) }; };
  const R = (Dr, x0, y0, x1, y1, cls, extra) => Dr.rect(x0, -y0, x1, -y1, cls, extra);
  let body = '', head = '';
  const species = DCA6.species.find(s => s[0] === (b.species || 'sp'))[1];
  if (v === 'dfoot' || v === 'dframe' || v === 'ddeck') {
    const { xf, Dr } = plan(); const { X, Y } = xf;
    if (M.plats.some(m => m.led)) { Dr.rect(X0 - 300, 0, X0 + W + 300, 400, 'dkhouse'); Dr.text(X(X0 + W / 2), Y(250), 'House', { size: 2.6, anchor: 'middle', cls: 'tc' }); }
    for (const Pm of M.plats) {
      const p = Pm.p, ox = p.x, oy = p.y;
      if (v === 'dfoot') {
        R(Dr, ox, oy, ox + p.w, oy + p.d, 'dkoutline');
        for (const B of Pm.beams) {
          Dr.line(ox, -(oy + B.y), ox + p.w, -(oy + B.y), 'dkbeamc');
          for (const q of B.posts) {
            const cx = X(ox + q.x), cy = Y(-(oy + q.y));
            Dr.out.push(`<circle class="dkfoot" cx="${cx}" cy="${cy}" r="${r2(Pm.foot.round / 2 / xf.k)}"/>`);
            if (!Pm.ground) { const ps = (lumberKey() === 'na' ? 5.5 * IN_MM : 145) / 2; R(Dr, ox + q.x - ps, oy + q.y - ps, ox + q.x + ps, oy + q.y + ps, 'dkpost'); }
          }
        }
        // stake-out: post centers from the section's left edge along the first beam, beam lines from the house or back edge
        const B0 = Pm.beams[0], yd = Y(-(oy + p.d)) + 8 + Pm.pi * 10; let prevX = ox;
        B0.posts.forEach(q => { Dr.ext(X(ox + q.x), Y(-(oy + B0.y)), X(ox + q.x), yd + 1.5); Dr.dimH(X(prevX), X(ox + q.x), yd, fmtCut(ox + q.x - prevX), true); prevX = ox + q.x; });
        Dr.ext(X(ox), Y(-oy), X(ox), yd + 1.5);
        const xd = X(ox) - 9 - Pm.pi * 10; let prevY = oy;
        Pm.beams.forEach(B => { Dr.ext(X(ox), Y(-(oy + B.y)), xd - 1.5, Y(-(oy + B.y))); Dr.dimV(xd, Y(-prevY), Y(-(oy + B.y)), fmtCut(oy + B.y - prevY), true); prevY = oy + B.y; });
        lines.push(`${b.plats.length > 1 ? 'Section ' + (Pm.pi + 1) + ': ' : ''}${Pm.beams.length * Pm.best.n} footings ${fmtCut(Pm.foot.round)} round (or ${fmtCut(Pm.foot.square)} square) x ${fmtCut(Pm.foot.thick)} thick, bottom ${fmtCut(Pm.foot.depth)} or more below grade; ${Pm.ground ? 'beams set on the piers' : `${lumberKey() === 'na' ? '6x6' : '145x145'} posts ${fmtCut(Pm.postH)} tall`}; posts ${fmtCut(Pm.best.LB)} apart (DCA 6 Table 4: ${Pm.pr.LBc}' beam span, joists up to ${Pm.pr.Jr}').`);
      }
      if (v === 'dframe') {
        R(Dr, ox, oy, ox + p.w, oy + p.d, 'dkoutline');
        for (const B of Pm.beams) { R(Dr, ox, oy + B.y - B.ply * T / 2, ox + p.w, oy + B.y + B.ply * T / 2, 'dkbeam'); for (const q of B.posts) { const ps = 2.75 * IN_MM; R(Dr, ox + q.x - ps, oy + q.y - ps, ox + q.x + ps, oy + q.y + ps, 'dkpost'); } (B.splices || []).forEach(x => Dr.line(ox + x, -(oy + B.y - B.ply * T), ox + x, -(oy + B.y + B.ply * T), 'frsplice')); }
        const yA = Pm.led ? T : T, yB = p.d - T;
        if (Pm.led) R(Dr, ox, oy, ox + p.w, oy + T, 'dkledger'); else R(Dr, ox, oy, ox + p.w, oy + T, 'dkrim');
        R(Dr, ox, oy + yB, ox + p.w, oy + p.d, 'dkrim');
        (Pm.rimSplices || []).forEach(x => Dr.line(ox + x, -(oy + yB - T), ox + x, -(oy + p.d + T), 'frsplice'));
        Pm.xs.forEach(x => R(Dr, ox + x, oy + yA, ox + x + T, oy + yB, 'dkjoist'));
        Pm.beams.forEach(B => { for (let i = 0; i < Pm.xs.length - 1; i++) Dr.line(ox + Pm.xs[i] + T, -(oy + B.y), ox + Pm.xs[i + 1], -(oy + B.y), 'dkblock'); });
        const yd = Y(-(oy + p.d)) + 8 + Pm.pi * 10;
        if (Pm.xs.length > 1) Dr.dimH(X(ox + Pm.xs[1] + T / 2), X(ox + Pm.xs[2 < Pm.xs.length ? 2 : 1] + T / 2), yd, fmtCut(Pm.xs[Math.min(2, Pm.xs.length - 1)] - Pm.xs[1] || M.sp) + ' o.c.', true);
        const xd = X(ox + p.w) + 9 + Pm.pi * 10, yb = Pm.beams[Pm.beams.length - 1].y;
        Dr.dimV(xd, Y(-(oy + (Pm.led ? 0 : Pm.beams[0].y))), Y(-(oy + (Pm.led ? Pm.beams[0].y : Pm.beams[1] ? Pm.beams[1].y : yb))), (Pm.J.n > 1 ? 'span ' : 'joist span ') + fmtCut(Pm.J.bay), true);
        Dr.dimV(xd, Y(-(oy + yb)), Y(-(oy + p.d)), 'cantilever ' + fmtCut(Pm.J.c), true);
        lines.push(`${b.plats.length > 1 ? 'Section ' + (Pm.pi + 1) + ': ' : ''}${sizeName(Pm.js)} joists at ${fmtCut(M.sp)} on center (DCA 6 Table 2 allows ${fmtCut(Pm.J.Lmax)} in ${species.toLowerCase()}), ${Pm.best.ply}-${sizeName(Pm.best.size)} beam${Pm.beams.length > 1 ? 's' : ''} on ${Pm.best.n} posts per beam (Table 3A allows ${fmtCut(Pm.best.LBmax)} between posts)${Pm.led ? `, ${sizeName(Pm.rimSize)} ledger with ${b.fast === 'bolt' ? '1/2" bolts' : '1/2" lag screws'} at ${fmtCut(Pm.ledgerSp)} staggered (Table 5)` : ''}.`);
      }
      if (v === 'ddeck') {
        Pm.xs.forEach(x => R(Dr, ox + x, oy, ox + x + T, oy + p.d, 'dkjoistf'));
        Pm.boards.forEach(q => Dr.poly(q.pts.map(([x, y]) => [ox + x, -(oy + y)]), q.name === 'Decking' ? 'dkboard' + (b.dk.mat === 'comp' ? ' dkcomp' : '') : 'dkboard dkborder'));
        R(Dr, ox, oy, ox + p.w, oy + p.d, 'dkoutline');
      }
    }
    // stairs on the plans
    for (const S of M.stairs) {
      const r = deckStairRect(S); R(Dr, r[0], r[1], r[2], r[3], 'dkstair');
      const n = S.n - 1; for (let i = 1; i < n; i++) { const t = i * S.tread; const [a, c, e, f] = deckStairLine(S, t); Dr.line(a, -c, e, -f, 'dkstep'); }
      Dr.text(X((r[0] + r[2]) / 2), Y(-(r[1] + r[3]) / 2) + 1, `${S.name} ${M.stairs.indexOf(S) + 1}: ${S.n} risers`, { size: 2.2, anchor: 'middle', cls: 'tc' });
    }
    if (v === 'ddeck') {
      const lay = DECK_LAYS.find(l => l[0] === b.dk.lay)[1], mat = DECK_MATS[b.dk.mat][0];
      lines.push(`${mat}, ${lay.toLowerCase()}, ${fmtCut(M.gap)} gaps; butt joints over joists, staggered at least two joists apart, every board on three or more joists. Joists at ${fmtCut(M.sp)} on center (IRC Table R507.7${b.dk.mat === 'comp' ? ' and the decking maker\'s span' : ''}).`);
    }
    if (v === 'dframe' && M.rails.length) lines.push(`Guards ${fmtCut(b.rail.h)} high with ${lumberKey() === 'na' ? '4x4' : '95x95'} posts at ${fmtCut(Math.max(...M.rails.map(r => r.bay)))} or less, balusters with openings under 4".`);
    head = scaleText(xf.k); body = Dr.out.join('');
  } else if (v === 'delev') ({ body, head } = deckElevSVG(pg, M, lines));
  else if (v === 'dstair') ({ body, head } = deckStairSVG(pg, M, lines));
  if (b._lost) lines.push('The floor plan room or wall this deck follows was deleted; the deck keeps its last size.');
  M.warns.concat(M.notes.map(n => 'Note: ' + n)).forEach(w => lines.push(w));
  lines.push('Sizes follow the AWC DCA 6 span tables (40 psf live load, No. 2 grade); the local building department has the final say.');
  const foot = SH.tb - 6 - (lines.length - 1) * 4;
  return { body: (body || '') + lines.map((t, i) => txt(SH.x0 + 6, foot + i * 4, t, { size: 2.4, cls: M.warns.includes(t) ? 'tw' : '' })).join(''), head };
}
function deckStairRect(S) {
  const p = S.Pm.p, L = S.run + (S.auto ? 0 : 0);
  if (S.side === 'front') return [S.e0, p.y + p.d, S.e0 + S.w, p.y + p.d + L];
  if (S.side === 'back') return [S.e0, p.y - L, S.e0 + S.w, p.y];
  if (S.side === 'right') return [p.x + p.w, S.e0, p.x + p.w + L, S.e0 + S.w];
  return [p.x - L, S.e0, p.x, S.e0 + S.w];
}
function deckStairLine(S, t) {
  const p = S.Pm.p;
  if (S.side === 'front') return [S.e0, p.y + p.d + t, S.e0 + S.w, p.y + p.d + t];
  if (S.side === 'back') return [S.e0, p.y - t, S.e0 + S.w, p.y - t];
  if (S.side === 'right') return [p.x + p.w + t, S.e0, p.x + p.w + t, S.e0 + S.w];
  return [p.x - t, S.e0, p.x - t, S.e0 + S.w];
}
// front elevation (x across, from the front) and right side elevation (y across, house on the left)
function deckElevSVG(pg, M, lines) {
  const b = M.b, T = M.T, gapX = 2400, fdep = Math.max(...M.plats.map(m => m.foot.depth));
  const xf = frameCanvas(pg, [M.X0 - 600, -fdep - 300, M.X0 + M.W + gapX + M.D + 600, M.wallTop + 300], [30, 30, 24, 26]); const Dr = frameDraw(xf), { X, Y } = xf;
  const sideX = y => M.X0 + M.W + gapX + (y - M.Y0);
  for (const [u0, u1, name] of [[M.X0 - 500, M.X0 + M.W + 500, 'Front elevation'], [sideX(M.Y0) - 500, sideX(M.Y0 + M.D) + 500, 'Right side elevation']]) {
    Dr.line(u0, 0, u1, 0, 'dkgrade'); Dr.text(X((u0 + u1) / 2), Y(M.wallTop) - 6, name, { size: 3, anchor: 'middle', bold: true });
  }
  if (M.plats.some(m => m.led)) Dr.rect(sideX(M.Y0) - 300, -300, sideX(M.Y0), M.wallTop + 600, 'dkhouse');
  for (const Pm of M.plats) {
    const p = Pm.p, ps = (lumberKey() === 'na' ? 5.5 * IN_MM : 145);
    for (const B of Pm.beams) for (const q of B.posts) {
      // front view: footings, piers and posts at x; side view at y
      for (const [u, ff] of [[p.x + q.x, true], [sideX(p.y + q.y), false]]) {
        if (!ff && B.posts.indexOf(q) > 0) continue;
        Dr.rect(u - Pm.foot.round / 2, -Pm.foot.depth, u + Pm.foot.round / 2, -Pm.foot.depth + Pm.foot.thick, 'dkfootel');
        Dr.rect(u - 5 * IN_MM, -Pm.foot.depth + Pm.foot.thick, u + 5 * IN_MM, 2 * IN_MM, 'dkfootel');
        if (!Pm.ground) Dr.rect(u - ps / 2, 2 * IN_MM, u + ps / 2, Pm.zBeamBot, 'dkpostel');
      }
      Dr.rect(sideX(p.y + B.y) - B.ply * T / 2, Pm.zBeamBot, sideX(p.y + B.y) + B.ply * T / 2, Pm.zBeamTop, 'dkbeamel');
    }
    if (Pm.beams.length) Dr.rect(p.x, Pm.zBeamBot, p.x + p.w, Pm.zBeamTop, 'dkbeamel');
    Dr.rect(p.x, Pm.zJ - Pm.jd, p.x + p.w, Pm.zJ, 'dkrimel'); Dr.rect(p.x, Pm.zJ, p.x + p.w, Pm.zTop, 'dkdeckel');
    Dr.rect(sideX(p.y), Pm.zJ - Pm.jd, sideX(p.y + p.d), Pm.zJ, 'dkjoistel'); Dr.rect(sideX(p.y), Pm.zJ, sideX(p.y + p.d), Pm.zTop, 'dkdeckel');
    Dr.dimV(X(p.x) - 6, Y(0), Y(Pm.zTop), fmtCut(Pm.zTop), true);
  }
  for (const R of M.rails) {
    const z0 = R.Pm.zTop, z1 = z0 + b.rail.h, u = R.along === 'x' ? (x => x) : sideX;
    if (R.along === 'x' && R.side !== 'front') continue; if (R.along === 'y' && R.side !== 'right') continue;
    Dr.rect(u(R.lo), z1 - 1.5 * IN_MM, u(R.hi), z1, 'dkrailel'); Dr.rect(u(R.lo), z0 + 3.5 * IN_MM, u(R.hi), z0 + 5 * IN_MM, 'dkrailel');
    for (let i = 0; i <= R.bays; i++) { const x = R.lo + i * R.bay; Dr.rect(u(x) - 1.75 * IN_MM, R.Pm.zJ - sizeDepth(R.Pm.rimSize), u(x) + 1.75 * IN_MM, z1 - 1.5 * IN_MM, 'dkpostel'); }
    for (let i = 0; i < R.bays; i++) for (let k = 0; k < R.bal; k++) { const x = R.lo + i * R.bay + 1.75 * IN_MM + R.balGap * (k + 1) + 1.5 * IN_MM * k; Dr.line(u(x) + 0.75 * IN_MM, z0 + 5 * IN_MM, u(x) + 0.75 * IN_MM, z1 - 1.5 * IN_MM, 'dkbal'); }
  }
  for (const S of M.stairs) {
    if (S.side !== 'front' && S.side !== 'back') continue; const p = S.Pm.p, y0 = S.side === 'front' ? p.y + p.d : p.y, dir = S.side === 'front' ? 1 : -1;
    const pts = [[sideX(y0), S.Pm.zTop]]; for (let i = 1; i < S.n; i++) { const z = S.Pm.zTop - i * S.riser; pts.push([sideX(y0 + dir * (i - 1) * S.tread), z], [sideX(y0 + dir * i * S.tread), z]); }
    pts.push([sideX(y0 + dir * (S.n - 1) * S.tread), S.toH]); pts.push([sideX(y0), S.toH]);
    Dr.poly(pts, 'dkstairel');
  }
  lines.push(`Footings bear on undisturbed soil at least ${fmtCut(Math.max(...M.plats.map(m => m.foot.depth)))} below grade or below the frost line, whichever is deeper. ${b.kind === 'free' ? 'The deck stands free of the house.' : b.kind === 'ground' ? 'Beams rest on brackets set in the piers.' : 'The ledger is fastened to the house band joist, with flashing above it.'}`);
  return { body: Dr.out.join(''), head: scaleText(xf.k) };
}
// stringer layout for each flight
function deckStairSVG(pg, M, lines) {
  const S = M.stairs[0]; if (!S) return { body: '', head: '' };
  const xf = frameCanvas(pg, [-300, -300, S.run + S.tread + 1200, S.rise + 600], [30, 30, 30, 30]); const Dr = frameDraw(xf), { X, Y } = xf;
  const pts = [[0, S.rise]]; for (let i = 1; i < S.n; i++) { const z = S.rise - i * S.riser; pts.push([(i - 1) * S.tread, z], [i * S.tread, z]); }
  // the stringer's lower edge leaves a 5" throat below the notches
  const a = Math.atan2(S.riser, S.tread), dz = 5 * IN_MM / Math.cos(a), z0 = S.rise - S.riser - dz, xe = Math.max((S.n - 1) * S.tread + 1, z0 * S.tread / S.riser);
  pts.push([(S.n - 1) * S.tread, 0], [xe, 0], [0, Math.min(S.rise - S.riser, z0)]);
  Dr.poly(pts, 'dkstringer');
  Dr.line(-300, 0, S.run + S.tread + 600, 0, 'dkgrade');
  Dr.dimV(X(-150), Y(S.rise - S.riser), Y(S.rise), fmtCut(S.riser), true);
  Dr.dimH(X(0), X(S.tread), Y(S.rise - S.riser) - 3, fmtCut(S.tread), true);
  Dr.dimV(X(S.run + S.tread + 450), Y(0), Y(S.rise), 'rise ' + fmtCut(S.rise), true);
  Dr.dimH(X(0), X(S.run), Y(0) + 8, 'run ' + fmtCut(S.run), true);
  M.stairs.forEach((R, i) => lines.push(`${R.name} ${i + 1}: ${R.n} risers of ${fmtCut(R.riser)} (7 3/4" or less), ${R.n - 1} treads of ${fmtCut(R.tread)} (${R.per} boards, 10" or more), ${fmtCut(R.w)} wide, ${R.nStr} ${sizeName(4)} stringers ${fmtCut(R.strLen)} long${R.supports ? `, ${R.supports} row of support posts (cut stringers span 6' or less)` : ''}. Leave at least 5" of stringer below the notches.`));
  return { body: Dr.out.join(''), head: scaleText(xf.k) };
}

// ---------- 3D ----------
function deckSolids(M, kind) {
  M._solids = M._solids || {}; if (M._solids[kind]) return M._solids[kind];
  const S = [], T = M.T, b = M.b, YF = M.Y0 + M.D, Yp = y => YF - y;   // plan y from the house, 3D y from the front
  const L = kind === 'exploded' ? Math.max(700, 0.45 * M.wallTop) : 0;
  // decking, treads and guards are drawn after the framing under them
  let top = false;
  const box = (x0, y0, z0, x1, y1, z1, c, dz = 0) => { if (x1 - x0 > 0.5 && Math.abs(y1 - y0) > 0.5 && z1 - z0 > 0.5) { const so = boxSolid(x0, Math.min(Yp(y0), Yp(y1)), z0 + dz, x1, Math.max(Yp(y0), Yp(y1)), z1 + dz, c); if (top) so.last = true; S.push(so); } };
  const n0 = S.length;
  for (const Pm of M.plats) { const p = Pm.p; for (const B of Pm.beams) for (const q of B.posts) box(p.x + q.x - 5 * IN_MM, p.y + q.y - 5 * IN_MM, -50, p.x + q.x + 5 * IN_MM, p.y + q.y + 5 * IN_MM, 2 * IN_MM, DKCOL.footing); }
  for (let i = n0; i < S.length; i++) S[i].floor = true;
  for (const Pm of M.plats) {
    const p = Pm.p, ox = p.x, oy = p.y, ps = (lumberKey() === 'na' ? 5.5 * IN_MM : 145) / 2;
    for (const B of Pm.beams) {
      for (const q of B.posts) if (!Pm.ground) box(ox + q.x - ps, oy + q.y - ps, 2 * IN_MM, ox + q.x + ps, oy + q.y + ps, Pm.zBeamBot, DKCOL.post);
      box(ox, oy + B.y - B.ply * T / 2, Pm.zBeamBot, ox + p.w, oy + B.y + B.ply * T / 2, Pm.zBeamTop, DKCOL.beam, L * 0.3);
    }
    const zj0 = Pm.zJ - Pm.jd, dz = L * 0.6;
    if (Pm.led) box(ox, oy, zj0, ox + p.w, oy + T, Pm.zJ, DKCOL.ledger, dz); else box(ox, oy, zj0, ox + p.w, oy + T, Pm.zJ, DKCOL.rim, dz);
    box(ox, oy + p.d - T, zj0, ox + p.w, oy + p.d, Pm.zJ, DKCOL.rim, dz);
    Pm.xs.forEach(x => box(ox + x, oy + T, zj0, ox + x + T, oy + p.d - T, Pm.zJ, DKCOL.joist, dz));
    if (kind !== 'framing') {
      top = true; const col = b.dk.mat === 'comp' ? DKCOL.comp : DKCOL.deck, dd = L * 1.0;
      if (b.dk.lay === 'diag') { const s0 = S.length; Pm.boards.forEach(q => { const pts = q.pts.map(([x, y]) => [ox + x, Yp(oy + y)]); const so = prismSolid(pts, (a, c, t) => [a, c, t], Pm.zJ + dd, Pm.zTop + dd, col); so.last = true; S.push(so); }); void s0; }
      else Pm.boards.forEach(q => { const bb = bboxOf([q.pts]); box(ox + bb[0], oy + bb[1], Pm.zJ, ox + bb[2], oy + bb[3], Pm.zTop, col, dd); });
      top = false;
    }
  }
  const dr = kind === 'exploded' ? L * 1.0 : 0; top = true;
  for (const R of M.rails) {
    const z0 = R.Pm.zTop, z1 = z0 + b.rail.h, Pm = R.Pm, inward = R.side === 'front' || R.side === 'right' ? -1 : 1, t = 3.5 * IN_MM;
    const at = (u, off) => R.along === 'x' ? [u, R.fixed + inward * off] : [R.fixed + inward * off, u];
    const bar = (u0, u1, za, zb, o0, o1, c) => { const a = at(u0, o0), e = at(u1, o1); box(Math.min(a[0], e[0]), Math.min(a[1], e[1]), za, Math.max(a[0], e[0]), Math.max(a[1], e[1]), zb, c, dr); };
    for (let i = 0; i <= R.bays; i++) { const u = R.lo + i * R.bay; bar(u - t / 2, u + t / 2, Pm.zJ - sizeDepth(Pm.rimSize), z1 - 1.5 * IN_MM, 0, t, DKCOL.post); }
    if (kind !== 'framing') {
      bar(R.lo, R.hi, z1 - 1.5 * IN_MM, z1, -0.5 * IN_MM, 5 * IN_MM, DKCOL.rail);
      bar(R.lo, R.hi, z1 - 5 * IN_MM, z1 - 1.5 * IN_MM, t, t + 1.5 * IN_MM, DKCOL.rail);
      bar(R.lo, R.hi, z0 + 3.5 * IN_MM, z0 + 5 * IN_MM, t, t + 1.5 * IN_MM, DKCOL.rail);
      for (let i = 0; i < R.bays; i++) for (let k = 0; k < R.bal; k++) { const u = R.lo + i * R.bay + t / 2 + R.balGap * (k + 1) + 1.5 * IN_MM * k; bar(u, u + 1.5 * IN_MM, z0 + 3.5 * IN_MM, z1 - 5 * IN_MM, t + 1.5 * IN_MM, t + 3 * IN_MM, DKCOL.rail); }
    }
  }
  top = false;
  for (const R of M.stairs) {
    const r = deckStairRect(R), dz = L * 0.6;
    for (let i = 1; i < R.n; i++) {
      const z = R.Pm.zTop - i * R.riser, t0 = (i - 1) * R.tread, t1 = i * R.tread;
      const seg = (R.side === 'front' || R.side === 'back') ? (R.side === 'front' ? [r[0], R.Pm.p.y + R.Pm.p.d + t0, r[2], R.Pm.p.y + R.Pm.p.d + t1] : [r[0], R.Pm.p.y - t1, r[2], R.Pm.p.y - t0]) : (R.side === 'right' ? [R.Pm.p.x + R.Pm.p.w + t0, r[1], R.Pm.p.x + R.Pm.p.w + t1, r[3]] : [R.Pm.p.x - t1, r[1], R.Pm.p.x - t0, r[3]]);
      box(seg[0], seg[1], z - M.dt - 9 * IN_MM, seg[2], seg[3], z - M.dt, DKCOL.stair, dz);
      top = true; if (kind !== 'framing') box(seg[0], seg[1], z - M.dt, seg[2], seg[3], z, b.dk.mat === 'comp' ? DKCOL.comp : DKCOL.deck, dz + L * 0.4); top = false;
    }
  }
  const all = S.flatMap(s => s.faces.flat());
  const res = { solids: S, labels: [], lift: L * 1.0, ex: 0, bounds: [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.min(...all.map(p => p[2])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1])), Math.max(...all.map(p => p[2]))] };
  M._solids[kind] = res; return res;
}

// ---------- hardware list ----------
const HW_COLS = () => [{ h: 'Item', w: 110 }, { h: 'Size or type', w: 120 }, { h: 'Qty', w: 30, a: 'middle' }, { h: 'Notes', w: 140 }];
function buildDeckReports(reps) {
  (P.buildings || []).forEach((b, bi) => {
    if (!isDeck(b)) return; const M = frameModel(b); if (!M.hw) return;
    const pg = P.pages.find(p => p.bld === b.id && p.view === 'dframe');
    mkReport(reps, { id: 'rep:hardware:' + b.id, report: 'hardware', bld: b.id, num: 'HW' + (bi + 1), desc: 'Hardware list ' + b.name, title: 'Hardware list ' + b.name },
      M.hw.map(h => ({ cells: [h.item, h.size, String(h.qty), h.note], link: pg ? pg.id : '' })), HW_COLS());
  });
}
