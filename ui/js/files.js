// ---------- files ----------
function confirmDiscard() { return !dirty || confirm('Discard unsaved changes?'); }
function loadProject(p, path) {
  p = migrateProject(p); if (!p) return;
  const up = p._upgradedFrom;
  P = ensureProject(p); registerProjectSyms(P); filePath = path || ''; dirty = false; undoStack = []; redoStack = []; sel.clear(); curId = P.pages[0].id;
  sortPages(); curId = P.pages[0].id; symKey = ''; setMode('select'); render(); zoomFit();
  if (up && path) flash('Upgraded from an older OpenSchem file. Saving writes the new format.');
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
// called by the Windows host when the user picks Save in the close prompt
async function closeAfterSave() { await save(); if (!dirty) host.quit(); }
window.addEventListener('beforeunload', e => { if (dirty && !host.has) { e.preventDefault(); e.returnValue = ''; } });

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
  try { loadProject(JSON.parse(await f.text()), ''); flash('Opened ' + f.name + '. Use Save as to choose where it is saved.'); }
  catch (err) { alert('Could not open file: ' + err.message); }
});
setInterval(() => { if (dirty) host.autosave(JSON.stringify({ path: filePath, project: P })); }, 30000);

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
