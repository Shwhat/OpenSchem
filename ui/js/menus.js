// ---------- toolbar & menus ----------
const MENUS = {
  file: [['New project', 'fileNew', 'Ctrl+N'], ['Open...', 'openFile', 'Ctrl+O'], ['Save', 'save', 'Ctrl+S'], ['Save as...', 'saveAs', 'Ctrl+Shift+S'], '-', ['Print...', 'printAll', 'Ctrl+P'], ['Export PDF...', 'exportPDF'], '-', ['Export panel schedule (CSV)...', 'exportPanel'], ['Export BOM (CSV)...', 'exportBOM'], ['Export terminal diagrams (CSV)...', 'exportTerminals'], '-', ['Export devices (Excel)...', 'exportDevicesXlsx'], ['Import devices (Excel)...', 'importDevicesXlsx'], ['Export BOM (Excel)...', 'exportBOMXlsx'], '-', ['Project properties...', 'projectProps']],
  edit: [['Undo', 'undo', 'Ctrl+Z'], ['Redo', 'redo', 'Ctrl+Y'], '-', ['Cut', 'cut', 'Ctrl+X'], ['Copy', 'copySel', 'Ctrl+C'], ['Paste', 'paste', 'Ctrl+V'], ['Delete', 'delSel', 'Del'], '-', ['Select all', 'selAll', 'Ctrl+A'], ['Find and replace...', 'findDlg', 'Ctrl+F'], ['Rotate', 'rotateSel', 'R'], ['Mirror', 'mirrorSel', 'M'], ['Align to grid', 'alignToGrid', 'Shift+G'], ['Automatic connections on/off', 'toggleAutoConnect'], '-', ['Add to-do...', 'addTodoForSelection'], '-', ['Insert macro...', 'insertMacroDlg'], ['Save selection as macro...', 'saveMacro'], '-', ['Draw cable', 'cableMode'], '-', ['Line', 'gLine'], ['Polyline', 'gPoly'], ['Rectangle', 'gRect'], ['Circle', 'gCircle'], ['Dimension', 'gDim'], ['Image...', 'gfxImage']],
  page: [['New page...', 'addPage'], ['New floor plan page...', 'addFloorPage'], ['New panel layout page...', 'newLayoutPage'], ['Duplicate page', 'dupPage'], ['Page properties...', 'pageProps'], ['Delete page', 'delPage'], '-', ['Previous page', 'prevPage', 'PgUp'], ['Next page', 'nextPage', 'PgDn']],
  project: [['Project properties...', 'projectProps'], '-', ['Renumber devices...', 'renumberDlg'], ['Wire numbering...', 'wireDlg'], ['Lock wire numbers', 'lockWires'], ['Unlock wire numbers', 'unlockWires'], '-', ['Check project', 'checkProject'], ['Revisions...', 'revisionsDlg'], '-', ['Terminal strip editor...', 'terminalEditor'], '-', ['Symbol library...', 'symbolLibrary'], ['New symbol...', 'newSymbol'], ['Parts database...', 'partsDlg'], ['Load defaults...', 'loadDefaultsDlg'], '-', ['Breaker labels...', 'panelDirectoryDlg'], ['Table of contents', 'goToc'], ['Panel schedule', 'goPanel'], ['Bill of materials', 'goBOM'], ['Connection list', 'goConn'], ['Cable overview', 'goCables'], ['Terminal diagrams', 'goTerms']],
  view: [['Display settings...', 'settingsDlg'], ['Toggle dark theme', 'toggleTheme'], ['Toggle dark sheet', 'toggleSheet'], ['Customize ribbon...', 'customizeRibbon'], ['Toggle snap to grid', 'toggleSnap', 'G'], '-', ['Zoom to page', 'zoomFit', 'F'], ['Zoom window', 'zoomWindow', 'Z'], ['Previous view', 'zoomPrev', 'Shift+Z'], ['Zoom in', 'zoomIn', '+'], ['Zoom out', 'zoomOut', '-'], '-', ['Layers...', 'layersDlg'], ['Toggle grid', 'toggleGrid'], ['Toggle connection point labels', 'toggleCl'], '-', ['Page tree', 'navTreeView'], ['Page thumbnails', 'navThumbView']],
  help: [['Keyboard shortcuts', 'shortcuts'], ['Open demo project', 'demo'], '-', ['About OpenSchem', 'about']],
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
  fileNew, openFile, save, saveAs, printAll: () => pagePicker('Print', 'Print', ids => printAll(ids)), projectProps, undo, redo, copySel, paste, delSel, rotateSel,
  cut: () => { copySel(); delSel(); },
  selAll: () => { const pg = page(); if (isFloor(pg) || pg.report) return; sel = new Set(pageObjs(pg).filter(selectable).map(o => o.id)); render(); },
  addPage, dupPage, pageProps, delPage, prevPage: () => stepPage(-1), nextPage: () => stepPage(1),
  renumberDlg, wireDlg, lockWires, unlockWires, checkProject,
  gLine: () => gfxMode('line'), gPoly: () => gfxMode('poly'), gRect: () => gfxMode('rect'), gCircle: () => gfxMode('circle'), gDim: () => gfxMode('dim'), gfxImage,
  navCtxOpen: () => {}, toggleAutoConnect, alignToGrid, newLayoutPage, layRail: () => setMode('lrail'), layDuct: () => setMode('lduct'), findDlg, terminalEditor: () => terminalEditor(), exportDevicesXlsx, importDevicesXlsx, exportBOMXlsx, bbAddPin, partsDlg: () => partsDlg(), pickPartFor, loadDefaultsDlg, panelDirectoryDlg, navExpandAll: () => navSetAll(true), navCollapseAll: () => navSetAll(false),
  zoomFit, zoomIn: () => zoomAt(1.25), zoomOut: () => zoomAt(0.8), zoomWindow, zoomPrev, layersDlg,
  navTreeView: () => { PREFS.navView = 'tree'; savePrefs(); document.querySelector('[data-tab="pages"]').click(); renderPages(); },
  navThumbView: () => { PREFS.navView = 'thumbs'; savePrefs(); document.querySelector('[data-tab="pages"]').click(); renderPages(); },
  toggleGrid: () => { opts.grid = !opts.grid; renderCanvas(); }, toggleCl: () => { S().connLabels = !S().connLabels; markDirty(); render(); },
  shortcuts, demo: () => { if (!confirmDiscard()) return; loadProject(buildDemo(), ''); }, about,
  selectMode: () => setMode('select'), wireMode: () => setMode('wire'), textMode: () => setMode('text'),
  addTodoForSelection, showTodo: () => { document.querySelector('[data-tab="todo"]').click(); },
  toggleSnap, mirrorSel, customizeRibbon, toggleViewMode, toggleTheme, toggleSheet, exportPDF: () => pagePicker('Export PDF', 'Export', ids => exportPDF(ids)), revisionsDlg, saveMacro, insertMacroDlg,
  cableMode: () => { if (isFloor(page()) || page().report) { flash('Cables are drawn on schematic pages'); return; } setMode('cable'); },
  cableAutoType: () => { const f = findItem([...sel][0]); if (f && f.cab) commit(() => { f.cab.ctype = defaultCableType(f.pg, f.cab); }); },
  goToc: () => { const r = REPORTS.find(r => r.report === 'toc'); if (r) goPage(r.id); else flash('Turn on the table of contents in Project properties'); },
  goConn: () => { const r = REPORTS.find(r => r.report === 'conn'); if (r) goPage(r.id); else flash('No connections yet'); },
  goCables: () => { const r = REPORTS.find(r => r.report === 'cables'); if (r) goPage(r.id); else flash('No cables yet. Use Draw cable.'); }, symbolLibrary, newSymbol,
  symCopy: () => copySymbol(ctxSym), symEdit: () => editSymbol(ctxSym), symDelete: () => deleteSymbol(ctxSym),
  exportBOM, exportTerminals, exportPanel, settingsDlg, newResidential, addFloorPage, importImage, fitImage, removeImage, placeOnSchematic, placeOnFloor,
  roomMode: () => setMode('room'), roomPolyMode: () => setMode('roompoly'), roomOvalMode: () => setMode('roomoval'), roomCircMode: () => setMode('roomcirc'), setArea: () => setMode('area'),
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
    else if (page().report || isLayout(page())) flash('Open a schematic page to place symbols');
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
$('#pagetabs').addEventListener('dblclick', e => { if (e.target.closest('[data-pgname]') && !page().report) pageProps(); });
$('#tab-pages').addEventListener('dblclick', e => { if (e.target.closest('[data-page]')) pageProps(); });
