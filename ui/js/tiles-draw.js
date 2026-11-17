// ---------- tile layouts: the tile page, the cut list and the tile order ----------
// TLM is the tool state on a tile page: picking the start point or drawing an added or cut-out area (two corners).
const TLM = { mode: null, page: null, a: null, cur: null, press: null };
const tileLen = v => tmet() ? Math.round(v) + ' mm' : fmtCut(v);
function tileHeadText(T, L) {
  const t = T.tile, sz = t.pattern === 'versailles' ? `${tileLen(t.w)} module` : t.pattern === 'hex' ? `${tileLen(t.w)} hexagon` : tileSizeName(t.w, t.h);
  const pat = TILE_PATTERN_NAMES[t.pattern] + (t.pattern === 'bond' ? (Math.abs(t.bond - 1 / 3) < 0.01 ? ' (1/3 offset)' : ' (1/2 offset)') : '') + (t.rot ? ` at ${+(+t.rot).toFixed(1)}°` : '');
  const full = L.tiles.filter(x => x.full).length;
  return `${sz} tile, ${tileLen(t.joint)} joint, ${pat}  ·  ${full} full, ${L.cuts.length} cut${L.slivers.length ? ', ' + L.slivers.length + ' too thin' : ''}`;
}
function tilePageSVG(pg) {
  const all = allPages(); let s = frameSVG(pg, all.indexOf(pg), all.length);
  const T = tileOf(pg); if (!T) return s + txt(SH.x0 + 10, SH.hdr + 20, 'This page belongs to a tile layout that no longer exists.', { size: 3.5 });
  const L = tileLayout(T);
  if (L.err) {
    s += txt(SH.x0 + 6, SH.hdr + 12, T.name + ': the layout cannot be drawn', { size: 4, cls: 'tw' });
    return s + txt(SH.x0 + 6, SH.hdr + 22, L.err, { size: 3 });
  }
  const g = L.geom, bb = bboxOf(g.pos), t = T.tile, wall = T.surf === 'wall';
  const xf = frameCanvas(pg, bb, [34, 40, 26, 22]), D = frameDraw(xf), { X, Y } = xf, out = D.out;
  const poly = (pts, cls, extra = '') => out.push(`<polygon class="${cls}" points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"${extra}/>`);
  const cen = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  for (const x of L.tiles) {
    if (x.full) poly(x.pts, 'tlf' + (x.ref ? ' tlst' : ''));
    else for (const q of x.pieces) poly(q, 'tlc' + (x.sliver ? ' tls' : '') + (x.ref ? ' tlst' : ''));
  }
  for (const p of g.pos.slice(0, 1)) poly(p, 'tlwall');
  (T.adds || []).forEach(a => poly(hull(a.pts), 'tladd' + (sel.has(a.id) ? ' tlsel' : ''), ` data-id="${a.id}"`));
  for (const n0 of g.neg) {
    const n = Object.assign({}, n0, { pts: clipConvex(n0.pts, ccwRect(bb[0], bb[1], bb[2], bb[3])) }); if (n.pts.length < 3) continue;
    poly(n.pts, n.id ? 'tlcut' + (sel.has(n.id) ? ' tlsel' : '') : 'tlhole', n.id ? ` data-id="${n.id}"` : '');
    const b = bboxOf([n.pts]), c = cen(n.pts);
    if ((b[2] - b[0]) / xf.k > 10 && (b[3] - b[1]) / xf.k > 4) D.text(X(c[0]), Y(c[1]) + 0.8, n.label || '', { size: 2.2, anchor: 'middle', cls: 'tc' });
  }
  for (const x of L.slivers) { const c = cen(x.pieces[0]); out.push(`<circle class="tlsm" cx="${X(c[0])}" cy="${Y(c[1])}" r="1.6"/>`); }
  // chalk lines through the joints at the starting tile, dimensioned from the left and bottom (or the floor on a wall)
  const pad = 6 * xf.k, box = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
  for (const d of [L.ux, L.uy]) { const sg = lineInBox(L.C, d, box); if (sg) D.line(sg[0][0], sg[0][1], sg[1][0], sg[1][1], 'tlchalk'); }
  if (L.start) { const c = cen(L.start.pts); D.text(X(c[0]), Y(c[1]) + 0.9, 'Start', { size: 2.4, anchor: 'middle', bold: true, cls: 'frta' }); }
  out.push(`<path class="tlstp" d="M${r2(X(L.O[0]) - 2)},${Y(L.O[1])}h4M${X(L.O[0])},${r2(Y(L.O[1]) - 2)}v4"/>`);
  const yb = Y(bb[1]) + 8, xl = X(bb[0]) - 9, ends = wall ? ['left end', 'floor'] : ['left wall', 'bottom wall'];
  // the point where the chalk lines cross, measured from the left and the bottom
  const cross = [], C = L.C;
  if (C[0] > bb[0] + 1 && C[0] < bb[2] - 1) { D.ext(X(C[0]), Y(C[1]), X(C[0]), yb + 1.5); D.dimH(X(bb[0]), X(C[0]), yb, fmtCut(C[0] - bb[0]), true); cross.push(`${fmtCut(C[0] - bb[0])} from the ${ends[0]}`); }
  if (C[1] > bb[1] + 1 && C[1] < bb[3] - 1) { D.ext(X(C[0]), Y(C[1]), xl - 1.5, Y(C[1])); D.dimV(xl, Y(bb[1]), Y(C[1]), fmtCut(C[1] - bb[1]), true); cross.push(`${fmtCut(C[1] - bb[1])} ${wall ? 'up from the' : 'from the'} ${ends[1]}`); }
  D.dimH(X(bb[0]), X(bb[2]), yb + 7, fmtCut(bb[2] - bb[0])); D.dimV(xl - 7, Y(bb[1]), Y(bb[3]), fmtCut(bb[3] - bb[1]));
  // preview of an area being drawn
  if (TLM.page === pg.id && TLM.a && TLM.cur) { const [a, c] = [TLM.a, TLM.cur]; poly(ccwRect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])), TLM.mode === 'cut' ? 'tlcut tlprev' : 'tladd tlprev'); }
  let foot = SH.tb - 14;
  const note = (str, cls) => { s += txt(SH.x0 + 6, foot, str, { size: 2.6, cls }); foot -= 4.2; };
  if (g.lost) note(`${tileSrcLabel(T)} is gone. This layout keeps its last outline.`, 'tw');
  note((cross.length ? 'The chalk lines cross ' + cross.join(' and ') + (t.rot ? ', turned ' + +(+t.rot).toFixed(1) + '°' : '') + '. ' : '') + 'The start point is marked +.');
  note('Light tiles are full, shaded tiles are cut, red tiles are thinner than the smallest cut (' + (t.minCut > 0 ? tileLen(t.minCut) : '1/3 tile') + '). Dashed lines are the chalk lines.');
  s += txt(SH.x0 + 4, SH.hdr + 6, `${T.name}  ·  ${tileSrcLabel(T)}  ·  ${tileHeadText(T, L)}  ·  ${scaleText(xf.k)}`, { size: 3, cls: 'tc' });
  return s + out.join('');
}

