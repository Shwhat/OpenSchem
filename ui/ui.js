// ---------- host bridge (Go/WebView2) with browser fallback ----------
const host = {
  has: typeof window.osOpen === 'function',
  async open() { if (this.has) return await window.osOpen(); return null; },
  async save(path, content) { if (this.has) return await window.osSave(path, content); download('project.osp', content); return 'project.osp'; },
  async saveAs(content, name) { if (this.has) return await window.osSaveAs(content, name); download(name, content); return name; },
  async title(t) { document.title = t; if (this.has) try { await window.osSetTitle(t); } catch (e) {} },
  async autosave(c) { if (this.has) try { await window.osAutosave(c); } catch (e) {} },
  async getAutosave() { if (this.has) try { return await window.osGetAutosave(); } catch (e) {} return ''; },
  async saveText(content, name) { if (this.has) return await window.osSaveText(content, name); download(name, content); return name; },
  async saveBinary(b64, name, desc, ext) {
    if (this.has) return await window.osSaveBase64(b64, name, desc, ext);
    const a = document.createElement('a'); a.href = 'data:application/pdf;base64,' + b64; a.download = name; a.click(); return name;
  },
  async saveBinary(b64, name, desc, ext) {
    if (this.has) return await window.osSaveBase64(b64, name, desc, ext);
    const a = document.createElement('a'); a.href = 'data:application/pdf;base64,' + b64; a.download = name; a.click(); return name;
  },
  async readData(n) { if (this.has) { try { return await window.osReadData(n); } catch (e) { return ''; } } try { return localStorage.getItem('os:' + n) || ''; } catch (e) { return ''; } },
  async writeData(n, c) { if (this.has) { try { await window.osWriteData(n, c); } catch (e) {} return; } try { localStorage.setItem('os:' + n, c); } catch (e) {} },
  async saveFile(content, name, desc, ext) { if (this.has) return await window.osSaveFile(content, name, desc, ext); download(name, content); return name; },
  async openText(desc, ext) {
    if (this.has) return await window.osOpenText(desc, ext);
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.' + ext; i.onchange = async () => res(i.files[0] ? { path: i.files[0].name, content: await i.files[0].text() } : null); i.click(); });
  },
  async initialFile() { if (this.has) try { return await window.osInitialFile(); } catch (e) {} return null; },
};
function download(name, content) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' })); a.download = name; a.click();
}

// ---------- state changes ----------
function snapshot() { return JSON.stringify(P, (k, v) => k === 'assets' ? undefined : v); }
function restore(json) { const as = P.assets; P = JSON.parse(json); P.assets = as; ensureProject(P); }
function pushUndo(snap) { undoStack.push(snap || snapshot()); if (undoStack.length > 150) undoStack.shift(); redoStack = []; }
function commit(fn, o = {}) { pushUndo(); fn(); markDirty(); render(o); }
function markDirty() { dirty = true; P.modified = today(); const r = activeRev(); const pg = page(); if (r && pg && !pg.report) { pg.revs = pg.revs || []; if (!pg.revs.includes(r)) pg.revs.push(r); } }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); afterLoadState(); markDirty(); render(); flash('Undo'); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); afterLoadState(); markDirty(); render(); flash('Redo'); }
function afterLoadState() { if (!P.pages.find(p => p.id === curId)) curId = P.pages[0].id; for (const id of [...sel]) if (!findItem(id)) sel.delete(id); }

let flashT;
function flash(m) { $('#st-msg').textContent = m; clearTimeout(flashT); flashT = setTimeout(() => $('#st-msg').textContent = '', 2600); }

// ---------- main render ----------
let symKey = '', lastSchemId = null;
function render(o = {}) {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
  renderCanvas();
  renderPages(); renderPageTabs(); renderToolbar();
  const sk = `${isFloor(page())}|${S().industrial}|${S().fpSymbols}`; if (sk !== symKey) { symKey = sk; renderSymbols(); }
  if (!$('#tab-devices').classList.contains('hidden')) renderDevices();
  if (o.props !== false) renderProps();
  renderTodo();
  renderStatus(); updateTitle();
}
function renderCanvas() { $('#content').innerHTML = pageSVG(page()); applyView(); }
function updateTitle() {
  const n = (filePath ? filePath.split(/[\\/]/).pop() : 'Untitled.osp') + (dirty ? ' *' : '');
  $('#docname').textContent = `${P.name}  |  ${n}`;
  host.title(`${dirty ? '* ' : ''}${P.name} - OpenSchem`);
}

