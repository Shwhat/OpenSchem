// ---------- tabbed ribbon ----------
const RI = {
  newp: '<svg viewBox="0 0 20 20"><path d="M5 2h7l4 4v12H5z" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M12 2v4h4" fill="none" stroke="#556" stroke-width="1.2"/></svg>',
  open: '<svg viewBox="0 0 20 20"><path d="M2 5h6l2 2h8v9H2z" fill="#f4d58d" stroke="#8a6d1d" stroke-width="1.1"/></svg>',
  save: '<svg viewBox="0 0 20 20"><path d="M3 3h12l2 2v12H3z" fill="#4a77c9" stroke="#2b4f91" stroke-width="1.1"/><rect x="6" y="4" width="7" height="4" fill="#fff"/><rect x="5.5" y="11" width="9" height="5" fill="#dbe6f7"/></svg>',
  undo: '<svg viewBox="0 0 20 20"><path d="M7 5L3 9l4 4M3 9h9a4 4 0 010 8H9" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  redo: '<svg viewBox="0 0 20 20"><path d="M13 5l4 4-4 4M17 9H8a4 4 0 000 8h3" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  cut: '<svg viewBox="0 0 20 20"><circle cx="6" cy="15" r="2.5" fill="none" stroke="#2b3442" stroke-width="1.4"/><circle cx="14" cy="15" r="2.5" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M7.5 13L14 3M12.5 13L6 3" stroke="#2b3442" stroke-width="1.4"/></svg>',
  copy: '<svg viewBox="0 0 20 20"><rect x="6" y="6" width="10" height="11" fill="#fff" stroke="#2b3442" stroke-width="1.3"/><path d="M4 13V3h9" fill="none" stroke="#2b3442" stroke-width="1.3"/></svg>',
  paste: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="14" rx="1" fill="#e9d9b6" stroke="#7a6230" stroke-width="1.2"/><rect x="7" y="2.5" width="6" height="3" fill="#fff" stroke="#7a6230"/><rect x="7" y="8" width="8" height="9" fill="#fff" stroke="#2b3442"/></svg>',
  select: '<svg viewBox="0 0 20 20"><path d="M5 3l10 7-4.5 1 2.5 5-2 1-2.5-5L5 15z" fill="#2b3442"/></svg>',
  wire: '<svg viewBox="0 0 20 20"><path d="M3 15h6V5h8" fill="none" stroke="#0b2e8f" stroke-width="1.6"/><circle cx="3" cy="15" r="1.6" fill="#0b2e8f"/><circle cx="17" cy="5" r="1.6" fill="#0b2e8f"/></svg>',
  text: '<svg viewBox="0 0 20 20"><text x="10" y="15" font-size="13" text-anchor="middle" font-family="Georgia,serif" fill="#2b3442">T</text></svg>',
  rotate: '<svg viewBox="0 0 20 20"><path d="M15 10a5 5 0 11-2-4" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M14 2v5h-5" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  mirror: '<svg viewBox="0 0 20 20"><path d="M10 2v16" stroke="#2b3442" stroke-dasharray="2 1.5"/><path d="M8 5L3 15h5z" fill="#2b3442"/><path d="M12 5l5 10h-5z" fill="none" stroke="#2b3442" stroke-width="1.2"/></svg>',
  del: '<svg viewBox="0 0 20 20"><path d="M5 6h10l-1 11H6zM3 6h14M8 6V3h4v3" fill="none" stroke="#a33" stroke-width="1.4"/></svg>',
  snap: '<svg viewBox="0 0 20 20"><g fill="#7a8899"><circle cx="4" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="16" cy="4" r="1"/><circle cx="4" cy="10" r="1"/><circle cx="16" cy="10" r="1"/><circle cx="4" cy="16" r="1"/><circle cx="10" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></g><circle cx="10" cy="10" r="2.6" fill="none" stroke="#e0332b" stroke-width="1.6"/></svg>',
  grid: '<svg viewBox="0 0 20 20"><path d="M3 3h14v14H3zM8 3v14M13 3v14M3 8h14M3 13h14" fill="none" stroke="#2b3442" stroke-width="1"/></svg>',
  check: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2f7d32" stroke-width="1.6"/><path d="M6.5 10l2.5 2.5 4.5-5" fill="none" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  fit: '<svg viewBox="0 0 20 20"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  zin: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="#2b3442" stroke-width="1.5"/><path d="M12 12l5 5M6 8.5h5M8.5 6v5" stroke="#2b3442" stroke-width="1.5"/></svg>',
  zout: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="#2b3442" stroke-width="1.5"/><path d="M12 12l5 5M6 8.5h5" stroke="#2b3442" stroke-width="1.5"/></svg>',
  prev: '<svg viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  next: '<svg viewBox="0 0 20 20"><path d="M8 4l6 6-6 6" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  page: '<svg viewBox="0 0 20 20"><rect x="4" y="2" width="12" height="16" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M14 13v5M11.5 15.5h5" stroke="#2f7d32" stroke-width="1.6"/></svg>',
  fpage: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M2 10h8V3M10 13v4" fill="none" stroke="#556" stroke-width="1.2"/></svg>',
  props: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="1.5" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M6 7h8M6 10h8M6 13h5" stroke="#556" stroke-width="1.2"/></svg>',
  dup: '<svg viewBox="0 0 20 20"><rect x="7" y="6" width="10" height="12" fill="#fff" stroke="#556" stroke-width="1.2"/><rect x="3" y="2" width="10" height="12" fill="#fff" stroke="#556" stroke-width="1.2"/></svg>',
  num: '<svg viewBox="0 0 20 20"><text x="10" y="14" font-size="10" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#2b3442">123</text></svg>',
  lock: '<svg viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="9" rx="1" fill="#2b3442"/><path d="M7 9V6a3 3 0 016 0v3" fill="none" stroke="#2b3442" stroke-width="1.6"/></svg>',
  report: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fff" stroke="#556" stroke-width="1.2"/><path d="M6 6h8M6 9h8M6 12h8M6 15h5" stroke="#556"/></svg>',
  csv: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#e8f3ea" stroke="#2f7d32" stroke-width="1.2"/><text x="10" y="13" font-size="6" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#2f7d32">CSV</text></svg>',
  settings: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" fill="none" stroke="#2b3442" stroke-width="1.6"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1" stroke="#2b3442" stroke-width="1.6"/></svg>',
  ribbon: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="4" fill="#dbe6f7" stroke="#2b4f91"/><rect x="2" y="9" width="16" height="7" fill="#fff" stroke="#556"/><path d="M5 12h3M10 12h3" stroke="#556" stroke-width="1.5"/></svg>',
  library: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="4" height="14" fill="#dbe6f7" stroke="#2b4f91"/><rect x="8" y="3" width="4" height="14" fill="#f4e2c2" stroke="#8a6d1d"/><path d="M13 4l3.5-.8 2.5 13-3.5.8z" fill="#e3f0e3" stroke="#2f7d32"/></svg>',
  newsym: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="11" height="11" fill="none" stroke="#2b3442" stroke-width="1.3" stroke-dasharray="2 1.5"/><path d="M15 12v6M12 15h6" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  room: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  roompoly: '<svg viewBox="0 0 20 20"><path d="M3 4h9v5h5v7H3z" fill="none" stroke="#2b3442" stroke-width="1.8"/></svg>',
  image: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" fill="none" stroke="#2b3442" stroke-width="1.4"/><path d="M4 14l4-5 3 3 2-2 3 4z" fill="#7a8899"/></svg>',
  cable: '<svg viewBox="0 0 20 20"><path d="M2 10h16" stroke="#444" stroke-width="1.3" stroke-dasharray="4 1.5 1 1.5"/><path d="M6 4v12M10 4v12M14 4v12" stroke="#0b2e8f" stroke-width="1.1"/></svg>',
  macro: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" rx="1.5" fill="#eef3fb" stroke="#2b4f91" stroke-width="1.2"/><path d="M6 6v8M6 10h4M10 7v6" stroke="#0b2e8f" stroke-width="1.2"/><circle cx="14" cy="10" r="2" fill="none" stroke="#000"/></svg>',
  macrosave: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="13" height="12" rx="1.5" fill="#eef3fb" stroke="#2b4f91" stroke-width="1.2"/><path d="M16 9v8M12 13h8" stroke="#2f7d32" stroke-width="1.8"/></svg>',
  todo: '<svg viewBox="0 0 20 20"><path d="M5 17V3" stroke="#b45309" stroke-width="1.5"/><path d="M5 3l10 3-10 3z" fill="#f59e0b"/></svg>',
  todolist: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="3" height="3" fill="none" stroke="#2b3442"/><path d="M3.6 5.5l.9.9 1.5-2" stroke="#2f7d32" fill="none"/><rect x="3" y="9" width="3" height="3" fill="none" stroke="#2b3442"/><rect x="3" y="14" width="3" height="3" fill="none" stroke="#2b3442"/><path d="M8 5.5h9M8 10.5h9M8 15.5h9" stroke="#2b3442" stroke-width="1.3"/></svg>',
  rev: '<svg viewBox="0 0 20 20"><path d="M10 3l7 13H3z" fill="#fff3d6" stroke="#b07a10" stroke-width="1.3"/><text x="10" y="14.5" font-size="7" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#7a5200">A</text></svg>',
  pdf: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#fdecec" stroke="#b3261e" stroke-width="1.2"/><text x="10" y="13" font-size="6" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#b3261e">PDF</text></svg>',
  theme: '<svg viewBox="0 0 20 20"><path d="M14.5 13.5A6.5 6.5 0 017 4a6.5 6.5 0 107.5 9.5z" fill="#2b3442"/></svg>',
  sheetd: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" fill="#1e2228" stroke="#556"/><path d="M6 13h8M10 6v7" stroke="#cfd3d8" stroke-width="1.2"/></svg>',
  cl: '<svg viewBox="0 0 20 20"><path d="M10 2v16" stroke="#2b3442" stroke-width="1.4"/><text x="12" y="8" font-size="6" font-family="Arial" fill="#2b3442">13</text><text x="12" y="16" font-size="6" font-family="Arial" fill="#2b3442">14</text></svg>',
};

