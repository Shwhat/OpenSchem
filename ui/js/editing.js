// ---------- edit operations ----------
function delSel() {
  if (!sel.size) return;
  if (isFloor(page())) { fpDelete(); return; }
  commit(() => {
    for (const pg of P.pages) { pg.items = pg.items.filter(i => !sel.has(i.id)); pg.wires = pg.wires.filter(w => !sel.has(w.id)); pg.cables = (pg.cables || []).filter(c => !sel.has(c.id)); }
    for (const lv of P.levels) lv.places = lv.places.filter(pl => !sel.has(pl.item));
    sel.clear();
  });
}
function transformSel(fn, items) {
  const pg = page(); items = items || pg.items.filter(i => sel.has(i.id) && i.sym !== 'text'); if (!items.length) return;
  commit(() => {
    const moved = new Map();
    for (const it of items) { const b = connPts(it); fn(it); const a = connPts(it); b.forEach((c, i) => moved.set(c.x + ',' + c.y, [a[i].x, a[i].y])); }
    rubberBand(pg, moved, null); pg.wires.forEach(w => w.pts = simplify(w.pts));
  });
}
function rotateSel() { if (isFloor(page())) { fpRotate(); return; } transformSel(it => { it.rot = ((it.rot || 0) + 90) % 360; }); }
function mirrorSel() { if (isFloor(page()) || page().report) return; transformSel(it => { it.mir = !it.mir || undefined; }); }
function copySel() {
  const pg = page(); if (!sel.size || isFloor(pg) || pg.report) return;
  clip = clone({ items: pg.items.filter(i => sel.has(i.id)), wires: pg.wires.filter(w => sel.has(w.id)), cables: (pg.cables || []).filter(c => sel.has(c.id)) });
  flash(`Copied ${clip.items.length + clip.wires.length + clip.cables.length} object(s)`);
}
function paste() {
  if (!clip) return; const pg = page(); if (pg.report || isFloor(pg)) return;
  commit(() => { sel = insertContent(clip, G * 4, G * 4, pg, false); });
}

// ---------- pages ----------
function goPage(id, keepSel) { const old = page(); if (old && !isFloor(old) && !old.report) lastSchemId = old.id; curId = id; if (mode === 'area' || mode === 'room' || mode === 'roompoly' || (mode === 'fpplace' && !placeItemId)) setMode('select'); if (!keepSel) sel.clear(); if (mode === 'wire') wireDraft = null; render(); }
function stepPage(dir) { const all = allPages(); const i = all.indexOf(page()) + dir; if (i >= 0 && i < all.length) goPage(all[i].id); }
const notOnReport = () => { if (page().report) { flash('Report pages are generated automatically'); return true; } return false; };
function addPage() {
  const pg = (page().report || isFloor(page())) ? (P.pages.find(p => p.id === lastSchemId) || P.pages.filter(p => !isFloor(p)).pop() || { fn: '', loc: '' }) : page();
  dialog('New page', [
    ['fn', L('fn'), pg.fn], ['loc', L('loc'), pg.loc],
    ['num', 'Page number', String(Math.max(0, ...P.pages.filter(p => !isFloor(p) && p.fn === pg.fn && p.loc === pg.loc).map(p => parseInt(p.num, 10) || 0)) + 1)],
    ['desc', 'Description', ''],
  ], v => {
    if (P.pages.some(p => !isFloor(p) && p.fn === v.fn && p.loc === v.loc && p.num === v.num)) { alert('A page with that name already exists.'); return false; }
    commit(() => { const np = newPage(v.fn, v.loc, v.num, v.desc); P.pages.push(np); sortPages(); curId = np.id; sel.clear(); });
  });
}
function pageProps() {
  if (notOnReport()) return;
  const pg = page();
  if (isFloor(pg)) {
    dialog('Floor plan page', [['num', 'Page number', pg.num], ['desc', 'Description', pg.desc]], v => {
      if (P.pages.some(p => p !== pg && isFloor(p) && p.level === pg.level && p.num === v.num)) { alert('A page with that number already exists on this level.'); return false; }
      commit(() => { pg.num = v.num; pg.desc = v.desc; sortPages(); });
    });
    return;
  }
  dialog('Page properties', [
    ['fn', L('fn'), pg.fn], ['loc', L('loc'), pg.loc], ['num', 'Page number', pg.num], ['desc', 'Description', pg.desc],
    ['move', home() ? 'Also move devices on this page' : 'Also move devices on page to new =/+', true, 'check'],
  ], v => {
    if (P.pages.some(p => p !== pg && !isFloor(p) && p.fn === v.fn && p.loc === v.loc && p.num === v.num)) { alert('A page with that name already exists.'); return false; }
    commit(() => {
      if (v.move) for (const it of pg.items) { if (it.fn === pg.fn) it.fn = v.fn; if (it.loc === pg.loc) it.loc = v.loc; }
      Object.assign(pg, { fn: v.fn, loc: v.loc, num: v.num, desc: v.desc }); sortPages();
    });
  });
}
function delPage() {
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
  if (notOnReport()) return;
  const pg = page();
  if (isFloor(pg)) {
    commit(() => { const np = clone(pg); np.id = uid(); np.num = String(Math.max(0, ...P.pages.filter(p => isFloor(p) && p.level === pg.level).map(p => parseInt(p.num, 10) || 0)) + 1); np.desc = pg.desc + ' (copy)'; P.pages.push(np); sortPages(); curId = np.id; sel.clear(); });
    return;
  }
  commit(() => {
    const np = Object.assign(clone(pg), { id: uid(), items: [], wires: [], cables: [], revs: [] });
    np.num = String(Math.max(0, ...P.pages.filter(p => !isFloor(p) && p.fn === pg.fn && p.loc === pg.loc).map(p => parseInt(p.num, 10) || 0)) + 1);
    np.desc = pg.desc + ' (copy)';
    P.pages.push(np);
    insertContent({ items: pg.items, wires: pg.wires, cables: pg.cables || [] }, 0, 0, np, false);
    sortPages(); curId = np.id; sel.clear();
  });
}
