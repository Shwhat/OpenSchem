// ---------- layers ----------
// Display layers control what is drawn on schematic pages, on screen and in print/PDF, with an optional color.
// User layers are named groups that objects (symbols, text, connections, cables) can be put on; they can be
// hidden, left out of print, or locked so their objects cannot be selected.
const DISPLAY_LAYERS = [
  ['sym', 'Symbol graphics'], ['tag', 'Device tags and terminal numbers'], ['desc', 'Descriptions'],
  ['cl', 'Connection point labels'], ['xref', 'Cross-references and contact mirrors'], ['wire', 'Connections'],
  ['wno', 'Wire numbers'], ['junc', 'Junction dots'], ['cable', 'Cables'], ['text', 'Text'], ['gfx', 'Graphics'],
  ['legs', 'Switch legs (floor plans)'], ['legend', 'Circuit legend (floor plans)'], ['todo', 'To-do flags (screen only)'],
];
const NOCOLOR = ['legs', 'legend', 'todo', 'gfx'];
const lyGet = k => (P && P.layers && P.layers[k]) || {};
const printOut = o => !!(o && o.print && !o.thumb);
// is a display layer drawn for this output (screen, thumbnail, or print/PDF)?
function lyOn(k, o) {
  const g = lyGet(k);
  if (k === 'cl' && !S().connLabels) return false;
  return printOut(o) ? !g.noprint : !g.hide;
}
const userLayers = () => (P && P.ulayers) || [];
const layerOf = obj => obj && obj.layer ? userLayers().find(l => l.id === obj.layer) : null;
function objShown(obj, o) { const l = layerOf(obj); return !l || (printOut(o) ? !l.noprint : !l.hide); }
const objLocked = obj => { const l = layerOf(obj); return !!(l && l.lock); };
const selectable = obj => objShown(obj) && !objLocked(obj);
// new objects go on the active layer (if it is visible and unlocked)
function onActiveLayer(obj) {
  const l = userLayers().find(x => x.id === P.activeLayer);
  if (l && !l.hide && !l.lock) obj.layer = l.id;
  return obj;
}
function layerCount(id) {
  let n = 0;
  for (const pg of P.pages) for (const o of pageObjs(pg)) if ((o.layer || '') === id) n++;
  return n;
}
function layerOptions(cur) {
  return [['', 'Default']].concat(userLayers().map(l => [l.id, l.name])).map(([v, n]) => `<option value="${esc(v)}" ${(cur || '') === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

// colors per display layer, as CSS so print and PDF export (which read computed styles) pick them up too
function applyLayerStyles() {
  let el = document.getElementById('lystyle');
  if (!el) { el = document.createElement('style'); el.id = 'lystyle'; document.head.appendChild(el); }
  const c = k => lyGet(k).color;
  let s = '';
  if (c('sym')) s += `.item:not(.sel) .ly-sym{stroke:${c('sym')}!important}.item:not(.sel) .ly-sym .symfill,.item:not(.sel) .ly-sym [fill="#000"]{fill:${c('sym')}!important}.item:not(.sel) .ly-symt{fill:${c('sym')}!important}`;
  for (const k of ['tag', 'desc', 'cl', 'xref', 'text']) if (c(k)) s += `.item:not(.sel) .ly-${k}{fill:${c(k)}!important}`;
  if (c('xref')) s += `.item:not(.sel) .ly-xrefg{stroke:${c('xref')}!important}`;
  if (c('wire')) s += `g:not(.selw)>.ly-wire{stroke:${c('wire')}!important}`;
  if (c('wno')) s += `g:not(.selw)>.ly-wno{fill:${c('wno')}!important}`;
  if (c('junc')) s += `.ly-junc{fill:${c('junc')}!important}`;
  if (c('cable')) s += `.cable:not(.csel) .ly-cable{stroke:${c('cable')}!important}.cable:not(.csel) circle.ly-cable,.cable:not(.csel) text.ly-cable{fill:${c('cable')}!important;stroke:none!important}`;
  el.textContent = s;
}

function layersDlg() {
  let L = clone(P.layers || {}), U = clone(userLayers()), act = P.activeLayer || '', clShow = S().connLabels;
  const chk = (k, f, v, dis) => `<input type="checkbox" data-ly="${k}" data-f="${f}" ${v ? 'checked' : ''} ${dis ? 'disabled' : ''}>`;
  const draw = () => {
    let s = '<h4 class="lyh">Display layers</h4><table class="lytab"><tr><th>Layer</th><th>Show</th><th>Print</th><th>Color</th></tr>';
    for (const [k, name] of DISPLAY_LAYERS) {
      const g = L[k] || {}; const shown = k === 'cl' ? clShow : !g.hide;
      s += `<tr><td>${esc(name)}</td><td>${chk(k, 'show', shown)}</td><td>${k === 'todo' ? '' : chk(k, 'print', !g.noprint)}</td><td class="lycol">${NOCOLOR.includes(k) ? '' : `<input type="color" data-ly="${k}" data-f="color" value="${g.color || '#000000'}" ${g.color ? '' : 'class="unset"'}>${g.color ? `<button type="button" class="btn small" data-lyclr="${k}" title="Use the default color">Default</button>` : '<span class="note">default</span>'}`}</td></tr>`;
    }
    s += '</table><h4 class="lyh">User layers</h4><table class="lytab"><tr><th>Layer</th><th>Show</th><th>Print</th><th>Lock</th><th>Objects</th><th></th></tr>';
    s += `<tr><td><label><input type="radio" name="lyact" value="" ${act === '' ? 'checked' : ''}> Default</label></td><td></td><td></td><td></td><td>${layerCount('')}</td><td></td></tr>`;
    for (const l of U) s += `<tr><td><label><input type="radio" name="lyact" value="${esc(l.id)}" ${act === l.id ? 'checked' : ''}> ${esc(l.name)}</label></td><td>${chk('u:' + l.id, 'show', !l.hide)}</td><td>${chk('u:' + l.id, 'print', !l.noprint)}</td><td>${chk('u:' + l.id, 'lock', l.lock)}</td><td>${layerCount(l.id)}</td><td><button type="button" class="btn small" data-lyren="${esc(l.id)}">Rename</button> <button type="button" class="btn small" data-lydel="${esc(l.id)}">Delete</button></td></tr>`;
    s += '</table><div class="btnrow"><button type="button" class="btn small" data-lyadd="1">New layer</button></div><div class="note">The selected user layer is the active layer: new symbols, text, connections and cables go on it. Locked layers cannot be selected or moved. Put existing objects on a layer in their properties.</div>';
    $('#dlgbody').innerHTML = s;
  };
  const apply = () => commit(() => {
    P.layers = L; P.ulayers = U; P.activeLayer = U.some(l => l.id === act) ? act : ''; S().connLabels = clShow;
    for (const id of [...sel]) { const o = objOf(findItem(id)); if (o && !selectable(o)) sel.delete(id); }
  });
  dialog('Layers', [], null);
  $('#dlg').style.width = '640px'; $('#dlg').style.maxWidth = '96vw';
  draw();
  $('#dlgbody').onchange = e => {
    const t = e.target;
    if (t.name === 'lyact') { act = t.value; apply(); return; }
    const k = t.dataset.ly, f = t.dataset.f; if (!k) return;
    if (k.startsWith('u:')) {
      const l = U.find(x => x.id === k.slice(2)); if (!l) return;
      if (f === 'show') l.hide = !t.checked || undefined; else if (f === 'print') l.noprint = !t.checked || undefined; else l.lock = t.checked || undefined;
    } else {
      const g = L[k] = L[k] || {};
      if (f === 'show') { if (k === 'cl') clShow = t.checked; else g.hide = !t.checked || undefined; }
      else if (f === 'print') g.noprint = !t.checked || undefined;
      else if (f === 'color') g.color = t.value;
    }
    apply(); draw();
  };
  $('#dlgbody').onclick = e => {
    const clr = e.target.closest('[data-lyclr]'); if (clr) { delete (L[clr.dataset.lyclr] || {}).color; apply(); draw(); return; }
    if (e.target.closest('[data-lyadd]')) { const n = prompt('Layer name:', 'Layer ' + (U.length + 1)); if (!n) return; const l = { id: 'L' + uid(), name: n.trim() }; U.push(l); act = l.id; apply(); draw(); return; }
    const ren = e.target.closest('[data-lyren]'); if (ren) { const l = U.find(x => x.id === ren.dataset.lyren); const n = l && prompt('Layer name:', l.name); if (n) { l.name = n.trim(); apply(); draw(); } return; }
    const del = e.target.closest('[data-lydel]');
    if (del) {
      const id = del.dataset.lydel; const n = layerCount(id);
      if (n && !confirm(`Delete this layer? Its ${n} object(s) move to the Default layer.`)) return;
      U = U.filter(x => x.id !== id); if (act === id) act = '';
      commit(() => { for (const pg of P.pages) for (const o of pageObjs(pg)) if (o.layer === id) delete o.layer; P.layers = L; P.ulayers = U; P.activeLayer = act; });
      draw();
    }
  };
}
