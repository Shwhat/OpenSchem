// ---------- 2D panel layout pages ----------
// A layout page shows one enclosure to scale. Objects are stored in real millimeters in pg.lay:
// { id, t: 'rail' | 'duct' | 'dev', x, y, w, h, item (for devices), label, layer }.
const isLayout = pg => pg && pg.kind === 'layout';
const LO = { get x() { return SH.x0 + Math.min(24, SH.w * 0.06); }, get y() { return SH.hdr + Math.min(22, SH.h * 0.075); } };
const FOOT = { cb1: [18, 90], cb3: [54, 90], fuse: [18, 90], coil: [45, 85], ol3: [45, 70], ps: [60, 90], plcin: [40, 100], plcout: [40, 100], plccard: [40, 100], bbox: [60, 80], box: [40, 40], lamp: [30, 30], pbno: [30, 30], pbnc: [30, 30], estop: [40, 40], rbrk1: [18, 90], rbrk2: [36, 90], rbrkgf: [18, 90], rbrkaf: [18, 90] };
const lsc = pg => pg.scale || 5;
const toLSheet = (pg, x, y) => [LO.x + x / lsc(pg), LO.y + y / lsc(pg)];
const toLReal = (pg, x, y) => [(x - LO.x) * lsc(pg), (y - LO.y) * lsc(pg)];
const lsnap = (pg, v) => PREFS.snap ? Math.round(v / 5) * 5 : Math.round(v);
function footprint(pg, dev) {
  if (dev.items.some(i => i.sym === 'term')) return [Math.max(12, dev.items.length * 6.2), 45];
  const src = dev.main || dev.items[0]; const p = partOf((dev.items.find(i => i.part) || {}).part);
  if (p && pnum(p.w) && pnum(p.h)) return [pnum(p.w), pnum(p.h)];
  if (src.sym === 'plccard') return [Math.max(20, (src.ch || 8) * 2.5 + 15), 100];
  return FOOT[src.sym] || [40, 40];
}
// devices that belong in this enclosure (same location), without field devices drawn only for reference
function layoutDevices(pg) {
  buildIndex();
  return [...IX.dev.values()].filter(d => (d.loc || '') === (pg.loc || '') && !d.items.every(i => ['ip', 'pe'].includes(i.sym)) && !d.items.some(i => i.sym === 'motor'))
    .sort((a, b) => natCmp(a.fn, b.fn) || natCmp(a.tag, b.tag));
}
const devOfItem = id => { const it = itemById(id); return it && IX.dev.get(devKey(it)); };
function newLayoutPage() {
  const base = P.pages.find(p => p.id === lastSchemId) || P.pages.find(p => !p.kind) || { fn: '', loc: '' };
  dialog('New panel layout page', [
    ['fn', L('fn'), base.fn || ''], ['loc', home() ? 'Location (panel or enclosure)' : 'Location (+) of the enclosure', base.loc || ''],
    ['desc', 'Description', 'Panel layout'], ['w', 'Enclosure width (mm)', '600', 'number'], ['h', 'Enclosure height (mm)', '800', 'number'],
    ['size', 'Paper size', P.size || 'A3L', 'select', SHEET_OPTS()],
    ['scale', 'Scale', 'auto', 'select', [['auto', 'Fit to sheet'], ['1', '1:1'], ['2', '1:2'], ['2.5', '1:2.5'], ['5', '1:5'], ['10', '1:10'], ['20', '1:20']]],
  ], v => {
    const w = Math.max(50, pnum(v.w) || 600), h = Math.max(50, pnum(v.h) || 800);
    useSheet({ size: v.size || P.size }); const fit = Math.max(w / (SH.x1 - LO.x - 60), h / (SH.tb - LO.y - 10));
    const sc = v.scale === 'auto' ? [1, 2, 2.5, 5, 10, 20, 50].find(s => s >= fit) || 50 : +v.scale;
    const n = Math.max(0, ...P.pages.filter(p => isLayout(p) && p.fn === v.fn && p.loc === v.loc).map(p => parseInt(String(p.num).replace(/\D/g, ''), 10) || 0)) + 1;
    commit(() => { const np = Object.assign(newPage(v.fn, v.loc, 'L' + n, v.desc), { kind: 'layout', encl: { w, h }, scale: sc, lay: [], gfx: [] }); if (v.size && v.size !== (P.size || 'A3L')) np.size = v.size; P.pages.push(np); sortPages(); curId = np.id; sel.clear(); });
    zoomFit();
  });
}
// ---------- rendering ----------
function layoutSVG(pg, o = {}) {
  const all = allPages(); let s = frameSVG(pg, all.indexOf(pg), all.length);
  const E = pg.encl || { w: 600, h: 800 }; const [ex, ey] = toLSheet(pg, 0, 0); const k = lsc(pg);
  s += txt(SH.x0 + 3, SH.hdr + 7, `Scale 1:${k}   Enclosure ${E.w} × ${E.h} mm${pg.loc ? '   ' + (home() ? niceRoom(pg.loc) : '+' + pg.loc) : ''}`, { size: 3, cls: 'tc' });
  s += `<rect class="encl" x="${r2(ex)}" y="${r2(ey)}" width="${r2(E.w / k)}" height="${r2(E.h / k)}"/>`;
  // dimensions of the enclosure
  s += gfxSVG({ t: 'dim', pts: [[ex, ey - 6], [ex + E.w / k, ey - 6]], w: 0.25, text: E.w + ' mm' }, pg, false, true).replace('class="gfx ly-gfx"', 'class="ldim"');
  s += gfxSVG({ t: 'dim', pts: [[ex + E.w / k + 6, ey], [ex + E.w / k + 6, ey + E.h / k]], w: 0.25, text: E.h + ' mm' }, pg, false, true).replace('class="gfx ly-gfx"', 'class="ldim"');
  s += gfxPageSVG(pg, o);
  const order = { duct: 0, rail: 1, dev: 2 };
  for (const L0 of [...(pg.lay || [])].sort((a, b) => order[a.t] - order[b.t])) {
    if (!objShown(L0, o)) continue;
    const isSel = !o.print && sel.has(L0.id), lk = !o.print && objLocked(L0);
    const [x, y] = toLSheet(pg, L0.x, L0.y), w = L0.w / k, h = L0.h / k;
    let label = L0.label || '';
    if (L0.t === 'dev') { const d = devOfItem(L0.item); label = d ? dispFull(d.fn === pg.fn ? '' : d.fn, d.loc === pg.loc ? '' : d.loc, d.tag) : '?'; }
    const cls = 'lo lo-' + L0.t + (isSel ? ' losel' : '');
    s += `<g ${lk ? '' : `data-id="${L0.id}" `}class="${cls}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"/>`;
    if (L0.t === 'duct') s += `<path d="M${r2(x)},${r2(y + h / 2)}h${r2(w)}M${r2(x + w / 2)},${r2(y)}v${r2(h)}" class="lomid"/>`;
    if (label) {
      const vert = h > w * 1.6 && L0.t === 'dev'; const fs = Math.max(1.4, Math.min(2.6, (vert ? w : h) * 0.5));
      s += `<text class="t lot" x="${r2(x + w / 2)}" y="${r2(y + h / 2 + fs * 0.35)}" font-size="${r2(fs)}" text-anchor="middle"${vert ? ` transform="rotate(-90 ${r2(x + w / 2)} ${r2(y + h / 2)})"` : ''}>${esc(label)}</text>`;
    }
    s += '</g>';
  }
  return s;
}
// ---------- interaction ----------
let ldrag = null, lbox = null, lplace = null;
function layDown(e, pg, mx, my) {
  const [rx, ry] = toLReal(pg, mx, my);
  if (mode === 'lplace' && lplace) {
    const [w, h] = lplace.size;
    commit(() => { const o = onActiveLayer({ id: uid(), t: 'dev', item: lplace.item, x: lsnap(pg, rx - w / 2), y: lsnap(pg, ry - h / 2), w, h }); pg.lay.push(o); sel = new Set([o.id]); });
    lplace = null; setMode('select'); return;
  }
  if (mode === 'lrail' || mode === 'lduct') { lbox = { start: [mx, my], cur: [mx, my], t: mode.slice(1) }; return; }
  const id = hitId(e);
  if (id) {
    if (e.shiftKey || e.ctrlKey) { sel.has(id) ? sel.delete(id) : sel.add(id); render(); return; }
    if (!sel.has(id)) { sel = new Set([id]); render(); }
    ldrag = { start: [mx, my], pre: snapshot(), orig: clone({ lay: pg.lay, gfx: pg.gfx || [] }), moved: false };
  } else { if (!e.shiftKey) { sel.clear(); render(); } lbox = { start: [mx, my], cur: [mx, my], select: true }; }
}
function layMove(pg, mx, my) {
  const [rx, ry] = toLReal(pg, mx, my);
  $('#st-pos').textContent = `X ${lsnap(pg, rx)} mm  Y ${lsnap(pg, ry)} mm  |  Page ${pageName(pg)}`;
  if (mode === 'lplace' && lplace) {
    const [w, h] = lplace.size; const [x, y] = toLSheet(pg, lsnap(pg, rx - w / 2), lsnap(pg, ry - h / 2));
    $('#overlay').innerHTML = `<rect class="selbox" x="${x}" y="${y}" width="${w / lsc(pg)}" height="${h / lsc(pg)}"/>`; return;
  }
  if (ldrag) {
    const k = lsc(pg); const dx = lsnap(pg, (mx - ldrag.start[0]) * k), dy = lsnap(pg, (my - ldrag.start[1]) * k);
    if (ldrag.d && ldrag.d[0] === dx && ldrag.d[1] === dy) return;
    ldrag.d = [dx, dy]; ldrag.moved = true;
    pg.lay = clone(ldrag.orig.lay); pg.gfx = clone(ldrag.orig.gfx);
    for (const o of pg.lay) if (sel.has(o.id)) { o.x += dx; o.y += dy; }
    for (const g of pg.gfx) if (sel.has(g.id)) g.pts = g.pts.map(p => [r2(p[0] + dx / k), r2(p[1] + dy / k)]);
    renderCanvas(); return;
  }
  if (lbox) {
    lbox.cur = [mx, my]; const [a, b] = lbox.start, [c, d] = lbox.cur;
    $('#overlay').innerHTML = `<rect class="selbox" x="${Math.min(a, c)}" y="${Math.min(b, d)}" width="${Math.abs(c - a)}" height="${Math.abs(d - b)}"/>`;
  }
}
function layUp(pg) {
  if (ldrag) { if (ldrag.moved) { pushUndo(ldrag.pre); markDirty(); render(); } ldrag = null; return; }
  if (!lbox) return;
  const b = lbox; lbox = null; $('#overlay').innerHTML = '';
  const [x0, y0] = [Math.min(b.start[0], b.cur[0]), Math.min(b.start[1], b.cur[1])], [x1, y1] = [Math.max(b.start[0], b.cur[0]), Math.max(b.start[1], b.cur[1])];
  if (b.select) {
    if (x1 - x0 > 1 || y1 - y0 > 1) {
      for (const o of pg.lay.filter(selectable)) { const [a, c] = toLSheet(pg, o.x, o.y); if (a >= x0 && c >= y0 && a + o.w / lsc(pg) <= x1 && c + o.h / lsc(pg) <= y1) sel.add(o.id); }
      for (const g of (pg.gfx || []).filter(selectable)) { const bb = gfxBox(g); if (bb[0] >= x0 && bb[2] <= x1 && bb[1] >= y0 && bb[3] <= y1) sel.add(g.id); }
    }
    render(); return;
  }
  const [rx0, ry0] = toLReal(pg, x0, y0), [rx1, ry1] = toLReal(pg, x1, y1);
  let w = lsnap(pg, rx1 - rx0), h = lsnap(pg, ry1 - ry0);
  if (w < 5 && h < 5) return;
  // rails and ducts keep their standard depth across the short side
  if (b.t === 'rail') { if (w >= h) h = 35; else w = 35; }
  if (b.t === 'duct' && Math.min(w, h) < 25) { if (w >= h) h = 40; else w = 40; }
  commit(() => { const o = onActiveLayer({ id: uid(), t: b.t, x: lsnap(pg, rx0), y: lsnap(pg, ry0), w, h, label: b.t === 'rail' ? 'DIN rail' : 'Wire duct' }); pg.lay.push(o); sel = new Set([o.id]); });
  setMode('select');
}
function layPlace(itemId) {
  const pg = page(); if (!isLayout(pg)) return;
  const d = devOfItem(itemId); if (!d) return;
  lplace = { item: itemId, size: footprint(pg, d) }; setMode('lplace'); flash('Click in the enclosure to place ' + dispTag(d.tag));
}
const findLay = id => { for (const pg of P.pages) { const o = (pg.lay || []).find(x => x.id === id); if (o) return { o, pg }; } return null; };
function layDelete() { const pg = page(); commit(() => { pg.lay = pg.lay.filter(o => !sel.has(o.id)); pg.gfx = (pg.gfx || []).filter(g => !sel.has(g.id)); sel.clear(); }); }
// ---------- properties ----------
function renderLayoutProps(pg) {
  const el = $('#props'); const ids = [...sel];
  if (ids.length === 1) {
    const g = (pg.gfx || []).find(x => x.id === ids[0]); if (g) { el.innerHTML = gfxPropsHTML(g, pg); return; }
    const f = findLay(ids[0]);
    if (f) {
      const o = f.o; const d = o.t === 'dev' ? devOfItem(o.item) : null;
      el.innerHTML = `<div class="ident">${esc(d ? dispFull(d.fn, d.loc, d.tag) : o.t === 'rail' ? 'DIN rail' : o.t === 'duct' ? 'Wire duct' : 'Device')}</div><div class="sub">${o.t === 'dev' ? 'Device footprint' : 'Panel layout'}</div>
        <div class="pgrp"><h4>Size and position (mm)</h4>${row('lo.x', 'X', o.x, 'number')}${row('lo.y', 'Y', o.y, 'number')}${row('lo.w', 'Width', o.w, 'number')}${row('lo.h', 'Height', o.h, 'number')}${o.t !== 'dev' ? row('lo.label', 'Label', o.label || '') : ''}${userLayers().length ? row('ly.set', 'Layer', '', 'select', layerOptions(o.layer)) : ''}</div>
        ${d ? `<div class="btnrow"><button class="btn small" data-goto="${(d.main || d.items[0]).id}">Show on schematic</button></div><div class="note">The size comes from the part's width and height in the parts database, or a typical size for the symbol.</div>` : ''}
        <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
      return;
    }
  }
  if (ids.length > 1) { el.innerHTML = `<div class="ident">${ids.length} objects selected</div><div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`; return; }
  const placed = new Set((pg.lay || []).filter(o => o.t === 'dev').map(o => devOfItem(o.item)).filter(Boolean).map(d => d.key));
  const devs = layoutDevices(pg); const un = devs.filter(d => !placed.has(d.key));
  const E = pg.encl || { w: 600, h: 800 };
  el.innerHTML = `<div class="ident">Page ${esc(pageName(pg))}</div><div class="sub">${esc(pg.desc)} · panel layout</div>
    <div class="pgrp"><h4>Enclosure</h4>${row('lpg.fn', L('fn'), pg.fn)}${row('lpg.loc', L('loc'), pg.loc)}${row('lpg.desc', 'Description', pg.desc)}${row('lpg.ew', 'Width (mm)', E.w, 'number')}${row('lpg.eh', 'Height (mm)', E.h, 'number')}${row('lpg.scale', 'Scale 1:', lsc(pg), 'number', 'min="0.5" step="0.5"')}${row('lpg.size', 'Paper size', '', 'select', SHEET_OPTS().map(([k, l]) => `<option value="${k}" ${(pg.size || P.size || 'A3L') === k ? 'selected' : ''}>${esc(l)}</option>`).join(''))}</div>
    <div class="pgrp"><h4>Draw</h4><div class="btnrow"><button class="btn small" data-act="layRail">DIN rail</button><button class="btn small" data-act="layDuct">Wire duct</button></div><div class="note">Drag along the plate. Rails are 35 mm and ducts 40 mm deep unless drawn wider.</div></div>
    <div class="pgrp"><h4>Not placed yet (${un.length} of ${devs.length})</h4><div class="fnlist">${un.length ? un.map(d => `<div data-layplace="${(d.main || d.items[0]).id}"><span>${esc(dispFull(d.fn, d.loc, d.tag))}</span><span class="r">${footprint(pg, d).join(' × ')}</span></div>`).join('') : `<span class="note">${devs.length ? 'Every device in this location is placed.' : 'No devices use this location yet.'}</span>`}</div></div>`;
}
function layPropChange(scope, key, v) {
  const pg = page(); if (!isLayout(pg)) return false;
  if (scope === 'lpg') {
    commit(() => {
      if (key === 'ew' || key === 'eh') { pg.encl = pg.encl || { w: 600, h: 800 }; pg.encl[key === 'ew' ? 'w' : 'h'] = Math.max(50, pnum(v) || 600); }
      else if (key === 'scale') pg.scale = Math.max(0.5, pnum(v) || 5);
      else if (key === 'size') setPageSize(pg, v);
      else { pg[key] = v; if (key !== 'desc') sortPages(); }
    }, { props: false });
    if (key === 'size') zoomFit();
    return true;
  }
  if (scope === 'lo') { const f = findLay([...sel][0]); if (f) commit(() => { f.o[key] = key === 'label' ? v : Math.max(key === 'w' || key === 'h' ? 1 : -1e6, pnum(v)); }); return true; }
  return false;
}
document.addEventListener('click', e => { const p = e.target.closest('[data-layplace]'); if (p) layPlace(p.dataset.layplace); });