// ---------- view ----------
const svg = $('#canvas');
function applyView() {
  const r = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${r.width / view.s} ${r.height / view.s}`);
  $('#st-zoom').textContent = `Zoom ${Math.round(view.s / fitScale() * 100)}%`;
}
function fitScale() { const r = svg.getBoundingClientRect(); return Math.min(r.width / (SH.w + 10), r.height / (SH.h + 10)) || 1; }
function zoomFit() {
  const r = svg.getBoundingClientRect(); view.s = fitScale();
  view.x = SH.w / 2 - r.width / view.s / 2; view.y = SH.h / 2 - r.height / view.s / 2; applyView();
}
function zoomAt(f, px, py) {
  const r = svg.getBoundingClientRect(); if (px == null) { px = r.width / 2; py = r.height / 2; }
  const mx = view.x + px / view.s, my = view.y + py / view.s;
  view.s = Math.max(fitScale() * 0.3, Math.min(view.s * f, 60));
  view.x = mx - px / view.s; view.y = my - py / view.s; applyView();
}
function toMM(e) { const r = svg.getBoundingClientRect(); return [view.x + (e.clientX - r.left) / view.s, view.y + (e.clientY - r.top) / view.s]; }
function centerOn(x, y) { const r = svg.getBoundingClientRect(); view.x = x - r.width / view.s / 2; view.y = y - r.height / view.s / 2; applyView(); }

// ---------- modes ----------
function setMode(m, sym, itemId) {
  mode = m; placeSym = sym || null; wireDraft = null; placeItemId = itemId || null; fpoly = null; fbox = null;
  $('#overlay').innerHTML = '';
  svg.classList.toggle('cross', m !== 'select');
  renderToolbar(); renderStatus();
  document.querySelectorAll('.symcard').forEach(c => c.classList.toggle('on', c.dataset.sym === placeSym));
}
function renderStatus() {
  const pg = page();
  const names = { select: 'Select', place: 'Insert: ' + (placeSym ? SYM[placeSym].name : ''), wire: 'Draw connection', text: 'Insert text', cable: 'Draw cable (drag across the wires it carries)', macro: 'Place macro' + (placeMacro ? ': ' + placeMacro.name : ''), cable: 'Draw cable (drag across the wires it carries)', macro: 'Place macro' + (placeMacro ? ': ' + placeMacro.name : ''), room: 'Draw room (drag a box)', roompoly: 'Draw room shape (click corners, click the first corner to close)', area: 'Drag a box around the area to show', fpplace: 'Place on floor plan' + (placeSym ? ': ' + SYM[placeSym].name : '') };
  $('#st-mode').textContent = names[mode] + (mode === 'place' || mode === 'fpplace' ? '  (R rotate, right click / Esc to end)' : mode === 'wire' ? '  (click points, double click / Esc to finish)' : '');
  $('#st-pos').textContent = `Page ${pageName(pg)}`;
  $('#st-snap').textContent = `Snap ${PREFS.snap ? 'on' : 'off'} · grid ${isFloor(pg) ? PREFS.gridFp : PREFS.gridSch} mm`;
}

// ---------- pointer interaction ----------
let placeMir = false, cdrag = null;
let drag = null, box = null, pan = null, wireDraft = null, spaceDown = false, lastMouse = [0, 0];

function snapPt(mx, my) {
  const pg = page(); let best = null, bd = 2.5;
  if (!isFloor(pg) && !pg.report) {
    for (const it of pg.items) for (const c of connPts(it)) { const d = Math.hypot(c.x - mx, c.y - my); if (d < bd) { bd = d; best = [c.x, c.y]; } }
    for (const w of pg.wires) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) { const d = Math.hypot(p[0] - mx, p[1] - my); if (d < bd) { bd = d; best = [p[0], p[1]]; } }
  }
  return best || [snap(mx), snap(my)];
}
function hitId(e) { const g = e.target.closest('[data-id]'); return g ? g.dataset.id : null; }
function connAt(pg, x, y) {
  for (const it of pg.items) for (const c of connPts(it)) if (c.x === x && c.y === y) return true;
  for (const w of pg.wires) if (onPoly([x, y], w.pts)) return true;
  return false;
}

svg.addEventListener('mousedown', e => {
  closeMenus();
  const [mx, my] = toMM(e); const sx = snap(mx), sy = snap(my);
  if (e.button === 1 || (e.button === 0 && spaceDown)) { pan = { cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y }; svg.classList.add('pan'); e.preventDefault(); return; }
  if (e.button === 2) { if (mode === 'wire' && wireDraft) finishWire(); else if (mode === 'roompoly' && fpoly) finishPoly(page()); else if (mode !== 'select') setMode('select'); return; }
  if (e.button !== 0) return;
  const pg = page();
  if (pg.report) { if (mode !== 'select') setMode('select'); return; }
  if (isFloor(pg)) { fpDown(e, pg, mx, my); return; }
  lastSchemId = pg.id;
  if (mode === 'macro') { placeMacroAt(pg, mx, my); return; }
  if (mode === 'cable') { cdrag = { a: [snap(mx), snap(my)], b: [snap(mx), snap(my)] }; return; }
  if (mode === 'place' && placeItemId) {
    const id = placeItemId;
    commit(() => {
      const it = itemById(id); if (!it) return;
      P.pool = P.pool.filter(x => x !== it);
      it.x = sx; it.y = sy; it.rot = placeRot; it.mir = placeMir || undefined; if (!it.fn) it.fn = pg.fn || '';
      pg.items.push(it); sel = new Set([it.id]);
    });
    setMode('select'); return;
  }
  if (mode === 'place') {
    commit(() => {
      const it = makeItem(placeSym, sx, sy, placeRot, pg); if (placeMir) it.mir = true; pg.items.push(it); sel = new Set([it.id]);
      if (it.role === 'main' && SYM[it.sym].prefix) lastMain[SYM[it.sym].prefix] = it.tag;
      if (it.sym === 'term') lastMain.X = it.tag;
    });
    drawGhost(mx, my); return;
  }
  if (mode === 'text') {
    const t = prompt('Text:', ''); if (t) commit(() => { const it = { id: uid(), sym: 'text', x: sx, y: sy, text: t, size: 3.5 }; pg.items.push(it); sel = new Set([it.id]); });
    setMode('select'); return;
  }
  if (mode === 'wire') {
    const [sx, sy] = snapPt(mx, my);
    if (!wireDraft) { wireDraft = { pts: [[sx, sy]] }; drawWirePreview(sx, sy); return; }
    const last = wireDraft.pts[wireDraft.pts.length - 1];
    if (sx === last[0] && sy === last[1]) return;
    wireDraft.pts.push(...routeL(last, [sx, sy]));
    if (connAt(pg, sx, sy) && wireDraft.pts.length > 1) finishWire(); else drawWirePreview(sx, sy);
    return;
  }
  // select mode
  const id = hitId(e);
  if (id) {
    if (e.shiftKey || e.ctrlKey) { sel.has(id) ? sel.delete(id) : sel.add(id); render(); return; }
    if (!sel.has(id)) { sel = new Set([id]); render(); }
    const f = findItem(id); if (f && f.it && f.it.role === 'main' && SYM[f.it.sym] && SYM[f.it.sym].prefix) lastMain[SYM[f.it.sym].prefix] = f.it.tag;
    if (f && f.it && f.it.sym === 'term') lastMain.X = f.it.tag;
    drag = { start: [mx, my], pre: snapshot(), orig: clone({ items: pg.items, wires: pg.wires, cables: pg.cables || [] }), moved: false, d: [0, 0] };
  } else {
    if (!e.shiftKey) { sel.clear(); render(); }
    box = { start: [mx, my], cur: [mx, my] };
  }
});

window.addEventListener('mousemove', e => {
  lastMouse = [e.clientX, e.clientY];
  if (pan) { view.x = pan.vx - (e.clientX - pan.cx) / view.s; view.y = pan.vy - (e.clientY - pan.cy) / view.s; applyView(); return; }
  if (e.target !== svg && !svg.contains(e.target) && !drag && !box && !fdrag && !fbox) return;
  const [mx, my] = toMM(e);
  if (isFloor(page())) { if (svg.contains(e.target) || fdrag || fbox) fpMove(page(), mx, my); return; }
  $('#st-pos').textContent = `X ${snap(mx)}  Y ${snap(my)}  |  Column ${colOf(mx)}  |  Page ${pageName(page())}`;
  if (mode === 'macro') { drawMacroGhost(mx, my); return; }
  if (mode === 'cable') {
    let s = `<rect class="snap" x="${snap(mx) - 1}" y="${snap(my) - 1}" width="2" height="2"/>`;
    if (cdrag) {
      const a = cdrag.a, q = [snap(mx), snap(my)];
      cdrag.b = Math.abs(q[0] - a[0]) >= Math.abs(q[1] - a[1]) ? [q[0], a[1]] : [a[0], q[1]];
      s += `<path class="wprev" d="M${a.join(',')}L${cdrag.b.join(',')}"/>`;
    }
    $('#overlay').innerHTML = s; return;
  }
  if (mode === 'macro') { drawMacroGhost(mx, my); return; }
  if (mode === 'cable') {
    let s = `<rect class="snap" x="${snap(mx) - 1}" y="${snap(my) - 1}" width="2" height="2"/>`;
    if (cdrag) {
      const a = cdrag.a, q = [snap(mx), snap(my)];
      cdrag.b = Math.abs(q[0] - a[0]) >= Math.abs(q[1] - a[1]) ? [q[0], a[1]] : [a[0], q[1]];
      s += `<path class="wprev" d="M${a.join(',')}L${cdrag.b.join(',')}"/>`;
    }
    $('#overlay').innerHTML = s; return;
  }
  if (mode === 'place') drawGhost(mx, my);
  else if (mode === 'wire') drawWirePreview(...snapPt(mx, my));
  else if (drag) {
    const d = [snap(mx - drag.start[0]), snap(my - drag.start[1])];
    if (d[0] === drag.d[0] && d[1] === drag.d[1]) return;
    drag.d = d; drag.moved = true; applyMove(page(), drag.orig, d); renderCanvas();
  } else if (box) {
    box.cur = [mx, my]; const [a, b] = box.start, [c, dd] = box.cur;
    $('#overlay').innerHTML = `<rect class="selbox" x="${Math.min(a, c)}" y="${Math.min(b, dd)}" width="${Math.abs(c - a)}" height="${Math.abs(dd - b)}"/>`;
  }
});

window.addEventListener('mouseup', e => {
  if (pan) { pan = null; svg.classList.remove('pan'); return; }
  if (isFloor(page()) && (fdrag || fbox)) { fpUp(page()); return; }
  if (cdrag) {
    const { a, b } = cdrag; cdrag = null; $('#overlay').innerHTML = '';
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) >= 4) {
      const pg = page();
      commit(() => {
        const c = { id: uid(), x1: Math.min(a[0], b[0]), y1: Math.min(a[1], b[1]), x2: Math.max(a[0], b[0]), y2: Math.max(a[1], b[1]), tag: nextCableTag(), fn: pg.fn || '', loc: pg.loc || '', ctype: '', len: '', cond: {} };
        c.ctype = defaultCableType(pg, c); pg.cables.push(c); sel = new Set([c.id]);
      });
      setMode('select');
    }
    return;
  }
  if (cdrag) {
    const { a, b } = cdrag; cdrag = null; $('#overlay').innerHTML = '';
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) >= 4) {
      const pg = page();
      commit(() => {
        const c = { id: uid(), x1: Math.min(a[0], b[0]), y1: Math.min(a[1], b[1]), x2: Math.max(a[0], b[0]), y2: Math.max(a[1], b[1]), tag: nextCableTag(), fn: pg.fn || '', loc: pg.loc || '', ctype: '', len: '', cond: {} };
        c.ctype = defaultCableType(pg, c); pg.cables.push(c); sel = new Set([c.id]);
      });
      setMode('select');
    }
    return;
  }
  if (drag) {
    if (drag.moved) {
      const pg = page(); pg.wires.forEach(w => { w.pts = simplify(w.pts); }); pg.wires = pg.wires.filter(w => w.pts.length >= 2);
      pushUndo(drag.pre); markDirty(); render();
    }
    drag = null; return;
  }
  if (box) {
    const [a, b] = box.start, [c, d] = box.cur; const x0 = Math.min(a, c), x1 = Math.max(a, c), y0 = Math.min(b, d), y1 = Math.max(b, d);
    if (x1 - x0 > 1 || y1 - y0 > 1) {
      const pg = page();
      for (const it of pg.items) { const bb = itemBox(it); if (bb[0] >= x0 && bb[2] <= x1 && bb[1] >= y0 && bb[3] <= y1) sel.add(it.id); }
      for (const w of pg.wires) if (w.pts.every(p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1)) sel.add(w.id);
      for (const c of pg.cables || []) if (c.x1 >= x0 && c.x2 <= x1 && c.y1 >= y0 && c.y2 <= y1) sel.add(c.id);
    }
    box = null; $('#overlay').innerHTML = ''; render();
  }
});

svg.addEventListener('dblclick', e => {
  if (mode === 'wire') { if (wireDraft) finishWire(); return; }
  if (mode === 'roompoly') { if (fpoly) { fpoly.pop(); finishPoly(page()); } return; }
  if (isFloor(page())) { const inp = $('#props input'); if (hitId(e) && inp) { inp.focus(); inp.select(); } return; }
  const id = hitId(e); if (!id) return;
  const f = findItem(id);
  if (f && f.it && f.it.sym === 'text') { const t = prompt('Text:', f.it.text); if (t != null) commit(() => { f.it.text = t; }); return; }
  const inp = $('#props input'); if (inp) { inp.focus(); inp.select(); }
});
svg.addEventListener('contextmenu', e => e.preventDefault());
svg.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || !e.shiftKey) { const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }
  else { view.x += e.deltaY / view.s; applyView(); }
}, { passive: false });
window.addEventListener('resize', () => applyView());

function applyMove(pg, orig, d) {
  pg.items = clone(orig.items); pg.wires = clone(orig.wires); pg.cables = clone(orig.cables || []);
  for (const c of pg.cables) if (sel.has(c.id)) { c.x1 += d[0]; c.x2 += d[0]; c.y1 += d[1]; c.y2 += d[1]; }
  const moved = new Map();
  for (const it of pg.items) if (sel.has(it.id)) {
    const before = connPts(it); it.x += d[0]; it.y += d[1];
    const after = connPts(it); before.forEach((c, i) => moved.set(c.x + ',' + c.y, [after[i].x, after[i].y]));
  }
  rubberBand(pg, moved, d);
}
function rubberBand(pg, moved, d) {
  for (const w of pg.wires) {
    if (sel.has(w.id)) { if (d) w.pts = w.pts.map(p => [p[0] + d[0], p[1] + d[1]]); continue; }
    const n = w.pts.length; const a = moved.get(w.pts[0].join(',')), b = moved.get(w.pts[n - 1].join(','));
    if (a && b && d && a[0] - w.pts[0][0] === b[0] - w.pts[n - 1][0] && a[1] - w.pts[0][1] === b[1] - w.pts[n - 1][1]) { w.pts = w.pts.map(p => [p[0] + d[0], p[1] + d[1]]); continue; }
    if (a) w.pts = moveEnd(w.pts, 0, a);
    if (b) w.pts = moveEnd(w.pts, w.pts.length - 1, b);
  }
}
function moveEnd(pts, i, np) {
  pts = pts.map(p => p.slice()); const o = pts[i];
  const j = i === 0 ? 1 : pts.length - 2; const other = pts[j];
  const wasV = o[0] === other[0];
  if (pts.length === 2) {
    if ((wasV && np[0] === other[0]) || (!wasV && np[1] === other[1])) { pts[i] = np; return pts; }
    let mid;
    if (wasV) { const my = snap((np[1] + other[1]) / 2); mid = [[other[0], my], [np[0], my]]; }
    else { const mx = snap((np[0] + other[0]) / 2); mid = [[mx, other[1]], [mx, np[1]]]; }
    return i === 0 ? [np, ...mid.reverse(), other] : [other, ...mid, np];
  }
  if (wasV) other[0] = np[0]; else other[1] = np[1];
  pts[i] = np; return pts;
}

// ---------- ghost / wire preview ----------
function drawGhost(mx, my) {
  if (isFloor(page()) && mode === 'fpplace') { drawFpGhost(page(), mx, my); return; }
  if (!placeSym) return;
  if (page().report) return;
  const it = { id: 'ghost', sym: placeSym, x: snap(mx), y: snap(my), rot: placeRot, mir: placeMir, tag: '', cl: SYM[placeSym].conns.map(c => c[2]), fn: '', loc: '', ipName: '' };
  $('#overlay').innerHTML = itemSVG(it, page(), false, true);
}
function routeL(a, b) {
  if (a[0] === b[0] || a[1] === b[1]) return [b];
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
  return dx >= dy ? [[b[0], a[1]], b] : [[a[0], b[1]], b];
}
function drawWirePreview(sx, sy) {
  let s = `<rect class="snap" x="${sx - 1}" y="${sy - 1}" width="2" height="2"/>`;
  if (wireDraft) {
    const pts = wireDraft.pts.concat(routeL(wireDraft.pts[wireDraft.pts.length - 1], [sx, sy]));
    s += `<path class="wprev" d="M${pts.map(p => p.join(',')).join('L')}"/>`;
  }
  if (connAt(page(), sx, sy)) s += `<circle class="cpt" cx="${sx}" cy="${sy}" r="1.6"/>`;
  $('#overlay').innerHTML = s;
}
function finishWire() {
  if (!wireDraft) return;
  const pts = simplify(wireDraft.pts); wireDraft = null; $('#overlay').innerHTML = '';
  if (pts.length >= 2) commit(() => { const w = Object.assign({ id: uid(), pts }, autoWire(page(), pts) || {}); page().wires.push(w); });
}

// ---------- keyboard ----------
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') { if (e.key === 'Escape') e.target.blur(); return; }
  if ($('#dlg').open) return;
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  if (k === ' ') { spaceDown = true; e.preventDefault(); return; }
  if (c && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (c && k === 'y') { e.preventDefault(); redo(); }
  else if (c && k === 's') { e.preventDefault(); e.shiftKey ? saveAs() : save(); }
  else if (c && k === 'o') { e.preventDefault(); openFile(); }
  else if (c && k === 'n') { e.preventDefault(); fileNew(); }
  else if (c && k === 'p') { e.preventDefault(); printAll(); }
  else if (c && k === 'c') { e.preventDefault(); copySel(); }
  else if (c && k === 'x') { e.preventDefault(); copySel(); delSel(); }
  else if (c && k === 'v') { e.preventDefault(); paste(); }
  else if (c && k === 'a') { e.preventDefault(); const pg = page(); sel = new Set([...pg.items.map(i => i.id), ...pg.wires.map(w => w.id)]); render(); }
  else if (k === 'escape') { if (mode === 'roompoly' && fpoly) finishPoly(page()); else if (mode === 'wire' && wireDraft) finishWire(); else if (mode !== 'select') setMode('select'); else { sel.clear(); render(); } closeMenus(); }
  else if (k === 'delete' || k === 'backspace') delSel();
  else if (k === 'r') { if (mode === 'place' || mode === 'fpplace') { placeRot = (placeRot + 90) % 360; const r = svg.getBoundingClientRect(); drawGhost(...toMM({ clientX: lastMouse[0], clientY: lastMouse[1] })); } else rotateSel(); }
  else if (k === 'tab') {
    if (mode === 'place' || mode === 'fpplace') {
      e.preventDefault();
      if (mode === 'fpplace') placeRot = (placeRot + 90) % 360;
      else { const v = ((placeRot / 90) + (placeMir ? 4 : 0) + 1) % 8; placeRot = (v % 4) * 90; placeMir = v >= 4; flash('Variant ' + 'ABCDEFGH'[v]); }
      drawGhost(...toMM({ clientX: lastMouse[0], clientY: lastMouse[1] }));
    }
  }
  else if (k === 'm') { if (mode === 'place') { placeMir = !placeMir; drawGhost(...toMM({ clientX: lastMouse[0], clientY: lastMouse[1] })); } else mirrorSel(); }
  else if (k === 'g') toggleSnap();
  else if (k === 'c') ACTIONS.cableMode();
  else if (k === 'w') { if (!isFloor(page())) setMode('wire'); }
  else if (k === 't') { if (!isFloor(page())) setMode('text'); }
  else if (k === 'f') zoomFit();
  else if (k === '+' || k === '=') zoomAt(1.25);
  else if (k === '-') zoomAt(0.8);
  else if (k === 'pagedown') { e.preventDefault(); stepPage(1); }
  else if (k === 'pageup') { e.preventDefault(); stepPage(-1); }
});
window.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; });

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
    const np = clone(pg); np.id = uid();
    np.num = String(Math.max(0, ...P.pages.filter(p => p.fn === pg.fn && p.loc === pg.loc).map(p => parseInt(p.num, 10) || 0)) + 1);
    np.desc = pg.desc + ' (copy)';
    P.pages.push(np);
    const tagMap = new Map(); const tmp = [];
    for (const it of np.items) {
      it.id = uid(); const d = SYM[it.sym];
      if (d && d.prefix && it.tag && it.sym !== 'term' && d.role !== 'plc') {
        const k = devKey(it);
        if (!tagMap.has(k)) {
          const m = /^([A-Za-z]+)\d*$/.exec(it.tag); const nt = nextTag(it.fn, it.loc, m ? m[1] : d.prefix, d.res);
          tagMap.set(k, nt); const t = { id: '__tmp', sym: 'box', fn: it.fn, loc: it.loc, tag: nt, x: -999, y: -999 }; tmp.push(t); pg.items.push(t);
        }
        it.tag = tagMap.get(k);
      }
    }
    pg.items = pg.items.filter(i => i.id !== '__tmp');
    for (const it of np.items) if (it.sym === 'term') { it.tn = '__'; it.tn = nextTerminal(it.fn, it.loc, it.tag); }
    np.wires.forEach(w => { w.id = uid(); delete w.no; });
    sortPages(); curId = np.id; sel.clear();
  });
}

// ---------- panels ----------
function renderPages() {
  const el = $('#tab-pages'); const pg = page();
  let s = '<div class="navbtns"><button class="btn small" data-act="addPage">New page</button><button class="btn small" data-act="dupPage">Duplicate</button><button class="btn small" data-act="pageProps">Properties</button><button class="btn small" data-act="delPage">Delete</button></div>';
  s += `<div class="navgroup">${esc(P.name)}</div>`;
  let grp = null;
  for (const p of P.pages) {
    if (isFloor(p)) continue;
    const g = (home() ? [friendlyCkt(p.fn), niceRoom(p.loc)].filter(Boolean).join(' · ') : fl(p.fn, p.loc)) || L('nofl');
    if (g !== grp) { s += `<div class="navgroup">${esc(g)}</div>`; grp = g; }
    s += `<div class="navitem${p === pg ? ' active' : ''}" data-page="${p.id}"><span class="num">${esc(p.num)}</span><span>${esc(p.desc || '')}</span></div>`;
  }
  const fps = P.pages.filter(isFloor);
  s += '<div class="navgroup navhead">Floor plans</div>';
  if (!fps.length) s += '<div class="navbtns"><button class="btn small" data-act="addFloorPage">New floor plan page</button></div>';
  let lgrp = null;
  for (const p of fps) {
    const lv = levelOf(p); const g = lv ? lv.name : '?';
    if (g !== lgrp) { s += `<div class="navgroup">${esc(g)}</div>`; lgrp = g; }
    s += `<div class="navitem${p === pg ? ' active' : ''}" data-page="${p.id}"><span class="num">${esc(p.num)}</span><span>${esc(p.desc || '')}</span></div>`;
  }
  s += '<div class="navgroup navhead">Reports</div>';
  for (const r of REPORTS) s += `<div class="navitem${r === pg ? ' active' : ''}" data-page="${r.id}"><span class="num">${esc(r.num)}</span><span>${esc(r.desc)}${r.sheets > 1 ? ` (${r.sheet}/${r.sheets})` : ''}</span></div>`;
  el.innerHTML = s;
}
function renderPageTabs() {
  const pg = page();
  $('#pagetabs').innerHTML = allPages().map(p => `<div class="ptab${p === pg ? ' active' : ''}" data-page="${p.id}">${esc(pageName(p))}</div>`).join('');
}
let devFilter = '';
function renderDevices() {
  const el = $('#tab-devices');
  const q = devFilter.toLowerCase();
  const devs = [...IX.dev.values()].sort((a, b) => natCmp(a.fn, b.fn) || natCmp(a.loc, b.loc) || natCmp(a.tag, b.tag));
  let s = `<input class="search" id="devsearch" placeholder="Filter devices" value="${esc(devFilter)}">`;
  for (const d of devs) {
    const id = dispFull(d.fn, d.loc, d.tag);
    const desc = (d.main || d.items[0]).desc || '';
    if (q && !(id + ' ' + desc + ' ' + d.items.map(i => i.part || '').join(' ')).toLowerCase().includes(q)) continue;
    const first = d.main || d.items[0];
    s += `<div class="dev"><div class="devhead" data-goto="${first.id}"><b>${esc(id)}</b><span class="d">${esc(desc)}</span></div>`;
    for (const it of d.items) {
      const p = IX.pos.get(it.id);
      const nm = it.sym === 'term' ? `Terminal ${it.tn || ''}` : SYM[it.sym].name;
      const cl = it.sym === 'term' ? '' : it.role === 'plc' ? (it.addr || '') : clText(it);
      s += `<div class="devfn" data-goto="${it.id}" title="${esc(nm + ' ' + cl)}">${it.role === 'main' && !SYM[it.sym].res ? '<span class="badge main">main</span>' : ''}<span class="n">${esc(nm)}</span><span class="c">${esc(cl)}</span><span class="r">${esc(IX.pos.get(it.id).pg ? ref(page(), it) : 'floor plan')}</span></div>`;
    }
    s += '</div>';
  }
  if (IX.ips.size) {
    s += '<div class="navgroup">Interruption points</div>';
    for (const [name, list] of [...IX.ips.entries()].sort((a, b) => natCmp(a[0], b[0]))) {
      s += `<div class="dev"><div class="devhead" data-goto="${list[0].id}"><b>${esc(name)}</b><span class="d">${list.length} location(s)</span></div>`;
      for (const it of list) { const p = IX.pos.get(it.id); s += `<div class="devfn" data-goto="${it.id}"><span>Interruption point</span><span class="r">${esc(pageName(p.pg))}.${p.col}</span></div>`; }
      s += '</div>';
    }
  }
  el.innerHTML = s;
  const inp = $('#devsearch'); inp.oninput = () => { devFilter = inp.value; renderDevices(); const i2 = $('#devsearch'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); };
}
function gotoItem(id) {
  if (String(id).startsWith('page:')) { goPage(id.slice(5)); return; }
  const f = findItem(id); if (!f) return;
  if (!f.pg) { showOnFloor(id); return; }
  if (f.cab) { curId = f.pg.id; sel = new Set([id]); render(); centerOn(f.cab.x1, f.cab.y1); return; }
  curId = f.pg.id; sel = new Set([id]); render();
  const o = f.it || { x: f.w.pts[0][0], y: f.w.pts[0][1] }; centerOn(o.x, o.y);
}
function renderSymbolsOld() {
  const fp = P && isFloor(page());
  const keys = SYMORDER.filter(k => fp ? SYM[k].fp : (!SYM[k].ind || !P || S().industrial));
  const cats = [];
  for (const k of keys) { const c = SYM[k].cat; if (!cats.includes(c)) cats.push(c); }
  let s = fp ? '<div class="note" style="padding:6px 10px 0">Click a symbol, then click on the floor plan. New devices get the next free name and the room they are placed in.</div>' : '';
  for (const c of cats) {
    s += `<div class="symcat">${esc(c)}</div><div class="symgrid">`;
    for (const k of keys.filter(k => SYM[k].cat === c)) s += `<div class="symcard" data-sym="${k}" title="${esc(SYM[k].name)}">${fp ? fpIcon(k).replace('width:20px;height:20px', 'width:40px;height:40px') : symPreview(k)}<span>${esc(SYM[k].name)}</span></div>`;
    s += '</div>';
  }
  if (!fp) s += '<div class="symcat">Other</div><div class="navbtns"><button class="btn small" data-act="wireMode">Connection (W)</button><button class="btn small" data-act="textMode">Text (T)</button></div>';
  $('#tab-symbols').innerHTML = s;
}

// ---------- properties ----------
function clText(it) {
  const d = SYM[it.sym]; const cl = it.cl || []; const c = d.conns;
  const paired = c.length % 2 === 0 && c.every((p, i) => i % 2 || p[0] === c[i + 1][0]);
  if (!paired) return cl.filter(Boolean).join(' ');
  const out = []; for (let i = 0; i < cl.length; i += 2) out.push(`${cl[i] || ''}-${cl[i + 1] || ''}`); return out.join(' ');
}
const row = (k, label, v, type = 'text', extra = '') => {
  if (type === 'textarea') return `<div class="prow"><label>${label}</label><textarea data-k="${k}" ${extra}>${esc(v)}</textarea></div>`;
  if (type === 'select') return `<div class="prow"><label>${label}</label><select data-k="${k}">${extra}</select></div>`;
  return `<div class="prow"><label>${label}</label><input type="${type}" data-k="${k}" value="${esc(v)}" ${extra}></div>`;
};
function renderProps() {
  const el = $('#props'); const pg = page();
  const ids = [...sel];
  if (isFloor(pg)) { renderFloorProps(pg); return; }
  if (pg.report) {
    el.innerHTML = `<div class="ident">${esc(pg.title)}</div><div class="sub">Generated report, sheet ${pg.sheet} of ${pg.sheets}</div>
      <div class="pgrp"><h4>Report</h4><div class="note">${pg.report === 'cover' ? 'Generated from the project properties (name, description, company, drawn by). Turn it off in Project properties.' : pg.report === 'toc' ? 'Every page with its description and latest revision. Click a row to open that page.' : pg.report === 'conn' ? 'Every connection with its source and target, wire number, color and size.' : pg.report === 'cables' || pg.report === 'cabdiag' ? 'Cables with their conductors and where each one goes. Draw cables with the Cable tool.' : pg.report === 'rev' ? 'All revisions and the pages changed in each. Manage them in Project > Revisions.' : pg.report === 'bom' ? 'Grouped by part number. Enter part numbers on the main function of each device (or on each terminal).' : pg.report === 'panel' ? 'One row per breaker, sorted by slot. Set slot, amps and panel on each breaker. Rooms come from the devices on each circuit.' : 'One row per terminal, sorted by terminal number. Targets are found by following connections from each side of the terminal.'} Click a row to jump to the device.</div>
      <div class="btnrow">${['bom', 'panel', 'term'].includes(pg.report) ? `<button class="btn" data-act="${pg.report === 'bom' ? 'exportBOM' : pg.report === 'panel' ? 'exportPanel' : 'exportTerminals'}">Export CSV</button>` : ''}<button class="btn" data-act="exportPDF">Export PDF</button><button class="btn" data-act="printAll">Print / PDF</button></div></div>`;
    return;
  }
  if (!ids.length) {
    const p = IX ? pg.items.length : 0;
    el.innerHTML = `<div class="ident">Page ${esc(pageName(pg))}</div><div class="sub">${esc(pg.desc)}</div>
      <div class="pgrp"><h4>Page</h4>${row('pg.fn', L('fn'), pg.fn)}${row('pg.loc', L('loc'), pg.loc)}${row('pg.num', 'Page number', pg.num)}${row('pg.desc', 'Description', pg.desc)}</div>
      ${pg.fn && allCircuits().includes(pg.fn) ? `<div class="pgrp"><h4>Circuit color</h4><div class="prow"><label>${esc(dispCkt(pg.fn))}</label><input type="color" data-k="ckt.${esc(pg.fn)}" value="${circuitColor(pg.fn)}"></div></div>` : ''}
      <div class="pgrp"><h4>Content</h4><div class="note">${p} symbol(s), ${pg.wires.length} connection(s)</div></div>
      <div class="pgrp"><h4>Project</h4>${row('pr.name', 'Project name', P.name)}${row('pr.company', 'Company', P.company)}${row('pr.author', 'Drawn by', P.author)}</div>`;
    return;
  }
  if (ids.length > 1) {
    el.innerHTML = `<div class="ident">${ids.length} objects selected</div><div class="btnrow"><button class="btn" data-act="rotateSel">Rotate (R)</button><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const f = findItem(ids[0]); if (!f) { el.innerHTML = ''; return; }
  if (f.cab) {
    const c = f.cab; const cr = cableCrossings(pg, c);
    const colOpts = v => [['', '(wire color)'], ['BK', 'Black'], ['WH', 'White'], ['RD', 'Red'], ['BL', 'Blue'], ['GN', 'Green'], ['BARE', 'Bare'], ['YL', 'Yellow']].map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
    el.innerHTML = `<div class="ident">${esc(home() ? 'Cable ' + c.tag.replace(/^W/, '') : fl(c.fn, c.loc) + '-' + c.tag)}</div><div class="sub">Cable, ${cr.length} conductor(s)</div>
      <div class="pgrp"><h4>Cable</h4>${row('cab.tag', L('tag'), c.tag)}${row('cab.ctype', 'Type', c.ctype || '', 'text', 'placeholder="e.g. 14/2 w/G NM-B"')}${row('cab.len', 'Length', c.len || '', 'text', 'placeholder="e.g. 25 ft"')}${row('cab.part', 'Part number', c.part || '')}${row('cab.desc', L('desc'), c.desc || '', 'textarea')}
      <div class="btnrow"><button class="btn small" data-act="cableAutoType">Set type from wires</button></div></div>
      <div class="pgrp"><h4>Conductors</h4>${cr.length ? cr.map((x, i) => row('cond.' + x.w.id, `${i + 1}. wire ${esc(WN.get(x.w.id) || '')}`, '', 'select', colOpts((c.cond || {})[x.w.id] || ''))).join('') : '<div class="note">Drag the cable across the wires it carries.</div>'}</div>
      <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  if (f.w) {
    const w = f.w;
    el.innerHTML = `<div class="ident">Connection</div><div class="sub">Wire number: <b>${esc(WN.get(w.id) || '(none)')}</b></div>
      <div class="pgrp"><h4>Connection</h4>${row('w.no', 'Wire number', w.no || '', 'text', 'placeholder="auto"')}
      ${row('w.color', 'Color', '', 'select', [['', '(none)'], ['BK', 'Black (BK)'], ['WH', 'White (WH)'], ['GN', 'Green (GN)'], ['BARE', 'Bare copper'], ['RD', 'Red (RD)'], ['BL', 'Blue (BL)'], ['YL', 'Yellow (YL)']].map(([v, l]) => `<option value="${v}" ${(w.color || '') === v ? 'selected' : ''}>${l}</option>`).join(''))}
      ${row('w.awg', 'Wire size', '', 'select', [['', '(none)'], ['14', '14 AWG'], ['12', '12 AWG'], ['10', '10 AWG'], ['8', '8 AWG'], ['6', '6 AWG'], ['4', '4 AWG']].map(([v, l]) => `<option value="${v}" ${(w.awg || '') === v ? 'selected' : ''}>${l}</option>`).join(''))}
      ${row('w.cs', 'Cross-section', w.cs || '', 'text', 'placeholder="e.g. 1.5 mm2"')}
      <div class="note">A wire number entered here applies to the whole potential (all connected wires).</div></div>
      <div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const it = f.it;
  if (it.sym === 'text') {
    el.innerHTML = `<div class="ident">Text</div><div class="pgrp">${row('it.text', 'Text', it.text, 'textarea')}${row('it.size', 'Height (mm)', it.size || 3.5, 'number', 'step="0.5" min="1"')}<div class="prow"><label>Bold</label><input type="checkbox" data-k="it.bold" ${it.bold ? 'checked' : ''} style="width:auto"></div></div><div class="btnrow"><button class="btn" data-act="delSel">Delete</button></div>`;
    return;
  }
  const d = SYM[it.sym];
  let s = '';
  if (d.role === 'ip') {
    const others = (IX.ips.get(it.ipName) || []).filter(o => o !== it);
    s += `<div class="ident">Interruption point ${esc(it.ipName)}</div><div class="sub">${d.name}</div>
      <div class="pgrp"><h4>Properties</h4>${row('it.ipName', 'Name', it.ipName, 'text', 'list="dl-ip"')}<datalist id="dl-ip">${[...IX.ips.keys()].map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
      <div class="pgrp"><h4>Cross-references</h4><div class="fnlist">${others.map(o => `<div data-goto="${o.id}"><span>${esc(o.ipName)}</span><span class="r">${esc(ref(pg, o))}</span></div>`).join('') || '<span class="note">No partner on another page yet.</span>'}</div></div>`;
  } else if (d.role === 'pe') {
    s += `<div class="ident">PE / ground</div><div class="sub">Joins the PE potential</div>`;
  } else {
    const dv = IX.dev.get(devKey(it));
    const sameFL = [...IX.dev.values()].filter(x => x.fn === (it.fn || '') && x.loc === (it.loc || ''));
    const tagOpts = sameFL.filter(x => (d.role === 'term') === x.items.some(i => i.sym === 'term')).map(x => `<option value="${esc(x.tag)}">`).join('');
    s += `<div class="ident">${esc(dispFull(it.fn, it.loc, it.tag))}${it.sym === 'term' ? ':' + esc(it.tn) : ''}</div><div class="sub">${d.name}${it.role === 'main' ? ' (main function)' : it.role === 'aux' ? ' (auxiliary function)' : ''}</div>`;
    s += `<div class="pgrp"><h4>${home() ? 'Name' : 'Device tag'}</h4>${row('it.fn', L('fn'), it.fn)}${row('it.loc', L('loc'), it.loc, 'text', 'list="dl-room"')}<datalist id="dl-room">${roomNames().map(c => `<option value="${esc(c)}">`).join('')}</datalist>${row('it.tag', d.role === 'term' ? 'Terminal strip' : L('tag'), it.tag, 'text', 'list="dl-tags"')}<datalist id="dl-tags">${tagOpts}</datalist>`;
    if (d.brk) {
      const pans = [...IX.dev.values()].filter(x => x.items.some(i => i.sym === 'rpnl')).map(x => x.tag);
      s += row('it.slot', 'Panel slot', it.slot || '') + row('it.amps', 'Amps', '', 'select', ['15', '20', '25', '30', '40', '50', '60'].map(a => `<option ${String(it.amps || d.amps) === a ? 'selected' : ''}>${a}</option>`).join(''));
      s += row('it.panel', 'Panel', '', 'select', ['<option value="">(none)</option>'].concat(pans.map(p => `<option value="${esc(p)}" ${it.panel === p ? 'selected' : ''}>${esc(dispTag(p))}</option>`)).join(''));
    }
    if (d.role === 'term') s += row('it.tn', 'Terminal no.', it.tn);
    if (!d.res && (d.role === 'main' || d.role === 'aux')) s += row('it.role', 'Function', '', 'select', `<option value="main" ${it.role === 'main' ? 'selected' : ''}>Main function</option><option value="aux" ${it.role === 'aux' ? 'selected' : ''}>Auxiliary function</option>`);
    if (it.role === 'main' && dv && dv.items.length > 1) s += '<div class="note">Changing =, + or - on the main function renames the whole device.</div>';
    s += '</div>';
    s += `<div class="pgrp"><h4>Data</h4>${row('it.desc', L('desc'), it.desc || '', 'textarea')}`;
    if (d.role === 'plc') s += row('it.addr', 'Address', it.addr || '');
    s += `${row('it.part', 'Part number', it.part || '')}${row('it.tech', L('tech'), it.tech || '')}</div>`;
    if (d.fp) {
      const pl = placeOf(it.id);
      s += `<div class="pgrp"><h4>Floor plan</h4><div class="note">${pl ? 'Placed on ' + esc(pl.lv.name) + '.' : 'Not on a floor plan yet.'}</div><div class="btnrow">${pl ? `<button class="btn small" data-showfloor="${it.id}">Show on floor plan</button>` : '<button class="btn small" data-act="placeOnFloor">Place on floor plan</button>'}</div></div>`;
    }
    if (d.role !== 'term' && d.role !== 'plc' && (S().connLabels || !d.res)) {
      s += '<div class="pgrp"><h4>Connection points</h4>';
      d.conns.forEach((c, i) => { s += row('cl.' + i, `Point ${i + 1}`, (it.cl || [])[i] || ''); });
      if (d.contact && !d.fixed && it.role === 'aux') s += '<div class="btnrow"><button class="btn small" data-act="renumContact">Assign next free numbers</button></div>';
      s += '</div>';
    }
    if (dv && dv.items.length) {
      s += `<div class="pgrp"><h4>${home() ? 'Where it appears' : 'Functions of ' + esc(fullIdent(it))}</h4><div class="fnlist">`;
      for (const o of dv.items) {
        const p = IX.pos.get(o.id);
        const nm = o.sym === 'term' ? 'Terminal ' + (o.tn || '') : SYM[o.sym].name;
        s += `<div data-goto="${o.id}" class="${o === it ? 'me' : ''}"><span>${esc(nm)}</span><span style="color:var(--muted)">${esc(o.sym === 'term' ? '' : clText(o))}</span><span class="r">${esc(ref(pg, o))}</span></div>`;
      }
      s += '</div></div>';
    }
  }
  s += todoPanelHTML(it.id);
  s += `<div class="pgrp"><h4>Placement</h4>${row('it.variant', 'Variant', '', 'select', ['A 0°', 'B 90°', 'C 180°', 'D 270°', 'E 0° mirrored', 'F 90° mirrored', 'G 180° mirrored', 'H 270° mirrored'].map(l => `<option value="${l[0]}" ${variantOf(it) === l[0] ? 'selected' : ''}>${l}</option>`).join(''))}<div class="note">X ${it.x}  Y ${it.y}  Column ${colOf(it.x)}</div><div class="btnrow"><button class="btn" data-act="rotateSel">Rotate (R)</button><button class="btn" data-act="mirrorSel">Mirror (M)</button><button class="btn" data-act="delSel">Delete</button></div></div>`;
  el.innerHTML = s;
}

$('#props').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
  const pg = page();
  const dot = k.indexOf('.'); const scope = k.slice(0, dot), key = k.slice(dot + 1);
  if (fpPropChange(scope, key, v)) return;
  if (scope === 'pg') {
    if (key === 'num' && P.pages.some(p => p !== pg && p.fn === pg.fn && p.loc === pg.loc && p.num === v)) { alert('A page with that name already exists.'); renderProps(); return; }
    commit(() => {
      if (key === 'fn' || key === 'loc') for (const it of pg.items) if (it[key] === pg[key] && it.sym !== 'ip' && it.sym !== 'pe' && it.sym !== 'text') it[key] = v;
      pg[key] = v; sortPages();
    }, { props: false });
    return;
  }
  if (scope === 'pr') { commit(() => { P[key] = v; }, { props: false }); return; }
  const f = findItem([...sel][0]); if (!f) return;
  if (scope === 'w') { commit(() => { if (v) f.w[key] = v; else delete f.w[key]; }); return; }
  if (scope === 'cab') { commit(() => { f.cab[key] = v; }, { props: false }); return; }
  if (scope === 'cond') { commit(() => { f.cab.cond = f.cab.cond || {}; if (v) f.cab.cond[key] = v; else delete f.cab.cond[key]; }, { props: false }); return; }
  const it = f.it;
  if (scope === 'cl') { commit(() => { it.cl = it.cl || []; it.cl[+key] = v; }, { props: false }); return; }
  if (key === 'variant') { const n = 'ABCDEFGH'.indexOf(v); transformSel(x => { x.rot = (n % 4) * 90; x.mir = n >= 4 || undefined; }, [it]); return; }
  commit(() => applyItemChange(it, key, v));
});
function applyItemChange(it, key, v) {
    if (key === 'size') it.size = Math.max(1, parseFloat(v) || 3.5);
    else if ((key === 'fn' || key === 'loc' || key === 'tag') && it.role === 'main') {
      const k0 = devKey(it);
      for (const o of allItems()) if (o !== it && devKey(o) === k0) o[key] = v;
      it[key] = v; if (SYM[it.sym].prefix && key === 'tag') lastMain[SYM[it.sym].prefix] = v;
    } else if (key === 'tag' && it.sym === 'term') { it.tag = v; it.tn = nextTerminal(it.fn, it.loc, v); lastMain.X = v; }
    else if ((key === 'fn' || key === 'loc' || key === 'tag') && it.role === 'aux') { it[key] = v; assignContactNumbers(it); }
    else if (key === 'role') { it.role = v; if (v === 'aux') assignContactNumbers(it); }
    else if (key === 'ipName') { it.ipName = v; P._lastIp = v; }
    else it[key] = v;
}