// command registry: id -> [label, icon, action, active?]
const CMDS = {
  fileNew: ['New', 'newp', 'fileNew'], openFile: ['Open', 'open', 'openFile'], save: ['Save', 'save', 'save'],
  paste: ['Paste', 'paste', 'paste'], cut: ['Cut', 'cut', 'cut'], copySel: ['Copy', 'copy', 'copySel'],
  undo: ['Undo', 'undo', 'undo'], redo: ['Redo', 'redo', 'redo'],
  selectMode: ['Select', 'select', 'selectMode', () => mode === 'select'], wireMode: ['Connection', 'wire', 'wireMode', () => mode === 'wire'], textMode: ['Text', 'text', 'textMode', () => mode === 'text'],
  rotateSel: ['Rotate', 'rotate', 'rotateSel'], mirrorSel: ['Mirror', 'mirror', 'mirrorSel'], delSel: ['Delete', 'del', 'delSel'],
  toggleSnap: ['Snap', 'snap', 'toggleSnap', () => PREFS.snap], toggleGrid: ['Grid', 'grid', 'toggleGrid', () => opts.grid], toggleCl: ['Point labels', 'cl', 'toggleCl', () => S().connLabels],
  checkProject: ['Check', 'check', 'checkProject'],
  zoomFit: ['Fit page', 'fit', 'zoomFit'], zoomIn: ['Zoom in', 'zin', 'zoomIn'], zoomOut: ['Zoom out', 'zout', 'zoomOut'],
  prevPage: ['Previous', 'prev', 'prevPage'], nextPage: ['Next', 'next', 'nextPage'],
  addPage: ['New page', 'page', 'addPage'], addFloorPage: ['Floor plan page', 'fpage', 'addFloorPage'], pageProps: ['Page props', 'props', 'pageProps'], dupPage: ['Duplicate', 'dup', 'dupPage'], delPage: ['Delete page', 'del', 'delPage'],
  renumberDlg: ['Renumber', 'num', 'renumberDlg'], wireDlg: ['Wire numbers', 'num', 'wireDlg'], lockWires: ['Lock wires', 'lock', 'lockWires'],
  goPanel: ['Panel schedule', 'report', 'goPanel'], goBOM: ['BOM', 'report', 'goBOM'], goTerms: ['Terminals', 'report', 'goTerms'],
  exportPanel: ['Panel CSV', 'csv', 'exportPanel'], exportBOM: ['BOM CSV', 'csv', 'exportBOM'], exportTerminals: ['Terminals CSV', 'csv', 'exportTerminals'],
  settingsDlg: ['Settings', 'settings', 'settingsDlg'], customizeRibbon: ['Customize', 'ribbon', 'customizeRibbon'],
  symbolLibrary: ['Symbol library', 'library', 'symbolLibrary'], newSymbol: ['New symbol', 'newsym', 'newSymbol'],
  cableMode: ['Cable', 'cable', 'cableMode', () => mode === 'cable'], insertMacroDlg: ['Insert macro', 'macro', 'insertMacroDlg', () => mode === 'macro'], saveMacro: ['Save macro', 'macrosave', 'saveMacro'],
  goToc: ['Contents', 'report', 'goToc'], goConn: ['Connection list', 'report', 'goConn'], goCables: ['Cables', 'report', 'goCables'],
  addTodoForSelection: ['Add to-do', 'todo', 'addTodoForSelection'], showTodo: ['To-do list', 'todolist', 'showTodo'],
  revisionsDlg: ['Revisions', 'rev', 'revisionsDlg'], exportPDF: ['PDF', 'pdf', 'exportPDF'],
  toggleTheme: ['Dark theme', 'theme', 'toggleTheme', () => document.documentElement.dataset.theme === 'dark'], toggleSheet: ['Dark sheet', 'sheetd', 'toggleSheet', () => PREFS.sheet === 'dark'],
  roomMode: ['Room', 'room', 'roomMode', () => mode === 'room'], roomPolyMode: ['Room shape', 'roompoly', 'roomPolyMode', () => mode === 'roompoly'], importImage: ['Image', 'image', 'importImage'],
};
const DEFAULT_RIBBON = [
  { id: 'home', name: 'Home', groups: [
    { name: 'Clipboard', items: ['paste', 'cut', 'copySel'] },
    { name: 'History', items: ['undo', 'redo'] },
    { name: 'Tools', items: ['selectMode', 'wireMode', 'textMode'] },
    { name: 'Modify', items: ['rotateSel', 'mirrorSel', 'delSel'] },
    { name: 'Snap', items: ['toggleSnap', 'toggleGrid'] },
    { name: 'Macros', items: ['insertMacroDlg', 'saveMacro'] },
    { name: 'To-do', items: ['addTodoForSelection', 'showTodo'] },
    { name: 'Project', items: ['checkProject', 'revisionsDlg'] },
  ] },
  { id: 'insert', name: 'Insert', groups: [
    { name: 'Coils and contacts', items: ['sym:coil', 'sym:no', 'sym:nc', 'sym:mc3'] },
    { name: 'Command and protection', items: ['sym:pbno', 'sym:pbnc', 'sym:estop', 'sym:cb3', 'sym:fuse', 'sym:ol3'] },
    { name: 'Loads', items: ['sym:motor', 'sym:lamp', 'sym:ps'] },
    { name: 'Connections', items: ['wireMode', 'cableMode', 'sym:term', 'sym:ip', 'sym:pe'] },
    { name: 'Home', items: ['sym:rbrk1', 'sym:rbrkgf', 'sym:rswt', 'sym:rsw3', 'sym:rdim', 'sym:rout', 'sym:routgf', 'sym:rlgt', 'sym:rfan', 'sym:rsmk', 'sym:rjbx', 'sym:rnbar'] },
  ] },
  { id: 'floor', name: 'Floor plan', contextual: true, groups: [
    { name: 'Draw', items: ['selectMode', 'roomMode', 'roomPolyMode', 'importImage'] },
    { name: 'Outlets', items: ['sym:rout', 'sym:routgf', 'sym:routsw', 'sym:rout240'] },
    { name: 'Lights and switches', items: ['sym:rlgt', 'sym:rfan', 'sym:rswt', 'sym:rsw3', 'sym:rsw4', 'sym:rdim'] },
    { name: 'Other', items: ['sym:rsmk', 'sym:rjbx', 'sym:rapp', 'sym:rpnl'] },
    { name: 'Modify', items: ['rotateSel', 'delSel', 'toggleSnap'] },
  ] },
  { id: 'view', name: 'View', groups: [
    { name: 'Zoom', items: ['zoomFit', 'zoomIn', 'zoomOut'] },
    { name: 'Show', items: ['toggleGrid', 'toggleSnap', 'toggleCl'] },
    { name: 'Pages', items: ['prevPage', 'nextPage'] },
    { name: 'Theme', items: ['toggleTheme', 'toggleSheet'] },
    { name: 'Options', items: ['settingsDlg', 'customizeRibbon'] },
  ] },
  { id: 'project', name: 'Project', groups: [
    { name: 'Pages', items: ['addPage', 'addFloorPage', 'pageProps', 'dupPage', 'delPage'] },
    { name: 'Numbering', items: ['renumberDlg', 'wireDlg', 'lockWires'] },
    { name: 'Reports', items: ['goToc', 'goPanel', 'goBOM', 'goConn', 'goCables', 'goTerms'] },
    { name: 'Revisions', items: ['revisionsDlg'] },
    { name: 'Export', items: ['exportPDF', 'exportPanel', 'exportBOM', 'exportTerminals'] },
    { name: 'Symbols', items: ['symbolLibrary', 'newSymbol'] },
  ] },
];
let ribbonTab = 'home', lastPageKind = null;
const ribbonDef = () => PREFS.ribbon || DEFAULT_RIBBON;
function cmdInfo(id) {
  if (id.startsWith('sym:')) {
    const k = id.slice(4); const d = SYM[k]; if (!d) return null;
    return { label: d.name, sym: k };
  }
  const c = CMDS[id]; if (!c) return null;
  return { label: c[0], icon: RI[c[1]] || '', act: c[2], on: c[3] };
}
function renderToolbar() {
  const el = $('#toolbar'); if (!P) return;
  const fp = isFloor(page()); const kind = fp ? 'floor' : 'sch';
  const def = ribbonDef();
  if (kind !== lastPageKind) {
    if (fp && def.some(t => t.id === 'floor')) ribbonTab = 'floor';
    else if (!fp && ribbonTab === 'floor') ribbonTab = 'home';
    lastPageKind = kind;
  }
  const tabs = def.filter(t => !t.contextual || fp);
  if (!tabs.some(t => t.id === ribbonTab)) ribbonTab = (tabs[0] || {}).id;
  const tab = tabs.find(t => t.id === ribbonTab);
  let s = '<div class="rtabs">' + tabs.map(t => `<div class="rtab${t.id === ribbonTab ? ' active' : ''}${t.contextual ? ' ctx' : ''}" data-rtab="${esc(t.id)}">${esc(t.name)}</div>`).join('') + '</div><div class="rpanel">';
  for (const g of (tab ? tab.groups : [])) {
    const items = g.items.map(id => {
      const ci = cmdInfo(id); if (!ci) return '';
      if (ci.sym) {
        const d = SYM[ci.sym];
        if (!fp && d.ind && !S().industrial && tab.id !== 'floor') return '';
        const on = (mode === 'place' || mode === 'fpplace') && placeSym === ci.sym;
        const icon = fp ? (d.fp ? fpIcon(ci.sym) : '') : symPreview(ci.sym).replace('<svg ', '<svg style="width:22px;height:22px" ');
        if (!icon) return '';
        return `<button class="rb${on ? ' on' : ''}" data-place="${ci.sym}" title="${esc(d.name)}">${icon.replace('width:20px;height:20px', 'width:22px;height:22px')}<span>${esc(d.name)}</span></button>`;
      }
      const on = ci.on && ci.on();
      return `<button class="rb${on ? ' on' : ''}" data-act="${ci.act}" title="${esc(ci.label)}">${ci.icon}<span>${esc(ci.label)}</span></button>`;
    }).join('');
    if (items) s += `<div class="rgroup"><div class="ritems">${items}</div><div class="rgname">${esc(g.name)}</div></div>`;
  }
  el.innerHTML = s + '</div>';
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-rtab]'); if (t) { ribbonTab = t.dataset.rtab; renderToolbar(); }
});
// right-click menu on the ribbon (more entries can be added to RIBBON_MENU later)
const RIBBON_MENU = [
  [() => S().terms === 'home' ? 'Switch to engineering view' : 'Switch to homeowner view', 'toggleViewMode'],
  [() => document.documentElement.dataset.theme === 'dark' ? 'Light theme' : 'Dark theme', 'toggleTheme'],
  [() => PREFS.sheet === 'dark' ? 'White sheet' : 'Dark sheet', 'toggleSheet'],
  '-',
  ['Customize ribbon...', 'customizeRibbon'],
];
// one-click switch between the engineering and homeowner presets (labels, tag display, report columns)
function toggleViewMode() {
  const toHome = S().terms !== 'home'; const v = toHome ? 'home' : 'eng';
  commit(() => Object.assign(S(), { terms: v, tagStyle: v, reportCols: toHome ? 'plain' : 'eng' }));
  flash(toHome ? 'Homeowner view' : 'Engineering view');
}
$('#toolbar').addEventListener('contextmenu', e => {
  e.preventDefault();
  const dd = $('#dropdown');
  dd.innerHTML = RIBBON_MENU.map(m => m === '-' ? '<div class="ddsep"></div>' : `<div class="dd" data-act="${m[1]}"><span>${typeof m[0] === 'function' ? m[0]() : m[0]}</span></div>`).join('');
  dd.style.left = e.clientX + 'px'; dd.style.top = e.clientY + 'px'; dd.classList.remove('hidden');
});

