// ---------- files ----------
function confirmDiscard() { return !dirty || confirm('Discard unsaved changes?'); }
function loadProject(p, path) {
  p = migrateProject(p); if (!p) return;
  const up = p._upgradedFrom;
  P = ensureProject(p); registerProjectSyms(P); filePath = path || ''; dirty = false; undoStack = []; redoStack = []; sel.clear(); curId = P.pages[0].id;
  sortPages(); curId = P.pages[0].id; symKey = ''; setMode('select'); render(); zoomFit();
  if (up && path) flash('Upgraded from an older OpenSchem file. Saving writes the new format.');
  host.attach(filePath);
}
// a new project: name and standard (IEC or NFPA). The standard is fixed after this.
function fileNew() {
  if (!confirmDiscard()) return;
  dialog('New project', [['name', 'Project name', 'New project'], ['std', 'Standard', 'IEC', 'select', [['IEC', 'IEC 60617 (international)'], ['NFPA', 'NFPA 79 (North America)']]]], v => {
    const p = newProject(); p.name = v.name || 'New project'; p.std = v.std === 'NFPA' ? 'NFPA' : 'IEC'; loadProject(p, '');
  }, 'Create', '<div class="note">The standard sets the default symbols and the device letters (for example K and S, or CR and PB). It cannot be changed later. Symbols of the other standard can still be placed.</div>');
}
async function openFile() {
  if (!confirmDiscard()) return;
  if (!host.has) { const i = document.createElement('input'); i.type = 'file'; i.accept = '.osp,.json'; i.onchange = async () => { const t = await i.files[0].text(); try { loadProject(JSON.parse(t), i.files[0].name); } catch (e) { alert('Could not open file: ' + e.message); } }; i.click(); return; }
  try { const r = await host.open(); if (!r) return; loadProject(JSON.parse(r.content), r.path); flash('Opened ' + (host.has ? P.name : r.path)); }
  catch (e) { alert('Could not open file: ' + e); }
}
async function save() {
  if (!filePath) return saveAs();
  try { const p = await host.save(filePath, projectJSON()); if (!p) return; filePath = p; dirty = false; host.autosave(''); updateTitle(); flash('Saved'); } catch (e) { alert('Save failed: ' + e.message); }
}
async function saveAs() {
  try {
    const name = (P.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.osp';
    const p = await host.saveAs(projectJSON(), name); if (!p) return;
    filePath = p; dirty = false; host.autosave(''); updateTitle(); flash(host.has ? 'Saved ' + P.name : 'Saved ' + p);
  } catch (e) { alert('Save failed: ' + e.message); }
}
// ids: the pages to print (all pages when left out)
function printAll(ids) {
  buildIndex(); NETS = computeNets(); WN = computeWireNumbers(); REPORTS = buildReports();
  const only = ids ? new Set(ids) : null;
  const keep = sel; sel = new Set(); PRINTING = true;
  const sizes = new Set();
  $('#printarea').innerHTML = allPages().filter(pg => !only || only.has(pg.id)).map(pg => { const s = sheetOf(pg); sizes.add(s); const k = Object.keys(SHEETS).find(x => SHEETS[x] === s); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}" style="width:${s.w}mm;height:${s.h}mm;page:sz${k}">${pageSVG(pg, { print: true }).replace(/id="(gp|fpc-[^"]+|fgp-[^"]+)"/g, 'id="$1-pr' + pg.id + '"').replace(/url\(#(gp|fpc-[^)]+|fgp-[^)]+)\)/g, 'url(#$1-pr' + pg.id + ')')}</svg>`; }).join('');
  let st = document.getElementById('printsizes'); if (!st) { st = document.createElement('style'); st.id = 'printsizes'; document.head.appendChild(st); }
  st.textContent = Object.entries(SHEETS).map(([k, s]) => `@page sz${k}{size:${s.w}mm ${s.h}mm;margin:0}`).join('');
  sel = keep; PRINTING = false;
  setTimeout(() => window.print(), 50);
}
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// keep the embedded browser from reloading or navigating away from the app
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'f5' || ((e.ctrlKey || e.metaKey) && (k === 'r' || k === 'f' || k === 'g' || k === 'u' || k === 'j' || k === 'h'))) e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && (k === '+' || k === '=' || k === '-' || k === '0') && !e.target.closest('#canvaswrap')) e.preventDefault();
}, true);
window.addEventListener('wheel', e => { if (e.ctrlKey && !e.target.closest('#canvaswrap')) e.preventDefault(); }, { passive: false });
window.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('drop', async e => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
  if (!/\.(osp|json)$/i.test(f.name)) { flash('Drop an OpenSchem project (.osp) to open it'); return; }
  if (!confirmDiscard()) return;
  try { loadProject(JSON.parse(await f.text()), ''); flash('Opened ' + f.name + (host.has ? '. Save it to keep it on the server.' : '. Use Save as to choose where it is saved.')); }
  catch (err) { alert('Could not open file: ' + err.message); }
});
setInterval(() => { if (dirty) host.autosave(JSON.stringify({ path: filePath, srv: host.srv, project: P })); }, 30000);

// ---------- startup ----------
async function start() {
  await loadPrefs(); applyTheme(); dockInit(); await loadLibrary(); await loadBlocks(); await loadParts(); LIB.macros = LIB.macros || [];
  P = ensureProject(newProject()); curId = P.pages[0].id;
  renderSymbols(); renderToolbar();
  render(); zoomFit();
  const init = await host.initialFile();
  if (init && init.content) { try { loadProject(JSON.parse(init.content), init.path); } catch (e) { alert('Could not open ' + init.path); } }
  else {
    const a = await host.getAutosave();
    if (a) { try { const o = JSON.parse(a); if (o.project && confirm('OpenSchem found unsaved work from a previous session. Restore it?')) { host.pending = o.srv || null; loadProject(o.project, o.path || ''); dirty = true; updateTitle(); } else host.autosave(''); } catch (e) {} }
  }
  // #demo opens the demo project; #ind and #home open its two building blocks (used by the tests)
  if (location.hash === '#demo') loadProject(buildDemo('IEC'), '');
  if (location.hash === '#demo-nfpa') loadProject(buildDemo('NFPA'), '');
  if (location.hash === '#ind') loadProject(demoIndustrial(), '');
  if (location.hash === '#home') loadProject(demoHome(), '');
}
start();
