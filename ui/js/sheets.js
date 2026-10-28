// ---------- view sheets: several views of floor plans on one page ----------
// A view sheet is a floor plan page with view 'sheet' and a list of views in pg.vps:
// { id, level, show: 'level' | 'room' | 'area', room, area: [x0, y0, x1, y1] (plan), rect: [x0, y0, x1, y1] (sheet mm),
//   scale: real/paper ratio (0 = fit the view box), title, showTitle }. Each view draws the level at its own scale;
// the geometry is edited on the level's own pages.
const isSheet = pg => isFloor(pg) && pg.view === 'sheet';
let vdrag = null;
function vpLevel(v) { return (P.levels || []).find(l => l.id === v.level); }
function vpRegion(v, lv) {
  if (v.show === 'room') { const r = lv.rooms.find(r => r.id === v.room); if (r) return bboxPts(r.pts, 8); }
  if (v.show === 'area' && v.area) return v.area;
  const pts = [];
  for (const r of lv.rooms) pts.push(...r.pts);
  for (const s of lvShapes(lv)) { const b = shapeBox(s); if (isFinite(b[0])) pts.push([b[0], b[1]], [b[2], b[3]]); }
  for (const pl of lv.places) pts.push([pl.x, pl.y]);
  return pts.length ? bboxPts(pts, 8) : [DA.x0, DA.y0, DA.x1, DA.y1];
}
function vpXform(v) {
  const lv = vpLevel(v); if (!lv) return null; const a = vpRegion(v, lv), r = v.rect;
  const fit = Math.min((r[2] - r[0]) / Math.max(1, a[2] - a[0]), (r[3] - r[1]) / Math.max(1, a[3] - a[1]));
  const s = v.scale > 0 ? lvScale(lv) / v.scale : fit;
  return { s, tx: (r[0] + r[2]) / 2 - s * (a[0] + a[2]) / 2, ty: (r[1] + r[3]) / 2 - s * (a[1] + a[3]) / 2, lv };
}
const vpScaleText = (v, t) => v.scale > 0 ? formatScale(v.scale) : (t ? formatScale(r2(lvScale(t.lv) / t.s)) + ' (fit)' : '');
function vpTitle(v) { const lv = vpLevel(v); if (v.title) return v.title; if (!lv) return 'View'; if (v.show === 'room') { const r = lv.rooms.find(r => r.id === v.room); return r ? r.name : lv.name; } return lv.name; }
function sheetViewsSVG(pg, o = {}) {
  let s = '';
  for (const v of pg.vps || []) {
    const t = vpXform(v); const [x0, y0, x1, y1] = v.rect; const isSel = !o.print && sel.has(v.id);
    if (t) {
      s += `<defs><clipPath id="vpc-${v.id}"><rect x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}"/></clipPath></defs>`;
      s += `<g clip-path="url(#vpc-${v.id})"><g transform="translate(${r2(t.tx)},${r2(t.ty)}) scale(${r2(t.s * 1e4) / 1e4})">${floorContentSVG(pg, t.lv, t, Object.assign({}, o, { vp: true, hideLayers: v.hide || [] }))}</g></g>`;
    }
    if (v.showTitle !== false) {
      s += `<path d="M${x0},${r2(y1 + 2)}H${r2(Math.min(x1, x0 + 70))}" stroke="#222" stroke-width="0.35"/>`;
      s += txt(x0, y1 + 6, vpTitle(v), { size: 3.2, bold: true }) + txt(x0, y1 + 9.6, vpScaleText(v, t), { size: 2.3 });
    }
    if (!o.print) {
      s += `<rect class="vpframe${isSel ? ' vpsel' : ''}" data-vp="${v.id}" x="${x0}" y="${y0}" width="${r2(x1 - x0)}" height="${r2(y1 - y0)}"/>`;
      if (isSel) [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach((p, i) => { s += `<rect class="rhandle" data-vph="${v.id}:${i}" x="${r2(p[0] - 1.3)}" y="${r2(p[1] - 1.3)}" width="2.6" height="2.6"/>`; });
    }
  }
  if (!(pg.vps || []).length && !o.print) s += txt((DA.x0 + DA.x1) / 2, (DA.y0 + DA.y1) / 2, 'Empty view sheet: use Add view and drag a box for each view', { size: 4, anchor: 'middle' });
  return s;
}

// ---------- mouse on a view sheet ----------
function sheetDown(e, pg, mx, my) {
  if (mode === 'vpadd') { fbox = { start: [mx, my], cur: [mx, my], vpadd: true }; return; }
  if (mode !== 'select') { setMode('select'); flash('Draw on the level pages; this page shows views of them'); return; }
  const h = e.target.closest('[data-vph]');
  if (h) { const [id, i] = h.dataset.vph.split(':'); const v = pg.vps.find(x => x.id === id); if (v) fdrag = { vp: v, corner: +i, start: [mx, my], orig: v.rect.slice(), pre: snapshot(), moved: false }; return; }
  const f = e.target.closest('[data-vp]');
  if (f) { const v = pg.vps.find(x => x.id === f.dataset.vp); if (v) { sel = new Set([v.id]); render(); fdrag = { vp: v, start: [mx, my], orig: v.rect.slice(), pre: snapshot(), moved: false }; } return; }
  sel.clear(); render();
}
function sheetMove(pg, mx, my) {
  $('#st-pos').textContent = `X ${r2(mx)}  Y ${r2(my)} mm  |  Page ${pageName(pg)}`;
  if (fbox && fbox.vpadd) { fbox.cur = [mx, my]; const [a, b] = fbox.start, [c, d] = fbox.cur; $('#overlay').innerHTML = `<rect class="selbox win" x="${Math.min(a, c)}" y="${Math.min(b, d)}" width="${Math.abs(c - a)}" height="${Math.abs(d - b)}"/>`; return; }
  if (!fdrag || !fdrag.vp) return;
  const dx = Math.round(mx - fdrag.start[0]), dy = Math.round(my - fdrag.start[1]); const o = fdrag.orig; let r;
  if (fdrag.corner == null) r = [o[0] + dx, o[1] + dy, o[2] + dx, o[3] + dy];
  else { r = o.slice(); const i = fdrag.corner; if (i === 0 || i === 3) r[0] = o[0] + dx; else r[2] = o[2] + dx; if (i === 0 || i === 1) r[1] = o[1] + dy; else r[3] = o[3] + dy; r = [Math.min(r[0], r[2] - 10), Math.min(r[1], r[3] - 10), Math.max(r[2], r[0] + 10), Math.max(r[3], r[1] + 10)]; }
  fdrag.vp.rect = r; fdrag.moved = true; renderCanvas();
}
function sheetUp(pg) {
  if (fbox && fbox.vpadd) {
    const [a, b] = fbox.start, [c, d] = fbox.cur; fbox = null; $('#overlay').innerHTML = '';
    if (Math.abs(c - a) < 15 || Math.abs(d - b) < 15) { flash('Drag a bigger box for the view'); return; }
    setMode('select'); addViewDlg(pg, [Math.round(Math.min(a, c)), Math.round(Math.min(b, d)), Math.round(Math.max(a, c)), Math.round(Math.max(b, d))]); return;
  }
  if (fdrag && fdrag.vp) { if (fdrag.moved) { pushUndo(fdrag.pre); markDirty(); render(); } fdrag = null; }
}
function vpScaleOpts(cur) { return [['0', 'Fit the box']].concat(scaleOptions(unitsOf()).map(x => [String(x[1]), x[0]])).concat(cur > 0 && !scaleOptions(unitsOf()).some(x => x[1] === cur) ? [[String(cur), formatScale(cur)]] : []); }
function vpShowOpts(lv) {
  const out = [['level', 'Whole level']];
  for (const r of lv.rooms) out.push(['room:' + r.id, 'Room: ' + r.name]);
  for (const p of P.pages) if (p.kind === 'floor' && p.level === lv.id && p.view === 'area' && p.area) out.push(['area:' + p.id, 'Area of page ' + pageName(p)]);
  return out;
}
function addViewDlg(pg, rect) {
  const lvs = P.levels || []; if (!lvs.length) { flash('Draw a floor plan level first'); return; }
  const lv = vpLevel({ level: pg.level }) || lvs[0];
  dialog('Add view', [['level', 'Level', lv.id, 'select', lvs.map(l => [l.id, l.name])], ['show', 'Shows', 'level', 'select', vpShowOpts(lv)], ['scale', 'Scale', '0', 'select', vpScaleOpts(0)], ['title', 'Title (blank: the level or room name)', '']], v => {
    const L = lvs.find(l => l.id === v.level) || lv; const vp = { id: uid(), level: L.id, show: 'level', rect, scale: +v.scale || 0, title: v.title };
    if (v.level === lv.id) vpApplyShow(vp, v.show, L);
    commit(() => { pg.vps = pg.vps || []; pg.vps.push(vp); sel = new Set([vp.id]); });
  }, 'Add', '<div class="note">Pick the room or area after choosing another level in the properties panel.</div>');
}
function vpApplyShow(vp, val, lv) {
  const [k, id] = String(val).split(':'); vp.show = k; delete vp.room; delete vp.area;
  if (k === 'room') vp.room = id;
  if (k === 'area') { const p = P.pages.find(x => x.id === id); if (p && p.area) vp.area = p.area.slice(); else vp.show = 'level'; }
}
function vpOpen(v) {
  const lv = vpLevel(v); if (!lv) return;
  const pg = (v.show === 'room' && P.pages.find(p => p.kind === 'floor' && p.level === lv.id && p.view === 'room' && p.room === v.room)) || P.pages.find(p => p.kind === 'floor' && p.level === lv.id && p.view === 'level');
  if (pg) { goPage(pg.id); zoomFit(); }
}
function renderSheetProps(pg) {
  const el = $('#props'); const v = (pg.vps || []).find(x => sel.has(x.id));
  if (!v) {
    el.innerHTML = `<div class="ident">${esc(pageName(pg))}</div><div class="sub">${esc(pg.desc)} · View sheet</div><div class="pgrp"><h4>Page</h4>${row('fpg.desc', 'Description', pg.desc)}</div>
      <div class="pgrp"><h4>Views</h4>${(pg.vps || []).map(x => `<div class="fnlist"><div data-vpsel="${x.id}"><span>${esc(vpTitle(x))}</span><span class="r">${esc(vpScaleText(x, vpXform(x)))}</span></div></div>`).join('') || '<div class="note">No views yet.</div>'}
      <div class="btnrow"><button class="btn primary" data-act="addView">Add view</button></div><div class="note">Drag a box on the page for each view. Drag a view to move it, its corners to resize it; double click it to open the level.</div></div>`;
    return;
  }
  const lv = vpLevel(v); const lvs = P.levels || []; const opt = (pairs, cur) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const showCur = v.show === 'room' ? 'room:' + v.room : v.show === 'area' ? (P.pages.find(p => p.area && v.area && p.area.join() === v.area.join()) ? 'area:' + P.pages.find(p => p.area && v.area && p.area.join() === v.area.join()).id : 'level') : 'level';
  el.innerHTML = `<div class="ident">${esc(vpTitle(v))}</div><div class="sub">View, ${esc(vpScaleText(v, vpXform(v)))}</div>
    <div class="pgrp"><h4>View</h4>${row('vp.level', 'Level', '', 'select', opt(lvs.map(l => [l.id, l.name]), v.level))}${lv ? row('vp.show', 'Shows', '', 'select', opt(vpShowOpts(lv), showCur)) : ''}
    ${row('vp.scale', 'Scale', '', 'select', opt(vpScaleOpts(v.scale), String(v.scale || 0)))}${row('vp.title', 'Title', v.title || '', 'text', `placeholder="${esc(vpTitle(Object.assign({}, v, { title: '' })))}"`)}
    <div class="prow"><label>Show title</label><input type="checkbox" data-k="vp.showTitle" ${v.showTitle === false ? '' : 'checked'} style="width:auto"></div></div>
    ${userLayers().length ? `<div class="pgrp"><h4>Layers in this view</h4>${userLayers().map(l => `<div class="prow"><label>${esc(l.name)}</label><input type="checkbox" data-k="vp.ly.${esc(l.id)}" ${(v.hide || []).includes(l.id) ? '' : 'checked'} style="width:auto"></div>`).join('')}</div>` : ''}
    <div class="btnrow"><button class="btn" data-act="vpOpenSel">Open the level</button><button class="btn" data-act="delSel">Delete view</button></div>`;
}
function vpPropChange(pg, key, v) {
  const vp = (pg.vps || []).find(x => sel.has(x.id)); if (!vp) return;
  commit(() => {
    if (key === 'level') { vp.level = v; vp.show = 'level'; delete vp.room; delete vp.area; }
    else if (key === 'show') vpApplyShow(vp, v, vpLevel(vp));
    else if (key === 'scale') vp.scale = +v || 0;
    else if (key === 'title') vp.title = v;
    else if (key === 'showTitle') { if (v) delete vp.showTitle; else vp.showTitle = false; }
    else if (key.startsWith('ly.')) { const id = key.slice(3); vp.hide = (vp.hide || []).filter(x => x !== id); if (!v) vp.hide.push(id); if (!vp.hide.length) delete vp.hide; }
  });
}
function addView() { if (!isSheet(page())) { flash('Open a view sheet first (Page > New floor plan page > Several views)'); return; } setMode('vpadd'); flash('Drag a box where the view goes'); }
function newViewSheet() {
  const lvs = P.levels || []; if (!lvs.length) { flash('Add a floor plan level first'); return; }
  const lv = isFloor(page()) ? levelOf(page()) || lvs[0] : lvs[0];
  commit(() => {
    const num = Math.max(0, ...P.pages.filter(p => p.kind === 'floor' && p.level === lv.id).map(p => parseInt(p.num, 10) || 0)) + 1;
    const np = newFloorPage(lv.id, num, 'Views', 'sheet', { vps: [] }); P.pages.push(np); sortPages(); curId = np.id; sel.clear();
  });
  zoomFit(); addView();
}
registerCommand('VIEWSHEET', ['VS'], 'New page with several floor plan views', () => newViewSheet());
registerCommand('ADDVIEW', ['MV', 'VIEW'], 'Add a view to the view sheet', () => addView());
