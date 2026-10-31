// ---------- edit operations ----------
function delSel() {
  if (!sel.size) return;
  if (isFloor(page())) { fpDelete(); return; }
  if (isLayout(page())) { layDelete(); return; }
  commit(() => {
    for (const pg of P.pages) { pg.items = pg.items.filter(i => !sel.has(i.id)); pg.wires = pg.wires.filter(w => !sel.has(w.id)); pg.cables = (pg.cables || []).filter(c => !sel.has(c.id)); pg.gfx = (pg.gfx || []).filter(g => !sel.has(g.id)); }
    for (const lv of P.levels) lv.places = lv.places.filter(pl => !sel.has(pl.item));
    sel.clear();
  });
}
function transformSel(fn, items) {
  const pg = page(); items = items || pg.items.filter(i => sel.has(i.id) && i.sym !== 'text' && (!(SYM[i.sym] || {}).sized || SYM[i.sym].rotates)); if (!items.length) return;
  commit(() => {
    const moved = new Map();
    for (const it of items) { const b = connPts(it); fn(it); const a = connPts(it); b.forEach((c, i) => { if (a[i]) moved.set(c.x + ',' + c.y, [a[i].x, a[i].y]); }); }
    rubberBand(pg, moved, null); pg.wires.forEach(w => w.pts = simplify(w.pts));
    reAutoConnect(pg, items);
  });
}
function rotateSel() { if (isFloor(page())) { fpRotate(); return; } if (isLayout(page())) { const pg = page(); const ls = pg.lay.filter(o => sel.has(o.id)); if (ls.length) commit(() => ls.forEach(o => { [o.w, o.h] = [o.h, o.w]; })); return; } transformSel(it => { it.rot = ((it.rot || 0) + 90) % 360; }); }
function mirrorSel() { if (isFloor(page()) || page().report) return; transformSel(it => { it.mir = !it.mir || undefined; }); }
function copySel() {
  const pg = page(); if (!sel.size || isFloor(pg) || pg.report) return;
  clip = clone({ items: pg.items.filter(i => sel.has(i.id)), wires: pg.wires.filter(w => sel.has(w.id)), cables: (pg.cables || []).filter(c => sel.has(c.id)), gfx: (pg.gfx || []).filter(g => sel.has(g.id)) });
  flash(`Copied ${clip.items.length + clip.wires.length + clip.cables.length + clip.gfx.length} object(s)`);
}
async function paste() {
  if (!clip) return; const pg = page(); if (pg.report || isFloor(pg)) return;
  const src = await stdCheck(clip, 'The pasted content'); if (!src) return;
  commit(() => { sel = insertContent(src, G * 4, G * 4, pg, false); autoConnect(pg, pg.items.filter(i => sel.has(i.id))); });
}
// copy a whole schematic page, to paste it as a new page in this or another project
function copyPage() {
  const pg = page(); if (pg.report || isFloor(pg) || isLayout(pg)) { flash('Open a schematic page to copy it'); return; }
  clip = clone({ page: { fn: pg.fn, loc: pg.loc, desc: pg.desc, size: pg.size, type: pg.type }, items: pg.items, wires: pg.wires, cables: pg.cables || [], gfx: pg.gfx || [] });
  flash(`Copied page ${pageName(pg)}`);
}
async function pastePage() {
  if (!clip || !clip.page) { flash('Copy a page first (Page > Copy page)'); return; }
  const src = await stdCheck(clip, 'The copied page'); if (!src) return; const sp = src.page;
  commit(() => {
    const num = String(Math.max(0, ...P.pages.filter(p => !isFloor(p) && p.fn === (sp.fn || '') && p.loc === (sp.loc || '')).map(p => parseInt(p.num, 10) || 0)) + 1);
    const np = newPage(sp.fn || '', sp.loc || '', num, sp.desc || ''); if (sp.size) np.size = sp.size; if (sp.type) np.type = sp.type;
    P.pages.push(np); insertContent(src, 0, 0, np, false); sortPages(); curId = np.id; sel.clear();
  });
  zoomFit();
}

