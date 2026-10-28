// ---------- DXF import and export, SVG and PNG export ----------
// Import reads ASCII DXF files from R12 to 2018: lines, polylines (with arcs and widths), circles, arcs, ellipses,
// splines, text, mtext, block inserts (nested), attributes, leaders and dimension blocks. Geometry goes onto a floor plan
// level as shapes, in real size (the file's units) at the level's drawing scale. Export writes the level as an R2000 DXF
// in inches (feet-and-inches projects) or millimetres (metric projects).
const DXF_UNITS = { 0: null, 1: 25.4, 2: 304.8, 3: 1609344, 4: 1, 5: 10, 6: 1000, 8: 0.0000254, 9: 0.0254, 10: 914.4, 14: 100 };
const DXF_UNIT_OPTS = [['25.4', 'Inches'], ['304.8', 'Feet'], ['1', 'Millimetres'], ['10', 'Centimetres'], ['1000', 'Metres']];
const ACI = { 1: '#e00000', 2: '#b59a00', 3: '#00a000', 4: '#009a9a', 5: '#0000e0', 6: '#b000b0', 8: '#808080', 9: '#a0a0a0' };

// ---------- reading ----------
function dxfParse(text) {
  if (/^AutoCAD Binary DXF/.test(text)) throw new Error('This is a binary DXF. Save it as an ASCII DXF and try again.');
  const L = text.split(/\r\n|\r|\n/); const pairs = [];
  for (let i = 0; i + 1 < L.length; i += 2) { const c = parseInt(L[i].trim(), 10); if (isNaN(c)) { i--; continue; } pairs.push([c, L[i + 1].replace(/^\s+|\s+$/g, '')]); }
  const out = { header: {}, layers: {}, blocks: {}, entities: [] };
  let i = 0;
  const records = (endTag) => { const recs = []; let cur = null; while (i < pairs.length) { const [c, v] = pairs[i]; if (c === 0) { if (v === 'ENDSEC' || v === endTag) break; cur = { type: v, g: [] }; recs.push(cur); } else if (cur) cur.g.push([c, v]); i++; } return recs; };
  while (i < pairs.length) {
    const [c, v] = pairs[i];
    if (c === 0 && v === 'SECTION') {
      const name = (pairs[i + 1] || [])[1]; i += 2;
      if (name === 'HEADER') { let vn = null; while (i < pairs.length && !(pairs[i][0] === 0 && pairs[i][1] === 'ENDSEC')) { const [cc, vv] = pairs[i]; if (cc === 9) vn = vv; else if (vn && !(vn in out.header)) out.header[vn] = vv; i++; } }
      else if (name === 'TABLES') { for (const r of records()) if (r.type === 'LAYER') { const n = dxfG(r, 2); if (n) out.layers[n] = { color: +dxfG(r, 62, 7), ltype: dxfG(r, 6, '') }; } }
      else if (name === 'BLOCKS') { let blk = null; for (const r of records()) { if (r.type === 'BLOCK') { blk = { name: dxfG(r, 2), base: [+dxfG(r, 10, 0), +dxfG(r, 20, 0)], ents: [] }; out.blocks[blk.name] = blk; } else if (r.type === 'ENDBLK') blk = null; else if (blk) blk.ents.push(r); } }
      else if (name === 'ENTITIES') out.entities = records();
      else records();
    }
    i++;
  }
  return out;
}
function dxfG(r, code, def) { const x = r.g.find(p => p[0] === code); return x ? x[1] : def; }
const dxfN = (r, code, def = 0) => { const v = dxfG(r, code); return v == null ? def : parseFloat(v); };
function mtextPlain(s) {
  return s.replace(/\\P/g, '\n').replace(/\\[ACcFfHhLlOoQqTtWwKk][^;\\{}]*;?/g, '').replace(/\\S([^;]*);/g, '$1').replace(/[{}]/g, '').replace(/\\~/g, ' ').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/\\\\/g, '\\');
}
// B-spline points by de Boor's algorithm (control points, knots, degree)
function bspline(cp, knots, deg, n = 64, w) {
  const out = []; const lo = knots[deg], hi = knots[knots.length - deg - 1];
  for (let s = 0; s <= n; s++) {
    const u = lo + (hi - lo) * s / n; let k = deg; while (k < knots.length - deg - 2 && u >= knots[k + 1]) k++;
    const d = []; for (let j = 0; j <= deg; j++) { const p = cp[k - deg + j] || cp[cp.length - 1]; const ww = w ? w[k - deg + j] || 1 : 1; d.push([p[0] * ww, p[1] * ww, ww]); }
    for (let r = 1; r <= deg; r++) for (let j = deg; j >= r; j--) { const i = k - deg + j; const den = knots[i + deg - r + 1] - knots[i]; const a = den ? (u - knots[i]) / den : 0; d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]]; }
    out.push([d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]]);
  }
  return out;
}
// one entity as shapes in "flipped file space" (file units, y pointing down like the plan)
function dxfEntity(r, f, ctx, depth) {
  const P2 = (cx, cy) => [dxfN(r, cx), -dxfN(r, cy)];
  const out = [];
  switch (r.type) {
    case 'LINE': out.push({ t: 'line', a: P2(10, 20), b: P2(11, 21) }); break;
    case 'LWPOLYLINE': {
      const pts = [], b = [], wd = []; let cur = null; const cw = dxfN(r, 43, 0);
      for (const [c, v] of r.g) {
        if (c === 10) { cur = { x: +v, y: 0, b: 0, s: cw, e: cw }; pts.push(cur); }
        else if (cur && c === 20) cur.y = +v; else if (cur && c === 42) cur.b = +v; else if (cur && c === 40) cur.s = +v; else if (cur && c === 41) cur.e = +v;
      }
      if (pts.length < 2) break;
      const closed = (dxfN(r, 70) & 1) === 1; const s = { t: 'pline', pts: pts.map(p => [p.x, -p.y]), closed };
      const nseg = closed ? pts.length : pts.length - 1;
      for (let k = 0; k < nseg; k++) { b.push(pts[k].b); wd.push([pts[k].s, pts[k].e]); }
      if (b.some(x => x)) s.b = b; if (wd.some(w => w[0] || w[1])) s.wd = wd;
      out.push(s); break;
    }
    case 'POLYLINE': {
      const fl = dxfN(r, 70); if (fl & (8 | 16 | 64)) { ctx.skipped.add('3D POLYLINE'); break; }
      const v = r.verts || []; if (v.length < 2) break; const closed = (fl & 1) === 1;
      const s = { t: 'pline', pts: v.map(x => [dxfN(x, 10), -dxfN(x, 20)]), closed }; const nseg = closed ? v.length : v.length - 1;
      const b = [], wd = []; for (let k = 0; k < nseg; k++) { b.push(dxfN(v[k], 42)); wd.push([dxfN(v[k], 40, dxfN(r, 40)), dxfN(v[k], 41, dxfN(r, 41))]); }
      if (b.some(x => x)) s.b = b; if (wd.some(w => w[0] || w[1])) s.wd = wd; out.push(s); break;
    }
    case 'CIRCLE': out.push({ t: 'circle', c: P2(10, 20), r: dxfN(r, 40) }); break;
    case 'ARC': out.push({ t: 'arc', c: P2(10, 20), r: dxfN(r, 40), a0: n360(dxfN(r, 50)), a1: n360(dxfN(r, 51)) }); break;
    case 'ELLIPSE': {
      const c = [dxfN(r, 10), dxfN(r, 20)], mj = [dxfN(r, 11), dxfN(r, 21)], ratio = dxfN(r, 40, 1); let t0 = dxfN(r, 41, 0), t1 = dxfN(r, 42, Math.PI * 2);
      const rx = Math.hypot(mj[0], mj[1]), rot = Math.atan2(mj[1], mj[0]) / D2R; const mn = [-mj[1] * ratio, mj[0] * ratio];
      if (Math.abs(t1 - t0 - Math.PI * 2) < 1e-6 || Math.abs(t1 - t0) < 1e-9) { out.push({ t: 'ellipse', c: [c[0], -c[1]], rx, ry: rx * ratio, rot: n360(rot) }); break; }
      if (t1 < t0) t1 += Math.PI * 2; const n = Math.max(8, Math.ceil((t1 - t0) / 0.1)); const pts = [];
      for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n; pts.push([c[0] + mj[0] * Math.cos(t) + mn[0] * Math.sin(t), -(c[1] + mj[1] * Math.cos(t) + mn[1] * Math.sin(t))]); }
      out.push({ t: 'pline', pts, closed: false }); break;
    }
    case 'SPLINE': {
      const fit = [], cp = [], kn = [], w = []; let lastFit = null, lastCp = null;
      for (const [c, v] of r.g) { if (c === 11) { lastFit = [+v, 0]; fit.push(lastFit); } else if (c === 21 && lastFit) lastFit[1] = +v; else if (c === 10) { lastCp = [+v, 0]; cp.push(lastCp); } else if (c === 20 && lastCp) lastCp[1] = +v; else if (c === 40) kn.push(+v); else if (c === 41) w.push(+v); }
      const closed = (dxfN(r, 70) & 1) === 1;
      if (fit.length >= 2) { out.push({ t: 'spline', pts: fit.map(p => [p[0], -p[1]]), closed: closed && fit.length > 2 }); break; }
      const deg = dxfN(r, 71, 3);
      if (cp.length >= 2 && kn.length === cp.length + deg + 1) { out.push({ t: 'pline', pts: bspline(cp, kn, deg, Math.max(16, cp.length * 8), w.length === cp.length ? w : null).map(p => [p[0], -p[1]]), closed: false }); break; }
      if (cp.length >= 2) out.push({ t: 'pline', pts: cp.map(p => [p[0], -p[1]]), closed });
      break;
    }
    case 'TEXT': case 'ATTRIB': {
      if (r.type === 'ATTRIB' && (dxfN(r, 70) & 1)) break;
      const al = dxfN(r, 72) || dxfN(r, 73); const p = al ? P2(11, 21) : P2(10, 20); const txt0 = mtextPlain(dxfG(r, 1, ''));
      const h72 = dxfN(r, 72); if (txt0) out.push(Object.assign({ t: 'text', p, text: txt0, h: dxfN(r, 40, 2.5), rot: n360(dxfN(r, 50)) }, h72 === 1 || h72 === 4 ? { align: 'center' } : h72 === 2 ? { align: 'right' } : {})); break;
    }
    case 'MTEXT': {
      let raw = ''; for (const [c, v] of r.g) if (c === 3 || c === 1) raw += v;
      const h = dxfN(r, 40, 2.5); let rot = dxfN(r, 50, 0); const dx = dxfG(r, 11); if (dx != null) rot = Math.atan2(dxfN(r, 21), dxfN(r, 11)) / D2R;
      const base = P2(10, 20); const lines = mtextPlain(raw).split('\n').filter(x => x.trim());
      lines.forEach((ln, k) => out.push({ t: 'text', p: rp(polarPt(base, h * (1 + k * 1.4), n360(rot) - 90)), text: ln, h, rot: n360(rot) })); break;
    }
    case 'LEADER': { const pts = []; let cur = null; for (const [c, v] of r.g) { if (c === 10) { cur = [+v, 0]; pts.push(cur); } else if (c === 20 && cur) cur[1] = -v; } if (pts.length >= 2) out.push({ t: 'pline', pts, closed: false }); break; }
    case 'INSERT': case 'DIMENSION': {
      const blk = f.blocks[dxfG(r, 2)]; if (!blk || depth > 12) { if (!blk) ctx.skipped.add('missing block'); break; }
      const ins = r.type === 'DIMENSION' ? [0, 0] : [dxfN(r, 10), dxfN(r, 20)]; const sx = r.type === 'DIMENSION' ? 1 : dxfN(r, 41, 1), sy = r.type === 'DIMENSION' ? 1 : dxfN(r, 42, 1), rot = r.type === 'DIMENSION' ? 0 : dxfN(r, 50, 0);
      const Ts = [tMove([-blk.base[0], blk.base[1]]), tScale([0, 0], Math.abs(sx))];
      if (sx * sy < 0) Ts.push(tMirror([0, 0], 90)); if (sy < 0) Ts.push(tRotate([0, 0], 180));
      if (rot) Ts.push(tRotate([0, 0], rot)); Ts.push(tMove([ins[0], -ins[1]]));
      for (const e of dxfSeq(blk.ents)) for (const s of dxfEntity(e, f, ctx, depth + 1)) { for (const T of Ts) transformShape(s, T); s._layer = s._layer === '0' || !s._layer ? dxfG(r, 8, '0') : s._layer; if (s._color == null) s._color = dxfN(r, 62, 256); out.push(s); }
      for (const a of r.attribs || []) out.push(...dxfEntity(a, f, ctx, depth + 1));
      return out;
    }
    case 'POINT': case 'HATCH': case 'SOLID': case '3DFACE': case 'VIEWPORT': case 'IMAGE': case 'ATTDEF': case 'SEQEND': case 'VERTEX': case 'MLEADER': case 'MULTILEADER': case 'WIPEOUT': case 'XLINE': case 'RAY': case 'REGION': case '3DSOLID': case 'OLE2FRAME': case 'TRACE':
      if (r.type !== 'SEQEND' && r.type !== 'VERTEX' && r.type !== 'ATTDEF') ctx.skipped.add(r.type); break;
    default: ctx.skipped.add(r.type);
  }
  for (const s of out) { s._layer = dxfG(r, 8, '0'); s._color = dxfN(r, 62, 256); s._lt = dxfG(r, 6, ''); }
  return out;
}
// POLYLINE + VERTEX + SEQEND and INSERT + ATTRIB + SEQEND become single records
function dxfSeq(recs) {
  const out = [];
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.type === 'POLYLINE') { r.verts = []; while (recs[i + 1] && recs[i + 1].type === 'VERTEX') r.verts.push(recs[++i]); if (recs[i + 1] && recs[i + 1].type === 'SEQEND') i++; out.push(r); }
    else if (r.type === 'INSERT') { r.attribs = []; while (recs[i + 1] && recs[i + 1].type === 'ATTRIB') r.attribs.push(recs[++i]); if (r.attribs.length && recs[i + 1] && recs[i + 1].type === 'SEQEND') i++; out.push(r); }
    else out.push(r);
  }
  return out;
}
function dxfRead(text) {
  const f = dxfParse(text); const ctx = { skipped: new Set() }; const shapes = [];
  for (const e of dxfSeq(f.entities)) shapes.push(...dxfEntity(e, f, ctx, 0));
  const ins = +(f.header.$INSUNITS || 0); const unit = DXF_UNITS[ins] || null;
  const pts = []; for (const s of shapes) { const b = shapeBox(s); if (isFinite(b[0]) && isFinite(b[2])) pts.push([b[0], b[1]], [b[2], b[3]]); }
  return { shapes, unit, metric: f.header.$MEASUREMENT === '1', layers: f.layers, box: pts.length ? bboxPts(pts) : null, skipped: [...ctx.skipped] };
}
// put read shapes on a level: o = { unit (mm per file unit), level, place: 'center' | 'origin', layers, fit }
function dxfPlace(d, lv, o) {
  const k = o.unit / lvScale(lv); let ox, oy;
  if (o.place === 'origin' || !d.box) { ox = DA.x0; oy = DA.y1; }
  else { ox = (DA.x0 + DA.x1) / 2 - (d.box[0] + d.box[2]) / 2 * k; oy = (DA.y0 + DA.y1) / 2 - (d.box[1] + d.box[3]) / 2 * k; }
  const T1 = tScale([0, 0], k), T2 = tMove([ox, oy]); const lmap = new Map(); const out = [];
  if (o.layers) { P.ulayers = P.ulayers || []; for (const name of new Set(d.shapes.map(s => s._layer || '0'))) { let l = P.ulayers.find(x => x.name === name); if (!l) { l = { id: 'L' + uid(), name }; P.ulayers.push(l); } lmap.set(name, l.id); } }
  for (const s0 of d.shapes) {
    const s = clone(s0); transformShape(s, T1); transformShape(s, T2);
    const lay = d.layers[s0._layer] || {}; const col = s0._color === 256 || s0._color == null ? lay.color : s0._color;
    if (ACI[Math.abs(col)]) s.color = ACI[Math.abs(col)];
    const lt = (s0._lt && s0._lt.toUpperCase() !== 'BYLAYER' ? s0._lt : lay.ltype || '').toUpperCase();
    if (/HIDDEN/.test(lt)) s.dash = 'hidden'; else if (/CENTER/.test(lt)) s.dash = 'center'; else if (/DASHDOT|PHANTOM/.test(lt)) s.dash = 'dashdot'; else if (/DASH/.test(lt)) s.dash = 'dash'; else if (/DOT/.test(lt)) s.dash = 'dot';
    if (o.layers) s.layer = lmap.get(s0._layer || '0');
    for (const kk of Object.keys(s)) if (kk[0] === '_') delete s[kk];
    if (s.t === 'text') s.h = r2(s.h * 1000) / 1000;
    s.id = uid(); out.push(s);
  }
  lvShapes(lv).push(...out); return out;
}
async function importDXF() {
  const r = await host.openText('DXF drawing', 'dxf'); if (!r) return;
  let d; try { d = dxfRead(r.content); } catch (e) { alert('Could not read ' + r.path + ': ' + e.message); return; }
  if (!d.shapes.length) { alert('No drawing found in ' + r.path + (d.skipped.length ? ' (only ' + d.skipped.join(', ') + ')' : '') + '.'); return; }
  dxfImportDlg(d, r.path.split(/[\\/]/).pop());
}
function dxfImportDlg(d, name) {
  const lvs = P.levels || []; const cur = isFloor(page()) && page().view !== 'sheet' ? page().level : (lvs[0] || {}).id;
  const unitDef = d.unit ? String(d.unit) : (d.metric ? '1' : '25.4');
  const size = u => d.box ? `${formatLength((d.box[2] - d.box[0]) * u)} x ${formatLength((d.box[3] - d.box[1]) * u)}` : '';
  dialog('Import DXF: ' + name, [['unit', 'Drawing units' + (d.unit ? ' (from the file)' : ' (the file does not say)'), unitDef, 'select', DXF_UNIT_OPTS], ['level', 'Put it on', cur || '__new', 'select', lvs.map(l => [l.id, l.name]).concat([['__new', 'A new level']])], ['newName', 'New level name', name.replace(/\.dxf$/i, '')],
    ['place', 'Position', 'center', 'select', [['center', 'Centered on the page'], ['origin', 'Drawing origin at the lower left corner']]], ['fit', 'Pick a drawing scale that fits the page', true, 'check'], ['layers', 'Keep the DXF layers as OpenSchem layers', true, 'check']], v => {
    const unit = +v.unit; let made = 0, scaleNote = '';
    commit(() => {
      let lv = lvs.find(l => l.id === v.level);
      if (!lv) { lv = { id: uid(), name: v.newName || 'Imported', rooms: [], places: [], shapes: [], image: null, scale: defaultScale() }; P.levels.push(lv); const num = 1; const np = newFloorPage(lv.id, num, lv.name, 'level'); P.pages.push(np); sortPages(); curId = np.id; }
      else { const pg = P.pages.find(p => p.kind === 'floor' && p.level === lv.id && p.view === 'level'); if (pg) curId = pg.id; }
      if (v.fit && d.box) {
        const w = (d.box[2] - d.box[0]) * unit, h = (d.box[3] - d.box[1]) * unit; const aw = DA.x1 - DA.x0 - 20, ah = DA.y1 - DA.y0 - 20;
        const opts = scaleOptions(unitsOf()).map(x => x[1]).sort((a, b) => a - b); const need = Math.max(w / aw, h / ah);
        const sc = opts.find(s => s >= need) || Math.ceil(need); if (Math.abs(sc - lvScale(lv)) > 1e-6 && (!lvShapes(lv).length || sc > lvScale(lv))) { lv.scale = sc; scaleNote = ', scale ' + formatScale(sc); }
      }
      made = dxfPlace(d, lv, { unit, place: v.place, layers: v.layers }).length; sel = new Set();
    });
    zoomFit(); flash(`Imported ${made} object(s)${scaleNote}${d.skipped.length ? '. Skipped: ' + d.skipped.join(', ') : ''}`);
  }, 'Import', `<div class="note">${d.shapes.length} object(s)${d.box ? ', ' + esc(size(+unitDef)) + ' in the file\'s units' : ''}. ${d.skipped.length ? 'Not imported: ' + esc(d.skipped.join(', ')) + '.' : ''}</div>`);
}