// ---------- toolbar & menus ----------
const ICON = {
  select: '<svg viewBox="0 0 20 20"><path d="M5 3l10 7-4.5 1 2.5 5-2 1-2.5-5L5 15z" fill="#2b3442"/></svg>',
  wire: '<svg viewBox="0 0 20 20"><path d="M3 15h6V5h8" fill="none" stroke="#0b2e8f" stroke-width="1.6"/><circle cx="3" cy="15" r="1.6" fill="#0b2e8f"/><circle cx="17" cy="5" r="1.6" fill="#0b2e8f"/></svg>',
  text: '<svg viewBox="0 0 20 20"><text x="10" y="15" font-size="13" text-anchor="middle" font-family="Georgia,serif" fill="#2b3442">T</text></svg>',
};
const symIcon = k => symPreview(k).replace('<svg ', '<svg style="width:20px;height:20px" ');
function renderToolbarOld() {
  const b = (act, label, icon, on, title) => `<button class="tb${on ? ' on' : ''}" data-act="${act}" title="${esc(title || label)}">${icon || ''}${label ? `<span>${label}</span>` : ''}</button>`;
  if (P && isFloor(page())) {
    const q = k => `<button class="tb${mode === 'fpplace' && placeSym === k ? ' on' : ''}" data-place="${k}" title="${esc(SYM[k].name)}">${fpIcon(k)}</button>`;
    $('#toolbar').innerHTML =
      b('fileNew', '', '<svg viewBox="0 0 20 20"><path d="M5 2h7l4 4v12H5z" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M12 2v4h4" fill="none" stroke="#556" stroke-width="1.2"/></svg>', false, 'New project (Ctrl+N)') +
      b('openFile', '', '<svg viewBox="0 0 20 20"><path d="M2 5h6l2 2h8v9H2z" fill="#f4d58d" stroke="#8a6d1d" stroke-width="1.1"/></svg>', false, 'Open (Ctrl+O)') +
      b('save', '', '<svg viewBox="0 0 20 20"><path d="M3 3h12l2 2v12H3z" fill="#4a77c9" stroke="#2b4f91" stroke-width="1.1"/><rect x="6" y="4" width="7" height="4" fill="#fff"/><rect x="5.5" y="11" width="9" height="5" fill="#dbe6f7"/></svg>', false, 'Save (Ctrl+S)') +
      '<div class="tbsep"></div>' +
      b('undo', '', '<svg viewBox="0 0 20 20"><path d="M7 5L3 9l4 4M3 9h9a4 4 0 010 8H9" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>', false, 'Undo (Ctrl+Z)') +
      b('redo', '', '<svg viewBox="0 0 20 20"><path d="M13 5l4 4-4 4M17 9H8a4 4 0 000 8h3" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>', false, 'Redo (Ctrl+Y)') +
      '<div class="tbsep"></div>' +
      b('selectMode', 'Select', ICON.select, mode === 'select', 'Select (Esc)') +
      b('roomMode', 'Room', '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>', mode === 'room', 'Draw a rectangular room') +
      b('roomPolyMode', 'Room shape', '<svg viewBox="0 0 20 20"><path d="M3 4h9v5h5v7H3z" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>', mode === 'roompoly', 'Draw an L-shaped or other room by clicking its corners') +
      b('importImage', 'Image', '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M4 14l4-5 3 3 2-2 3 4z" fill="#7a8899"/></svg>', false, 'Import a floor-plan image') +
      '<div class="tbsep"></div>' + FP_QUICK.map(q).join('') +
      '<div class="tbsep"></div>' +
      b('rotateSel', '', '<svg viewBox="0 0 20 20"><path d="M15 10a5 5 0 11-2-4" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M14 2v5h-5" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>', false, 'Rotate (R)') +
      b('delSel', '', '<svg viewBox="0 0 20 20"><path d="M5 6h10l-1 11H6zM3 6h14M8 6V3h4v3" fill="none" stroke="#a33" stroke-width="1.4"/></svg>', false, 'Delete (Del)') +
      '<div class="tbsep"></div>' + b('zoomFit', 'Fit', '', false, 'Zoom to page (F)') +
      b('prevPage', '◀', '', false, 'Previous page (PgUp)') + b('nextPage', '▶', '', false, 'Next page (PgDn)');
    return;
  }
  const q = k => `<button class="tb${mode === 'place' && placeSym === k ? ' on' : ''}" data-place="${k}" title="${esc(SYM[k].name)}">${symIcon(k)}</button>`;
  $('#toolbar').innerHTML =
    b('fileNew', '', '<svg viewBox="0 0 20 20"><path d="M5 2h7l4 4v12H5z" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M12 2v4h4" fill="none" stroke="#556" stroke-width="1.2"/></svg>', false, 'New project (Ctrl+N)') +
    b('openFile', '', '<svg viewBox="0 0 20 20"><path d="M2 5h6l2 2h8v9H2z" fill="#f4d58d" stroke="#8a6d1d" stroke-width="1.1"/></svg>', false, 'Open (Ctrl+O)') +
    b('save', '', '<svg viewBox="0 0 20 20"><path d="M3 3h12l2 2v12H3z" fill="#4a77c9" stroke="#2b4f91" stroke-width="1.1"/><rect x="6" y="4" width="7" height="4" fill="#fff"/><rect x="5.5" y="11" width="9" height="5" fill="#dbe6f7"/></svg>', false, 'Save (Ctrl+S)') +
    '<div class="tbsep"></div>' +
    b('undo', '', '<svg viewBox="0 0 20 20"><path d="M7 5L3 9l4 4M3 9h9a4 4 0 010 8H9" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>', false, 'Undo (Ctrl+Z)') +
    b('redo', '', '<svg viewBox="0 0 20 20"><path d="M13 5l4 4-4 4M17 9H8a4 4 0 000 8h3" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>', false, 'Redo (Ctrl+Y)') +
    '<div class="tbsep"></div>' +
    b('selectMode', 'Select', ICON.select, mode === 'select', 'Select (Esc)') +
    b('wireMode', 'Connection', ICON.wire, mode === 'wire', 'Draw connection (W)') +
    b('textMode', '', ICON.text, mode === 'text', 'Text (T)') +
    '<div class="tbsep"></div>' +
    (S().industrial ? ['coil', 'no', 'nc', 'mc3', 'pbno', 'pbnc', 'cb3', 'fuse', 'lamp', 'motor', 'term', 'ip', 'pe'] : RES_QUICK).map(q).join('') +
    '<div class="tbsep"></div>' +
    b('rotateSel', '', '<svg viewBox="0 0 20 20"><path d="M15 10a5 5 0 11-2-4" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M14 2v5h-5" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>', false, 'Rotate (R)') +
    b('delSel', '', '<svg viewBox="0 0 20 20"><path d="M5 6h10l-1 11H6zM3 6h14M8 6V3h4v3" fill="none" stroke="#a33" stroke-width="1.4"/></svg>', false, 'Delete (Del)') +
    '<div class="tbsep"></div>' +
    b('zoomFit', 'Fit', '', false, 'Zoom to page (F)') +
    b('prevPage', '◀', '', false, 'Previous page (PgUp)') + b('nextPage', '▶', '', false, 'Next page (PgDn)') +
    '<div class="tbsep"></div>' + b('checkProject', 'Check', '', false, 'Check project');
}

