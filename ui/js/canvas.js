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