// ---------- pages ----------
function goPage(id, keepSel) { const old = page(); if (old && !isFloor(old) && !old.report) lastSchemId = old.id; curId = id; if (mode === 'area' || mode === 'room' || mode === 'roompoly' || mode === 'roomoval' || mode === 'roomcirc' || (mode === 'fpplace' && !placeItemId)) setMode('select'); if (!keepSel) sel.clear(); if (mode === 'wire' || mode === 'tube') wireDraft = null; render(); }
function stepPage(dir) { const all = allPages(); const i = all.indexOf(page()) + dir; if (i >= 0 && i < all.length) goPage(all[i].id); }
const notOnReport = () => { if (page().report) { flash('Report pages are generated automatically'); return true; } return false; };
function addPage() {
  const pg = (page().report || isFloor(page())) ? (P.pages.find(p => p.id === lastSchemId) || P.pages.filter(p => !isFloor(p)).pop() || { fn: '', loc: '' }) : page();
  dialog('New page', [
    ['fn', L('fn'), pg.fn], ['loc', L('loc'), pg.loc],
    ['num', 'Page number', String(Math.max(0, ...P.pages.filter(p => !isFloor(p) && p.fn === pg.fn && p.loc === pg.loc).map(p => parseInt(p.num, 10) || 0)) + 1)],
    ['desc', 'Description', ''],
    ['type', 'Page type', pg.type || '', 'select', PAGE_TYPES],
    ['size', 'Paper size', pg.size || P.size || 'A3L', 'select', SHEET_OPTS()],
  ], v => {
    if (P.pages.some(p => !isFloor(p) && p.fn === v.fn && p.loc === v.loc && p.num === v.num)) { alert('A page with that name already exists.'); return false; }
    commit(() => { const np = newPage(v.fn, v.loc, v.num, v.desc); if (v.size !== (P.size || 'A3L')) np.size = v.size; if (v.type) np.type = v.type; P.pages.push(np); sortPages(); curId = np.id; sel.clear(); });
    zoomFit();
  });
}
function pageProps() {
  { const cr = customOf(page()); if (cr) { CUSSEL = null; renderProps(); showPanel('props'); return; } }
  if (notOnReport()) return;
  const pg = page();
  if (isFloor(pg)) {
    dialog('Floor plan page', [['num', 'Page number', pg.num], ['desc', 'Description', pg.desc], ['size', 'Paper size', pg.size || P.size || 'A3L', 'select', SHEET_OPTS()]], v => {
      if (P.pages.some(p => p !== pg && isFloor(p) && p.level === pg.level && p.num === v.num)) { alert('A page with that number already exists on this level.'); return false; }
      commit(() => { pg.num = v.num; pg.desc = v.desc; setPageSize(pg, v.size); sortPages(); }); zoomFit();
    });
    return;
  }
  dialog('Page properties', [
    ['fn', L('fn'), pg.fn], ['loc', L('loc'), pg.loc], ['num', 'Page number', pg.num], ['desc', 'Description', pg.desc],
    ['type', 'Page type', pg.type || '', 'select', PAGE_TYPES],
    ['size', 'Paper size', pg.size || P.size || 'A3L', 'select', SHEET_OPTS()],
    ['move', home() ? 'Also move devices on this page' : 'Also move devices on page to new =/+', true, 'check'],
  ], v => {
    if (P.pages.some(p => p !== pg && !isFloor(p) && p.fn === v.fn && p.loc === v.loc && p.num === v.num)) { alert('A page with that name already exists.'); return false; }
    commit(() => {
      if (v.move) for (const it of pg.items) { if (it.fn === pg.fn) it.fn = v.fn; if (it.loc === pg.loc) it.loc = v.loc; }
      Object.assign(pg, { fn: v.fn, loc: v.loc, num: v.num, desc: v.desc }); if (v.type) pg.type = v.type; else delete pg.type; setPageSize(pg, v.size); sortPages();
    });
    zoomFit();
  });
}
function setPageSize(pg, size) { if (!size || size === (P.size || 'A3L')) delete pg.size; else pg.size = size; }
function delPage() {
  { const cr = customOf(page()); if (cr) { deleteCustom(cr); return; } }
  if (notOnReport()) return;
  if (P.pages.length < 2) { alert('A project needs at least one page.'); return; }
  const pg = page();
  const lastOfLevel = isFloor(pg) && !P.pages.some(p => p !== pg && isFloor(p) && p.level === pg.level);
  if (!confirm(`Delete page ${pageName(pg)} "${pg.desc}"?` + (lastOfLevel ? '\n\nThis is the last page of this level, so its rooms, image and floor-plan placements are deleted too.' : ''))) return;
  commit(() => {
    const i = pageIdx(pg); P.pages.splice(i, 1);
    if (lastOfLevel) { const lv = levelOf(pg); if (lv) { if (lv.image) delete P.assets[lv.image.asset]; P.pool = P.pool.filter(it => !lv.places.some(pl => pl.item === it.id)); P.levels = P.levels.filter(l => l !== lv); } }
    curId = P.pages[Math.max(0, i - 1)].id; sel.clear();
  });
}
function dupPage() {
  { const cr = customOf(page()); if (cr) { duplicateCustom(cr); return; } }
  if (notOnReport()) return;
  const pg = page();
  if (isFloor(pg)) {
    commit(() => { const np = clone(pg); np.id = uid(); np.num = String(Math.max(0, ...P.pages.filter(p => isFloor(p) && p.level === pg.level).map(p => parseInt(p.num, 10) || 0)) + 1); np.desc = pg.desc + ' (copy)'; P.pages.push(np); sortPages(); curId = np.id; sel.clear(); });
    return;
  }
  if (isLayout(pg)) {
    commit(() => { const np = Object.assign(clone(pg), { id: uid(), revs: [] }); np.lay.forEach(o => { o.id = uid(); }); np.gfx.forEach(g => { g.id = uid(); }); np.num = 'L' + (Math.max(0, ...P.pages.filter(p => isLayout(p) && p.fn === pg.fn && p.loc === pg.loc).map(p => parseInt(String(p.num).replace(/\D/g, ''), 10) || 0)) + 1); np.desc = pg.desc + ' (copy)'; P.pages.push(np); sortPages(); curId = np.id; sel.clear(); });
    return;
  }
  commit(() => {
    const np = Object.assign(clone(pg), { id: uid(), items: [], wires: [], cables: [], gfx: [], revs: [] });
    np.num = String(Math.max(0, ...P.pages.filter(p => !isFloor(p) && p.fn === pg.fn && p.loc === pg.loc).map(p => parseInt(p.num, 10) || 0)) + 1);
    np.desc = pg.desc + ' (copy)';
    P.pages.push(np);
    insertContent({ items: pg.items, wires: pg.wires, cables: pg.cables || [], gfx: pg.gfx || [] }, 0, 0, np, false);
    sortPages(); curId = np.id; sel.clear();
  });
}