const MENUS = {
  file: [['New project', 'fileNew', 'Ctrl+N'], ['Open...', 'openFile', 'Ctrl+O'], ['Save', 'save', 'Ctrl+S'], ['Save as...', 'saveAs', 'Ctrl+Shift+S'], '-', ['Print...', 'printAll', 'Ctrl+P'], ['Export PDF...', 'exportPDF'], '-', ['Export panel schedule (CSV)...', 'exportPanel'], ['Export BOM (CSV)...', 'exportBOM'], ['Export terminal diagrams (CSV)...', 'exportTerminals'], '-', ['Project properties...', 'projectProps']],
  edit: [['Undo', 'undo', 'Ctrl+Z'], ['Redo', 'redo', 'Ctrl+Y'], '-', ['Cut', 'cut', 'Ctrl+X'], ['Copy', 'copySel', 'Ctrl+C'], ['Paste', 'paste', 'Ctrl+V'], ['Delete', 'delSel', 'Del'], '-', ['Select all', 'selAll', 'Ctrl+A'], ['Rotate', 'rotateSel', 'R'], ['Mirror', 'mirrorSel', 'M'], '-', ['Add to-do...', 'addTodoForSelection'], '-', ['Insert macro...', 'insertMacroDlg'], ['Save selection as macro...', 'saveMacro'], '-', ['Draw cable', 'cableMode']],
  page: [['New page...', 'addPage'], ['New floor plan page...', 'addFloorPage'], ['Duplicate page', 'dupPage'], ['Page properties...', 'pageProps'], ['Delete page', 'delPage'], '-', ['Previous page', 'prevPage', 'PgUp'], ['Next page', 'nextPage', 'PgDn']],
  project: [['Project properties...', 'projectProps'], '-', ['Renumber devices...', 'renumberDlg'], ['Wire numbering...', 'wireDlg'], ['Lock wire numbers', 'lockWires'], ['Unlock wire numbers', 'unlockWires'], '-', ['Check project', 'checkProject'], ['Revisions...', 'revisionsDlg'], '-', ['Symbol library...', 'symbolLibrary'], ['New symbol...', 'newSymbol'], '-', ['Table of contents', 'goToc'], ['Panel schedule', 'goPanel'], ['Bill of materials', 'goBOM'], ['Connection list', 'goConn'], ['Cable overview', 'goCables'], ['Terminal diagrams', 'goTerms']],
  view: [['Display settings...', 'settingsDlg'], ['Toggle dark theme', 'toggleTheme'], ['Toggle dark sheet', 'toggleSheet'], ['Customize ribbon...', 'customizeRibbon'], ['Toggle snap to grid', 'toggleSnap', 'G'], '-', ['Zoom to page', 'zoomFit', 'F'], ['Zoom in', 'zoomIn', '+'], ['Zoom out', 'zoomOut', '-'], '-', ['Toggle grid', 'toggleGrid'], ['Toggle connection point labels', 'toggleCl']],
  help: [['Keyboard shortcuts', 'shortcuts'], ['Open demo project', 'demo'], ['Open home demo', 'homeDemo'], '-', ['About OpenSchem', 'about']],
};
function openMenu(el) {
  const items = MENUS[el.dataset.menu]; const dd = $('#dropdown');
  dd.innerHTML = items.map(i => i === '-' ? '<div class="ddsep"></div>' : `<div class="dd" data-act="${i[1]}"><span>${i[0]}</span><span class="k">${i[2] || ''}</span></div>`).join('');
  const r = el.getBoundingClientRect(); dd.style.left = r.left + 'px'; dd.style.top = r.bottom + 'px'; dd.classList.remove('hidden');
  document.querySelectorAll('.menu').forEach(m => m.classList.toggle('open', m === el));
}
function closeMenus() { $('#dropdown').classList.add('hidden'); document.querySelectorAll('.menu').forEach(m => m.classList.remove('open')); }
document.querySelectorAll('.menu').forEach(m => {
  m.addEventListener('mousedown', e => { e.stopPropagation(); m.classList.contains('open') ? closeMenus() : openMenu(m); });
  m.addEventListener('mouseenter', () => { if (document.querySelector('.menu.open') && !m.classList.contains('open')) openMenu(m); });
});
document.addEventListener('mousedown', e => { if (!e.target.closest('#dropdown') && !e.target.closest('.menu')) closeMenus(); });