// ---------- customize ribbon ----------
function customizeRibbon() {
  let W = clone(ribbonDef()); let ti = 0, gi = 0, ii = -1, q = '';
  const allCmds = () => Object.keys(CMDS).map(id => [id, CMDS[id][0]]).concat(Object.keys(SYM).map(k => ['sym:' + k, 'Symbol: ' + SYM[k].name]));
  const draw = () => {
    const t = W[ti] || { groups: [] }; const g = t.groups[gi] || { items: [] };
    const list = (rows, cur, kind) => `<div class="cz-list">${rows.map((r, i) => `<div class="cz-row${i === cur ? ' on' : ''}" data-cz="${kind}" data-i="${i}">${esc(r)}</div>`).join('') || '<div class="note" style="padding:6px">(empty)</div>'}</div>`;
    const btns = kind => `<div class="cz-btns"><button type="button" class="btn small" data-czb="${kind}:add">Add</button><button type="button" class="btn small" data-czb="${kind}:ren">Rename</button><button type="button" class="btn small" data-czb="${kind}:del">Remove</button><button type="button" class="btn small" data-czb="${kind}:up">▲</button><button type="button" class="btn small" data-czb="${kind}:dn">▼</button></div>`;
    const avail = allCmds().filter(([id, l]) => !q || (l + ' ' + id).toLowerCase().includes(q.toLowerCase()));
    $('#dlgbody').innerHTML = `<div class="cz">
      <div><h4>Tabs</h4>${list(W.map(x => x.name + (x.contextual ? ' (floor plans)' : '')), ti, 't')}${btns('t')}</div>
      <div><h4>Groups in ${esc(t.name || '')}</h4>${list(t.groups.map(x => x.name), gi, 'g')}${btns('g')}</div>
      <div><h4>Buttons in ${esc(g.name || '')}</h4>${list(g.items.map(id => (cmdInfo(id) || { label: id }).label), ii, 'i')}<div class="cz-btns"><button type="button" class="btn small" data-czb="i:del">Remove</button><button type="button" class="btn small" data-czb="i:up">▲</button><button type="button" class="btn small" data-czb="i:dn">▼</button></div></div>
      <div><h4>Available commands</h4><input class="search" id="czq" placeholder="Search commands and symbols" value="${esc(q)}" style="margin:0 0 6px;width:100%"><div class="cz-list">${avail.map(([id, l]) => `<div class="cz-row" data-czadd="${esc(id)}" title="Add to the selected group">${esc(l)}</div>`).join('')}</div><div class="note">Click a command to add it to the selected group.</div></div>
    </div><div class="btnrow"><button type="button" class="btn small" data-czb="x:reset">Reset to default</button></div>`;
    const qi = $('#czq'); qi.oninput = () => { q = qi.value; draw(); const n = $('#czq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  };
  dialog('Customize ribbon', [], () => { PREFS.ribbon = W; savePrefs(); renderToolbar(); }, 'Save');
  $('#dlg').style.width = '980px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  $('#dlgbody').onclick = e => {
    const r = e.target.closest('[data-cz]');
    if (r) { const i = +r.dataset.i; if (r.dataset.cz === 't') { ti = i; gi = 0; ii = -1; } else if (r.dataset.cz === 'g') { gi = i; ii = -1; } else ii = i; draw(); return; }
    const a = e.target.closest('[data-czadd]');
    if (a) { const g = (W[ti] || {}).groups && W[ti].groups[gi]; if (!g) { alert('Select or add a group first.'); return; } g.items.push(a.dataset.czadd); ii = g.items.length - 1; draw(); return; }
    const b = e.target.closest('[data-czb]'); if (!b) return;
    const [kind, op] = b.dataset.czb.split(':');
    if (kind === 'x') { if (confirm('Reset the ribbon to the default layout?')) { W = clone(DEFAULT_RIBBON); ti = 0; gi = 0; ii = -1; draw(); } return; }
    const t = W[ti];
    const arr = kind === 't' ? W : kind === 'g' ? (t && t.groups) : (t && t.groups[gi] && t.groups[gi].items);
    let idx = kind === 't' ? ti : kind === 'g' ? gi : ii;
    if (!arr) return;
    if (op === 'add') {
      const name = prompt(kind === 't' ? 'Tab name:' : 'Group name:', kind === 't' ? 'My tab' : 'My group'); if (!name) return;
      if (kind === 't') { W.push({ id: 'u' + uid(), name, groups: [] }); ti = W.length - 1; gi = 0; }
      else { t.groups.push({ name, items: [] }); gi = t.groups.length - 1; }
    } else if (op === 'ren' && arr[idx]) { const n = prompt('New name:', arr[idx].name); if (n) arr[idx].name = n; }
    else if (op === 'del' && arr[idx] != null) { arr.splice(idx, 1); if (kind === 't') ti = Math.max(0, ti - 1); else if (kind === 'g') gi = Math.max(0, gi - 1); else ii = -1; }
    else if ((op === 'up' || op === 'dn') && arr[idx] != null) {
      const j = idx + (op === 'up' ? -1 : 1); if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      if (kind === 't') ti = j; else if (kind === 'g') gi = j; else ii = j;
    }
    draw();
  };
}

// ---------- preferences in the portable data folder ----------
async function loadPrefs() {
  try { const t = await host.readData('prefs.json'); if (t) Object.assign(PREFS, JSON.parse(t)); } catch (e) {}
}
function savePrefs() { host.writeData('prefs.json', JSON.stringify(PREFS)); }
function toggleSnap() { PREFS.snap = !PREFS.snap; savePrefs(); renderToolbar(); renderStatus(); flash('Snap to grid ' + (PREFS.snap ? 'on' : 'off')); }