// ---------- align to grid: move the selection (or the whole page) onto the nearest grid points ----------
function alignToGrid() {
  const pg = page(); if (pg.report) return;
  const all = !sel.size; const on = id => all || sel.has(id);
  if (isFloor(pg)) {
    const lv = levelOf(pg); if (!lv) return; const g = PREFS.gridFp || 2; const sn = v => r2(Math.round(v / g) * g);
    commit(() => {
      for (const pl of lv.places) if (on(pl.id)) { pl.x = sn(pl.x); pl.y = sn(pl.y); autoRoom(lv, pl); }
      for (const r of lv.rooms) if (on(r.id)) r.pts = r.pts.map(p => [sn(p[0]), sn(p[1])]);
      alignFloorShapes(lv, on, sn);
    });
    flash(all ? 'Everything on the page is aligned to the grid' : 'Selection aligned to the grid'); return;
  }
  if (isLayout(pg)) {
    commit(() => { for (const o of pg.lay) if (on(o.id)) { o.x = Math.round(o.x / 5) * 5; o.y = Math.round(o.y / 5) * 5; } for (const gx of pg.gfx || []) if (on(gx.id)) gx.pts = gx.pts.map(p => [snapG(p[0]), snapG(p[1])]); });
    flash('Aligned to the grid'); return;
  }
  commit(() => {
    const moved = new Map();
    for (const it of pg.items) if (on(it.id)) {
      const b = connPts(it); it.x = snapG(it.x); it.y = snapG(it.y); const a = connPts(it);
      b.forEach((c, i) => { if (a[i] && (a[i].x !== c.x || a[i].y !== c.y)) moved.set(c.x + ',' + c.y, [a[i].x, a[i].y]); });
    }
    const wsel = new Set(pg.wires.filter(w => on(w.id)).map(w => w.id));
    for (const w of pg.wires) if (wsel.has(w.id)) w.pts = w.pts.map(p => moved.get(p.join(',')) || [snapG(p[0]), snapG(p[1])]);
    rubberBand(pg, moved, null, wsel);
    pg.wires.forEach(w => { w.pts = simplify(w.pts); }); pg.wires = pg.wires.filter(w => w.pts.length >= 2);
    for (const c of pg.cables || []) if (on(c.id)) { c.x1 = snapG(c.x1); c.x2 = snapG(c.x2); c.y1 = snapG(c.y1); c.y2 = snapG(c.y2); }
    for (const gx of pg.gfx || []) if (on(gx.id)) gx.pts = gx.pts.map(p => [snapG(p[0]), snapG(p[1])]);
  });
  flash(all ? 'Everything on the page is aligned to the grid' : 'Selection aligned to the grid');
}
// floor plan shapes: points snap one by one (so walls that meet at a corner stay joined), centers and insertion
// points snap as a whole. Doors and windows stay on their wall and keep their place along it; one picked on its own
// slides along the wall to the nearest grid line. Associative dimensions follow their geometry; hatches are left alone.
function alignFloorShapes(lv, on, sn) {
  const shapes = lvShapes(lv), sp = p => [sn(p[0]), sn(p[1])];
  const spread = pts => pts.some(p => p[0] !== pts[0][0] || p[1] !== pts[0][1]);
  const keep = new Map();
  for (const o of shapes) if (o.t === 'opening') { const w = wallById(lv, o.wall); if (w && on(w.id)) keep.set(o.id, openingAt(o, w)); }
  for (const s of shapes) {
    if (!on(s.id) || s.t === 'opening' || s.t === 'hatch') continue;
    if (s.t === 'line' || s.t === 'wall') { const a = sp(s.a), b = sp(s.b); if (spread([a, b])) { s.a = a; s.b = b; } }
    else if (s.t === 'pline' || s.t === 'spline' || s.t === 'leader') { const q = s.pts.map(sp); if (spread(q)) s.pts = q; }
    else if (s.t === 'arc' || s.t === 'circle' || s.t === 'ellipse' || s.t === 'rect' || s.t === 'polygon') s.c = sp(s.c);
    else if (s.t === 'text' || s.t === 'insert') s.p = sp(s.p);
    else if (s.t === 'dim' && !(s.r1 || s.r2 || s.ref || s.l1 || s.l2)) for (const k of ['p1', 'p2', 'loc', 'c']) if (s[k]) s[k] = sp(s[k]);
  }
  for (const o of shapes) {
    if (o.t !== 'opening') continue;
    const w = wallById(lv, o.wall); if (!w) continue; const ax = wallAxis(w);
    let at = null;
    if (keep.has(o.id)) at = keep.get(o.id);
    else if (on(o.id)) {
      at = openingAt(o, w);
      if (Math.abs(ax.u[1]) < 1e-6) at = (sn(o.c[0]) - w.a[0]) / ax.u[0];
      else if (Math.abs(ax.u[0]) < 1e-6) at = (sn(o.c[1]) - w.a[1]) / ax.u[1];
      else at = sn(at);
    }
    if (at === null) continue;
    o.c = rp(axPt(w, ax, Math.max(o.w / 2, Math.min(ax.len - o.w / 2, at)), 0));
  }
}
const snapG = v => r2(Math.round(v / gs()) * gs());