const ACTIONS = {
  fileNew, openFile, save, saveAs, printAll, projectProps, undo, redo, copySel, paste, delSel, rotateSel,
  cut: () => { copySel(); delSel(); },
  selAll: () => { const pg = page(); sel = new Set([...pg.items.map(i => i.id), ...pg.wires.map(w => w.id)]); render(); },
  addPage, dupPage, pageProps, delPage, prevPage: () => stepPage(-1), nextPage: () => stepPage(1),
  renumberDlg, wireDlg, lockWires, unlockWires, checkProject,
  zoomFit, zoomIn: () => zoomAt(1.25), zoomOut: () => zoomAt(0.8),
  toggleGrid: () => { opts.grid = !opts.grid; renderCanvas(); }, toggleCl: () => { S().connLabels = !S().connLabels; markDirty(); render(); },
  shortcuts, demo: () => { if (!confirmDiscard()) return; loadProject(buildDemo(), ''); }, about,
  selectMode: () => setMode('select'), wireMode: () => setMode('wire'), textMode: () => setMode('text'),
  addTodoForSelection, showTodo: () => { document.querySelector('[data-tab="todo"]').click(); },
  toggleSnap, mirrorSel, customizeRibbon, toggleViewMode, toggleTheme, toggleSheet, exportPDF, revisionsDlg, saveMacro, insertMacroDlg,
  cableMode: () => { if (isFloor(page()) || page().report) { flash('Cables are drawn on schematic pages'); return; } setMode('cable'); },
  cableAutoType: () => { const f = findItem([...sel][0]); if (f && f.cab) commit(() => { f.cab.ctype = defaultCableType(f.pg, f.cab); }); },
  goToc: () => { const r = REPORTS.find(r => r.report === 'toc'); if (r) goPage(r.id); else flash('Turn on the table of contents in Project properties'); },
  goConn: () => { const r = REPORTS.find(r => r.report === 'conn'); if (r) goPage(r.id); else flash('No connections yet'); },
  goCables: () => { const r = REPORTS.find(r => r.report === 'cables'); if (r) goPage(r.id); else flash('No cables yet. Use Draw cable.'); }, symbolLibrary, newSymbol,
  symCopy: () => copySymbol(ctxSym), symEdit: () => editSymbol(ctxSym), symDelete: () => deleteSymbol(ctxSym),
  exportBOM, exportTerminals, exportPanel, settingsDlg, newResidential, addFloorPage, importImage, fitImage, removeImage, placeOnSchematic, placeOnFloor,
  homeDemo: () => { if (!confirmDiscard()) return; loadProject(buildHomeDemo(), ''); },
  roomMode: () => setMode('room'), roomPolyMode: () => setMode('roompoly'), setArea: () => setMode('area'),
  goPanel: () => { const r = REPORTS.find(r => r.report === 'panel'); if (r) goPage(r.id); else flash('No breakers in the project yet'); },
  goBOM: () => goPage(REPORTS.find(r => r.report === 'bom').id),
  goTerms: () => { const r = REPORTS.find(r => r.report === 'term'); if (r) goPage(r.id); else flash('No terminals in the project'); },
  renumContact: () => { const f = findItem([...sel][0]); if (f && f.it) commit(() => assignContactNumbers(f.it)); },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (a && ACTIONS[a.dataset.act]) { closeMenus(); ACTIONS[a.dataset.act](); return; }
  const fpp = e.target.closest('[data-fpplace]'); if (fpp) { placeRot = 0; setMode('fpplace', null, fpp.dataset.fpplace); flash('Click on the floor plan to place it'); return; }
  const sf = e.target.closest('[data-showfloor]'); if (sf) { showOnFloor(sf.dataset.showfloor); return; }
  const pl = e.target.closest('[data-place],[data-sym]'); if (pl) {
    const k = pl.dataset.place || pl.dataset.sym; placeRot = 0; placeMir = false;
    if (isFloor(page())) { if (SYM[k].fp) setMode('fpplace', k); else flash('That symbol is not used on floor plans'); }
    else if (page().report) flash('Open a schematic page to place symbols');
    else setMode('place', k);
    return;
  }
  const pgl = e.target.closest('[data-page]'); if (pgl) { goPage(pgl.dataset.page); return; }
  const g = e.target.closest('[data-goto]'); if (g) { gotoItem(g.dataset.goto); return; }
  const t = e.target.closest('.tab'); if (t) {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tabbody').forEach(x => x.classList.toggle('hidden', x.id !== 'tab-' + t.dataset.tab));
    if (t.dataset.tab === 'devices') renderDevices();
    if (t.dataset.tab === 'todo') renderTodo();
  }
});
$('#pagetabs').addEventListener('dblclick', e => { if (e.target.closest('[data-page]')) pageProps(); });
$('#tab-pages').addEventListener('dblclick', e => { if (e.target.closest('[data-page]')) pageProps(); });

