// ---------- toolbar & menus ----------
const MENUS = {
  file: [['New project', 'fileNew', 'Ctrl+N'], ['Open...', 'openFile', 'Ctrl+O'], ['Save', 'save', 'Ctrl+S'], ['Save as...', 'saveAs', 'Ctrl+Shift+S'], ...(host.has ? [['Share project...', 'shareProject'], ['Download project (.osp)', 'downloadProject']] : []), '-', ['Print...', 'printAll', 'Ctrl+P'], ['Export PDF...', 'exportPDF'], '-', ['Export panel schedule (CSV)...', 'exportPanel'], ['Export BOM (CSV)...', 'exportBOM'], ['Export terminal diagrams (CSV)...', 'exportTerminals'], '-', ['Export devices (Excel)...', 'exportDevicesXlsx'], ['Import devices (Excel)...', 'importDevicesXlsx'], ['Export BOM (Excel)...', 'exportBOMXlsx'], '-', ['Project properties...', 'projectProps'], '-', ['Import DXF...', 'importDXF'], ['Export DXF...', 'exportDXF'], ['Export SVG...', 'exportSVG'], ['Export PNG...', 'exportPNG']],
  edit: [['Undo', 'undo', 'Ctrl+Z'], ['Redo', 'redo', 'Ctrl+Y'], '-', ['Cut', 'cut', 'Ctrl+X'], ['Copy', 'copySel', 'Ctrl+C'], ['Paste', 'paste', 'Ctrl+V'], ['Delete', 'delSel', 'Del'], '-', ['Select all', 'selAll', 'Ctrl+A'], ['Find and replace...', 'findDlg', 'Ctrl+F'], ['Rotate', 'rotateSel', 'R'], ['Mirror', 'mirrorSel', 'M'], ['Align to grid', 'alignToGrid', 'Shift+G'], ['Automatic connections on/off', 'toggleAutoConnect'], '-', ['Add to-do...', 'addTodoForSelection'], '-', ['Insert macro...', 'insertMacroDlg'], ['Save selection as macro...', 'saveMacro'], '-', ['Draw cable', 'cableMode'], ['Draw tube', 'tubeMode'], '-', ['Line', 'gLine'], ['Polyline', 'gPoly'], ['Rectangle', 'gRect'], ['Circle', 'gCircle'], ['Dimension', 'gDim'], ['Image...', 'gfxImage']],
  page: [['New page...', 'addPage'], ['New floor plan page...', 'addFloorPage'], ['New panel layout page...', 'newLayoutPage'], ['Duplicate page', 'dupPage'], ['Copy page', 'copyPage'], ['Paste page', 'pastePage'], ['Page properties...', 'pageProps'], ['Delete page', 'delPage'], '-', ['Previous page', 'prevPage', 'PgUp'], ['Next page', 'nextPage', 'PgDn']],
  project: [['Project properties...', 'projectProps'], '-', ['Renumber devices...', 'renumberDlg'], ['Wire numbering...', 'wireDlg'], ['Lock wire numbers', 'lockWires'], ['Unlock wire numbers', 'unlockWires'], '-', ['Check project', 'checkProject'], ['Revisions...', 'revisionsDlg'], '-', ['Terminal strip editor...', 'terminalEditor'], '-', ['Symbol library...', 'symbolLibrary'], ['New symbol...', 'newSymbol'], ['Parts database...', 'partsDlg'], ['Manufacturers...', 'mfrDlg'], ['Load defaults...', 'loadDefaultsDlg'], '-', ['Breaker labels...', 'panelDirectoryDlg'], ['Table of contents', 'goToc'], ['Panel schedule', 'goPanel'], ['Bill of materials', 'goBOM'], ['Connection list', 'goConn'], ['Cable overview', 'goCables'], ['Tubing list', 'goTubes'], ['Terminal diagrams', 'goTerms']],
  view: [['Display settings...', 'settingsDlg'], ['Toggle dark theme', 'toggleTheme'], ['Toggle dark sheet', 'toggleSheet'], ['Customize ribbon...', 'customizeRibbon'], ['Toggle snap to grid', 'toggleSnap', 'G'], '-', ['Zoom to page', 'zoomFit', 'F'], ['Zoom window', 'zoomWindow', 'Z'], ['Previous view', 'zoomPrev', 'Shift+Z'], ['Zoom in', 'zoomIn', '+'], ['Zoom out', 'zoomOut', '-'], '-', ['Layers...', 'layersDlg'], ['Toggle grid', 'toggleGrid'], ['Toggle connection point labels', 'toggleCl'], '-', ['Page tree', 'navTreeView'], ['Page thumbnails', 'navThumbView']],
  account: [['Change password...', 'changePassword'], '-', ['Sign out', 'signOut']],
  help: [['Keyboard shortcuts', 'shortcuts'], ['Open IEC demo project', 'demo'], ['Open NFPA demo project', 'demoNfpa'], '-', ['About OpenSchem', 'about']],
};
function openMenu(el) {
  let items = MENUS[el.dataset.menu]; const dd = $('#dropdown');
  if (el.dataset.menu === 'view' && typeof dockMenuItems === 'function') items = items.concat(dockMenuItems());
  dd.innerHTML = items.map(i => i === '-' ? '<div class="ddsep"></div>' : `<div class="dd" data-act="${i[1]}"><span>${typeof i[0] === 'function' ? i[0]() : i[0]}</span><span class="k">${i[2] || ''}</span></div>`).join('');
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
  importDXF: () => importDXF(), exportDXF: () => exportDXF(), exportSVG: () => exportSVG(), exportPNG: () => exportPNG(),
  dDimLin: () => drawMode('dimlin')(), dDimAli: () => drawMode('dimali')(), dDimAng: () => drawMode('dimang')(), dDimRad: () => drawMode('dimrad')(), dDimDia: () => drawMode('dimdia')(),
  dimStyleDlg: () => dimStyleDlg(), toggleDimArrows: () => toggleDimArrows(), dLeader: () => drawMode('leader')(), dHatch: () => drawMode('hatch')(), hatchSettingsDlg: () => hatchSettingsDlg(),
  insertDlg: () => insertDlg(), dBlock: () => drawMode('block')(), blockToLib: () => blockToLib(),
  addView: () => addView(), newViewSheet: () => newViewSheet(), vpOpenSel: () => { const v = (page().vps || []).find(x => sel.has(x.id)); if (v) vpOpen(v); },
  dWall: () => drawMode('wall')(), wallSettingsDlg: () => wallSettingsDlg(), dDoor: () => drawMode('door:single')(), dDoorDouble: () => drawMode('door:double')(), dDoorPocket: () => drawMode('door:pocket')(),
  dDoorBifold: () => drawMode('door:bifold')(), dDoorSliding: () => drawMode('door:sliding')(), dDoorGarage: () => drawMode('door:garage')(), dWindow: () => drawMode('window')(), dOpening: () => drawMode('opening')(), dRoomPick: () => drawMode('roompick')(),
  flipSwing: () => flipOpening('swing'), flipHinge: () => flipOpening('hinge'),
  eMove: () => editMode('move')(), eCopy: () => editMode('copy')(), eRotate: () => editMode('rotate')(), eScale: () => editMode('scale')(), eMirror: () => editMode('mirror')(), eOffset: () => editMode('offset')(),
  eTrim: () => editMode('trim')(), eExtend: () => editMode('extend')(), eFillet: () => editMode('fillet')(), eChamfer: () => editMode('chamfer')(), eBreak: () => editMode('break')(), eBreakAt: () => editMode('breakat')(),
  eJoin: () => editMode('join')(), eExplode: () => editMode('explode')(), eArrayRect: () => editMode('arrayrect')(), eArrayPolar: () => editMode('arraypolar')(), eArrayPath: () => editMode('arraypath')(),
  eFront: () => drawOrder('front'), eBack: () => drawOrder('back'),
  dLine: () => drawMode('line')(), dPline: () => drawMode('pline')(), dArc: () => drawMode('arc')(), dCircle: () => drawMode('circle')(), dCircle2p: () => drawMode('circle:2p')(), dCircle3p: () => drawMode('circle:3p')(),
  dEllipse: () => drawMode('ellipse')(), dPolygon: () => drawMode('polygon')(), dRect: () => drawMode('rect')(), dSpline: () => drawMode('spline')(), dText: () => drawMode('text')(), shapeToRoom: () => shapeToRoom(),
  toggleOsnap, toggleOrtho, togglePolar, osnapDlg, toggleCmdline, scaleDlg: () => scaleDlg(), saveWorkspaceDlg, manageWorkspacesDlg, resetPanels,
  shareProject, downloadProject, changePassword, signOut,
  fileNew, openFile, save, saveAs, printAll: () => pagePicker('Print', 'Print', ids => printAll(ids)), projectProps, undo, redo, copySel, paste, delSel, rotateSel,
  cut: () => { copySel(); delSel(); },
  selAll: () => { const pg = page(); if (isFloor(pg) || pg.report) return; sel = new Set(pageObjs(pg).filter(selectable).map(o => o.id)); render(); },
  addPage, dupPage, pageProps, delPage, prevPage: () => stepPage(-1), nextPage: () => stepPage(1),
  renumberDlg, wireDlg, lockWires, unlockWires, checkProject,
  gLine: () => gfxMode('line'), gPoly: () => gfxMode('poly'), gRect: () => gfxMode('rect'), gCircle: () => gfxMode('circle'), gDim: () => gfxMode('dim'), gfxImage,
  navCtxOpen: () => {}, toggleAutoConnect, alignToGrid, newLayoutPage, layRail: () => setMode('lrail'), layDuct: () => setMode('lduct'), findDlg, terminalEditor: () => terminalEditor(), exportDevicesXlsx, importDevicesXlsx, exportBOMXlsx, bbAddPin, partsDlg: () => partsDlg(), mfrDlg, pickPartFor, loadDefaultsDlg, panelDirectoryDlg, navExpandAll: () => navSetAll(true), navCollapseAll: () => navSetAll(false),
  zoomFit, zoomIn: () => zoomAt(1.25), zoomOut: () => zoomAt(0.8), zoomWindow, zoomPrev, layersDlg,
  navTreeView: () => { PREFS.navView = 'tree'; savePrefs(); showPanel('pages'); renderPages(); },
  navThumbView: () => { PREFS.navView = 'thumbs'; savePrefs(); showPanel('pages'); renderPages(); },
  toggleGrid: () => { opts.grid = !opts.grid; renderCanvas(); }, toggleCl: () => { S().connLabels = !S().connLabels; markDirty(); render(); },
  shortcuts, demo: () => { if (!confirmDiscard()) return; loadProject(buildDemo('IEC'), ''); }, demoNfpa: () => { if (!confirmDiscard()) return; loadProject(buildDemo('NFPA'), ''); }, copyPage, pastePage, tubeMode: () => setMode('tube'), about,
  selectMode: () => setMode('select'), wireMode: () => setMode('wire'), textMode: () => setMode('text'),
  addTodoForSelection, showTodo: () => showPanel('todo'),
  toggleSnap, mirrorSel, customizeRibbon, toggleViewMode, toggleTheme, toggleSheet, exportPDF: () => pagePicker('Export PDF', 'Export', ids => exportPDF(ids)), revisionsDlg, saveMacro, insertMacroDlg,
  cableMode: () => { if (isFloor(page()) || page().report) { flash('Cables are drawn on schematic pages'); return; } setMode('cable'); },
  cableAutoType: () => { const f = findItem([...sel][0]); if (f && f.cab) commit(() => { f.cab.ctype = defaultCableType(f.pg, f.cab); }); },
  goToc: () => { const r = REPORTS.find(r => r.report === 'toc'); if (r) goPage(r.id); else flash('Turn on the table of contents in Project properties'); },
  goConn: () => { const r = REPORTS.find(r => r.report === 'conn'); if (r) goPage(r.id); else flash('No connections yet'); },
  goTubes: () => { const r = REPORTS.find(r => r.report === 'tubes'); if (r) goPage(r.id); else flash('No tubes yet. Use Draw tube on a pneumatic page.'); },
  goCables: () => { const r = REPORTS.find(r => r.report === 'cables'); if (r) goPage(r.id); else flash('No cables yet. Use Draw cable.'); }, symbolLibrary, newSymbol,
  symCopy: () => copySymbol(ctxSym), symEdit: () => editSymbol(ctxSym), symDelete: () => deleteSymbol(ctxSym),
  exportBOM, exportTerminals, exportPanel, settingsDlg, newResidential, addFloorPage, importImage, fitImage, removeImage, placeOnSchematic, placeOnFloor, insertLegend, newCustomReport: () => newCustomReport(), makeCustomCopy,
  roomMode: () => setMode('room'), roomPolyMode: () => setMode('roompoly'), roomOvalMode: () => setMode('roomoval'), roomCircMode: () => setMode('roomcirc'), setArea: () => setMode('area'),
  goPanel: () => { const r = REPORTS.find(r => r.report === 'panel'); if (r) goPage(r.id); else flash('No breakers in the project yet'); },
  goBOM: () => { const r = REPORTS.find(r => r.report === 'bom' && !r.custom); if (r) goPage(r.id); else flash('The bill of materials is turned off in Project properties'); },
  goTerms: () => { const r = REPORTS.find(r => r.report === 'term'); if (r) goPage(r.id); else flash('No terminals in the project'); },
  renumContact: () => { const f = findItem([...sel][0]); if (f && f.it) commit(() => assignContactNumbers(f.it)); },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && /^ws:/.test(a.dataset.act)) { closeMenus(); switchWorkspace(a.dataset.act.slice(3)); return; }
  if (a && /^panel_/.test(a.dataset.act)) { closeMenus(); togglePanel(a.dataset.act.slice(6)); return; }
  if (a && ACTIONS[a.dataset.act]) { closeMenus(); ACTIONS[a.dataset.act](); return; }
  const fpp = e.target.closest('[data-fpplace]'); if (fpp) { placeRot = 0; setMode('fpplace', null, fpp.dataset.fpplace); flash('Click on the floor plan to place it'); return; }
  const sf = e.target.closest('[data-showfloor]'); if (sf) { showOnFloor(sf.dataset.showfloor); return; }
  const pl = e.target.closest('[data-place],[data-sym]'); if (pl) {
    const k = pl.dataset.place || pl.dataset.sym; placeRot = 0; placeMir = false;
    if (isFloor(page())) { if (SYM[k].fp) setMode('fpplace', k); else flash('That symbol is not used on floor plans'); }
    else if (page().report || isLayout(page())) flash('Open a schematic page to place symbols');
    else setMode('place', k);
    return;
  }
  const vs = e.target.closest('[data-vpsel]'); if (vs) { sel = new Set([vs.dataset.vpsel]); render(); return; }
  const pgl = e.target.closest('[data-page]'); if (pgl) { goPage(pgl.dataset.page); return; }
  const g = e.target.closest('[data-goto]'); if (g) { gotoItem(g.dataset.goto); return; }
});
$('#pagetabs').addEventListener('dblclick', e => { if (e.target.closest('[data-pgname]') && !page().report) pageProps(); });
$('#tab-pages').addEventListener('dblclick', e => { if (e.target.closest('[data-page]')) pageProps(); });
