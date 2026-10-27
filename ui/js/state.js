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
  host.setDirty(dirty);
}