// ---------- reports ----------
const TCUT_COLS = () => [{ h: 'Tile', w: 70 }, { h: 'Cut size', w: 90 }, { h: 'Shape', w: 60 }, { h: 'Qty', w: 25, a: 'middle' }, { h: 'Cut from', w: 60 }, { h: 'Notes', w: 95 }];
const TORD_COLS = () => [{ h: 'Item', w: 110 }, { h: 'Tile or material', w: 110 }, { h: 'Qty', w: 50, a: 'middle' }, { h: 'Notes', w: 130 }];
function tileCutGroups(T, L) {
  const plan = tileCutPlan(T, L), g = new Map();
  for (const { c, from } of plan.rows) {
    const src = from === 'New tile' ? 'New tile' : 'Offcut';
    const k = [c.k, c.shape, Math.round(c.lw * 2), Math.round(c.lh * 2), c.shape === 'Straight cut' ? 0 : Math.round(c.area / (c.w * c.h) * 100), src, c.sliver].join('|');
    if (!g.has(k)) g.set(k, { c, src, qty: 0 }); g.get(k).qty++;
  }
  return [...g.values()].sort((a, b) => a.c.k.localeCompare(b.c.k) || b.c.lw * b.c.lh - a.c.lw * a.c.lh || a.src.localeCompare(b.src));
}
function tileOrderRows(T, L) {
  const O = tileOrder(T, L), rows = [], t = T.tile;
  rows.push(['Area tiled', '', fmtArea(O.area), tileOnWall(T) ? 'wall less openings and cut-outs' : 'floor less fixtures and cut-outs']);
  for (const r of O.rows) {
    rows.push(['Full tiles', r.label, String(r.full), '']);
    rows.push(['Cut tiles', r.label, String(r.cuts), r.cuts - r.cutTiles ? (r.cuts - r.cutTiles) + ' cut from offcuts' : '']);
    rows.push(['Tiles needed', r.label, String(r.need), 'full tiles plus tiles for cuts']);
    rows.push(['Tiles to order', r.label, String(r.order), 'with ' + O.waste + '% for waste and breakage']);
    rows.push(['Boxes', r.label, String(r.boxes), r.per + ' tiles per box' + (t.perBox > 0 ? '' : ' (about ' + (tmet() ? '1 m²' : '10 sq ft') + ', set the real count in the order settings)')]);
  }
  rows.push(['Grout', tileLen(t.joint) + ' joints, ' + tileLen(t.thick) + ' deep', fmtWeight(O.groutKg), groutBags(O.groutKg) + ', estimate']);
  rows.push(['Thinset', O.trowel + ' trowel', fmtWeight(O.thinKg), thinBags(O.thinKg) + ', estimate']);
  return rows;
}
const tileOnWall = T => T.surf === 'wall';
function buildTileReports(reps) {
  (P.tiles || []).forEach((T, i) => {
    const L = tileLayout(T); if (L.err) return;
    const pg = P.pages.find(p => isTile(p) && p.tile === T.id), link = pg ? pg.id : '', n = i + 1;
    const cr = [];
    for (const x of tileCutGroups(T, L)) cr.push({ cells: [tileSizeLabel(T.tile, x.c.k), tileSizeName(x.c.lw, x.c.lh), x.c.shape === 'Straight cut' ? x.c.shape : x.c.shape + ', ' + Math.round(x.c.area / (x.c.w * x.c.h) * 100) + '% kept', String(x.qty), x.src, x.c.sliver ? 'thinner than the smallest cut' : ''], link, goto: link ? 'page:' + link : '' });
    if (!cr.length) cr.push({ cells: ['No cut tiles', '', '', '', '', ''], link });
    cr.push({ cells: ['Total cut tiles', '', '', String(L.cuts.length), '', ''], cls: 'grp' });
    mkReport(reps, { id: 'rep:tilecuts:' + T.id, report: 'tilecuts', tile: T.id, num: 'TCL' + n, desc: 'Tile cut list ' + T.name, title: 'Tile cut list ' + T.name }, cr, TCUT_COLS());
    mkReport(reps, { id: 'rep:tileorder:' + T.id, report: 'tileorder', tile: T.id, num: 'TOR' + n, desc: 'Tile order ' + T.name, title: 'Tile order ' + T.name }, tileOrderRows(T, L).map(c => ({ cells: c, link })), TORD_COLS());
  });
}
async function tileExportXlsx() {
  const list = (P.tiles || []).map(T => ({ T, L: tileLayout(T) })).filter(x => !x.L.err);
  if (!list.length) { flash('No tile layouts in the project yet'); return; }
  const sheets = [], used = new Set();
  const nm = s => { let n = s.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31); let i = 2; while (used.has(n)) n = (s.slice(0, 27) + ' ' + i++).slice(0, 31); used.add(n); return n; };
  for (const { T, L } of list) {
    sheets.push({ name: nm('Cuts ' + T.name), rows: [['Tile', 'Cut size', 'Width (mm)', 'Height (mm)', 'Shape', 'Qty', 'Cut from', 'Notes']].concat(tileCutGroups(T, L).map(x => [tileSizeLabel(T.tile, x.c.k), tileSizeName(x.c.lw, x.c.lh), Math.round(x.c.lw), Math.round(x.c.lh), x.c.shape, x.qty, x.src, x.c.sliver ? 'thinner than the smallest cut' : ''])) });
    sheets.push({ name: nm('Order ' + T.name), rows: [['Item', 'Tile or material', 'Qty', 'Notes']].concat(tileOrderRows(T, L)) });
  }
  const bytes = buildXlsx(sheets);
  const p = await host.saveBinary(b64Encode(bytes), (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' tile layouts.xlsx', 'Excel workbook', 'xlsx'); if (p) flash('Exported ' + p);
}