// ---------- writing (R2000) ----------
function dxfWriter() {
  const out = []; let h = 0x30;
  const w = { out, H: () => (h++).toString(16).toUpperCase(), g: (c, v) => { out.push(String(c), String(v)); }, next: () => (h).toString(16).toUpperCase() };
  return w;
}
const dxfNum = v => { const x = Math.round(v * 1e6) / 1e6; return Number.isFinite(x) ? String(x) : '0'; };
// the plan as simple primitives for export: { t: line | pline | circle | arc | ellipse | text, layer }
function exportPrims(lv) {
  const out = []; const add = (s, layer) => { if (s) out.push(Object.assign(s, { layer: s.layer && typeof s.layer === 'string' && s.layer.startsWith('L') ? ((userLayers().find(l => l.id === s.layer) || {}).name || layer) : layer })); };
  const cr = wallCorners(lv);
  for (const w of lvWalls(lv)) for (const p of wallPieces(lv, w, cr.get(w.id))) add({ t: 'pline', pts: p, closed: true, layer: w.layer }, 'A-WALL');
  for (const s of lvShapes(lv)) {
    if (s.t === 'wall') continue;
    const c = clone(s);
    if (s.t === 'opening') { const w = wallById(lv, s.wall); if (w) for (const x of openingPrims(s, w)) add(x, s.kind === 'window' ? 'A-GLAZ' : 'A-DOOR'); continue; }
    if (s.t === 'insert') { for (const x of insertShapes(s, lv, true)) add(x, 'A-FURN'); continue; }
    if (s.t === 'dim' || s.t === 'leader') { for (const x of annotPrims(lv, s)) add(x, 'A-ANNO-DIMS'); continue; }
    if (s.t === 'hatch') { for (const l of s.loops || []) add({ t: 'pline', pts: l, closed: true, layer: s.layer }, 'A-HATCH'); continue; }
    if (s.t === 'spline') { const o = shapeOutline(s); add({ t: 'pline', pts: o.pts, closed: o.closed, layer: s.layer }, '0'); continue; }
    add(c, s.t === 'text' ? 'A-ANNO-TEXT' : '0');
  }
  for (const r of lv.rooms) { add({ t: 'pline', pts: roomPoly(r).map(p => p.slice()), closed: true }, 'A-AREA'); const b = bboxPts(r.pts); add({ t: 'text', p: [(b[0] + b[2]) / 2 - r.name.length * 1.2, (b[1] + b[3]) / 2], text: r.name, h: 4, rot: 0 }, 'A-AREA-IDEN'); }
  for (const pl of lv.places) { const it = itemById(pl.item); add({ t: 'circle', c: [pl.x, pl.y], r: 2.5 }, 'E-DEVICE'); if (it && it.tag) add({ t: 'text', p: [pl.x + 3, pl.y + 1], text: dispTag(it.tag), h: 2, rot: 0 }, 'E-DEVICE-IDEN'); }
  return out;
}
function openingPrims(o, w) {
  const g = openingGeom(o, w); const out = []; const L = (a, b) => out.push({ t: 'line', a: rp(a), b: rp(b) });
  const leaf = (sh, so, len) => { const H = g.P(sh, g.f), J = g.P(so, g.f), E = g.out(H, len); L(H, E); const a = swingArc(H, J, E, len); if (a) out.push(a); };
  if (o.kind === 'window') { L(g.P(g.s0, g.ax.L), g.P(g.s1, g.ax.L)); L(g.P(g.s0, g.ax.R), g.P(g.s1, g.ax.R)); L(g.P(g.s0, g.mid), g.P(g.s1, g.mid)); }
  else if (o.kind === 'door') {
    const st = o.style || 'single', hA = (o.hinge || 'a') === 'a';
    if (st === 'single') hA ? leaf(g.s0, g.s1, o.w) : leaf(g.s1, g.s0, o.w);
    else if (st === 'double') { leaf(g.s0, g.at, o.w / 2); leaf(g.s1, g.at, o.w / 2); }
    else L(g.P(g.s0, g.mid), g.P(g.s1, g.mid));
  }
  if (o.tag && o.kind !== 'opening') out.push({ t: 'text', p: rp(g.out(g.P(g.at, g.back), -3)), text: o.tag, h: 2, rot: 0 });
  return out;
}
function annotPrims(lv, s) {
  if (s.t === 'leader') return [{ t: 'pline', pts: s.pts.slice(), closed: false }, { t: 'text', p: s.pts[s.pts.length - 1].slice(), text: String(s.text || '').split('\n')[0], h: 2.5, rot: 0 }];
  const ex = explodeOther(lv, s); if (ex) return ex;
  const P2 = dimPts(s, lv);
  if (s.kind === 'rad' || s.kind === 'dia') { const E = polarPt(P2.c, P2.r, ptAngle(P2.c, s.loc)); return [{ t: 'line', a: s.kind === 'dia' ? polarPt(P2.c, P2.r, ptAngle(P2.c, s.loc) + 180) : P2.c, b: E }, { t: 'text', p: s.loc.slice(), text: (s.kind === 'dia' ? 'DIA ' : 'R ') + formatLength(toRealMm(lv, s.kind === 'dia' ? 2 * P2.r : P2.r)), h: 2.5, rot: 0 }]; }
  return [];
}
function exportDXF() {
  const pg = page(); const lv = isFloor(pg) && pg.view !== 'sheet' ? levelOf(pg) : null;
  if (!lv) { flash('Open a floor plan level page to export it as DXF'); return; }
  const text = dxfWrite(lv); const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + ' - ' + lv.name.replace(/[\\/:*?"<>|]/g, '_') + '.dxf';
  host.saveFile(text, name, 'DXF drawing', 'dxf').then(p => { if (p) flash('Exported ' + p); });
}
function dxfWrite(lv) {
  const W = dxfWriter(), g = W.g; const metric = unitsOf() === 'metric'; const umm = metric ? 1 : 25.4; const ls = lvScale(lv);
  const X = p => (p[0] - DA.x0) * ls / umm, Y = p => (DA.y1 - p[1]) * ls / umm, S = v => v * ls / umm;
  const prims = exportPrims(lv); const layers = ['0', ...new Set(prims.map(p => p.layer || '0'))].filter((x, i, a) => a.indexOf(x) === i);
  const lname = n => String(n).replace(/[<>/\\":;?*|=,']/g, '_').slice(0, 250) || '0';
  // header
  const seedAt = () => { g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1015'); g(9, '$HANDSEED'); g(5, 'HANDSEED_PLACEHOLDER'); g(9, '$INSUNITS'); g(70, metric ? 4 : 1); g(9, '$MEASUREMENT'); g(70, metric ? 1 : 0); g(9, '$LUNITS'); g(70, metric ? 2 : 4); g(0, 'ENDSEC'); };
  seedAt(); g(0, 'SECTION'); g(2, 'CLASSES'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  const table = (name, entries, extra) => { const th = W.H(); g(0, 'TABLE'); g(2, name); g(5, th); g(330, 0); g(100, 'AcDbSymbolTable'); g(70, entries.length); if (extra) extra(); for (const e of entries) e(th); g(0, 'ENDTAB'); return th; };
  table('VPORT', [th => { g(0, 'VPORT'); g(5, W.H()); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbViewportTableRecord'); g(2, '*ACTIVE'); g(70, 0); g(10, 0); g(20, 0); g(11, 1); g(21, 1); g(12, dxfNum(X([(DA.x0 + DA.x1) / 2, 0]))); g(22, dxfNum(Y([0, (DA.y0 + DA.y1) / 2]))); g(13, 0); g(23, 0); g(14, 1); g(24, 1); g(15, 1); g(25, 1); g(16, 0); g(26, 0); g(36, 1); g(17, 0); g(27, 0); g(37, 0); g(40, dxfNum(S(DA.y1 - DA.y0) * 1.1)); g(41, 1.5); g(42, 50); g(43, 0); g(44, 0); g(50, 0); g(51, 0); g(71, 0); g(72, 100); g(73, 1); g(74, 3); g(75, 0); g(76, 0); g(77, 0); g(78, 0); }]);
  const lt = (th, name, desc, elems) => { g(0, 'LTYPE'); g(5, W.H()); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbLinetypeTableRecord'); g(2, name); g(70, 0); g(3, desc); g(72, 65); g(73, elems.length); g(40, dxfNum(elems.reduce((t, x) => t + Math.abs(x), 0))); for (const e of elems) { g(49, dxfNum(e)); g(74, 0); } };
  const dl = metric ? 12 : 0.5;
  table('LTYPE', [th => lt(th, 'ByBlock', '', []), th => lt(th, 'ByLayer', '', []), th => lt(th, 'Continuous', 'Solid line', []), th => lt(th, 'DASHED', 'Dashed __ __ __', [dl, -dl / 2]), th => lt(th, 'HIDDEN', 'Hidden _ _ _', [dl / 2, -dl / 4]), th => lt(th, 'CENTER', 'Center ____ _ ____', [dl * 1.25, -dl / 4, dl / 4, -dl / 4]), th => lt(th, 'DOT', 'Dot . . .', [0, -dl / 2]), th => lt(th, 'DASHDOT', 'Dash dot __ . __', [dl, -dl / 4, 0, -dl / 4])]);
  const LCOL = { 'A-WALL': 7, 'A-DOOR': 3, 'A-GLAZ': 4, 'A-AREA': 8, 'A-AREA-IDEN': 7, 'A-ANNO-DIMS': 1, 'A-ANNO-TEXT': 7, 'A-HATCH': 9, 'A-FURN': 6, 'E-DEVICE': 5, 'E-DEVICE-IDEN': 5 };
  table('LAYER', layers.map(n => th => { g(0, 'LAYER'); g(5, W.H()); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbLayerTableRecord'); g(2, lname(n)); g(70, 0); g(62, LCOL[n] || 7); g(6, 'Continuous'); g(370, -3); }));
  table('STYLE', [th => { g(0, 'STYLE'); g(5, W.H()); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbTextStyleTableRecord'); g(2, 'Standard'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 2.5); g(3, 'txt'); g(4, ''); }]);
  table('VIEW', []); table('UCS', []);
  table('APPID', [th => { g(0, 'APPID'); g(5, W.H()); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbRegAppTableRecord'); g(2, 'ACAD'); g(70, 0); }]);
  table('DIMSTYLE', [th => { g(0, 'DIMSTYLE'); g(105, W.H()); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbDimStyleTableRecord'); g(2, 'Standard'); g(70, 0); }], () => g(100, 'AcDbDimStyleTable'));
  let msH = null, psH = null;
  table('BLOCK_RECORD', [th => { msH = W.H(); g(0, 'BLOCK_RECORD'); g(5, msH); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbBlockTableRecord'); g(2, '*Model_Space'); }, th => { psH = W.H(); g(0, 'BLOCK_RECORD'); g(5, psH); g(330, th); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbBlockTableRecord'); g(2, '*Paper_Space'); }]);
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'BLOCKS');
  for (const [nm, br, ps] of [['*Model_Space', msH, false], ['*Paper_Space', psH, true]]) {
    g(0, 'BLOCK'); g(5, W.H()); g(330, br); g(100, 'AcDbEntity'); if (ps) g(67, 1); g(8, '0'); g(100, 'AcDbBlockBegin'); g(2, nm); g(70, 0); g(10, 0); g(20, 0); g(30, 0); g(3, nm); g(1, '');
    g(0, 'ENDBLK'); g(5, W.H()); g(330, br); g(100, 'AcDbEntity'); if (ps) g(67, 1); g(8, '0'); g(100, 'AcDbBlockEnd');
  }
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const ent = (type, s, sub) => { g(0, type); g(5, W.H()); g(330, msH); g(100, 'AcDbEntity'); g(8, lname(s.layer || '0')); if (s.dash) g(6, { dash: 'DASHED', hidden: 'HIDDEN', center: 'CENTER', dot: 'DOT', dashdot: 'DASHDOT' }[s.dash] || 'Continuous'); g(100, sub); };
  for (const s of prims) {
    if (s.t === 'line') { ent('LINE', s, 'AcDbLine'); g(10, dxfNum(X(s.a))); g(20, dxfNum(Y(s.a))); g(30, 0); g(11, dxfNum(X(s.b))); g(21, dxfNum(Y(s.b))); g(31, 0); }
    else if (s.t === 'pline') {
      if (s.pts.length < 2) continue; ent('LWPOLYLINE', s, 'AcDbPolyline'); g(90, s.pts.length); g(70, s.closed ? 1 : 0); g(43, 0);
      s.pts.forEach((p, i) => { g(10, dxfNum(X(p))); g(20, dxfNum(Y(p))); const w = (s.wd || [])[i]; if (w && (w[0] || w[1])) { g(40, dxfNum(S(w[0]))); g(41, dxfNum(S(w[1]))); } const b = (s.b || [])[i]; if (b) g(42, dxfNum(b)); });
    } else if (s.t === 'circle') { ent('CIRCLE', s, 'AcDbCircle'); g(10, dxfNum(X(s.c))); g(20, dxfNum(Y(s.c))); g(30, 0); g(40, dxfNum(S(s.r))); }
    else if (s.t === 'arc') { ent('ARC', s, 'AcDbCircle'); g(10, dxfNum(X(s.c))); g(20, dxfNum(Y(s.c))); g(30, 0); g(40, dxfNum(S(s.r))); g(100, 'AcDbArc'); g(50, dxfNum(s.a0)); g(51, dxfNum(s.a1)); }
    else if (s.t === 'ellipse') {
      let rx = s.rx, ry = s.ry, rot = s.rot || 0, sh = 0; if (ry > rx) { [rx, ry] = [ry, rx]; rot += 90; sh = -90; }
      const p0 = isEArc(s) ? n360(s.a0 + sh) * D2R : 0, p1 = isEArc(s) ? n360(s.a1 + sh) * D2R : Math.PI * 2;
      ent('ELLIPSE', s, 'AcDbEllipse'); g(10, dxfNum(X(s.c))); g(20, dxfNum(Y(s.c))); g(30, 0); g(11, dxfNum(S(rx) * Math.cos(rot * D2R))); g(21, dxfNum(S(rx) * Math.sin(rot * D2R))); g(31, 0); g(210, 0); g(220, 0); g(230, 1); g(40, dxfNum(ry / rx)); g(41, dxfNum(p0)); g(42, dxfNum(p1 <= p0 && isEArc(s) ? p1 + Math.PI * 2 : p1));
    } else if (s.t === 'text') {
      if (!s.text) continue; const al = s.align === 'center' ? 1 : s.align === 'right' ? 2 : 0;
      String(s.text).split('\n').forEach((ln, i) => {
        if (!ln) return; const p = polarPt(s.p, i * s.h * 1.25, (s.rot || 0) - 90);
        ent('TEXT', s, 'AcDbText'); g(10, dxfNum(X(p))); g(20, dxfNum(Y(p))); g(30, 0); g(40, dxfNum(S(s.h))); g(1, ln); g(50, dxfNum(s.rot || 0)); if (al) { g(72, al); g(11, dxfNum(X(p))); g(21, dxfNum(Y(p))); g(31, 0); } g(100, 'AcDbText');
      });
    }
  }
  g(0, 'ENDSEC');
  const dh = W.H(), gh = W.H();
  g(0, 'SECTION'); g(2, 'OBJECTS'); g(0, 'DICTIONARY'); g(5, dh); g(330, 0); g(100, 'AcDbDictionary'); g(281, 1); g(3, 'ACAD_GROUP'); g(350, gh); g(0, 'DICTIONARY'); g(5, gh); g(330, dh); g(100, 'AcDbDictionary'); g(281, 1); g(0, 'ENDSEC'); g(0, 'EOF');
  const seed = W.next(); const out = W.out; out[out.indexOf('HANDSEED_PLACEHOLDER')] = seed;
  return out.join('\r\n') + '\r\n';
}

// ---------- SVG and PNG ----------
// a stand-alone SVG of a page, sized in millimetres, with the screen styles written into the elements
function pageSvgText(pg) {
  PRINTING = true; const keep = sel; sel = new Set();
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-6000px;top:0;width:2400px;height:2400px;overflow:hidden'; document.body.appendChild(box);
  try {
    buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
    const sh = sheetOf(pg); useSheet(pg);
    box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sh.w} ${sh.h}" width="${sh.w}mm" height="${sh.h}mm">${pageSVG(pg, { print: true })}</svg>`;
    const el = box.firstElementChild;
    el.querySelectorAll('.hit,.wirehit,.vpframe,.rhandle,.grip').forEach(n => n.remove());
    el.querySelectorAll('[fill^="url(#gp"],[fill^="url(#fgp"]').forEach(n => n.remove());
    el.querySelectorAll('*').forEach(n => {
      const cs = getComputedStyle(n);
      for (const a of PDF_ATTRS) { const v = cs.getPropertyValue(a); if (v && v !== 'normal') n.setAttribute(a, v.replace(/px/g, '')); }
      if (n.tagName === 'text' && !n.getAttribute('font-family')) n.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      n.removeAttribute('class'); n.removeAttribute('data-id'); n.removeAttribute('style');
    });
    el.insertBefore(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'rect'), {}), el.firstChild);
    const bg = el.firstChild; bg.setAttribute('width', sh.w); bg.setAttribute('height', sh.h); bg.setAttribute('fill', '#ffffff');
    return { text: '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(el), w: sh.w, h: sh.h };
  } finally { box.remove(); PRINTING = false; sel = keep; render(); }
}
const fileBase = pg => ((P.name || 'project') + ' ' + pageName(pg)).replace(/[\\/:*?"<>|]/g, '_');
async function exportSVG() {
  const pg = page(); const r = pageSvgText(pg);
  const p = await host.saveFile(r.text, fileBase(pg) + '.svg', 'SVG image', 'svg'); if (p) flash('Exported ' + p);
}
function svgToPng(svgText, wmm, hmm, dpi) {
  return new Promise((res, rej) => {
    const px = Math.round(wmm / 25.4 * dpi), py = Math.round(hmm / 25.4 * dpi);
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = px; c.height = py; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, py); g.drawImage(img, 0, 0, px, py); res(c.toDataURL('image/png')); };
    img.onerror = () => rej(new Error('the page could not be drawn as an image'));
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText.replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="${px}" height="${py}"`))));
  });
}
function exportPNG() {
  const pg = page();
  dialog('Export PNG image', [['dpi', 'Resolution', '150', 'select', [['96', '96 dpi (screen)'], ['150', '150 dpi'], ['300', '300 dpi (print)']]]], async v => {
    try { const r = pageSvgText(pg); const url = await svgToPng(r.text, r.w, r.h, +v.dpi); const p = await host.saveBinary(url.split(',')[1], fileBase(pg) + '.png', 'PNG image', 'png'); if (p) flash('Exported ' + p); }
    catch (e) { alert('PNG export failed: ' + e.message); }
  }, 'Export');
}

registerCommand('DXFIN', ['IMPORT', 'DXFIMPORT'], 'Import a DXF drawing onto a floor plan level', () => importDXF());
registerCommand('DXFOUT', ['DXFEXPORT'], 'Export this floor plan level as a DXF file', () => exportDXF());
registerCommand('SVGOUT', ['SVG'], 'Export this page as an SVG image', () => exportSVG());
registerCommand('PNGOUT', ['PNG'], 'Export this page as a PNG image', () => exportPNG());