// ---------- dialogs ----------
function dialog(title, fields, onOk, okLabel = 'OK', extraHTML = '') {
  const dlg = $('#dlg'); dlg.style.width = ''; dlg.style.maxWidth = ''; dlg.onkeydown = null; $('#dlgbody').onclick = null; $('#dlgbody').onchange = null;
  $('#dlgtitle').textContent = title;
  let s = '';
  for (const [k, label, v, type, opt] of fields) {
    if (type === 'check') s += `<div class="prow"><label>${label}</label><input type="checkbox" name="${k}" ${v ? 'checked' : ''} style="width:auto"></div>`;
    else if (type === 'select') s += `<div class="prow"><label>${label}</label><select name="${k}">${opt.map(([ov, ol]) => `<option value="${esc(ov)}" ${ov === v ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`;
    else s += `<div class="prow"><label>${label}</label><input name="${k}" value="${esc(v)}" ${type === 'number' ? 'type="number"' : ''}></div>`;
  }
  $('#dlgbody').innerHTML = s + extraHTML;
  $('#dlgbtns').innerHTML = onOk ? `<button type="button" class="btn" onclick="document.getElementById('dlg').close('cancel')">Cancel</button><button class="btn primary" value="ok">${okLabel}</button>` : '<button class="btn primary" value="cancel">Close</button>';
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok' || !onOk) return;
    const v = {}; for (const [k, , , type] of fields) { const el = $('#dlgform').elements[k]; v[k] = type === 'check' ? el.checked : el.value.trim(); }
    if (onOk(v) === false) setTimeout(() => dialog(title, fields.map(f => [f[0], f[1], v[f[0]], f[3], f[4]]), onOk, okLabel, extraHTML), 0);
  };
  dlg.onkeydown = e => { if (e.key === 'Enter' && onOk && e.target.tagName === 'SELECT') { e.preventDefault(); dlg.close('ok'); } };
  dlg.returnValue = ''; dlg.showModal();
  const first = $('#dlgbody input:not([type=checkbox]), #dlgbody select'); if (first) first.focus();
}
function projectProps() {
  dialog('Project properties', [['name', 'Project name', P.name], ['desc', 'Description', P.desc || ''], ['company', 'Company', P.company], ['author', 'Drawn by', P.author], ['cover', 'Cover sheet', P.cover !== false, 'check'], ['toc', 'Table of contents', P.toc !== false, 'check']], v => commit(() => Object.assign(P, v)));
}
function wireDlg() {
  dialog('Wire numbering', [
    ['wireScheme', 'Scheme', P.wireScheme, 'select', [['seq', 'Sequential (1, 2, 3...)'], ['page', 'Page based (101, 102...)'], ['pagecol', 'Page and column (2.4, 2.4a...)'], ['none', 'Off (manual numbers only)']]],
    ['wireStart', 'Start number (sequential)', P.wireStart, 'number'],
    ['potNames', 'Use interruption point names as potential names', P.potNames, 'check'],
  ], v => commit(() => { P.wireScheme = v.wireScheme; P.wireStart = parseInt(v.wireStart, 10) || 1; P.potNames = v.potNames; }), 'OK',
  '<div class="note">Numbers are generated per potential, ordered by page and column. Use Project > Lock wire numbers to freeze them.</div>');
}
function lockWires() { commit(() => { for (const pg of P.pages) for (const w of pg.wires) { const n = WN.get(w.id); if (n) w.no = n; } }); flash('Wire numbers locked'); }
function unlockWires() { if (confirm('Remove all manual and locked wire numbers?')) commit(() => { for (const pg of P.pages) for (const w of pg.wires) delete w.no; }); }

function renumberDlg() {
  dialog('Renumber devices', [['devs', 'Renumber device tags', true, 'check'], ['terms', 'Renumber terminals per strip', true, 'check']], v => {
    commit(() => {
      buildIndex();
      if (v.devs) {
        const groups = new Map();
        for (const d of IX.dev.values()) {
          if (d.items.some(i => i.sym === 'term' || i.role === 'plc')) continue;
          const m = /^([A-Za-z]+)(\d*)$/.exec(d.tag); if (!m) continue;
          const isRes = SYM[d.items[0].sym] && SYM[d.items[0].sym].res;
          const gk = isRes ? (S().numbering === 'room' ? `R\u0001${d.loc}\u0001${m[1]}` : `H\u0001${m[1]}`) : `${d.fn}\u0001${d.loc}\u0001${m[1]}`; if (!groups.has(gk)) groups.set(gk, { prefix: m[1], list: [] });
          groups.get(gk).list.push(d);
        }
        for (const g of groups.values()) {
          g.list.sort((a, b) => cmpKey(orderKey(a.main || a.items[0]), orderKey(b.main || b.items[0])));
          g.list.forEach((d, i) => { const nt = g.prefix + (i + 1); d.items.forEach(it => { it.tag = nt; }); });
        }
      }
      if (v.terms) {
        const strips = new Map();
        for (const it of allItems()) if (it.sym === 'term') { const k = devKey(it); if (!strips.has(k)) strips.set(k, []); strips.get(k).push(it); }
        for (const l of strips.values()) { l.sort((a, b) => cmpKey(orderKey(a), orderKey(b))); l.forEach((it, i) => it.tn = String(i + 1)); }
      }
    });
    flash('Devices renumbered');
  }, 'Renumber', '<div class="note">Devices are numbered per prefix within each function and location, in page and column order. Terminals and PLC cards keep their strip/card names.</div>');
}

function checkProject() {
  buildIndex(); NETS = computeNets();
  const msgs = [];
  const add = (lv, text, id) => msgs.push({ lv, text, id });
  for (const d of IX.dev.values()) {
    const id = fl(d.fn, d.loc) + '-' + d.tag;
    if (d.items.some(i => i.sym === 'term')) {
      const seen = new Map(); for (const t of d.items) { if (seen.has(t.tn)) add('e', `${id}: terminal ${t.tn} exists more than once`, t.id); seen.set(t.tn, 1); }
      continue;
    }
    if (d.items.some(i => i.role === 'plc')) {
      const seen = new Map(); for (const t of d.items) { if (t.addr && seen.has(t.addr)) add('e', `${id}: PLC address ${t.addr} used more than once`, t.id); seen.set(t.addr, 1); }
      continue;
    }
    if (!d.mains.length) add('e', `${id}: no main function (auxiliary functions only)`, d.items[0].id);
    if (d.mains.length > 1) add('w', `${id}: ${d.mains.length} main functions`, d.mains[1].id);
    const cps = new Map();
    for (const it of d.items) for (const c of (it.cl || [])) { if (!c) continue; if (cps.has(c)) add('e', `${id}: connection point ${c} used more than once`, it.id); cps.set(c, 1); }
  }
  for (const t of (P.todos || []).filter(t => !t.done)) add('i', `To-do: ${t.text}`, t.link || '');
  for (const [name, list] of IX.ips) if (list.length < 2) add('w', `Interruption point ${name} has no partner`, list[0].id);
  for (const pg of P.pages) for (const it of pg.items) {
    const d = SYM[it.sym]; if (!d || d.role === 'ip' || d.role === 'pe') continue;
    if (d.prefix && !it.tag) add('e', `${pageName(pg)}: ${d.name} without device tag`, it.id);
    connPts(it).forEach(c => {
      const pm = pg.wires.some(w => [w.pts[0], w.pts[w.pts.length - 1]].some(p => p[0] === c.x && p[1] === c.y));
      const touch = pg.items.some(o => o !== it && connPts(o).some(oc => oc.x === c.x && oc.y === c.y));
      if (!pm && !touch) add('i', `${pageName(pg)}.${colOf(it.x)}: ${it.tag ? dispOnPage(it, pg) : d.name} point ${(it.cl || [])[c.i] || c.i + 1} not connected`, it.id);
    });
  }
  const order = { e: 0, w: 1, i: 2 }; msgs.sort((a, b) => order[a.lv] - order[b.lv]);
  const names = { e: 'Error', w: 'Warning', i: 'Info' };
  const html = msgs.length ? msgs.map(m => `<div class="msg" data-goto="${m.id}"><span class="lv ${m.lv}">${names[m.lv]}</span><span>${esc(m.text)}</span></div>`).join('')
    : '<div class="note">No problems found.</div>';
  const cnt = ['e', 'w', 'i'].map(l => `${msgs.filter(m => m.lv === l).length} ${names[l].toLowerCase()}(s)`).join(', ');
  dialog('Check project', [], null, 'OK', `<div class="sub">${cnt}. Click a message to jump to it.</div>${html}`);
  $('#dlgbody').onclick = e => { const g = e.target.closest('[data-goto]'); if (g) { $('#dlg').close(); gotoItem(g.dataset.goto); } };
}
function shortcuts() {
  const k = [['W', 'Draw connection'], ['T', 'Insert text'], ['R', 'Rotate selection / symbol being placed'], ['Tab', 'Cycle variants A to H while placing'], ['M', 'Mirror selection / symbol being placed'], ['G', 'Snap to grid on/off'], ['C', 'Draw cable'], ['Esc', 'End command, clear selection'], ['Del', 'Delete'], ['Ctrl+C / X / V', 'Copy, cut, paste (new devices get next free tags)'], ['Ctrl+Z / Y', 'Undo, redo'], ['Ctrl+A', 'Select all on page'], ['Ctrl+S', 'Save'], ['Ctrl+P', 'Print or save all pages as PDF'], ['F', 'Zoom to page'], ['Wheel', 'Zoom'], ['Middle drag / Space+drag', 'Pan'], ['PgUp / PgDn', 'Previous / next page'], ['Double click', 'Edit properties'], ['Right click', 'End current command']];
  dialog('Keyboard shortcuts', [], null, 'OK', `<div class="kbd">${k.map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('')}</div>`);
}
function about() {
  dialog('About OpenSchem', [], null, 'OK', '<p><b>OpenSchem 1.4</b><br>Portable electrical schematic editor with structured device tagging (=Function +Location -Device), automatic device and wire numbering, contact mirrors and cross-references.</p><p class="note">Projects are saved as .osp files (JSON). Settings, your symbol library and autosave are kept in the OpenSchem Data folder next to the program.</p>');
}

// ---------- files ----------
function confirmDiscard() { return !dirty || confirm('Discard unsaved changes?'); }
function loadProject(p, path) {
  if (!p || !Array.isArray(p.pages) || !p.pages.length) { alert('Not a valid OpenSchem project.'); return; }
  P = ensureProject(p); registerProjectSyms(P); filePath = path || ''; dirty = false; undoStack = []; redoStack = []; sel.clear(); curId = P.pages[0].id;
  sortPages(); curId = P.pages[0].id; symKey = ''; setMode('select'); render(); zoomFit();
}
function fileNew() { if (!confirmDiscard()) return; loadProject(newProject(), ''); }
async function openFile() {
  if (!confirmDiscard()) return;
  if (!host.has) { const i = document.createElement('input'); i.type = 'file'; i.accept = '.osp,.json'; i.onchange = async () => { const t = await i.files[0].text(); try { loadProject(JSON.parse(t), i.files[0].name); } catch (e) { alert('Could not open file: ' + e.message); } }; i.click(); return; }
  try { const r = await host.open(); if (!r) return; loadProject(JSON.parse(r.content), r.path); flash('Opened ' + r.path); }
  catch (e) { alert('Could not open file: ' + e); }
}
async function save() {
  if (!filePath) return saveAs();
  try { await host.save(filePath, projectJSON()); dirty = false; host.autosave(''); updateTitle(); flash('Saved'); } catch (e) { alert('Save failed: ' + e); }
}
async function saveAs() {
  try {
    const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.osp';
    const p = await host.saveAs(projectJSON(), name); if (!p) return;
    filePath = p; dirty = false; host.autosave(''); updateTitle(); flash('Saved ' + p);
  } catch (e) { alert('Save failed: ' + e); }
}
function printAll() {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
  const keep = sel; sel = new Set(); PRINTING = true;
  $('#printarea').innerHTML = allPages().map(pg => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SH.w} ${SH.h}">${pageSVG(pg, { print: true }).replace(/id="gp"/g, 'id="gp-' + pg.id + '"')}</svg>`).join('');
  sel = keep; PRINTING = false;
  setTimeout(() => window.print(), 50);
}
setInterval(() => { if (dirty) host.autosave(JSON.stringify({ path: filePath, project: P })); }, 30000);

// ---------- demo project ----------
function buildDemo() {
  const p = newProject(); p.name = 'Pump station demo'; p.company = 'OpenSchem'; p.author = 'Engineering';
  const pg1 = newPage('M01', 'CP1', '1', 'Main power'); const pg2 = newPage('M01', 'CP1', '2', 'Pump control');
  p.pages = [pg1, pg2]; P = p;
  const I = (pg, sym, x, y, o = {}) => { const d = SYM[sym]; const it = Object.assign({ id: uid(), sym, x, y, rot: 0, fn: 'M01', loc: 'CP1', tag: '', role: d.role, cl: d.conns.map(c => c[2]), desc: '' }, o); if (sym === 'ip' || sym === 'pe') { delete it.fn; delete it.loc; } pg.items.push(it); return it; };
  const W = (pg, ...pts) => pg.wires.push({ id: uid(), pts });
  // page 1: power
  [['L1', 96], ['L2', 104], ['L3', 112], ['PE', 128]].forEach(([t, x]) => I(pg1, 'term', x, 44, { tag: 'X0', rot: 180, tn: t, desc: 'Incoming supply', part: t === 'PE' ? 'PT 4-PE' : 'PT 4' }));
  I(pg1, 'cb3', 104, 72, { tag: 'Q1', desc: 'Main breaker', part: 'GV2ME10', tech: '4-6.3 A' });
  I(pg1, 'mc3', 104, 104, { tag: 'K1' });
  I(pg1, 'ol3', 104, 136, { tag: 'F1', desc: 'Overload', tech: '4-6 A', part: 'LRD10' });
  I(pg1, 'motor', 104, 172, { tag: 'M1', desc: 'Pump motor', tech: '2.2 kW 400 V' });
  for (const x of [96, 104, 112]) { W(pg1, [x, 48], [x, 64]); W(pg1, [x, 80], [x, 96]); W(pg1, [x, 112], [x, 128]); W(pg1, [x, 144], [x, 160]); }
  W(pg1, [128, 48], [128, 152], [116, 152], [116, 160]);
  I(pg1, 'fuse', 176, 72, { tag: 'F2', desc: 'Control fuse', tech: '2 A', part: 'DF101' }); I(pg1, 'fuse', 200, 72, { tag: 'F3', desc: 'Control fuse', tech: '2 A', part: 'DF101' });
  W(pg1, [96, 60], [176, 60], [176, 64]); W(pg1, [104, 56], [200, 56], [200, 64]);
  W(pg1, [176, 80], [176, 96]); W(pg1, [200, 80], [200, 96]);
  I(pg1, 'ip', 176, 96, { ipName: 'L11', rot: 180 }); I(pg1, 'ip', 200, 96, { ipName: 'L21', rot: 180 });
  // page 2: control
  I(pg2, 'ip', 40, 40, { ipName: 'L11', rot: 270 }); W(pg2, [40, 40], [168, 40]);
  I(pg2, 'ip', 40, 232, { ipName: 'L21', rot: 270 }); W(pg2, [40, 232], [136, 232]);
  W(pg2, [72, 40], [72, 72]);
  I(pg2, 'estop', 72, 80, { tag: 'S0', desc: 'Emergency stop', part: 'XB5AS8445' });
  W(pg2, [72, 88], [72, 96]);
  I(pg2, 'pbnc', 72, 104, { tag: 'S1', desc: 'Stop', part: 'XB5AA42' });
  W(pg2, [72, 112], [72, 120]);
  I(pg2, 'pbno', 72, 128, { tag: 'S2', desc: 'Start', part: 'XB5AA31' });
  I(pg2, 'no', 104, 128, { tag: 'K1', cl: ['13', '14'] });
  W(pg2, [72, 116], [104, 116], [104, 120]);
  W(pg2, [104, 136], [104, 144], [72, 144]);
  W(pg2, [72, 136], [72, 152]);
  I(pg2, 'coil', 72, 160, { tag: 'K1', desc: 'Pump contactor', part: 'LC1D09P7', tech: '230 V AC' });
  W(pg2, [72, 168], [72, 176]);
  I(pg2, 'olnc', 72, 184, { tag: 'F1' });
  W(pg2, [72, 192], [72, 232]);
  W(pg2, [136, 40], [136, 72]);
  I(pg2, 'no', 136, 80, { tag: 'K1', cl: ['23', '24'] });
  I(pg2, 'term', 136, 92, { tag: 'X1', tn: '1', desc: 'Door lamp', part: 'PT 2.5' });
  I(pg2, 'lamp', 136, 104, { tag: 'P1', desc: 'Pump running', part: 'XB5AVB3', tech: '24 V' });
  I(pg2, 'term', 136, 116, { tag: 'X1', tn: '2', desc: 'Door lamp', part: 'PT 2.5' });
  W(pg2, [136, 120], [136, 232]);
  W(pg2, [168, 40], [200, 40], [200, 72]);
  I(pg2, 'no', 200, 80, { tag: 'K1', cl: ['33', '34'] });
  W(pg2, [200, 88], [200, 92]);
  I(pg2, 'plcin', 200, 100, { tag: 'A1', addr: '%I0.0', desc: 'Pump running fb' });
  pg2.items.push({ id: uid(), sym: 'text', x: 252, y: 60, text: 'Pump P-101 local start/stop\nE-stop wired in safety circuit', size: 3.5 });
  return p;
}

// ---------- startup ----------
async function start() {
  await loadPrefs(); applyTheme(); await loadLibrary(); LIB.macros = LIB.macros || [];
  P = ensureProject(newProject()); curId = P.pages[0].id;
  renderSymbols(); renderToolbar();
  render(); zoomFit();
  const init = await host.initialFile();
  if (init && init.content) { try { loadProject(JSON.parse(init.content), init.path); } catch (e) { alert('Could not open ' + init.path); } }
  else {
    const a = await host.getAutosave();
    if (a) { try { const o = JSON.parse(a); if (o.project && confirm('OpenSchem found unsaved work from a previous session. Restore it?')) { loadProject(o.project, o.path || ''); dirty = true; updateTitle(); } else host.autosave(''); } catch (e) {} }
  }
  if (location.hash === '#demo') loadProject(buildDemo(), '');
  if (location.hash === '#home') loadProject(buildHomeDemo(), '');
}
start();
